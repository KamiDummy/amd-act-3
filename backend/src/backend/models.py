import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    filename: Mapped[str]
    size_bytes: Mapped[int]
    page_count: Mapped[int]
    char_count: Mapped[int]
    # Demo documents shipped with the repo, loaded by `python -m backend.seed`.
    is_sample: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    pages: Mapped[list[DocumentPage]] = relationship(
        back_populates="document",
        order_by="DocumentPage.page_number",
        cascade="all, delete-orphan",
    )


class DocumentPage(Base):
    __tablename__ = "document_pages"

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True
    )
    # 1-based, matching the page numbers people see in a PDF viewer.
    page_number: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(Text)

    document: Mapped[Document] = relationship(back_populates="pages")


EMBEDDING_DIM = 384


class Law(Base):
    """An Act or regulation: federal ones from the Justice Laws consolidated XML,
    Ontario ones from e-Laws."""

    __tablename__ = "laws"

    # Federal: the Justice Laws file name, e.g. "C-46" (Criminal Code) or "SOR-2000-111".
    # Ontario: "ON-" and the e-Laws name, e.g. "ON-00e41".
    id: Mapped[str] = mapped_column(primary_key=True)
    kind: Mapped[str]  # "act" or "regulation"
    # "federal" or a province, e.g. "ontario".
    jurisdiction: Mapped[str] = mapped_column(default="federal", server_default="federal")
    title: Mapped[str]
    long_title: Mapped[str | None] = mapped_column(Text)
    # The law's page on its government site.
    url: Mapped[str]

    sections: Mapped[list[LawSection]] = relationship(
        back_populates="law", cascade="all, delete-orphan"
    )


class LawSection(Base):
    """One searchable piece of an Act: a section, or a slice of a long one."""

    __tablename__ = "law_sections"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    law_id: Mapped[str] = mapped_column(
        ForeignKey("laws.id", ondelete="CASCADE"), index=True
    )
    # Section label as printed, e.g. "2" or "83.01".
    label: Mapped[str]
    # Which slice of the section this is, when a long one is split.
    part: Mapped[int] = mapped_column(default=0)
    heading: Mapped[str | None]
    marginal_note: Mapped[str | None]
    # The section's anchor on the law's page, where the site has no page per section
    # (e-Laws, e.g. "BK68"). Federal sections have their own pages, so this is empty.
    anchor: Mapped[str | None]
    text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))

    law: Mapped[Law] = relationship(back_populates="sections")
