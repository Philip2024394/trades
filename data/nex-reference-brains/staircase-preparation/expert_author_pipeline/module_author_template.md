# Module Author Template · Reference Brain Authoring

**Purpose:** The canonical shape a certified expert (or an editor working with a certified expert's captured material) uses to structure an authored module. Output produced with this template drops directly into `hammerex_nex_brain_drafts.modules_json` and — on publish — into `hammerex_nex_brain_versions.modules_json`.

**Governing rules:**
- Rule A · Anti-Fabrication — no invented facts, ever
- Rule B · No AI-Authored Content — no AI-generated technical claims may enter the brain
- Rule C · Attributable Origin — every entry declares an origin type and a source_reference

**Related files:**
- `interview_template.md` — the capture step that must precede authoring
- `citation_requirements.md` — the format each source_reference must follow
- `approval_workflow.md` — where this template output plugs into the pipeline
- `three_rule_author_reminder.md` — read this BEFORE opening this template

The author's job is to STRUCTURE and CITE captured knowledge. The author is NEVER the source of new technical facts. If the author finds themselves inventing content to fill a section, STOP. Return to interview_template.md and capture the missing knowledge from a named expert first.

---

## Section 1 · Module identity block

```yaml
module_identity:
  brain_slug:           <e.g. staircase>
  brain_namespace:      <e.g. nex-official/staircase>
  module_name:          <one of the 12 modules — materials | construction | manufacturing | installation | design | regulations | maintenance | fault_finding | estimating | terminology | safety | tools>
  module_scope:         <one sentence — what this module owns and what it deliberately does not>
  proposed_semver:      <target version this module change is aiming at — e.g. 0.2.0>
  version_bump_type:    <patch | minor | major>   # see version_control_guidance.md
  version_bump_reason:  <one sentence justifying the bump type>

  primary_author:
    author_id:          <system id>
    author_name:        <full name — will appear on every published entry>
    credentials:        <string — mirrors the certification row>
    certification_id:   <FK into hammerex_nex_brain_certifications>
    authored_date:      <YYYY-MM-DD>

  reviewer:
    reviewer_id:        <system id — MUST NOT equal primary_author.author_id>
    reviewer_name:      <full name>
    reviewer_credentials: <string>
    review_date:        <YYYY-MM-DD when review completed>

  interview_refs:       <list of interview_ids that supplied source material for this module>
  supersedes:
    module_prev_version: <e.g. 0.1.0>
    change_summary:      <one paragraph — what changed and why>

  scope_intent:
    covers:             <list of sub-topics IN scope for this module>
    excludes:           <list of sub-topics OUT of scope — belong to other modules>
    known_gaps:         <list of sub-topics acknowledged missing — will surface on Coverage Map>
```

---

## Section 2 · Entry structure (mandatory per-entry shape)

A module is a list of entries. Every entry MUST include every field below. Missing fields fail the publish gate.

```yaml
entry:
  entry_id:              <slug — e.g. tread_split_diagnosis · american_white_oak_moisture_behaviour>
  title:                 <plain-English title as a professional would search for it>
  body:                  <the substantive answer — see body composition rules below>

  source_type:           <one of the Rule C origin codes — E | R | S | M | F | multi>
  source_reference:      <formatted per citation_requirements.md — MUST resolve to a specific citable source>

  confidence:            <one of: very_high | high | good | uncertain>
  confidence_rationale:  <one sentence — WHY this confidence, tied to the strength of the source>

  related_modules:       <list of {module_name, entry_id} — cross-links to sibling knowledge>
  related_entries:       <list of entry_ids within THIS module that this entry depends on>

  interview_ref:         <interview_id if this entry was captured through interview_template.md, else null>
  claim_id_in_interview: <claim_id from Section 6 of the interview record, else null>

  origin_classification:
    codes:               <subset of [E, R, S, M, F]>
    named_expert:        <name + credentials if origin includes E, else null>
    regulation_ref:      <fully qualified per citation_requirements.md if origin includes R, else null>
    standard_ref:        <fully qualified per citation_requirements.md if origin includes S, else null>
    manufacturer_ref:    <fully qualified per citation_requirements.md if origin includes M, else null>
    field_observation:   <observer + reviewer + date if origin includes F, else null>

  jurisdiction_scope:    <list of country / region codes where this entry applies — e.g. ["GB-ENG"]>
  material_scope:        <list of materials this entry applies to, or ["*"] for universal>
  applicability_notes:   <one sentence flagging when the entry does NOT apply>

  authored_by:           <mirrors module_identity.primary_author.author_name — enforces attribution on the entry itself>
  authored_date:         <YYYY-MM-DD>
  reviewed_by:           <mirrors module_identity.reviewer.reviewer_name>
  review_date:           <YYYY-MM-DD>

  adversarial_qs_passed: <list of adversarial question IDs this entry has been tested against — required for publish per Phase 3 challenge stream>
  known_limits:          <one or two sentences on where this entry stops answering and requires a specialist>
```

### Body composition rules (mandatory)

Every `entry.body` must include, in this order:

1. **What the reader should do or know** — the substantive guidance, in the words captured from the expert (edited only for grammar, structure, and disambiguation — never for content).
2. **Why** — the reasoning (drawn from Q3/Q4 of the interview) that lets a professional verify the answer rather than trust it blindly. This satisfies the Explainability quality (ADR-0039).
3. **When it does not apply** — the edge cases from Q6, or the referral triggers from Q9.
4. **What a mistake looks like** — the diagnostic tell from Q5, so the reader can recognise the failure mode.

A body missing any of the four sections fails the publish gate.

**Prohibited in body copy:**
- Marketing language ("premium", "world-class", "state of the art")
- Prices or price ranges unless origin type is M or R and the source is dated within the last 90 days (per feedback_nex_no_prices_unless_facts HARD LAW)
- "In our experience" without a named observer
- "Best practice" without a source
- Model-generated prose (Rule B)

---

## Section 3 · Rule C origin classification checklist (per-entry gate)

Before an entry may be marked ready for review, walk through this checklist. Every "no" is a blocker.

- [ ] The entry declares at least one origin code
- [ ] Every origin code declared has a matching populated reference field (e.g. code R → regulation_ref populated per citation_requirements.md)
- [ ] The source_reference resolves — an independent reader could fetch and read it
- [ ] The named_expert (if code E) is on the interviewee list of a completed, signed-off interview
- [ ] The regulation_ref (if code R) names title · edition · amendment date · clause number · jurisdiction · URL
- [ ] The standard_ref (if code S) names publishing body · standard number · year · relevant clauses · URL
- [ ] The manufacturer_ref (if code M) names manufacturer · product · datasheet version · publication date · URL
- [ ] The field_observation (if code F) names original observer + reviewing expert + date reviewed + circumstances
- [ ] The body accurately represents the source — no drift beyond what the source supports
- [ ] No claim in the body is present that lacks a corresponding origin

If any checkbox cannot be ticked, the entry is quarantined for author revision. It does NOT proceed to review.

---

## Section 4 · Version bump guidance (per-module, per-draft)

Choose the bump type that matches the greatest change in this draft. See `version_control_guidance.md` for the full policy.

Quick table:

| Change | Bump |
|---|---|
| Fix a typo in an entry body | patch |
| Correct or reformat a citation | patch |
| Clarify wording without changing meaning | patch |
| Add a new entry that does not contradict any existing entry | minor |
| Add a new sub-topic (grouping of entries) | minor |
| Change guidance to newly contradict a prior version | major |
| Restructure the entry model consumers depend on | major |
| Retire an entry that consumers may still be citing | major |

If unsure between two levels, choose the higher bump. Consumers can absorb an unnecessary minor; they cannot absorb an under-declared major.

---

## Section 5 · Publish-readiness checklist (module gate)

The module cannot move to `submitted_for_review` until every item below is checked. This mirrors the platform's draft → review → publish workflow (ADR-0037) and the Five Qualities discipline (ADR-0039).

### Identity fields

- [ ] `module_identity.primary_author.author_name` matches an active row in `hammerex_nex_brain_certifications` for this brain
- [ ] `module_identity.primary_author.certification_id` is valid and unexpired
- [ ] `module_identity.reviewer.reviewer_id` is populated AND different from `primary_author.author_id`
- [ ] `authored_date` and `review_date` are set on every entry
- [ ] `proposed_semver` and `version_bump_type` are set and mutually consistent

### Citation coverage

- [ ] 100% of entries have a `source_type`
- [ ] 100% of entries have a `source_reference` that validates against citation_requirements.md
- [ ] 100% of entries pass Section 3's origin classification checklist
- [ ] No entry cites "internal knowledge", "common practice", or an unnamed source

### Reviewer sign-off

- [ ] Reviewer has walked Section 3's checklist against every entry
- [ ] Reviewer has run each entry through the Five Qualities filter (Accuracy · Consistency · Explainability · Completeness · Honesty)
- [ ] Reviewer has confirmed the module improves at least one of the Five Qualities vs the prior version
- [ ] Reviewer has confirmed the Trust Question passes ("does this increase professional trust tomorrow vs today?")
- [ ] Reviewer has confirmed the Professional Test passes ("would a master tradesperson recommend this to a peer?")
- [ ] Reviewer has recorded any dissents in `review_notes`

### Adversarial questions passed

- [ ] The module has been challenged with at least the adversarial question set defined for its topic (see the Chief Reference Brain Engineer's adversarial catalogue)
- [ ] Every failure produced either a new entry in this draft OR an explicit `known_gaps` entry
- [ ] No adversarial question was silently dropped

### Explainability envelope readiness

- [ ] Every entry can produce a `BrainAnswerEnvelope` populated with `evidence` from its `source_reference`
- [ ] The `reason` field can be filled from the body's "Why" section
- [ ] The `trade_rule` field can be filled from a hard-rule / regulation / standard reference where one applies
- [ ] The `confidence` value maps cleanly to the entry's `confidence` band

If any box is unticked, the draft returns to the author. It does NOT enter the review queue.

---

## Handoff

When Section 5 is fully checked, the author submits the draft via the Draft Workspace → `submitted_for_review`. From this point the module is out of the author's hands until the reviewer either approves it, rejects it, or requests changes (see `approval_workflow.md`).
