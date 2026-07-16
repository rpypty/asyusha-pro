import { query } from "./db.js";
import { hashPassword } from "./auth.js";

export async function initDb() {
  await query(`
    create table if not exists users (
      id serial primary key,
      email text not null unique,
      username text unique,
      password_hash text,
      display_name text not null,
      timezone text not null default 'Europe/Moscow',
      created_at timestamptz not null default now()
    );

    alter table users add column if not exists username text;
    alter table users add column if not exists password_hash text;
    create unique index if not exists users_username_unique on users(username);

    create table if not exists sessions (
      id serial primary key,
      user_id integer not null references users(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );

    create table if not exists tags (
      id serial primary key,
      user_id integer not null references users(id) on delete cascade,
      name text not null,
      bg text not null,
      fg text not null,
      created_at timestamptz not null default now(),
      unique(user_id, name)
    );

    create table if not exists tasks (
      id serial primary key,
      user_id integer not null references users(id) on delete cascade,
      title text not null,
      description text not null default '',
      scheduled_date date,
      start_time time,
      end_time time,
      priority text not null check (priority in ('must', 'should', 'optional')),
      status text not null check (status in ('planned', 'in_progress', 'done', 'skipped', 'cancelled')) default 'planned',
      reminder_enabled boolean not null default true,
      reminder_minutes_before integer not null default 15,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table tasks alter column scheduled_date drop not null;

    create table if not exists task_tags (
      task_id integer not null references tasks(id) on delete cascade,
      tag_id integer not null references tags(id) on delete cascade,
      primary key (task_id, tag_id)
    );

    create table if not exists day_entries (
      user_id integer not null references users(id) on delete cascade,
      entry_date date not null,
      note text not null default '',
      productivity_score integer check (productivity_score between 0 and 10),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (user_id, entry_date)
    );

    create table if not exists reflections (
      user_id integer not null references users(id) on delete cascade,
      reflection_date date not null,
      grateful text not null default '',
      regret text not null default '',
      went_well text not null default '',
      improve_tomorrow text not null default '',
      insight text not null default '',
      motivation text not null default '',
      better_than_yesterday boolean not null default true,
      productivity_score integer not null check (productivity_score between 0 and 10) default 7,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (user_id, reflection_date)
    );

    create table if not exists telegram_settings (
      user_id integer primary key references users(id) on delete cascade,
      chat_id text,
      link_token text not null unique,
      task_reminders boolean not null default true,
      morning_digest boolean not null default true,
      evening_survey boolean not null default true,
      unfinished_required boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists reminders (
      id serial primary key,
      task_id integer not null references tasks(id) on delete cascade,
      kind text not null default 'before',
      minutes_before integer,
      remind_time time,
      remind_at timestamptz not null,
      status text not null check (status in ('pending', 'sent', 'failed')) default 'pending',
      attempts integer not null default 0,
      last_error text,
      position integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table reminders add column if not exists kind text not null default 'before';
    alter table reminders add column if not exists minutes_before integer;
    alter table reminders add column if not exists remind_time time;
    alter table reminders add column if not exists position integer not null default 0;
    create index if not exists reminders_task_pending_idx on reminders(task_id, status, position);
    create index if not exists reminders_due_idx on reminders(status, remind_at);

    create table if not exists ideas (
      id serial primary key,
      user_id integer not null references users(id) on delete cascade,
      title text not null,
      body text not null default '',
      is_favorite boolean not null default false,
      is_shot boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table ideas add column if not exists is_favorite boolean not null default false;
    alter table ideas add column if not exists is_shot boolean not null default false;

    create table if not exists idea_tags (
      id serial primary key,
      user_id integer not null references users(id) on delete cascade,
      name text not null,
      bg text not null,
      fg text not null,
      created_at timestamptz not null default now(),
      unique(user_id, name)
    );

    create table if not exists idea_tag_links (
      idea_id integer not null references ideas(id) on delete cascade,
      tag_id integer not null references idea_tags(id) on delete cascade,
      primary key (idea_id, tag_id)
    );

    create table if not exists video_posting_days (
      user_id integer not null references users(id) on delete cascade,
      post_date date not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (user_id, post_date)
    );
  `);

  await seedDemoData();
}

