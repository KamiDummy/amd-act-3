import uuid
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models import Document, DocumentPage
from backend.pdf_text import MAX_SIZE_MB, PdfError, extract_pages

MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

router = APIRouter(prefix="/documents", tags=["documents"])

DbSession = Annotated[Session, Depends(get_db)]


class DocumentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    size_bytes: int
    page_count: int
    char_count: int
    is_sample: bool
    created_at: datetime


class PageText(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    page_number: int
    text: str


class DocumentDetail(DocumentSummary):
    pages: list[PageText]


def pdf_path(document_id: uuid.UUID) -> Path:
    return settings.storage_dir / f"{document_id}.pdf"


def create_document(
    db: Session, filename: str, data: bytes, *, is_sample: bool = False
) -> Document:
    """Extracts the text, saves the PDF to disk and stores the document. Raises PdfError."""
    pages = extract_pages(data)
    document = Document(
        id=uuid.uuid4(),
        filename=filename,
        size_bytes=len(data),
        page_count=len(pages),
        char_count=sum(len(text) for text in pages),
        is_sample=is_sample,
        pages=[
            DocumentPage(page_number=number, text=text)
            for number, text in enumerate(pages, start=1)
        ],
    )

    path = pdf_path(document.id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    db.add(document)
    try:
        db.commit()
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)  # Don't leave a file with no database row.
        raise
    db.refresh(document)
    return document


def get_document_or_404(db: Session, document_id: uuid.UUID) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return document


@router.get("")
def list_documents(db: DbSession) -> list[DocumentSummary]:
    documents = db.scalars(
        select(Document).order_by(Document.created_at.desc(), Document.filename)
    )
    return [DocumentSummary.model_validate(document) for document in documents]


@router.post("", status_code=status.HTTP_201_CREATED)
def upload_document(file: UploadFile, db: DbSession) -> DocumentSummary:
    # Read one byte past the limit so oversized files are caught without loading them whole.
    data = file.file.read(MAX_SIZE_BYTES + 1)
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File is larger than {MAX_SIZE_MB} MB.",
        )

    filename = Path(file.filename or "document.pdf").name
    try:
        document = create_document(db, filename, data)
    except PdfError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    return DocumentSummary.model_validate(document)


@router.get("/{document_id}")
def get_document(document_id: uuid.UUID, db: DbSession) -> DocumentDetail:
    document = get_document_or_404(db, document_id)
    return DocumentDetail.model_validate(document)


@router.get("/{document_id}/file", response_class=FileResponse)
def get_document_file(document_id: uuid.UUID, db: DbSession) -> FileResponse:
    document = get_document_or_404(db, document_id)
    path = pdf_path(document.id)
    if not path.is_file():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="The PDF file for this document is missing."
        )
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=document.filename,
        content_disposition_type="inline",
    )
