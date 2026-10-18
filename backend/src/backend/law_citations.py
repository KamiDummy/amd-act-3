"""Shows retrieved law sections to the LLM and turns the ones it cites into citations.

Sections are shown to the model under short refs ("L1", "L2", ...). Only refs that were
shown for the same question are accepted back, so a citation always points at a real
section in the database that was retrieved for that clause.
"""

from pydantic import BaseModel

from backend.laws import LawHit


class Citation(BaseModel):
    law_id: str
    law_title: str
    kind: str
    # "federal" or a province, e.g. "ontario".
    jurisdiction: str
    section: str
    marginal_note: str | None
    text: str
    # A link to the section itself where the site allows it, else to the law.
    url: str


class LawRefs:
    def __init__(self, groups: list[list[LawHit]]) -> None:
        """`groups` holds the search results for each question. A section retrieved by
        two questions gets one ref."""
        self._refs: dict[int, str] = {}
        for hits in groups:
            for hit in hits:
                self._refs.setdefault(hit.section_id, f"L{len(self._refs) + 1}")

    def prompt_entries(self, hits: list[LawHit]) -> list[dict]:
        """The sections as the model sees them."""
        return [
            {
                "ref": self._refs[hit.section_id],
                "law": hit.law_title,
                "jurisdiction": "Canada (federal)" if hit.jurisdiction == "federal" else hit.jurisdiction.title(),
                "section": hit.label,
                "note": hit.marginal_note,
                "text": hit.text,
            }
            for hit in hits
        ]

    def cite(self, refs: list[str], hits: list[LawHit]) -> list[Citation]:
        """Citations for the refs the model chose, in its order and without repeats.
        Refs not among `hits` are dropped: invented, or shown for another question."""
        allowed = {self._refs[hit.section_id]: hit for hit in hits}
        chosen = dict.fromkeys(ref for ref in refs if ref in allowed)
        return [_citation(allowed[ref]) for ref in chosen]


def _citation(hit: LawHit) -> Citation:
    return Citation(
        law_id=hit.law_id,
        law_title=hit.law_title,
        kind=hit.kind,
        jurisdiction=hit.jurisdiction,
        section=hit.label,
        marginal_note=hit.marginal_note,
        text=hit.text,
        url=hit.url,
    )
