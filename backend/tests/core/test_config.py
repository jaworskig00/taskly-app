import pytest

from app.core import config
from app.core.config import resolve_database_url

DB_VARS = ["DATABASE_URL", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_HOST", "DB_PORT", "POSTGRES_DB"]


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch):
    monkeypatch.setattr(config, "load_dotenv", lambda *args, **kwargs: None)
    for name in DB_VARS:
        monkeypatch.delenv(name, raising=False)


def test_explicit_argument_wins_over_environment(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://env/db")
    assert resolve_database_url("postgresql://arg/db") == "postgresql://arg/db"


def test_database_url_environment_variable_is_used(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://env/db")
    assert resolve_database_url() == "postgresql://env/db"


def test_url_is_built_from_postgres_parts_with_password_unmasked(monkeypatch):
    monkeypatch.setenv("POSTGRES_USER", "taskly")
    monkeypatch.setenv("POSTGRES_PASSWORD", "s3cret")
    monkeypatch.setenv("POSTGRES_HOST", "db.local")
    monkeypatch.setenv("DB_PORT", "5433")
    monkeypatch.setenv("POSTGRES_DB", "tasks")
    assert resolve_database_url() == "postgresql+psycopg://taskly:s3cret@db.local:5433/tasks"


def test_missing_postgres_part_raises_key_error(monkeypatch):
    monkeypatch.setenv("POSTGRES_USER", "taskly")
    with pytest.raises(KeyError, match="POSTGRES_PASSWORD"):
        resolve_database_url()
