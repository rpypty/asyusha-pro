import type { FastifyInstance } from "fastify";
import { config } from "./config.js";
import {
  connectTelegramChat,
  getDueReminderJobs,
  markReminderFailed,
  markReminderSent
} from "./repository.js";

type TelegramUpdate = {
  update_id: number;
  message?: {
    text?: string;
    chat: {
      id: number | string;
    };
  };
};

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

const apiBase = config.TELEGRAM_BOT_TOKEN
  ? `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`
  : "";

async function telegramRequest<T>(method: string, body: Record<string, unknown>) {
  if (!apiBase) {
    throw new Error("Telegram bot token is not configured");
  }

  const response = await fetch(`${apiBase}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as TelegramResponse<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? `Telegram ${method} failed`);
  }

  return payload.result as T;
}

async function sendMessage(chatId: string, text: string) {
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    disable_web_page_preview: true,
    text
  });
}

function reminderText(job: Awaited<ReturnType<typeof getDueReminderJobs>>[number]) {
  const date = job.scheduledDate ? `\nДата: ${job.scheduledDate}` : "";
  const time = job.startTime ? `\nНачало: ${job.startTime}` : "";
  const reason =
    job.mode === "before" && job.minutesBefore !== null
      ? `за ${job.minutesBefore} мин.`
      : job.remindTime
        ? `в ${job.remindTime}`
        : "по расписанию";

  return `Напоминание ${reason}\n\n${job.title}${date}${time}`;
}

async function handleStartCommand(chatId: string, text: string) {
  const [, token] = text.trim().split(/\s+/, 2);

  if (!token) {
    await sendMessage(chatId, "Отправь /start <код> из приложения Asysha Pro.");
    return;
  }

  const connected = await connectTelegramChat(token, chatId);

  if (!connected) {
    await sendMessage(chatId, "Код не найден. Открой экран Telegram в приложении и скопируй команду заново.");
    return;
  }

  await sendMessage(chatId, `Telegram подключен для ${connected.display_name}. Напоминания включены.`);
}

async function pollTelegramUpdates(offset: number) {
  const updates = await telegramRequest<TelegramUpdate[]>("getUpdates", {
    allowed_updates: ["message"],
    offset,
    timeout: 0
  });
  let nextOffset = offset;

  for (const update of updates) {
    nextOffset = Math.max(nextOffset, update.update_id + 1);
    const text = update.message?.text;
    const chatId = update.message?.chat.id;

    if (!text || chatId === undefined) {
      continue;
    }

    if (text.startsWith("/start")) {
      await handleStartCommand(String(chatId), text);
      continue;
    }

    await sendMessage(String(chatId), "Я пока понимаю только команду /start <код> для подключения приложения.");
  }

  return nextOffset;
}

async function sendDueReminders(app: FastifyInstance) {
  const jobs = await getDueReminderJobs();

  for (const job of jobs) {
    try {
      await sendMessage(job.chatId, reminderText(job));
      await markReminderSent(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Telegram error";
      app.log.error({ err: error, reminderId: job.id }, "Failed to send Telegram reminder");
      await markReminderFailed(job.id, message);
    }
  }
}

export function startTelegramWorkers(app: FastifyInstance) {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_POLLING_ENABLED) {
    app.log.info("Telegram workers are disabled");
    return;
  }

  let offset = 0;
  let polling = false;
  let sending = false;

  const pollTimer = setInterval(() => {
    if (polling) {
      return;
    }

    polling = true;
    pollTelegramUpdates(offset)
      .then((nextOffset) => {
        offset = nextOffset;
      })
      .catch((error) => {
        app.log.error({ err: error }, "Telegram polling failed");
      })
      .finally(() => {
        polling = false;
      });
  }, config.TELEGRAM_POLL_INTERVAL_MS);

  const reminderTimer = setInterval(() => {
    if (sending) {
      return;
    }

    sending = true;
    sendDueReminders(app)
      .catch((error) => {
        app.log.error({ err: error }, "Telegram reminder worker failed");
      })
      .finally(() => {
        sending = false;
      });
  }, config.TELEGRAM_REMINDER_INTERVAL_MS);

  pollTimer.unref();
  reminderTimer.unref();
  app.log.info("Telegram workers started");
}
