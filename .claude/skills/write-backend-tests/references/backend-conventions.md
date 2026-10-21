# Backend test conventions

Stack: pytest 9, FastAPI `TestClient`, `unittest.mock.create_autospec`.
Run from `backend/` so `pyproject.toml` is picked up as the config:
`python -m pytest` (locally `.venv/bin/python -m pytest`).

Tests mirror the package layout: `app/api/health.py` → `tests/api/test_health.py`,
`app/core/config.py` → `tests/core/test_config.py`, `app/factory.py` →
`tests/test_factory.py`. Every directory under `tests/` needs an `__init__.py`;
create it when you create a directory.

## Fixtures that already exist (`tests/conftest.py`)

| Fixture | What it is |
| --- | --- |
| `repository_mock` | `create_autospec(TodoRepository, instance=True)` with `list` returning `[]`. |
| `client` | `TestClient` over a bare `FastAPI()` with only the todos router mounted and `get_repository` overridden to `repository_mock`. |
| `todo_values` | A dict of valid `Todo` field values. |
| `todo` | `Todo.model_validate(todo_values)`. |
| `model_factory` | `lambda values: TodoRecord(**values)`. |

The `client` fixture deliberately mounts just the router. Anything that needs
the real application — the factory, the health endpoint, lifespan wiring — builds
its own app, which is exactly what the untested modules require.

## A router test

```python
def test_update_returns_404_when_the_task_is_missing(client, repository_mock):
    repository_mock.update.return_value = None
    response = client.patch("/api/todos/7", json={"title": "New title"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found."
```

Assert the call as well as the response when the request body matters:

```python
    payload = repository_mock.create.call_args.args[0]
    assert payload.title == "Plan the sprint"
```

## An app built for the test

For health, the factory or anything mounted by `create_app`, override the
dependency so no session is ever created:

```python
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import get_repository
from app.api.health import router
from tests.mocks import make_repository_mock


def test_health_reports_ok_after_touching_the_database():
    repository = make_repository_mock()
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_repository] = lambda: repository
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    repository.session.execute.assert_called_once()
```

`create_app()` runs `resolve_database_url`, so pass an explicit URL —
`create_app("postgresql+psycopg://user:pass@localhost:5432/db")` — and never let
a test depend on a `.env` file or on the developer's environment. Building the
app does not start the lifespan; only entering `TestClient` as a context manager
does, so a factory test that just inspects routes needs no client at all.

## Configuration

`resolve_database_url` reads `.env` with `override=False`, meaning real
environment variables win. Set them through `monkeypatch`:

```python
def test_builds_a_url_from_the_separate_variables(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_USER", "taskly")
    monkeypatch.setenv("POSTGRES_PASSWORD", "secret")
    monkeypatch.setenv("POSTGRES_HOST", "db")
    monkeypatch.setenv("DB_PORT", "5432")
    monkeypatch.setenv("POSTGRES_DB", "taskly")
    assert resolve_database_url() == "postgresql+psycopg://taskly:secret@db:5432/taskly"
```

Cover the three branches: an explicit argument, `DATABASE_URL` from the
environment, and the assembled URL. A missing variable raises `KeyError`, which
is behaviour worth pinning with `pytest.raises`.

## Lifespan

Patch the database helpers at the point of use and assert the engine is disposed
even when the body fails:

```python
import pytest
from app.core import lifespan as lifespan_module


@pytest.mark.anyio
async def test_disposes_the_engine_when_initialization_fails(monkeypatch):
    ...
```

The project has no async test plugin installed, so prefer driving the async
context manager directly with `asyncio.run` over adding a dependency:

```python
import asyncio

def test_puts_a_session_factory_on_app_state(monkeypatch):
    async def run():
        async with lifespan(app):
            assert app.state.session_factory is factory
    asyncio.run(run())
```

**Adding a dependency to `requirements.in` is not something a test author does.**
If a test genuinely cannot be written without one, report it as a gap.

## Mocking a session for repository tests

```python
from unittest.mock import MagicMock

def test_list_orders_by_creation_date_descending(model_factory, todo_values):
    session = MagicMock()
    session.scalars.return_value = [model_factory(todo_values)]
    repository = TodoRepository(session)
    result = repository.list()
    assert [item.id for item in result] == [todo_values["id"]]
    statement = session.scalars.call_args.args[0]
    assert "ORDER BY" in str(statement)
```

Assert on the compiled statement only where the ordering or filtering is the
behaviour under test; otherwise check the session calls and the mapped result.
