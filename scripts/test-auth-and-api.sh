#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3001}"
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

pass=0
fail=0

assert() {
  local name="$1" cond="$2"
  if eval "$cond"; then
    echo "  ✓ $name"
    pass=$((pass + 1))
  else
    echo "  ✗ $name"
    fail=$((fail + 1))
  fi
}

echo "=== GhostTrace API tests ($BASE) ==="

# Health
H=$(curl -s "$BASE/health")
assert "health OK" "echo '$H' | grep -q '\"status\":\"OK\"'"

# Setup status (may already have users)
SS=$(curl -s "$BASE/api/auth/setup-status")
echo "  setup-status: $SS"

# Fresh setup test only if needsSetup
NEEDS=$(echo "$SS" | grep -o '"needsSetup":[^,}]*' | cut -d: -f2)
if [ "$NEEDS" = "true" ]; then
  SETUP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/auth/setup" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@test.local","password":"TestPass123!","name":"Test Admin"}')
  assert "setup creates admin" "echo '$SETUP' | grep -q '\"success\":true'"
else
  LOGIN=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@test.local","password":"TestPass123!"}')
  if echo "$LOGIN" | grep -q '"success":true'; then
    assert "login with test admin" true
  else
    echo "  (creating admin via setup with alternate email if needed)"
    curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/auth/login" \
      -H 'Content-Type: application/json' \
      -d '{"email":"admin@localhost","password":"AdminPass123!"}' | grep -q success && assert "login default admin" true || {
      # try setup with known creds from prior run
      curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/auth/login" \
        -H 'Content-Type: application/json' \
        -d '{"email":"admin@test.local","password":"TestPass123!"}' > /dev/null
    }
  fi
fi

ME=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/auth/me")
assert "authenticated session" "echo '$ME' | grep -q '\"authenticated\":true'"

# Protected SOC endpoints
for path in /api/soc/command-center /api/alerts /api/incidents /api/policies /api/audit; do
  R=$(curl -s -o /dev/null -w '%{http_code}' -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE$path")
  assert "$path returns 200" "[ '$R' = '200' ]"
done

# Unauthenticated blocked
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/alerts")
assert "alerts blocked without auth" "[ '$CODE' = '401' ] || [ '$CODE' = '403' ]"

# Admin user management
USERS=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/auth/users" \
  -H 'Content-Type: application/json' \
  -d '{"email":"analyst@test.local","password":"AnalystPass1","name":"Test Analyst","role":"analyst"}')
assert "create analyst user" "echo '$USERS' | grep -q '\"success\":true'"

LIST=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/auth/users")
assert "list users" "echo '$LIST' | grep -q 'analyst@test.local'"

# Analyst login
COOKIE2=$(mktemp)
curl -s -c "$COOKIE2" -b "$COOKIE2" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"analyst@test.local","password":"AnalystPass1"}' | grep -q success
assert "analyst can login" true

FORBIDDEN=$(curl -s -o /dev/null -w '%{http_code}' -c "$COOKIE2" -b "$COOKIE2" "$BASE/api/auth/users")
assert "analyst cannot list users" "[ '$FORBIDDEN' = '403' ]"
rm -f "$COOKIE2"

# DNA public endpoint
DNA=$(curl -s "$BASE/api/dna")
assert "dna endpoint public" "echo '$DNA' | grep -q '\"success\":true'"

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
