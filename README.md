# [Project Name]

AI-powered document analyzer built for the AMD Developer Hackathon Act III. Upload a contract or document and:

- **Scan mode** — AI reviews the full document for unusual, risky, or scam-like clauses before you sign.
- **Highlight-to-law search** — select any sentence and find real statutes/regulations that may be relevant to it.
- **Ask a question** — chat directly with the document's content.

Not legal advice — informational only, intended to help you know what to look out for before signing.

## Stack

- **Backend:** FastAPI (Python), managed with [uv](https://github.com/astral-sh/uv)
- **Database:** PostgreSQL + `pgvector`, hosted on [Supabase](https://supabase.com)
- **Frontend:** React (Vite)
- **LLM:** [AMD Token Factory](https://developer.amd.com.cn/radeon/api) — OpenAI-compatible API running on AMD GPUs
- **Embeddings:** self-hosted (`sentence-transformers`), used for the law-search vector store

## Setup

### 1. Database (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run:

```sql
   create extension if not exists vector;
```

Or add the extension manually through the Supabase UI. 3. Grab your connection string from Project Settings → Database → Connection string.
**Use the "Session pooler" option for IPv4.**

### 2. Backend

```powershell
cd backend
uv sync
cp .env.example .env
uv run alembic upgrade head      # create/update the database tables
uv run python -m backend.seed    # load the demo PDFs (safe to re-run)
uv run uvicorn backend.main:app --reload
```

Runs at `http://localhost:8000`. Check `/health` to confirm it's up. API docs are at `/docs`.

After pulling changes that touch `backend/src/backend/models.py`, run `uv run alembic upgrade head` again. Run the tests with `uv run pytest`. See `CONTRIBUTING.md` for how to add new endpoints or generate migrations.

### Law database (vector search)

Federal Acts and regulations live in the `laws` and `law_sections` tables, one row per section (long sections are split), each with a 384-dimension embedding from `BAAI/bge-small-en-v1.5` and an HNSW cosine index. The source is Justice Canada's consolidated XML at [justicecanada/laws-lois-xml](https://github.com/justicecanada/laws-lois-xml), published under the Open Government Licence - Canada.

The shared Supabase database is already loaded, so you only need `uv run alembic upgrade head`. It holds about 107,600 sections and 463 MiB in total:

| Law | Laws | Sections |
| --- | --- | --- |
| Federal Acts | 895 (the other 76 of the 971 files had no section text, mostly repealed, and were skipped) | 55,446 |
| Federal regulations | 2,429 | 48,215 |
| Ontario statutes | 21 | 3,637 |
| Ontario regulations | 3 | 317 |

Federal regulations were loaded in file-name order and **stopped at `SOR-87-612`** when the database reached the loaders' 460 MiB cap, so about 940 regulations from 1987 to 1999 (`SOR-87-6…` to `SOR-99-…`) are missing. Everything from 2000 on, including the newest (to 2026), is loaded.

**Ontario law.** Most everyday contracts are governed by provincial law, so the same tables also hold the Ontario laws behind them, from [e-Laws](https://www.ontario.ca/laws), whose site reads each law as HTML from a JSON API; `backend/src/backend/ontario_laws.py` parses it. `LAWS` in that file lists them, most useful first:

- Jobs: Employment Standards Act, 2000 and O. Reg. 285/01, Human Rights Code, Occupational Health and Safety Act, Workplace Safety and Insurance Act, 1997, Pay Equity Act
- Homes: Residential Tenancies Act, 2006 and O. Reg. 516/06, Condominium Act, 1998
- Buying, borrowing and services: Consumer Protection Act, 2002 and O. Reg. 17/05 (car rentals, gyms, purchases), Sale of Goods Act, Payday Loans Act, 2008, Collection and Debt Settlement Services Act, Consumer Reporting Act, Repair and Storage Liens Act, Personal Property Security Act, Mortgage Brokerages, Lenders and Administrators Act, 2006, Trust in Real Estate Services Act, 2002, Arthur Wishart Act (Franchise Disclosure), 2000, Insurance Act
- Any contract: Limitations Act, 2002, Electronic Commerce Act, 2000, Personal Health Information Protection Act, 2004

Each law has a `jurisdiction` (`federal` or `ontario`), shown to the model with every candidate section, and Ontario sections are embedded with "(Ontario)" after the title, so a query that names the province finds them first. To load or refresh them (a few minutes):

```powershell
uv run python -m backend.ontario_laws                     # everything in LAWS
uv run python -m backend.ontario_laws 00e41               # or a statute, by e-Laws name
uv run python -m backend.ontario_laws regulation/050017   # or a regulation
```

**Links to the exact section.** Every citation's `url` points at the section itself: Justice Laws has a page per section (`/eng/acts/L-2/section-184.html`; a grouped label like "31 and 32" links to its first section), and e-Laws sections link to their anchor on the law's page (`/laws/statute/00e41#BK68`), stored in `law_sections.anchor`. Sections without a number (schedules) link to the law's page.

To load a fresh database (hours on CPU, downloads about 340 MB of XML into `backend/data/`, which is gitignored):

```powershell
uv run alembic upgrade head
uv run python -m backend.ingest_laws                 # everything; safe to re-run, skips what's loaded
uv run python -m backend.ingest_laws --only C-46     # or just some laws, by file name
```

Past 500 MB, Supabase's free tier makes the database read-only, which would break uploads for everyone. Both loaders stop before the next law once the database reaches 460 MiB (`MAX_LAW_LOAD_MB` in `database.py`; change it with `--max-mb`), leaving room for documents and index growth. The database is at that cap now, so loading more law means raising the limit on Supabase or removing some first. Check the size with `select pg_size_pretty(pg_database_size(current_database()))`.

Try a query from the terminal, or call `search_laws(db, text, limit)` in `backend/src/backend/laws.py` from the API:

```powershell
uv run python -m backend.search_laws "can my landlord enter without notice"
```

The first search downloads the embedding model (about 130 MB). Use the same model for queries and ingestion; changing it means re-running the ingest with `--force`.

### Loophole scan (LLM)

`POST /api/documents/{id}/loopholes` scans a stored document and returns findings, most severe first. Each finding has a title, a severity (`high`, `medium` or `low`), the clause quoted from the document, the page it was found on (`null` if the model paraphrased), a plain-language explanation and recommendation, and citations to law sections (federal or Ontario), each with its text and a link to the section. The frontend sends only the document id; the backend reads the stored text.

A scan makes two calls to AMD Token Factory (`Gemma-4-31B-IT`), with a vector search in between, and takes about a minute:

1. The model lists up to 8 suspect clauses, each with a search query for its legal topic.
2. Each query runs against the law database (top 4 sections).
3. The model reviews each clause against its sections and may cite only those, so a citation can't point at law that isn't in the database.

Set `TOKEN_FACTORY_API_KEY` in `backend/.env` (see `.env.example`). Without it the endpoint returns 503. LLM failures return 502. The team shares one key and its limit of about 20 requests a minute, so avoid running many scans at once.

Federal law and Ontario's employment and tenancy statutes are searched (6 sections per clause). Contracts from other provinces come back with few or no citations and a note to check provincial law.

### Highlight-to-law (LLM)

`POST /api/documents/{id}/explain` with `{"text": "<selected text>", "page_number": 2}` checks a passage the user selected for risks and cites the law for it. `page_number` is the page the selection starts on; it picks the right match when the text repeats. The selection may span pages and can be up to 4,000 characters.

The response has `explanation` (what the passage means, then whether it is a problem and why), `severity` (`high`, `medium`, `low` or `none`), `recommendation` (empty when the passage is fine), `citations` (same shape as the loophole scan's) and the selection's `highlight`. It makes two Token Factory calls and takes 10 to 30 seconds:

1. The model judges the passage from the signer's side and writes a search query aimed at the legal rule behind its concern (for a five-day vacation clause, "minimum annual vacation for employees", not "vacation days").
2. After the vector search, the model explains the passage with that concern and the retrieved sections in hand.

Explain and the loophole scan judge clauses by the same criteria and severity scale, kept in `review_criteria.py`, so the same clause gets the same verdict from either. The ref and citation checks are shared in `law_citations.py`.

### Document chat (LLM)

`POST /api/documents/{id}/chat` answers a question about a stored document:

```json
{
  "question": "Can they fire me without notice?",
  "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
  "selection": {"text": "<selected text>", "page_number": 2},
  "items": [{"id": "highlight:…", "kind": "note", "name": "Vacation days", "description": "Ask for two weeks", "quote": "five (5) days", "page_number": 1, "severity": null}]
}
```

`history` is the conversation so far, oldest first. The server keeps no chat state, so the client stores the conversation and sends it with each question; only the last 20 messages are used. `selection` is optional: a passage the user attached to the question. Questions are up to 2,000 characters, history messages up to 8,000.

`items` is optional: the user's highlights on the document, so the chat can find, list, change and scan them. `kind` is `auto` (found by the automatic scan), `scan` (the user's, scanned) or `note` (the user's, not scanned), and `description` is the user's note on it. The model sees them under short refs (`I1`, `I2`, …); only the first 200 are used.

The response has `answer`, `references`, `citations` (same shape as the loophole scan's), `law_query` (what the law database was searched for, empty when the question needed no law), `mentions` and `actions`. Asked to find or search laws on a subject, the chat always searches, and cites every relevant section it finds rather than only those backing a claim. Each reference is a passage of the document the answer relies on, with its `quote`, `page_number` and `highlight`, so the client can link it to its place in the PDF. Quotes that can't be found in the document are dropped. `mentions` lists the ids of the items the answer is about. `actions` are the changes the user asked for, checked in `chat_items.py` before they are returned: `{"type": "create_highlight", "name", "description", "quote", "page_number", "highlight", "scan"}` for a passage found in the document (`scan: true` when the user wants it scanned, not just saved), `{"type": "scan_item", "id"}` to scan one of the user's own highlights, or `{"type": "update_item", "id", "name", "description"}` for an item that was sent (a `null` field stays as it is). The client applies them; a scan runs the same check as the Scan button, after the answer. It makes two Token Factory calls and takes 10 to 30 seconds:

1. The model reads the document and the conversation and decides whether the question needs law. If so, it writes a search query.
2. After the vector search (skipped when no law is needed), the model answers, quoting the document and citing only the sections retrieved for this question.

### Highlights on the PDF

Every feature that points at a passage in the document returns it as `highlight`, a list of rectangles, one per line of text:

```json
{"page_number": 2, "x0": 0.1176, "top": 0.1012, "x1": 0.8824, "bottom": 0.1195}
```

Coordinates are fractions of the page's width and height from its top-left corner, so they work at any zoom: draw each one as a box at `left: x0 * 100%`, `top: top * 100%`, `width: (x1 - x0) * 100%`, `height: (bottom - top) * 100%` over its page. A passage can cover several pages; each rectangle names its own. An empty list means the passage couldn't be matched to the PDF.

`backend/src/backend/highlights.py` does the matching (`locate`), word by word against the stored page text, ignoring case, whitespace and curly quotes, and allowing partial words at the edges and quotes shortened with an ellipsis.

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
- `STORAGE_DIR` — where uploaded PDFs are saved (default `storage`, relative to `backend/`; git-ignored)

## Access code

The app is behind a single shared access code, not user accounts.

| Endpoint           | Auth   | Purpose                                                                                                          |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------------------------- |
| `GET /auth/status` | public | `{"auth_required": bool}`, so the client can skip the login page when no code is set                             |
| `POST /auth/login` | public | `{"access_code": "..."}` → `{"access_token", "token_type": "bearer", "expires_in"}`, or `401` for a wrong code   |
| `GET /auth/verify` | token  | `204` if the token is still valid, `401` if not (expired, or the backend restarted without a fixed `JWT_SECRET`) |
| `/api/*`           | token  | All feature endpoints                                                                                            |

Clients send the token as `Authorization: Bearer <token>`. When `ACCESS_CODE` is empty, every request is let through.

## Documents

Everyone shares one demo workspace, so every user sees every document. Uploaded PDFs are saved to `STORAGE_DIR`; their text is extracted with pdfplumber and stored per page in Postgres (`documents` and `document_pages` tables), ready to send to the LLM.

All routes need the access token.

| Endpoint                       | Purpose                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `GET /api/documents`           | List all documents, newest first (no text)                                    |
| `POST /api/documents`          | Upload a PDF as multipart form field `file` → `201` with the document summary |
| `GET /api/documents/{id}`      | One document with `pages: [{page_number, text}]`                              |
| `GET /api/documents/{id}/file` | The original PDF, for the viewer                                              |

Uploads are rejected with `422` (and a message to show the user) if the file isn't a readable PDF, has more than 100 pages or 300,000 characters, or has no selectable text (scanned). Files over 20 MB get `413`.

### Demo documents

`backend/sample_documents/` holds two fictional Ontario contracts with deliberate problems for the loophole check: clauses that conflict with Ontario law and internal contradictions (for example, the rent or salary differs between sections). `uv run python -m backend.seed` loads any of them not yet in the database, marked `is_sample: true`.

## Hackathon

Built for the **AMD Developer Hackathon Act III** (Oct 2026), using AMD Token Factory's free AMD-GPU-hosted model endpoints.
