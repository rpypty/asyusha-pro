import { query } from "./db.js";

export type TaskPriority = "must" | "should" | "optional";
export type TaskStatus =
  | "planned"
  | "in_progress"
  | "done"
  | "skipped"
  | "cancelled";
export type ReminderMode = "before" | "at";
export type ReminderStatus = "pending" | "sent" | "failed";

export type TaskReminderDto = {
  id: number;
  mode: ReminderMode;
  minutesBefore: number | null;
  remindTime: string | null;
  remindAt: string;
  status: ReminderStatus;
};

export type TaskReminderInput = {
  mode: ReminderMode;
  minutesBefore?: number | null;
  remindTime?: string | null;
};

export type TaskDto = {
  id: number;
  title: string;
  description: string;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  reminders: TaskReminderDto[];
  tags: Array<{
    id: number;
    name: string;
    bg: string;
    fg: string;
  }>;
};

export type IdeaDto = {
  id: number;
  title: string;
  body: string;
  isFavorite: boolean;
  isShot: boolean;
  tags: IdeaTagDto[];
  createdAt: string;
  updatedAt: string;
};

export type IdeaTagDto = {
  id: number;
  name: string;
  bg: string;
  fg: string;
};

export type VideoPostingMonthDto = {
  checkedDates: string[];
};

export const DEMO_USER_ID = 1;

type TaskRow = {
  id: number;
  title: string;
  description: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  reminder_enabled: boolean;
  reminder_minutes_before: number;
  reminders: TaskReminderDto[] | null;
  tags: Array<{
    id: number;
    name: string;
    bg: string;
    fg: string;
  }> | null;
};

type IdeaRow = {
  id: number;
  title: string;
  body: string;
  is_favorite: boolean;
  is_shot: boolean;
  tags: IdeaTagDto[] | null;
  created_at: string;
  updated_at: string;
};

function toTaskDto(row: TaskRow): TaskDto {
  const reminders = row.reminders ?? [];

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    scheduledDate: row.scheduled_date,
    startTime: row.start_time ? row.start_time.slice(0, 5) : null,
    endTime: row.end_time ? row.end_time.slice(0, 5) : null,
    priority: row.priority,
    status: row.status,
    reminderEnabled: reminders.length > 0 || row.reminder_enabled,
    reminderMinutesBefore: row.reminder_minutes_before,
    reminders,
    tags: row.tags ?? []
  };
}

function toIdeaDto(row: IdeaRow): IdeaDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    isFavorite: row.is_favorite,
    isShot: row.is_shot,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const remindersJsonSql = `
  coalesce(
    (
      select json_agg(
        json_build_object(
          'id', r.id,
          'mode', r.kind,
          'minutesBefore', r.minutes_before,
          'remindTime', case
            when r.remind_time is null then null
            else to_char(r.remind_time, 'HH24:MI')
          end,
          'remindAt', to_char(r.remind_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'status', r.status
        )
        order by r.position, r.id
      )
      from reminders r
      where r.task_id = t.id and r.status = 'pending'
    ),
    '[]'::json
  ) as reminders
`;

export async function getTags(userId = DEMO_USER_ID) {
  const result = await query<{
    id: number;
    name: string;
    bg: string;
    fg: string;
  }>(
    "select id, name, bg, fg from tags where user_id = $1 order by id",
    [userId]
  );

  return result.rows;
}

export async function createTag(
  input: {
    name: string;
    bg: string;
    fg: string;
  },
  userId = DEMO_USER_ID
) {
  const result = await query<{
    id: number;
    name: string;
    bg: string;
    fg: string;
  }>(
    `
      insert into tags (user_id, name, bg, fg)
      values ($1, $2, $3, $4)
      on conflict (user_id, name) do update set bg = excluded.bg, fg = excluded.fg
      returning id, name, bg, fg
    `,
    [userId, input.name, input.bg, input.fg]
  );
  const tag = result.rows[0];

  if (!tag) {
    throw new Error("Failed to create tag");
  }

  return tag;
}

export async function updateTag(
  id: number,
  input: {
    name: string;
    bg: string;
    fg: string;
  },
  userId = DEMO_USER_ID
) {
  const result = await query<{
    id: number;
    name: string;
    bg: string;
    fg: string;
  }>(
    `
      update tags
      set name = $3, bg = $4, fg = $5
      where user_id = $1 and id = $2
      returning id, name, bg, fg
    `,
    [userId, id, input.name, input.bg, input.fg]
  );

  return result.rows[0] ?? null;
}

export async function deleteTag(id: number, userId = DEMO_USER_ID) {
  const result = await query("delete from tags where user_id = $1 and id = $2", [
    userId,
    id
  ]);

  return (result.rowCount ?? 0) > 0;
}

export async function getIdeaTags(userId = DEMO_USER_ID) {
  const result = await query<IdeaTagDto>(
    "select id, name, bg, fg from idea_tags where user_id = $1 order by name, id",
    [userId]
  );

  return result.rows;
}

