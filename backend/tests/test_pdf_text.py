import pytest

from backend import pdf_text
from backend.pdf_text import PdfError, extract_pages
from conftest import make_pdf


def test_extracts_text_per_page(sample_pdf):
    pages = extract_pages(sample_pdf)

    assert len(pages) == 3
    assert pages[0].startswith("Employment Agreement")


def test_rejects_non_pdf():
    with pytest.raises(PdfError, match="not a valid PDF"):
        extract_pages(b"just some text")


def test_rejects_damaged_pdf():
    with pytest.raises(PdfError, match="could not be read"):
        extract_pages(b"%PDF-1.4\nthis is not really a pdf")


def test_rejects_pdf_without_text():
    with pytest.raises(PdfError, match="no selectable text"):
        extract_pages(make_pdf(page_count=2))


def test_rejects_too_many_pages(monkeypatch):
    monkeypatch.setattr(pdf_text, "MAX_PAGES", 2)

    with pytest.raises(PdfError, match="3 pages. The limit is 2"):
        extract_pages(make_pdf(page_count=3))


def test_rejects_too_much_text(sample_pdf, monkeypatch):
    monkeypatch.setattr(pdf_text, "MAX_CHARS", 100)

    with pytest.raises(PdfError, match="too much text"):
        extract_pages(sample_pdf)
