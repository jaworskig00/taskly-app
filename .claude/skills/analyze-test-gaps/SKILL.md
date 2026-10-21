---
name: analyze-test-gaps
description: Decides which changed or uncovered files need unit tests and returns a structured plan. Use at the start of a pull request review for test coverage, before writing any test, or when asked which parts of the codebase are missing tests.
allowed-tools: Read, Grep, Glob
context: fork
agent: test-triage
background: false
---

# Analyze test gaps

Produce a plan saying which files need a unit test created or updated, and which
do not. Return the JSON described in the `test-triage` agent definition as your
final message — nothing else, no prose around it.

## Inputs

Read whichever of these exist. None of them are required; say in `notes` which
ones were missing and decide from what you have.

| Path | What it gives you |
| --- | --- |
| `.agent-tmp/changed-files.txt` | One changed path per line. Absent in backfill mode, where the whole repository is in scope. |
| `.agent-tmp/pr-diff.patch` | The diff itself, for judging **what** changed inside a file. |
| `frontend/coverage/coverage-summary.json` | Per-file frontend coverage. |
| `backend/coverage/coverage.json` | Per-file backend coverage. |

In backfill mode, drive the plan from the coverage reports: anything with
uncovered lines is a candidate, lowest coverage first.

## Procedure

1. Read `frontend/vite.config.ts` (`test.coverage.exclude`) and
   `backend/pyproject.toml` (`[tool.coverage.run] omit`). **These are the
   project's own statements about what is not measured — honour them rather than
   any list you carry in your head.** Anything they exclude goes to `skipped`.
2. Drop the rest of the never-test set in `references/selection-rules.md`.
3. For every surviving file, work out whether a test file already exists, using
   the path conventions in the same reference. Existing file means `update`,
   otherwise `create`.
4. When a diff is available, judge the change itself: a renamed variable or a
   reordered import needs nothing, a new branch, a new error path or a changed
   contract does. Put that judgement in `reason`.
5. Order by how much untested behaviour the change introduces: new logic with no
   test at all first, a new branch in a partly covered file next, cosmetic last.

## Calibration

The cost of a wrong answer is asymmetric. A missing test is a gap someone can
see in the coverage report. A pointless test is permanent drag: it runs forever,
it breaks on harmless refactors, and it makes the suite less trusted. **When a
change does not need a test, say so.** An empty plan is a good outcome on a
dependency bump, a styling change or a documentation edit.
