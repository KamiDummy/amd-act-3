"""Prompt wording shared by every feature that judges a contract clause.

The loophole scan and the explanation of a selected passage use the same text, so a
clause is judged the same way whichever feature looks at it.
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

FEDERAL_ONLY = """\
Only federal law is searched. Leases, most employment contracts and most consumer \
contracts are governed by provincial law. When that is likely, say the provincial law \
should be checked instead of citing a federal section that does not govern the clause. \
Name a provincial rule only when you are confident of it, and present it as something \
to confirm."""
