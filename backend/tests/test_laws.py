from backend.laws import embedding_input, section_url
from backend.models import Law, LawSection
from backend.ontario_laws import parse_statute

FEDERAL = "https://laws-lois.justice.gc.ca/eng/acts/L-2/index.html"


def test_federal_sections_link_to_their_own_page():
    law = Law(id="L-2", kind="act", jurisdiction="federal", title="Canada Labour Code", url=FEDERAL)

    assert (
        section_url(law, LawSection(label="184.01"))
        == "https://laws-lois.justice.gc.ca/eng/acts/L-2/section-184.01.html"
    )
    assert section_url(law, LawSection(label="")) == FEDERAL


def test_ontario_sections_link_to_their_anchor():
    url = "https://www.ontario.ca/laws/statute/00e41"
    law = Law(id="ON-00e41", kind="act", jurisdiction="ontario", title="ESA", url=url)

    assert section_url(law, LawSection(label="33", anchor="BK68")) == f"{url}#BK68"
    assert section_url(law, LawSection(label="33")) == url


# A trimmed e-Laws statute: a table of contents, a part heading, a section with a
# subsection and amendment notes, a repealed section and a provision not yet in force.
CONTENT = """
<p class="TOCid"><a href="#BK68" title="Section 33."><u><span>33.</span></u></a></p>
<p class="table">Right to vacation</p>
<p class="partnum"><a name="BK67"></a>PART xi <br> VACATION WITH PAY</p>
<p class="headnote">Right to vacation</p>
<p class="section"><a name="BK68"></a><b>33 </b>(1) An employer shall give an employee a vacation of,</p>
<p class="paragraph"> (a) at least two weeks after each year, if employed less than five years; or</p>
<p class="paragraph"> (b) at least three weeks. <span class="citation">2017, c. 22, Sched. 1, s. 21.</p></span>
<p class="headnote">Active and inactive employment</p>
<p class="subsection">(2) Both active and inactive employment are included. <span class="citation">2017, c. 22.</p></span>
<p class="footnoteLeft amendments collapsed"><a href="/laws/statute/S02018">2002, c. 18</a> - 26/11/2002</p>
<p class="headnote">Old rule</p>
<p class="section"><a name="BK69"></a><b>34 </b>[Repealed, 2017, c. 22, s. 21.]</p>
<p class="Ysubsection">(3) A provision that is not yet in force &amp; ignored.</p>
<p class="headnote">Vacation pay</p>
<p class="section"><a name="BK72"></a><b>35.2 </b>An employer shall pay vacation pay of at least 4 per cent of the employee&#8217;s wages.</p>
"""


def test_parse_statute_reads_sections_notes_and_anchors():
    act = parse_statute(
        "00e41",
        {
            "content": CONTENT,
            "title": "Employment Standards Act, 2000, S.O. 2000, c. 41",
            "actName": {"en": "Employment Standards Act, 2000"},
        },
    )

    assert act.id == "ON-00e41"
    assert act.jurisdiction == "ontario"
    assert act.url == "https://www.ontario.ca/laws/statute/00e41"
    assert act.long_title == "Employment Standards Act, 2000, S.O. 2000, c. 41"
    assert [(s.label, s.anchor, s.marginal_note) for s in act.sections] == [
        ("33", "BK68", "Right to vacation"),
        ("35.2", "BK72", "Vacation pay"),
    ]
    vacation = act.sections[0]
    assert vacation.heading == "PART xi VACATION WITH PAY"
    assert vacation.text.splitlines() == [
        "(1) An employer shall give an employee a vacation of,",
        "(a) at least two weeks after each year, if employed less than five years; or",
        "(b) at least three weeks.",
        "Active and inactive employment: (2) Both active and inactive employment are included.",
    ]
    assert "’s wages" in act.sections[1].text
    assert "Employment Standards Act, 2000 (Ontario), s. 33" in embedding_input(act, vacation)


def test_parse_statute_without_sections_is_none():
    assert parse_statute("x", {"content": '<p class="headnote">Nothing</p>'}) is None
