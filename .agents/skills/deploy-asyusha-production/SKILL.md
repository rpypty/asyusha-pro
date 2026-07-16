---
name: deploy-asyusha-production
description: Safely publish Asyusha Pro to its production VPS from the main branch. Use when the user says "залей на прод", "задеплой", "выкати в прод", "обнови прод", or otherwise asks to release the current project to asyusha.space. The workflow verifies local changes, tests them, commits and pushes the intended revision, pulls that exact revision on the VPS, backs up PostgreSQL, applies migrations when present, updates Docker Compose services, and checks both the new site and the unrelated fmapp.site.
---

# Deploy Asyusha Production

## Overview

Deploy only this repository to the production VPS. The application is served at `https://asyusha.space`; `https://fmapp.site` is a separate production site on the same server and must remain healthy. Connect with `ssh asyusha` when available, otherwise use `ssh fmapp`. The repository lives at `/root/Repos/asyusha-pro` on the VPS.

The user is not expected to know Git, Docker, migrations, or server administration. Carry the workflow through to a verified result unless a safety check fails.

## Workflow

1. Read `AGENTS.md`, inspect `git status`, `git diff`, and the recent log. Identify all intended local changes. Do not include secrets, `.env.production`, database dumps, unrelated edits, or generated artifacts in a commit.
2. Review database changes before deploying. The current schema bootstrap in `apps/api/src/schema.ts` is idempotent and runs when the API starts. For a data migration or a change that is not safely handled at startup, add an idempotent executable `deploy/migrate.sh`. If migration order, compatibility, or reversibility is uncertain, stop before production and explain the risk.
3. Run checks appropriate to the changes. For normal application changes run `pnpm build`, `pnpm typecheck`, and `pnpm lint`. Always validate production Compose with `docker compose --env-file .env.production.example -f deploy/docker-compose.yml config --quiet` and run `bash -n deploy/deploy.sh`.
4. Inspect the final diff. Commit all intended changes on `main` with a concise message and push them to `origin/main`. Confirm local `HEAD` equals `origin/main`. Never deploy uncommitted or unpushed code.
5. Run `./deploy/deploy.sh` from the repository root. Do not reproduce the deployment steps manually when the script is available.
6. Wait for completion. The script connects to the VPS, verifies the exact pushed commit, pulls with fast-forward only, validates Compose, starts PostgreSQL, creates a pre-deploy dump, builds images, runs `deploy/migrate.sh` when present, updates only the `asyusha-pro` Compose project, and performs health checks.
7. Report the deployed commit, SSH alias used, backup path, container health, and the results for both `https://asyusha.space` and `https://fmapp.site`. If deployment fails, report the failed stage and the previous commit printed by the script.

## Guardrails

- Do not use `rsync` or `scp` for releases. Git is the source of truth.
- Do not use force-push, destructive reset, `docker compose down -v`, global Docker cleanup, or commands that stop/remove unrelated containers.
- Never print or commit `.env.production`, passwords, tokens, cookies, private keys, or database contents.
- Keep the production database in its named Docker volume and make a PostgreSQL dump before changing application containers.
- Do not edit nginx or certificates during an ordinary application deployment.
- Do not automatically roll back after a migration: migrations may be irreversible. Preserve the backup, state the previous commit, and diagnose first.
- Treat a failed build, migration, Compose health check, domain check, or `fmapp.site` check as a failed deployment. Do not claim success until all checks pass.
