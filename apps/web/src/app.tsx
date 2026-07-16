import {
  BarChart3,
  Bell,
  Camera,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Edit3,
  Heart,
  History,
  Home,
  Inbox,
  Lightbulb,
  MessageCircle,
  Palette,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Screen =
  | "login"
  | "day"
  | "week"
  | "month"
  | "backlog"
  | "blog"
  | "ideas"
  | "idea"
  | "stats"
  | "records"
  | "unfinished"
  | "history"
  | "editor"
  | "survey"
  | "telegram"
  | "settings";

type Priority = "must" | "should" | "optional";
type TaskStatus = "planned" | "in_progress" | "done" | "skipped" | "cancelled";
type TaskStatsFilter = "done" | "unfinished" | "all";
type ReminderMode = "before" | "at";

type TaskReminderDto = {
  id: number;
  mode: ReminderMode;
  minutesBefore: number | null;
  remindTime: string | null;
  remindAt: string;
  status: "pending" | "sent" | "failed";
};

type EditorReminderDraft = {
  clientId: string;
  mode: ReminderMode;
  minutesBefore: number | null;
  remindTime: string | null;
};

type TagDto = {
  id: number;
  name: string;
  bg: string;
  fg: string;
};

type TaskDto = {
  id: number;
  title: string;
  description: string;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  priority: Priority;
  status: TaskStatus;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  reminders: TaskReminderDto[];
  tags: TagDto[];
};

type DayDto = {
  date: string;
  tasks: TaskDto[];
  tags: TagDto[];
  entry: {
    note: string;
    productivityScore: number | null;
  };
  reflection: ReflectionDto | null;
};

type ReflectionDto = {
  grateful: string;
  regret: string;
  wentWell: string;
  improveTomorrow: string;
  insight: string;
  motivation: string;
  betterThanYesterday: boolean;
  productivityScore: number;
};

type SummaryDay = {
  date: string;
  total: number;
  done: number;
  score?: number | null;
  reflectionFilled: boolean;
  tags: string[];
};

type HistoryDay = {
  date: string;
  note: string;
  score: number | null;
  done: number;
  skipped: number;
  reflectionFilled: boolean;
};

type StatsDto = {
  weekAverage: number;
  monthAverage: number;
  todayScore: number;
  taskRatio: {
    done: number;
    unfinished: number;
    total: number;
    donePercent: number;
    unfinishedPercent: number;
  };
  unfinishedByDay: Array<{
    date: string;
    tasks: TaskDto[];
  }>;
  tasksByDay: Array<{
    date: string;
    tasks: TaskDto[];
  }>;
  bars: Array<{
    label: string;
    date: string;
    score: number;
    done: number;
    unfinished: number;
    total: number;
  }>;
};

type IdeaDto = {
  id: number;
  title: string;
  body: string;
  isFavorite: boolean;
  isShot: boolean;
  tags: IdeaTagDto[];
  createdAt: string;
  updatedAt: string;
};

type IdeaTagDto = {
  id: number;
  name: string;
  bg: string;
  fg: string;
};

type TelegramSettings = {
  connected: boolean;
  chatId: string | null;
  linkToken: string;
  taskReminders: boolean;
  morningDigest: boolean;
  eveningSurvey: boolean;
  unfinishedRequired: boolean;
};

type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  timezone: string;
};

type EditorDraft = {
  id: number | null;
  title: string;
  description: string;
  scheduledDate: string | null;
  startTime: string;
  endTime: string;
  priority: Priority;
  tags: string[];
  reminderEnabled: boolean;
  reminders: EditorReminderDraft[];
};

type SurveyDraft = ReflectionDto;

type AppRoute = {
  screen: Screen;
  date: string;
  ideaId?: number;
  taskId?: number;
  taskStatsFilter?: TaskStatsFilter;
  undated?: boolean;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-\d{2}$/;

const priorityMeta: Record<
  Priority,
  { label: string; color: string; soft: string }
> = {
  must: { label: "Обязательно", color: "#b94f57", soft: "#fbe7e8" },
  should: { label: "Желательно", color: "#a8751f", soft: "#fff2d4" },
  optional: { label: "Необязательно", color: "#7150b8", soft: "#eee8fb" },
};

const defaultTags: Record<string, TagDto> = {
  Работа: { id: 1, name: "Работа", bg: "#e8ecfb", fg: "#4656b8" },
  Зал: { id: 2, name: "Зал", bg: "#e4f3ec", fg: "#2f8f6b" },
  Здоровье: { id: 3, name: "Здоровье", bg: "#e2f1f2", fg: "#2b8a90" },
  Учеба: { id: 4, name: "Учеба", bg: "#efe8fb", fg: "#7150b8" },
  Отдых: { id: 5, name: "Отдых", bg: "#fdf0e2", fg: "#b5772f" },
  Отношения: { id: 6, name: "Отношения", bg: "#fbe8ee", fg: "#b8476a" },
  Финансы: { id: 7, name: "Финансы", bg: "#eef0f4", fg: "#5a6475" },
};

const surveyFields = [
  ["grateful", "За что благодарен сегодня?", "Спокойное утро, поддержка команды..."],
  ["regret", "О чем пожалел?", "Слишком поздно начал важную задачу..."],
  ["wentWell", "Что сегодня получилось?", "Довел ревью до конца..."],
  ["improveTomorrow", "Что можно сделать лучше завтра?", "Начать с самого сложного..."],
  ["insight", "Главная мысль / инсайт дня", "Фокус важнее количества..."],
  ["motivation", "Мотивационная фраза", "Маленькие шаги каждый день..."],
] as const;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function addDays(date: string, days: number) {
  const value = parseIsoDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return toIsoDate(value);
}

function addMonths(date: string, months: number) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(day, lastDay));
  return toIsoDate(target);
}

function getWeekStart(date: string) {
  const value = parseIsoDate(date);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return toIsoDate(value);
}

function parseIsoDate(date: string) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localTomorrowDate() {
  return addDays(localTodayDate(), 1);
}

function pluralizeRu(value: number, one: string, few: string, many: string) {
  const absolute = Math.abs(value);
  const mod10 = absolute % 10;
  const mod100 = absolute % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }

  return many;
}

function formatTaskCount(value: number) {
  return `${value} ${pluralizeRu(value, "задача", "задачи", "задач")}`;
}

