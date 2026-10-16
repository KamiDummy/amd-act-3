import pytest

from backend.documents import create_document, pdf_path
from backend.highlights import MAX_ELLIPSIS_GAP, find_starts, locate, tokens


@pytest.fixture
def document(db, sample_pdf):
    return create_document(db, "contract.pdf", sample_pdf)


def words_of(document, page_number: int) -> list[str]:
    return document.pages[page_number - 1].text.split()


def find(document, quote: str, near_page: int | None = None):
    return locate(document, pdf_path(document.id), [quote], near_page)[0]


def test_find_starts_allows_partial_first_and_last_words():
    haystack = tokens("the employee shall work overtime hours")

    assert find_starts(haystack, tokens("ployee shall work over")) == [1]
    assert find_starts(haystack, tokens("employee shall rest")) == []
    assert find_starts(haystack, tokens("work")) == [3]
    assert find_starts(haystack, tokens("wor")) == []  # A single word must be whole.


def test_tokens_ignore_case_whitespace_and_curly_quotes():
    assert tokens("The  Employee’s\nDUTIES") == ["the", "employee's", "duties"]


def test_single_line_quote_gives_one_rect(document):
    quote = " ".join(words_of(document, 1)[:2])  # The title, "Employment Agreement".

    rects = find(document, quote)

    assert len(rects) == 1
    rect = rects[0]
    assert rect.page_number == 1
    assert 0 < rect.x0 < rect.x1 < 1
    assert 0 < rect.top < rect.bottom < 1


def test_multi_line_quote_gives_one_rect_per_line(document):
    quote = " ".join(words_of(document, 1)[10:70])

    rects = find(document, quote)

    assert len(rects) > 1
    assert {rect.page_number for rect in rects} == {1}
    tops = [rect.top for rect in rects]
    assert tops == sorted(tops)


def test_quote_spanning_two_pages_gives_rects_on_both(document):
    quote = " ".join(words_of(document, 1)[-8:] + words_of(document, 2)[:8])

    rects = find(document, quote)

    assert [rect.page_number for rect in rects][0] == 1
    assert [rect.page_number for rect in rects][-1] == 2


def test_reflowed_and_recased_quote_still_matches(document):
    words = words_of(document, 2)[5:25]
    quote = "\n  ".join(word.upper() for word in words)

    assert find(document, quote)


def test_partial_words_at_the_edges_still_match(document):
    words = words_of(document, 1)[20:30]
    words[0] = words[0][1:] or words[0]
    words[-1] = words[-1][:1]

    assert find(document, " ".join(words))


def test_repeated_text_prefers_near_page(document):
    # A word that appears on both page 1 and page 2.
    word = next(w for w in words_of(document, 2) if len(w) > 6 and w in words_of(document, 1))

    assert find(document, word)[0].page_number == 1
    assert find(document, word, near_page=2)[0].page_number == 2


def test_text_not_in_document_gives_no_rects(document):
    assert find(document, "this sentence is not in the contract at all") == []
    assert find(document, "   ") == []


def test_missing_pdf_file_gives_no_rects(document):
    pdf_path(document.id).unlink()

    assert find(document, " ".join(words_of(document, 1)[:2])) == []


def test_page_whose_boxes_dont_match_its_text_is_skipped(document):
    quote = " ".join(words_of(document, 1)[:5])
    document.pages[0].text += " extra"  # Now the stored text has one word more than the PDF.

    assert find(document, quote) == []


def test_locate_keeps_quote_order(document):
    first, second = " ".join(words_of(document, 2)[:3]), " ".join(words_of(document, 1)[:3])

    results = locate(document, pdf_path(document.id), [first, "missing words here", second])

    assert results[0][0].page_number == 2
    assert results[1] == []
    assert results[2][0].page_number == 1


@pytest.mark.parametrize("ellipsis", ["...", "\u2026", " ... "])
def test_quote_with_ellipsis_highlights_the_whole_passage(document, ellipsis):
    words = words_of(document, 1)
    full = find(document, " ".join(words[100:130]))
    shortened = " ".join(words[100:108]) + ellipsis + " ".join(words[122:130])

    assert find(document, shortened) == full


def test_ellipsis_parts_too_far_apart_do_not_match(document):
    words = words_of(document, 1) + words_of(document, 2)
    far = 10 + MAX_ELLIPSIS_GAP + 5
    shortened = " ".join(words[0:5]) + "..." + " ".join(words[far : far + 5])

    assert find(document, shortened) == []


def test_ellipsis_parts_out_of_order_do_not_match(document):
    words = words_of(document, 1)

    assert find(document, " ".join(words[120:126]) + "..." + " ".join(words[100:106])) == []
