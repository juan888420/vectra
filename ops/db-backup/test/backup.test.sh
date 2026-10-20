#!/usr/bin/env bash
# Runs backup.sh against stubbed pg_dump, age, rclone and curl. The rclone stub
# keeps "remote" objects in a temporary directory, so each case can assert what
# ended up in incoming/ and daily/ and whether the heartbeat was pinged.
# CI runs it inside the backup image (.github/workflows/ci.yml, job `image`).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${BACKUP_SCRIPT:-$here/../backup.sh}"
original_path="$PATH"
failures=0

setup() {
  work="$(mktemp -d)"
  mkdir -p "$work/bin" "$work/store"

  # Emits STUB_DUMP_BYTES bytes, then exits with STUB_DUMP_EXIT: a non-zero
  # exit after some output is a dump that fails halfway through the pipe.
  cat >"$work/bin/pg_dump" <<'EOF'
#!/usr/bin/env bash
head -c "$STUB_DUMP_BYTES" /dev/zero
exit "${STUB_DUMP_EXIT:-0}"
EOF

  cat >"$work/bin/age" <<'EOF'
#!/usr/bin/env bash
cat
EOF

  cat >"$work/bin/rclone" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "rclone $*" >>"$STUB_LOG"
local_path() { echo "$STUB_STORE/${1#r2:}"; }
case "$1" in
  rcat) mkdir -p "$(dirname "$(local_path "$2")")"; cat >"$(local_path "$2")" ;;
  lsf) f="$(local_path "${*: -1}")"; [[ -f "$f" ]] && wc -c <"$f" | tr -d ' ' ;;
  copyto) mkdir -p "$(dirname "$(local_path "$3")")"; cp "$(local_path "$2")" "$(local_path "$3")" ;;
  deletefile) rm "$(local_path "$2")" ;;
  *) echo "unexpected rclone command: $1" >&2; exit 2 ;;
esac
EOF

  cat >"$work/bin/curl" <<'EOF'
#!/usr/bin/env bash
echo "curl $*" >>"$STUB_LOG"
EOF

  chmod +x "$work/bin/"*
  : >"$work/calls.log"
}

run_backup() {
  local status=0
  env PATH="$work/bin:$original_path" STUB_LOG="$work/calls.log" STUB_STORE="$work/store" \
    DATABASE_URL=postgresql://stub/db AGE_RECIPIENT=age1stub R2_ENDPOINT=https://r2.invalid \
    R2_BUCKET=bucket R2_ACCESS_KEY_ID=stub-id R2_SECRET_ACCESS_KEY=stub-secret \
    HEARTBEAT_URL=https://heartbeat.invalid/ping \
    "$@" bash "$script" >"$work/output.log" 2>&1 || status=$?
  echo "$status"
}

objects_in() { find "$work/store/bucket/$1" -type f 2>/dev/null | wc -l | tr -d ' '; }
pinged() { grep -q '^curl ' "$work/calls.log"; }
cleanup_attempted() { grep -q '^rclone deletefile r2:bucket/incoming/' "$work/calls.log"; }

check() {
  local description="$1"
  shift
  if "$@"; then
    echo "  ok: $description"
  else
    echo "  FAIL: $description"
    failures=$((failures + 1))
  fi
}

echo "pg_dump fails halfway through the pipe"
setup
status="$(run_backup STUB_DUMP_BYTES=20480 STUB_DUMP_EXIT=1)"
check "exits with an error" test "$status" -ne 0
check "promotes nothing to daily/" test "$(objects_in daily)" -eq 0
check "does not ping the heartbeat" eval '! pinged'
check "tries to delete the incoming/ object" cleanup_attempted
check "leaves nothing in incoming/" test "$(objects_in incoming)" -eq 0

echo "uploaded object below the minimum size"
setup
status="$(run_backup STUB_DUMP_BYTES=100)"
check "exits with an error" test "$status" -ne 0
check "promotes nothing to daily/" test "$(objects_in daily)" -eq 0
check "does not ping the heartbeat" eval '! pinged'
check "tries to delete the incoming/ object" cleanup_attempted

echo "successful run"
setup
status="$(run_backup STUB_DUMP_BYTES=20480)"
check "exits successfully" test "$status" -eq 0
check "promotes one object to daily/" test "$(objects_in daily)" -eq 1
check "leaves nothing in incoming/" test "$(objects_in incoming)" -eq 0
check "pings the heartbeat once" test "$(grep -c '^curl .*https://heartbeat.invalid/ping' "$work/calls.log")" -eq 1

echo "successful run without a heartbeat URL"
setup
status="$(run_backup STUB_DUMP_BYTES=20480 HEARTBEAT_URL=)"
check "exits successfully" test "$status" -eq 0
check "promotes one object to daily/" test "$(objects_in daily)" -eq 1
check "does not call curl" eval '! pinged'

if ((failures > 0)); then
  echo "$failures check(s) failed; output of the last run:"
  cat "$work/output.log"
  exit 1
fi
echo "all checks passed"
