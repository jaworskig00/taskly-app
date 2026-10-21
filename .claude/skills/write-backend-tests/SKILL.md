---
name: write-backend-tests
description: Writes pytest unit tests that match this repository's FastAPI and SQLAlchemy conventions. Use when adding or updating tests for anything under backend/app, including routers, the repository, validators, the app factory and configuration.
allowed-tools: Read, Grep, Glob, Write, Edit, Bash(cd backend*), Bash(python -m pytest*), Bash(.venv/bin/python*)
---

# Write backend tests

## Before writing anything

Read `backend/tests/conftest.py` and the test module closest to your subject.
The fixtures there are the house style, and re-creating what they already build
is the most common way these tests go wrong. Detailed patterns are in
`references/backend-conventions.md`.

## The rules that are not stylistic

1. **No database, ever.** The suite runs without Postgres and must keep doing so.
   The repository is replaced by an autospecced mock, and a SQLAlchemy engine may
   be constructed but never connected.
2. **Use the fixtures that exist**: `repository_mock`, `client`, `todo_values`,
   `todo`, `model_factory`. Reach for `make_repository_mock()` from
   `tests/mocks.py` only when you need a second, independent mock.
3. **`create_autospec` is not decoration.** It is what makes a mocked repository
   fail when the real interface changes, which is most of the value these tests
   have. Never replace it with a bare `Mock()`.
4. **Override dependencies, do not reach around them.** For anything beyond the
   todos router — the factory, health, lifespan — build the app and set
   `app.dependency_overrides[get_repository]`, as the reference shows.
5. **Environment belongs to `monkeypatch`.** Tests touching `config.py` must set
   and delete variables through `monkeypatch`, never `os.environ` directly, or
   they leak into every test that follows.
6. Plain functions and plain `assert`. No test classes, no custom base classes.

## What to assert

The decision the code makes, not the path it took to make it:

- a router: the status code, the response body, and that the repository was
  called with what the request carried;
- the repository: the SQLAlchemy statement it builds and the session calls it
  makes, through a mocked session;
- a validator: both sides of every branch, including the boundary value;
- the factory and lifespan: what ends up wired onto `app.state`, and that
  cleanup happens even when the body raises.

`pytest.raises` with `match=` pins the message, which is usually the part a user
sees.

Name tests as sentences about behaviour:
`test_session_creation_failure_propagates_from_repository_dependency`.

## When you cannot write a good test

Say so. A line that can only be covered by asserting on internals, or by
changing production code, is a reported gap — not a licence to change the code
or to write a test that passes against any implementation.
