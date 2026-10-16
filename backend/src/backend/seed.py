"""Loads the demo PDFs from sample_documents/ into the database.

Run from the backend directory: uv run python -m backend.seed
Safe to run again: samples already in the database are skipped.
"""

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.documents import create_document
from backend.models import Document

SAMPLES_DIR = Path(__file__).resolve().parents[2] / "sample_documents"


def seed(db: Session, samples_dir: Path = SAMPLES_DIR) -> list[str]:
    """Adds each sample PDF not yet stored. Returns the filenames it added."""
    existing = set(db.scalars(select(Document.filename).where(Document.is_sample)))
    added = []
    for path in sorted(samples_dir.glob("*.pdf")):
        if path.name in existing:
            continue
        create_document(db, path.name, path.read_bytes(), is_sample=True)
        added.append(path.name)
    return added


def main() -> None:
    with SessionLocal() as db:
        added = seed(db)
    if added:
        print(f"Added {len(added)} sample document(s): {', '.join(added)}")
    else:
        print("All sample documents are already loaded.")


if __name__ == "__main__":
    main()
