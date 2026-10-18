"""The user's own items in the chat: the highlights on their document.

The client sends them with each question so the chat can find, list, change and scan
them. The model sees them under short refs ("I1", "I2", ...), like law sections. It
answers with the refs it mentions and the changes the user asked for, which are
checked here before they reach the client: an edit or a scan must name an item that
was sent, and a new highlight must quote a passage that is really in the document.
The client carries the actions out; a scan runs the same check as its Scan button.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, ValidationError

from backend.documents import pdf_path
from backend.highlights import HighlightRect, locate
from backend.models import Document

MAX_ITEMS = 200
MAX_ACTIONS = 10
MAX_NAME_CHARS = 120
MAX_NOTE_CHARS = 2000
MAX_QUOTE_CHARS = 400

# What the model calls each kind of item. Every item is a highlight: calling the user's
# unscanned ones "notes" made the model read "make it a highlight" as turning one of
# them into a highlight. "risk" and "highlight" are older clients' kinds.
ITEM_TYPES = {
    "auto": "auto-scan finding",
    "scan": "scanned highlight",
    "note": "highlight",
    "risk": "scanned highlight",
    "highlight": "highlight",
}

ITEMS_GUIDE = f"""\
The user's highlights on this document may follow inside <items> tags, each with a ref \
("I1", ...), its type, the user's name for it, their note on it (may be empty) and the \
passage it marks. Every item is already a highlight. Types: "auto-scan finding" was \
found by the automatic scan of the document; "scanned highlight" is one the user made \
and had scanned for risks, with its severity; "highlight" is one the user made and \
hasn't scanned.
- mentions: the refs of the items the answer is about, for example when the user asks \
to list or find their highlights or notes, or an item covers what they ask. Empty \
otherwise.
- actions: changes to the user's highlights that they asked for in this question, and \
only then:
  - To highlight a passage: {{"type": "create_highlight", "quote": "a passage copied \
exactly from the document, at most {MAX_QUOTE_CHARS} characters", "name": "a short name", \
"note": "a note, or empty", "scan": false}}. Keep "scan" false when the user asks to \
highlight, save or mark a passage; set it to true only when they ask for it to be \
scanned or checked for risks or law.
  - To scan one of the user's own highlights (type "highlight" or "scanned \
highlight"): {{"type": "scan_item", "item": "I1"}}.
  - To rename an item or change its note: {{"type": "update_item", "item": "I1", \
"name": "the new name, or null to keep it", "note": "the new note, or null to keep it"}}.
  A scan runs after your answer and its result appears in the user's highlights, so say \
you started it, but don't state its findings. Say in the answer what you changed.

When the user refers to something as "it", "this", "that" or "the one you mentioned", \
they almost always mean what the latest messages were about: the passage attached to \
their latest message, or the passages the latest answers quoted (listed after those \
answers). Refer to one of their items only when they name it or the conversation was \
about it. Asking to highlight, mark or save "it" means a new highlight of that passage, \
never turning an existing item into a highlight: every item already is one.

A request that doesn't say what to act on ("create a highlight", "save that", "scan \
it") is about what the latest messages were about: do it right away with that \
passage, without asking which one. If your previous answer asked the user something, \
their next message is most likely the reply: finish what they asked for then. For \
example, after you asked which passage to highlight, "compensation" means highlight \
the compensation clause. Ask only when the conversation points at no passage at all."""


class ChatItem(BaseModel):
    """One of the user's highlights, as the client sends it."""

    id: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    # "risk" and "highlight" are what clients sent before kinds were split this way.
    kind: Literal["auto", "scan", "note", "risk", "highlight"]
    name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] = ""
    # The user's note on it.
    description: Annotated[str, StringConstraints(max_length=MAX_NOTE_CHARS)] = ""
    quote: Annotated[str, StringConstraints(max_length=600)] = ""
    page_number: int | None = None
    severity: str | None = None


class CreateHighlight(BaseModel):
    type: Literal["create_highlight"] = "create_highlight"
    name: str
    # The note to put on it.
    description: str
    quote: str
    page_number: int
    highlight: list[HighlightRect]
    # Whether to scan it for risks and related law once it is created.
    scan: bool = False


class UpdateItem(BaseModel):
    type: Literal["update_item"] = "update_item"
    id: str
    # None leaves the field as it is. description is the note.
    name: str | None
    description: str | None


class ScanItem(BaseModel):
    type: Literal["scan_item"] = "scan_item"
    id: str


ChatAction = Annotated[CreateHighlight | UpdateItem | ScanItem, Field(discriminator="type")]


class ProposedAction(BaseModel):
    """An action as the model writes it, before it is checked."""

    type: Literal["create_highlight", "update_item", "scan_item"]
    item: str | None = None
    quote: str | None = None
    name: str | None = None
    note: str | None = None
    # Older prompts called the note a description; accepted too.
    description: str | None = None
    scan: bool = False

    @property
    def note_text(self) -> str | None:
        return self.note if self.note is not None else self.description


def _clip(text: str | None, limit: int) -> str | None:
    return None if text is None else text.strip()[:limit]


class ItemRefs:
    def __init__(self, items: list[ChatItem]) -> None:
        self.items = items[:MAX_ITEMS]
        self._by_ref = {f"I{i}": item for i, item in enumerate(self.items, 1)}
        self._by_id = {item.id: item for item in self.items}

    def prompt_entries(self) -> list[dict]:
        """The items as the model sees them."""
        return [
            {
                "ref": ref,
                "type": ITEM_TYPES[item.kind],
                "name": item.name,
                "note": item.description,
                "passage": item.quote,
                "page": item.page_number,
                "severity": item.severity,
            }
            for ref, item in self._by_ref.items()
        ]

    def get(self, ref: str) -> ChatItem | None:
        """The item for a ref. The model sometimes gives the id itself; that's fine too."""
        return self._by_ref.get(ref) or self._by_id.get(ref)

    def id_of(self, ref: str) -> str | None:
        item = self.get(ref)
        return item.id if item else None

    def ids(self, refs: list) -> list[str]:
        """Ids for the refs the model mentioned, in its order and without repeats.
        Unknown refs are dropped."""
        found = (self.id_of(ref) for ref in refs if isinstance(ref, str))
        return list(dict.fromkeys(i for i in found if i))


def check_actions(
    document: Document, proposed: list, refs: ItemRefs
) -> list[CreateHighlight | UpdateItem | ScanItem]:
    """The model's actions that can be carried out, in its order. A new highlight whose
    quote isn't in the document is dropped, and so is an edit or a scan of an unknown
    item, or a scan of one the automatic scan found (it is scanned already)."""
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

    actions: list[CreateHighlight | UpdateItem | ScanItem] = []
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
                    description=_clip(action.note_text, MAX_NOTE_CHARS) or "",
                    quote=_clip(action.quote, MAX_QUOTE_CHARS),
                    page_number=highlight[0].page_number,
                    highlight=highlight,
                    scan=action.scan,
                )
            )
            continue

        item = refs.get(action.item) if action.item else None
        if item is None:
            continue
        if action.type == "scan_item":
            if item.kind != "auto":
                actions.append(ScanItem(id=item.id))
        elif action.name is not None or action.note_text is not None:
            actions.append(
                UpdateItem(
                    id=item.id,
                    name=_clip(action.name, MAX_NAME_CHARS),
                    description=_clip(action.note_text, MAX_NOTE_CHARS),
                )
            )
    return actions
