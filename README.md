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
- `ACCESS_CODE` — passcode for entering the app. Leave it empty to turn the access check off.
- `JWT_SECRET` — signs login tokens. If empty, a random secret is generated on each start, so restarting the backend signs everyone out. Set it to keep sessions across restarts:
  `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- `ACCESS_TOKEN_EXPIRE_MINUTES` — how long a login lasts (default `720`, 12 hours)
- `CORS_ORIGINS` — origins allowed to call the API, as a JSON list (default `["http://localhost:5173"]`)

## Access code

The app is behind a single shared access code, not user accounts.

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /auth/status` | public | `{"auth_required": bool}`, so the client can skip the login page when no code is set |
| `POST /auth/login` | public | `{"access_code": "..."}` → `{"access_token", "token_type": "bearer", "expires_in"}`, or `401` for a wrong code |
| `GET /auth/verify` | token | `204` if the token is still valid, `401` if not (expired, or the backend restarted without a fixed `JWT_SECRET`) |
| `/api/*` | token | All feature endpoints |

Clients send the token as `Authorization: Bearer <token>`. When `ACCESS_CODE` is empty, every request is let through.

### Adding a protected endpoint

Feature routers go under the `/api` router in `backend/api.py`, which applies `require_auth` to everything it includes:

```python
# backend/documents.py
from fastapi import APIRouter

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("")
def list_documents(): ...
```

```python
# backend/api.py
from backend import documents

router.include_router(documents.router)  # served at /api/documents
```

`/health` and `/auth/*` stay public.

## Hackathon

Built for the **AMD Developer Hackathon Act III** (Oct 2026), using AMD Token Factory's free AMD-GPU-hosted model endpoints.
