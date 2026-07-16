#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_DIR="${REMOTE_DIR:-/root/Repos/asyusha-pro}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_HOST="${DEPLOY_HOST:-}"

log() {
  printf '[deploy] %s\n' "$*"
}

fail() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

select_host() {
  if [[ -n "$DEPLOY_HOST" ]]; then
    printf '%s\n' "$DEPLOY_HOST"
    return
  fi

  local candidate
  for candidate in asyusha fmapp; do
    if ssh -o BatchMode=yes -o ConnectTimeout=5 "$candidate" true >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  fail "Neither 'ssh asyusha' nor 'ssh fmapp' is reachable"
}

command -v git >/dev/null || fail "git is not installed"
command -v ssh >/dev/null || fail "ssh is not installed"

cd "$ROOT_DIR"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Run from the project repository"

[[ -z "$(git status --porcelain)" ]] || fail "Local worktree is dirty; commit all intended changes first"

current_branch="$(git branch --show-current)"
[[ "$current_branch" == "$DEPLOY_BRANCH" ]] || fail "Expected branch '$DEPLOY_BRANCH', got '$current_branch'"

log "Checking that $DEPLOY_BRANCH is pushed"
git fetch origin "$DEPLOY_BRANCH"
local_sha="$(git rev-parse HEAD)"
origin_sha="$(git rev-parse "origin/$DEPLOY_BRANCH")"
[[ "$local_sha" == "$origin_sha" ]] || fail "Local HEAD is not equal to origin/$DEPLOY_BRANCH; push before deploy"

DEPLOY_HOST="$(select_host)"
log "Deploying commit $local_sha through ssh $DEPLOY_HOST"

ssh "$DEPLOY_HOST" bash -s -- "$REMOTE_DIR" "$DEPLOY_BRANCH" "$local_sha" <<'REMOTE_SCRIPT'
set -Eeuo pipefail

repo_dir="$1"
branch="$2"
expected_sha="$3"
compose_file="$repo_dir/deploy/docker-compose.yml"
env_file="$repo_dir/.env.production"
previous_sha=""

log() {
  printf '[remote deploy] %s\n' "$*"
}

on_error() {
  exit_code=$?
  printf '[remote deploy] FAILED with exit code %s\n' "$exit_code" >&2
  if [[ -n "$previous_sha" ]]; then
    printf '[remote deploy] Previous commit: %s\n' "$previous_sha" >&2
  fi
  printf '[remote deploy] Automatic rollback is disabled because migrations may be irreversible.\n' >&2
  exit "$exit_code"
}

trap on_error ERR

[[ -d "$repo_dir/.git" ]] || { log "Missing git repository at $repo_dir"; exit 1; }
[[ -f "$env_file" ]] || { log "Missing $env_file"; exit 1; }

cd "$repo_dir"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || { log "Remote worktree has tracked changes"; exit 1; }
[[ "$(git branch --show-current)" == "$branch" ]] || { log "Remote branch is not $branch"; exit 1; }

previous_sha="$(git rev-parse HEAD)"
git fetch origin "$branch"
remote_sha="$(git rev-parse "origin/$branch")"
[[ "$remote_sha" == "$expected_sha" ]] || { log "origin/$branch does not match requested commit"; exit 1; }
git pull --ff-only origin "$branch"
[[ "$(git rev-parse HEAD)" == "$expected_sha" ]] || { log "Pulled commit does not match requested commit"; exit 1; }

[[ -f "$compose_file" ]] || { log "Missing $compose_file"; exit 1; }

compose() {
  docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

compose config --quiet
compose up -d --wait --wait-timeout 120 postgres

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

mkdir -p "$repo_dir/backups"
umask 077
backup_path="$repo_dir/backups/predeploy_$(date -u +%Y%m%dT%H%M%SZ)_${previous_sha:0:12}.dump"
log "Creating PostgreSQL backup: $backup_path"
compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom </dev/null >"$backup_path"
[[ -s "$backup_path" ]] || { log "Backup is empty"; exit 1; }
find "$repo_dir/backups" -maxdepth 1 -type f -name 'predeploy_*.dump' -mtime +14 -delete

log "Building application images"
compose build api web

if [[ -x "$repo_dir/deploy/migrate.sh" ]]; then
  log "Running deploy/migrate.sh"
  export DEPLOY_REPO_DIR="$repo_dir"
  export DEPLOY_COMPOSE_FILE="$compose_file"
  export DEPLOY_ENV_FILE="$env_file"
  "$repo_dir/deploy/migrate.sh"
else
  log "No deploy/migrate.sh; API startup applies the current idempotent schema"
fi

log "Updating the asyusha-pro Compose project"
compose up -d --remove-orphans --wait --wait-timeout 180

curl -fsS "http://127.0.0.1:${WEB_BIND_PORT:-5080}/api/health" >/dev/null
curl -fsS --resolve asyusha.space:443:127.0.0.1 https://asyusha.space/api/health >/dev/null
curl -fsS --resolve fmapp.site:443:127.0.0.1 https://fmapp.site/ >/dev/null

compose ps
log "Deployment completed: $expected_sha"
log "Backup created: $backup_path"
REMOTE_SCRIPT

log "Production deploy completed successfully"
