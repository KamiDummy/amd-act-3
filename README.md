## Setup

### 1. Database (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run:

```sql
   create extension if not exists vector;
```

Or add extention manually through supabase UI

3. Grab your connection string from Project Settings → Database → Connection string.
   **Use the "Session pooler" option for IPv4**

### 2. Backend

```powershell
cd backend
uv sync
cp .env.example .env
uv run uvicorn backend.main:app --reload
```

Runs at `http://localhost:8000`. Check `/health` to confirm it's up.

Run the tests with `uv run pytest`.

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`.

## Environment variables

See `backend/.env.example`:

- `DATABASE_URL` — Supabase Postgres connection string
- `RADEON_API_KEY` — AMD Token Factory API key
- `ACCESS_CODE` — passcode for entering the app. Leave it empty to turn the login screen off.
- `JWT_SECRET` — signs login tokens. If empty, a random secret is generated on each start, so restarting the backend signs everyone out. Set it to keep sessions across restarts:
  `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- `ACCESS_TOKEN_EXPIRE_MINUTES` — how long a login lasts (default `720`, 12 hours)
- `CORS_ORIGINS` — origins allowed to call the API, as a JSON list (default `["http://localhost:5173"]`)

The frontend calls the backend at `http://localhost:8000` by default. Set `VITE_API_URL` in `frontend/.env` to point it elsewhere.

## Access code

The app is behind a single shared access code, not user accounts.

- `GET /auth/status` returns `{"auth_required": true | false}`. The frontend uses it to skip the login page when no code is set.
- `POST /auth/login` with `{"access_code": "..."}` returns `{"access_token", "token_type": "bearer", "expires_in"}`, or `401` if the code is wrong.
- To protect an endpoint, add the `require_auth` dependency from `backend.auth`. Clients then send `Authorization: Bearer <token>`. When `ACCESS_CODE` is empty, `require_auth` lets every request through.

```python
from fastapi import Depends
from backend.auth import require_auth

@app.get("/documents", dependencies=[Depends(require_auth)])
def list_documents(): ...
```

## Hackathon

Built for the **AMD Developer Hackathon Act III** (Oct 2026), using AMD Token Factory's free AMD-GPU-hosted model endpoints.
