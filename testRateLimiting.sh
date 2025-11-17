#!/usr/bin/env bash

# Rate Limiting Test Script (Bash)
# Tests CSRF protection and rate limiting against S-Store backend

set -euo pipefail

BASE_URL="http://localhost:5112"
COOKIE_JAR="$(mktemp)"
ATTEMPTS=0
BLOCKED=0
UNAUTHORIZED=0

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

echo "========================================"
echo "S-Store Rate Limiting Test (Bash)"
echo "========================================"
echo ""

# 1. Get CSRF Token
echo "Step 1: Fetching CSRF Token..."

CSRF_RESPONSE=$(curl -sS \
  -X GET \
  -c "$COOKIE_JAR" \
  "$BASE_URL/api/csrf-token")

if ! CSRF=$(echo "$CSRF_RESPONSE" | jq -r '.token' 2>/dev/null); then
  echo "  ✗ Failed to parse CSRF token from response"
  exit 1
fi

if [ -z "$CSRF" ] || [ "$CSRF" = "null" ]; then
  echo "  ✗ CSRF token missing in response"
  exit 1
fi

SHORT_TOKEN="${CSRF:0:20}"

COOKIE_COUNT=$(wc -l < "$COOKIE_JAR" | tr -d ' ')
echo "  ✓ CSRF Token received: ${SHORT_TOKEN}..."
echo "  ✓ Cookies in session: $COOKIE_COUNT"
echo ""

# 2. Test Rate Limiting with correct cookies
echo "Step 2: Testing Rate Limiting (expecting 5 attempts, then block)..."
echo ""

for ATTEMPT_NUM in $(seq 1 7); do
  # 100ms delay between requests
  sleep 0.1

  HTTP_STATUS=0
  RESPONSE_BODY=""

  # Send login request with wrong password, with CSRF header and cookies
  RESPONSE_BODY=$(curl -sS \
    -o >(cat) \
    -w "%{http_code}" \
    -X POST \
    -b "$COOKIE_JAR" \
    -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "X-XSRF-TOKEN: $CSRF" \
    -d '{"username":"testuser","password":"WrongPassword123!","rememberMe":false}' \
    "$BASE_URL/auth/login")

  # Last 3 characters of RESPONSE_BODY are status code (since we used -w "%{http_code}")
  HTTP_STATUS="${RESPONSE_BODY: -3}"
  BODY="${RESPONSE_BODY::-3}"

  ATTEMPTS=$((ATTEMPTS + 1))

  if [ "$HTTP_STATUS" = "429" ]; then
    echo "  Attempt ${ATTEMPT_NUM}: RATE LIMITED (429) ✓✓✓"
    BLOCKED=$((BLOCKED + 1))
  elif [ "$HTTP_STATUS" = "401" ]; then
    echo "  Attempt ${ATTEMPT_NUM}: Unauthorized (Invalid credentials) ✓"
    UNAUTHORIZED=$((UNAUTHORIZED + 1))
  elif [ "$HTTP_STATUS" = "200" ]; then
    # In the PS script, a 200 with error content is printed in yellow
    ERROR_MSG=$(echo "$BODY" | jq -r '.error // empty' 2>/dev/null || true)
    if [ -n "$ERROR_MSG" ]; then
      echo "  Attempt ${ATTEMPT_NUM}: $ERROR_MSG"
    else
      echo "  Attempt ${ATTEMPT_NUM}: 200 OK (unexpected)"
    fi
  else
    echo "  Attempt ${ATTEMPT_NUM}: Error $HTTP_STATUS - $BODY"
  fi
done

echo ""
echo "========================================"
echo "Test Results Summary"
echo "========================================"
echo "Total Attempts:      $ATTEMPTS"
echo "Unauthorized (401):  $UNAUTHORIZED"

if [ "$BLOCKED" -ge 2 ]; then
  COLOR="OK"
else
  COLOR="WARN"
fi

echo "Rate Limited (429):  $BLOCKED ($COLOR)"
echo ""

if [ "$BLOCKED" -ge 2 ] && [ "$UNAUTHORIZED" -ge 4 ]; then
  echo "✓✓✓ RATE LIMITING WORKS PERFECTLY!"
  echo "  • First 4-5 attempts: Invalid credentials (expected)"
  echo "  • After that: Rate limited (expected)"
elif [ "$BLOCKED" -ge 1 ]; then
  echo "✓ Rate limiting is active but may need adjustment"
else
  echo "✗ Rate limiting may not be working correctly"
fi

echo ""
echo "========================================"
echo "CSRF Protection Test"
echo "========================================"
echo ""

# 3. Test CSRF Protection (request without token should fail)
echo "Step 3: Testing CSRF Protection (request without token)..."

RESPONSE_BODY=$(curl -sS \
  -o >(cat) \
  -w "%{http_code}" \
  -X POST \
  -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test","rememberMe":false}' \
  "$BASE_URL/auth/login")

HTTP_STATUS="${RESPONSE_BODY: -3}"
BODY="${RESPONSE_BODY::-3}"

if [ "$HTTP_STATUS" = "400" ]; then
  echo "  ✓✓✓ CSRF PROTECTION WORKS!"
  echo "      Request without token rejected with 400 Bad Request"
else
  echo "  ? Unexpected status code: $HTTP_STATUS"
  echo "    Response: $BODY"
fi

echo ""
echo "========================================"
echo "Test completed!"
echo "========================================"