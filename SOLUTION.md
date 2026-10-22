# Solution

A custom agent with reusable skills that writes the unit tests a pull request is
missing, runs them, and reports back on the pull request. The same agent and the
same skills also run on demand against code that was already untested.

## Technical decisions

**Claude Code as the agent environment.** Its agents and skills are plain files in
`.claude/`, versioned with the repository, so the same definitions drive a local
session and a GitHub Actions run. Writing a bespoke agent loop against an SDK would
have added code to maintain and lost tool-level permissions, project configuration
restored from the base ref, and a mature sandbox. The brief leaves the environment
open; this choice makes "reusable skills" a property of the repository rather than
of a prompt.

**Two agents, split by privilege.** `test-triage` reads the diff, the pull request
text and the coverage reports, and decides what deserves a test. It has `Read`,
`Grep` and `Glob` and nothing else — no writes, no shell, no network. It is the
component that consumes untrusted input, so it is the component that can do the
least with it. `test-author` writes and runs tests and never sees a GitHub token.

**The agent may only write test files, and that is enforced outside the model.**
`.claude/settings.json` denies edits to application code, configuration and the
agent's own definitions. That is the first layer and it depends on the model's
cooperation. The second layer does not:
[`check-test-boundary.sh`](.github/scripts/check-test-boundary.sh) runs after the
agent, compares the working tree against an allowlist of test paths, restores any
tracked file that was changed and deletes any file that was created. During
development this script deleted its own author's uncommitted work, which is the
behaviour you want from it.

**The authoritative test run holds no model credentials.** The `agent` job runs
the suites so the agent can iterate, and that job necessarily has the model
credential in its environment. The `verify` job then checks out the branch again
and runs the full suites with no such credential. Whether the work is acceptable
is decided there.

**`pull_request`, never `pull_request_target`.** `pull_request_target` would hand
base-repository secrets to code a fork controls. The consequence — the agent does
not run on fork pull requests — is reported in the job summary rather than worked
around.

**Deterministic work belongs in the pipeline, not in the prompt.** Formatting and
the coverage delta are done by `prettier` and
[`coverage-delta.sh`](.github/scripts/coverage-delta.sh). Early runs showed the
agent writing correct tests and then failing CI on formatting, and reporting
coverage as "not measured" while the JSON sat next to it. A model is the wrong
tool for work a command already does reliably.

**The agent cannot talk to GitHub.** It writes `.agent-tmp/report.md`; a workflow
step publishes it with a token scoped to one job
([`post-sticky-comment.sh`](.github/scripts/post-sticky-comment.sh)), updating a
single comment instead of adding one per run.

## Running the PR workflow

Prerequisites:

1. A repository secret with model credentials — either `CLAUDE_CODE_OAUTH_TOKEN`
   (from `claude setup-token`, a Claude subscription) or `ANTHROPIC_API_KEY`. The
   workflow picks whichever exists; the two paths are separate steps so neither
   receives an empty value meant for the other.
2. Actions must be allowed to write: *Settings → Actions → General → Workflow
   permissions → Read and write*. For the backfill workflow to open its own
   pull request, *Allow GitHub Actions to create and approve pull requests*
   must be enabled in the same place; without it the branch is still pushed and
   the pull request has to be opened by hand.
3. Nothing else. No GitHub App, no self-hosted runner.

Then open a pull request. The workflow runs on `opened`, `synchronize`,
`reopened`, `ready_for_review` and `labeled`. It deliberately does nothing when:
the pull request comes from a fork, no credentials are configured, the pull
request is a draft, it carries the `skip-test-agent` label, the head commit was
written by the agent itself, no application code changed, or more than 60 files
changed. Each case is stated in the job summary.

To work on code that has no pull request, run the **Backfill tests** workflow from
the Actions tab. It is driven by the coverage reports instead of a diff and opens
a pull request with what it wrote.

## Where the agent and skills live

```
.claude/
  settings.json                       permission rules shared by local and CI use
  agents/test-triage.md               read-only: decides what needs a test
  agents/test-author.md               writes tests, runs them, may touch test paths only
  skills/analyze-test-gaps/           the plan: what to create, update, skip, and why
  skills/write-frontend-tests/        Vitest + Testing Library conventions of this repo
  skills/write-backend-tests/         pytest + FastAPI conventions of this repo
  skills/verify-tests/                runs the suites, bounded retries, never ships red
  skills/report-test-results/         writes the pull request report to a file
.github/
  prompts/                            the agent's instructions, versioned, not inline YAML
  scripts/                            boundary guard, comment publishing, coverage delta
  workflows/ci.yml                    ordinary CI: both suites with coverage
  workflows/pr-test-agent.yml         guard -> agent -> independent verification
  workflows/backfill-tests.yml        the same agent, on demand, against existing gaps
```

Each skill keeps `SKILL.md` short and puts worked examples in a `references/` file
beside it, so loading one costs little context. They are usable by hand in a local
session — `/analyze-test-gaps`, `/write-backend-tests` — which is what makes them
reusable rather than workflow glue.

