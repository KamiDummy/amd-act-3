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

# Says nothing about which statutes are loaded, so loading more law needs no change here:
# each candidate section carries its jurisdiction, and the rule is the same for any
# contract.
LAW_COVERAGE = """\
The law database holds Canadian federal law and some provincial statutes; each \
candidate section names its jurisdiction. Cite only sections from the jurisdiction \
whose law governs the contract. Most contracts between people and businesses (jobs, \
leases, rentals, purchases, services) are governed by provincial law; federal law \
governs only some areas, such as banking, airlines, telecommunications, interest rates \
and criminal matters, so never cite a federal section that does not govern the clause. \
When the governing province's law is not among the candidates, say that its law should \
be checked. Name a rule that isn't among the candidates only when you are confident of \
it, and present it as something to confirm."""

# Laws are embedded with their jurisdiction, so naming the province in a search query
# brings up that province's statutes over federal ones on the same subject.
QUERY_PROVINCE = """\
If the contract names the province whose law governs it, include the province in the \
query, for example "minimum annual vacation for employees in Ontario"."""
