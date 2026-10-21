#!/usr/bin/env bash
# Prints the application files a pull request changed — the ones a unit test
# could plausibly cover. The filter mirrors what the project's own coverage
# configuration already excludes, so the two cannot drift apart silently.
set -euo pipefail

BASE_REF="${1:?usage: changed-code.sh <base-ref>}"

git diff --name-only --diff-filter=ACMR "origin/$BASE_REF...HEAD" \
  | grep -E '^(frontend/src/.*\.(ts|tsx)|backend/app/.*\.py)$' \
  | grep -vE '\.test\.tsx?$' \
  | grep -vE '\.stories\.tsx$' \
  | grep -vE '\.(styles|variants|types)\.ts$' \
  | grep -vE '(^|/)(types|index)\.ts$' \
  | grep -vE '^frontend/src/(main\.tsx|test/)' \
  | grep -vE '^frontend/src/design-system/' \
  | grep -vE '(^|/)__init__\.py$' \
  | grep -vE '^backend/app/(main\.py$|.*/(schemas|models)\.py$)' \
  || true
