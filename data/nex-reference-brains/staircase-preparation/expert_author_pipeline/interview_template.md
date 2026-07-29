# Expert Interview Template · Reference Brain Capture

**Purpose:** Structured script for capturing a certified expert's knowledge in a form that satisfies Rule A (no fabrication) · Rule B (no AI-authored content) · Rule C (attributable origin) — while producing raw material that fits directly into the module_author_template.

**Governing ADRs:** 0037 · 0039 · 0040 · 0041
**Prime Sentence:** "The purpose of every Brain is to become the most trusted professional reference in its field."

**Use one interview file per topic per session.** Interviewer never paraphrases beyond what is necessary for readability. Every technical claim must be spoken by the interviewee (or drawn from a document they cite) — never supplied by the interviewer.

---

## Section 1 · Interview identity block

Fill BEFORE the interview begins. All fields required.

```yaml
interview_id:           <slug — brain_topic_yyyymmdd_seq — e.g. staircase_fault_finding_20260728_01>
brain_slug:             <e.g. staircase>
brain_namespace:        <e.g. nex-official/staircase>
topic:                  <one of the 12 modules — e.g. fault_finding>
sub_topic:              <e.g. tread_split_diagnosis>
scope_statement:        <one sentence describing what THIS interview will cover — nothing wider>
interview_date:         <YYYY-MM-DD>
interview_location:     <workshop / site / video call / phone>
interview_duration_min: <integer>
interview_medium:       <in_person | video | audio_only | written_exchange>
recording_status:       <recorded_with_consent | notes_only | transcript_verbatim>
recording_ref:          <URL / file path / N/A>
transcript_ref:         <URL / file path / N/A>
```

---

## Section 2 · Interviewee identity + credentials block

Fill together with the interviewee. Every field is a citable attribute. If the interviewee refuses to be named, the interview cannot be used — anonymous knowledge fails Rule C.

```yaml
interviewee:
  full_name:                <required — will be printed on every entry authored from this interview>
  professional_title:       <e.g. Master Joiner · Staircase Manufacturer · Building Control Officer>
  primary_trade:            <staircase | joinery | building_control | structural | manufacturing | installation | other>
  years_practising_trade:   <integer>
  years_in_specialism:      <integer — years specifically in the topic being interviewed>
  business_name:            <optional>
  registration_bodies:      <list — e.g. ["City & Guilds Advanced Craft", "Guild of Master Craftsmen"]>
  certification_numbers:    <list — verifiable IDs the reader can look up>
  public_portfolio_url:     <optional — company site / trade profile>
  location:                 <city / country of practice>
  languages_of_practice:    <list>
  consent_to_be_named:      <REQUIRED yes | no — must be yes to proceed>
  consent_to_attribution:   <REQUIRED yes | no — must be yes to proceed>
  consent_date:             <YYYY-MM-DD>
```

**Interviewer must read the following aloud and record the response:**

> "Everything you say in this interview may be published inside the Staircase Brain under your name, with your credentials shown. Nex will not fabricate anything. Nex will not paraphrase your technical claims. You are the source. Do you consent?"

Recorded verbal response: `<yes | no | conditional — explain>`

If anything less than an unqualified yes, END the interview and record the reason.

---

## Section 3 · Topic + scope

Confirm the scope with the interviewee in their words before capture begins. Prevents drift into topics they are not authoritative on.

- Scope statement (interviewer): `<one sentence>`
- Scope confirmed by interviewee (verbatim): `<their sentence>`
- Explicit out-of-scope for this interview (things we will NOT ask about today): `<list>`
- Adjacent topics we may cross into: `<list — flag for follow-up interview>`

---

## Section 4 · Capture questions (open-ended prompts)

The interviewer asks these in order. Interviewee answers in their own words. Interviewer does NOT supply examples or fill silences with suggestions — silence often produces the most valuable material.

For each answer, the interviewer records:
- **Verbatim answer** (as spoken)
- **Clarification exchanges** (short interviewer questions if the answer is ambiguous)
- **Referenced sources** (documents / regulations / suppliers the interviewee names)

### Q1 · Framing

> "In your own words, what is the topic we're covering today, and why does it matter to a professional in this trade?"

- Verbatim answer:
- Referenced sources:

### Q2 · The right way

> "Walk me through how you do this correctly. Step by step. If a first-year apprentice were watching you, what would they see?"

- Verbatim answer:
- Referenced sources:
- Clarifications:

### Q3 · The rules you never break

> "Are there rules on this topic that you will not violate for any customer, any budget, any deadline? What are they? And what happens if someone does violate them?"

- Verbatim answer:
- Referenced sources (regulations · standards · manufacturer specs):
- Clarifications:

### Q4 · The rules that vary

> "Where do professionals legitimately disagree on this topic? What is a matter of style, and what is a matter of fact?"

