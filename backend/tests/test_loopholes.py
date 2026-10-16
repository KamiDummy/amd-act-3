import uuid

import pytest
from pydantic import SecretStr

from backend import loopholes
from backend.config import settings
from backend.laws import LawHit
from backend.llm import LlmError, get_llm
from backend.main import app


class FakeLlm:
    """Replays scripted JSON replies in order and records the prompts it was sent."""

    model = "fake-model"

    def __init__(self, *replies):
        self.replies = list(replies)
        self.prompts: list[tuple[str, str]] = []

    def complete_json(self, system: str, user: str, *, max_tokens: int):
        self.prompts.append((system, user))
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def law_hit(section_id: int, label: str = "174") -> LawHit:
    return LawHit(
        section_id=section_id,
        law_id="L-2",
        law_title="Canada Labour Code",
        kind="act",
        label=label,
        marginal_note="Overtime",
        text=f"Section {label} text.",
        url="https://laws-lois.justice.gc.ca/eng/acts/L-2/index.html",
        score=0.8,
    )


@pytest.fixture
def searches(monkeypatch) -> list[str]:
    """Stubs the vector search (SQLite has no pgvector). Records the queries."""
    queries: list[str] = []

    def fake_search(db, query, limit=5):
        queries.append(query)
        base = len(queries) * 10
        return [law_hit(base + 1, "174"), law_hit(base + 2, "230")]

    monkeypatch.setattr(loopholes, "search_laws", fake_search)
    return queries


@pytest.fixture
def document(client, sample_pdf) -> dict:
    response = client.post(
        "/api/documents", files={"file": ("contract.pdf", sample_pdf, "application/pdf")}
    )
    return client.get(f"/api/documents/{response.json()['id']}").json()


def use_llm(llm: FakeLlm) -> FakeLlm:
    app.dependency_overrides[get_llm] = lambda: llm
    return llm


def scan(client, document_id):
    return client.post(f"/api/documents/{document_id}/loopholes")


def issue(quote: str, title: str = "Unpaid overtime") -> dict:
    return {
        "quote": quote,
        "title": title,
        "concern": "The employer may not pay for extra hours.",
        "law_query": "overtime pay",
    }


def test_scan_returns_findings_with_citations_and_pages(client, document, searches):
    # A real line from page 2, reflowed, so the page lookup must ignore whitespace.
    line = next(line for line in document["pages"][1]["text"].splitlines() if len(line) > 30)
    llm = use_llm(
        FakeLlm(
            {"issues": [issue("  ".join(line.split()), "Vague duties"), issue("not in the text")]},
            {
                "findings": [
                    {
                        "issue": 1,
                        "severity": "low",
                        "explanation": "Minor.",
                        "recommendation": "Ask.",
                        "citations": [],
                    },
                    {
                        "issue": 0,
                        "severity": "high",
                        "explanation": "Risky.",
                        "recommendation": "Negotiate.",
                        # L1 and L2 belong to this issue; L3 is another issue's; L99 is made up.
                        "citations": ["L2", "L1", "L3", "L99", "L2"],
                    },
                ]
            },
        )
    )

    response = scan(client, document["id"])

    assert response.status_code == 200
    body = response.json()
    assert body["document_id"] == document["id"]
    assert body["model"] == "fake-model"
    first, second = body["findings"]
    assert first["title"] == "Vague duties"
    assert first["severity"] == "high"
    assert first["page_number"] == 2
    assert [c["section"] for c in first["citations"]] == ["230", "174"]
    assert first["citations"][0]["url"].startswith("https://laws-lois.justice.gc.ca/")
    assert second["severity"] == "low"
    assert second["page_number"] is None
    assert second["citations"] == []
    assert searches == ["overtime pay", "overtime pay"]
    # The stored text reaches the model, wrapped as data.
    assert document["pages"][0]["text"][:40] in llm.prompts[0][1]
    assert llm.prompts[0][1].startswith("<document>")


def test_scan_with_no_issues_skips_search_and_review(client, document, searches):
    llm = use_llm(FakeLlm({"issues": []}))

    response = scan(client, document["id"])

    assert response.status_code == 200
    assert response.json()["findings"] == []
    assert searches == []
    assert len(llm.prompts) == 1


def test_scan_caps_issues_and_ignores_bad_review_indexes(client, document, searches):
    many = [issue(f"clause {n}") for n in range(loopholes.MAX_ISSUES + 3)]
    reviewed = {
        "findings": [
            {"issue": n, "severity": "medium", "explanation": "", "recommendation": ""}
            for n in [0, 0, -1, 99]
        ]
    }
    use_llm(FakeLlm({"issues": many}, reviewed))

    response = scan(client, document["id"])

    assert len(searches) == loopholes.MAX_ISSUES
    assert [f["quote"] for f in response.json()["findings"]] == ["clause 0"]


def test_scan_truncates_long_quotes(client, document, searches):
    llm = use_llm(FakeLlm({"issues": [issue("x" * 1000)]}, {"findings": []}))

    scan(client, document["id"])

    review_prompt = llm.prompts[1][1]
    assert "x" * loopholes.MAX_QUOTE_CHARS in review_prompt
    assert "x" * (loopholes.MAX_QUOTE_CHARS + 1) not in review_prompt


@pytest.mark.parametrize(
    "replies",
    [
        [{"wrong": "shape"}],
        [{"issues": [issue("q")]}, {"findings": [{"issue": 0, "severity": "dire"}]}],
        [LlmError("The language model could not be reached. Try again later.")],
    ],
    ids=["bad-issues", "bad-findings", "llm-down"],
)
def test_scan_llm_failure_is_502(client, document, searches, replies):
    use_llm(FakeLlm(*replies))

    response = scan(client, document["id"])

    assert response.status_code == 502
    assert "language model" in response.json()["detail"]


def test_scan_unknown_document_is_404(client):
    use_llm(FakeLlm())

    assert scan(client, uuid.uuid4()).status_code == 404


def test_scan_without_api_key_is_503(client, document, monkeypatch):
    monkeypatch.setattr(settings, "token_factory_api_key", None)

    assert scan(client, document["id"]).status_code == 503


def test_scan_requires_token_when_gate_on(client, monkeypatch):
    monkeypatch.setattr(settings, "access_code", SecretStr("secret"))

    assert scan(client, uuid.uuid4()).status_code == 401


def test_find_page_ignores_case_and_whitespace():
    page = type("Page", (), {"page_number": 3, "text": "The Employee\nshall   WORK"})
    document = type("Doc", (), {"pages": [page]})

    assert loopholes.find_page(document, "employee shall work") == 3  # type: ignore[arg-type]
    assert loopholes.find_page(document, "   ") is None  # type: ignore[arg-type]
