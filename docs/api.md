# API reference

The backend serves interactive docs at `/docs` (Swagger UI) and the schema at `/openapi.json`. This page explains what the endpoints do and how their results fit together.

## Access code

The app is behind one shared access code, not user accounts.

| Endpoint           | Auth   | Purpose                                                                                                          |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------------------------- |
| `GET /auth/status` | public | `{"auth_required": bool}`, so the client can skip the login page when no code is set                             |
| `POST /auth/login` | public | `{"access_code": "..."}` → `{"access_token", "token_type": "bearer", "expires_in"}`, or `401` for a wrong code   |
| `GET /auth/verify` | token  | `204` if the token is still valid, `401` if not (expired, or the backend restarted without a fixed `JWT_SECRET`) |
| `/api/*`           | token  | All feature endpoints                                                                                            |

Clients send the token as `Authorization: Bearer <token>`. When `ACCESS_CODE` is empty, every request is let through.

`GET /health` and `GET /health/db` are public and report whether the app and its database are up.

## Documents

Everyone shares one workspace, so every user sees every document. Uploaded PDFs are saved to `STORAGE_DIR` on the server's disk; their text is extracted with pdfplumber and stored per page in Postgres (`documents` and `document_pages`).

| Endpoint                       | Purpose                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `GET /api/documents`           | List all documents, newest first (no text)                                    |
| `POST /api/documents`          | Upload a PDF as multipart form field `file` → `201` with the document summary |
| `GET /api/documents/{id}`      | One document with `pages: [{page_number, text}]`                              |
| `GET /api/documents/{id}/file` | The original PDF, for the viewer                                              |

Uploads are rejected with `422` (and a message to show the user) if the file isn't a readable PDF, has more than 100 pages or 300,000 characters, or has no selectable text (scanned). Files over 20 MB get `413`.

`uv run python -m backend.seed` loads the demo contracts in `backend/sample_documents/`, marked `is_sample: true`. They are fictional Ontario contracts with deliberate problems: clauses that conflict with Ontario law, and sections that contradict each other.

## Citations

Every feature that cites law returns citations of the same shape:

```json
{
  "law_id": "ON-00e41",
  "law_title": "Employment Standards Act, 2000",
  "kind": "act",
  "jurisdiction": "ontario",
  "section": "33",
  "marginal_note": "Right to vacation",
  "text": "(1) An employer shall give an employee a vacation of, ...",
  "url": "https://www.ontario.ca/laws/statute/00e41#BK68"
}
```

The model sees the sections retrieved for a question under short refs (`L1`, `L2`, …) and may cite only those (`law_citations.py`), so a citation always points at a real section in the database. `url` opens the section itself: Justice Laws has a page per section (`/eng/acts/L-2/section-184.html`), and e-Laws sections link to their anchor on the law's page. Sections without a number (schedules) link to the law.

## Loophole scan

`POST /api/documents/{id}/loopholes` scans a stored document and returns `{"document_id", "model", "findings"}`, most severe first. Each finding has a `title`, a `severity` (`high`, `medium` or `low`), the clause as a `quote` from the document, its `page_number` (`null` if the model paraphrased), an `explanation`, a `recommendation`, `citations` and the clause's `highlight`.

It makes two calls to AMD Token Factory, with a vector search in between, and takes about a minute:

1. The model lists up to 8 suspect clauses, each with a search query for the legal rule behind it.
2. Each query runs against the law database (6 sections per clause).
3. The model reviews each clause against its sections and cites only those.

## Check a passage

`POST /api/documents/{id}/explain` with `{"text": "<selected text>", "page_number": 2}` checks a passage the user selected. `page_number` is the page the selection starts on; it picks the right match when the text repeats. The selection may span pages and can be up to 4,000 characters.

The response has `title`, `explanation` (what the passage means, then whether it is a problem and why), `severity` (`high`, `medium`, `low` or `none`), `recommendation` (empty when the passage is fine), `citations` and `highlight`. It makes two calls and takes 10 to 30 seconds:

1. The model judges the passage from the signer's side and writes a search query aimed at the rule behind its concern (for a five-day vacation clause, "minimum annual vacation for employees in Ontario", not "vacation days").
2. After the vector search, the model explains the passage with that concern and the retrieved sections in hand.

The scan and the check judge clauses by the same criteria and severity scale (`review_criteria.py`), so a clause gets the same verdict from either.

## Chat

`POST /api/documents/{id}/chat` answers a question about a stored document:

```json
{
  "question": "Can they fire me without notice?",
  "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
  "selection": {"text": "<selected text>", "page_number": 2},
  "items": [{"id": "highlight:…", "kind": "note", "name": "Vacation days", "description": "Ask for two weeks", "quote": "five (5) days", "page_number": 1, "severity": null}]
}
```

- `history` is the conversation so far, oldest first. The server keeps no chat state; the client sends it with each question, and only the last 20 messages are used. Questions are up to 2,000 characters, history messages up to 8,000.
- `selection` (optional) is a passage the user attached to the question.
- `items` (optional) are the user's highlights, so the chat can find, list, change and scan them. `kind` is `auto` (found by the auto scan), `scan` (the user's, scanned) or `note` (the user's, not scanned); `description` is the user's note. The model sees them under refs `I1`, `I2`, …; only the first 200 are used.

The response has:

- `answer`;
- `references`: passages of the document the answer relies on, each with its `quote`, `page_number` and `highlight`, so the client can link them to the PDF (quotes not found in the document are dropped);
- `citations`, and `law_query`: what the law database was searched for, empty when the question needed no law. Asked to search the law on a subject, the chat cites every relevant section it finds;
- `mentions`: the ids of the items the answer is about;
- `actions`: changes the user asked for, checked in `chat_items.py` and applied by the client:
  - `{"type": "create_highlight", "name", "description", "quote", "page_number", "highlight", "scan"}` for a passage found in the document (`scan: true` when the user wants it scanned, not just saved);
  - `{"type": "scan_item", "id"}` to scan one of the user's highlights;
  - `{"type": "update_item", "id", "name", "description"}` (a `null` field stays as it is).

It makes two calls and takes 10 to 30 seconds: the model first decides whether the question needs law and writes a search query, then answers with the document, the conversation and the retrieved sections (the search is skipped when no law is needed).

## Highlights on the PDF

Every passage the API points at comes with `highlight`, a list of rectangles, one per line of text:

```json
{"page_number": 2, "x0": 0.1176, "top": 0.1012, "x1": 0.8824, "bottom": 0.1195}
```

Coordinates are fractions of the page's width and height from its top-left corner, so they work at any zoom: draw each as a box at `left: x0 * 100%`, `top: top * 100%`, `width: (x1 - x0) * 100%`, `height: (bottom - top) * 100%` over its page. A passage can cover several pages; each rectangle names its own. An empty list means the passage couldn't be matched to the PDF.

`highlights.py` does the matching, word by word against the stored page text, ignoring case, whitespace and curly quotes, and allowing partial words at the edges and quotes shortened with an ellipsis.

## Errors

LLM endpoints return `503` when `TOKEN_FACTORY_API_KEY` isn't set and `502` when the model fails or returns something unusable. Every error body is `{"detail": "<message safe to show the user>"}`.