export async function createIdeaTag(
  input: { name: string; bg: string; fg: string },
  userId = DEMO_USER_ID
) {
  const result = await query<IdeaTagDto>(
    `
      insert into idea_tags (user_id, name, bg, fg)
      values ($1, $2, $3, $4)
      on conflict (user_id, name) do update set bg = excluded.bg, fg = excluded.fg
      returning id, name, bg, fg
    `,
    [userId, input.name, input.bg, input.fg]
  );
  const tag = result.rows[0];

  if (!tag) {
    throw new Error("Failed to create idea tag");
  }

  return tag;
}

export async function deleteIdeaTag(id: number, userId = DEMO_USER_ID) {
  const result = await query(
    "delete from idea_tags where user_id = $1 and id = $2",
    [userId, id]
  );

  return (result.rowCount ?? 0) > 0;
}

const ideaTagsJsonSql = `
  coalesce(
    (
      select json_agg(
        json_build_object('id', it.id, 'name', it.name, 'bg', it.bg, 'fg', it.fg)
        order by it.name, it.id
      )
      from idea_tag_links itl
      join idea_tags it on it.id = itl.tag_id
      where itl.idea_id = i.id
    ),
    '[]'::json
  ) as tags
`;

async function setIdeaTags(ideaId: number, tagNames: string[], userId: number) {
  await query(
    `
      delete from idea_tag_links
      where idea_id = $2
        and exists (select 1 from ideas where id = $2 and user_id = $1)
    `,
    [userId, ideaId]
  );

  for (const name of [...new Set(tagNames)]) {
    await query(
      `
        insert into idea_tag_links (idea_id, tag_id)
        select $2, id from idea_tags where user_id = $1 and name = $3
        on conflict do nothing
      `,
      [userId, ideaId, name]
    );
  }
}

async function getIdea(id: number, userId: number) {
  const result = await query<IdeaRow>(
    `
      select
        i.id,
        i.title,
        i.body,
        i.is_favorite,
        i.is_shot,
        ${ideaTagsJsonSql},
        to_char(i.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
        to_char(i.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
      from ideas i
      where i.user_id = $1 and i.id = $2
    `,
    [userId, id]
  );

  const idea = result.rows[0];
  return idea ? toIdeaDto(idea) : null;
}

export async function getIdeas(userId = DEMO_USER_ID) {
  const result = await query<IdeaRow>(
    `
      select
        i.id,
        i.title,
        i.body,
        i.is_favorite,
        i.is_shot,
        ${ideaTagsJsonSql},
        to_char(i.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
        to_char(i.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
      from ideas i
      where i.user_id = $1
      order by i.updated_at desc, i.id desc
    `,
    [userId]
  );

  return result.rows.map(toIdeaDto);
}

export async function createIdea(
  input: {
    title: string;
    body?: string;
    isFavorite?: boolean;
    isShot?: boolean;
    tags?: string[];
  },
  userId = DEMO_USER_ID
) {
  const result = await query<IdeaRow>(
    `
      insert into ideas (user_id, title, body, is_favorite, is_shot)
      values ($1, $2, $3, $4, $5)
      returning
        id,
        title,
        body,
        is_favorite,
        is_shot,
        to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
        to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
    `,
    [userId, input.title, input.body ?? "", input.isFavorite ?? false, input.isShot ?? false]
  );
  const idea = result.rows[0];

  if (!idea) {
    throw new Error("Failed to create idea");
  }

  await setIdeaTags(idea.id, input.tags ?? [], userId);
  const created = await getIdea(idea.id, userId);

  if (!created) {
    throw new Error("Failed to load created idea");
  }

  return created;
}

export async function updateIdea(
  id: number,
  input: {
    title: string;
    body?: string;
    isFavorite?: boolean;
    isShot?: boolean;
    tags?: string[];
  },
  userId = DEMO_USER_ID
) {
  const result = await query<IdeaRow>(
    `
      update ideas
      set
        title = $3,
        body = $4,
        is_favorite = coalesce($5, is_favorite),
        is_shot = coalesce($6, is_shot),
        updated_at = now()
      where user_id = $1 and id = $2
      returning
        id,
        title,
        body,
        is_favorite,
        is_shot,
        to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
        to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
    `,
    [userId, id, input.title, input.body ?? "", input.isFavorite, input.isShot]
  );
  const idea = result.rows[0];

  if (!idea) {
    return null;
  }

  if (input.tags) {
    await setIdeaTags(idea.id, input.tags, userId);
  }

  return getIdea(idea.id, userId);
}

export async function deleteIdea(id: number, userId = DEMO_USER_ID) {
  const result = await query("delete from ideas where user_id = $1 and id = $2", [
    userId,
    id
  ]);

  return (result.rowCount ?? 0) > 0;
}

export async function getVideoPostingMonth(
  year: number,
  month: number,
  userId = DEMO_USER_ID
): Promise<VideoPostingMonthDto> {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const result = await query<{ post_date: string }>(
    `
      select to_char(post_date, 'YYYY-MM-DD') as post_date
      from video_posting_days
      where user_id = $1
        and post_date >= $2::date
        and post_date < ($2::date + interval '1 month')
      order by post_date
    `,
    [userId, start]
  );

  return {
    checkedDates: result.rows.map((row) => row.post_date)
  };
}

