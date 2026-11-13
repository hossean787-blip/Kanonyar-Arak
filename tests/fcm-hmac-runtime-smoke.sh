#!/usr/bin/env bash
# Test the ACTUAL Deno Edge Function handler, with test-only in-memory credentials.
# No connection to Supabase or Firebase is made; valid HMAC reaches the safe 503 gate.
set -euo pipefail
export SUPABASE_URL="https://unit-test.invalid"
export SUPABASE_SERVICE_ROLE_KEY="qa_only_server_role_credential_not_real_001"
export KANONHA_FCM_WEBHOOK_HMAC_SECRET="qa_only_hmac_secret_not_real_32_characters_minimum"
unset KANONHA_FIREBASE_SERVICE_ACCOUNT_JSON
deno run --allow-env --allow-net=0.0.0.0:8000,127.0.0.1:8000 supabase/functions/kanonha-fcm-delivery/index.ts >/tmp/kanonha-hmac-deno.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  if curl --silent --max-time 2 -o /dev/null http://127.0.0.1:8000/; then break; fi
  sleep 1
done
kill -0 "$server_pid"
export ID="11111111-1111-4111-8111-111111111111"
export TS="$(date +%s)"
BODY='{"type":"INSERT","schema":"public","table":"kanonha_notification_deliveries","record":{"id":"11111111-1111-4111-8111-111111111111"}}'
sign() {
  node -e 'const c=require("crypto");process.stdout.write(c.createHmac("sha256",process.env.KANONHA_FCM_WEBHOOK_HMAC_SECRET).update(process.env.ID+":"+process.env.TS).digest("hex"))'
}
SIGNATURE="$(sign)"
status=$(curl --silent --show-error --max-time 10 -o /tmp/hmac-valid.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H "x-kanonha-timestamp: $TS" -H "x-kanonha-signature: $SIGNATURE" -d "$BODY" http://127.0.0.1:8000/)
test "$status" = 503
grep -q '"firebase_not_configured"' /tmp/hmac-valid.json
status=$(curl --silent --show-error --max-time 10 -o /tmp/hmac-forged.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H "x-kanonha-timestamp: $TS" -H "x-kanonha-signature: 0000000000000000000000000000000000000000000000000000000000000000" -d "$BODY" http://127.0.0.1:8000/)
test "$status" = 401
grep -q '"unauthorized"' /tmp/hmac-forged.json
export TS="$((TS-360))"
SIGNATURE="$(sign)"
status=$(curl --silent --show-error --max-time 10 -o /tmp/hmac-old.json -w '%{http_code}' -X POST -H "x-kanonha-timestamp: $TS" -H "x-kanonha-signature: $SIGNATURE" -H 'Content-Type: application/json' -d "$BODY" http://127.0.0.1:8000/)
test "$status" = 401
grep -q '"unauthorized"' /tmp/hmac-old.json
status=$(curl --silent --show-error --max-time 10 -o /tmp/hmac-unsigned.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H 'apikey: public-invalid-key' -d "$BODY" http://127.0.0.1:8000/)
test "$status" = 401
grep -q '"unauthorized"' /tmp/hmac-unsigned.json
echo "PASS: real Deno handler accepts valid HMAC, rejects forged/expired/unsigned webhooks"
