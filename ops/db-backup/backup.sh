#!/usr/bin/env bash
# Nightly off-platform backup of the production database (runbook:
# docs/operations/db-backups.md).
#
# pg_dump streams through age (encrypted to a public key; the private key never
# reaches Railway or R2) into incoming/ on R2. Only a complete upload above the
# minimum size is promoted to daily/ (and monthly/ on the 1st), and only a
# promotion pings the heartbeat, when HEARTBEAT_URL is set. A failed run leaves nothing in daily/ and
# deletes its incoming/ object; a 1-day lifecycle rule on incoming/ covers the
# case where that delete fails too.
set -euo pipefail

require() {
  local name
  for name in "$@"; do
    # Placeholders in .railway/railway.ts look like "<SET_ME: ...>"; a sealed
    # shared variable that does not exist yet resolves to an empty value.
    # Only the name is printed: some of these are secrets.
    if [[ -z "${!name:-}" || "${!name}" == *"<SET_ME"* ]]; then
      echo "error: $name is not set" >&2
      exit 64
    fi
  done
}

require DATABASE_URL AGE_RECIPIENT R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY
# Optional for now: without it a failed run goes unnoticed (runbook).
heartbeat_url="${HEARTBEAT_URL:-}"

min_bytes="${BACKUP_MIN_BYTES:-10240}"

# rclone reads its "r2" remote from the environment. The token is scoped to
# one bucket and cannot create it, hence no_check_bucket.
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

# Date and time down to the second, so two runs on the same day never share a
# key (a locked object cannot be overwritten).
stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
name="vectra-${stamp}.dump.age"
bucket="r2:${R2_BUCKET}"
incoming="${bucket}/incoming/${name}"

fail() {
  echo "error: $1" >&2
  # Best effort: the lifecycle rule on incoming/ is the fallback.
  rclone deletefile "$incoming" || echo "warning: could not delete $incoming" >&2
  exit 1
}

echo "dumping to $incoming"
if ! pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" |
  age --encrypt --recipient "$AGE_RECIPIENT" |
  rclone rcat "$incoming"; then
  fail "dump, encryption or upload failed"
fi

size="$(rclone lsf --format s "$incoming")" || fail "could not read the size of $incoming"
if [[ ! "$size" =~ ^[0-9]+$ ]] || ((size < min_bytes)); then
  fail "uploaded object is ${size:-0} bytes, below the ${min_bytes}-byte minimum"
fi

rclone copyto "$incoming" "${bucket}/daily/${name}" || fail "promotion to daily/ failed"
if [[ "${stamp:8:2}" == "01" ]]; then
  rclone copyto "$incoming" "${bucket}/monthly/${name}" || fail "promotion to monthly/ failed"
fi
rclone deletefile "$incoming" || echo "warning: promoted, but could not delete $incoming" >&2

echo "backup ${name} promoted (${size} bytes)"
if [[ -n "$heartbeat_url" ]]; then
  # HEARTBEAT_URL is a secret: curl's errors name the host, never the full URL.
  curl -fsS --max-time 10 --retry 3 --output /dev/null "$heartbeat_url"
else
  echo "warning: HEARTBEAT_URL is not set; no heartbeat sent" >&2
fi