async function seedDemoData() {
  const demoPasswordHash = hashPassword("demo12345");
  const user = await query<{ id: number }>(
    `
      insert into users (email, username, password_hash, display_name, timezone)
      values ('demo@asysha.local', 'demo', $1, 'Анастасия', 'Europe/Moscow')
      on conflict (email) do update set
        username = excluded.username,
        password_hash = excluded.password_hash,
        display_name = excluded.display_name
      returning id
    `,
    [demoPasswordHash]
  );
  const userId = user.rows[0]?.id;

  if (!userId) {
    throw new Error("Failed to create demo user");
  }

  const tags = [
    ["Работа", "#e8ecfb", "#4656b8"],
    ["Зал", "#e4f3ec", "#2f8f6b"],
    ["Здоровье", "#e2f1f2", "#2b8a90"],
    ["Учеба", "#efe8fb", "#7150b8"],
    ["Отдых", "#fdf0e2", "#b5772f"],
    ["Отношения", "#fbe8ee", "#b8476a"],
    ["Финансы", "#eef0f4", "#5a6475"]
  ];

  for (const [name, bg, fg] of tags) {
    await query(
      `
        insert into tags (user_id, name, bg, fg)
        values ($1, $2, $3, $4)
        on conflict (user_id, name) do update set bg = excluded.bg, fg = excluded.fg
      `,
      [userId, name, bg, fg]
    );
  }

  const existing = await query<{ count: string }>(
    "select count(*) from tasks where user_id = $1",
    [userId]
  );

  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    return;
  }

  const tasks = [
    ["Тренировка: ноги", "2026-07-06", "07:00", null, "must", "done", ["Зал", "Здоровье"]],
    ["Планерка с командой", "2026-07-06", "09:00", "09:30", "should", "done", ["Работа"]],
    ["Дизайн-ревью экрана дня", "2026-07-06", "11:00", "12:00", "must", "planned", ["Работа"]],
    ["Прочитать 20 страниц", "2026-07-06", "14:00", null, "optional", "planned", ["Учеба"]],
    ["Созвон с Аней", "2026-07-06", "16:30", null, "should", "planned", ["Отношения"]],
    ["Вечерняя прогулка", "2026-07-06", "20:00", null, "optional", "planned", ["Отдых", "Здоровье"]],
    ["Ответить на письма", "2026-07-06", null, null, "should", "planned", ["Работа"]],
    ["Оплатить подписки", "2026-07-06", null, null, "optional", "planned", ["Финансы"]],
    ["Врач", "2026-07-07", "10:00", null, "must", "planned", ["Здоровье"]],
    ["Финансы месяца", "2026-07-08", "18:00", null, "should", "planned", ["Финансы"]],
    ["Кино вечером", "2026-07-10", "20:30", null, "optional", "planned", ["Отдых"]],
    ["Дедлайн по проекту", "2026-07-15", "12:00", null, "must", "planned", ["Работа"]]
  ] as const;

  for (const [title, date, start, end, priority, status, taskTags] of tasks) {
    const created = await query<{ id: number }>(
      `
        insert into tasks
          (user_id, title, scheduled_date, start_time, end_time, priority, status)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id
      `,
      [userId, title, date, start, end, priority, status]
    );
    const taskId = created.rows[0]?.id;

    if (!taskId) {
      continue;
    }

    for (const tagName of taskTags) {
      await query(
        `
          insert into task_tags (task_id, tag_id)
          select $1, id from tags where user_id = $2 and name = $3
          on conflict do nothing
        `,
        [taskId, userId, tagName]
      );
    }
  }

  await query(
    `
      insert into day_entries (user_id, entry_date, note, productivity_score)
      values
        ($1, '2026-07-05', 'Хороший баланс работы и отдыха. Успел закрыть все обязательные дела до обеда.', 8),
        ($1, '2026-07-04', 'День отдыха. Прогулка и чтение - то, что нужно.', 6),
        ($1, '2026-07-03', 'Продуктивный день, закрыл большой блок по проекту.', 9),
        ($1, '2026-07-02', 'Перегрузил день задачами, часть пришлось перенести.', 5)
      on conflict do nothing
    `,
    [userId]
  );

  await query(
    `
      insert into reflections
        (user_id, reflection_date, grateful, regret, went_well, improve_tomorrow, insight, motivation, better_than_yesterday, productivity_score)
      values
        ($1, '2026-07-05', 'За спокойный день', '', 'Закрыл важные задачи', 'Начать раньше', 'Фокус важнее количества', 'Маленькие шаги каждый день', true, 8),
        ($1, '2026-07-04', 'За отдых', '', 'Восстановился', 'Не забывать прогулку', 'Отдых тоже часть системы', 'Беречь темп', true, 6),
        ($1, '2026-07-03', 'За команду', '', 'Сделал большой блок', 'Не перегружать вечер', 'Лучше меньше, но закончить', 'Доводи до конца', true, 9)
      on conflict do nothing
    `,
    [userId]
  );

  await query(
    `
      insert into telegram_settings (user_id, link_token)
      values ($1, 'a8f3-27c1-9de0')
      on conflict (user_id) do nothing
    `,
    [userId]
  );
}
