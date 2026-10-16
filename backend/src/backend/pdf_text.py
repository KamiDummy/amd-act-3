from io import BytesIO

import pdfplumber
from pdfminer.pdfparser import PDFSyntaxError
from pdfplumber.utils.exceptions import PdfminerException

MAX_SIZE_MB = 20
MAX_PAGES = 100
# Roughly 100 dense pages; stops huge text-only PDFs that stay under the page limit.
MAX_CHARS = 300_000


class PdfError(Exception):
    """A PDF we can't accept. The message is safe to show to the user."""


def extract_pages(data: bytes) -> list[str]:
    """Returns the text of each page, or raises PdfError if the PDF is unusable."""
    if not data.startswith(b"%PDF-"):
        raise PdfError("This file is not a valid PDF.")

    try:
        with pdfplumber.open(BytesIO(data)) as pdf:
            if len(pdf.pages) > MAX_PAGES:
                raise PdfError(
                    f"This PDF has {len(pdf.pages)} pages. The limit is {MAX_PAGES}."
                )
            # Postgres text columns can't hold NUL characters, which some PDFs emit.
            pages = [
                (page.extract_text() or "").replace("\x00", "") for page in pdf.pages
            ]
    except (PdfminerException, PDFSyntaxError) as exc:
        raise PdfError(
            "This PDF could not be read. It may be damaged or password-protected."
        ) from exc

    char_count = sum(len(text) for text in pages)
    if not any(text.strip() for text in pages):
        raise PdfError(
            "This PDF has no selectable text (it looks scanned). "
            "Only text-based PDFs are supported."
        )
    if char_count > MAX_CHARS:
        raise PdfError(
            f"This PDF has too much text ({char_count:,} characters). "
            f"The limit is {MAX_CHARS:,}."
        )
    return pages
