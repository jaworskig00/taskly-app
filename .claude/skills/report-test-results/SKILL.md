---
name: report-test-results
description: Writes the pull request report describing what the test agent decided, which skills ran, and how the tests performed. Use as the final step of a test-agent run, after verify-tests has recorded a result.
allowed-tools: Read, Grep, Glob, Write, Bash(cd frontend*), Bash(cd backend*)
---

# Report test results

Write the report to `.agent-tmp/report.md`. **Do not try to publish it** — you
have no GitHub tools, by design. The workflow posts the file as a pull request
comment with a token scoped to that one job.

Use `references/report-template.md` as the shape, and keep it in that order so
the comment reads the same on every run.

## Inputs

| Source | What to take from it |
| --- | --- |
| the plan from `analyze-test-gaps` | the decision table: file, action, reason |
| `.agent-tmp/verification.json` | pass or fail, test counts, abandoned files, out-of-scope edits |
| `frontend/coverage/coverage-summary.json`, `backend/coverage/coverage.json` | coverage after |
| `.agent-tmp/coverage-before/` | coverage before, when the workflow captured it |

## How to write it

- **Lead with what happened**, in one sentence someone can read in the PR list:
  how many files got tests, whether the suites pass.
- **Show the decisions, including the skips.** A reviewer needs to see that a
  file was considered and deliberately left alone, with the reason. The skips are
  often the more interesting half.
- **Give real numbers.** Test counts and coverage percentages come from the
  runner and the coverage files, never from memory or estimation.
- **Say what went wrong.** An abandoned test, a defect found in the application
  code, an out-of-scope edit that was reverted — each one goes in the report
  plainly. A report that only ever says everything is fine teaches the reader to
  stop reading it.
- **No marketing.** No praise for the change, no emoji padding, no "great work".
  This is a build artefact, not a compliment.

Keep the whole comment under roughly 60 lines. Detail that does not fit belongs
in the collapsed section at the end.
