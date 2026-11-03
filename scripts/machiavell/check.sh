#!/usr/bin/env bash
# Builds the Pages Functions and runs the API smoke test against a throwaway local D1 database.
# Uses test values only; the real passphrase never leaves Cloudflare.  Usage: scripts/machiavell/check.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
WRANGLER="${WRANGLER:-npx --yes wrangler@4.150.0}"
STATE="$(mktemp -d)"
PORT="${PORT:-8788}"
trap 'kill "${DEV_PID:-}" 2>/dev/null || true; rm -rf "$STATE" "$STATE.out"; [ -n "${MADE_VARS:-}" ] && rm -f .dev.vars' EXIT

echo "== build functions"
$WRANGLER pages functions build --outdir="$STATE/fn" >/dev/null

echo "== local database"
$WRANGLER d1 execute DB --local --persist-to="$STATE/d1" --file=scripts/machiavell/schema.sql >/dev/null
$WRANGLER d1 execute DB --local --persist-to="$STATE/d1" --file=scripts/machiavell/seed-placeholder.sql >/dev/null

if [ ! -f .dev.vars ]; then
  printf 'PASSPHRASE=test phrase\nSESSION_SECRET=local-check-only-not-a-real-secret-0123456789\n' > .dev.vars
  MADE_VARS=1
fi

echo "== serve on :$PORT"
$WRANGLER pages dev . --port "$PORT" --ip 127.0.0.1 --persist-to="$STATE/d1" --show-interactive-dev-session=false >"$STATE.out" 2>&1 &
DEV_PID=$!
for _ in $(seq 60); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/machiavell/" && break
  sleep 1
done

echo "== smoke test"
node scripts/machiavell/smoke.mjs "http://127.0.0.1:$PORT" "$(sed -n 's/^PASSPHRASE=//p' .dev.vars)" || { cat "$STATE.out"; exit 1; }