function createReminderId() {
  return `rem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatMinutes(value: number) {
  if (value >= 60 && value % 60 === 0) {
    return `${value / 60}ч`;
  }

  return `${value}м`;
}

function reminderDraftFromDto(reminder: TaskReminderDto): EditorReminderDraft {
  return {
    clientId: `db-${reminder.id}`,
    mode: reminder.mode,
    minutesBefore: reminder.minutesBefore,
    remindTime: reminder.remindTime,
  };
}

function fallbackReminderDraft(task: TaskDto): EditorReminderDraft[] {
  if (!task.reminderEnabled || !task.scheduledDate || !task.startTime) {
    return [];
  }

  return [
    {
      clientId: createReminderId(),
      mode: "before",
      minutesBefore: task.reminderMinutesBefore,
      remindTime: null,
    },
  ];
}

function formatDayTitle(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(parseIsoDate(date));
}

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    timeZone: "UTC",
  }).format(parseIsoDate(date));
}

function formatHistoryDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
    timeZone: "UTC",
  }).format(parseIsoDate(date));
}

function formatShortDate(date: string) {
  const value = parseIsoDate(date);
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

function formatDateInputValue(date: string) {
  if (!datePattern.test(date)) {
    return "";
  }

  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

function formatDateTextInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function parseDateTextInput(value: string) {
  const safeValue = value.trim();

  if (datePattern.test(safeValue)) {
    return safeValue;
  }

  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(safeValue);

  if (!match) {
    return "";
  }

  const [, day, month, year] = match;
  const isoDate = `${year}-${month}-${day}`;
  const parsed = parseIsoDate(isoDate);

  if (toIsoDate(parsed) !== isoDate) {
    return "";
  }

  return isoDate;
}

function formatIdeaDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatMonthTitle(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(parseIsoDate(date));
}

function percentToneColor(value: number) {
  if (value < 40) {
    return "#d97779";
  }

  if (value < 70) {
    return "#7aa970";
  }

  return "#3f9f79";
}

function mixHexColor(from: string, to: string, amount: number) {
  const ratio = Math.min(Math.max(amount, 0), 1);
  const fromValue = Number.parseInt(from.slice(1), 16);
  const toValue = Number.parseInt(to.slice(1), 16);
  const fromRgb: [number, number, number] = [(fromValue >> 16) & 255, (fromValue >> 8) & 255, fromValue & 255];
  const toRgb: [number, number, number] = [(toValue >> 16) & 255, (toValue >> 8) & 255, toValue & 255];
  const mixed = [
    Math.round(fromRgb[0] + (toRgb[0] - fromRgb[0]) * ratio),
    Math.round(fromRgb[1] + (toRgb[1] - fromRgb[1]) * ratio),
    Math.round(fromRgb[2] + (toRgb[2] - fromRgb[2]) * ratio),
  ];

  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function percentLineColor(value: number) {
  const clamped = Math.min(Math.max(value, 0), 100);

  if (clamped <= 50) {
    return mixHexColor("#d98286", "#d8bc73", clamped / 50);
  }

  return mixHexColor("#d8bc73", "#5eb985", (clamped - 50) / 50);
}

function monthGrid(date: string) {
  const first = `${date.slice(0, 7)}-01`;
  const firstDate = parseIsoDate(first);
  const lead = (firstDate.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const blanks = Array.from({ length: lead }, (_, index) => `blank-${index}`);
  const days = Array.from({ length: daysInMonth }, (_, index) =>
    toIsoDate(new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), index + 1))),
  );

  return { blanks, days };
}

function formatTimeValue(value: string) {
  return value || "--:--";
}

function clampTimePart(value: number, max: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), max);
}

function formatTimeInput(value: string) {
  const safeValue = value.replace(/[^\d:]/g, "");
  const digits = safeValue.replace(/\D/g, "").slice(0, 4);

  if (safeValue.includes(":")) {
    if (digits.length >= 4) {
      return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    }

    const [hour = "", minute = ""] = safeValue.split(":");
    return `${hour.replace(/\D/g, "").slice(0, 2)}:${minute.replace(/\D/g, "").slice(0, 2)}`;
  }

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length === 3) {
    return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeTimeInput(value: string) {
  const safeValue = value.trim();

  if (!safeValue) {
    return "";
  }

  let hour = "";
  let minute = "";

  if (safeValue.includes(":")) {
    [hour = "", minute = ""] = safeValue.split(":");
  } else {
    const digits = safeValue.replace(/\D/g, "").slice(0, 4);

    if (!digits) {
      return "";
    }

    if (digits.length <= 2) {
      hour = digits;
      minute = "00";
    } else if (digits.length === 3) {
      hour = digits.slice(0, 1);
      minute = digits.slice(1);
    } else {
      hour = digits.slice(0, 2);
      minute = digits.slice(2);
    }
  }

  const normalizedHour = String(clampTimePart(Number(hour || 0), 23)).padStart(2, "0");
  const normalizedMinute = String(clampTimePart(Number(minute || 0), 59)).padStart(2, "0");

  return `${normalizedHour}:${normalizedMinute}`;
}

function emptySurvey(score = 7): SurveyDraft {
  return {
    grateful: "",
    regret: "",
    wentWell: "",
    improveTomorrow: "",
    insight: "",
    motivation: "",
    betterThanYesterday: true,
    productivityScore: score,
  };
}

function emptyEditor(date: string | null): EditorDraft {
  return {
    id: null,
    title: "",
    description: "",
    scheduledDate: date,
    startTime: "",
    endTime: "",
    priority: "should",
    tags: [],
    reminderEnabled: true,
    reminders: [],
  };
}

function editorFromTask(task: TaskDto): EditorDraft {
  const taskReminders = task.reminders ?? [];
  const reminders = taskReminders.length
    ? taskReminders.map(reminderDraftFromDto)
    : fallbackReminderDraft(task);

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    scheduledDate: task.scheduledDate,
    startTime: task.startTime ?? "",
    endTime: task.endTime ?? "",
    priority: task.priority,
    tags: task.tags.map((tag) => tag.name),
    reminderEnabled: reminders.length > 0,
    reminders,
  };
}

function currentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function isDate(value: string | null | undefined): value is string {
  return Boolean(value && datePattern.test(value));
}

function parseRoute(pathname = window.location.pathname, search = window.location.search): AppRoute {
  const params = new URLSearchParams(search);
  const queryDate = isDate(params.get("date")) ? params.get("date")! : localTodayDate();
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) {
    return { screen: "day", date: localTodayDate() };
  }

  if (parts[0] === "login") {
    return { screen: "login", date: queryDate };
  }

  if (parts[0] === "day" && isDate(parts[1])) {
    if (parts[2] === "survey") {
      return { screen: "survey", date: parts[1] };
    }

    return { screen: "day", date: parts[1] };
  }

  if (parts[0] === "week" && isDate(parts[1])) {
    return { screen: "week", date: getWeekStart(parts[1]) };
  }

  if (parts[0] === "month" && parts[1] && monthPattern.test(parts[1])) {
    return { screen: "month", date: `${parts[1]}-01` };
  }

  if (parts[0] === "stats") {
    if (parts[1] === "records") {
      return { screen: "records", date: queryDate };
    }

    if (parts[1] === "tasks") {
      const taskStatsFilter =
        parts[2] === "done" || parts[2] === "unfinished" || parts[2] === "all"
          ? parts[2]
          : "all";

      return { screen: "unfinished", date: queryDate, taskStatsFilter };
    }

    if (parts[1] === "unfinished") {
      return { screen: "unfinished", date: queryDate, taskStatsFilter: "unfinished" };
    }

    return { screen: "stats", date: queryDate };
  }

  if (parts[0] === "backlog") {
    return { screen: "backlog", date: queryDate };
  }

  if (parts[0] === "blog") {
    if (parts[1] === "ideas") {
      const ideaId = Number(parts[2]);

      if (Number.isInteger(ideaId) && ideaId > 0) {
        return { screen: "idea", date: queryDate, ideaId };
      }

      return { screen: "ideas", date: queryDate };
    }

    return { screen: "blog", date: queryDate };
  }

  if (parts[0] === "history") {
    return { screen: "history", date: queryDate };
  }

  if (parts[0] === "telegram") {
    return { screen: "telegram", date: queryDate };
  }

  if (parts[0] === "settings") {
    return { screen: "settings", date: queryDate };
  }

  if (parts[0] === "tasks") {
    if (parts[1] === "new") {
      return { screen: "editor", date: queryDate, undated: params.get("backlog") === "1" };
    }

    const taskId = Number(parts[1]);

    if (Number.isInteger(taskId) && taskId > 0) {
      return { screen: "editor", date: queryDate, taskId };
    }
  }

  return { screen: "day", date: localTodayDate() };
}

function routePath(route: AppRoute) {
  const dateParam = `date=${encodeURIComponent(route.date)}`;

  switch (route.screen) {
    case "login":
      return `/login?${dateParam}`;
    case "day":
      return `/day/${route.date}`;
    case "week":
      return `/week/${getWeekStart(route.date)}`;
    case "month":
      return `/month/${route.date.slice(0, 7)}`;
    case "backlog":
      return `/backlog?${dateParam}`;
    case "blog":
      return `/blog?${dateParam}`;
    case "ideas":
      return `/blog/ideas?${dateParam}`;
    case "idea":
      return route.ideaId ? `/blog/ideas/${route.ideaId}?${dateParam}` : `/blog/ideas?${dateParam}`;
    case "stats":
      return `/stats?${dateParam}`;
    case "records":
      return `/stats/records?${dateParam}`;
    case "unfinished":
      return `/stats/tasks/${route.taskStatsFilter ?? "unfinished"}?${dateParam}`;
    case "history":
      return `/history?${dateParam}`;
    case "editor":
      if (route.taskId) {
        return `/tasks/${route.taskId}?${dateParam}`;
      }

      return route.undated ? `/tasks/new?${dateParam}&backlog=1` : `/tasks/new?${dateParam}`;
    case "survey":
      return `/day/${route.date}/survey`;
    case "telegram":
      return `/telegram?${dateParam}`;
    case "settings":
      return `/settings?${dateParam}`;
    default:
      return `/day/${route.date}`;
  }
}

function tagToken(name: string) {
  return defaultTags[name] ?? {
    id: 0,
    name,
    bg: "#eef0f4",
    fg: "#5a6475",
  };
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseRoute());
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [day, setDay] = useState<DayDto | null>(null);
  const [week, setWeek] = useState<SummaryDay[]>([]);
  const [month, setMonth] = useState<SummaryDay[]>([]);
  const [backlog, setBacklog] = useState<TaskDto[]>([]);
  const [ideas, setIdeas] = useState<IdeaDto[]>([]);
  const [ideaTags, setIdeaTags] = useState<IdeaTagDto[]>([]);
  const [ideasLoaded, setIdeasLoaded] = useState(false);
  const [videoPostingDates, setVideoPostingDates] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [stats, setStats] = useState<StatsDto | null>(null);
  const [telegram, setTelegram] = useState<TelegramSettings | null>(null);
  const [tags, setTags] = useState<TagDto[]>([]);
  const [quick, setQuick] = useState("");
  const [backlogQuick, setBacklogQuick] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [editor, setEditor] = useState<EditorDraft>(() => emptyEditor(route.date));
  const [survey, setSurvey] = useState<SurveyDraft>(() => emptySurvey());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [compactMode, setCompactMode] = useState(false);
  const [desktopNav, setDesktopNav] = useState(true);
  const [taskDeleteCandidate, setTaskDeleteCandidate] = useState<TaskDto | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  const screen = route.screen;
  const selectedDate = route.date;
  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const currentMonth = selectedDate.slice(0, 7);
  const canFillSurvey = selectedDate <= localTodayDate();

  const navigate = useCallback((nextRoute: AppRoute, mode: "push" | "replace" = "push") => {
    const path = routePath(nextRoute);

    if (currentPath() !== path) {
      window.history[mode === "replace" ? "replaceState" : "pushState"](null, "", path);
    }

    setRoute(parseRoute(window.location.pathname, window.location.search));
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const response = await api<{ user: AuthUser | null }>("/api/auth/me");
      setUser(response.user);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [dayRes, weekRes, monthRes, backlogRes, historyRes, statsRes, telegramRes, tagsRes] =
        await Promise.all([
          api<DayDto>(`/api/days/${selectedDate}`),
          api<{ days: SummaryDay[] }>(`/api/calendar/week?start=${weekStart}`),
          api<{ days: SummaryDay[] }>(
            `/api/calendar/month?year=${currentMonth.slice(0, 4)}&month=${Number(
              currentMonth.slice(5, 7),
            )}`,
          ),
          api<{ tasks: TaskDto[] }>("/api/backlog"),
          api<{ days: HistoryDay[] }>("/api/history"),
          api<StatsDto>(`/api/stats?date=${selectedDate}`),
          api<{ settings: TelegramSettings }>("/api/telegram/settings"),
          api<{ tags: TagDto[] }>("/api/tags"),
        ]);

      setDay(dayRes);
      setNoteDraft(dayRes.entry.note);
      setSurvey(dayRes.reflection ?? emptySurvey(dayRes.entry.productivityScore ?? 7));
      setWeek(weekRes.days);
      setMonth(monthRes.days);
      setBacklog(backlogRes.tasks);
      setHistory(historyRes.days);
      setStats(statsRes);
      setTelegram(telegramRes.settings);
      setTags(tagsRes.tags);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [currentMonth, selectedDate, user, weekStart]);

  const loadIdeas = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const [ideasResponse, tagsResponse] = await Promise.all([
        api<{ ideas: IdeaDto[] }>("/api/ideas"),
        api<{ tags: IdeaTagDto[] }>("/api/idea-tags"),
      ]);
      setIdeas(ideasResponse.ideas);
      setIdeaTags(tagsResponse.tags);
      setIdeasLoaded(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить идеи");
    }
  }, [user]);

  const loadVideoPosting = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const response = await api<{ checkedDates: string[] }>(
        `/api/video-posting/month?year=${currentMonth.slice(0, 4)}&month=${Number(
          currentMonth.slice(5, 7),
        )}`,
      );
      setVideoPostingDates(response.checkedDates);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Не удалось загрузить постинг видео",
      );
    }
  }, [currentMonth, user]);

  useEffect(() => {
    const parsed = parseRoute();
    const normalizedPath = routePath(parsed);

    if (currentPath() !== normalizedPath) {
      window.history.replaceState(null, "", normalizedPath);
    }

    const handlePopState = () => {
      setRoute(parseRoute());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (user && screen !== "login") {
      void loadData();
    }
  }, [loadData, screen, user]);

  useEffect(() => {
    if (user && (screen === "blog" || screen === "ideas" || screen === "idea")) {
      void loadIdeas();
    }
  }, [loadIdeas, screen, user]);

  useEffect(() => {
    if (user && screen === "blog") {
      void loadVideoPosting();
    }
  }, [loadVideoPosting, screen, user]);

  useEffect(() => {
    if (user && screen === "login") {
      navigate({ screen: "day", date: selectedDate }, "replace");
    }
  }, [navigate, screen, selectedDate, user]);

  useEffect(() => {
    if (user && screen === "survey" && !canFillSurvey) {
      navigate({ screen: "day", date: selectedDate }, "replace");
    }
  }, [canFillSurvey, navigate, screen, selectedDate, user]);

  useEffect(() => {
    if (!user || screen !== "editor") {
      return;
    }

    let cancelled = false;

    if (route.taskId) {
      if (editor.id === route.taskId) {
        return;
      }

      api<{ task: TaskDto }>(`/api/tasks/${route.taskId}`)
        .then(({ task }) => {
          if (cancelled) {
            return;
          }

          setEditor(editorFromTask(task));

          if (task.scheduledDate && task.scheduledDate !== selectedDate) {
            navigate(
              { screen: "editor", date: task.scheduledDate, taskId: task.id },
              "replace",
            );
          }
        })
        .catch((loadError) => {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : "Не удалось открыть задачу");
          }
        });
    } else {
      setEditor(emptyEditor(route.undated ? null : selectedDate));
    }

    return () => {
      cancelled = true;
    };
  }, [editor.id, navigate, route.taskId, route.undated, screen, selectedDate, user]);

  const done = day?.tasks.filter((task) => task.status === "done").length ?? 0;
  const total = day?.tasks.length ?? 0;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const timedTasks = (day?.tasks ?? []).filter((task) => task.startTime);
  const untimedTasks = (day?.tasks ?? []).filter((task) => !task.startTime);
  const editorReady = screen !== "editor" || !route.taskId || editor.id === route.taskId;
  const selectedIdea = route.ideaId
    ? ideas.find((idea) => idea.id === route.ideaId) ?? null
    : null;

  async function addQuickTask() {
    const title = quick.trim();

    if (!title) {
      openEditor(selectedDate);
      return;
    }

    setSaving(true);
    try {
      await api<{ task: TaskDto }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          scheduledDate: selectedDate,
          priority: "should",
          tags: [],
        }),
      });
      setQuick("");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function addBacklogTask() {
    const title = backlogQuick.trim();

    if (!title) {
      openEditor(null);
      return;
    }

    setSaving(true);
    try {
      await api<{ task: TaskDto }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          scheduledDate: null,
          priority: "should",
          tags: [],
          reminderEnabled: false,
        }),
      });
      setBacklogQuick("");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function repeatUnfinishedTask(task: TaskDto, scheduledDate: string, startTime: string) {
    const normalizedStartTime = normalizeTimeInput(startTime);

    setSaving(true);
    try {
      await api<{ task: TaskDto }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          scheduledDate,
          startTime: normalizedStartTime || null,
          endTime: null,
          priority: task.priority,
          status: "planned",
          tags: task.tags.map((tag) => tag.name),
          reminders: [],
          reminderEnabled: false,
        }),
      });
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task: TaskDto) {
    const nextStatus = task.status === "done" ? "planned" : "done";
    setDay((current) =>
      current
        ? {
            ...current,
            tasks: current.tasks.map((item) =>
              item.id === task.id ? { ...item, status: nextStatus } : item,
            ),
          }
        : current,
    );

    try {
      await api<{ task: TaskDto }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadData();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Не удалось обновить задачу");
      await loadData();
    }
  }

  async function deleteTask(task: TaskDto) {
    setDeletingTask(true);

    try {
      await api(`/api/tasks/${task.id}`, {
        method: "DELETE",
      });
      setTaskDeleteCandidate(null);
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить задачу");
    } finally {
      setDeletingTask(false);
    }
  }

  function openEditor(date: string | null = localTodayDate()) {
    setEditor(emptyEditor(date));
    navigate({ screen: "editor", date: date ?? selectedDate, undated: date === null });
  }

  function openTaskEditor(task: TaskDto) {
    setEditor(editorFromTask(task));
    navigate({ screen: "editor", date: task.scheduledDate ?? selectedDate, taskId: task.id });
  }

  function goToday() {
    navigate({ screen: "day", date: localTodayDate() });
  }

  async function saveEditor() {
    if (!editor.title.trim()) {
      return;
    }

    setSaving(true);
    try {
      const startTime = normalizeTimeInput(editor.startTime);
      const endTime = normalizeTimeInput(editor.endTime);
      const payload = {
        title: editor.title,
        description: editor.description,
        scheduledDate: editor.scheduledDate,
        startTime: editor.scheduledDate ? startTime || null : null,
        endTime: editor.scheduledDate ? endTime || null : null,
        priority: editor.priority,
        tags: editor.tags,
        reminders: editor.scheduledDate
          ? editor.reminders.map((reminder) => ({
              mode: reminder.mode,
              minutesBefore: reminder.minutesBefore,
              remindTime: reminder.remindTime,
            }))
          : [],
        reminderEnabled: editor.scheduledDate ? editor.reminders.length > 0 : false,
      };
      const path = editor.id ? `/api/tasks/${editor.id}` : "/api/tasks";
      const method = editor.id ? "PATCH" : "POST";

      await api<{ task: TaskDto }>(path, {
        method,
        body: JSON.stringify(payload),
      });
      const targetDate = editor.scheduledDate;

      navigate(targetDate ? { screen: "day", date: targetDate } : { screen: "backlog", date: selectedDate });
      if (!targetDate || targetDate === selectedDate) {
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveSurvey() {
    if (!canFillSurvey) {
      navigate({ screen: "day", date: selectedDate }, "replace");
      return;
    }

    setSaving(true);
    try {
      await api(`/api/reflections/${selectedDate}`, {
        method: "PUT",
        body: JSON.stringify(survey),
      });
      await api(`/api/days/${selectedDate}`, {
        method: "PUT",
        body: JSON.stringify({
          note: noteDraft,
          productivityScore: survey.productivityScore,
        }),
      });
      navigate({ screen: "day", date: selectedDate });
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function updateTelegram(patch: Partial<TelegramSettings>) {
    const response = await api<{ settings: TelegramSettings }>("/api/telegram/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setTelegram(response.settings);
  }

  async function createUserTag(input: Omit<TagDto, "id">) {
    const response = await api<{ tag: TagDto }>("/api/tags", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setTags((current) => [...current, response.tag]);
    await loadData();
  }

  async function updateUserTag(tag: TagDto) {
    const response = await api<{ tag: TagDto }>(`/api/tags/${tag.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: tag.name,
        bg: tag.bg,
        fg: tag.fg,
      }),
    });
    setTags((current) => current.map((item) => (item.id === tag.id ? response.tag : item)));
    await loadData();
  }

  async function deleteUserTag(tagId: number) {
    await api(`/api/tags/${tagId}`, {
      method: "DELETE",
    });
    setTags((current) => current.filter((tag) => tag.id !== tagId));
    await loadData();
  }

  async function createIdea(input: { title: string; body: string; tags: string[] }) {
    const response = await api<{ idea: IdeaDto }>("/api/ideas", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setIdeas((current) => [response.idea, ...current]);
    return response.idea;
  }

  async function updateIdea(idea: IdeaDto) {
    const response = await api<{ idea: IdeaDto }>(`/api/ideas/${idea.id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: idea.title,
        body: idea.body,
        isFavorite: idea.isFavorite,
        isShot: idea.isShot,
        tags: idea.tags.map((tag) => tag.name),
      }),
    });
    setIdeas((current) =>
      current.map((item) => (item.id === idea.id ? response.idea : item)),
    );
  }

  async function toggleIdeaFavorite(idea: IdeaDto) {
    await updateIdea({ ...idea, isFavorite: !idea.isFavorite });
  }

  async function toggleIdeaShot(idea: IdeaDto) {
    await updateIdea({ ...idea, isShot: !idea.isShot });
  }

  async function createIdeaTag(input: { name: string; bg: string; fg: string }) {
    const response = await api<{ tag: IdeaTagDto }>("/api/idea-tags", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setIdeaTags((current) => {
      const withoutSameName = current.filter((tag) => tag.name !== response.tag.name);
      return [...withoutSameName, response.tag].sort((left, right) =>
        left.name.localeCompare(right.name, "ru"),
      );
    });
    return response.tag;
  }

  async function toggleVideoPostingDay(date: string) {
    const checked = !videoPostingDates.includes(date);

    setVideoPostingDates((current) =>
      checked ? [...current, date].sort() : current.filter((item) => item !== date),
    );

    try {
      await api(`/api/video-posting/${date}`, {
        method: "PUT",
        body: JSON.stringify({ checked }),
      });
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : "Не удалось обновить день постинга",
      );
      await loadVideoPosting();
    }
  }

  async function deleteIdea(ideaId: number) {
    await api(`/api/ideas/${ideaId}`, {
      method: "DELETE",
    });
    setIdeas((current) => current.filter((idea) => idea.id !== ideaId));
  }

  async function handleLogin(input: { username: string; password: string }) {
    setAuthError(null);

    try {
      const response = await api<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setUser(response.user);
      if (screen === "login") {
        navigate({ screen: "day", date: selectedDate }, "replace");
      }
    } catch {
      setAuthError("Неверный логин или пароль");
    }
  }

  async function handleRegister(input: { username: string; password: string }) {
    setAuthError(null);

    try {
      const response = await api<{ user: AuthUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setUser(response.user);
      if (screen === "login") {
        navigate({ screen: "day", date: selectedDate }, "replace");
      }
    } catch {
      setAuthError("Не удалось создать пользователя. Возможно, логин занят.");
    }
  }

  async function handleLogout() {
    await api("/api/auth/logout", {
      method: "POST",
    });
    setUser(null);
    setDay(null);
    setWeek([]);
    setMonth([]);
    setBacklog([]);
    setIdeas([]);
    setIdeasLoaded(false);
    setVideoPostingDates([]);
    setHistory([]);
    setStats(null);
    setTelegram(null);
    setTags([]);
    navigate({ screen: "login", date: selectedDate }, "replace");
  }

  if (!authChecked) {
    return (
      <main className="stage">
        <section className="auth-shell">
          <div className="loading-card">Проверяю сессию...</div>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        error={authError}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    );
  }

  return (
    <main className="stage">
      <section
        className={[
          "app-frame",
          compactMode ? "app-frame--compact" : "",
          desktopNav ? "" : "app-frame--bottom-nav",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Asysha Pro application"
      >
        <div className="viewport">
          {error && <ErrorBanner message={error} onRetry={loadData} />}
          {(loading && !day) || !editorReady || (screen === "idea" && !ideasLoaded) ? (
            <LoadingScreen />
          ) : (
            <>
              {screen === "day" && day && (
                <DayScreen
                  date={selectedDate}
                  done={done}
                  onAddQuick={addQuickTask}
                  onDeleteTask={setTaskDeleteCandidate}
                  onEditTask={openTaskEditor}
                  onNextDay={() => navigate({ screen: "day", date: addDays(selectedDate, 1) })}
                  onOpenEditor={() => openEditor()}
                  onOpenHistory={() => navigate({ screen: "history", date: selectedDate })}
                  onOpenMonth={() => navigate({ screen: "month", date: selectedDate })}
                  onOpenSettings={() => navigate({ screen: "settings", date: selectedDate })}
                  onOpenSurvey={() => navigate({ screen: "survey", date: selectedDate })}
                  onOpenTelegram={() => navigate({ screen: "telegram", date: selectedDate })}
                  onPrevDay={() => navigate({ screen: "day", date: addDays(selectedDate, -1) })}
                  onToday={goToday}
                  percent={percent}
                  quick={quick}
                  saving={saving}
                  setQuick={setQuick}
                  canFillSurvey={canFillSurvey}
                  surveyFilled={Boolean(day.reflection)}
                  tasks={timedTasks}
                  toggleTask={toggleTask}
                  total={total}
                  untimedTasks={untimedTasks}
                />
              )}
              {screen === "week" && (
                <WeekScreen
                  days={week}
                  selectedDate={selectedDate}
                  weekStart={weekStart}
                  onNextWeek={() => navigate({ screen: "week", date: addDays(weekStart, 7) })}
                  onOpenDay={(date) => {
                    navigate({ screen: "day", date });
                  }}
                  onPrevWeek={() => navigate({ screen: "week", date: addDays(weekStart, -7) })}
                />
              )}
              {screen === "month" && (
                <MonthScreen
                  days={month}
                  onBack={() => {
                    if (window.history.length > 1) {
                      window.history.back();
                      return;
                    }

                    navigate({ screen: "day", date: selectedDate });
                  }}
                  selectedDate={selectedDate}
                  onNextMonth={() => navigate({ screen: "month", date: addMonths(selectedDate, 1) })}
                  onOpenDay={(date) => {
                    navigate({ screen: "day", date });
                  }}
                  onPrevMonth={() => navigate({ screen: "month", date: addMonths(selectedDate, -1) })}
                />
              )}
              {screen === "backlog" && (
                <BacklogScreen
                  onAddQuick={addBacklogTask}
                  onDeleteTask={setTaskDeleteCandidate}
                  onEditTask={openTaskEditor}
                  onOpenEditor={() => openEditor(null)}
                  quick={backlogQuick}
                  saving={saving}
                  setQuick={setBacklogQuick}
                  tasks={backlog}
                  toggleTask={toggleTask}
                />
              )}
              {screen === "blog" && (
                <BlogScreen
                  checkedDates={videoPostingDates}
                  date={selectedDate}
                  ideasCount={ideas.length}
                  onNextMonth={() => navigate({ screen: "blog", date: addMonths(selectedDate, 1) })}
                  onOpenIdeas={() => navigate({ screen: "ideas", date: selectedDate })}
                  onPrevMonth={() => navigate({ screen: "blog", date: addMonths(selectedDate, -1) })}
                  onToggleDay={toggleVideoPostingDay}
                />
              )}
              {screen === "ideas" && (
                <IdeasScreen
                  ideaTags={ideaTags}
                  ideas={ideas}
                  onBack={() => navigate({ screen: "blog", date: selectedDate })}
                  onCreate={createIdea}
                  onCreateTag={createIdeaTag}
                  onDelete={deleteIdea}
                  onOpenIdea={(ideaId) =>
                    navigate({ screen: "idea", date: selectedDate, ideaId })
                  }
                  onToggleFavorite={toggleIdeaFavorite}
                  onToggleShot={toggleIdeaShot}
                />
              )}
              {screen === "idea" && (
                <IdeaDetailScreen
                  idea={selectedIdea}
                  ideaTags={ideaTags}
                  onBack={() => navigate({ screen: "ideas", date: selectedDate })}
                  onDelete={async (ideaId) => {
                    await deleteIdea(ideaId);
                    navigate({ screen: "ideas", date: selectedDate });
                  }}
                  onToggleFavorite={toggleIdeaFavorite}
                  onToggleShot={toggleIdeaShot}
                  onUpdate={updateIdea}
                />
              )}
              {screen === "stats" && (
                <StatsScreen
                  onOpenTaskList={(taskStatsFilter, date) =>
                    navigate({ screen: "unfinished", date, taskStatsFilter })
                  }
                  onOpenRecords={() => navigate({ screen: "records", date: selectedDate })}
                  selectedDate={selectedDate}
                  stats={stats}
                />
              )}
              {screen === "unfinished" && (
                <UnfinishedTasksScreen
                  onBack={() => navigate({ screen: "stats", date: selectedDate })}
                  onNextMonth={() =>
                    navigate({
                      screen: "unfinished",
                      date: addMonths(selectedDate, 1),
                      taskStatsFilter: route.taskStatsFilter ?? "unfinished",
                    })
                  }
                  onPrevMonth={() =>
                    navigate({
                      screen: "unfinished",
                      date: addMonths(selectedDate, -1),
                      taskStatsFilter: route.taskStatsFilter ?? "unfinished",
                    })
                  }
                  onRepeatTask={repeatUnfinishedTask}
                  saving={saving}
                  selectedDate={selectedDate}
                  taskStatsFilter={route.taskStatsFilter ?? "unfinished"}
                  stats={stats}
                />
              )}
              {screen === "records" && (
                <RecordsScreen
                  day={day}
                  days={month}
                  onBack={() => navigate({ screen: "stats", date: selectedDate })}
                  onNextMonth={() => navigate({ screen: "records", date: addMonths(selectedDate, 1) })}
                  onOpenDate={(date) => navigate({ screen: "records", date })}
                  onPrevMonth={() => navigate({ screen: "records", date: addMonths(selectedDate, -1) })}
                  selectedDate={selectedDate}
                />
              )}
              {screen === "history" && (
                <HistoryScreen
                  days={history}
                  onBack={() => navigate({ screen: "day", date: selectedDate })}
                  onOpenDay={(date) => {
                    navigate({ screen: "day", date });
                  }}
                />
              )}
              {screen === "editor" && (
                <EditorScreen
                  draft={editor}
                  saving={saving}
                  tags={tags}
                  onCancel={() =>
                    navigate(
                      editor.scheduledDate
                        ? { screen: "day", date: editor.scheduledDate }
                        : { screen: "backlog", date: selectedDate },
                    )
                  }
                  onChange={setEditor}
                  onSave={saveEditor}
                />
              )}
              {screen === "survey" && canFillSurvey && (
                <SurveyScreen
                  draft={survey}
                  onBack={() => navigate({ screen: "day", date: selectedDate })}
                  onChange={setSurvey}
                  onSave={saveSurvey}
                  saving={saving}
                />
              )}
              {screen === "telegram" && (
                <TelegramScreen
                  settings={telegram}
                  onBack={() => navigate({ screen: "day", date: selectedDate })}
                  onUpdate={updateTelegram}
                />
              )}
              {screen === "settings" && (
                <SettingsScreen
                  compactMode={compactMode}
                  desktopNav={desktopNav}
                  onBack={() => navigate({ screen: "day", date: selectedDate })}
                  onOpenTelegram={() => navigate({ screen: "telegram", date: selectedDate })}
                  onCreateTag={createUserTag}
                  onDeleteTag={deleteUserTag}
                  onLogout={handleLogout}
                  onUpdateTag={updateUserTag}
                  setCompactMode={setCompactMode}
                  setDesktopNav={setDesktopNav}
                  tags={tags}
                  telegram={telegram}
                  user={user}
                />
              )}
            </>
          )}
        </div>
        {["day", "week", "month", "backlog", "blog", "ideas", "idea", "stats", "records"].includes(screen) && (
          <TabBar
            active={["ideas", "idea"].includes(screen) ? "blog" : screen === "records" ? "stats" : screen}
            onChange={(nextScreen) => {
              if (nextScreen === "day") {
                navigate({ screen: "day", date: localTodayDate() });
                return;
              }

              if (nextScreen === "week") {
                navigate({ screen: "week", date: localTodayDate() });
                return;
              }

              if (nextScreen === "blog") {
                navigate({ screen: "blog", date: selectedDate });
                return;
              }

              navigate({ screen: nextScreen, date: selectedDate });
            }}
          />
        )}
      </section>
      {taskDeleteCandidate && (
        <TaskDeleteDialog
          deleting={deletingTask}
          onCancel={() => setTaskDeleteCandidate(null)}
          onConfirm={() => void deleteTask(taskDeleteCandidate)}
          task={taskDeleteCandidate}
        />
      )}
    </main>
  );
}

function LoadingScreen() {
  return (
    <section className="screen padded day-screen fade-in">
      <div className="loading-card">Загружаю данные из Postgres...</div>
    </section>
  );
}

function LoginScreen({
  error,
  onLogin,
  onRegister,
}: {
  error: string | null;
  onLogin: (input: { username: string; password: string }) => Promise<void>;
  onRegister: (input: { username: string; password: string }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo12345");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);

    try {
      const input = {
        username: username.trim(),
        password,
      };

      if (mode === "login") {
        await onLogin(input);
      } else {
        await onRegister(input);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="stage auth-stage">
      <section className="auth-shell">
        <div className="auth-brand">
          <span>
            <Check size={22} />
          </span>
          <div>
            <p className="overline">Asysha Pro</p>
            <h1>Вход</h1>
          </div>
        </div>

        <form className="auth-card" onSubmit={submit}>
          <div className="auth-tabs" role="tablist">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
              type="button"
            >
              Войти
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                if (username === "demo") {
                  setUsername("");
                  setPassword("");
                }
              }}
              type="button"
            >
              Создать
            </button>
          </div>

          <label>
            <span>Логин</span>
            <input
              autoComplete="username"
              required
              onChange={(event) => setUsername(event.target.value)}
              placeholder="demo"
              value={username}
            />
          </label>
          <label>
            <span>Пароль</span>
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="demo12345"
              required
              type="password"
              value={password}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button
            className="primary-action"
            disabled={busy || !username.trim() || password.length < 6}
            type="submit"
          >
            {busy
              ? "Подождите..."
              : mode === "login"
                ? "Войти в приложение"
                : "Создать аккаунт"}
          </button>

          <p className="auth-hint">
            Для демо-входа: <strong>demo</strong> / <strong>demo12345</strong>
          </p>
        </form>
      </section>
    </main>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="error-banner">
      <span>API/Postgres недоступны</span>
      <small>{message}</small>
      <button onClick={onRetry} type="button">
        Повторить
      </button>
    </div>
  );
}

function IconButton({
  children,
  disabled = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="icon-button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function DayScreen({
  canFillSurvey,
  date,
  done,
  onAddQuick,
  onDeleteTask,
  onEditTask,
  onNextDay,
  onOpenEditor,
  onOpenHistory,
  onOpenMonth,
  onOpenSettings,
  onOpenSurvey,
  onOpenTelegram,
  onPrevDay,
  onToday,
  percent,
  quick,
  saving,
  setQuick,
  surveyFilled,
  tasks,
  toggleTask,
  total,
  untimedTasks,
}: {
  canFillSurvey: boolean;
  date: string;
  done: number;
  onAddQuick: () => void;
  onDeleteTask: (task: TaskDto) => void;
  onEditTask: (task: TaskDto) => void;
  onNextDay: () => void;
  onOpenEditor: () => void;
  onOpenHistory: () => void;
  onOpenMonth: () => void;
  onOpenSettings: () => void;
  onOpenSurvey: () => void;
  onOpenTelegram: () => void;
  onPrevDay: () => void;
  onToday: () => void;
  percent: number;
  quick: string;
  saving: boolean;
  setQuick: (value: string) => void;
  surveyFilled: boolean;
  tasks: TaskDto[];
  toggleTask: (task: TaskDto) => void;
  total: number;
  untimedTasks: TaskDto[];
}) {
  const isToday = date === localTodayDate();

  return (
    <section className={isToday ? "screen padded day-screen day-screen--today fade-in" : "screen padded day-screen fade-in"}>
      <div className="header-actions day-top-actions">
        <button className="today-button day-month-button" onClick={onOpenMonth} type="button">
          <CalendarDays size={16} />
          <span>Месяц</span>
        </button>
        <IconButton label="История" onClick={onOpenHistory}>
          <History size={18} />
        </IconButton>
        <IconButton label="Telegram" onClick={onOpenTelegram}>
          <Bell size={18} />
        </IconButton>
        <IconButton label="Настройки" onClick={onOpenSettings}>
          <Settings size={18} />
        </IconButton>
      </div>

      <header className="screen-header">
        <div>
          <div className="day-title-row">
            <h1>{formatDayTitle(date)}</h1>
            <p className="overline">{formatWeekday(date)}</p>
            {isToday && <span className="current-day-badge">Сегодня</span>}
          </div>
        </div>
        <div className="header-actions day-date-actions">
          <IconButton label="Предыдущий день" onClick={onPrevDay}>
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton label="Следующий день" onClick={onNextDay}>
            <ChevronRight size={18} />
          </IconButton>
          <button
            className={isToday ? "today-button active" : "today-button"}
            disabled={isToday}
            onClick={onToday}
            type="button"
          >
            <CalendarDays size={16} />
            <span>Текущий день</span>
          </button>
        </div>
      </header>

      <div className="quick-row">
        <input
          aria-label="Быстрая задача"
          onChange={(event) => setQuick(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onAddQuick();
            }
          }}
          placeholder="Быстрая задача..."
          value={quick}
        />
        <button
          className="add-button"
          disabled={saving}
          onClick={() => {
            if (quick.trim()) {
              onAddQuick();
              return;
            }

            onOpenEditor();
          }}
          title="Добавить задачу"
          type="button"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="progress-head">
        <span>Прогресс дня</span>
        <strong>
          {done} из {total} · {percent}%
        </strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${percent}%` }} />
      </div>

      <div className="timeline">
        {tasks.map((task) => (
          <TimelineTask
            date={date}
            key={task.id}
            onDeleteTask={onDeleteTask}
            onEditTask={onEditTask}
            task={task}
            toggleTask={toggleTask}
          />
        ))}
      </div>

      <section className="untimed">
        <div className="section-label">
          <Clock3 size={14} />
          <span>Без времени</span>
          <small>{untimedTasks.length}</small>
        </div>
        {untimedTasks.map((task) => (
          <TaskCard
            key={task.id}
            compact
            onDeleteTask={onDeleteTask}
            onEditTask={onEditTask}
            task={task}
            toggleTask={toggleTask}
          />
        ))}
      </section>

      {canFillSurvey && (
        <button className="reflection-card" onClick={onOpenSurvey} type="button">
          <span className={surveyFilled ? "reflection-icon done" : "reflection-icon"}>
            <Lightbulb size={20} />
          </span>
          <span>
            <strong>
              {surveyFilled ? "Опросник заполнен" : "Вечерний опросник"}
            </strong>
            <small>
              {surveyFilled
                ? "Данные сохранены в Postgres · нажми, чтобы изменить"
                : "Оцени день и запиши мысли"}
            </small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}
    </section>
  );
}

