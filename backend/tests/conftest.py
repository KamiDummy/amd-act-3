import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Settings require DATABASE_URL at import time; tests never connect, so any URL works.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

from backend import models  # noqa: E402, F401  Registers the tables on Base.metadata.
from backend.config import settings  # noqa: E402
from backend.database import Base, get_db  # noqa: E402
from backend.laws import LawHit  # noqa: E402
from backend.main import app  # noqa: E402

SAMPLES_DIR = Path(__file__).resolve().parents[1] / "sample_documents"


@pytest.fixture
def sample_pdf() -> bytes:
    return (SAMPLES_DIR / "employment-agreement.pdf").read_bytes()


@pytest.fixture
def db() -> Session:
    # One shared in-memory connection, so every session sees the same tables.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    # Configured like the app's sessions (database.SessionLocal).
    with sessionmaker(bind=engine, expire_on_commit=False)() as session:
        yield session
    engine.dispose()


@pytest.fixture(autouse=True)
def storage_dir(tmp_path, monkeypatch) -> Path:
    monkeypatch.setattr(settings, "storage_dir", tmp_path / "storage")
    return settings.storage_dir


@pytest.fixture
def client(db, monkeypatch) -> TestClient:
    monkeypatch.setattr(settings, "access_code", None)
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_pdf(page_count: int = 1) -> bytes:
    """Builds a minimal valid PDF with blank pages (no text layer)."""
    kids = " ".join(f"{3 + i} 0 R" for i in range(page_count))
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{kids}] /Count {page_count} >>".encode(),
        *[b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>"] * page_count,
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n%s\nendobj\n" % (number, body)
    xref_at = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for offset in offsets:
        out += b"%010d 00000 n \n" % offset
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        xref_at,
    )
    return bytes(out)


class FakeLlm:
    """Replays scripted JSON replies in order and records the prompts it was sent."""

    model = "fake-model"

    def __init__(self, *replies, session: Session | None = None):
        self.replies = list(replies)
        self.prompts: list[tuple[str, str]] = []
        # Given the request's session, records whether a transaction was open at each call.
        self.session = session
        self.open_transactions: list[bool] = []

    def complete_json(self, system: str, user: str, *, max_tokens: int):
        self.prompts.append((system, user))
        if self.session is not None:
            self.open_transactions.append(self.session.in_transaction())
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def law_hit(section_id: int, label: str = "174") -> LawHit:
    return LawHit(
        section_id=section_id,
        law_id="L-2",
        law_title="Canada Labour Code",
        kind="act",
        jurisdiction="federal",
        label=label,
        marginal_note="Overtime",
        text=f"Section {label} text.",
        url=f"https://laws-lois.justice.gc.ca/eng/acts/L-2/section-{label}.html",
        score=0.8,
    )