During a run the chain is: `analyze-test-gaps` (in the read-only triage agent) →
`write-frontend-tests` / `write-backend-tests` per planned file → `verify-tests`
after each file → `report-test-results` at the end.

## Example run

Pull request [#1](../../pull/1) adds a "clear completed tasks" feature across both
sides — a repository method, a `DELETE /api/todos/completed` endpoint, an API
client call, a mutation hook and a header button — and deliberately ships without
tests. It also breaks two existing tests: `TodosHeader` gained required props, and
`TodosPage` began calling a hook the page test did not mock.

The agent's decisions, taken from its report:

| Source | Action | Reason |
| --- | --- | --- |
| `repository.py` | updated `test_repository.py` | `delete_completed`: filter, per-row delete, commit, count; empty case |
| `router.py` | updated `test_router.py` | the new route returns `{deleted: n}` and is not shadowed by `/{todo_id}` |
| `useClearCompletedMutation.ts` | created a test | cache pruned on success, untouched on failure |
| `TodosPage.tsx` | updated `TodosPage.test.tsx` | notices, busy guard, error alert; mocks the new hook |
| `TodosHeader.tsx` | updated `TodosHeader.test.tsx` | hidden at zero, count, click, disabled; new required props |
| `api/todos.ts` | updated `todos.test.ts` | `clearCompleted` sends the right request |
| `api/queryKeys.ts` | **skipped** | constant declaration, excluded from coverage by `vite.config.ts` |

Result: frontend 18 → 27 tests, backend 21 → 24, both suites green, typecheck and
Prettier clean, verified in a job without model credentials.

| Scope | Before | After | Change |
| --- | --- | --- | --- |
| frontend statements | 42.47% | 51.07% | +8.60 |
| backend statements | 41.24% | 46.33% | +5.09 |

Two details worth noting. The agent skipped a file and said why, which is the
behaviour the triage skill is calibrated for — a pointless test is worse than a
visible gap. And where it had to touch existing tests (the `TodosHeader` tests
lacked the new required props, the page test needed a richer stub) it said so in
the report and left the existing assertions unchanged, rather than quietly
rewriting tests until they passed.

## Backfill result

The same agent and skills, run from the Actions tab against code that was already
untested, produced [#2](../../pull/2): tests for `lib/http.ts`, `utils/todos.ts`,
`TodoEmptyState`, `config.py`, and deeper coverage of the repository and router.

| Scope | Before any of this | On `main` now |
| --- | --- | --- |
| frontend statements | 46.42% | 64.51% |
| backend statements | 42% | 78% |
| backend tests | 21 | 42 |

## Assumptions

- Unit tests only. The backend suite mocks the repository and never opens a
  database connection, and the frontend mocks the HTTP boundary rather than the
  network, so CI needs no services.
- The project's own coverage configuration is the authority on what is worth
  testing. The agent reads `vite.config.ts` and `pyproject.toml` instead of
  carrying its own exclusion list, so the two cannot drift.
- Pull requests come from branches in this repository. Fork support would need a
  different trust model, not a different setting.
- A pull request's title, body and diff are data, not instructions.

## Limitations

- **In CI the agent runs with `bypassPermissions`.** Claude Code's permission
  prompts cannot be answered in a non-interactive run, and allow-patterns do not
  match the compound commands the agent actually issues. What constrains it
  instead: an allowlist of tools in its definition, no network or GitHub tools,
  the boundary guard, and a disposable runner holding one short-lived token.
  Interactive use keeps the default prompting and the deny rules.
- **The agent's own test runs share a job with the model credential.** Only the
  independent verification is credential-free. Splitting the iteration loop out
  would need a different execution model.
- **Fork pull requests get nothing**, by design, and the agent is skipped silently
  from the contributor's point of view — the job summary explains it, a comment
  cannot, because fork pull requests get a read-only token.
- **Tests are not mutation-checked.** A generated test can pass by asserting
  whatever the code does today. The skills push against it, verification does not
  prove it.
- **Runs consume model quota**, and two runs during development failed after real
  work with no diagnostic beyond `is_error: true`, most likely on a subscription
  limit shared with interactive use.
- Backfill covers a handful of files per run by choice, rather than attempting the
  whole repository at once.

## For a production version

- **Verify that a new test can fail.** Run it against a mutated copy of the code
  it covers and discard it if it still passes. That is the one check that
  separates a useful test from a passing one.
- **Budget and observability.** Per-run token and cost ceilings, a dashboard of
  accepted versus abandoned tests, and alerting when the abandonment rate moves.
- **A review gate before the commit**, posting a suggested patch for a human to
  accept instead of pushing directly, for repositories where that is the norm.
- **Fork support** through a `workflow_run` job that holds credentials and treats
  the fork's code strictly as data.
- **Shared skills.** The conventions skills are repository-specific by design; the
  triage, verification and reporting skills are not, and belong in a shared plugin
  consumed by several repositories.
