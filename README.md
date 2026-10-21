# Taskly App

The application code in this repository comes from
[cf-recruitment/taskly-app](https://github.com/cf-recruitment/taskly-app) and is kept
as the first commit, unchanged.

Everything after that commit adds a **unit test agent**: a custom agent with reusable
skills that reads a pull request, decides which changed code needs tests, writes them,
runs them, and reports the result on the pull request. See
[`SOLUTION.md`](SOLUTION.md) for how it is built and how to run it, and
[`.claude/`](.claude) for the agent and skill definitions.

## Setup

```sh
cp .env.example .env
```

## Docker

```sh
docker compose up --build -d --wait
```

Application: http://localhost:8080. API: http://localhost:8000/docs.

```sh
docker compose down
```

## Frontend

Installation:

```sh
cd frontend
npm ci
```

Development — http://localhost:5173:

```sh
npm run dev
```

Storybook — http://localhost:6006:

```sh
npm run storybook
```

Tests:

```sh
npm test
```

Coverage — `frontend/coverage/index.html`:

```sh
npm run test:coverage
```

## Backend

Installation (from the repository root):

```sh
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r backend/requirements.txt
```

Development — http://localhost:8000/docs:

```sh
docker compose up -d --wait postgres
cd backend
python -m uvicorn app.main:app --reload
```

Tests (in `backend`, with `.venv` activated):

```sh
python -m pytest
```

Coverage — `backend/coverage/html/index.html`:

```sh
python -m pytest --cov=app --cov-report=term-missing --cov-report=html
```
