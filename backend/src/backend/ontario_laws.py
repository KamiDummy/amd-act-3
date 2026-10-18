"""Loads Ontario statutes from e-Laws into the vector database, next to federal law.

Run from the backend directory:
    uv run python -m backend.ontario_laws            # the statutes in STATUTES
    uv run python -m backend.ontario_laws 00e41      # just these (e-Laws names)

Safe to run again: each run replaces the statute with the current version.

Source: e-Laws (https://www.ontario.ca/laws), the official consolidated law of Ontario.
Its site reads each statute as HTML from a JSON API, which is what this uses.
"""

import argparse
import html
import json
import re
import urllib.request

from backend.database import SessionLocal
from backend.laws import MIN_SECTION_CHARS, ParsedAct, ParsedSection, _split, store_act

API = "https://www.ontario.ca/laws/api/v2/legislation/en/doc-search/statute"
PAGE = "https://www.ontario.ca/laws/statute"

# The statutes behind the contracts people bring most: jobs and rentals.
STATUTES = {
    "00e41": "Employment Standards Act, 2000",
    "06r17": "Residential Tenancies Act, 2006",
}

# Paragraph classes that hold a section's text. Others are tables of contents,
# amendment notes, or "Y"-prefixed provisions that are not yet in force.
BODY_CLASSES = {
    "subsection",
    "paragraph",
    "subpara",
    "subsubpara",
    "clause",
    "subclause",
    "definition",
    "table",
    "equation",
}
HEADING_CLASSES = {"partnum", "heading1"}

PARAGRAPH = re.compile(r'<p class="([^"]+)"[^>]*>(.*?)</p>', re.DOTALL)
ANCHOR = re.compile(r'<a name="(BK\d+)">')
LABEL = re.compile(r"<b>\s*([^<]+?)\s*</b>")
# Amendment citations ("2017, c. 22, Sched. 1, s. 21.") run to the end of a paragraph.
CITATION = re.compile(r'<span class="citation">.*', re.DOTALL)
TAG = re.compile(r"<[^>]+>")


def _text(fragment: str) -> str:
    return " ".join(html.unescape(TAG.sub(" ", CITATION.sub("", fragment))).split())


def parse_statute(name: str, document: dict) -> ParsedAct | None:
    """Parses an e-Laws statute (the API's JSON) into sections. None if it has none."""
    sections: list[ParsedSection] = []
    heading: str | None = None
    headnotes: list[str] = []
    current: dict | None = None

    def finish() -> None:
        if current is None:
            return
        text = "\n".join(current["lines"])
        if len(text) < MIN_SECTION_CHARS or "[Repealed" in text[:40]:
            return
        for part, chunk in enumerate(_split(text)):
            sections.append(
                ParsedSection(
                    current["label"], part, heading, current["note"], chunk, current["anchor"]
                )
            )

    for match in PARAGRAPH.finditer(document["content"]):
        kind, inner = match.group(1).split()[0], match.group(2)
        if kind in HEADING_CLASSES:
            finish()
            current = None
            heading = _text(inner) or heading
        elif kind == "headnote":
            headnotes.append(_text(inner))
        elif kind == "section":
            finish()
            anchor = ANCHOR.search(inner)
            label = LABEL.search(inner)
            first = _text(LABEL.sub("", inner, count=1))
            current = {
                "label": label.group(1).strip() if label else "",
                "anchor": anchor.group(1) if anchor else None,
                # The first note names the section; later ones, its subsections.
                "note": headnotes[0] if headnotes else None,
                "lines": [first] if first else [],
            }
            headnotes = []
        elif kind in BODY_CLASSES and current is not None:
            line = _text(inner)
            if headnotes:
                line = f"{' / '.join(headnotes)}: {line}"
                headnotes = []
            if line:
                current["lines"].append(line)
    finish()

    if not sections:
        return None
    title = (document.get("actName") or {}).get("en") or STATUTES.get(name) or name
    return ParsedAct(
        id=f"ON-{name}",
        kind="act",
        title=title,
        long_title=document.get("title"),
        sections=sections,
        jurisdiction="ontario",
        url=f"{PAGE}/{name}",
    )


def fetch_statute(name: str) -> dict:
    # e-Laws turns away requests without a browser-like User-Agent.
    request = urllib.request.Request(f"{API}/{name}", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def main() -> None:
    parser = argparse.ArgumentParser(description="Load Ontario statutes into the vector database.")
    parser.add_argument("names", nargs="*", help="e-Laws names, e.g. 00e41 (default: all)")
    args = parser.parse_args()

    for name in args.names or STATUTES:
        act = parse_statute(name, fetch_statute(name))
        if act is None:
            print(f"{name}: no sections found")
            continue
        with SessionLocal() as db:
            count = store_act(db, act)
        print(f"{act.id} {act.title}: {count} sections", flush=True)


if __name__ == "__main__":
    main()