- Verbatim answer:
- Which sub-parts are facts (with sources):
- Which sub-parts are style / preference (interviewee's own view):

### Q5 · Common mistakes

> "What are the most common mistakes you see other tradespeople make on this? How do you spot them? How do you fix them?"

- Verbatim answer:
- Diagnostic tells:
- Fix vs replace decision points:

### Q6 · Edge cases

> "What are the hardest cases on this topic? The ones that separate a competent tradesperson from a master?"

- Verbatim answer:
- Sub-cases the master handles differently:

### Q7 · Materials, tools, suppliers

> "What materials, tools, or suppliers are load-bearing for this topic? Are any specific products required, or genuinely better than the alternatives — and why?"

- Verbatim answer:
- Named products (only capture if interviewee is willing to be quoted attributing the product):
- Referenced datasheets / spec sheets (URL + publication date):

### Q8 · Regulations and standards

> "Which regulations, standards, or codes govern this topic in the jurisdictions you work in? Cite them by number if you can, and tell me which clauses matter most."

- Verbatim answer:
- Regulations named (title · edition · clause · jurisdiction):
- Interviewee's interpretation vs the plain text of the clause (interviewer flags any divergence):

### Q9 · Uncertainty

> "Where do you personally feel less certain on this topic? Where would you refer another professional to a specialist rather than answering yourself?"

- Verbatim answer:
- Referral triggers (when to escalate):

### Q10 · The trust question

> "If another master tradesperson were about to give a completely wrong answer on this topic to a client, what would they most likely get wrong, and what is the one thing you'd want them to know?"

- Verbatim answer:
- The one-sentence takeaway (in interviewee's words):

### Q11 · The peer-recommendation test

> "Is there anything else that would need to be in a professional reference on this topic for you to recommend it to a peer? What would be missing today that you'd flag?"

- Verbatim answer:
- Gaps flagged for follow-up interviews:

---

## Section 5 · Follow-up probes for evidence + rationale

For every technical claim captured above, the interviewer runs this checklist during or immediately after the interview. Uncited claims cannot be authored into the brain — they are quarantined for follow-up.

For each significant claim:

```yaml
claim_id:            <short id — c01, c02 …>
claim_summary:       <one sentence, in interviewee's terms>
verbatim_ref:        <link back to which question above>
origin_probe_asked:  <yes | no>   # Did the interviewer ask "how do you know this?"
origin_response:     <verbatim>
supporting_document: <title · publisher · date · clause · URL — or null>
rationale_probe:     <yes | no>   # Did the interviewer ask "why is that the case, not the alternative?"
rationale_response:  <verbatim>
counterexample_probe:<yes | no>   # Did the interviewer ask "when does this rule not apply?"
counterexample_response: <verbatim>
photo_or_diagram:    <reference — attach separately with its own manifest entry per ADR-0024>
confidence_selfstated: <band — very_high | high | good | uncertain (interviewee's own assessment)>
```

Any claim with `origin_probe_asked: no` OR `origin_response: <blank>` cannot be authored. Interviewer must re-contact the expert or discard the claim.

---

## Section 6 · Origin classification checklist (Rule C · five origin types)

For each captured claim, tag ONE origin type. This drives how the claim will be cited in the module and how it will render in the answer envelope.

| Code | Origin type | When to use |
|---|---|---|
| **E** | Named expert | Interviewee is stating from their own practising authority — the claim rests on their credentials |
| **R** | Regulation | Interviewee is citing (or interpreting) a legal instrument · building code · statutory document |
| **S** | Standard | Interviewee is citing an industry standard published by a recognised body (BS · BS EN · ISO · ASTM · etc.) |
| **M** | Manufacturer specification | Interviewee is citing a datasheet · product spec · installation instruction from the maker |
| **F** | Reviewed field observation | Interviewee reports something they have personally observed on projects, that they are willing to attest is repeatable |

Multi-origin claims are allowed (`origin: [E, R]`) but every code must be defensible.

Fill this table before closing the interview:

| claim_id | claim_summary | origin_codes | notes |
|---|---|---|---|
| c01 | | | |
| c02 | | | |
| c03 | | | |

Any claim with no origin code cannot be published.

---

## Section 7 · Interviewer sign-off

```yaml
interviewer_name:       <full name>
interviewer_role:       <e.g. Reference Brain Editor · Nex staff>
interviewer_signed_at:  <YYYY-MM-DD>
interviewer_declaration:
  - "I did not supply technical claims that appear in this record."
  - "I did not paraphrase claims in a way that changes their meaning."
  - "I asked the origin probe for every claim tagged for publication."
  - "I asked the interviewee to confirm scope before capture began."
  - "I obtained consent to be named and to attribute claims to the interviewee."
  - "This record contains only material captured during this interview."
signature:              <name>
```

---

## Section 8 · Reviewer sign-off (independent — MUST NOT be the interviewer)

Per Finding F6 (separation of duties), a second reviewer must read the interview record before any of its content is used to author a module.

```yaml
reviewer_name:          <full name — different from interviewer>
reviewer_role:          <e.g. Peer Expert · Certified Author · Advisory Panel member>
reviewer_signed_at:     <YYYY-MM-DD>
reviewer_declaration:
  - "I have read the full interview record."
  - "The origin classifications are defensible."
  - "The claims that will be published have adequate supporting evidence."
  - "The scope is honestly represented."
  - "No claim in this record contradicts an already-published brain module without being flagged."
reviewer_notes:         <free text — flag any claim that should not proceed to authoring>
signature:              <name>
```

---

## Section 9 · Cross-references to related topics

Every interview creates dependencies. Capture them for the module authoring stage.

- Related modules likely to reference this interview: `<list — e.g. materials, installation>`
- Related interviews already on file: `<list of interview_ids>`
- Regulations named that may also affect other modules: `<list>`
- Standards named that may also affect other modules: `<list>`
- Suppliers / products named that need a manifest entry: `<list>`
- Follow-up interviews requested during this session: `<list — with scope + suggested interviewee>`

---

## Handoff

When Sections 1-9 are complete AND both sign-offs are present, the interview record is ready to be used by an author working through `module_author_template.md`. The author references this interview_id for every entry sourced from it.

If ANY section is incomplete, the interview cannot be handed off. Incomplete interviews are stored as `state: draft` and never used to author published content.
