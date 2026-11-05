#!/usr/bin/env bash
# Smoke test: usage  scripts/smoke.sh https://your-api.onrender.com
set -euo pipefail
API="${1:?usage: smoke.sh <api-base-url, no trailing slash>}"
EMAIL="${SMOKE_EMAIL:-learner1@example.com}"
PASSWORD="${SMOKE_PASSWORD:-Password@123}"

echo "1/3 health (free tier may need up to 5 minutes to wake up)"
ok=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 20 "$API/api/health" >/dev/null 2>&1; then ok=1; break; fi
  echo "  attempt $i/30 not ready, waiting 10s"; sleep 10
done
[ "$ok" = 1 ] || { echo "FAIL: health check never succeeded"; exit 1; }
echo "  PASS"

echo "2/3 login"
resp=$(curl -fsS --max-time 30 -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}") \
  || { echo "FAIL: login request failed"; exit 1; }
token=$(printf '%s' "$resp" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$token" ] || { echo "FAIL: no token in login response"; exit 1; }
echo "  PASS"

echo "3/3 authenticated slots request"
curl -fsS --max-time 30 "$API/api/slots" -H "Authorization: Bearer $token" >/dev/null \
  || { echo "FAIL: GET /api/slots failed"; exit 1; }
echo "  PASS"
echo "SMOKE TEST PASSED"