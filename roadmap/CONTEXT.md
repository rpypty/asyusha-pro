# Project Context

## Product

Asysha Pro is a personal planning and productivity PWA. The app must help one user plan days, weeks, and months, track task completion, write daily thoughts/reflections, score productivity, view history, and receive Telegram reminders.

The target output is a working web application, installable as a PWA, backed by real persistence and API flows.

## Source Requirements

Primary requirements come from the project brief:

- Daily task planning with quick task input.
- Scheduler for tasks on specific dates and times.
- Day, week, and month views.
- Task status tracking and progress.
- History of planned and completed work.
- Priorities: required, desired, optional.
- Productivity score from 0 to 10.
- Daily thought/insight input.
- Evening reflection questionnaire.
- Tags for tasks and days: gym, work, health, relationships, study, finance, rest, etc.
- Telegram reminders for task events and daily routines.
- Mobile-first PWA with desktop adaptation.

The attached design archive defines the visual direction:

- iOS-like mobile shell.
- Soft light background.
- White cards with subtle shadows.
- Compact task timeline.
- Colored tag chips.
- Day/week/month/stats navigation.
- Reflection and Telegram notification screens.

## Current State

Implemented:

- Monorepo scaffold with `apps/web` and `apps/api`.
- Frontend: React, TypeScript, Vite, PWA plugin.
- Backend: Fastify, TypeScript, health route, Postgres-backed product API.
- PostgreSQL schema auto-initialization on API startup.
- Demo seed data in Postgres.
- Mobile-first visual prototype based on the provided design.
- Day, week, month, stats, history, task editor, survey, and Telegram UI screens.
- Frontend task/day/reflection/calendar/history/stat/Telegram flows connected to `/api`.
- Login/register/logout flow with HttpOnly cookie sessions.
- API routes scoped to the authenticated user and protected from anonymous access.
- Backlog tasks without a scheduled date.
- Multiple task reminders: relative to start time and fixed time on task date.
- Telegram Bot API polling worker for `/start <token>` account linking.
- PostgreSQL reminder worker that sends due task reminders and stores delivery state.
- Custom date and time pickers in the task form.
- Playwright installed with Chromium and initial e2e smoke tests.

Not yet implemented:

- Telegram webhook mode for production deployment.
- Morning digest and evening questionnaire Telegram reminders.
- Offline data sync.
- Production-ready validation and error states.

## Stack Decision

Use a TypeScript-first stack:

- Frontend: React + TypeScript + Vite + PWA.
- Backend: Node.js + TypeScript + Fastify.
- Database: PostgreSQL.
- ORM: Drizzle preferred for explicit SQL-shaped schema and migrations.
- Testing: Playwright for e2e and visual verification.
- Telegram: Telegram Bot API from backend only.

Keep the first working version simple. Add Redis/BullMQ only when reminder reliability or scale requires queues beyond a DB polling worker.

## Product Principle

Every UI screen should be backed by a real data flow before the feature is considered complete. Mock data is acceptable only as a temporary prototype state.

## MVP Acceptance

MVP is done when:

- A user can create an account and sign in.
- A user can plan tasks on any date.
- A user can assign time, priority, tags, and reminder settings.
- A user can complete, skip, cancel, and move tasks.
- Day, week, and month views use real persisted data.
- A user can save daily notes and evening questionnaire answers.
- Productivity scores are persisted and shown in stats/history.
- Telegram bot can connect to the account.
- Telegram reminders are sent at the configured time.
- The app installs and opens as a PWA.
- Playwright tests pass for the core flows.
