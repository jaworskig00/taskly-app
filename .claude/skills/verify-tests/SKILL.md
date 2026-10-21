---
name: verify-tests
description: Runs the test suites, keeps the working tree within the test-only boundary, and records the result. Use after writing or updating any test, and before reporting anything as done.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(cd frontend*), Bash(cd backend*), Bash(npm run test*), Bash(npm run typecheck*), Bash(npx prettier*), Bash(python -m pytest*), Bash(.venv/bin/python*), Bash(git status*), Bash(git diff*), Bash(git checkout --*), Bash(rm *)
---

# Verify tests

A test that has not been run is a guess. Nothing you wrote is finished until
this skill has run it and the result is recorded.

## 1. Stay inside the boundary

Before and after running anything:

```bash
git status --porcelain
```

Every path must match one of:

- `frontend/src/**/*.test.ts`, `frontend/src/**/*.test.tsx`
- `frontend/src/test/**`
- `backend/tests/**`

Anything else — application code, configuration, workflows, agent or skill
definitions — must be reverted immediately with `git checkout -- <path>` (or
deleted if untracked), and recorded in the report as an out-of-scope edit. Do
not argue with this boundary; the workflow enforces it again and a run that
trips it is wasted.

Files under `.agent-tmp/` are ignored by git and are not part of this check.

## 2. Run the suites you touched

**Frontend**, from `frontend/`:

```bash
npx prettier --write <the test files you wrote>
npm run typecheck
npm run test
```

Format first: CI runs `format:check` and will fail on an unformatted test even
if the test itself is correct.

**Backend**, from `backend/`:

```bash
python -m pytest        # locally: .venv/bin/python -m pytest
```

Run the whole suite of the side you touched, not only your new file. A test that
passes alone and breaks its neighbours is a net loss, and that usually shows up
as shared state or a leaked environment variable.

Run both sides when the change spans both.

## 3. When something fails

Read the failure before changing anything, and decide which of these it is:

- **The test is wrong** — a bad assertion, the wrong query, a missing `await`,
  a mock that does not match the real signature. Fix the test.
- **The test is right and the code is broken** — you have found a real defect.
  **Do not fix the code.** Report it: the file, the failing assertion, and what
  the correct behaviour appears to be. That finding is worth more than the test.
- **The test cannot work here** — it needs a database, a network call, a
  dependency that is not installed, or real timers. Delete it and report the gap.

You get **two** fix attempts per test file. After that, delete the file and
report it as not delivered. Never weaken an assertion, never add `skip`, and
never leave a failing test in the tree.

## 4. Record the result

Write `.agent-tmp/verification.json`:

```json
{
  "frontend": { "ran": true, "passed": true, "tests": 24, "files": 16, "command": "npm run test" },
  "backend": { "ran": true, "passed": true, "tests": 31, "command": "python -m pytest" },
  "out_of_scope_edits": [],
  "abandoned": [{ "test_path": "...", "reason": "..." }],
  "defects_found": []
}
```

Take the numbers from the runner output; do not estimate them.

## 5. Coverage, when asked for a report

```bash
cd frontend && npm run test:coverage
cd backend && python -m pytest --cov=app --cov-report=json --cov-report=term-missing
```

That writes `frontend/coverage/coverage-summary.json` and
`backend/coverage/coverage.json`, which `report-test-results` reads for the
before-and-after table. Both paths are git-ignored.