export async function setVideoPostingDay(
  date: string,
  checked: boolean,
  userId = DEMO_USER_ID
) {
  if (!checked) {
    await query("delete from video_posting_days where user_id = $1 and post_date = $2", [
      userId,
      date
    ]);
    return {
      date,
      checked: false
    };
  }

  await query(
    `
      insert into video_posting_days (user_id, post_date)
      values ($1, $2)
      on conflict (user_id, post_date)
      do update set updated_at = now()
    `,
    [userId, date]
  );

  return {
    date,
    checked: true
  };
}

export async function getTasksForDate(date: string, userId = DEMO_USER_ID) {
  const result = await query<TaskRow>(
    `
      select
        t.id,
        t.title,
        t.description,
        to_char(t.scheduled_date, 'YYYY-MM-DD') as scheduled_date,
        t.start_time::text as start_time,
        t.end_time::text as end_time,
        t.priority,
        t.status,
        t.reminder_enabled,
        t.reminder_minutes_before,
        ${remindersJsonSql},
        coalesce(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'bg', tg.bg, 'fg', tg.fg)
            order by tg.id
          ) filter (where tg.id is not null),
          '[]'::json
        ) as tags
      from tasks t
      left join task_tags tt on tt.task_id = t.id
      left join tags tg on tg.id = tt.tag_id
      where t.user_id = $1
        and (
          t.scheduled_date = $2
          or (
            t.scheduled_date = ($2::date - interval '1 day')::date
            and t.start_time is not null
            and t.end_time is not null
            and t.end_time < t.start_time
          )
        )
      group by t.id
      order by
        case
          when t.scheduled_date = ($2::date - interval '1 day')::date
            and t.start_time is not null
            and t.end_time is not null
            and t.end_time < t.start_time
          then time '00:00'
          else t.start_time
        end nulls last,
        t.id
    `,
    [userId, date]
  );

  return result.rows.map(toTaskDto);
}

export async function createTask(
  input: {
    title: string;
    description?: string;
    scheduledDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    priority: TaskPriority;
    status?: TaskStatus;
    tags?: string[];
    reminders?: TaskReminderInput[];
    reminderEnabled?: boolean;
    reminderMinutesBefore?: number;
  },
  userId = DEMO_USER_ID
) {
  const scheduledDate = input.scheduledDate ?? null;
  const created = await query<{ id: number }>(
    `
      insert into tasks
        (user_id, title, description, scheduled_date, start_time, end_time, priority, status, reminder_enabled, reminder_minutes_before)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning id
    `,
    [
      userId,
      input.title,
      input.description ?? "",
      scheduledDate,
      scheduledDate ? input.startTime || null : null,
      scheduledDate ? input.endTime || null : null,
      input.priority,
      input.status ?? "planned",
      scheduledDate ? input.reminderEnabled ?? true : false,
      input.reminderMinutesBefore ?? 15
    ]
  );
  const taskId = created.rows[0]?.id;

  if (!taskId) {
    throw new Error("Failed to create task");
  }

  await replaceTaskTags(taskId, input.tags ?? [], userId);
  await replaceTaskReminders(
    taskId,
    userId,
    input.reminders ?? legacyReminderInput(input),
    {
      scheduledDate,
      startTime: scheduledDate ? input.startTime || null : null
    }
  );
  return getTask(taskId, userId);
}

export async function updateTask(
  id: number,
  input: Partial<{
    title: string;
    description: string;
    scheduledDate: string | null;
    startTime: string | null;
    endTime: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    tags: string[];
    reminders: TaskReminderInput[];
    reminderEnabled: boolean;
    reminderMinutesBefore: number;
  }>,
  userId = DEMO_USER_ID
) {
  const current = await getTask(id, userId);

  if (!current) {
    return null;
  }

  const nextScheduledDate =
    input.scheduledDate === undefined ? current.scheduledDate : input.scheduledDate;
  const nextStartTime = nextScheduledDate
    ? input.startTime === undefined
      ? current.startTime
      : input.startTime
    : null;
  const nextEndTime = nextScheduledDate
    ? input.endTime === undefined
      ? current.endTime
      : input.endTime
    : null;
  const nextReminderEnabled = nextScheduledDate
    ? input.reminderEnabled ?? current.reminderEnabled
    : false;

  await query(
    `
      update tasks
      set
        title = $3,
        description = $4,
        scheduled_date = $5,
        start_time = $6,
        end_time = $7,
        priority = $8,
        status = $9,
        reminder_enabled = $10,
        reminder_minutes_before = $11,
        updated_at = now()
      where user_id = $1 and id = $2
    `,
    [
      userId,
      id,
      input.title ?? current.title,
      input.description ?? current.description,
      nextScheduledDate,
      nextStartTime,
      nextEndTime,
      input.priority ?? current.priority,
      input.status ?? current.status,
      nextReminderEnabled,
      input.reminderMinutesBefore ?? current.reminderMinutesBefore
    ]
  );

  if (input.tags) {
    await replaceTaskTags(id, input.tags, userId);
  }

  if (input.reminders !== undefined || nextScheduledDate === null) {
    await replaceTaskReminders(id, userId, input.reminders ?? [], {
      scheduledDate: nextScheduledDate,
      startTime: nextStartTime
    });
  }

  return getTask(id, userId);
}