function TimelineTask({
  date,
  onDeleteTask,
  onEditTask,
  task,
  toggleTask,
}: {
  date: string;
  onDeleteTask: (task: TaskDto) => void;
  onEditTask: (task: TaskDto) => void;
  task: TaskDto;
  toggleTask: (task: TaskDto) => void;
}) {
  const priority = priorityMeta[task.priority];
  const pinColor =
    task.priority === "must"
      ? "#ef4d5b"
      : task.priority === "should"
        ? "#f2b705"
        : priority.color;
  const crossesMidnight = Boolean(
    task.scheduledDate &&
      task.startTime &&
      task.endTime &&
      task.endTime < task.startTime,
  );
  const isCarryOver = crossesMidnight && task.scheduledDate !== date;
  const isStartDay = crossesMidnight && task.scheduledDate === date;
  const timeStart = isCarryOver ? "00:00" : task.startTime;
  const timeEnd = isStartDay ? "23:59" : task.endTime;
  const time = timeEnd ? `${timeStart}-${timeEnd}` : timeStart;

  return (
    <article className="timeline-row">
      <time>{time}</time>
      <span
        className="timeline-pin"
        style={{ "--pin": pinColor } as React.CSSProperties}
      />
      <TaskCard
        onDeleteTask={onDeleteTask}
        onEditTask={onEditTask}
        task={task}
        toggleTask={toggleTask}
      />
    </article>
  );
}

