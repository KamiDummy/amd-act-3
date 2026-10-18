"""Prompt wording shared by every feature that judges a contract clause or searches law.

The loophole scan, the check of a selected passage and the chat use the same text, so
a clause is judged, and its law searched, the same way whichever feature looks at it.
"""

SIGNER_RISKS = """\
clauses that are vague enough to be read against the signer, are one-sided, let the \
other party change terms or avoid obligations, waive the signer's rights, impose \
unusual penalties, give the signer less than the law guarantees (for example less \
vacation, notice or pay than employment standards require), or otherwise conflict \
with Canadian law"""

SEVERITY_GUIDE = """\
"high" if it could cost the signer money or rights they would not expect, \
"medium" if it is unfavourable but common, "low" if it is a minor drafting gap"""

LAW_COVERAGE = """\
The law searched is Canadian federal law plus two Ontario statutes: the Employment \
Standards Act, 2000 and the Residential Tenancies Act, 2006. Each candidate section \
names its jurisdiction. Leases, most employment contracts and most consumer contracts \
are governed by provincial law, not federal law: for an Ontario job or rental, rely on \
the Ontario sections and never cite a federal section that does not govern the clause. \
For other provinces, or Ontario rules outside those two statutes, say the provincial \
law should be checked. Name a rule that isn't among the candidates only when you are \
confident of it, and present it as something to confirm."""

# Laws are embedded with their jurisdiction, so naming the province in a search query
# brings up that province's statutes over federal ones on the same subject.
QUERY_PROVINCE = """\
If the contract names the province whose law governs it, include the province in the \
query, for example "minimum annual vacation for employees in Ontario"."""
