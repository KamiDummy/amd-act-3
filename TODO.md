# TODO

## Setup (done)

- [x] Repo structure (backend/frontend)
- [x] Postgres + pgvector (Supabase, session pooler)
- [x] Backend FastAPI skeleton running (uv), DB connection verified
- [x] Frontend Vite/React skeleton running

## Features

### Scan mode (whole doc → LLM analysis)

- [ ] PDF upload endpoint
- [ ] Text extraction (pdfplumber)
- [ ] Call Token Factory API, get flagged issues back
- [ ] Display results in frontend

### Highlight-to-law search

- [ ] Set up react-pdf-highlighter in frontend
- [ ] Embedding model in backend (sentence-transformers)
- [ ] Load 2-3 real statutes into pgvector
- [ ] Endpoint: selected text → vector search → LLM explains, with citation

### Document Q&A

- [ ] Chat endpoint using full extracted text in context

### Auth

- [ ] Simple access-code gate (not full registration)

### Deployment (later)

- [ ] Dockerize backend (and frontend if needed)
- [ ] Deploy to VPS, point at Supabase (session pooler) for prod DB
