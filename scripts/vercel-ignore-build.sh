#!/usr/bin/env bash
#
# Vercel « Ignored Build Step » — exit 1 builds, exit 0 skips (vercel.json, `ignoreCommand`).
#
# Every push to every branch was a deployment, and a deployment is kept until someone deletes
# it: on 14 September, 93 commits left ~55 of them behind and 5,4 Go on the account's Functions
# Storage in a single day. Most of those commits could not change a single pixel of what the
# deployment serves — a decision journalled, a ticket ticked, a test added.
#
# The list below is what a deployment *cannot* show. It is a deny list on purpose, not an allow
# list: a commit that touches anything else — src/, public/, the build config, the lockfile —
# builds. A preview that silently lags behind the branch is the one failure we already paid for
# (see NEXT_PUBLIC_BUILD in next.config.ts), so the doubt always resolves in favour of building.
set -uo pipefail

# Production is what Xav and Emmanuel open; it is never skipped.
[ "${VERCEL_GIT_COMMIT_REF:-}" = "main" ] && exit 1

INERT='^(docs/|tests/|seed/|supabase/migrations/|\.github/|\.claude/|\.design/|scripts/|[^/]*\.md$|\.editorconfig$|\.prettierrc$|\.prettierignore$|\.gitignore$)'

# No parent commit, a shallow clone too short, git unhappy for any reason: build.
changed=$(git diff --name-only HEAD^ HEAD 2>/dev/null) || exit 1
[ -z "$changed" ] && exit 1

if printf '%s\n' "$changed" | grep -qvE "$INERT"; then
  exit 1
fi

printf 'Rien de déployable dans ce commit (%s fichiers) — build ignoré.\n' "$(printf '%s\n' "$changed" | wc -l)"
exit 0
