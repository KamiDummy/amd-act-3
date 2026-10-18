"""Loads the demo PDFs from sample_documents/ into the database.

Run from the backend directory: uv run python -m backend.seed
Safe to run again: samples already in the database are skipped. A server sharing the
database with another one gets the samples' files back, since PDFs are saved on the disk
of the server that stored them.
"""

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.documents import create_document, pdf_path
from backend.models import Document

SAMPLES_DIR = Path(__file__).resolve().parents[2] / "sample_documents"


def seed(db: Session, samples_dir: Path = SAMPLES_DIR) -> list[str]:
    """Adds each sample PDF not yet stored and writes back the file of any stored sample
    whose file is missing. Returns the filenames it added."""
    stored = {d.filename: d for d in db.scalars(select(Document).where(Document.is_sample))}
    added = []
    for path in sorted(samples_dir.glob("*.pdf")):
        document = stored.get(path.name)
        if document is None:
            create_document(db, path.name, path.read_bytes(), is_sample=True)
            added.append(path.name)
            continue
        file = pdf_path(document.id)
        if not file.is_file():
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(path.read_bytes())
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
