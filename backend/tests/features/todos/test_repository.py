from unittest.mock import Mock

from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session

from app.features.todos.models import TodoRecord
from app.features.todos.repository import TodoRepository


def test_list_maps_models_and_orders_tasks_newest_first(model_factory, todo_values, todo):
    session = Mock(spec=Session)
    session.scalars.return_value = [model_factory(todo_values)]
    assert TodoRepository(session).list() == [todo]
    statement = session.scalars.call_args.args[0]
    expected = select(TodoRecord).order_by(TodoRecord.created_at.desc(), TodoRecord.id.desc())
    assert statement.compare(expected)
    compiled = str(statement.compile(dialect=postgresql.dialect()))
    assert "ORDER BY todos.created_at DESC, todos.id DESC" in compiled


def test_get_returns_none_for_missing_task():
    session = Mock(spec=Session)
    session.get.return_value = None
    assert TodoRepository(session).get(404) is None
    session.get.assert_called_once_with(TodoRecord, 404)


def test_delete_completed_deletes_only_completed_tasks_and_returns_count(model_factory, todo_values):
    session = Mock(spec=Session)
    records = [model_factory({**todo_values, "id": 1, "completed": True}),
               model_factory({**todo_values, "id": 2, "completed": True})]
    session.scalars.return_value = records
    assert TodoRepository(session).delete_completed() == 2
    statement = session.scalars.call_args.args[0]
    expected = select(TodoRecord).where(TodoRecord.completed.is_(True))
    assert statement.compare(expected)
    assert [call.args[0] for call in session.delete.call_args_list] == records
    session.commit.assert_called_once_with()


def test_delete_completed_returns_zero_when_nothing_is_completed():
    session = Mock(spec=Session)
    session.scalars.return_value = []
    assert TodoRepository(session).delete_completed() == 0
    session.delete.assert_not_called()
    session.commit.assert_called_once_with()


def test_create_persists_record_with_matching_timestamps_and_returns_task(todo_values):
    from app.features.todos.schemas import TodoCreate

    session = Mock(spec=Session)
    session.refresh.side_effect = lambda record: setattr(record, "id", 5)
    created = TodoRepository(session).create(TodoCreate(title="Write", priority="low"))
    record = session.add.call_args.args[0]
    assert (record.title, record.priority) == ("Write", "low")
    assert record.created_at == record.updated_at
    session.commit.assert_called_once_with()
    session.refresh.assert_called_once_with(record)
    assert created.id == 5


def test_update_returns_none_for_missing_task_without_committing():
    from app.features.todos.schemas import TodoUpdate

    session = Mock(spec=Session)
    session.get.return_value = None
    assert TodoRepository(session).update(1, TodoUpdate(title="x")) is None
    session.commit.assert_not_called()


def test_update_applies_only_provided_fields_and_bumps_updated_at(model_factory, todo_values):
    from app.features.todos.schemas import TodoUpdate

    session = Mock(spec=Session)
    record = model_factory(todo_values)
    session.get.return_value = record
    result = TodoRepository(session).update(7, TodoUpdate(completed=True))
    assert record.completed is True
    assert record.title == todo_values["title"]
    assert record.updated_at > todo_values["updated_at"]
    assert result.completed is True
    session.commit.assert_called_once_with()


def test_delete_removes_existing_task(model_factory, todo_values):
    session = Mock(spec=Session)
    record = model_factory(todo_values)
    session.get.return_value = record
    assert TodoRepository(session).delete(7) is True
    session.delete.assert_called_once_with(record)
    session.commit.assert_called_once_with()


def test_delete_returns_false_for_missing_task():
    session = Mock(spec=Session)
    session.get.return_value = None
    assert TodoRepository(session).delete(7) is False
    session.delete.assert_not_called()
    session.commit.assert_not_called()
