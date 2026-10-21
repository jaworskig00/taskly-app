#!/usr/bin/env bash
# Enforces the one rule the agent must not break: it may only add or change
# tests. Anything else in the working tree is reverted here, by the workflow,
# without asking the agent to cooperate. Model-level permissions are a useful
# first layer, but this is the layer that is actually enforced.
#
# Reverting means restoring a tracked file to its committed content and deleting
# an untracked one, so a file the agent created outside the boundary disappears.
set -euo pipefail

ALLOWED='^(frontend/src/.*\.test\.tsx?|frontend/src/test/.*|backend/tests/.*)$'
REPORT="${1:-.agent-tmp/out-of-scope.txt}"

mkdir -p "$(dirname "$REPORT")"
: > "$REPORT"

while IFS= read -r line; do
  [ -n "$line" ] || continue
  status="${line:0:2}"
  path="${line:3}"
  # Rename entries look like "R  old -> new"; the new path is what exists now.
  case "$status" in R*) path="${path##* -> }" ;; esac
  # git quotes paths containing unusual characters.
  case "$path" in \"*\") path="$(printf '%b' "${path:1:${#path}-2}")" ;; esac

  if printf '%s' "$path" | grep -Eq "$ALLOWED"; then
    continue
  fi

  printf '%s\n' "$path" >> "$REPORT"
  if git cat-file -e "HEAD:$path" 2>/dev/null; then
    git checkout -q HEAD -- "$path"
  else
    git reset -q -- "$path" 2>/dev/null || true
    rm -rf -- "$path"
  fi
done < <(git status --porcelain)

count="$(wc -l < "$REPORT" | tr -d ' ')"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "out_of_scope_count=$count" >> "$GITHUB_OUTPUT"
fi

if [ "$count" -gt 0 ]; then
  echo "Reverted $count path(s) outside the test boundary:" >&2
  cat "$REPORT" >&2
else
  echo "Working tree stayed inside the test boundary."
fi
