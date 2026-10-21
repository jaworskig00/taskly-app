#!/usr/bin/env bash
# Turns the coverage snapshots taken around the agent's run into a markdown
# table. Arithmetic belongs in a script, not in a prompt: the model should not
# be asked to read JSON and subtract percentages when `jq` is sitting right here.
set -euo pipefail

DIR="${1:-.agent-tmp}"
BEFORE="$DIR/coverage-before"
AFTER="$DIR/coverage-after"

fe() { jq -r '.total.statements.pct // empty' "$1" 2>/dev/null || true; }
be() { jq -r '(.totals.percent_covered | . * 100 | round / 100) // empty' "$1" 2>/dev/null || true; }

row() {
  local label="$1" before="$2" after="$3"
  [ -n "$before" ] && [ -n "$after" ] || return 0
  local delta
  delta="$(awk -v a="$after" -v b="$before" 'BEGIN { printf "%+.2f", a - b }')"
  printf '| %s | %s%% | %s%% | %s |\n' "$label" "$before" "$after" "$delta"
}

rows="$(
  row 'frontend statements' "$(fe "$BEFORE/frontend.json")" "$(fe "$AFTER/frontend.json")"
  row 'backend statements' "$(be "$BEFORE/backend.json")" "$(be "$AFTER/backend.json")"
)"

[ -n "$rows" ] || exit 0

printf '\n### Coverage\n\n| Scope | Before | After | Change |\n| --- | --- | --- | --- |\n%s\n' "$rows"