function TaskCard({
  compact = false,
  onDeleteTask,
  onEditTask,
  task,
  toggleTask,
}: {
  compact?: boolean;
  onDeleteTask: (task: TaskDto) => void;
  onEditTask: (task: TaskDto) => void;
  task: TaskDto;
  toggleTask: (task: TaskDto) => void;
}) {
  const priority = priorityMeta[task.priority];
  const done = task.status === "done";
  const reminderCount = task.reminders?.length ?? 0;

  return (
    <article className={compact ? "task-card compact" : "task-card"}>
      <button
        aria-label={
          done ? `Вернуть задачу "${task.title}" в план` : `Отметить задачу "${task.title}"`
        }
        aria-pressed={done}
        className={done ? "task-check checked" : "task-check"}
        onClick={() => toggleTask(task)}
        title={done ? "Вернуть в план" : "Отметить выполненной"}
        type="button"
      >
        {done && <Check size={15} strokeWidth={3} />}
      </button>
      <button
        className="task-body-button"
        onClick={() => onEditTask(task)}
        title="Редактировать задачу"
        type="button"
      >
        <h2 className={done ? "done-title" : ""}>{task.title}</h2>
        <div className="chips">
          <span
            className="chip"
            style={{ backgroundColor: priority.soft, color: priority.color }}
          >
            {priority.label}
          </span>
          {reminderCount > 0 && (
            <span className="chip neutral">
              {reminderCount} нап.
            </span>
          )}
          {!task.scheduledDate && <span className="chip neutral">Без даты</span>}
          {task.tags.map((tag) => (
            <span
              className="chip"
              key={tag.id}
              style={{ backgroundColor: tag.bg, color: tag.fg }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      </button>
      <button
        aria-label={`Удалить задачу ${task.title}`}
        className="task-delete-button"
        onClick={() => onDeleteTask(task)}
        title="Удалить задачу"
        type="button"
      >
        <Trash2 size={16} />
      </button>
    </article>
  );
}

function TaskDeleteDialog({
  deleting,
  onCancel,
  onConfirm,
  task,
}: {
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  task: TaskDto;
}) {
  return (
    <div className="dialog-layer" role="presentation" onMouseDown={onCancel}>
      <section
        aria-labelledby="delete-task-title"
        aria-modal="true"
        className="picker-dialog confirm-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <strong id="delete-task-title">Удалить задачу?</strong>
        <p>{task.title}</p>
        <div className="confirm-actions">
          <button className="secondary-action" disabled={deleting} onClick={onCancel} type="button">
            Нет
          </button>
          <button className="danger-action" disabled={deleting} onClick={onConfirm} type="button">
            Да
          </button>
        </div>
      </section>
    </div>
  );
}

function WeekScreen({
  days,
  onNextWeek,
  onOpenDay,
  onPrevWeek,
  selectedDate,
  weekStart,
}: {
  days: SummaryDay[];
  onNextWeek: () => void;
  onOpenDay: (date: string) => void;
  onPrevWeek: () => void;
  selectedDate: string;
  weekStart: string;
}) {
  const today = localTodayDate();
  const end = addDays(weekStart, 6);
  const complete = days.reduce((sum, day) => sum + day.done, 0);
  const total = days.reduce((sum, day) => sum + day.total, 0);
  const pct = total ? Math.round((complete / total) * 100) : 0;
  const scores = days
    .map((day) => day.score)
    .filter((score): score is number => typeof score === "number");
  const avg = scores.length
    ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)
    : "0";

  return (
    <section className="screen padded week-screen fade-in">
      <header className="screen-header">
        <div>
          <p className="overline">
            Пн-Вс · {formatDayTitle(weekStart)} - {formatDayTitle(end)}
          </p>
          <h1>Эта неделя</h1>
        </div>
        <div className="header-actions">
          <IconButton label="Предыдущая неделя" onClick={onPrevWeek}>
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton label="Следующая неделя" onClick={onNextWeek}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
      </header>
      <div className="metric-grid two">
        <Metric label="выполнено за неделю" value={`${pct}%`} accent />
        <Metric label="средняя оценка" value={avg} />
      </div>
      <div className="week-list">
        {days.map((day) => {
          const dayPct = day.total ? Math.round((day.done / day.total) * 100) : 0;
          const date = parseIsoDate(day.date);

          return (
            <button
              className={day.date === today ? "week-row today" : "week-row"}
              key={day.date}
              onClick={() => onOpenDay(day.date)}
              type="button"
            >
              <span className="week-date">
                <small>
                  {new Intl.DateTimeFormat("ru-RU", {
                    timeZone: "UTC",
                    weekday: "short",
                  }).format(date)}
                </small>
                <strong>{date.getUTCDate()}</strong>
                {day.reflectionFilled && <i />}
              </span>
              <span className="week-main">
                <span className="week-top">
                  <strong>
                    {day.done}/{day.total} задач
                  </strong>
                  <small>{dayPct}%</small>
                </span>
                <span className="mini-chips">
                  {day.tags.slice(0, 3).map((tag) => (
                    <MiniChip key={tag} name={tag} />
                  ))}
                </span>
                <span className="mini-progress">
                  <i style={{ width: `${dayPct}%` }} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MonthScreen({
  days,
  onBack,
  onNextMonth,
  onOpenDay,
  onPrevMonth,
  selectedDate,
}: {
  days: SummaryDay[];
  onBack: () => void;
  onNextMonth: () => void;
  onOpenDay: (date: string) => void;
  onPrevMonth: () => void;
  selectedDate: string;
}) {
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null);
  const [pullOffset, setPullOffset] = useState(0);
  const today = localTodayDate();
  const first = days[0]?.date ?? selectedDate.slice(0, 8) + "01";
  const firstDate = parseIsoDate(first);
  const lead = (firstDate.getUTCDay() + 6) % 7;
  const blanks = Array.from({ length: lead }, (_, index) => index);

  function startSwipe(event: React.PointerEvent<HTMLElement>) {
    if (event.clientX > 52) {
      return;
    }

    setSwipeStart({ x: event.clientX, y: event.clientY });
    setPullOffset(0);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some embedded browsers do not allow capture after synthetic pointer events.
    }
  }

  function updateSwipe(x: number, y: number) {
    if (!swipeStart) {
      return;
    }

    const deltaX = x - swipeStart.x;
    const deltaY = Math.abs(y - swipeStart.y);

    if (deltaX <= 0 || deltaY > 88) {
      setPullOffset(0);
      return;
    }

    setPullOffset(Math.min(150, deltaX * 0.58));
  }

  function finishSwipe(x: number, y: number) {
    if (!swipeStart) {
      return;
    }

    const deltaX = x - swipeStart.x;
    const deltaY = Math.abs(y - swipeStart.y);
    setSwipeStart(null);

    if (swipeStart.x <= 52 && deltaX > 120 && deltaY < 82) {
      setPullOffset(190);
      window.setTimeout(onBack, 110);
      return;
    }

    setPullOffset(0);
  }

  function cancelSwipe() {
    if (swipeStart) {
      setSwipeStart(null);
      setPullOffset(0);
    }
  }

  const pullStyle = { "--month-pull": `${pullOffset}px` } as React.CSSProperties;

  return (
    <section
      className={[
        "screen padded month-screen fade-in",
        pullOffset > 0 ? "pulling" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerCancel={cancelSwipe}
      onPointerDown={startSwipe}
      onPointerLeave={(event) => {
        if (swipeStart) {
          finishSwipe(event.clientX, event.clientY);
        }
      }}
      onPointerMove={(event) => updateSwipe(event.clientX, event.clientY)}
      onPointerUp={(event) => finishSwipe(event.clientX, event.clientY)}
      style={pullStyle}
    >
      <header className="screen-header month-header">
        <IconButton label="Назад" onClick={onBack}>
          <ChevronLeft size={18} />
        </IconButton>
        <h1 className="month-nav-title">Месяц</h1>
        <span className="month-header-spacer" aria-hidden="true" />
      </header>

      <div className="month-period-title">
        <div>
          <p className="overline">{first.slice(0, 4)}</p>
          <h2>
            {new Intl.DateTimeFormat("ru-RU", {
              month: "long",
              timeZone: "UTC",
            }).format(firstDate)}
          </h2>
        </div>
        <div className="header-actions month-switcher">
          <IconButton label="Предыдущий месяц" onClick={onPrevMonth}>
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton label="Следующий месяц" onClick={onNextMonth}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
      </div>

      <div className="calendar-dows">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {blanks.map((blank) => (
          <span className="calendar-cell blank" key={blank} />
        ))}
        {days.map((day) => {
          const date = parseIsoDate(day.date);
          const weekend = date.getUTCDay() === 0;

          return (
            <button
              className={day.date === today ? "calendar-cell today" : "calendar-cell"}
              key={day.date}
              onClick={() => onOpenDay(day.date)}
              type="button"
            >
              <span className="calendar-number">
                <strong className={weekend ? "weekend" : ""}>
                  {date.getUTCDate()}
                </strong>
                {day.reflectionFilled && <i />}
              </span>
              {day.tags.slice(0, 2).map((tag) => (
                <MiniChip key={tag} name={tag} />
              ))}
              {day.tags.length > 2 && <small>+{day.tags.length - 2}</small>}
            </button>
          );
        })}
      </div>
      <div className="legend">
        <span>
          <i className="square" /> задачи по тегам
        </span>
        <span>
          <i className="dot" /> опросник заполнен
        </span>
      </div>
    </section>
  );
}

function BacklogScreen({
  onAddQuick,
  onDeleteTask,
  onEditTask,
  onOpenEditor,
  quick,
  saving,
  setQuick,
  tasks,
  toggleTask,
}: {
  onAddQuick: () => void;
  onDeleteTask: (task: TaskDto) => void;
  onEditTask: (task: TaskDto) => void;
  onOpenEditor: () => void;
  quick: string;
  saving: boolean;
  setQuick: (value: string) => void;
  tasks: TaskDto[];
  toggleTask: (task: TaskDto) => void;
}) {
  const done = tasks.filter((task) => task.status === "done").length;
  const active = tasks.length - done;

  return (
    <section className="screen padded backlog-screen fade-in">
      <header className="screen-header">
        <div>
          <p className="overline">Без даты · идеи и планы</p>
          <h1>Бэклог</h1>
        </div>
        <div className="header-actions">
          <button className="today-button" onClick={() => onOpenEditor()} type="button">
            <Plus size={16} />
            <span>Задача</span>
          </button>
        </div>
      </header>

      <div className="quick-row">
        <input
          aria-label="Быстрая задача в бэклог"
          onChange={(event) => setQuick(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onAddQuick();
            }
          }}
          placeholder="Накинуть дело или план без даты..."
          value={quick}
        />
        <button
          className="add-button"
          disabled={saving}
          onClick={() => {
            if (quick.trim()) {
              onAddQuick();
              return;
            }

            onOpenEditor();
          }}
          title="Добавить в бэклог"
          type="button"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="metric-grid two">
        <Metric label="активных планов" value={String(active)} accent />
        <Metric label="всего в списке" value={String(tasks.length)} />
      </div>

      {tasks.length ? (
        <div className="backlog-list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              compact
              onDeleteTask={onDeleteTask}
              onEditTask={onEditTask}
              task={task}
              toggleTask={toggleTask}
            />
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <Inbox size={22} />
          <strong>Бэклог пуст</strong>
          <p>Сюда можно складывать дела без даты, идеи и планы, которые позже попадут в календарь.</p>
        </section>
      )}
    </section>
  );
}

function BlogScreen({
  checkedDates,
  date,
  ideasCount,
  onNextMonth,
  onOpenIdeas,
  onPrevMonth,
  onToggleDay,
}: {
  checkedDates: string[];
  date: string;
  ideasCount: number;
  onNextMonth: () => void;
  onOpenIdeas: () => void;
  onPrevMonth: () => void;
  onToggleDay: (date: string) => void;
}) {
  return (
    <section className="screen padded blog-screen fade-in">
      <header className="screen-header">
        <div>
          <p className="overline">Блог · черновики и материалы</p>
          <h1>Блог</h1>
        </div>
      </header>

      <div className="blog-sections">
        <button className="blog-section-card" onClick={onOpenIdeas} type="button">
          <span>
            <Lightbulb size={22} />
          </span>
          <strong>Идеи</strong>
          <small>
            {ideasCount
              ? `${ideasCount} ${ideasCount === 1 ? "идея" : "идей"} в списке`
              : "Собирай темы и мысли для будущих записей"}
          </small>
          <ChevronRight size={18} />
        </button>
      </div>

      <VideoPostingPanel
        checkedDates={checkedDates}
        date={date}
        onNextMonth={onNextMonth}
        onPrevMonth={onPrevMonth}
        onToggleDay={onToggleDay}
      />
    </section>
  );
}

function VideoPostingPanel({
  checkedDates,
  date,
  onNextMonth,
  onPrevMonth,
  onToggleDay,
}: {
  checkedDates: string[];
  date: string;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  onToggleDay: (date: string) => void;
}) {
  const calendar = monthGrid(date);
  const checked = new Set(checkedDates);
  const [removeCandidate, setRemoveCandidate] = useState<string | null>(null);
  const totalDays = calendar.days.length;
  const checkedCount = calendar.days.filter((day) => checked.has(day)).length;
  const monthDate = parseIsoDate(date);
  const monthName = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    timeZone: "UTC",
  }).format(monthDate);

  return (
    <section className="video-posting-panel">
      <header className="video-plan-head">
        <div className="video-plan-title">
          <small>{monthDate.getUTCFullYear()}</small>
          <strong>{monthName}</strong>
          <span>
            Постинг видео · {checkedCount}/{totalDays}
          </span>
        </div>
        <div className="video-plan-actions">
          <IconButton label="Предыдущий месяц" onClick={onPrevMonth}>
            <ChevronLeft size={20} />
          </IconButton>
          <IconButton label="Следующий месяц" onClick={onNextMonth}>
            <ChevronRight size={20} />
          </IconButton>
        </div>
      </header>

      <div className="video-weekdays">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="video-month-grid">
        {calendar.blanks.map((blank) => (
          <span className="video-day blank" key={blank} />
        ))}
        {calendar.days.map((day) => {
          const dateValue = parseIsoDate(day);
          const isChecked = checked.has(day);
          const isToday = day === localTodayDate();

          return (
            <button
              aria-pressed={isChecked}
              className={[
                "video-day",
                isChecked ? "checked" : "",
                isToday ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={day}
              onClick={() => {
                if (isChecked) {
                  setRemoveCandidate(day);
                  return;
                }

                onToggleDay(day);
              }}
              type="button"
            >
              <span>{dateValue.getUTCDate()}</span>
              <i aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {removeCandidate && (
        <div
          className="dialog-layer"
          role="presentation"
          onMouseDown={() => setRemoveCandidate(null)}
        >
          <section
            aria-labelledby="remove-posting-mark-title"
            aria-modal="true"
            className="picker-dialog confirm-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <strong id="remove-posting-mark-title">Убрать отметку?</strong>
            <p>{formatHistoryDate(removeCandidate)}</p>
            <div className="confirm-actions">
              <button
                className="secondary-action"
                onClick={() => setRemoveCandidate(null)}
                type="button"
              >
                Отмена
              </button>
              <button
                className="danger-action"
                onClick={() => {
                  onToggleDay(removeCandidate);
                  setRemoveCandidate(null);
                }}
                type="button"
              >
                Убрать
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function IdeasScreen({
  ideaTags,
  ideas,
  onBack,
  onCreate,
  onCreateTag,
  onDelete,
  onOpenIdea,
  onToggleFavorite,
  onToggleShot,
}: {
  ideaTags: IdeaTagDto[];
  ideas: IdeaDto[];
  onBack: () => void;
  onCreate: (input: { title: string; body: string; tags: string[] }) => Promise<IdeaDto>;
  onCreateTag: (input: { name: string; bg: string; fg: string }) => Promise<IdeaTagDto>;
  onDelete: (ideaId: number) => Promise<void>;
  onOpenIdea: (ideaId: number) => void;
  onToggleFavorite: (idea: IdeaDto) => Promise<void>;
  onToggleShot: (idea: IdeaDto) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ title: "", body: "", tags: [] as string[] });
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [ideaError, setIdeaError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [shotRemoveCandidate, setShotRemoveCandidate] = useState<IdeaDto | null>(null);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const favoriteIdeas = ideas.filter((idea) => idea.isFavorite);
  const filteredByType = filter === "favorites" ? favoriteIdeas : ideas;
  const visibleIdeas = tagFilter
    ? filteredByType.filter((idea) => idea.tags.some((tag) => tag.name === tagFilter))
    : filteredByType;

  async function saveNewIdea() {
    const title = draft.title.trim();

    if (!title) {
      return;
    }

    setBusyId("new");
    setIdeaError(null);
    try {
      const idea = await onCreate({
        title,
        body: draft.body,
        tags: draft.tags,
      });
      setDraft({ title: "", body: "", tags: [] });
      setCreateOpen(false);
      onOpenIdea(idea.id);
    } catch {
      setIdeaError("Не удалось добавить идею.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeIdea(id: number) {
    setBusyId(id);
    setIdeaError(null);
    try {
      await onDelete(id);
    } catch {
      setIdeaError("Не удалось удалить идею.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="screen padded ideas-screen fade-in">
      <div className="ideas-top">
        <div className="back-title">
          <IconButton label="Назад" onClick={onBack}>
            <ChevronLeft size={18} />
          </IconButton>
          <h1>Идеи</h1>
        </div>
        <button
          aria-label="Добавить идею"
          className="idea-add-button"
          onClick={() => {
            setIdeaError(null);
            setCreateOpen(true);
          }}
          title="Добавить идею"
          type="button"
        >
          <Plus size={24} strokeWidth={2.8} />
        </button>
      </div>

      <div className="idea-tabs" role="tablist" aria-label="Фильтр идей">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
          role="tab"
          type="button"
        >
          Все
        </button>
        <button
          className={filter === "favorites" ? "active" : ""}
          onClick={() => setFilter("favorites")}
          role="tab"
          type="button"
        >
          Избранное
          {favoriteIdeas.length > 0 && <span>{favoriteIdeas.length}</span>}
        </button>
      </div>

      <div className="idea-tag-toolbar">
        <div className="idea-tag-filters" aria-label="Фильтр по тегам">
          <button
            className={tagFilter === null ? "active" : ""}
            onClick={() => setTagFilter(null)}
            type="button"
          >
            Все теги
          </button>
          {ideaTags.map((tag) => (
            <button
              className={tagFilter === tag.name ? "active" : ""}
              key={tag.id}
              onClick={() => setTagFilter(tag.name)}
              style={{ backgroundColor: tag.bg, color: tag.fg }}
              type="button"
            >
              {tag.name}
            </button>
          ))}
        </div>
        <button
          aria-label="Создать тег идеи"
          className="idea-tag-add"
          onClick={() => setTagDialogOpen(true)}
          type="button"
        >
          <Plus size={16} />
          <span>Тег</span>
        </button>
      </div>

      {ideaError && <p className="idea-error">{ideaError}</p>}

      {visibleIdeas.length ? (
        <div className="ideas-list">
          {visibleIdeas.map((idea) => (
            <article className={`idea-card${idea.isShot ? " shot" : ""}`} key={idea.id}>
              <button
                className="idea-note-body"
                onClick={() => onOpenIdea(idea.id)}
                type="button"
              >
                <strong>{idea.title}</strong>
                <span>
                  <time>{formatIdeaDate(idea.updatedAt)}</time>
                  <small>{idea.body || "Описание пока пустое."}</small>
                </span>
                {idea.tags.length > 0 && (
                  <span className="idea-card-tags">
                    {idea.tags.map((tag) => (
                      <i key={tag.id} style={{ backgroundColor: tag.bg, color: tag.fg }}>
                        {tag.name}
                      </i>
                    ))}
                  </span>
                )}
              </button>
              <button
                aria-label={idea.isShot ? `Убрать отметку «Снято» у ${idea.title}` : `Отметить ${idea.title} как снято`}
                aria-pressed={idea.isShot}
                className={idea.isShot ? "idea-shot active" : "idea-shot"}
                onClick={() => {
                  if (idea.isShot) {
                    setShotRemoveCandidate(idea);
                    return;
                  }

                  void onToggleShot(idea);
                }}
                title={idea.isShot ? "Убрать отметку «Снято»" : "Отметить как снято"}
                type="button"
              >
                <Camera size={17} />
              </button>
              <button
                aria-label={idea.isFavorite ? `Убрать ${idea.title} из избранного` : `Добавить ${idea.title} в избранное`}
                className={idea.isFavorite ? "idea-heart active" : "idea-heart"}
                onClick={() => void onToggleFavorite(idea)}
                title={idea.isFavorite ? "Убрать из избранного" : "В избранное"}
                type="button"
              >
                <Heart size={18} fill={idea.isFavorite ? "currentColor" : "none"} />
              </button>
              <IconButton
                disabled={busyId === idea.id}
                label={`Удалить ${idea.title}`}
                onClick={() => void removeIdea(idea.id)}
              >
                <Trash2 size={16} />
              </IconButton>
            </article>
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <Lightbulb size={22} />
          <strong>{filter === "favorites" ? "Избранного пока нет" : "Идей пока нет"}</strong>
          <p>
            {filter === "favorites"
              ? "Нажми сердечко у идеи, чтобы она появилась здесь."
              : "Нажми плюс вверху, чтобы собрать первую заготовку для блога."}
          </p>
        </section>
      )}

      {createOpen && (
        <IdeaEditorDialog
          actionLabel="Добавить"
          busy={busyId === "new"}
          draft={draft}
          ideaTags={ideaTags}
          onChange={setDraft}
          onClose={() => setCreateOpen(false)}
          onSave={() => void saveNewIdea()}
          title="Новая идея"
        />
      )}

      {tagDialogOpen && (
        <IdeaTagDialog
          onClose={() => setTagDialogOpen(false)}
          onSave={async (input) => {
            await onCreateTag(input);
            setTagDialogOpen(false);
          }}
        />
      )}

      {shotRemoveCandidate && (
        <IdeaShotRemoveDialog
          idea={shotRemoveCandidate}
          onCancel={() => setShotRemoveCandidate(null)}
          onConfirm={() => {
            void onToggleShot(shotRemoveCandidate).finally(() => setShotRemoveCandidate(null));
          }}
        />
      )}

    </section>
  );
}

function IdeaDetailScreen({
  idea,
  ideaTags,
  onBack,
  onDelete,
  onToggleFavorite,
  onToggleShot,
  onUpdate,
}: {
  idea: IdeaDto | null;
  ideaTags: IdeaTagDto[];
  onBack: () => void;
  onDelete: (ideaId: number) => Promise<void>;
  onToggleFavorite: (idea: IdeaDto) => Promise<void>;
  onToggleShot: (idea: IdeaDto) => Promise<void>;
  onUpdate: (idea: IdeaDto) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ title: "", body: "", tags: [] as string[] });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deleting, setDeleting] = useState(false);
  const [shotRemoveOpen, setShotRemoveOpen] = useState(false);

  useEffect(() => {
    if (!idea) {
      return;
    }

    setDraft({
      title: idea.title,
      body: idea.body,
      tags: idea.tags.map((tag) => tag.name),
    });
    setSaveState("saved");
  }, [idea?.id]);

  useEffect(() => {
    if (!idea) {
      return;
    }

    const tagsUnchanged =
      draft.tags.length === idea.tags.length &&
      draft.tags.every((name) => idea.tags.some((tag) => tag.name === name));

    if (draft.title === idea.title && draft.body === idea.body && tagsUnchanged) {
      return;
    }

    if (!draft.title.trim()) {
      setSaveState("idle");
      return;
    }

    setSaveState("saving");
    const timeout = window.setTimeout(() => {
      void onUpdate({
        ...idea,
        title: draft.title.trim(),
        body: draft.body,
        tags: ideaTags.filter((tag) => draft.tags.includes(tag.name)),
      })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 650);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [draft.body, draft.tags, draft.title, idea, ideaTags, onUpdate]);

  if (!idea) {
    return (
      <section className="screen padded idea-detail-screen fade-in">
        <div className="back-title">
          <IconButton label="Назад" onClick={onBack}>
            <ChevronLeft size={18} />
          </IconButton>
          <h1>Идея</h1>
        </div>
        <section className="empty-state">
          <Lightbulb size={22} />
          <strong>Идея не найдена</strong>
          <p>Она могла быть удалена или открыт старый адрес.</p>
        </section>
      </section>
    );
  }

  const currentIdea = idea;

  async function removeIdea() {
    setDeleting(true);
    try {
      await onDelete(currentIdea.id);
    } finally {
      setDeleting(false);
    }
  }

  const status =
    saveState === "saving"
      ? "Сохраняю..."
      : saveState === "error"
        ? "Не удалось сохранить"
        : "Сохранено";

  return (
    <section className="screen padded idea-detail-screen fade-in">
      <div className="idea-detail-top">
        <IconButton label="Назад" onClick={onBack}>
          <ChevronLeft size={18} />
        </IconButton>
        <span>{status}</span>
        <div className="idea-detail-actions">
          <button
            aria-label={currentIdea.isShot ? "Убрать отметку «Снято»" : "Отметить идею как снято"}
            aria-pressed={currentIdea.isShot}
            className={currentIdea.isShot ? "idea-shot active" : "idea-shot"}
            onClick={() => {
              if (currentIdea.isShot) {
                setShotRemoveOpen(true);
                return;
              }

              void onToggleShot(currentIdea);
            }}
            title={currentIdea.isShot ? "Убрать отметку «Снято»" : "Отметить как снято"}
            type="button"
          >
            <Camera size={17} />
          </button>
          <button
            aria-label={
              currentIdea.isFavorite
                ? "Убрать идею из избранного"
                : "Добавить идею в избранное"
            }
            className={currentIdea.isFavorite ? "idea-heart active" : "idea-heart"}
            onClick={() => void onToggleFavorite(currentIdea)}
            title={currentIdea.isFavorite ? "Убрать из избранного" : "В избранное"}
            type="button"
          >
            <Heart size={18} fill={currentIdea.isFavorite ? "currentColor" : "none"} />
          </button>
          <IconButton disabled={deleting} label="Удалить идею" onClick={() => void removeIdea()}>
            <Trash2 size={16} />
          </IconButton>
        </div>
      </div>

      <input
        aria-label="Название идеи"
        className="idea-title-input"
        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        placeholder="Название"
        value={draft.title}
      />
      {currentIdea.tags.length > 0 && (
        <div className="idea-detail-tags" aria-label="Присвоенные теги идеи">
          {currentIdea.tags.map((tag) => (
            <span key={tag.id} style={{ backgroundColor: tag.bg, color: tag.fg }}>
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <textarea
        aria-label="Текст идеи"
        className="idea-body-input"
        onChange={(event) => setDraft({ ...draft, body: event.target.value })}
        placeholder="Начни писать..."
        value={draft.body}
      />
      {shotRemoveOpen && (
        <IdeaShotRemoveDialog
          idea={currentIdea}
          onCancel={() => setShotRemoveOpen(false)}
          onConfirm={() => {
            void onToggleShot(currentIdea).finally(() => setShotRemoveOpen(false));
          }}
        />
      )}
    </section>
  );
}

function IdeaShotRemoveDialog({
  idea,
  onCancel,
  onConfirm,
}: {
  idea: IdeaDto;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dialog-layer" role="presentation" onMouseDown={onCancel}>
      <section
        aria-labelledby="remove-idea-shot-title"
        aria-modal="true"
        className="picker-dialog confirm-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <strong id="remove-idea-shot-title">Убрать отметку «Снято»?</strong>
        <p>{idea.title}</p>
        <div className="confirm-actions">
          <button className="secondary-action" onClick={onCancel} type="button">
            Отмена
          </button>
          <button className="danger-action" onClick={onConfirm} type="button">
            Убрать
          </button>
        </div>
      </section>
    </div>
  );
}

function IdeaEditorDialog({
  actionLabel,
  busy,
  draft,
  ideaTags,
  onChange,
  onClose,
  onSave,
  title,
}: {
  actionLabel: string;
  busy: boolean;
  draft: { title: string; body: string; tags: string[] };
  ideaTags: IdeaTagDto[];
  onChange: (draft: { title: string; body: string; tags: string[] }) => void;
  onClose: () => void;
  onSave: () => void;
  title: string;
}) {
  return (
    <div className="dialog-layer" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={title}
        aria-modal="true"
        className="picker-dialog idea-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="dialog-head">
          <strong>{title}</strong>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <input
          aria-label="Название идеи"
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          placeholder="Название идеи"
          value={draft.title}
        />
        <textarea
          aria-label="Описание идеи"
          onChange={(event) => onChange({ ...draft, body: event.target.value })}
          placeholder="Расписать идею..."
          value={draft.body}
        />
        <div className="idea-dialog-tags">
          <span>Теги</span>
          {ideaTags.length ? (
            <div>
              {ideaTags.map((tag) => (
                <button
                  className={draft.tags.includes(tag.name) ? "selected" : ""}
                  key={tag.id}
                  onClick={() =>
                    onChange({
                      ...draft,
                      tags: draft.tags.includes(tag.name)
                        ? draft.tags.filter((name) => name !== tag.name)
                        : [...draft.tags, tag.name],
                    })
                  }
                  style={{ backgroundColor: tag.bg, color: tag.fg }}
                  type="button"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          ) : (
            <small>Сначала создай тег в разделе идей.</small>
          )}
        </div>
        <button
          className="primary-action"
          disabled={busy || !draft.title.trim()}
          onClick={onSave}
          type="button"
        >
          {actionLabel}
        </button>
      </section>
    </div>
  );
}

function IdeaTagDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: { name: string; bg: string; fg: string }) => Promise<void>;
}) {
  const colors = [
    { bg: "#e8ecfb", fg: "#4656b8" },
    { bg: "#e4f3ec", fg: "#2f8f6b" },
    { bg: "#e2f1f2", fg: "#2b8a90" },
    { bg: "#efe8fb", fg: "#7150b8" },
    { bg: "#fdf0e2", fg: "#b5772f" },
    { bg: "#fbe8ee", fg: "#b8476a" },
  ];
  const [name, setName] = useState("");
  const [color, setColor] = useState(colors[0]!);
  const [busy, setBusy] = useState(false);

  async function save() {
    const normalizedName = name.trim();
    if (!normalizedName) return;

    setBusy(true);
    try {
      await onSave({ name: normalizedName, ...color });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-layer" role="presentation" onMouseDown={onClose}>
      <section
        aria-label="Новый тег идеи"
        aria-modal="true"
        className="picker-dialog idea-tag-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="dialog-head">
          <strong>Новый тег идеи</strong>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <input
          aria-label="Название тега идеи"
          autoFocus
          onChange={(event) => setName(event.target.value)}
          placeholder="Например, Reels"
          value={name}
        />
        <div className="idea-tag-colors" aria-label="Цвет тега">
          {colors.map((item) => (
            <button
              aria-label={`Выбрать цвет ${item.fg}`}
              className={color.bg === item.bg && color.fg === item.fg ? "selected" : ""}
              key={item.fg}
              onClick={() => setColor(item)}
              style={{ backgroundColor: item.bg, color: item.fg }}
              type="button"
            >
              <Palette size={16} />
            </button>
          ))}
        </div>
        <div className="idea-tag-custom-colors">
          <label>
            <span>Цвет фона</span>
            <input
              aria-label="Свой цвет фона тега идеи"
              onChange={(event) => setColor({ ...color, bg: event.target.value })}
              type="color"
              value={color.bg}
            />
          </label>
          <label>
            <span>Цвет текста</span>
            <input
              aria-label="Свой цвет текста тега идеи"
              onChange={(event) => setColor({ ...color, fg: event.target.value })}
              type="color"
              value={color.fg}
            />
          </label>
        </div>
        <div className="idea-tag-preview" style={{ backgroundColor: color.bg, color: color.fg }}>
          {name.trim() || "Новый тег"}
        </div>
        <button
          className="primary-action"
          disabled={busy || !name.trim()}
          onClick={() => void save()}
          type="button"
        >
          {busy ? "Создаём…" : "Создать тег"}
        </button>
      </section>
    </div>
  );
}

function StatsScreen({
  onOpenRecords,
  onOpenTaskList,
  selectedDate,
  stats,
}: {
  onOpenRecords: () => void;
  onOpenTaskList: (taskStatsFilter: TaskStatsFilter, date: string) => void;
  selectedDate: string;
  stats: StatsDto | null;
}) {
  const [monthDate, setMonthDate] = useState(selectedDate);
  const [weekDate, setWeekDate] = useState(selectedDate);
  const [monthStats, setMonthStats] = useState<StatsDto | null>(stats);
  const [weekStats, setWeekStats] = useState<StatsDto | null>(stats);

  useEffect(() => {
    if (!stats) return;
    if (monthDate === selectedDate) setMonthStats(stats);
    if (weekDate === selectedDate) setWeekStats(stats);
  }, [monthDate, selectedDate, stats, weekDate]);

  useEffect(() => {
    if (monthDate === selectedDate && stats) return;
    let cancelled = false;

    void api<StatsDto>(`/api/stats?date=${monthDate}`).then((response) => {
      if (!cancelled) setMonthStats(response);
    });

    return () => {
      cancelled = true;
    };
  }, [monthDate, selectedDate, stats]);

  useEffect(() => {
    if (weekDate === selectedDate && stats) return;
    let cancelled = false;

    void api<StatsDto>(`/api/stats?date=${weekDate}`).then((response) => {
      if (!cancelled) setWeekStats(response);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, stats, weekDate]);

  const ratio = monthStats?.taskRatio ?? {
    done: 0,
    donePercent: 0,
    total: 0,
    unfinished: 0,
    unfinishedPercent: 0,
  };
  const monthTitle = formatMonthTitle(monthDate);
  const percentColor = percentToneColor(ratio.donePercent);
  const weeklyAxisBars = weekStats?.bars ?? [];
  const weekRangeStart = weeklyAxisBars[0]?.date ?? getWeekStart(weekDate);
  const weekRangeEnd = weeklyAxisBars.at(-1)?.date ?? addDays(weekRangeStart, 6);
  const weeklyDateRangeTitle = `Пн ${formatShortDate(weekRangeStart)} - Вс ${formatShortDate(weekRangeEnd)}`;
  const lastVisibleDate = localTodayDate();
  const weeklyLineWidth = 300;
  const weeklyLineHeight = 132;
  const weeklyLinePaddingX = 16;
  const weeklyLinePaddingY = 16;
  const weeklyLineInnerWidth = weeklyLineWidth - weeklyLinePaddingX * 2;
  const weeklyLineInnerHeight = weeklyLineHeight - weeklyLinePaddingY * 2;
  const weeklyPointX = (index: number) =>
    weeklyAxisBars.length > 1
      ? weeklyLinePaddingX + (index / (weeklyAxisBars.length - 1)) * weeklyLineInnerWidth
      : weeklyLineWidth / 2;
  const weeklyLinePoints = weeklyAxisBars.flatMap((bar, index) => {
    if (bar.date > lastVisibleDate) {
      return [];
    }

    const percent = bar.total ? Math.round((bar.done / bar.total) * 100) : 0;
    const x = weeklyPointX(index);
    const y = weeklyLinePaddingY + ((100 - percent) / 100) * weeklyLineInnerHeight;

    return [{
      ...bar,
      color: percentLineColor(percent),
      percent,
      x,
      y,
    }];
  });
  const weeklyLinePath = weeklyLinePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const weeklyGradientStops =
    weeklyLinePoints.length > 1
      ? weeklyLinePoints.map((point) => ({
          color: point.color,
          offset: `${(point.x / weeklyLineWidth) * 100}%`,
        }))
      : weeklyLinePoints.map((point) => ({ color: point.color, offset: "50%" }));

  return (
    <section className="screen padded stats-screen fade-in">
      <div className="section-title">
        <p className="overline">Продуктивность</p>
        <h1>Итоги</h1>
      </div>
      <button className="records-entry-card" onClick={onOpenRecords} type="button">
        <span>
          <MessageCircle size={20} />
        </span>
        <strong>Мои записи</strong>
        <small>Календарь вечерних опросников и сохранённых ответов</small>
        <ChevronRight size={18} />
      </button>
      <section className="chart-card task-ratio-card">
        <div className="stats-card-head">
          <div>
            <p className="overline">{monthTitle}</p>
            <h2>Задачи за месяц</h2>
          </div>
          <div className="stats-month-actions">
            <strong style={{ color: percentColor }}>{ratio.donePercent}%</strong>
            <IconButton label="Предыдущий месяц" onClick={() => setMonthDate(addMonths(monthDate, -1))}>
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton label="Следующий месяц" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
        </div>
        <div className="task-ratio-track">
          <i style={{ width: `${ratio.donePercent}%` }} />
        </div>
        <div className="task-ratio-grid">
          <button className="done" onClick={() => onOpenTaskList("done", monthDate)} type="button">
            <strong>{ratio.done}</strong>
            выполнено
          </button>
          <button className="unfinished" onClick={() => onOpenTaskList("unfinished", monthDate)} type="button">
            <strong>{ratio.unfinished}</strong>
            не выполнено
          </button>
          <button className="all" onClick={() => onOpenTaskList("all", monthDate)} type="button">
            <strong>{ratio.total}</strong>
            всего
          </button>
        </div>
      </section>
      <section className="chart-card">
        <div className="stats-card-head weekly-card-head">
          <div>
            <p className="overline">{weeklyDateRangeTitle}</p>
            <h2>Динамика за неделю</h2>
          </div>
          <div className="stats-week-actions">
            <IconButton label="Предыдущая неделя" onClick={() => setWeekDate(addDays(weekDate, -7))}>
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton label="Следующая неделя" onClick={() => setWeekDate(addDays(weekDate, 7))}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
        </div>
        <div className="weekly-line-chart">
          <div className="weekly-line-scale" aria-hidden="true">
            <span>100%</span>
            <span>50%</span>
            <span>0%</span>
          </div>
          <svg
            aria-label="Процент выполненных запланированных дел за неделю"
            preserveAspectRatio="none"
            viewBox={`0 0 ${weeklyLineWidth} ${weeklyLineHeight}`}
          >
            <defs>
              <linearGradient id="weekly-line-gradient" x1="0" x2={weeklyLineWidth} y1="0" y2="0" gradientUnits="userSpaceOnUse">
                {weeklyGradientStops.map((stop) => (
                  <stop key={`${stop.offset}-${stop.color}`} offset={stop.offset} stopColor={stop.color} />
                ))}
              </linearGradient>
            </defs>
            <line className="grid top" x1="0" x2={weeklyLineWidth} y1={weeklyLinePaddingY} y2={weeklyLinePaddingY} />
            <line className="grid middle" x1="0" x2={weeklyLineWidth} y1={weeklyLinePaddingY + weeklyLineInnerHeight / 2} y2={weeklyLinePaddingY + weeklyLineInnerHeight / 2} />
            <line
              className="grid bottom"
              x1="0"
              x2={weeklyLineWidth}
              y1={weeklyLineHeight - weeklyLinePaddingY}
              y2={weeklyLineHeight - weeklyLinePaddingY}
            />
            {weeklyLinePath && <polyline className="line" points={weeklyLinePath} />}
            {weeklyLinePoints.map((point) => (
              <g key={point.date}>
                <circle cx={point.x} cy={point.y} r="4" style={{ stroke: point.color }} />
              </g>
            ))}
          </svg>
          <div className="weekly-line-labels">
            {weeklyAxisBars.map((bar, index) => (
              <span key={bar.date} style={{ left: `${(weeklyPointX(index) / weeklyLineWidth) * 100}%` }}>
                {formatShortDate(bar.date)}
              </span>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function UnfinishedTasksScreen({
  onBack,
  onNextMonth,
  onPrevMonth,
  onRepeatTask,
  saving,
  selectedDate,
  taskStatsFilter,
  stats,
}: {
  onBack: () => void;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  onRepeatTask: (task: TaskDto, scheduledDate: string, startTime: string) => Promise<void>;
  saving: boolean;
  selectedDate: string;
  taskStatsFilter: TaskStatsFilter;
  stats: StatsDto | null;
}) {
  type RepeatDraft = { date: string; dateText: string; time: string };

  const repeatTimeHours = useMemo(
    () => Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0")),
    [],
  );
  const repeatTimeMinutes = useMemo(
    () => Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")),
    [],
  );
  const [repeatDrafts, setRepeatDrafts] = useState<Record<number, RepeatDraft>>({});
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [repeatingTaskId, setRepeatingTaskId] = useState<number | null>(null);
  const [repeatDatePickerTaskId, setRepeatDatePickerTaskId] = useState<number | null>(null);
  const [repeatDateCursor, setRepeatDateCursor] = useState(selectedDate);
  const [repeatTimePickerTaskId, setRepeatTimePickerTaskId] = useState<number | null>(null);
  const repeatHourColumnRef = useRef<HTMLDivElement | null>(null);
  const repeatMinuteColumnRef = useRef<HTMLDivElement | null>(null);
  const sourceDays = useMemo(
    () => stats?.tasksByDay ?? stats?.unfinishedByDay ?? [],
    [stats?.tasksByDay, stats?.unfinishedByDay],
  );
  const taskDays = useMemo(
    () =>
      sourceDays
        .map((day) => ({
          date: day.date,
          tasks: day.tasks.filter((task) => {
            if (taskStatsFilter === "done") {
              return task.status === "done";
            }

            if (taskStatsFilter === "unfinished") {
              return task.status !== "done" && day.date <= selectedDate;
            }

            return true;
          }),
        }))
        .filter((day) => day.tasks.length > 0)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [selectedDate, sourceDays, taskStatsFilter],
  );
  const tasksCount = taskDays.reduce((sum, day) => sum + day.tasks.length, 0);
  const screenTitle =
    taskStatsFilter === "done"
      ? "Выполненные задачи"
      : taskStatsFilter === "all"
        ? "Все задачи"
        : "Не выполненные задачи";
  const emptyText =
    taskStatsFilter === "done"
      ? "В этом месяце нет выполненных задач."
      : taskStatsFilter === "all"
        ? "В этом месяце нет задач."
        : "В этом месяце нет не выполненных задач.";
  const monthTitle = formatMonthTitle(selectedDate);

  useEffect(() => {
    setRepeatDrafts((current) => {
      const next = { ...current };

      for (const day of taskDays) {
        for (const task of day.tasks) {
          next[task.id] ??= {
            date: selectedDate,
            dateText: formatDateInputValue(selectedDate),
            time: task.startTime ?? "",
          };
        }
      }

      return next;
    });
  }, [selectedDate, taskDays]);

  useEffect(() => {
    setExpandedTaskId(null);
    setRepeatDatePickerTaskId(null);
    setRepeatDateCursor(selectedDate);
    setRepeatTimePickerTaskId(null);
  }, [selectedDate, taskStatsFilter]);

  useEffect(() => {
    if (repeatTimePickerTaskId === null) {
      return;
    }

    const task = taskDays
      .flatMap((day) => day.tasks)
      .find((candidate) => candidate.id === repeatTimePickerTaskId);

    if (!task) {
      return;
    }

    const [hour = "09", minute = "00"] = normalizeTimeInput(
      repeatDraft(task).time || task.startTime || "09:00",
    ).split(":");

    window.requestAnimationFrame(() => {
      scrollRepeatTimeColumn(repeatHourColumnRef.current, repeatTimeHours.indexOf(hour));
      scrollRepeatTimeColumn(repeatMinuteColumnRef.current, repeatTimeMinutes.indexOf(minute));
    });
  }, [repeatTimeHours, repeatTimeMinutes, repeatTimePickerTaskId, taskDays]);

  function repeatDraft(task: TaskDto) {
    return (
      repeatDrafts[task.id] ?? {
        date: selectedDate,
        dateText: formatDateInputValue(selectedDate),
        time: task.startTime ?? "",
      }
    );
  }

  function updateRepeatDraft(task: TaskDto, patch: Partial<RepeatDraft>) {
    setRepeatDrafts((current) => ({
      ...current,
      [task.id]: {
        ...repeatDraft(task),
        ...patch,
      },
    }));
  }

  function updateRepeatDateText(task: TaskDto, value: string) {
    const dateText = formatDateTextInput(value);
    updateRepeatDraft(task, {
      date: parseDateTextInput(dateText),
      dateText,
    });
  }

  function normalizeRepeatDateText(task: TaskDto) {
    const draft = repeatDraft(task);
    const date = parseDateTextInput(draft.dateText);

    if (!date) {
      updateRepeatDraft(task, { date: "", dateText: formatDateTextInput(draft.dateText) });
      return;
    }

    updateRepeatDraft(task, { date, dateText: formatDateInputValue(date) });
  }

  function selectRepeatDate(task: TaskDto, date: string) {
    updateRepeatDraft(task, { date, dateText: formatDateInputValue(date) });
    setRepeatDateCursor(date);
    setRepeatDatePickerTaskId(null);
  }

  function pickRepeatTimePart(task: TaskDto, part: "hour" | "minute", value: string) {
    const draft = repeatDraft(task);
    const [hour = "09", minute = "00"] = normalizeTimeInput(
      draft.time || task.startTime || "09:00",
    ).split(":");

    updateRepeatDraft(task, {
      time: part === "hour" ? `${value}:${minute}` : `${hour}:${value}`,
    });
  }

  function scrollRepeatTimeColumn(element: HTMLDivElement | null, index: number) {
    if (!element || index < 0) {
      return;
    }

    const firstButton = element.querySelector("button");
    const secondButton = element.querySelectorAll("button")[1];
    const step = secondButton
      ? secondButton.offsetTop - firstButton!.offsetTop
      : (firstButton?.offsetHeight ?? 28);

    element.scrollTop = index * step;
  }

  function handleRepeatTimeScroll(
    task: TaskDto,
    part: "hour" | "minute",
    values: string[],
    element: HTMLDivElement,
  ) {
    const firstButton = element.querySelector("button");
    const secondButton = element.querySelectorAll("button")[1];

    if (!firstButton) {
      return;
    }

    const step = secondButton ? secondButton.offsetTop - firstButton.offsetTop : firstButton.offsetHeight;
    const index = Math.min(values.length - 1, Math.max(0, Math.round(element.scrollTop / step)));
    const value = values[index];

    if (value) {
      pickRepeatTimePart(task, part, value);
    }
  }

  async function handleRepeatTask(task: TaskDto) {
    const draft = repeatDraft(task);
    const date = draft.date || parseDateTextInput(draft.dateText);

    if (!date) {
      return;
    }

    const time = normalizeTimeInput(draft.time);
    setRepeatingTaskId(task.id);
    try {
      await onRepeatTask(task, date, time);
    } finally {
      setRepeatingTaskId(null);
    }
  }

  const repeatTasks = taskDays.flatMap((day) => day.tasks);
  const repeatDatePickerTask =
    repeatDatePickerTaskId === null
      ? null
      : (repeatTasks.find((task) => task.id === repeatDatePickerTaskId) ?? null);
  const repeatTimePickerTask =
    repeatTimePickerTaskId === null
      ? null
      : (repeatTasks.find((task) => task.id === repeatTimePickerTaskId) ?? null);

  return (
    <>
      <section className="screen padded unfinished-screen fade-in">
        <div className="back-title">
          <IconButton label="Назад" onClick={onBack}>
            <ChevronLeft size={18} />
          </IconButton>
          <div>
            <p className="overline">{monthTitle}</p>
            <h1>{screenTitle}</h1>
          </div>
        </div>
        <section className="chart-card unfinished-card">
          <div className="stats-card-head">
            <div>
              <p className="overline">{monthTitle}</p>
              <h2>{formatTaskCount(tasksCount)}</h2>
            </div>
            <div className="stats-month-actions">
              <IconButton label="Предыдущий месяц" onClick={onPrevMonth}>
                <ChevronLeft size={18} />
              </IconButton>
              <IconButton label="Следующий месяц" onClick={onNextMonth}>
                <ChevronRight size={18} />
              </IconButton>
            </div>
          </div>
          {taskDays.length ? (
            <div className="unfinished-day-list">
              {taskDays.map((day) => (
                <div className="unfinished-day" key={day.date}>
                  <time>{formatHistoryDate(day.date)}</time>
                  <div className="unfinished-task-list">
                    {day.tasks.map((task) => {
                      const draft = repeatDraft(task);
                      const priority = priorityMeta[task.priority];
                      const isRepeating = repeatingTaskId === task.id;
                      const canRepeat = taskStatsFilter === "unfinished" && task.status !== "done";
                      const isExpanded = expandedTaskId === task.id;

                      return (
                        <article
                          className={`unfinished-task ${task.status === "done" ? "done" : ""}`}
                          key={task.id}
                        >
                          <button
                            className="unfinished-task-main"
                            disabled={!canRepeat}
                            onClick={() =>
                              setExpandedTaskId((current) => (current === task.id ? null : task.id))
                            }
                            type="button"
                          >
                            <div>
                              <strong>{task.title}</strong>
                              <small>
                                {task.startTime ? `Было на ${task.startTime}` : "Без времени"}
                                {canRepeat ? " · нажми, чтобы назначить заново" : ""}
                              </small>
                            </div>
                            <span style={{ backgroundColor: priority.soft, color: priority.color }}>
                              {priority.label}
                            </span>
                          </button>
                          {canRepeat && isExpanded && (
                            <div className="task-repeat-controls">
                              <div className="repeat-field">
                                <button
                                  aria-label="Выбрать дату"
                                  className="repeat-field-icon"
                                  onClick={() => {
                                    setRepeatDateCursor(draft.date || selectedDate);
                                    setRepeatDatePickerTaskId(task.id);
                                  }}
                                  type="button"
                                >
                                  <CalendarDays size={14} />
                                </button>
                                <input
                                  aria-label="Дата повтора"
                                  inputMode="numeric"
                                  onBlur={() => normalizeRepeatDateText(task)}
                                  onChange={(event) => updateRepeatDateText(task, event.target.value)}
                                  placeholder="дд.мм.гггг"
                                  type="text"
                                  value={draft.dateText}
                                />
                              </div>
                              <div className="repeat-field">
                                <input
                                  aria-label="Время повтора"
                                  inputMode="numeric"
                                  onBlur={(event) =>
                                    updateRepeatDraft(task, {
                                      time: normalizeTimeInput(event.target.value),
                                    })
                                  }
                                  onChange={(event) =>
                                    updateRepeatDraft(task, {
                                      time: formatTimeInput(event.target.value),
                                    })
                                  }
                                  placeholder="--:--"
                                  type="text"
                                  value={draft.time}
                                />
                                <button
                                  aria-label="Выбрать время"
                                  className="repeat-field-icon"
                                  onClick={() => setRepeatTimePickerTaskId(task.id)}
                                  type="button"
                                >
                                  <Clock3 size={14} />
                                </button>
                              </div>
                              <button
                                className="task-repeat-submit"
                                disabled={saving || isRepeating || !draft.date}
                                onClick={() => void handleRepeatTask(task)}
                                type="button"
                              >
                                <Plus size={16} />
                                {isRepeating ? "Добавляю" : "Добавить"}
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="stats-empty">{emptyText}</p>
          )}
        </section>
      </section>
      {repeatDatePickerTask && (
        <DatePickerDialog
          calendar={monthGrid(repeatDateCursor)}
          cursor={repeatDateCursor}
          onClose={() => setRepeatDatePickerTaskId(null)}
          onNextMonth={() => setRepeatDateCursor(addMonths(repeatDateCursor, 1))}
          onPrevMonth={() => setRepeatDateCursor(addMonths(repeatDateCursor, -1))}
          onSelect={(date) => selectRepeatDate(repeatDatePickerTask, date)}
          selectedDate={repeatDraft(repeatDatePickerTask).date || null}
        />
      )}
      {repeatTimePickerTask && (
        <TimePickerDialog
          className="repeat-time-dialog"
          onClose={() => setRepeatTimePickerTaskId(null)}
          title="Выбери время"
        >
          <div className="repeat-time-wheel">
            <div
              className="repeat-time-column"
              onScroll={(event) =>
                handleRepeatTimeScroll(
                  repeatTimePickerTask,
                  "hour",
                  repeatTimeHours,
                  event.currentTarget,
                )
              }
              ref={repeatHourColumnRef}
            >
              {repeatTimeHours.map((hour) => (
                <button
                  className={
                    normalizeTimeInput(repeatDraft(repeatTimePickerTask).time).split(":")[0] === hour
                      ? "active"
                      : ""
                  }
                  key={hour}
                  onClick={() => pickRepeatTimePart(repeatTimePickerTask, "hour", hour)}
                  type="button"
                >
                  {hour}
                </button>
              ))}
            </div>
            <span>:</span>
            <div
              className="repeat-time-column"
              onScroll={(event) =>
                handleRepeatTimeScroll(
                  repeatTimePickerTask,
                  "minute",
                  repeatTimeMinutes,
                  event.currentTarget,
                )
              }
              ref={repeatMinuteColumnRef}
            >
              {repeatTimeMinutes.map((minute) => (
                <button
                  className={
                    normalizeTimeInput(repeatDraft(repeatTimePickerTask).time).split(":")[1] ===
                    minute
                      ? "active"
                      : ""
                  }
                  key={minute}
                  onClick={() => pickRepeatTimePart(repeatTimePickerTask, "minute", minute)}
                  type="button"
                >
                  {minute}
                </button>
              ))}
            </div>
          </div>
          <button
            className="repeat-time-done"
            onClick={() => setRepeatTimePickerTaskId(null)}
            type="button"
          >
            Готово
          </button>
        </TimePickerDialog>
      )}
    </>
  );
}

function RecordsScreen({
  day,
  days,
  onBack,
  onNextMonth,
  onOpenDate,
  onPrevMonth,
  selectedDate,
}: {
  day: DayDto | null;
  days: SummaryDay[];
  onBack: () => void;
  onNextMonth: () => void;
  onOpenDate: (date: string) => void;
  onPrevMonth: () => void;
  selectedDate: string;
}) {
  const first = days[0]?.date ?? selectedDate.slice(0, 8) + "01";
  const firstDate = parseIsoDate(first);
  const lead = (firstDate.getUTCDay() + 6) % 7;
  const blanks = Array.from({ length: lead }, (_, index) => index);
  const reflection = day?.date === selectedDate ? day.reflection : null;

  return (
    <section className="screen padded records-screen fade-in">
      <div className="back-title">
        <IconButton label="Назад" onClick={onBack}>
          <ChevronLeft size={18} />
        </IconButton>
        <h1>Мои записи</h1>
      </div>

      <section className="records-calendar-card">
        <header className="records-month-head">
          <IconButton label="Предыдущий месяц" onClick={onPrevMonth}>
            <ChevronLeft size={18} />
          </IconButton>
          <div>
            <strong>{formatMonthTitle(first)}</strong>
            <small>{days.filter((item) => item.reflectionFilled).length} записей</small>
          </div>
          <IconButton label="Следующий месяц" onClick={onNextMonth}>
            <ChevronRight size={18} />
          </IconButton>
        </header>

        <div className="calendar-dows">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((dayName) => (
            <span key={dayName}>{dayName}</span>
          ))}
        </div>
        <div className="records-calendar-grid">
          {blanks.map((blank) => (
            <span className="records-calendar-day blank" key={blank} />
          ))}
          {days.map((calendarDay) => {
            const date = parseIsoDate(calendarDay.date);
            const selected = calendarDay.date === selectedDate;

            return (
              <button
                className={[
                  "records-calendar-day",
                  selected ? "selected" : "",
                  calendarDay.reflectionFilled ? "filled" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={calendarDay.date}
                onClick={() => onOpenDate(calendarDay.date)}
                type="button"
              >
                <strong>{date.getUTCDate()}</strong>
                <i />
              </button>
            );
          })}
        </div>
      </section>

      <section className="record-detail-card">
        <header>
          <div>
            <p className="overline">Выбранная дата</p>
            <h2>{formatHistoryDate(selectedDate)}</h2>
          </div>
          {reflection && <span>{reflection.productivityScore}/10</span>}
        </header>

        {reflection ? (
          <>
            <div className="record-better-pill">
              {reflection.betterThanYesterday ? "Лучше, чем вчера" : "Не лучше, чем вчера"}
            </div>
            <div className="record-answer-list">
              {surveyFields.map(([field, label]) => (
                <article className="record-answer" key={field}>
                  <strong>{label}</strong>
                  <p>{reflection[field] || "Нет записи."}</p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <section className="empty-state records-empty">
            <MessageCircle size={22} />
            <strong>За этот день записей нет</strong>
            <p>Выбери дату с отметкой в календаре или заполни вечерний опросник за день.</p>
          </section>
        )}
      </section>
    </section>
  );
}

function HistoryScreen({
  days,
  onBack,
  onOpenDay,
}: {
  days: HistoryDay[];
  onBack: () => void;
  onOpenDay: (date: string) => void;
}) {
  return (
    <section className="screen padded history-screen fade-in">
      <div className="back-title">
        <IconButton label="Назад" onClick={onBack}>
          <ChevronLeft size={18} />
        </IconButton>
        <h1>История</h1>
      </div>
      <div className="filter-row">
        {["Все", "Обязательные", "Работа", "Выполнено"].map((item, index) => (
          <button className={index === 0 ? "active" : ""} key={item} type="button">
            {item}
          </button>
        ))}
      </div>
      {days.map((day) => (
        <button
          className="history-card"
          key={day.date}
          onClick={() => onOpenDay(day.date)}
          type="button"
        >
          <header>
            <strong>{formatHistoryDate(day.date)}</strong>
            <span>{day.score ?? 0}/10</span>
          </header>
          <p>{day.note || "Пока нет заметки за этот день."}</p>
          <footer>
            <span className="good">✓ {day.done}</span>
            <span className="warn">пропущено {day.skipped}</span>
            {day.reflectionFilled && <span className="violet">рефлексия</span>}
          </footer>
        </button>
      ))}
    </section>
  );
}

function EditorScreen({
  draft,
  onCancel,
  onChange,
  onSave,
  saving,
  tags,
}: {
  draft: EditorDraft;
  onCancel: () => void;
  onChange: (draft: EditorDraft) => void;
  onSave: () => void;
  saving: boolean;
  tags: TagDto[];
}) {
  const [customBefore, setCustomBefore] = useState("15");
  const [customAt, setCustomAt] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateCursor, setDateCursor] = useState(draft.scheduledDate ?? localTodayDate());
  const [timeSectionOpen, setTimeSectionOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(draft.reminders.length > 0);
  const [openTimePicker, setOpenTimePicker] = useState<"start" | "end" | "customAt" | null>(
    null,
  );
  const [timeWheelValue, setTimeWheelValue] = useState("09:00");
  const timeWheelHourRef = useRef<HTMLDivElement | null>(null);
  const timeWheelMinuteRef = useRef<HTMLDivElement | null>(null);
  const calendar = monthGrid(dateCursor);
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

  useEffect(() => {
    if (!openTimePicker) {
      return;
    }

    const [hour = "09", minute = "00"] = timeWheelValue.split(":");

    window.requestAnimationFrame(() => {
      scrollTimeWheelColumn(timeWheelHourRef.current, hours.indexOf(hour));
      scrollTimeWheelColumn(timeWheelMinuteRef.current, minutes.indexOf(minute));
    });
  }, [openTimePicker]);

  function toggleTag(name: string) {
    onChange({
      ...draft,
      tags: draft.tags.includes(name)
        ? draft.tags.filter((item) => item !== name)
        : [...draft.tags, name],
    });
  }
  const editing = draft.id !== null;

  function changeDate(date: string | null) {
    if (date) {
      setDateCursor(date);
    }

    setDatePickerOpen(false);

    onChange({
      ...draft,
      scheduledDate: date,
      startTime: date ? draft.startTime : "",
      endTime: date ? draft.endTime : "",
      reminderEnabled: date ? draft.reminderEnabled : false,
      reminders: date ? draft.reminders : [],
    });
  }

  function selectDate(date: string) {
    changeDate(date);
  }

  function changeStartTime(value: string) {
    onChange({
      ...draft,
      startTime: value,
      reminders: value
        ? draft.reminders
        : draft.reminders.filter((reminder) => reminder.mode !== "before"),
    });
  }

  function addBeforeReminder(minutes: number) {
    if (!draft.scheduledDate || !draft.startTime) {
      return;
    }

    if (
      draft.reminders.some(
        (reminder) => reminder.mode === "before" && reminder.minutesBefore === minutes,
      )
    ) {
      return;
    }

    onChange({
      ...draft,
      reminderEnabled: true,
      reminders: [
        ...draft.reminders,
        {
          clientId: createReminderId(),
          mode: "before",
          minutesBefore: minutes,
          remindTime: null,
        },
      ],
    });
  }

  function addAtReminder(time: string) {
    if (!draft.scheduledDate || !time) {
      return;
    }

    if (
      draft.reminders.some(
        (reminder) => reminder.mode === "at" && reminder.remindTime === time,
      )
    ) {
      return;
    }

    onChange({
      ...draft,
      reminderEnabled: true,
      reminders: [
        ...draft.reminders,
        {
          clientId: createReminderId(),
          mode: "at",
          minutesBefore: null,
          remindTime: time,
        },
      ],
    });
  }

  function removeReminder(clientId: string) {
    const reminders = draft.reminders.filter((reminder) => reminder.clientId !== clientId);

    onChange({
      ...draft,
      reminderEnabled: reminders.length > 0,
      reminders,
    });
  }

  function clearReminders() {
    onChange({
      ...draft,
      reminderEnabled: false,
      reminders: [],
    });
  }

  function describeReminder(reminder: EditorReminderDraft) {
    if (reminder.mode === "before") {
      return `За ${formatMinutes(reminder.minutesBefore ?? 0)} до начала`;
    }

    return `В ${reminder.remindTime}`;
  }

  function setTime(target: "start" | "end" | "customAt", value: string) {
    if (target === "start") {
      changeStartTime(value);
      return;
    }

    if (target === "end") {
      onChange({ ...draft, endTime: value });
      return;
    }

    setCustomAt(value);
  }

  function changeTimeInput(target: "start" | "end", value: string) {
    setOpenTimePicker(null);
    setTime(target, formatTimeInput(value));
  }

  function normalizeTimeField(target: "start" | "end") {
    const value = target === "start" ? draft.startTime : draft.endTime;
    setTime(target, normalizeTimeInput(value));
  }

  function currentTimeForWheel() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function openTimeWheel(target: "start" | "end" | "customAt") {
    if (openTimePicker === target) {
      setOpenTimePicker(null);
      return;
    }

    const value = target === "start" ? draft.startTime : target === "end" ? draft.endTime : customAt;
    setTimeWheelValue(normalizeTimeInput(value) || currentTimeForWheel());
    setOpenTimePicker(target);
  }

  function scrollTimeWheelColumn(element: HTMLDivElement | null, index: number) {
    if (!element || index < 0) {
      return;
    }

    const firstButton = element.querySelector("button");
    const secondButton = element.querySelectorAll("button")[1];
    const step = secondButton
      ? secondButton.offsetTop - firstButton!.offsetTop
      : (firstButton?.offsetHeight ?? 44);

    element.scrollTop = index * step;
  }

  function selectTimeWheelPart(part: "hour" | "minute", value: string) {
    setTimeWheelValue((current) => {
      const [hour = "09", minute = "00"] = current.split(":");
      return part === "hour" ? `${value}:${minute}` : `${hour}:${value}`;
    });

    scrollTimeWheelColumn(
      part === "hour" ? timeWheelHourRef.current : timeWheelMinuteRef.current,
      (part === "hour" ? hours : minutes).indexOf(value),
    );
  }

  function handleTimeWheelScroll(
    part: "hour" | "minute",
    values: string[],
    element: HTMLDivElement,
  ) {
    const firstButton = element.querySelector("button");
    const secondButton = element.querySelectorAll("button")[1];

    if (!firstButton) {
      return;
    }

    const step = secondButton ? secondButton.offsetTop - firstButton.offsetTop : firstButton.offsetHeight;
    const index = Math.min(values.length - 1, Math.max(0, Math.round(element.scrollTop / step)));
    const value = values[index];

    if (value) {
      setTimeWheelValue((current) => {
        const [hour = "09", minute = "00"] = current.split(":");
        return part === "hour" ? `${value}:${minute}` : `${hour}:${value}`;
      });
    }
  }

  function confirmTimeWheel() {
    if (!openTimePicker) {
      return;
    }

    setTime(openTimePicker, timeWheelValue);
    setOpenTimePicker(null);
  }

  function renderTimePicker() {
    const [selectedHour, selectedMinute] = timeWheelValue.split(":");

    return (
      <>
        <div className="repeat-time-wheel">
          <div
            aria-label="Часы"
            className="repeat-time-column"
            onScroll={(event) =>
              handleTimeWheelScroll("hour", hours, event.currentTarget)
            }
            ref={timeWheelHourRef}
          >
            {hours.map((hour) => (
              <button
                aria-label={`Час ${hour}`}
                className={selectedHour === hour ? "active" : ""}
                key={hour}
                onClick={() => selectTimeWheelPart("hour", hour)}
                type="button"
              >
                {hour}
              </button>
            ))}
          </div>
          <span>:</span>
          <div
            aria-label="Минуты"
            className="repeat-time-column"
            onScroll={(event) =>
              handleTimeWheelScroll("minute", minutes, event.currentTarget)
            }
            ref={timeWheelMinuteRef}
          >
            {minutes.map((minute) => (
              <button
                aria-label={`Минута ${minute}`}
                className={selectedMinute === minute ? "active" : ""}
                key={minute}
                onClick={() => selectTimeWheelPart("minute", minute)}
                type="button"
              >
                {minute}
              </button>
            ))}
          </div>
        </div>
        <button className="repeat-time-done" onClick={confirmTimeWheel} type="button">
          Готово
        </button>
      </>
    );
  }

  return (
    <section className="screen padded form-screen fade-in">
      <div className="editor-top">
        <button onClick={onCancel} type="button">
          Отмена
        </button>
        <strong>{editing ? "Редактировать задачу" : "Новая задача"}</strong>
        {editing ? (
          <button className="accent-link" disabled={saving} onClick={onSave} type="button">
            Сохранить
          </button>
        ) : (
          <span aria-hidden="true" className="editor-top-spacer" />
        )}
      </div>
      <input
        aria-label="Название задачи"
        className="field"
        onChange={(event) => onChange({ ...draft, title: event.target.value })}
        placeholder="Название задачи"
        value={draft.title}
      />
      <textarea
        className="field textarea"
        onChange={(event) => onChange({ ...draft, description: event.target.value })}
        placeholder="Описание (необязательно)"
        value={draft.description}
      />
      <section className={`picker-card date-card${datePickerOpen ? " expanded" : ""}`}>
        <button
          aria-expanded={datePickerOpen}
          className="date-toggle"
          onClick={() => {
            setDateCursor(draft.scheduledDate ?? localTodayDate());
            setDatePickerOpen((open) => !open);
          }}
          type="button"
        >
          <span className="date-toggle-icon">
            <CalendarDays size={18} />
          </span>
          <span className="date-toggle-copy">
            <strong>{draft.scheduledDate ? formatHistoryDate(draft.scheduledDate) : "Без даты"}</strong>
            <small>
              {draft.scheduledDate === localTodayDate()
                ? "Сегодня"
                : draft.scheduledDate
                  ? "Дата задачи"
                  : "Задача попадёт в бэклог"}
            </small>
          </span>
          <ChevronRight className="date-toggle-chevron" size={20} />
        </button>

        {datePickerOpen && (
          <div className="date-card-content">
            <div className="date-popover">
              <header>
                <IconButton label="Предыдущий месяц" onClick={() => setDateCursor(addMonths(dateCursor, -1))}>
                  <ChevronLeft size={16} />
                </IconButton>
                <strong>{formatMonthTitle(dateCursor)}</strong>
                <IconButton label="Следующий месяц" onClick={() => setDateCursor(addMonths(dateCursor, 1))}>
                  <ChevronRight size={16} />
                </IconButton>
              </header>
              <div className="date-weekdays">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="date-grid">
                {calendar.blanks.map((blank) => (
                  <span key={blank} />
                ))}
                {calendar.days.map((day) => (
                  <button
                    className={day === draft.scheduledDate ? "active" : ""}
                    key={day}
                    onClick={() => selectDate(day)}
                    type="button"
                  >
                    {parseIsoDate(day).getUTCDate()}
                  </button>
                ))}
              </div>
            </div>
            <div className="picker-actions date-card-actions">
              <button onClick={() => changeDate(localTodayDate())} type="button">
                Сегодня
              </button>
              <button onClick={() => changeDate(localTomorrowDate())} type="button">
                Завтра
              </button>
              <button onClick={() => changeDate(null)} type="button">
                Без даты
              </button>
            </div>
          </div>
        )}
      </section>

      <section
        className={`picker-card time-card${timeSectionOpen ? " expanded" : ""}${
          draft.scheduledDate ? "" : " disabled"
        }`}
      >
        <button
          aria-expanded={timeSectionOpen}
          className="time-toggle"
          onClick={() => setTimeSectionOpen((open) => !open)}
          type="button"
        >
          <span className="time-toggle-icon">
            <Clock3 size={18} />
          </span>
          <span className="time-toggle-copy">
            <strong>
              {draft.startTime && draft.endTime
                ? `${draft.startTime}–${draft.endTime}`
                : draft.startTime
                  ? `С ${draft.startTime}`
                  : draft.endTime
                    ? `До ${draft.endTime}`
                    : "Время не выбрано"}
            </strong>
            <small>{draft.scheduledDate ? "Необязательно" : "Сначала выберите дату"}</small>
          </span>
          <ChevronRight className="time-toggle-chevron" size={20} />
        </button>

        {timeSectionOpen && (
          <div className="time-card-content">
            {draft.scheduledDate ? (
              <div className="time-picker-grid">
            <div className="time-picker-field">
              <span>Начало</span>
              <div className="time-input-shell">
                <input
                  aria-label="Начало задачи"
                  inputMode="numeric"
                  maxLength={5}
                  onBlur={() => normalizeTimeField("start")}
                  onChange={(event) => changeTimeInput("start", event.target.value)}
                  placeholder="--:--"
                  type="text"
                  value={draft.startTime}
                />
                <button
                  aria-expanded={openTimePicker === "start"}
                  aria-label="Выбрать время начала"
                  className="time-picker-trigger"
                  onClick={() => openTimeWheel("start")}
                  type="button"
                >
                  <Clock3 size={17} />
                </button>
              </div>
            </div>
            <div className="time-picker-field">
              <span>Конец</span>
              <div className="time-input-shell">
                <input
                  aria-label="Конец задачи"
                  inputMode="numeric"
                  maxLength={5}
                  onBlur={() => normalizeTimeField("end")}
                  onChange={(event) => changeTimeInput("end", event.target.value)}
                  placeholder="--:--"
                  type="text"
                  value={draft.endTime}
                />
                <button
                  aria-expanded={openTimePicker === "end"}
                  aria-label="Выбрать время конца"
                  className="time-picker-trigger"
                  onClick={() => openTimeWheel("end")}
                  type="button"
                >
                  <Clock3 size={17} />
                </button>
              </div>
            </div>
              </div>
            ) : (
              <p className="picker-muted">Сначала назначь дату, чтобы выбрать время.</p>
            )}
            {(draft.startTime || draft.endTime) && (
              <button
                className="time-clear"
                onClick={() =>
                  onChange({
                    ...draft,
                    startTime: "",
                    endTime: "",
                    reminders: draft.reminders.filter((reminder) => reminder.mode !== "before"),
                  })
                }
                type="button"
              >
                Очистить время
              </button>
            )}
          </div>
        )}
      </section>
      <Label>Приоритет</Label>
      <div className="segmented">
        {(["must", "should", "optional"] as const).map((priority) => (
          <button
            className={`priority-option priority-${priority}${
              draft.priority === priority ? " active" : ""
            }`}
            key={priority}
            onClick={() => onChange({ ...draft, priority })}
            type="button"
          >
            {priorityMeta[priority].label}
          </button>
        ))}
      </div>
      <Label>Теги</Label>
      <div className="tag-picker">
        {tags.map((tag) => (
          <button
            className={draft.tags.includes(tag.name) ? "selected" : ""}
            key={tag.id}
            onClick={() => toggleTag(tag.name)}
            style={{ backgroundColor: tag.bg, color: tag.fg }}
            type="button"
          >
            {tag.name}
          </button>
        ))}
      </div>
      <section
        className={`picker-card reminder-card${remindersOpen ? " expanded" : ""}${
          draft.scheduledDate ? "" : " disabled"
        }`}
      >
        <div className="reminder-card-head">
          <button
            aria-expanded={remindersOpen}
            className="reminder-toggle"
            onClick={() => setRemindersOpen((open) => !open)}
            type="button"
          >
            <span className="reminder-toggle-icon">
              <Bell size={17} />
            </span>
            <span className="reminder-toggle-copy">
              <strong>Напоминания</strong>
              <small>
                {draft.reminders.length > 0
                  ? `Добавлено: ${draft.reminders.length}`
                  : "Необязательно"}
              </small>
            </span>
            <ChevronRight className="reminder-toggle-chevron" size={19} />
          </button>
          {remindersOpen && draft.reminders.length > 0 && (
            <button className="reminder-clear" onClick={clearReminders} type="button">
              Очистить
            </button>
          )}
        </div>

        {remindersOpen && (
          <div className="reminder-card-content">
            {!draft.scheduledDate ? (
              <p className="picker-muted">Сначала назначь дату, чтобы добавить напоминания.</p>
            ) : (
              <>
            <div className="reminder-quick-grid">
              {[15, 30, 60, 120].map((minutes) => (
                <button
                  disabled={!draft.startTime}
                  key={minutes}
                  onClick={() => addBeforeReminder(minutes)}
                  type="button"
                >
                  {formatMinutes(minutes)}
                </button>
              ))}
            </div>

            {!draft.startTime && (
              <p className="picker-muted">
                Быстрые варианты “за N минут” включатся после выбора начала задачи.
              </p>
            )}

            <div className="reminder-custom-grid">
              <label>
                <span>За сколько</span>
                <div>
                  <input
                    aria-label="Минут до напоминания"
                    min="0"
                    onChange={(event) => setCustomBefore(event.target.value)}
                    type="number"
                    value={customBefore}
                  />
                  <button
                    aria-label="Добавить напоминание за минуты"
                    disabled={!draft.startTime || Number(customBefore) < 0 || !customBefore}
                    onClick={() => addBeforeReminder(Number(customBefore))}
                    type="button"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </label>
              <label>
                <span>Во сколько</span>
                <div>
                  <button
                    aria-expanded={openTimePicker === "customAt"}
                    aria-label="Время напоминания"
                    className="time-field-button compact"
                    onClick={() => openTimeWheel("customAt")}
                    type="button"
                  >
                    <strong>{formatTimeValue(customAt)}</strong>
                    <Clock3 size={15} />
                  </button>
                  <button
                    aria-label="Добавить напоминание по времени"
                    disabled={!customAt}
                    onClick={() => addAtReminder(customAt)}
                    type="button"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </label>
            </div>

            {draft.reminders.length > 0 ? (
              <div className="reminder-list">
                {draft.reminders.map((reminder) => (
                  <div className="reminder-item" key={reminder.clientId}>
                    <span>
                      <Bell size={15} />
                    </span>
                    <strong>{describeReminder(reminder)}</strong>
                    <button
                      aria-label={`Удалить напоминание ${describeReminder(reminder)}`}
                      onClick={() => removeReminder(reminder.clientId)}
                      type="button"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="picker-muted">Пока нет напоминаний.</p>
            )}
              </>
            )}
          </div>
        )}
      </section>
      {!editing && (
        <button
          className="primary-action editor-create-action"
          disabled={saving}
          onClick={onSave}
          type="button"
        >
          {saving ? "Создаём…" : "Создать задачу"}
        </button>
      )}
      {openTimePicker && (
        <TimePickerDialog
          className="repeat-time-dialog"
          onClose={() => setOpenTimePicker(null)}
          title="Выбери время"
        >
          {renderTimePicker()}
        </TimePickerDialog>
      )}
    </section>
  );
}

function DatePickerDialog({
  calendar,
  cursor,
  onClose,
  onNextMonth,
  onPrevMonth,
  onSelect,
  selectedDate,
}: {
  calendar: ReturnType<typeof monthGrid>;
  cursor: string;
  onClose: () => void;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  onSelect: (date: string) => void;
  selectedDate: string | null;
}) {
  return (
    <div className="dialog-layer" role="presentation" onMouseDown={onClose}>
      <section
        aria-label="Выбор даты"
        aria-modal="true"
        className="picker-dialog date-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="dialog-head">
          <IconButton label="Предыдущий месяц" onClick={onPrevMonth}>
            <ChevronLeft size={16} />
          </IconButton>
          <strong>{formatMonthTitle(cursor)}</strong>
          <IconButton label="Следующий месяц" onClick={onNextMonth}>
            <ChevronRight size={16} />
          </IconButton>
          <IconButton label="Закрыть календарь" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="date-weekdays">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="date-grid">
          {calendar.blanks.map((blank) => (
            <span key={blank} />
          ))}
          {calendar.days.map((day) => (
            <button
              className={day === selectedDate ? "active" : ""}
              key={day}
              onClick={() => onSelect(day)}
              type="button"
            >
              {parseIsoDate(day).getUTCDate()}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function TimePickerDialog({
  children,
  className,
  onClose,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="dialog-layer" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={`Выбор времени: ${title}`}
        aria-modal="true"
        className={`picker-dialog time-dialog${className ? ` ${className}` : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="dialog-head">
          <strong>{title}</strong>
          <IconButton label="Закрыть выбор времени" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        {children}
      </section>
    </div>
  );
}

function SurveyScreen({
  draft,
  onBack,
  onChange,
  onSave,
  saving,
}: {
  draft: SurveyDraft;
  onBack: () => void;
  onChange: (draft: SurveyDraft) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <section className="screen padded survey-screen fade-in">
      <div className="editor-top">
        <button onClick={onBack} type="button">
          Закрыть
        </button>
        <strong>Итоги дня</strong>
        <button className="accent-link" disabled={saving} onClick={onSave} type="button">
          Сохранить
        </button>
      </div>
      <p className="muted-line">Данные сохраняются в Postgres и доступны в истории</p>
      <section className="survey-card">
        <h2>Оценка продуктивности</h2>
        <div className="range-row">
          <input
            max="10"
            min="0"
            onChange={(event) =>
              onChange({ ...draft, productivityScore: Number(event.target.value) })
            }
            type="range"
            value={draft.productivityScore}
          />
          <strong>{draft.productivityScore}</strong>
        </div>
      </section>
      <section className="better-card">
        <strong>Стал лучше, чем вчера?</strong>
        <span>
          <button
            className={draft.betterThanYesterday ? "active" : ""}
            onClick={() => onChange({ ...draft, betterThanYesterday: true })}
            type="button"
          >
            Да
          </button>
          <button
            className={!draft.betterThanYesterday ? "active" : ""}
            onClick={() => onChange({ ...draft, betterThanYesterday: false })}
            type="button"
          >
            Нет
          </button>
        </span>
      </section>
      {surveyFields.map(([field, label, placeholder]) => (
        <section className="survey-card" key={field}>
          <h2>{label}</h2>
          <textarea
            onChange={(event) =>
              onChange({ ...draft, [field]: event.target.value })
            }
            placeholder={placeholder}
            value={draft[field]}
          />
        </section>
      ))}
    </section>
  );
}

function TelegramScreen({
  onBack,
  onUpdate,
  settings,
}: {
  onBack: () => void;
  onUpdate: (patch: Partial<TelegramSettings>) => void;
  settings: TelegramSettings | null;
}) {
  const token = settings?.linkToken ?? "a8f3-27c1-9de0";
  const notifications = [
    ["Напоминание о задаче", "taskReminders", settings?.taskReminders ?? true],
    ["Утренний дайджест дня", "morningDigest", settings?.morningDigest ?? true],
    [
      "Вечернее напоминание заполнить опросник",
      "eveningSurvey",
      settings?.eveningSurvey ?? true,
    ],
    [
      "Невыполненные обязательные задачи",
      "unfinishedRequired",
      settings?.unfinishedRequired ?? false,
    ],
  ] as const;

  return (
    <section className="screen padded telegram-screen fade-in">
      <div className="back-title">
        <IconButton label="Назад" onClick={onBack}>
          <ChevronLeft size={18} />
        </IconButton>
        <h1>Уведомления</h1>
      </div>
      <section className="telegram-hero">
        <MessageCircle size={28} />
        <h2>{settings?.connected ? "Telegram подключен" : "Подключи Telegram"}</h2>
        <p>
          Напоминания о задачах, утренний дайджест и вечерний опрос будут
          приходить прямо в мессенджер.
        </p>
      </section>
      <section className="steps-card">
        {[
          "Открой Telegram и найди своего бота",
          "Отправь боту команду со своим кодом",
          "После /start backend привяжет chat id к аккаунту",
        ].map((step, index) => (
          <p key={step}>
            <span>{index + 1}</span>
            {step}
          </p>
        ))}
        <button className="code-pill" type="button">
          <code>/start {token}</code>
          <Copy size={15} />
        </button>
      </section>
      <button className="primary-action" type="button">
        Открыть Telegram
      </button>
      <Label>Типы уведомлений</Label>
      <div className="settings-list">
        {notifications.map(([label, key, checked]) => (
          <button
            className="notification-row"
            key={key}
            onClick={() => void onUpdate({ [key]: !checked })}
            type="button"
          >
            <span>{label}</span>
            <Toggle checked={checked} />
          </button>
        ))}
      </div>
    </section>
  );
}

function SettingsScreen({
  compactMode,
  desktopNav,
  onBack,
  onCreateTag,
  onDeleteTag,
  onLogout,
  onOpenTelegram,
  onUpdateTag,
  setCompactMode,
  setDesktopNav,
  tags,
  telegram,
  user,
}: {
  compactMode: boolean;
  desktopNav: boolean;
  onBack: () => void;
  onCreateTag: (input: Omit<TagDto, "id">) => Promise<void>;
  onDeleteTag: (tagId: number) => Promise<void>;
  onLogout: () => void;
  onOpenTelegram: () => void;
  onUpdateTag: (tag: TagDto) => Promise<void>;
  setCompactMode: (value: boolean) => void;
  setDesktopNav: (value: boolean) => void;
  tags: TagDto[];
  telegram: TelegramSettings | null;
  user: AuthUser;
}) {
  return (
    <section className="screen padded settings-screen fade-in">
      <div className="back-title">
        <IconButton label="Назад" onClick={onBack}>
          <ChevronLeft size={18} />
        </IconButton>
        <h1>Настройки</h1>
      </div>

      <section className="settings-panel">
        <div className="settings-panel__head">
          <span className="settings-mark">
            <Settings size={20} />
          </span>
          <div>
            <h2>Приложение</h2>
            <p>Базовые настройки интерфейса и рабочего окружения.</p>
          </div>
        </div>

        <button
          className="notification-row"
          onClick={() => setCompactMode(!compactMode)}
          type="button"
        >
          <span>
            <strong>Компактный режим</strong>
            <small>Уменьшает отступы и делает списки плотнее</small>
          </span>
          <Toggle checked={compactMode} />
        </button>

        <button
          className="notification-row"
          onClick={() => setDesktopNav(!desktopNav)}
          type="button"
        >
          <span>
            <strong>Навигация сверху на десктопе</strong>
            <small>Если выключить, табы останутся снизу как на телефоне</small>
          </span>
          <Toggle checked={desktopNav} />
        </button>
      </section>

      <TagSettingsPanel
        onCreateTag={onCreateTag}
        onDeleteTag={onDeleteTag}
        onUpdateTag={onUpdateTag}
        tags={tags}
      />

      <section className="settings-panel">
        <div className="settings-panel__head">
          <span className="settings-mark">
            <Home size={20} />
          </span>
          <div>
            <h2>Аккаунт</h2>
            <p>
              {user.displayName} · @{user.username} · {user.timezone}
            </p>
          </div>
        </div>

        <button className="settings-link-row danger" onClick={onLogout} type="button">
          <span>
            <strong>Выйти</strong>
            <small>Завершить текущую сессию на этом устройстве</small>
          </span>
          <ChevronRight size={18} />
        </button>
      </section>

      <section className="settings-panel">
        <div className="settings-panel__head">
          <span className="settings-mark">
            <MessageCircle size={20} />
          </span>
          <div>
            <h2>Telegram</h2>
            <p>
              {telegram?.connected
                ? "Аккаунт Telegram подключен"
                : "Бот пока не привязан к аккаунту"}
            </p>
          </div>
        </div>

        <button className="settings-link-row" onClick={onOpenTelegram} type="button">
          <span>
            <strong>Открыть уведомления</strong>
            <small>/start {telegram?.linkToken ?? "a8f3-27c1-9de0"}</small>
          </span>
          <ChevronRight size={18} />
        </button>
      </section>

      <section className="settings-panel">
        <div className="settings-panel__head">
          <span className="settings-mark settings-mark--ok">
            <Check size={20} />
          </span>
          <div>
            <h2>Состояние</h2>
            <p>Frontend, API и Postgres отвечают. Данные сохраняются в базе.</p>
          </div>
        </div>
      </section>
    </section>
  );
}

const newTagDefaults: Omit<TagDto, "id"> = {
  name: "",
  bg: "#e8ecfb",
  fg: "#4656b8",
};

function TagSettingsPanel({
  onCreateTag,
  onDeleteTag,
  onUpdateTag,
  tags,
}: {
  onCreateTag: (input: Omit<TagDto, "id">) => Promise<void>;
  onDeleteTag: (tagId: number) => Promise<void>;
  onUpdateTag: (tag: TagDto) => Promise<void>;
  tags: TagDto[];
}) {
  const [draft, setDraft] = useState<Omit<TagDto, "id">>(newTagDefaults);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<TagDto | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);

  async function saveNewTag() {
    const name = draft.name.trim();

    if (!name) {
      return;
    }

    setBusyId("new");
    setTagError(null);
    try {
      await onCreateTag({ ...draft, name });
      setDraft(newTagDefaults);
    } catch {
      setTagError("Не удалось сохранить тэг. Проверь название и цвета.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveEditedTag() {
    if (!editDraft) {
      return;
    }

    const name = editDraft.name.trim();

    if (!name) {
      return;
    }

    setBusyId(editDraft.id);
    setTagError(null);
    try {
      await onUpdateTag({ ...editDraft, name });
      setEditingId(null);
      setEditDraft(null);
    } catch {
      setTagError("Не удалось обновить тэг. Возможно, такое название уже есть.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeTag(tagId: number) {
    setBusyId(tagId);
    setTagError(null);
    try {
      await onDeleteTag(tagId);
      if (editingId === tagId) {
        setEditingId(null);
        setEditDraft(null);
      }
    } catch {
      setTagError("Не удалось удалить тэг.");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(tag: TagDto) {
    setEditingId(tag.id);
    setEditDraft(tag);
    setTagError(null);
  }

  return (
    <section className="settings-panel">
      <div className="settings-panel__head">
        <span className="settings-mark">
          <Palette size={20} />
        </span>
        <div>
          <h2>Тэги</h2>
          <p>Пользовательские категории для задач.</p>
        </div>
      </div>

      <div className="tag-settings">
        <div className="tag-edit-row new">
          <TagEditFields draft={draft} onChange={setDraft} />
          <IconButton
            disabled={busyId === "new" || !draft.name.trim()}
            label="Добавить тэг"
            onClick={() => void saveNewTag()}
          >
            <Plus size={17} />
          </IconButton>
        </div>

        {tags.length === 0 ? (
          <p className="tag-empty">Пока нет тэгов. Создай первый и он появится в редакторе задач.</p>
        ) : (
          <div className="tag-settings-list">
            {tags.map((tag) =>
              editingId === tag.id && editDraft ? (
                <div className="tag-edit-row" key={tag.id}>
                  <TagEditFields draft={editDraft} onChange={setEditDraft} />
                  <IconButton
                    disabled={busyId === tag.id || !editDraft.name.trim()}
                    label="Сохранить тэг"
                    onClick={() => void saveEditedTag()}
                  >
                    <Check size={17} />
                  </IconButton>
                  <IconButton
                    label="Отменить редактирование"
                    onClick={() => {
                      setEditingId(null);
                      setEditDraft(null);
                    }}
                  >
                    <X size={17} />
                  </IconButton>
                </div>
              ) : (
                <div className="tag-settings-row" key={tag.id}>
                  <span
                    className="tag-preview"
                    style={{ backgroundColor: tag.bg, color: tag.fg }}
                  >
                    {tag.name}
                  </span>
                  <IconButton label={`Редактировать ${tag.name}`} onClick={() => startEdit(tag)}>
                    <Edit3 size={16} />
                  </IconButton>
                  <IconButton
                    disabled={busyId === tag.id}
                    label={`Удалить ${tag.name}`}
                    onClick={() => void removeTag(tag.id)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              ),
            )}
          </div>
        )}

        {tagError && <p className="tag-error">{tagError}</p>}
      </div>
    </section>
  );
}

function TagEditFields<T extends Omit<TagDto, "id">>({
  draft,
  onChange,
}: {
  draft: T;
  onChange: (draft: T) => void;
}) {
  return (
    <>
      <input
        aria-label="Название тэга"
        onChange={(event) => onChange({ ...draft, name: event.target.value })}
        placeholder="Название"
        type="text"
        value={draft.name}
      />
      <label className="color-field">
        <span>Фон</span>
        <input
          aria-label="Цвет фона тэга"
          onChange={(event) => onChange({ ...draft, bg: event.target.value })}
          type="color"
          value={draft.bg}
        />
      </label>
      <label className="color-field">
        <span>Текст</span>
        <input
          aria-label="Цвет текста тэга"
          onChange={(event) => onChange({ ...draft, fg: event.target.value })}
          type="color"
          value={draft.fg}
        />
      </label>
    </>
  );
}

function TabBar({
  active,
  onChange,
}: {
  active: string;
  onChange: (screen: Screen) => void;
}) {
  const tabs = [
    ["day", "День", Home],
    ["week", "Неделя", CalendarDays],
    ["backlog", "Бэклог", Inbox],
    ["blog", "Блог", Camera],
    ["stats", "Итоги", BarChart3],
  ] as const;

  return (
    <nav className="tab-bar">
      {tabs.map(([id, label, Icon]) => (
        <button
          className={active === id ? "active" : ""}
          key={id}
          onClick={() => onChange(id)}
          type="button"
        >
          <Icon size={19} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Metric({
  accent = false,
  label,
  value,
}: {
  accent?: boolean;
  label: string;
  value: string;
}) {
  return (
    <article className="metric-card">
      <strong className={accent ? "accent" : ""}>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function MiniChip({ name }: { name: string }) {
  const tag = tagToken(name);

  return (
    <span
      className="mini-chip"
      style={
        {
          "--chip-bg": tag.bg,
          "--chip-bar": tag.fg,
          "--chip-fg": tag.fg,
        } as React.CSSProperties
      }
    >
      {tag.name}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="form-label">{children}</p>;
}

function Toggle({ checked = false }: { checked?: boolean }) {
  return (
    <span className={checked ? "toggle checked" : "toggle"} aria-hidden="true">
      <i />
    </span>
  );
}