export async function deleteTask(id: number, userId = DEMO_USER_ID) {
  const result = await query("delete from tasks where user_id = $1 and id = $2", [
    userId,
    id
  ]);

  return (result.rowCount ?? 0) > 0;
}

export async function getBacklog(userId = DEMO_USER_ID) {
  const result = await query<TaskRow>(
    `
      select
        t.id,
        t.title,
        t.description,
        to_char(t.scheduled_date, 'YYYY-MM-DD') as scheduled_date,
        t.start_time::text as start_time,
        t.end_time::text as end_time,
        t.priority,
        t.status,
        t.reminder_enabled,
        t.reminder_minutes_before,
        ${remindersJsonSql},
        coalesce(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'bg', tg.bg, 'fg', tg.fg)
            order by tg.id
          ) filter (where tg.id is not null),
          '[]'::json
        ) as tags
      from tasks t
      left join task_tags tt on tt.task_id = t.id
      left join tags tg on tg.id = tt.tag_id
      where t.user_id = $1 and t.scheduled_date is null
      group by t.id
      order by t.updated_at desc, t.id desc
    `,
    [userId]
  );

  return result.rows.map(toTaskDto);
}

export async function getTask(id: number, userId = DEMO_USER_ID) {
  const result = await query<TaskRow>(
    `
      select
        t.id,
        t.title,
        t.description,
        to_char(t.scheduled_date, 'YYYY-MM-DD') as scheduled_date,
        t.start_time::text as start_time,
        t.end_time::text as end_time,
        t.priority,
        t.status,
        t.reminder_enabled,
        t.reminder_minutes_before,
        ${remindersJsonSql},
        coalesce(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'bg', tg.bg, 'fg', tg.fg)
            order by tg.id
          ) filter (where tg.id is not null),
          '[]'::json
        ) as tags
      from tasks t
      left join task_tags tt on tt.task_id = t.id
      left join tags tg on tg.id = tt.tag_id
      where t.user_id = $1 and t.id = $2
      group by t.id
    `,
    [userId, id]
  );

  const row = result.rows[0];
  return row ? toTaskDto(row) : null;
}

async function replaceTaskTags(taskId: number, tagNames: string[], userId: number) {
  await query("delete from task_tags where task_id = $1", [taskId]);

  for (const tagName of tagNames) {
    const tag = await ensureTag(tagName, userId);
    await query(
      "insert into task_tags (task_id, tag_id) values ($1, $2) on conflict do nothing",
      [taskId, tag.id]
    );
  }
}

function legacyReminderInput(input: {
  scheduledDate?: string | null;
  startTime?: string | null;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
}): TaskReminderInput[] {
  if (!input.scheduledDate || !input.startTime || input.reminderEnabled === false) {
    return [];
  }

  return [
    {
      mode: "before",
      minutesBefore: input.reminderMinutesBefore ?? 15
    }
  ];
}

async function replaceTaskReminders(
  taskId: number,
  userId: number,
  reminders: TaskReminderInput[],
  task: {
    scheduledDate: string | null;
    startTime: string | null;
  }
) {
  await query(
    "delete from reminders where task_id = $1 and status in ('pending', 'failed')",
    [taskId]
  );

  if (!task.scheduledDate) {
    return;
  }

  const timezone = await getUserTimezone(userId);
  const limited = reminders.slice(0, 10);

  for (const [position, reminder] of limited.entries()) {
    if (reminder.mode === "before") {
      if (!task.startTime || reminder.minutesBefore === null || reminder.minutesBefore === undefined) {
        continue;
      }

      await query(
        `
          insert into reminders
            (task_id, kind, minutes_before, remind_time, remind_at, position, status)
          values (
            $1,
            'before',
            $2::int,
            null,
            (($3::date + $4::time - ($2::int * interval '1 minute')) at time zone $5),
            $6,
            'pending'
          )
        `,
        [taskId, reminder.minutesBefore, task.scheduledDate, task.startTime, timezone, position]
      );
      continue;
    }

    if (!reminder.remindTime) {
      continue;
    }

    await query(
      `
        insert into reminders
          (task_id, kind, minutes_before, remind_time, remind_at, position, status)
        values (
          $1,
          'at',
          null,
          $2::time,
          (($3::date + $2::time) at time zone $4),
          $5,
          'pending'
        )
      `,
      [taskId, reminder.remindTime, task.scheduledDate, timezone, position]
    );
  }
}

