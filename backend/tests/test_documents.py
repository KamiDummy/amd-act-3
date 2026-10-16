import uuid

import pytest
from alembic import command
from alembic.config import Config
from pydantic import SecretStr
from sqlalchemy import create_engine

from backend import documents
from backend.config import settings
from backend.schema_check import (
    ALEMBIC_INI,
    SchemaOutOfDateError,
    ensure_schema_up_to_date,
)
from backend.seed import seed
from conftest import SAMPLES_DIR


def upload(client, data: bytes, filename: str = "contract.pdf"):
    return client.post(
        "/api/documents", files={"file": (filename, data, "application/pdf")}
    )


def test_upload_stores_document_and_file(client, sample_pdf, storage_dir):
    response = upload(client, sample_pdf)

    assert response.status_code == 201
    body = response.json()
    assert body["filename"] == "contract.pdf"
    assert body["page_count"] == 3
    assert body["size_bytes"] == len(sample_pdf)
    assert body["char_count"] > 0
    assert body["is_sample"] is False
    assert (storage_dir / f"{body['id']}.pdf").read_bytes() == sample_pdf


def test_upload_strips_directories_from_filename(client, sample_pdf):
    response = upload(client, sample_pdf, filename="../../etc/contract.pdf")

    assert response.json()["filename"] == "contract.pdf"


def test_upload_rejects_invalid_pdf(client, storage_dir):
    response = upload(client, b"not a pdf")

    assert response.status_code == 422
    assert response.json() == {"detail": "This file is not a valid PDF."}
    assert not storage_dir.exists()


def test_upload_rejects_oversized_file(client, monkeypatch):
    monkeypatch.setattr(documents, "MAX_SIZE_BYTES", 10)

    response = upload(client, b"%PDF-" + b"x" * 10)

    assert response.status_code == 413


def test_upload_requires_file(client):
    assert client.post("/api/documents").status_code == 422


def test_list_returns_documents_without_text(client, sample_pdf):
    first = upload(client, sample_pdf, filename="first.pdf").json()

    response = client.get("/api/documents")

    assert response.status_code == 200
    assert response.json() == [first]
    assert "pages" not in response.json()[0]


def test_get_returns_page_text(client, sample_pdf):
    document_id = upload(client, sample_pdf).json()["id"]

    response = client.get(f"/api/documents/{document_id}")

    assert response.status_code == 200
    pages = response.json()["pages"]
    assert [page["page_number"] for page in pages] == [1, 2, 3]
    assert pages[0]["text"].startswith("Employment Agreement")


def test_get_unknown_document_is_404(client):
    assert client.get(f"/api/documents/{uuid.uuid4()}").status_code == 404


def test_get_file_returns_pdf(client, sample_pdf):
    document_id = upload(client, sample_pdf).json()["id"]

    response = client.get(f"/api/documents/{document_id}/file")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("inline")
    assert response.content == sample_pdf


def test_get_file_missing_on_disk_is_404(client, sample_pdf, storage_dir):
    document_id = upload(client, sample_pdf).json()["id"]
    (storage_dir / f"{document_id}.pdf").unlink()

    assert client.get(f"/api/documents/{document_id}/file").status_code == 404


def test_document_routes_require_token_when_gate_on(client, monkeypatch):
    monkeypatch.setattr(settings, "access_code", SecretStr("secret"))

    assert client.get("/api/documents").status_code == 401
    assert client.post("/api/documents").status_code == 401


def test_seed_adds_samples_once(db, client):
    added = seed(db)

    assert added == sorted(path.name for path in SAMPLES_DIR.glob("*.pdf"))
    assert seed(db) == []
    listed = client.get("/api/documents").json()
    assert len(listed) == len(added)
    assert all(document["is_sample"] for document in listed)


def test_schema_check_fails_on_unmigrated_database():
    engine = create_engine("sqlite://")

    with pytest.raises(SchemaOutOfDateError, match="alembic upgrade head"):
        ensure_schema_up_to_date(engine)


def test_schema_check_passes_on_migrated_database(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'migrated.db'}"
    monkeypatch.setattr(settings, "database_url", url)
    command.upgrade(Config(ALEMBIC_INI), "head")

    ensure_schema_up_to_date(create_engine(url))
