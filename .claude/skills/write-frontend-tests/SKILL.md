---
name: write-frontend-tests
description: Writes Vitest and Testing Library unit tests that match this repository's frontend conventions. Use when adding or updating tests for anything under frontend/src, including components, hooks, the API client and utilities.
allowed-tools: Read, Grep, Glob, Write, Edit, Bash(cd frontend*), Bash(npx prettier*), Bash(npm run test*), Bash(npm run typecheck*)
---

# Write frontend tests

## Before writing anything

Read the test file next to the module you are about to cover, or the closest one
in the same folder. **The existing suite is the specification for style** — match
its imports, its level of mocking and its assertion vocabulary. The detailed
patterns, with working examples, are in `references/frontend-conventions.md`;
read it before your first test in a session.

## The rules that are not stylistic

1. **No globals.** Import `describe`, `it`, `expect`, `vi`, `beforeEach` from
   `vitest` explicitly. `vitest.config` does not enable globals and adding them
   is not your call.
2. **Mock the design system whenever the module under test renders one of its
   components**, with the repository's own mock module:
   `vi.mock('../../../design-system', () => import('../../../design-system/mocks'))`.
   Fix the relative depth to the file you are writing. Without it a component
   test drags in styled-components and asserts on markup you do not control.
3. **Mock the HTTP boundary, never `fetch`.** `vi.mock('../../../lib/http', () => ({ request: vi.fn() }))`.
   The one exception is `lib/http.ts` itself, where `fetch` is the subject and
   belongs on `globalThis` as a stub.
4. **A react-query hook needs a provider**, not a mocked `useQuery`. Use
   `renderHook` with a fresh `QueryClient` per test and retries disabled — see
   the reference for the wrapper.
5. **Prettier is enforced by CI.** This project writes no semicolons, single
   quotes and trailing commas. Run `npx prettier --write <files>` inside
   `frontend/` on every file you create, before you run the suite.
6. **No snapshots.** They pass for the wrong reasons and nobody reads the diff.

## What to assert

Cover the behaviour the change introduced, including the branch that is easy to
forget: the error path, the empty list, the disabled state, the aborted request.
A test that only renders a component and checks that it rendered has bought
nothing.

Query by role and label, the way a user finds things. `getByTestId` is a last
resort; the design-system mock exposes `data-testid="alert"` for alerts because
an alert has no better handle.

Name a test after the behaviour it pins down — `rejects a whitespace-only title
without submitting`, not `works correctly`.

## When you cannot write a good test

If covering a line would mean asserting on implementation details, or would need
production code to change shape, stop and say so. Report it as a gap with the
reason. That is a correct outcome, and it is far better than a test that locks
in the current implementation.