async function getUserTimezone(userId: number) {
  const result = await query<{ timezone: string }>(
    "select timezone from users where id = $1",
    [userId]
  );

  return result.rows[0]?.timezone ?? "Europe/Moscow";
}

async function ensureTag(name: string, userId: number) {
  const palette: Record<string, [string, string]> = {
    Работа: ["#e8ecfb", "#4656b8"],
    Зал: ["#e4f3ec", "#2f8f6b"],
    Здоровье: ["#e2f1f2", "#2b8a90"],
    Учеба: ["#efe8fb", "#7150b8"],
    Отдых: ["#fdf0e2", "#b5772f"],
    Отношения: ["#fbe8ee", "#b8476a"],
    Финансы: ["#eef0f4", "#5a6475"]
  };
  const [bg, fg] = palette[name] ?? ["#eef0f4", "#5a6475"];
  const result = await query<{ id: number; name: string; bg: string; fg: string }>(
    `
      insert into tags (user_id, name, bg, fg)
      values ($1, $2, $3, $4)
      on conflict (user_id, name) do update set bg = excluded.bg
      returning id, name, bg, fg
    `,
    [userId, name, bg, fg]
  );
  const tag = result.rows[0];

  if (!tag) {
    throw new Error("Failed to create tag");
  }

  return tag;
}

export async function getDay(date: string, userId = DEMO_USER_ID) {
  const [tasks, entry, reflection, tags] = await Promise.all([
    getTasksForDate(date, userId),
    query<{
      note: string;
      productivity_score: number | null;
    }>(
      "select note, productivity_score from day_entries where user_id = $1 and entry_date = $2",
      [userId, date]
    ),
    query<{
      grateful: string;
      regret: string;
      went_well: string;
      improve_tomorrow: string;
      insight: string;
      motivation: string;
      better_than_yesterday: boolean;
      productivity_score: number;
    }>(
      `
        select grateful, regret, went_well, improve_tomorrow, insight, motivation,
               better_than_yesterday, productivity_score
        from reflections
        where user_id = $1 and reflection_date = $2
      `,
      [userId, date]
    ),
    getTags(userId)
  ]);
  const entryRow = entry.rows[0];
  const reflectionRow = reflection.rows[0];

  return {
    date,
    tasks,
    tags,
    entry: {
      note: entryRow?.note ?? "",
      productivityScore: entryRow?.productivity_score ?? null
    },
    reflection: reflectionRow
      ? {
          grateful: reflectionRow.grateful,
          regret: reflectionRow.regret,
          wentWell: reflectionRow.went_well,
          improveTomorrow: reflectionRow.improve_tomorrow,
          insight: reflectionRow.insight,
          motivation: reflectionRow.motivation,
          betterThanYesterday: reflectionRow.better_than_yesterday,
          productivityScore: reflectionRow.productivity_score
        }
      : null
  };
}

export async function upsertDayEntry(
  date: string,
  input: { note?: string; productivityScore?: number | null },
  userId = DEMO_USER_ID
) {
  const result = await query<{
    note: string;
    productivity_score: number | null;
  }>(
    `
      insert into day_entries (user_id, entry_date, note, productivity_score)
      values ($1, $2, $3, $4)
      on conflict (user_id, entry_date)
      do update set
        note = excluded.note,
        productivity_score = excluded.productivity_score,
        updated_at = now()
      returning note, productivity_score
    `,
    [userId, date, input.note ?? "", input.productivityScore ?? null]
  );
  const row = result.rows[0];

  return {
    note: row?.note ?? "",
    productivityScore: row?.productivity_score ?? null
  };
}

export async function upsertReflection(
  date: string,
  input: {
    grateful?: string;
    regret?: string;
    wentWell?: string;
    improveTomorrow?: string;
    insight?: string;
    motivation?: string;
    betterThanYesterday?: boolean;
    productivityScore: number;
  },
  userId = DEMO_USER_ID
) {
  const result = await query<{
    grateful: string;
    regret: string;
    went_well: string;
    improve_tomorrow: string;
    insight: string;
    motivation: string;
    better_than_yesterday: boolean;
    productivity_score: number;
  }>(
    `
      insert into reflections
        (user_id, reflection_date, grateful, regret, went_well, improve_tomorrow, insight, motivation, better_than_yesterday, productivity_score)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (user_id, reflection_date)
      do update set
        grateful = excluded.grateful,
        regret = excluded.regret,
        went_well = excluded.went_well,
        improve_tomorrow = excluded.improve_tomorrow,
        insight = excluded.insight,
        motivation = excluded.motivation,
        better_than_yesterday = excluded.better_than_yesterday,
        productivity_score = excluded.productivity_score,
        updated_at = now()
      returning grateful, regret, went_well, improve_tomorrow, insight, motivation,
                better_than_yesterday, productivity_score
    `,
    [
      userId,
      date,
      input.grateful ?? "",
      input.regret ?? "",
      input.wentWell ?? "",
      input.improveTomorrow ?? "",
      input.insight ?? "",
      input.motivation ?? "",
      input.betterThanYesterday ?? true,
      input.productivityScore
    ]
  );
  const row = result.rows[0];

  return row
    ? {
        grateful: row.grateful,
        regret: row.regret,
        wentWell: row.went_well,
        improveTomorrow: row.improve_tomorrow,
        insight: row.insight,
        motivation: row.motivation,
        betterThanYesterday: row.better_than_yesterday,
        productivityScore: row.productivity_score
      }
    : null;
}

