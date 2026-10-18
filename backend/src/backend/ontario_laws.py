"""Loads Ontario statutes and regulations from e-Laws into the vector database, next to
federal law.

Run from the backend directory:
    uv run python -m backend.ontario_laws                     # everything in LAWS
    uv run python -m backend.ontario_laws 00e41               # a statute, by e-Laws name
    uv run python -m backend.ontario_laws regulation/050017   # a regulation
    uv run python -m backend.ontario_laws --max-mb 450        # stop at a smaller database

Safe to run again: each law is replaced with its current version. Loading stops once the
database reaches --max-mb (see database.MAX_LAW_LOAD_MB).

Source: e-Laws (https://www.ontario.ca/laws), the official consolidated law of Ontario.
Its site reads each law as HTML from a JSON API, which is what this uses.
"""

import argparse
import html
import json
import re
import urllib.request

from backend.database import MAX_LAW_LOAD_MB, SessionLocal, database_size_mb
from backend.laws import MIN_SECTION_CHARS, ParsedAct, ParsedSection, _split, store_act

API = "https://www.ontario.ca/laws/api/v2/legislation/en/doc-search"
PAGE = "https://www.ontario.ca/laws"

# What gets loaded, most useful first, as e-Laws paths: the laws behind the contracts
# people bring most (jobs, homes, purchases, loans) and their main regulations.
LAWS = [
    # Jobs
    "statute/00e41",  # Employment Standards Act, 2000
    "regulation/010285",  # O. Reg. 285/01, its exemptions and special rules
    "statute/90h19",  # Human Rights Code
    "statute/90o01",  # Occupational Health and Safety Act
    "statute/97w16",  # Workplace Safety and Insurance Act, 1997
    "statute/90p07",  # Pay Equity Act
    # Homes
    "statute/06r17",  # Residential Tenancies Act, 2006
    "regulation/060516",  # O. Reg. 516/06, its general regulation
    "statute/98c19",  # Condominium Act, 1998
    # Buying, borrowing and services
    "statute/02c30",  # Consumer Protection Act, 2002 (car rentals, gyms, purchases)
    "regulation/050017",  # O. Reg. 17/05, its general regulation
    "statute/90s01",  # Sale of Goods Act
    "statute/08p09",  # Payday Loans Act, 2008
    "statute/90c14",  # Collection and Debt Settlement Services Act
    "statute/90c33",  # Consumer Reporting Act
    "statute/90r25",  # Repair and Storage Liens Act
    "statute/90p10",  # Personal Property Security Act
    "statute/06m29",  # Mortgage Brokerages, Lenders and Administrators Act, 2006
    "statute/02r30",  # Trust in Real Estate Services Act, 2002
    "statute/00a03",  # Arthur Wishart Act (Franchise Disclosure), 2000
    "statute/90i08",  # Insurance Act
    # Any contract
    "statute/02l24",  # Limitations Act, 2002
    "statute/00e17",  # Electronic Commerce Act, 2000
    "statute/04p03",  # Personal Health Information Protection Act, 2004
]

# Paragraph classes that hold a section's text, without the "-e" regulations add. Others
# are tables of contents, amendment notes, or "Y"-prefixed provisions not yet in force.
BODY_CLASSES = {
    "subsection",
    "paragraph",
    "subpara",
    "subsubpara",
    "clause",
    "subclause",
    "subsubclause",
    "definition",
    "defclause",
    "defsubclause",
    "defpara",
    "paranoindt",
    "parawindt",
    "table",
    "equation",
}
HEADING_CLASSES = {"partnum", "heading1"}

PARAGRAPH = re.compile(r'<p class="([^"]+)"[^>]*>(.*?)</p>', re.DOTALL)
ANCHOR = re.compile(r'<a name="(BK\d+)">')
# A section's number is its first bold run with text; the anchor is sometimes inside it,
# as in <b> <a name="BK52"></a>26.</b>.
BOLD = re.compile(r"<b>(.*?)</b>", re.DOTALL)
# A plain-text section number at the start of a line, as schedules number their items.
LEADING_NUMBER = re.compile(r"(\d+(?:\.\d+)*)\.?\s+")
# Amendment citations ("2017, c. 22, Sched. 1, s. 21.") run to the end of a paragraph.
CITATION = re.compile(r'<span class="citation">.*', re.DOTALL)
TAG = re.compile(r"<[^>]+>")


