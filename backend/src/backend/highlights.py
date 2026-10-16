"""Finds where a piece of text sits in a stored PDF, as rectangles to draw over its pages.

Shared by every feature that points at the document: loophole findings, a user's
selection and the sources behind a Q&A answer. A match can span several pages.

Matching is word by word and ignores case, whitespace and curly quotes. The first and
last words may be partial, because selections and truncated quotes can cut a word.
The stored page text and pdfplumber's word boxes come from the same extraction, so the
n-th word of a page's text is its n-th box. The PDF is only opened for pages with a match.
"""

from pathlib import Path

import pdfplumber
from pydantic import BaseModel

from backend.models import Document

CURLY_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"'})
# Words whose tops are this close, in points, are on the same line.
LINE_TOLERANCE = 2.0


class HighlightRect(BaseModel):
    """One line of highlighted text. Coordinates are fractions (0 to 1) of the page's
    width and height, from its top-left corner, so they work at any zoom."""

    page_number: int
    x0: float
    top: float
    x1: float
    bottom: float


def tokens(text: str) -> list[str]:
    return text.translate(CURLY_QUOTES).casefold().split()


def find_starts(haystack: list[str], needle: list[str]) -> list[int]:
    """Indexes where `needle` occurs in `haystack`. With more than one word, the first
    may be the end of a word and the last the start of one."""
    size = len(needle)
    if size == 1:
        return [i for i, word in enumerate(haystack) if word == needle[0]]
    return [
        i
        for i in range(len(haystack) - size + 1)
        if haystack[i].endswith(needle[0])
        and haystack[i + size - 1].startswith(needle[-1])
        and haystack[i + 1 : i + size - 1] == needle[1:-1]
    ]


def _line_rects(
    page_number: int, words: list[dict], width: float, height: float
) -> list[HighlightRect]:
    """Merges consecutive words on the same line into one rectangle each."""
    rects: list[HighlightRect] = []
    line: dict | None = None
    for word in words:
        if line and abs(word["top"] - line["top"]) <= LINE_TOLERANCE:
            line["x1"] = max(line["x1"], word["x1"])
            line["bottom"] = max(line["bottom"], word["bottom"])
            continue
        if line:
            rects.append(_scaled(page_number, line, width, height))
        line = {key: word[key] for key in ("x0", "top", "x1", "bottom")}
    if line:
        rects.append(_scaled(page_number, line, width, height))
    return rects


def _scaled(page_number: int, box: dict, width: float, height: float) -> HighlightRect:
    return HighlightRect(
        page_number=page_number,
        x0=round(box["x0"] / width, 4),
        top=round(box["top"] / height, 4),
        x1=round(box["x1"] / width, 4),
        bottom=round(box["bottom"] / height, 4),
    )


def locate(
    document: Document,
    pdf: Path,
    quotes: list[str],
    near_page: int | None = None,
) -> list[list[HighlightRect]]:
    """Rectangles for each quote, in order. Empty for a quote that isn't in the document.

    When a quote occurs more than once, the match starting closest to `near_page` wins,
    or the first one if no page is given.
    """
    # Every word of the document, with the page it is on and its index on that page.
    words: list[str] = []
    positions: list[tuple[int, int]] = []
    word_counts: dict[int, int] = {}
    for page in document.pages:
        page_words = tokens(page.text)
        words += page_words
        positions += [(page.page_number, i) for i in range(len(page_words))]
        word_counts[page.page_number] = len(page_words)

    spans: list[list[tuple[int, int]]] = []
    for quote in quotes:
        needle = tokens(quote)
        starts = find_starts(words, needle) if needle else []
        if not starts:
            spans.append([])
            continue
        start = starts[0]
        if near_page is not None:
            start = min(starts, key=lambda s: abs(positions[s][0] - near_page))
        spans.append(positions[start : start + len(needle)])

    pages_needed = {page_number for span in spans for page_number, _ in span}
    if not pages_needed or not pdf.is_file():
        return [[] for _ in quotes]

    boxes: dict[int, tuple[float, float, list[dict]]] = {}
    with pdfplumber.open(pdf) as opened:
        for page_number in pages_needed:
            page = opened.pages[page_number - 1]
            page_boxes = page.extract_words()
            # Skip a page whose boxes don't line up with its stored text, rather than
            # highlight the wrong words.
            if len(page_boxes) == word_counts[page_number]:
                boxes[page_number] = (page.width, page.height, page_boxes)

    results: list[list[HighlightRect]] = []
    for span in spans:
        rects: list[HighlightRect] = []
        for page_number in sorted({page_number for page_number, _ in span}):
            if page_number not in boxes:
                continue
            width, height, page_boxes = boxes[page_number]
            matched = [page_boxes[i] for page, i in span if page == page_number]
            rects += _line_rects(page_number, matched, width, height)
        results.append(rects)
    return results
