# Citation Requirements · Reference Brain Sources

**Purpose:** Enforce Rule C (Attributable Origin) at the format level. Every entry authored via `module_author_template.md` carries a `source_type` (one of five) and a `source_reference`. This document specifies the exact shape each `source_reference` must take, per origin type.

**Non-negotiable rule:** an entry with a source_reference that does not conform to this document CANNOT be published. The reviewer rejects it. The Explainability envelope depends on these fields being machine-parseable.

**Related:** `module_author_template.md` · `interview_template.md` · Explainability contract in `src/lib/nex/brains/_living_types.ts` (`BrainEvidence`).

---

## Origin type overview

| Code | Origin type | Renders in evidence.kind as | Trust weight |
|---|---|---|---|
| E | Named expert | `brain_module` (author = expert) | Depends on credentials + review depth |
| R | Regulation | `regulation` | Highest — legal instrument |
| S | Standard | `regulation` (published body) | High — industry-agreed body |
| M | Manufacturer specification | `material_spec` | Product-scoped only |
| F | Reviewed field observation | `brain_module` (with reviewer attribution) | Requires reviewing expert co-signature |

Multi-origin claims (e.g. `[E, R]`) require ONE well-formed reference block per code.

---

## E · Named expert

Used when a claim rests on the personal authority of a named, credentialed practitioner. The claim must be attributable to a specific interview or written contribution — not a generic "from my experience" attribution.

### Required fields

```yaml
source_type: E
source_reference:
  named_expert:
    full_name:              <required>
    credentials:            <required — the certification / trade qualification / body membership that qualifies the expert on THIS topic>
    business_or_org:        <optional>
    consent_to_be_named:    yes   # required
    consent_recorded_on:    <YYYY-MM-DD>
  capture:
    interview_id:           <FK into interview record produced via interview_template.md — required>
    claim_id:               <the claim_id inside that interview — required>
    capture_date:           <YYYY-MM-DD>
    capture_medium:         <one of: interview_video | interview_audio | interview_written | written_contribution | review_approval>
    capture_location:       <workshop | site | video call | phone | email — plain-English>
  reviewer_of_this_entry:
    name:                   <required — different person to the named expert>
    credentials:            <required>
    review_date:            <YYYY-MM-DD>
```

### Rendering as evidence (Explainability envelope)

```json
{
  "kind": "brain_module",
  "ref": "expert:{full_name}|interview:{interview_id}|claim:{claim_id}",
  "excerpt": "<verbatim quote from the interview — 40 words maximum>"
}
```

### Prohibited

- Attribution to a role without a name ("a senior joiner said…")
- Attribution to an unnamed group ("our advisory panel says…") — the panel members must each be named
- Attribution to a deceased practitioner without a documented written record captured while they were alive
- Any expert attribution where `consent_to_be_named: yes` cannot be evidenced from a signed interview record

---

## R · Regulation

Used when a claim cites a legal instrument, building code, statutory document, or regulator-published guidance carrying legal force.

### Required fields

```yaml
source_type: R
source_reference:
  regulation:
    document_title:         <official title — e.g. "Approved Document K: Protection from falling, collision and impact">
    document_number:        <if applicable — e.g. "AD K">
    edition:                <required — e.g. "2013 edition">
    amendment_date:         <required — most recent amendment or reprint date, YYYY-MM>
    clause_number:          <required — the exact clause / paragraph / section being cited>
    clause_title:           <required — the heading of that clause>
    jurisdiction:           <required ISO 3166-2 code — e.g. GB-ENG, GB-SCT, GB-WLS, GB-NIR>
    issuing_body:           <required — e.g. "Ministry of Housing, Communities and Local Government">
    url:                    <required — direct link to the clause, or to the document if the site has no anchor>
    url_captured_on:        <required YYYY-MM-DD — the date the URL was last verified live>
    languages_available:    <list — the languages the document is published in>
    supersedes:             <optional — prior edition superseded by this>
    superseded_by:          <optional — if a newer edition exists; entry MUST be reviewed within 30 days of this field being populated>
```

### Rendering as evidence

```json
{
  "kind": "regulation",
  "ref": "{document_number} {edition} · clause {clause_number} · {jurisdiction}",
  "excerpt": "<verbatim quote from the clause — 40 words maximum>"
}
```

### Prohibited

- Citing a regulation without a clause number — "Doc K says" is not sufficient; the clause must be identified
- Citing a superseded edition without also citing the current edition and explaining why the old edition still applies (grandfathering, historic building, etc.)
- Paraphrasing the clause in a way that changes its meaning
- Citing a regulator's blog post as a regulation — blog posts are Named Expert (E) at best

---

## S · Standard

Used when a claim cites an industry standard published by a recognised standards body (BSI · BS EN · CEN · ISO · ASTM · UL · CSA · etc.). Standards are not laws but are widely referenced by regulations and by the trade.

### Required fields

```yaml
source_type: S
source_reference:
  standard:
    publishing_body:        <required — e.g. "British Standards Institution", "International Organization for Standardization">
    body_shortcode:         <required — e.g. BSI · ISO · CEN · ASTM · UL · CSA>
    standard_number:        <required — e.g. "BS EN 14076:2013">
    standard_title:         <required — full official title>
    year_of_publication:    <required — YYYY>
    year_last_amended:      <optional — YYYY of most recent amendment>
    relevant_clauses:       <required list — e.g. ["5.2.1", "6.3", "Annex B"]>
    clause_summaries:       <required — one sentence per relevant clause explaining what it covers>
    url:                    <required — publisher's page for the standard>
    url_captured_on:        <required YYYY-MM-DD>
    access_note:            <required — "public", "paywalled", "member-only" — informs the reader of retrieval cost>
    supersedes:             <optional — prior standard number superseded>
    superseded_by:          <optional — if a newer standard exists; entry MUST be reviewed within 60 days of this field being populated>
```

