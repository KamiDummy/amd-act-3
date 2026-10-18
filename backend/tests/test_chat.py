import json
import uuid

import pytest
from pydantic import SecretStr

from backend import chat
from backend.config import settings
from backend.llm import LlmError, get_llm
from backend.main import app
from conftest import FakeLlm, law_hit

PLAN = {"law_query": "overtime pay for employees"}
NO_LAW = {"law_query": ""}


@pytest.fixture
def searches(monkeypatch) -> list[str]:
    """Stubs the vector search (SQLite has no pgvector). Records the queries."""
    queries: list[str] = []

    def fake_search(db, query, limit=5):
        queries.append(query)
        return [law_hit(1, "174"), law_hit(2, "230")]

    monkeypatch.setattr(chat, "search_laws", fake_search)
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


def ask(client, document_id, question, **body):
    return client.post(
        f"/api/documents/{document_id}/chat", json={"question": question, **body}
    )


def passage(document, page_number, start=40, end=60):
    return " ".join(document["pages"][page_number - 1]["text"].split()[start:end])


def test_answer_with_references_and_citations(client, document, searches):
    quote = passage(document, 2)
    llm = use_llm(
        FakeLlm(
            PLAN,
            {
                "answer": "Overtime is unpaid.",
                "quotes": [quote, "words the document does not have", quote],
                "citations": ["L2", "L9"],
            },
        )
    )

    response = ask(client, document["id"], "Do I get paid for overtime?")

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "fake-model"
    assert body["answer"] == "Overtime is unpaid."
    # The unfound quote and the repeat are dropped.
    assert [r["quote"] for r in body["references"]] == [quote]
    assert body["references"][0]["page_number"] == 2
    assert {rect["page_number"] for rect in body["references"][0]["highlight"]} == {2}
    assert [c["section"] for c in body["citations"]] == ["230"]  # L9 was never shown.
    assert searches == ["overtime pay for employees"]
    assert body["law_query"] == "overtime pay for employees"
    # Both calls get the whole document and the question; only the answer gets law.
    for _, prompt in llm.prompts:
        assert "[Page 1]" in prompt and "[Page 2]" in prompt
        assert "<question>\nDo I get paid for overtime?\n</question>" in prompt
    assert "<candidate_law>" not in llm.prompts[0][1]
    assert '"ref": "L1"' in llm.prompts[1][1]


def test_question_without_law_skips_the_search(client, document, searches):
    llm = use_llm(FakeLlm(NO_LAW, {"answer": "It starts on May 1."}))

    body = ask(client, document["id"], "When does it start?").json()

    assert body["answer"] == "It starts on May 1."
    assert body["references"] == [] and body["citations"] == []
    assert body["law_query"] == ""
    assert searches == []
    assert "<candidate_law>" not in llm.prompts[1][1]


def test_history_and_selection_are_in_the_prompt(client, document, searches):
    history = [
        {"role": "user", "content": f"question {i}"}
        if i % 2 == 0
        else {"role": "assistant", "content": f"answer {i}"}
        for i in range(chat.MAX_HISTORY + 4)
    ]
    llm = use_llm(FakeLlm(NO_LAW, {"answer": "Yes."}))

    ask(
        client,
        document["id"],
        "Is this fair?",
        history=history,
        selection={"text": "the selected clause", "page_number": 2},
    )

    prompt = llm.prompts[0][1]
    sent = json.loads(prompt.split("<conversation>\n")[1].split("\n</conversation>")[0])
    assert sent == history[-chat.MAX_HISTORY :]  # Oldest messages are dropped.
    assert '<selection page="2">\nthe selected clause\n</selection>' in prompt


def test_reference_near_the_selection_wins_when_the_quote_repeats(
    client, document, searches, monkeypatch
):
    calls = []

    def fake_locate(document, pdf, quotes, near_page=None):
        calls.append(near_page)
        return [[] for _ in quotes]

    monkeypatch.setattr(chat, "locate", fake_locate)
    use_llm(FakeLlm(NO_LAW, {"answer": "Yes.", "quotes": ["anything"]}))

    body = ask(
        client, document["id"], "Why?", selection={"text": "x", "page_number": 3}
    ).json()

    assert calls == [3]
    assert body["references"] == []


@pytest.mark.parametrize(
    "body",
    [
        {"question": ""},
        {"question": "   "},
        {"question": "x" * (chat.MAX_QUESTION_CHARS + 1)},
        {"question": "ok", "history": [{"role": "system", "content": "hi"}]},
        {"question": "ok", "history": [{"role": "user", "content": ""}]},
        {"question": "ok", "selection": {"text": ""}},
    ],
    ids=["empty", "blank", "too-long", "bad-role", "empty-message", "empty-selection"],
)
def test_invalid_request_is_422(client, document, body):
    use_llm(FakeLlm())

    response = client.post(f"/api/documents/{document['id']}/chat", json=body)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "replies",
    [
        [{"law_query": 5}],
        [NO_LAW, {"answer": ""}],
        [PLAN, {"quotes": []}],
        [LlmError("The language model could not be reached. Try again later.")],
    ],
    ids=["bad-plan", "empty-answer", "no-answer", "llm-down"],
)
def test_llm_failure_is_502(client, document, searches, replies):
    use_llm(FakeLlm(*replies))

    response = ask(client, document["id"], "overtime?")

    assert response.status_code == 502
    assert "language model" in response.json()["detail"]


