#!/usr/bin/env bash
# Publishes the agent's report as a single pull request comment, updating the
# previous one instead of adding a new comment on every run. The agent itself
# has no GitHub tools: it writes a file, and this script — running with a token
# scoped to one job — publishes it.
set -euo pipefail

BODY_FILE="${1:?usage: post-sticky-comment.sh <body-file> <pr-number>}"
PR_NUMBER="${2:?usage: post-sticky-comment.sh <body-file> <pr-number>}"
MARKER='<!-- taskly-test-agent -->'

if [ ! -s "$BODY_FILE" ]; then
  echo "No report to publish at $BODY_FILE" >&2
  exit 0
fi

if ! head -n 1 "$BODY_FILE" | grep -qF "$MARKER"; then
  printf '%s\n' "$MARKER" | cat - "$BODY_FILE" > "$BODY_FILE.tmp"
  mv "$BODY_FILE.tmp" "$BODY_FILE"
fi

existing="$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" --paginate \
  --jq "[.[] | select(.body | startswith(\"$MARKER\"))] | last | .id // empty")"

if [ -n "$existing" ]; then
  gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$existing" -F "body=@$BODY_FILE" --silent
  echo "Updated comment $existing on PR #$PR_NUMBER"
else
  gh api -X POST "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" -F "body=@$BODY_FILE" --silent
  echo "Posted a new comment on PR #$PR_NUMBER"
fi
