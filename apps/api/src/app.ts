import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import {
  clearSessionCookie,
  createSession,
  createUser,
  deleteSession,
  getUserBySessionToken,
  parseCookie,
  SESSION_COOKIE,
  sessionCookie,
  verifyLogin,
  type AuthUser
} from "./auth.js";
import { config } from "./config.js";
import {
  createTag,
  createTask,
  createIdea,
  createIdeaTag,
  deleteIdea,
  deleteIdeaTag,
  deleteTag,
  deleteTask,
  getBacklog,
  getDay,
  getHistory,
  getIdeas,
  getIdeaTags,
  getMonthSummary,
  getStats,
  getTask,
  getTags,
  getTelegramSettings,
  getVideoPostingMonth,
  getWeekSummary,
  setVideoPostingDay,
  updateIdea,
  updateTag,
  updateTask,
  updateTelegramSettings,
  upsertDayEntry,
  upsertReflection
} from "./repository.js";
import { initDb } from "./schema.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .nullable()
  .optional();
const requiredTimeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const reminderSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("before"),
    minutesBefore: z.coerce.number().int().min(0).max(10080),
    remindTime: requiredTimeSchema.nullable().optional()
  }),
  z.object({
    mode: z.literal("at"),
    minutesBefore: z.coerce.number().int().min(0).max(10080).nullable().optional(),
    remindTime: requiredTimeSchema
  })
]);

const taskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  scheduledDate: dateSchema.nullable().optional(),
  startTime: timeSchema,
  endTime: timeSchema,
  priority: z.enum(["must", "should", "optional"]).default("should"),
  status: z
    .enum(["planned", "in_progress", "done", "skipped", "cancelled"])
    .default("planned"),
  tags: z.array(z.string().trim().min(1)).default([]),
  reminders: z.array(reminderSchema).max(10).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderMinutesBefore: z.number().int().min(0).max(1440).optional()
});

const taskPatchSchema = taskSchema.partial();

const dayEntrySchema = z.object({
  note: z.string().default(""),
  productivityScore: z.number().int().min(0).max(10).nullable().optional()
});

const reflectionSchema = z.object({
  grateful: z.string().default(""),
  regret: z.string().default(""),
  wentWell: z.string().default(""),
  improveTomorrow: z.string().default(""),
  insight: z.string().default(""),
  motivation: z.string().default(""),
  betterThanYesterday: z.boolean().default(true),
  productivityScore: z.number().int().min(0).max(10).default(7)
});

const telegramPatchSchema = z.object({
  taskReminders: z.boolean().optional(),
  morningDigest: z.boolean().optional(),
  eveningSurvey: z.boolean().optional(),
  unfinishedRequired: z.boolean().optional()
});

const tagSchema = z.object({
  name: z.string().trim().min(1).max(32),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fg: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

const ideaSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().max(10000).default(""),
  isFavorite: z.boolean().optional(),
  isShot: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional()
});