def test_unknown_document_is_404(client):
    use_llm(FakeLlm())

    assert ask(client, uuid.uuid4(), "overtime?").status_code == 404


def test_without_api_key_is_503(client, document, monkeypatch):
    monkeypatch.setattr(settings, "token_factory_api_key", None)

    assert ask(client, document["id"], "overtime?").status_code == 503


def test_requires_token_when_gate_on(client, monkeypatch):
    monkeypatch.setattr(settings, "access_code", SecretStr("secret"))

    assert ask(client, uuid.uuid4(), "overtime?").status_code == 401


ITEMS = [
    {"id": "highlight:a", "kind": "highlight", "name": "Vacation days", "quote": "five days"},
    {
        "id": "finding:b",
        "kind": "risk",
        "name": "Unpaid overtime",
        "description": "Ask about this",
        "quote": "not entitled to overtime",
        "page_number": 1,
        "severity": "high",
    },
]


def test_items_are_shown_under_refs_and_mentions_map_back(client, document, searches):
    llm = use_llm(
        FakeLlm(NO_LAW, {"answer": "You have two.", "mentions": ["I2", "I1", "I9", "highlight:a", 3]})
    )

    body = ask(client, document["id"], "List my highlights", items=ITEMS).json()

    # Unknown refs and repeats are dropped; an id given directly is accepted.
    assert body["mentions"] == ["finding:b", "highlight:a"]
    for _, prompt in llm.prompts:
        assert "<items>" in prompt and '"ref": "I2"' in prompt and "Ask about this" in prompt
        assert "finding:b" not in prompt  # The model sees refs, not the client's ids.


def test_actions_are_checked_before_they_reach_the_client(client, document, searches):
    quote = passage(document, 2)
    use_llm(
        FakeLlm(
            NO_LAW,
            {
                "answer": "Done.",
                "actions": [
                    {"type": "create_highlight", "quote": quote, "name": "Overtime", "description": "Check"},
                    {"type": "create_highlight", "quote": "words the document does not have"},
                    {"type": "update_item", "item": "I1", "name": "Vacation below minimum"},
                    {"type": "update_item", "item": "I9", "name": "Nobody"},
                    {"type": "update_item", "item": "I2"},
                    {"type": "delete_item", "item": "I2"},
                    "not an action",
                ],
            },
        )
    )

    body = ask(client, document["id"], "Save the overtime clause", items=ITEMS).json()

    created, updated = body["actions"]
    assert created["type"] == "create_highlight"
    assert (created["name"], created["description"], created["quote"]) == ("Overtime", "Check", quote)
    assert created["page_number"] == 2
    assert {rect["page_number"] for rect in created["highlight"]} == {2}
    assert updated == {
        "type": "update_item",
        "id": "highlight:a",
        "name": "Vacation below minimum",
        "description": None,
    }


def test_without_items_the_prompt_has_none(client, document, searches):
    llm = use_llm(FakeLlm(NO_LAW, {"answer": "Yes."}))

    body = ask(client, document["id"], "Is this fair?").json()

    assert body["mentions"] == [] and body["actions"] == []
    assert "<items>" not in llm.prompts[1][1]


def test_invalid_item_is_422(client, document):
    use_llm(FakeLlm())

    response = ask(client, document["id"], "ok", items=[{"id": "x", "kind": "comment"}])

    assert response.status_code == 422


KINDS = [
    {"id": "highlight:n", "kind": "note", "name": "Salary", "description": "Check the math"},
    {"id": "finding:a", "kind": "auto", "name": "Unpaid overtime", "severity": "high"},
]


def test_scan_actions_and_notes(client, document, searches):
    quote = passage(document, 1)
    llm = use_llm(
        FakeLlm(
            NO_LAW,
            {
                "answer": "Saved and scanning.",
                "actions": [
                    {"type": "create_highlight", "quote": quote, "name": "Pay", "note": "Mine", "scan": True},
                    {"type": "scan_item", "item": "I1"},
                    {"type": "scan_item", "item": "I2"},  # Found by the auto scan: scanned already.
                    {"type": "scan_item", "item": "I9"},
                    {"type": "update_item", "item": "I1", "note": "New note"},
                ],
            },
        )
    )

    body = ask(client, document["id"], "Save and scan the salary clause", items=KINDS).json()

    created, scanned, updated = body["actions"]
    assert (created["type"], created["scan"], created["description"]) == ("create_highlight", True, "Mine")
    assert scanned == {"type": "scan_item", "id": "highlight:n"}
    assert updated == {"type": "update_item", "id": "highlight:n", "name": None, "description": "New note"}
    # The model sees the user's note as "note", and every item as a type of highlight:
    # an unscanned one is a plain "highlight", never a "note".
    prompt = llm.prompts[1][1]
    assert '"note": "Check the math"' in prompt
    assert '"type": "highlight"' in prompt and '"type": "auto-scan finding"' in prompt
    assert '"kind"' not in prompt


def test_conversation_comes_after_the_items(client, document, searches):
    llm = use_llm(FakeLlm(NO_LAW, {"answer": "Done."}))
    history = [{"role": "user", "content": "do the math"}, {"role": "assistant", "content": "It's off."}]

    ask(client, document["id"], "make it a highlight", history=history, items=KINDS)

    # What the user just said sits nearest the question, after the items.
    prompt = llm.prompts[1][1]
    order = [prompt.index(tag) for tag in ("<document>", "<items>", "<conversation>", "<question>")]
    assert order == sorted(order)
