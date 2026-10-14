## Setup

### 1. Database (Supabase)

### 1. Database (Supabase)

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
cp .env.example .env    # then fill in DATABASE_URL and RADEON_API_KEY
uv run uvicorn backend.main:app --reload
```

Runs at `http://localhost:8000`. Check `/health` to confirm it's up.

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

## Hackathon

Built for the **AMD Developer Hackathon Act III** (Oct 2026), using AMD Token Factory's free AMD-GPU-hosted model endpoints.
