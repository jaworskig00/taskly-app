Add the unit tests this repository is missing. There is no pull request
here: the coverage reports are the input.

1. Invoke the `analyze-test-gaps` skill in backfill mode. There is no
   `.agent-tmp/changed-files.txt`; drive the plan from
   `.agent-tmp/coverage-before/frontend.json` and
   `.agent-tmp/coverage-before/backend.json`, lowest coverage first.
2. Limit yourself to the {{MAX_FILES}} highest-priority source
   files, on the {{SCOPE}} side.
3. Follow `write-frontend-tests` or `write-backend-tests` for each one, and
   run `verify-tests` after every file.
4. Finish with `report-test-results`, writing `.agent-tmp/report.md`.

Hard constraints:

- Only `frontend/src/**/*.test.ts`, `frontend/src/**/*.test.tsx`,
  `frontend/src/test/**`, `backend/tests/**` and `.agent-tmp/**` may change.
  Anything else is reverted afterwards and reported.
- Never change application code, configuration or workflows, not even to make
  a test pass.
- Do not commit, push or open a pull request. The workflow does that.

Prefer a small number of tests that genuinely pin behaviour over a large
number that assert whatever the code happens to do today.