export async function getWeekSummary(start: string, userId = DEMO_USER_ID) {
  const result = await query<{
    date: string;
    total: number;
    done: number;
    score: number | null;
    reflection_filled: boolean;
    tags: string[] | null;
  }>(
    `
      with days as (
        select generate_series($2::date, $2::date + interval '6 day', interval '1 day')::date as d
      )
      select
        to_char(days.d, 'YYYY-MM-DD') as date,
        count(t.id)::int as total,
        count(t.id) filter (where t.status = 'done')::int as done,
        max(coalesce(r.productivity_score, de.productivity_score))::int as score,
        bool_or(r.user_id is not null) as reflection_filled,
        coalesce(array_remove(array_agg(distinct tg.name), null), '{}') as tags
      from days
      left join tasks t on t.user_id = $1 and t.scheduled_date = days.d
      left join task_tags tt on tt.task_id = t.id
      left join tags tg on tg.id = tt.tag_id
      left join day_entries de on de.user_id = $1 and de.entry_date = days.d
      left join reflections r on r.user_id = $1 and r.reflection_date = days.d
      group by days.d
      order by days.d
    `,
    [userId, start]
  );

  return result.rows.map((row) => ({
    date: row.date,
    total: row.total,
    done: row.done,
    score: row.score,
    reflectionFilled: row.reflection_filled,
    tags: row.tags ?? []
  }));
}

export async function getMonthSummary(
  year: number,
  month: number,
  userId = DEMO_USER_ID
) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const result = await query<{
    date: string;
    total: number;
    done: number;
    reflection_filled: boolean;
    tags: string[] | null;
  }>(
    `
      with days as (
        select generate_series(
          $2::date,
          ($2::date + interval '1 month - 1 day')::date,
          interval '1 day'
        )::date as d
      )
      select
        to_char(days.d, 'YYYY-MM-DD') as date,
        count(t.id)::int as total,
        count(t.id) filter (where t.status = 'done')::int as done,
        bool_or(r.user_id is not null) as reflection_filled,
        coalesce(array_remove(array_agg(distinct tg.name), null), '{}') as tags
      from days
      left join tasks t on t.user_id = $1 and t.scheduled_date = days.d
      left join task_tags tt on tt.task_id = t.id
      left join tags tg on tg.id = tt.tag_id
      left join reflections r on r.user_id = $1 and r.reflection_date = days.d
      group by days.d
      order by days.d
    `,
    [userId, start]
  );

  return result.rows.map((row) => ({
    date: row.date,
    total: row.total,
    done: row.done,
    reflectionFilled: row.reflection_filled,
    tags: row.tags ?? []
  }));
}

