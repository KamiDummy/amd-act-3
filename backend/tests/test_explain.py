import uuid

import pytest
from pydantic import SecretStr

from backend import explain
from backend.config import settings
from backend.llm import LlmError, get_llm
from backend.main import app
from conftest import FakeLlm, law_hit

QUERY = {
    "concern": "Extra hours may go unpaid.",
    "law_query": "overtime pay for employees",
}


@pytest.fixture
def searches(monkeypatch) -> list[str]:
    """Stubs the vector search (SQLite has no pgvector). Records the queries."""
    queries: list[str] = []

    def fake_search(db, query, limit=5):
        queries.append(query)
        return [law_hit(1, "174"), law_hit(2, "230")]

    monkeypatch.setattr(explain, "search_laws", fake_search)
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


def ask(client, document_id, text, page_number=None):
    return client.post(
        f"/api/documents/{document_id}/explain",
        json={"text": text, "page_number": page_number},
    )


def words(document, page_number):
    return document["pages"][page_number - 1]["text"].split()


def test_explain_returns_explanation_citations_and_highlight(client, document, searches):
    selection = " ".join(words(document, 1)[40:60])
    llm = use_llm(
        FakeLlm(
            QUERY,
            {
                "explanation": "It means X.",
                "severity": "medium",
                "recommendation": "Ask for overtime pay.",
                "citations": ["L2", "L9"],
            },
        )
    )

    response = ask(client, document["id"], selection, page_number=1)

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "fake-model"
    assert body["explanation"] == "It means X."
    assert body["severity"] == "medium"
    assert body["recommendation"] == "Ask for overtime pay."
    assert [c["section"] for c in body["citations"]] == ["230"]  # L9 was never shown.
    assert {rect["page_number"] for rect in body["highlight"]} == {1}
    assert searches == ["overtime pay for employees"]
    # Both prompts carry the selection and its page as context.
    for _, prompt in llm.prompts:
        assert f"<selection>\n{selection}\n</selection>" in prompt
        assert "[Page 1]" in prompt and "[Page 2]" not in prompt
    assert '"ref": "L1"' in llm.prompts[1][1]
    # The first call's concern is passed on to the explanation.
    assert "<concern>\nExtra hours may go unpaid.\n</concern>" in llm.prompts[1][1]


def test_query_without_concern_and_explanation_without_recommendation(
    client, document, searches
):
    llm = use_llm(
        FakeLlm({"law_query": "vacation pay"}, {"explanation": "Fair.", "severity": "none"})
    )

    body = ask(client, document["id"], "vacation", page_number=1).json()

    assert body["recommendation"] == ""
    assert searches == ["vacation pay"]
    assert "<concern>\n\n</concern>" in llm.prompts[1][1]


def test_selection_across_pages_highlights_both_and_gives_both_as_context(
    client, document, searches
):
    selection = " ".join(words(document, 1)[-6:] + words(document, 2)[:6])
    llm = use_llm(FakeLlm(QUERY, {"explanation": "", "severity": "none"}))

    body = ask(client, document["id"], selection, page_number=1).json()

    assert {rect["page_number"] for rect in body["highlight"]} == {1, 2}
    assert "[Page 1]" in llm.prompts[0][1] and "[Page 2]" in llm.prompts[0][1]
    assert body["citations"] == []


def test_selection_not_found_still_explains_with_hint_page(client, document, searches):
    llm = use_llm(FakeLlm(QUERY, {"explanation": "Ok.", "severity": "low"}))

    body = ask(client, document["id"], "text the pdf does not have", page_number=2).json()

    assert body["highlight"] == []
    assert body["explanation"] == "Ok."
    assert "[Page 2]" in llm.prompts[0][1]


@pytest.mark.parametrize("text", ["", "   ", "x" * (explain.MAX_SELECTION_CHARS + 1)])
def test_invalid_selection_is_422(client, document, text):
    use_llm(FakeLlm())

    assert ask(client, document["id"], text).status_code == 422


@pytest.mark.parametrize(
    "replies",
    [
        [{"law_query": ""}],
        [QUERY, {"explanation": "x", "severity": "dire"}],
        [LlmError("The language model could not be reached. Try again later.")],
    ],
    ids=["bad-query", "bad-explanation", "llm-down"],
)
def test_llm_failure_is_502(client, document, searches, replies):
    use_llm(FakeLlm(*replies))

    response = ask(client, document["id"], "overtime pay")

    assert response.status_code == 502
    assert "language model" in response.json()["detail"]


def test_unknown_document_is_404(client):
    use_llm(FakeLlm())

    assert ask(client, uuid.uuid4(), "overtime").status_code == 404


def test_without_api_key_is_503(client, document, monkeypatch):
    monkeypatch.setattr(settings, "token_factory_api_key", None)

    assert ask(client, document["id"], "overtime").status_code == 503


def test_requires_token_when_gate_on(client, monkeypatch):
    monkeypatch.setattr(settings, "access_code", SecretStr("secret"))

    assert ask(client, uuid.uuid4(), "overtime").status_code == 401