### Rendering as evidence

```json
{
  "kind": "regulation",
  "ref": "{standard_number} · clauses {relevant_clauses} · {body_shortcode} {year_of_publication}",
  "excerpt": "<verbatim quote — 40 words maximum, only if quote is public or fair-use permitted>"
}
```

### Prohibited

- Citing a standard by shorthand only (e.g. "BS EN 14076") without a year of publication — standards change and the year disambiguates
- Citing a withdrawn standard without an explanation of why it still applies
- Citing an internal working draft that has not been published

---

## M · Manufacturer specification

Used when a claim cites a specific product's datasheet, installation instructions, or manufacturer-published technical guidance.

### Required fields

```yaml
source_type: M
source_reference:
  manufacturer_spec:
    manufacturer:           <required — full company name>
    manufacturer_country:   <required — where the company is registered>
    product_name:           <required — as printed on the datasheet>
    product_range:          <optional — the family / range the product belongs to>
    sku_or_model:           <required if the product has one>
    document_type:          <required — one of: datasheet | installation_guide | technical_bulletin | safety_data_sheet | certificate>
    document_version:       <required — as printed on the document itself>
    publication_date:       <required — YYYY-MM as printed on the document>
    url:                    <required — direct link to the document>
    url_captured_on:        <required YYYY-MM-DD>
    language_of_document:   <required — ISO 639-1 code>
    scope_of_applicability: <required — countries / regions / installation types this document covers>
    superseded_by:          <optional — newer version reference; entry MUST be reviewed within 30 days of this field being populated>
```

### Rendering as evidence

```json
{
  "kind": "material_spec",
  "ref": "{manufacturer} · {product_name} · {document_type} v{document_version} · {publication_date}",
  "excerpt": "<verbatim quote from the document — 40 words maximum>"
}
```

### Prohibited

- Citing a product page or marketing brochure as a manufacturer_spec — the source must be a technical document
- Citing a distributor's page as a manufacturer_spec — the source must be the manufacturer's own document
- Citing a datasheet older than 5 years without a note explaining that the product is unchanged since (and that note itself must have an origin — usually an E from a manufacturer contact)

---

## F · Reviewed field observation

Used when a claim rests on something a named practitioner has personally observed on projects and that another named expert has reviewed and endorsed as accurate and repeatable. This origin type is more demanding than E because it requires TWO named parties.

### Required fields

```yaml
source_type: F
source_reference:
  field_observation:
    original_observer:
      full_name:            <required>
      credentials:          <required>
      consent_to_be_named:  yes
      consent_recorded_on:  <YYYY-MM-DD>
    reviewing_expert:
      full_name:            <required — MUST NOT equal original_observer.full_name>
      credentials:          <required — should be at least as strong as the observer's>
      review_date:          <required YYYY-MM-DD>
      review_notes:         <required — one sentence explaining why the reviewer endorses the observation as reliable>
    circumstances:
      project_type_or_setting: <required — e.g. "domestic staircase installations, oak, 900 mm width, England">
      observation_period_from:  <required YYYY-MM>
      observation_period_to:    <required YYYY-MM>
      sample_size_note:         <required — how many instances the observation is drawn from (numeric OR qualitative — "at least 40 installations")>
      environmental_notes:      <optional — climate, humidity, building type, whatever constrains applicability>
```

### Rendering as evidence

```json
{
  "kind": "brain_module",
  "ref": "field:{original_observer.full_name}|reviewed_by:{reviewing_expert.full_name}|{observation_period_from}..{observation_period_to}",
  "excerpt": "<the observation in plain terms — 40 words maximum>"
}
```

### Prohibited

- Field observations without a reviewing_expert — a single observer is E, not F
- Field observations where observer and reviewer are the same person
- Field observations attributed to "many years of experience" without a defined period, setting, or sample size

---

## Multi-origin entries

Any entry may cite multiple origins. Format:

```yaml
source_type: multi
source_reference:
  origins:
    - <one full block per origin, as specified above>
    - <...>
```

The Explainability envelope will render `evidence[]` with one element per origin. Multi-origin claims are strongly preferred where they exist — they compound trust.

---

## Retention and change

- Every `source_reference` is stored as-authored inside `hammerex_nex_brain_versions.modules_json`. Versions are immutable — a re-citation requires a new version.
- Where a `url_captured_on` value ages past 12 months, the entry surfaces on the Freshness axis of the Readiness Score and returns to the author's queue.
- Where a `superseded_by` field is populated on a Regulation, Standard, or Manufacturer spec, the entry is flagged for mandatory review within the timeframes noted above.

---

## Failure modes handled

- A URL rots → the `url_captured_on` snapshot proves the entry was correctly cited at authoring time; the Freshness axis triggers re-citation before user harm occurs.
- A regulation is amended → `superseded_by` triggers author review inside 30 days.
- An expert withdraws consent → their attributed entries move to `state: quarantined` and are removed from user-facing answers until re-attributed or superseded.
- A field observation is contradicted by another expert → the entry is flagged, the reviewing_expert is re-contacted, and either the observation is defended, revised, or retired.