def law_path(name: str) -> str:
    """An e-Laws path: "regulation/050017" as is, a bare name like "00e41" as a statute."""
    return name if "/" in name else f"statute/{name}"


def _text(fragment: str) -> str:
    return " ".join(html.unescape(TAG.sub(" ", CITATION.sub("", fragment))).split())


def _class(attribute: str) -> str:
    """The paragraph's kind: its first class, without the "-e" that regulations add."""
    kind = attribute.split()[0]
    return kind.removesuffix("-e")


def _label(inner: str) -> tuple[str, str]:
    """The section's number ("26", no trailing period) and the rest of its first line."""
    for match in BOLD.finditer(inner):
        label = _text(match.group(1)).rstrip(".")
        if label:
            return label, inner[: match.start()] + inner[match.end() :]
    return "", inner


def _regulation_number(name: str) -> str:
    """e-Laws name "050017" as it is cited: "O. Reg. 17/05"."""
    return f"O. Reg. {int(name[2:])}/{name[:2]}"


def parse_law(path: str, document: dict) -> ParsedAct | None:
    """Parses an e-Laws statute or regulation (the API's JSON) into sections. None if
    it has none."""
    kind, name = path.split("/", 1)
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
        cls, inner = _class(match.group(1)), match.group(2)
        if cls in HEADING_CLASSES:
            finish()
            current = None
            heading = _text(inner) or heading
        elif cls == "headnote":
            headnotes.append(_text(inner))
        elif cls == "section":
            anchor = ANCHOR.search(inner)
            label, rest = _label(inner)
            first = _text(rest)
            if not label:
                # A schedule's items are numbered in plain text: "1 The public sector…".
                number = LEADING_NUMBER.match(first)
                if number:
                    label, first = number.group(1), first[number.end() :]
                elif current is not None:
                    # Not a new section: the rest of the current one, e.g. after a list.
                    if first:
                        current["lines"].append(first)
                    continue
            finish()
            current = {
                "label": label,
                "anchor": anchor.group(1) if anchor else None,
                # The first note names the section; later ones, its subsections.
                "note": headnotes[0] if headnotes else None,
                "lines": [first] if first else [],
            }
            headnotes = []
        elif cls in BODY_CLASSES and current is not None:
            line = _text(inner)
            if headnotes:
                line = f"{' / '.join(headnotes)}: {line}"
                headnotes = []
            if line:
                current["lines"].append(line)
    finish()

    if not sections:
        return None
    act_name = (document.get("actName") or {}).get("en") or name
    if kind == "regulation":
        law_id = f"ON-R-{name}"
        title = f"{_regulation_number(name)} under the {act_name}"
    else:
        law_id = f"ON-{name}"
        title = act_name
    return ParsedAct(
        id=law_id,
        kind="regulation" if kind == "regulation" else "act",
        title=title,
        long_title=document.get("title"),
        sections=sections,
        jurisdiction="ontario",
        url=f"{PAGE}/{path}",
    )


def fetch_law(path: str) -> dict:
    # e-Laws turns away requests without a browser-like User-Agent.
    request = urllib.request.Request(f"{API}/{path}", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def main() -> None:
    parser = argparse.ArgumentParser(description="Load Ontario laws into the vector database.")
    parser.add_argument("names", nargs="*", help="e-Laws names or paths (default: all of LAWS)")
    parser.add_argument(
        "--max-mb", type=float, default=MAX_LAW_LOAD_MB, help="stop at this database size (MiB)"
    )
    args = parser.parse_args()

    for path in [law_path(n) for n in args.names] or LAWS:
        with SessionLocal() as db:
            size = database_size_mb(db)
        if size >= args.max_mb:
            print(f"Stopped: the database is {size:.0f} MiB (limit {args.max_mb:.0f}).")
            return
        act = parse_law(path, fetch_law(path))
        if act is None:
            print(f"{path}: no sections found")
            continue
        with SessionLocal() as db:
            count = store_act(db, act)
        print(f"{act.id} {act.title}: {count} sections ({size:.0f} MiB before)", flush=True)


if __name__ == "__main__":
    main()
