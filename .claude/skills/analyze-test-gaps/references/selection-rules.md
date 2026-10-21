# Selection rules

## Never worth a unit test in this repository

Beyond whatever the coverage configuration already excludes:

| Pattern | Why |
| --- | --- |
| `**/*.stories.tsx` | Storybook stories; the design system is excluded from coverage. |
| `**/*.styles.ts`, `**/*.variants.ts` | Styled-components declarations with no behaviour. |
| `**/*.types.ts`, `**/types.ts`, `**/*.d.ts` | Types vanish at runtime; the type checker covers them. |
| `**/index.ts` | Re-export barrels. |
| `frontend/src/main.tsx` | Application bootstrap; excluded from coverage. |
| `frontend/src/test/**` | Test fixtures and setup, not subjects. |
| `backend/app/**/__init__.py` | Empty package markers. |
| `backend/app/**/schemas.py`, `models.py` | Declarative Pydantic and SQLAlchemy definitions; omitted from coverage. The behaviour that matters is in validators, mappers and the repository. |
| `**/*.md`, `**/*.yaml`, `**/*.yml`, `**/*.json`, `Dockerfile*`, `.github/**` | Not code under test. |

A file that only had comments, formatting or import order changed is also a skip,
whatever its path.

## Where the test for a file belongs

| Source | Test |
| --- | --- |
| `frontend/src/lib/http.ts` | `frontend/src/lib/http.test.ts` |
| `frontend/src/features/todos/hooks/useTodosQuery.ts` | `frontend/src/features/todos/hooks/useTodosQuery.test.ts` |
| `frontend/src/features/todos/components/TodoItem.tsx` | `frontend/src/features/todos/components/TodoItem.test.tsx` |
| `backend/app/factory.py` | `backend/tests/test_factory.py` |
| `backend/app/api/health.py` | `backend/tests/api/test_health.py` |
| `backend/app/core/config.py` | `backend/tests/core/test_config.py` |
| `backend/app/features/todos/repository.py` | `backend/tests/features/todos/test_repository.py` |

Frontend tests sit next to the file they cover. Backend tests mirror the package
layout under `backend/tests/`, with a `test_` prefix; every directory there needs
an `__init__.py`, and the existing ones already have it.

## Judging a partly covered file

A file with a test file is not automatically covered. Check the coverage report
for the specific lines the diff touched:

- changed lines already covered → `skipped`, reason "change is within covered behaviour";
- changed lines uncovered, test file exists → `update`;
- changed lines uncovered, no test file → `create`.
