# TODO

## Setup (done)

- [x] Repo structure (backend/frontend)
- [x] Postgres + pgvector (Supabase, session pooler)
- [x] Backend FastAPI skeleton running (uv), DB connection verified
- [x] Frontend Vite/React skeleton running

## Features

### Scan mode (whole doc → LLM analysis)

- [x] PDF upload endpoint
- [x] Text extraction (pdfplumber)
- [x] Call Token Factory API, get flagged issues back (loophole scan, cross-referenced with law DB)
- [x] Display results in frontend

### Highlight-to-law search

- [x] PDF viewer with highlights and text selection (react-pdf)
- [x] Embedding model in backend (sentence-transformers)
- [x] Load federal statutes and regulations into pgvector
- [x] Endpoint: selected text → vector search → LLM explains, with citation

### Document Q&A

- [x] Chat endpoint using full extracted text in context, with document references and law citations
- [ ] Chat UI in frontend

### Auth

- [x] Simple access-code gate (not full registration)

### Deployment (later)

- [ ] Dockerize backend (and frontend if needed)
- [ ] Deploy to VPS, point at Supabase (session pooler) for prod DB