export async function getHistory(userId = DEMO_USER_ID) {
  const result = await query<{
    date: string;
    note: string;
    score: number | null;
    done: number;
    skipped: number;
    reflection_filled: boolean;
  }>(
    `
      with dates as (
        select scheduled_date as d from tasks where user_id = $1 and scheduled_date is not null
        union
        select entry_date as d from day_entries where user_id = $1
        union
        select reflection_date as d from reflections where user_id = $1
      )
      select
        to_char(dates.d, 'YYYY-MM-DD') as date,
        coalesce(de.note, '') as note,
        coalesce(r.productivity_score, de.productivity_score) as score,
        count(t.id) filter (where t.status = 'done')::int as done,
        count(t.id) filter (where t.status in ('skipped', 'cancelled'))::int as skipped,
        (r.user_id is not null) as reflection_filled
      from dates
      left join tasks t on t.user_id = $1 and t.scheduled_date = dates.d
      left join day_entries de on de.user_id = $1 and de.entry_date = dates.d
      left join reflections r on r.user_id = $1 and r.reflection_date = dates.d
      group by dates.d, de.note, de.productivity_score, r.user_id, r.productivity_score
      order by dates.d desc
      limit 60
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    date: row.date,
    note: row.note,
    score: row.score,
    done: row.done,
    skipped: row.skipped,
    reflectionFilled: row.reflection_filled
  }));
}

export async function getStats(userId = DEMO_USER_ID, selectedDate: string) {
  const weekResult = await query<{
    label: string;
    date: string;
    score: number | null;
    done: number;
    total: number;
  }>(
    `
      with days as (
        select generate_series(
          date_trunc('week', $2::date)::date,
          (date_trunc('week', $2::date) + interval '6 days')::date,
          interval '1 day'
        )::date as d
      )
      select
        to_char(days.d, 'Dy') as label,
        to_char(days.d, 'YYYY-MM-DD') as date,
        coalesce(max(r.productivity_score), max(de.productivity_score), 0)::int as score,
        count(t.id) filter (where t.status = 'done')::int as done,
        count(t.id)::int as total
      from days
      left join tasks t on t.user_id = $1 and t.scheduled_date = days.d
      left join day_entries de on de.user_id = $1 and de.entry_date = days.d
      left join reflections r on r.user_id = $1 and r.reflection_date = days.d
      group by days.d
      order by days.d
    `,
    [userId, selectedDate]
  );
  const monthResult = await query<{
    score: number | null;
  }>(
    `
      with bounds as (
        select
          date_trunc('month', $2::date)::date as month_start,
          (date_trunc('month', $2::date) + interval '1 month - 1 day')::date as month_end
      ),
      days as (
        select generate_series(bounds.month_start, bounds.month_end, interval '1 day')::date as d
        from bounds
      )
      select coalesce(max(r.productivity_score), max(de.productivity_score), 0)::int as score
      from days
      left join day_entries de on de.user_id = $1 and de.entry_date = days.d
      left join reflections r on r.user_id = $1 and r.reflection_date = days.d
      group by days.d
      order by days.d
    `,
    [userId, selectedDate]
  );
  const ratioResult = await query<{
    done: number;
    unfinished: number;
    total: number;
  }>(
    `
      with bounds as (
        select
          date_trunc('month', $2::date)::date as month_start,
          (date_trunc('month', $2::date) + interval '1 month - 1 day')::date as month_end
      )
      select
        count(t.id) filter (where t.status = 'done')::int as done,
        count(t.id) filter (where t.status <> 'done')::int as unfinished,
        count(t.id)::int as total
      from bounds
      left join tasks t
        on t.user_id = $1
        and t.scheduled_date between bounds.month_start and bounds.month_end
    `,
    [userId, selectedDate]
  );
  const tasksResult = await query<TaskRow>(
    `
      with bounds as (
        select
          date_trunc('month', $2::date)::date as month_start,
          (date_trunc('month', $2::date) + interval '1 month - 1 day')::date as month_end
      )
      select
        t.id,
        t.title,
        t.description,
        to_char(t.scheduled_date, 'YYYY-MM-DD') as scheduled_date,
        case when t.start_time is null then null else to_char(t.start_time, 'HH24:MI') end as start_time,
        case when t.end_time is null then null else to_char(t.end_time, 'HH24:MI') end as end_time,
        t.priority,
        t.status,
        t.reminder_enabled,
        t.reminder_minutes_before,
        ${remindersJsonSql},
        coalesce(
          json_agg(
            json_build_object('id', tags.id, 'name', tags.name, 'bg', tags.bg, 'fg', tags.fg)
            order by tags.name
          ) filter (where tags.id is not null),
          '[]'::json
        ) as tags
      from bounds
      join tasks t
        on t.user_id = $1
        and t.scheduled_date between bounds.month_start and bounds.month_end
      left join task_tags tt on tt.task_id = t.id
      left join tags on tags.id = tt.tag_id
      group by t.id
      order by t.scheduled_date, t.start_time nulls last, t.id
    `,
    [userId, selectedDate]
  );
  const weekRows = weekResult.rows;
  const weekScores = weekRows.map((row) => row.score ?? 0).filter((score) => score > 0);
  const monthScores = monthResult.rows
    .map((row) => row.score ?? 0)
    .filter((score) => score > 0);
  const weekAverage = weekScores.length
    ? Number((weekScores.reduce((sum, score) => sum + score, 0) / weekScores.length).toFixed(1))
    : 0;
  const monthAverage = monthScores.length
    ? Number((monthScores.reduce((sum, score) => sum + score, 0) / monthScores.length).toFixed(1))
    : 0;
  const ratio = ratioResult.rows[0] ?? { done: 0, unfinished: 0, total: 0 };
  const monthTasks = tasksResult.rows.map(toTaskDto);
  const tasksByDate = new Map<string, TaskDto[]>();
  const unfinishedTasksByDate = new Map<string, TaskDto[]>();

  for (const task of monthTasks) {
    if (!task.scheduledDate) {
      continue;
    }

    tasksByDate.set(task.scheduledDate, [...(tasksByDate.get(task.scheduledDate) ?? []), task]);

    if (task.status !== "done") {
      unfinishedTasksByDate.set(task.scheduledDate, [
        ...(unfinishedTasksByDate.get(task.scheduledDate) ?? []),
        task
      ]);
    }
  }

  return {
    weekAverage,
    monthAverage,
    todayScore: weekRows.at(-1)?.score ?? 0,
    bars: weekRows.map((row) => ({
      label: row.label.trim(),
      date: row.date,
      score: row.score ?? 0,
      done: row.done,
      unfinished: Math.max(row.total - row.done, 0),
      total: row.total
    })),
    taskRatio: {
      done: ratio.done,
      unfinished: ratio.unfinished,
      total: ratio.total,
      donePercent: ratio.total ? Math.round((ratio.done / ratio.total) * 100) : 0,
      unfinishedPercent: ratio.total ? Math.round((ratio.unfinished / ratio.total) * 100) : 0
    },
    tasksByDay: Array.from(tasksByDate, ([date, tasks]) => ({ date, tasks })),
    unfinishedByDay: Array.from(unfinishedTasksByDate, ([date, tasks]) => ({ date, tasks }))
  };
}

export async function getTelegramSettings(userId = DEMO_USER_ID) {
  const result = await query<{
    chat_id: string | null;
    link_token: string;
    task_reminders: boolean;
    morning_digest: boolean;
    evening_survey: boolean;
    unfinished_required: boolean;
  }>(
    `
      insert into telegram_settings (user_id, link_token)
      values ($1, 'a8f3-27c1-9de0')
      on conflict (user_id) do update set updated_at = telegram_settings.updated_at
      returning chat_id, link_token, task_reminders, morning_digest, evening_survey, unfinished_required
    `,
    [userId]
  );
  const row = result.rows[0];

  if (!row) {
    throw new Error("Telegram settings are unavailable");
  }

  return {
    connected: Boolean(row.chat_id),
    chatId: row.chat_id,
    linkToken: row.link_token,
    taskReminders: row.task_reminders,
    morningDigest: row.morning_digest,
    eveningSurvey: row.evening_survey,
    unfinishedRequired: row.unfinished_required
  };
}

export async function updateTelegramSettings(
  input: Partial<{
    taskReminders: boolean;
    morningDigest: boolean;
    eveningSurvey: boolean;
    unfinishedRequired: boolean;
  }>,
  userId = DEMO_USER_ID
) {
  const current = await getTelegramSettings(userId);
  const result = await query<{
    chat_id: string | null;
    link_token: string;
    task_reminders: boolean;
    morning_digest: boolean;
    evening_survey: boolean;
    unfinished_required: boolean;
  }>(
    `
      update telegram_settings
      set
        task_reminders = $2,
        morning_digest = $3,
        evening_survey = $4,
        unfinished_required = $5,
        updated_at = now()
      where user_id = $1
      returning chat_id, link_token, task_reminders, morning_digest, evening_survey, unfinished_required
    `,
    [
      userId,
      input.taskReminders ?? current.taskReminders,
      input.morningDigest ?? current.morningDigest,
      input.eveningSurvey ?? current.eveningSurvey,
      input.unfinishedRequired ?? current.unfinishedRequired
    ]
  );
  const row = result.rows[0];

  return {
    connected: Boolean(row?.chat_id),
    chatId: row?.chat_id ?? null,
    linkToken: row?.link_token ?? current.linkToken,
    taskReminders: row?.task_reminders ?? current.taskReminders,
    morningDigest: row?.morning_digest ?? current.morningDigest,
    eveningSurvey: row?.evening_survey ?? current.eveningSurvey,
    unfinishedRequired: row?.unfinished_required ?? current.unfinishedRequired
  };
}

export async function connectTelegramChat(linkToken: string, chatId: string) {
  const result = await query<{
    user_id: number;
    display_name: string;
  }>(
    `
      update telegram_settings ts
      set chat_id = $2, updated_at = now()
      from users u
      where ts.user_id = u.id and ts.link_token = $1
      returning ts.user_id, u.display_name
    `,
    [linkToken, chatId]
  );

  return result.rows[0] ?? null;
}

export async function getDueReminderJobs(limit = 25) {
  const result = await query<{
    id: number;
    chat_id: string;
    title: string;
    scheduled_date: string | null;
    start_time: string | null;
    mode: ReminderMode;
    minutes_before: number | null;
    remind_time: string | null;
  }>(
    `
      select
        r.id,
        ts.chat_id,
        t.title,
        to_char(t.scheduled_date, 'YYYY-MM-DD') as scheduled_date,
        t.start_time::text as start_time,
        r.kind as mode,
        r.minutes_before,
        r.remind_time::text as remind_time
      from reminders r
      join tasks t on t.id = r.task_id
      join telegram_settings ts on ts.user_id = t.user_id
      where r.status = 'pending'
        and r.remind_at <= now()
        and ts.chat_id is not null
        and ts.task_reminders = true
        and t.status not in ('done', 'skipped', 'cancelled')
      order by r.remind_at, r.id
      limit $1
    `,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    chatId: row.chat_id,
    title: row.title,
    scheduledDate: row.scheduled_date,
    startTime: row.start_time ? row.start_time.slice(0, 5) : null,
    mode: row.mode,
    minutesBefore: row.minutes_before,
    remindTime: row.remind_time ? row.remind_time.slice(0, 5) : null
  }));
}

export async function markReminderSent(id: number) {
  await query("update reminders set status = 'sent', updated_at = now() where id = $1", [id]);
}

export async function markReminderFailed(id: number, error: string) {
  await query(
    `
      update reminders
      set status = 'failed',
          attempts = attempts + 1,
          last_error = $2,
          updated_at = now()
      where id = $1
    `,
    [id, error.slice(0, 500)]
  );
}
