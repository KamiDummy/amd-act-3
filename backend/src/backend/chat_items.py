"""The user's own items in the chat: their risks and highlights on the document.

The client sends them with each question so the chat can find, list and change them.
The model sees them under short refs ("I1", "I2", ...), like law sections. It answers
with the refs it mentions and the changes the user asked for, which are checked here
before they reach the client: an edit must name an item that was sent, and a new
highlight must quote a passage that is really in the document.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, ValidationError

from backend.documents import pdf_path
from backend.highlights import HighlightRect, locate
from backend.models import Document

MAX_ITEMS = 200
MAX_ACTIONS = 10
MAX_NAME_CHARS = 120
MAX_DESCRIPTION_CHARS = 2000
MAX_QUOTE_CHARS = 400

ITEMS_GUIDE = f"""\
The user's own items on this document may follow inside <items> tags: risks (found by \
a scan or by the user checking a passage) and highlights, each with a ref ("I1", ...), \
the user's name and description for it, and the passage it marks.
- mentions: the refs of the items the answer is about, for example when the user asks \
to list or find their items, or an item covers what they ask. Empty otherwise.
- actions: changes to the user's items that they asked for in this question, and only \
then. To highlight a passage: {{"type": "create_highlight", "quote": "a passage copied \
exactly from the document, at most {MAX_QUOTE_CHARS} characters", "name": "a short \
name", "description": "a description, or empty"}}. To rename or describe an item: \
{{"type": "update_item", "item": "I1", "name": "the new name, or null to keep it", \
"description": "the new description, or null to keep it"}}. Say in the answer what \
you changed. Empty when nothing was asked."""


class ChatItem(BaseModel):
    """One of the user's items, as the client sends it."""

    id: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    kind: Literal["risk", "highlight"]
    name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] = ""
    description: Annotated[str, StringConstraints(max_length=MAX_DESCRIPTION_CHARS)] = ""
    quote: Annotated[str, StringConstraints(max_length=600)] = ""
    page_number: int | None = None
    severity: str | None = None


class CreateHighlight(BaseModel):
    type: Literal["create_highlight"] = "create_highlight"
    name: str
    description: str
    quote: str
    page_number: int
    highlight: list[HighlightRect]


class UpdateItem(BaseModel):
    type: Literal["update_item"] = "update_item"
    id: str
    # None leaves the field as it is.
    name: str | None
    description: str | None


ChatAction = Annotated[CreateHighlight | UpdateItem, Field(discriminator="type")]


class ProposedAction(BaseModel):
    """An action as the model writes it, before it is checked."""

    type: Literal["create_highlight", "update_item"]
    item: str | None = None
    quote: str | None = None
    name: str | None = None
    description: str | None = None


def _clip(text: str | None, limit: int) -> str | None:
    return None if text is None else text.strip()[:limit]


class ItemRefs:
    def __init__(self, items: list[ChatItem]) -> None:
        self.items = items[:MAX_ITEMS]
        self._by_ref = {f"I{i}": item for i, item in enumerate(self.items, 1)}
        self._ids = {item.id for item in self.items}

    def prompt_entries(self) -> list[dict]:
        """The items as the model sees them."""
        return [
            {
                "ref": ref,
                "kind": item.kind,
                "name": item.name,
                "description": item.description,
                "passage": item.quote,
                "page": item.page_number,
                "severity": item.severity,
            }
            for ref, item in self._by_ref.items()
        ]

    def id_of(self, ref: str) -> str | None:
        """The item id for a ref. The model sometimes gives the id itself; that's fine too."""
        if ref in self._by_ref:
            return self._by_ref[ref].id
        return ref if ref in self._ids else None

    def ids(self, refs: list) -> list[str]:
        """Ids for the refs the model mentioned, in its order and without repeats.
        Unknown refs are dropped."""
        found = (self.id_of(ref) for ref in refs if isinstance(ref, str))
        return list(dict.fromkeys(i for i in found if i))


def check_actions(document: Document, proposed: list, refs: ItemRefs) -> list[CreateHighlight | UpdateItem]:
    """The model's actions that can be carried out, in its order. A new highlight whose
    quote isn't in the document is dropped, and so is an edit to an unknown item."""
    parsed: list[ProposedAction] = []
    for raw in proposed[:MAX_ACTIONS]:
        try:
            parsed.append(ProposedAction.model_validate(raw))
        except ValidationError:
            continue

    quotes = [
        _clip(a.quote, MAX_QUOTE_CHARS)
        for a in parsed
        if a.type == "create_highlight" and a.quote and a.quote.strip()
    ]
    located = iter(locate(document, pdf_path(document.id), quotes)) if quotes else iter(())

    actions: list[CreateHighlight | UpdateItem] = []
    for action in parsed:
        if action.type == "create_highlight":
            if not (action.quote and action.quote.strip()):
                continue
            highlight = next(located)
            if not highlight:
                continue
            actions.append(
                CreateHighlight(
                    name=_clip(action.name, MAX_NAME_CHARS) or "",
                    description=_clip(action.description, MAX_DESCRIPTION_CHARS) or "",
                    quote=_clip(action.quote, MAX_QUOTE_CHARS),
                    page_number=highlight[0].page_number,
                    highlight=highlight,
                )
            )
        else:
            item_id = refs.id_of(action.item) if action.item else None
            if item_id is None or (action.name is None and action.description is None):
                continue
            actions.append(
                UpdateItem(
                    id=item_id,
                    name=_clip(action.name, MAX_NAME_CHARS),
                    description=_clip(action.description, MAX_DESCRIPTION_CHARS),
                )
            )
    return actions