const ideaTagSchema = z.object({
  name: z.string().trim().min(1).max(32),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fg: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

const videoPostingDaySchema = z.object({
  checked: z.boolean()
});

const authSchema = z.object({
  username: z.string().trim().min(2).max(40),
  password: z.string().min(6).max(128)
});

const registerSchema = authSchema.extend({
  displayName: z.string().trim().min(1).max(80).optional()
});

function todayInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${value.year}-${value.month}-${value.day}`;
}

export async function buildApp() {
  await initDb();

  const app = Fastify({
    logger: config.NODE_ENV !== "test"
  });

  app.register(helmet);
  app.register(cors, {
    credentials: true,
    origin: [config.WEB_ORIGIN, "http://127.0.0.1:5173"]
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      reply.status(400).send({
        error: "validation_error",
        issues: error.issues
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown error";

    app.log.error(error);
    reply.status(500).send({
      error: "internal_error",
      message
    });
  });

  app.get("/api/health", async () => {
    return {
      ok: true,
      service: "asysha-pro-api"
    };
  });

  app.get("/api/auth/me", async (request) => {
    const user = await getCurrentUser(request);

    return {
      user
    };
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = authSchema.parse(request.body);
    const user = await verifyLogin(body.username, body.password);

    if (!user) {
      reply.status(401).send({ error: "invalid_credentials" });
      return;
    }

    const session = await createSession(user.id);
    reply.header("Set-Cookie", sessionCookie(session.token, session.expiresAt));

    return {
      user
    };
  });

  app.post("/api/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const user = await createUser(body);
    const session = await createSession(user.id);
    reply.header("Set-Cookie", sessionCookie(session.token, session.expiresAt));
    reply.status(201).send({ user });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = parseCookie(request.headers.cookie, SESSION_COOKIE);
    await deleteSession(token);
    reply.header("Set-Cookie", clearSessionCookie());
    return { ok: true };
  });

  app.get("/api/tags", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    return {
      tags: await getTags(user.id)
    };
  });

  app.post("/api/tags", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const body = tagSchema.parse(request.body);

    const tag = await createTag(body, user.id);
    reply.status(201).send({ tag });
  });

  app.put("/api/tags/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const body = tagSchema.parse(request.body);
    const tag = await updateTag(params.id, body, user.id);

    if (!tag) {
      reply.status(404).send({ error: "not_found" });
      return;
    }

    return { tag };
  });

  app.delete("/api/tags/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const deleted = await deleteTag(params.id, user.id);

    if (!deleted) {
      reply.status(404).send({ error: "not_found" });
      return;
    }

    reply.status(204).send();
  });

  app.get("/api/ideas", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    return {
      ideas: await getIdeas(user.id)
    };
  });

  app.get("/api/idea-tags", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    return { tags: await getIdeaTags(user.id) };
  });

  app.post("/api/idea-tags", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const body = ideaTagSchema.parse(request.body);
    const tag = await createIdeaTag(body, user.id);

    reply.status(201).send({ tag });
  });

  app.delete("/api/idea-tags/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const deleted = await deleteIdeaTag(params.id, user.id);

    if (!deleted) {
      reply.status(404).send({ error: "not_found" });
      return;
    }

    reply.status(204).send();
  });

  app.post("/api/ideas", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const body = ideaSchema.parse(request.body);
    const idea = await createIdea(body, user.id);

    reply.status(201).send({ idea });
  });

  app.put("/api/ideas/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const body = ideaSchema.parse(request.body);
    const idea = await updateIdea(params.id, body, user.id);

    if (!idea) {
      reply.status(404).send({ error: "not_found" });
      return;
    }

    return { idea };
  });

  app.delete("/api/ideas/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const deleted = await deleteIdea(params.id, user.id);

    if (!deleted) {
      reply.status(404).send({ error: "not_found" });
      return;
    }

    reply.status(204).send();
  });

  app.get("/api/video-posting/month", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const query = z
      .object({
        year: z.coerce.number().int().min(1970).max(3000),
        month: z.coerce.number().int().min(1).max(12)
      })
      .parse(request.query);

    return getVideoPostingMonth(query.year, query.month, user.id);
  });

  app.put("/api/video-posting/:date", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ date: dateSchema }).parse(request.params);
    const body = videoPostingDaySchema.parse(request.body);

    return {
      day: await setVideoPostingDay(params.date, body.checked, user.id)
    };
  });

  app.get("/api/days/:date", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ date: dateSchema }).parse(request.params);

    return getDay(params.date, user.id);
  });

  app.put("/api/days/:date", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ date: dateSchema }).parse(request.params);
    const body = dayEntrySchema.parse(request.body);

    return {
      entry: await upsertDayEntry(params.date, body, user.id)
    };
  });

  app.post("/api/tasks", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const body = taskSchema.parse(request.body);
    const task = await createTask(body, user.id);

    reply.status(201).send({ task });
  });

  app.get("/api/backlog", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    return {
      tasks: await getBacklog(user.id)
    };
  });

  app.get("/api/tasks/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const task = await getTask(params.id, user.id);

    if (!task) {
      reply.status(404).send({ error: "not_found" });
      return;
    }

    return { task };
  });

  app.patch("/api/tasks/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const body = taskPatchSchema.parse(request.body);
    const task = await updateTask(params.id, body, user.id);

    if (!task) {
      reply.status(404).send({ error: "not_found" });
      return;
    }

    return { task };
  });

  app.delete("/api/tasks/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const deleted = await deleteTask(params.id, user.id);

    if (!deleted) {
      reply.status(404).send({ error: "not_found" });
      return;
    }

    reply.status(204).send();
  });

  app.put("/api/reflections/:date", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const params = z.object({ date: dateSchema }).parse(request.params);
    const body = reflectionSchema.parse(request.body);

    if (params.date > todayInTimeZone(user.timezone)) {
      reply.status(422).send({ error: "future_reflection_forbidden" });
      return;
    }

    return {
      reflection: await upsertReflection(params.date, body, user.id)
    };
  });

  app.get("/api/calendar/week", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const query = z.object({ start: dateSchema }).parse(request.query);

    return {
      days: await getWeekSummary(query.start, user.id)
    };
  });

  app.get("/api/calendar/month", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const query = z
      .object({
        year: z.coerce.number().int().min(1970).max(3000),
        month: z.coerce.number().int().min(1).max(12)
      })
      .parse(request.query);

    return {
      days: await getMonthSummary(query.year, query.month, user.id)
    };
  });

  app.get("/api/history", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    return {
      days: await getHistory(user.id)
    };
  });

  app.get("/api/stats", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const query = z.object({ date: dateSchema.optional() }).parse(request.query);

    return getStats(user.id, query.date ?? todayInTimeZone(user.timezone));
  });

  app.get("/api/telegram/settings", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    return {
      settings: await getTelegramSettings(user.id)
    };
  });

  app.patch("/api/telegram/settings", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const body = telegramPatchSchema.parse(request.body);

    return {
      settings: await updateTelegramSettings(body, user.id)
    };
  });

  return app;
}

async function getCurrentUser(request: FastifyRequest) {
  const token = parseCookie(request.headers.cookie, SESSION_COOKIE);
  return getUserBySessionToken(token);
}

async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AuthUser | null> {
  const user = await getCurrentUser(request);

  if (!user) {
    reply.status(401).send({ error: "unauthorized" });
    return null;
  }

  return user;
}
