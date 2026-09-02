#!/usr/bin/env bash
set -euo pipefail
cd /home/user/xaman/.claude/worktrees/agent-a76ce0f66d597c0e9
ADMIN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DB="${1:-xaman_test}"
psql "$ADMIN" -q -v ON_ERROR_STOP=1 -c "drop database if exists $DB with (force);" -c "create database $DB;"
URL="postgresql://postgres:postgres@127.0.0.1:54322/$DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/support/supabase-shim.sql 2>&1 | grep -v "wal_level\|Set wal_level" || true
for f in supabase/migrations/*.sql; do
  echo "applying $f"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f"
done
if [ -f supabase/seed.sql ]; then echo "applying supabase/seed.sql"; psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/seed.sql; fi
echo "db $DB ready: $URL"
