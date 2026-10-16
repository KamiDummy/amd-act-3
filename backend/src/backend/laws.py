"""Parsing, embedding and searching Canadian federal Acts and regulations.

Source: the Justice Laws consolidated XML (Open Government Licence - Canada),
https://github.com/justicecanada/laws-lois-xml
"""

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from sentence_transformers import SentenceTransformer
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models import EMBEDDING_DIM, Law, LawSection

EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
# bge models embed queries with this prefix; passages get none.
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "
MAX_CHUNK_CHARS = 1800
MIN_SECTION_CHARS = 20
LINE_BREAK_AFTER = {"Paragraph", "Subparagraph", "Definition", "Subsection", "Text"}
SKIPPED = {"HistoricalNote", "MarginalNote", "Label"}


@dataclass
class ParsedSection:
    label: str
    part: int
    heading: str | None
    marginal_note: str | None
    text: str


@dataclass
class ParsedAct:
    id: str
    kind: str  # "act" or "regulation"
    title: str
    long_title: str | None
    sections: list[ParsedSection]


@dataclass
class LawHit:
    law_id: str
    law_title: str
    kind: str
    label: str
    marginal_note: str | None
    text: str
    url: str
    score: float


@lru_cache
def get_model() -> SentenceTransformer:
    return SentenceTransformer(EMBEDDING_MODEL)


def embed_passages(texts: list[str]) -> list[list[float]]:
    return get_model().encode(texts, normalize_embeddings=True, batch_size=32).tolist()


def embed_query(text: str) -> list[float]:
    return get_model().encode(QUERY_PREFIX + text, normalize_embeddings=True).tolist()


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _text_of(element: ET.Element) -> str:
    """Visible text of an element, minus amendment history notes."""
    parts: list[str] = []

    def walk(node: ET.Element) -> None:
        if _local(node.tag) in SKIPPED:
            return
        if node.text:
            parts.append(node.text)
        for child in node:
            walk(child)
            if _local(child.tag) in LINE_BREAK_AFTER:
                parts.append("\n")
            if child.tail:
                parts.append(child.tail)

    walk(element)
    lines = (" ".join(line.split()) for line in "".join(parts).split("\n"))
    return "\n".join(line for line in lines if line)


def _split(text: str) -> list[str]:
    """Splits on line breaks into slices of at most MAX_CHUNK_CHARS."""
    chunks: list[str] = []
    current = ""
    for line in text.split("\n"):
        while len(line) > MAX_CHUNK_CHARS:
            cut = line.rfind(" ", 0, MAX_CHUNK_CHARS)
            if cut <= 0:
                cut = MAX_CHUNK_CHARS
            if current:
                chunks.append(current)
                current = ""
            chunks.append(line[:cut])
            line = line[cut:].lstrip()
        if current and len(current) + len(line) + 1 > MAX_CHUNK_CHARS:
            chunks.append(current)
            current = ""
        current = f"{current}\n{line}" if current else line
    if current:
        chunks.append(current)
    return chunks


def parse_act(path: Path) -> ParsedAct | None:
    """Parses an Act or regulation XML file. Returns None for anything else or for
    laws with no text left (repealed)."""
    root = ET.parse(path).getroot()
    kind = {"Statute": "act", "Regulation": "regulation"}.get(_local(root.tag))
    ident = root.find("Identification")
    if kind is None or ident is None:
        return None
    title = (ident.findtext("ShortTitle") or ident.findtext("LongTitle") or "").strip()
    if not title:
        return None
    # File names are the stable ids on the Justice Laws site, e.g. C-46, SOR-2000-111.
    number = path.stem

    sections: list[ParsedSection] = []
    body = root.find("Body")
    heading: str | None = None
    for node in body if body is not None else []:
        tag = _local(node.tag)
        if tag == "Heading":
            if node.get("level") == "1":
                heading = (node.findtext("TitleText") or "").strip() or None
            continue
        if tag != "Section":
            continue
        text = _text_of(node)
        if len(text) < MIN_SECTION_CHARS or "[Repealed" in text[:40]:
            continue
        note = (node.findtext("MarginalNote") or "").strip() or None
        label = (node.findtext("Label") or "").strip()
        for part, chunk in enumerate(_split(text)):
            sections.append(ParsedSection(label, part, heading, note, chunk))
    if not sections:
        return None
    return ParsedAct(
        number,
        kind,
        title,
        (ident.findtext("LongTitle") or "").strip() or None,
        sections,
    )


def embedding_input(act: ParsedAct, section: ParsedSection) -> str:
    """The text that gets embedded: context first, so short sections stay findable."""
    head = f"{act.title}, s. {section.label}"
    if section.marginal_note:
        head += f" ({section.marginal_note})"
    return f"{head}\n{section.text}"


def store_act(db: Session, act: ParsedAct) -> int:
    """Replaces an Act and its sections in the database. Returns the section count."""
    existing = db.get(Law, act.id)
    if existing:
        db.delete(existing)
        db.flush()
    vectors = embed_passages([embedding_input(act, s) for s in act.sections])
    assert not vectors or len(vectors[0]) == EMBEDDING_DIM
    db.add(
        Law(
            id=act.id,
            kind=act.kind,
            title=act.title,
            long_title=act.long_title,
            url=f"https://laws-lois.justice.gc.ca/eng/{act.kind}s/{act.id}/index.html",
            sections=[
                LawSection(
                    label=s.label,
                    part=s.part,
                    heading=s.heading,
                    marginal_note=s.marginal_note,
                    text=s.text,
                    embedding=v,
                )
                for s, v in zip(act.sections, vectors)
            ],
        )
    )
    db.commit()
    return len(act.sections)


def search_laws(db: Session, query: str, limit: int = 5) -> list[LawHit]:
    """The sections most similar to `query`, best first. Score is cosine similarity."""
    distance = LawSection.embedding.cosine_distance(embed_query(query))
    rows = db.execute(
        select(LawSection, Law, distance.label("distance"))
        .join(Law)
        .order_by(distance)
        .limit(limit)
    )
    return [
        LawHit(
            law_id=law.id,
            law_title=law.title,
            kind=law.kind,
            label=sec.label,
            marginal_note=sec.marginal_note,
            text=sec.text,
            url=law.url,
            score=1 - dist,
        )
        for sec, law, dist in rows
    ]
