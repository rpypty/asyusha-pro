# Tasks

## Foundation

- [x] Initialize monorepo.
- [x] Create React/Vite/PWA frontend.
- [x] Create Fastify backend.
- [x] Implement visual prototype from supplied design.
- [x] Install Playwright.
- [x] Add initial Playwright e2e tests.
- [x] Add Docker Compose for local services.
- [x] Add `.env.example` at project root.
- [ ] Add shared package for DTOs and constants.

## Database

- [x] Install PostgreSQL driver.
- [x] Add database config.
- [x] Add schema auto-initialization.
- [x] Define `users`.
- [x] Define `sessions`.
- [x] Define `tasks`.
- [x] Define `tags`.
- [x] Define `task_tags`.
- [x] Define `day_entries`.
- [x] Define `reflections`.
- [x] Store productivity scores in day/reflection records.
- [x] Define `telegram_settings`.
- [x] Define `reminders`.
- [x] Add seed script with demo data matching the current UI.

## Backend API

- [x] Add auth plugin/middleware.
- [x] Add password hashing.
- [x] Add register endpoint.
- [x] Add login endpoint.
- [x] Add logout endpoint.
- [x] Add current user endpoint.
- [x] Add task CRUD endpoints.
- [x] Add task status update endpoint.
- [x] Add task move/reschedule endpoint.
- [x] Add tag read endpoints.
- [x] Add day entry endpoints.
- [x] Add reflection endpoints.
- [x] Add productivity score persistence.
- [x] Add calendar summary endpoints for week/month.
- [x] Add history endpoint.
- [x] Add Telegram settings/link-token endpoint.
- [x] Add Telegram webhook or polling handler.
- [x] Persist multiple reminder jobs through task create/update.
- [x] Add validation for current product requests.
- [ ] Add API tests.

## Frontend Product Flows

- [x] Add app routing.
- [x] Add API client.
- [x] Add auth screens.
- [x] Add protected app shell.
- [x] Replace mock tasks with API data.
- [x] Implement create task flow.
- [x] Implement edit task flow.
- [x] Implement complete task flow.
- [ ] Implement skip/cancel task flow.
- [x] Implement move task to another date/time for new tasks.
- [x] Implement priority selector.
- [x] Implement tag picker.
- [x] Implement day note input.
- [x] Implement productivity score persistence.
- [x] Implement evening questionnaire persistence.
- [x] Implement week view from real summaries.
- [x] Implement month view from real summaries.
- [ ] Implement history filters.
- [x] Implement Telegram settings connection state.
- [x] Add loading and error states.
- [ ] Add optimistic updates where safe.

## Telegram

- [x] Create Telegram bot.
- [x] Store bot token in backend env only.
- [x] Generate account-link token.
- [x] Process `/start <token>`.
- [x] Store Telegram chat id.
- [x] Send task reminder.
- [ ] Send morning digest.
- [ ] Send evening questionnaire reminder.
- [ ] Retry failed notifications with backoff.
- [x] Log reminder delivery status.

## PWA

- [ ] Replace temporary SVG icon with production icon set.
- [ ] Add maskable icons.
- [ ] Verify manifest on mobile.
- [ ] Add offline fallback.
- [ ] Cache app shell.
- [ ] Cache last-known user data.
- [ ] Add update available UX.

## Quality

- [x] Run `pnpm typecheck` locally.
- [x] Run `pnpm lint` locally.
- [x] Run `pnpm build` locally.
- [ ] Run `pnpm test:e2e` locally after sandbox allows Postgres/browser access again.
- [ ] Add Playwright screenshots for day, week, month, stats.
- [ ] Add mobile viewport tests.
- [ ] Add desktop viewport tests.
- [ ] Add accessibility smoke checks.
- [ ] Add API integration tests.

## Release

- [ ] Document local setup.
- [ ] Document environment variables.
- [ ] Document Telegram bot setup.
- [ ] Document migration commands.
- [ ] Prepare deployment target.
- [ ] Configure production database.
- [ ] Configure HTTPS.
- [ ] Configure backup strategy.
- [ ] Smoke-test production build.
