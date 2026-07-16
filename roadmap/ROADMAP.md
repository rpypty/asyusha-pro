# Roadmap

## Phase 0 - Foundation Stabilization

Goal: keep the project reliable while moving from prototype to product.

Status: in progress.

Deliverables:

- Monorepo structure.
- Frontend and backend build/lint/typecheck.
- Playwright e2e setup.
- PWA shell.
- Design prototype implemented as React components.

Exit criteria:

- `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm test:e2e` pass.
- The current prototype is usable as the UI baseline.

## Phase 1 - Domain Model and Database

Goal: introduce real persistence.

Deliverables:

- PostgreSQL setup via Docker Compose.
- Drizzle schema and migrations.
- Tables for users, sessions, tasks, tags, task-tags, day entries, reflections, productivity scores, Telegram connections, and reminders.
- Seed script for local demo data.

Exit criteria:

- API can create/read/update/delete core entities in database-backed tests.
- No product screen depends on hardcoded task data as the final source of truth.

## Phase 2 - Auth and API

Goal: create a secure single-user-ready backend.

Deliverables:

- Register/login/logout endpoints.
- Password hashing.
- Session or JWT auth.
- Current user endpoint.
- CRUD endpoints for tasks, tags, day entries, reflections, and productivity scores.
- Request validation with shared DTOs.
- Error response convention.

Exit criteria:

- Frontend can authenticate and fetch user-owned data only.
- API rejects unauthorized access.

## Phase 3 - Frontend Data Integration

Goal: replace local mocks with real API data.

Deliverables:

- API client layer.
- Query/mutation state.
- Loading, empty, error, and optimistic update states.
- Real task creation, editing, completion, skipping, cancellation, and moving.
- Real tag assignment.

Exit criteria:

- Refreshing the page keeps data.
- Day screen works from API data.

## Phase 4 - Calendar Planning

Goal: make planning across dates actually work.

Deliverables:

- Date routing/state for selected day.
- Week range calculation.
- Month calendar calculation.
- Navigation between days/weeks/months.
- Scheduling tasks for future and past dates.
- History filters by date, priority, status, and tag.

Exit criteria:

- User can plan any date and later return to it.
- Week and month views summarize real task completion.

## Phase 5 - Reflection and Productivity

Goal: complete the personal experience layer.

Deliverables:

- Daily note input.
- Evening questionnaire persistence.
- Productivity score persistence.
- Daily tags.
- Stats for week/month.
- History cards with notes, task results, score, and reflection status.

Exit criteria:

- User can fill, edit, and review daily reflections.
- Stats match persisted task and score data.

## Phase 6 - Telegram Reminders

Goal: make reminders real.

Status: partially implemented. Task reminders can be linked and delivered through Telegram polling; production webhook mode, daily digests, and retry backoff remain.

Deliverables:

- Telegram bot token configuration.
- Bot `/start <token>` linking flow.
- Telegram connection table.
- Reminder scheduling model.
- Worker that sends due reminders.
- Retry logic for failed reminders.
- Notification settings screen wired to backend.

Exit criteria:

- User receives Telegram reminders for scheduled tasks.
- Morning digest and evening questionnaire reminders can be enabled/disabled.

## Phase 7 - PWA and Offline Polish

Goal: make the app phone-ready.

Deliverables:

- PWA icons and manifest polish.
- Install flow verification.
- Service worker strategy.
- Offline shell.
- Last-known data cache.
- Sync strategy after reconnect.

Exit criteria:

- App can be installed on mobile.
- App opens offline with useful fallback state.

## Phase 8 - QA and Release

Goal: make the MVP shippable.

Deliverables:

- Playwright coverage for core flows.
- Visual checks for mobile and desktop.
- API integration tests.
- Environment documentation.
- Deployment plan.
- Production config checklist.

Exit criteria:

- MVP acceptance from `CONTEXT.md` is satisfied.
- No known blocker remains for daily personal use.
