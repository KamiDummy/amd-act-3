"""No feature keeps a database transaction open while it waits on the language model:
the pooler shares few connections, and one left idle for a minute or two can be dropped,
failing the next query."""

import pytest
from sqlalchemy import text

from backend import chat, explain, loopholes
from backend.llm import get_llm
from backend.main import app
from conftest import FakeLlm, law_hit


@pytest.fixture(autouse=True)
def searches(monkeypatch):
    """A vector search stub that queries the database, as the real one does."""

    def fake_search(session, query, limit=5):
        session.execute(text("select 1"))
        return [law_hit(1)]

    for module in (chat, explain, loopholes):
        monkeypatch.setattr(module, "search_laws", fake_search)


@pytest.fixture
def document_id(client, sample_pdf) -> str:
    response = client.post(
        "/api/documents", files={"file": ("contract.pdf", sample_pdf, "application/pdf")}
    )
    return response.json()["id"]


def use_llm(db, *replies) -> FakeLlm:
    llm = FakeLlm(*replies, session=db)
    app.dependency_overrides[get_llm] = lambda: llm
    return llm


def test_scan_waits_on_the_model_without_a_transaction(client, db, document_id):
    issue = {"quote": "Employee", "title": "Vague", "concern": "Unclear.", "law_query": "duties"}
    finding = {"issue": 0, "severity": "low", "explanation": "x", "recommendation": "y"}
    llm = use_llm(db, {"issues": [issue]}, {"findings": [finding]})

    assert client.post(f"/api/documents/{document_id}/loopholes").status_code == 200
    assert llm.open_transactions == [False, False]


def test_passage_check_waits_on_the_model_without_a_transaction(client, db, document_id):
    llm = use_llm(
        db, {"concern": "c", "law_query": "q"}, {"explanation": "e", "severity": "low"}
    )

    response = client.post(
        f"/api/documents/{document_id}/explain", json={"text": "Employee", "page_number": 1}
    )

    assert response.status_code == 200
    assert llm.open_transactions == [False, False]


def test_chat_waits_on_the_model_without_a_transaction(client, db, document_id):
    llm = use_llm(db, {"law_query": "notice"}, {"answer": "One week."})

    response = client.post(f"/api/documents/{document_id}/chat", json={"question": "Notice?"})

    assert response.status_code == 200
    assert llm.open_transactions == [False, False]
