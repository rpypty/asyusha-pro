# Asysha Pro

Personal planning and productivity PWA.

## Stack

- Frontend: React, TypeScript, Vite, PWA
- Backend: Node.js, TypeScript, Fastify
- Database target: PostgreSQL
- Package manager: pnpm

## Project structure

```txt
apps/
  api/  Fastify API service
  web/  React PWA client
```

## Local development

```bash
pnpm install
pnpm db:up
pnpm dev
```

Run services separately:

```bash
pnpm --filter @asysha-pro/web dev
pnpm --filter @asysha-pro/api dev
```

Default ports:

- Web: http://localhost:5173
- API: http://localhost:4000
- Postgres: 127.0.0.1:5432

The API creates the database schema and demo data on startup.

If `pnpm dev` fails with `ECONNREFUSED 127.0.0.1:5432`, PostgreSQL is not running.
