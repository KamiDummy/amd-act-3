"""Try a law search from the terminal.

    uv run python -m backend.search_laws "can my landlord enter without notice"
"""

import sys

from backend.database import SessionLocal
from backend.laws import search_laws


def main() -> None:
    query = " ".join(sys.argv[1:])
    if not query:
        sys.exit('Usage: python -m backend.search_laws "your question"')
    with SessionLocal() as db:
        for hit in search_laws(db, query):
            note = f" ({hit.marginal_note})" if hit.marginal_note else ""
            print(f"{hit.score:.3f}  {hit.law_title}, s. {hit.label}{note}")
            print(f"       {hit.text[:200]}...\n       {hit.url}")


if __name__ == "__main__":
    main()
