# 0314a · NEX Truth Engine · Rule Parity Certification

**Status:** Proposed · audit doctrine only · database freeze in force · `quality-checker` never modified
**Founder:** Phillip · directive 2026-09-11 · ADR-0314 approved
**Depends on:**
- ADR-0314 · Unified NEX Truth Engine (this ADR delivers Rule TE3 · rule-parity mandatory)
- ADR-0309.1 · Logical Authority Model
- `data/nex-english-source-map/gate-2-supabase-audit.md`
- `data/nex-english-source-map/path-c-overlap-analysis-2026-09-11.md`

---

## Purpose

ADR-0314 Rule TE3 mandated that every physical Truth Engine verifier must satisfy the **same logical rule set**. But the rule set was never enumerated. It could not be — no ADR had inspected `quality-checker@677`'s actual behaviour.

This ADR delivers that enumeration. It is an audit against observable behaviour · not against source code (which is not accessible from this vantage point). Every rule below carries an explicit confidence label:

- **OBSERVED** · directly provable from contradiction rows · feedback rows · or status transitions
- **INFERRED** · high-confidence hypothesis from multiple observations · not directly seen
- **UNKNOWN** · must exist logically but cannot be confirmed from outputs alone
- **NEEDS_FOUNDER** · resolvable only by founder input

`quality-checker@677` is not modified. Not read. Not touched. Only its outputs and their traces in `contradictions` · `knowledge_records` · `knowledge_feedback` · `record_versions` · `graph_edges` · `confidence_scores` · `sources` were inspected.

## Method

Read-only queries against the NEX-dedicated Supabase project. Every query is a SELECT. Outputs snapshotted for evidence.

- **All 8 rows** of `contradictions` fetched · classified by category
- **1,000-row sample** of `knowledge_records` cross-tabbed on `status × authorised_by`
- **All 402 rows** of `knowledge_feedback` distributed by `feedback_kind` · `severity` · `feedback_source` · `applied_to_prompts` · `context.previous_status` × `context.new_status`
- **Sample** of `confidence_scores` · `record_versions` · `graph_edges`
- **Two distinct verifier identities** observed: `quality-checker@677` (7 detections 2026-08-06) and `quality-checker@22408` (1 detection 2026-08-08)

---

## Precision doctrine · locked terms

The Truth Engine's usefulness depends on a small number of terms meaning **exactly one thing** wherever they appear in ADRs, code, or reviewer output. These ten terms are locked. Additions require an ADR. Redefinition requires an ADR.

### D-1 · deterministic

Same input state + same rule-set version → same verdict, every time.

No wall-clock dependency (except explicit timestamp fields). No randomness. No LLM-adjacent variance without an explicit `heuristic` marker and founder-per-verdict approval (Rules R-03 · R-07 today · both flagged NEEDS_FOUNDER).

### D-2 · versioned

Every Truth Engine rule carries a semver-style `rule_version` (e.g. `R-04.v1.0.0`). Every verdict cites the `rule_version` it was rendered against.

Rule changes are ADR-gated. Existing verdicts remain valid against their rule_version even if a newer version supersedes.

### D-3 · substrate-neutral

A rule may not produce a different verdict merely because the target row lives in Supabase vs `nex_dev` vs a future substrate.

If a rule needs substrate-specific behaviour (e.g. because the substrate schema differs), the rule declares an explicit `substrate_scope` field and the ADR that adds the substrate-specific variant must certify that the LOGICAL verdict is unchanged.

### D-4 · fail-closed

When uncertainty exists · missing input · missing evidence · ambiguous match · unreachable substrate · the verifier does NOT produce an authoritative verdict.

Default outcome under uncertainty is `unknown` or `cannot_certify`. Never authoritative-by-default. Never plausible-guess-as-verdict.

Mirrors ADR-0311 Rule B6 (unknown is a valid deterministic answer) and ADR-0314 Rule TE9 (substrate unreachable blocks promotion).

### D-5 · non-bypassable

Router, LLM, workers, agents, or any runtime component **cannot** skip the Truth Engine on writes to canonical objects.

Attempts to bypass are audit-logged as violations. Guardian rejects writes that lack a Truth Engine verdict for the target status. Every canonical status transition requires a Truth Engine verdict OR an explicit founder override (which is itself audit-logged per TE4).

### D-6 · reproducible

Given the same input row (or its historical version) + the same `rule_version` + the same evidence/provenance + the verification timestamp, replaying the rule produces the same verdict.

Verdicts can be replayed for audit. A verdict from 2026-08-06 stays reproducible in 2027-08-06 provided the input row, its provenance, and the referenced rule_version are retrievable.

### D-7 · auditable

Every promotion · rejection · contradiction · override · status change is captured in an audit event with attributable authorship (verifier identity for verifier verdicts · `feedback_source` for founder verdicts).

Silent state change is forbidden. Mirrors ADR-0314 Rule TE12.

### D-8 · idempotent

Repeating the same verification against the same input state does not produce conflicting outcomes. Second-run must equal first-run.

If the input state changes between runs, verdicts may differ · but each verdict is stable for its state snapshot.

### D-9 · monotonic promotion

Status transitions follow the ladder in one direction only for verifier-issued verdicts:

`draft → guardian_ok → truth_engine_ok → authoritative`

Verifier CANNOT skip states. Verifier CANNOT reverse states.

Reverse transitions (`authoritative → deprecated` · `deprecated → authoritative`) require explicit founder authorisation (feedback_kind='deprecation' or 'promotion'). Reverse transitions are audit-logged per D-7.

### D-10 · explicitly scoped

Every rule declares which LAM object types + logical layers it governs.

Silent widening of a rule's scope (e.g. R-04 originally covering `knowledge_records` suddenly being applied to `nex.concepts`) is forbidden. Scope changes require an ADR.

---

## Three architectural guardrails (founder-authored · verbatim)

These sentences are locked doctrine. Any implementation ADR (0314e onwards) must satisfy every one.

### G-1 · Rule parity discipline

> **Rule parity must be deterministic, versioned, substrate-neutral, and fail-closed.**

Any verifier implementing a rule must satisfy D-1 · D-2 · D-3 · D-4 simultaneously. Failing any one voids parity certification for that rule.

### G-2 · Non-bypass discipline

> **No NEX runtime component may bypass, reinterpret, or weaken a certified Truth Engine rule.**

Router (ADR-0311) is read-only for canonical writes (Rule B8) · this restates the same guarantee for LLMs, workers, agents, and any future runtime component. Weakening includes:
- Applying a subset of a rule silently
- Downgrading a certified rule to `heuristic` without an ADR
- Skipping a rule for performance
- Interpreting a rule differently for edge cases
- Producing an authoritative-tier verdict when the rule would have failed

### G-3 · Verdict reproducibility

> **Every Truth Engine verdict must be reproducible from its input, rule-set version, evidence/provenance, and verification timestamp.**

Verdict audit rows carry `object_stable_id · object_snapshot_ref · rule_version · evidence_refs[] · verdict · verification_timestamp · verdict_by`. Given these five components, a future audit replay must produce the same verdict. This enables regression testing, rule-set upgrades that preserve historical validity, and forensic review.

## Evidence · headline distributions

### Contradictions detected (all 8)

| # | Detected by | Detected at | Summary |
|---|---|---|---|
| 1 | quality-checker@677 | 2026-08-06 | claims 100,000+ concepts and 1M relationships for staircase — wildly inflated for a single trade |
| 2 | quality-checker@677 | 2026-08-06 | Record claims manufacturer audience but content addresses end customers |
| 3 | quality-checker@677 | 2026-08-06 | Corporate catalog tone contradicts NEX warm/cheeky/down-to-earth voice mandate |
| 4 | quality-checker@677 | 2026-08-06 | Title and summary claim 100mm maximum gap, but body states gaps must not exceed 90mm |
| 5 | quality-checker@677 | 2026-08-06 | References Approved Document K (100mm sphere test) contradicting the 90mm claim in body |
| 6 | quality-checker@677 | 2026-08-06 | Record claims to be a 'NEX door' knowledge entry but contains only developer placeholder text about API keys |
| 7 | quality-checker@677 | 2026-08-06 | Content addresses developers configuring LLM adapters, not homeowners choosing doors |
| 8 | quality-checker@22408 | 2026-08-08 | The record lacks plausible connection between six workers and baluster spacing proveout |

All 8 have `status='open'` (unresolved). All 8 have `record_a_id === record_b_id` — **every contradiction observed is INTERNAL to a single record**. No cross-record contradiction detected (yet). No cross-substrate.

### Status × authorised_by cross-tab (1000-row sample)

| Status | authorised_by=Philip | authorised_by=null | Row count |
|---|---:|---:|---:|
| DRAFT | 0 | 797 | 797 |
| AUTHORITATIVE | 22 | 93 | 115 |
| DEPRECATED | 0 | 77 | 77 |
| UNDER_REVIEW | 0 | 11 | 11 |

**Critical finding: 93 rows are AUTHORITATIVE with `authorised_by=null`.** The verifier CAN promote to AUTHORITATIVE autonomously without founder review under some conditions. This must be captured as a canonical rule (Rule 9 below).

### Founder feedback (402 rows)

| Distribution | Values |
|---|---|
| `feedback_kind` | rejection: 339 (84%) · approval: 62 (15%) · edit: 1 |
| `severity` | moderate: 402 (100%) |
| `feedback_source` | philip: 402 (100%) |
| `applied_to_prompts` | true: 160 · false: 242 |

### Status transitions observed (from `knowledge_feedback.context`)

| Previous → New | Count | Interpretation |
|---|---:|---|
| DRAFT → DEPRECATED | 178 | Founder rejects a draft outright |
| UNDER_REVIEW → DEPRECATED | 84 | Founder rejects during review |
| DEPRECATED → DEPRECATED | 77 | Idempotent · marking already-deprecated as still-deprecated |
| UNDER_REVIEW → AUTHORITATIVE | 61 | Founder promotes to authoritative during review |
| Same-status (self-loops) | 2 | Rare · possibly notes attached to an authoritative or under-review row without status change |

**Observed founder promotion path:** `UNDER_REVIEW → AUTHORITATIVE` requires founder approval. **Verifier-only path** (93 rows) skips UNDER_REVIEW entirely — verifier promotes DRAFT → AUTHORITATIVE without founder in the loop.

## The enumerated rules

### R-01 · INFLATED_CLAIM_QUANTITY

- **Confidence:** OBSERVED
- **Evidence:** Contradiction 1 · "claims 100,000+ concepts and 1M relationships for staircase — wildly inflated for a single trade"
- **What it checks:** Records that assert implausibly large numeric quantities relative to their domain
- **Input required:** record body · category
- **Deterministic?** UNKNOWN — implausibility threshold not published
- **Pass condition:** numeric claims fall within a domain-appropriate range
- **Fail condition:** at least one numeric claim exceeds a domain-plausibility threshold
- **Contradiction behaviour:** emits `contradictions` row with the offending record referenced in both `record_a_id` and `record_b_id`
- **Canonical or Supabase-specific:** CANONICAL — every future NEX verifier must implement this
- **Known limitations:** The plausibility threshold per domain is not documented. Requires NEEDS_FOUNDER input for `nex_dev` verifier parity.

### R-02 · AUDIENCE_CONSISTENCY

- **Confidence:** OBSERVED
- **Evidence:** Contradictions 2, 7 · "claims manufacturer audience but content addresses end customers" · "Content addresses developers not homeowners"
- **What it checks:** Declared audience field/tag matches actual textual audience signals in body
- **Input required:** record body · category · declared audience metadata (if any)
- **Deterministic?** LIKELY (audience keyword detection) but signal list not published
- **Pass condition:** body language matches declared audience
- **Fail condition:** body targets a different audience than declared
- **Canonical or Supabase-specific:** CANONICAL
- **Known limitations:** the mapping from category → expected audience is inferred (e.g. category "NEX door" → audience "homeowners buying doors") but not explicitly documented. NEEDS_FOUNDER for parity certification.

### R-03 · VOICE_TONE_CONSISTENCY

- **Confidence:** OBSERVED
- **Evidence:** Contradiction 3 · "Corporate catalog tone contradicts NEX warm/cheeky/down-to-earth voice mandate"
- **What it checks:** Content tone matches NEX house voice
- **Input required:** record body · NEX voice specification
- **Deterministic?** UNKNOWN — style analysis may involve heuristics · possibly LLM-adjacent
- **Pass condition:** tone matches
- **Fail condition:** tone diverges (e.g. corporate catalog voice)
- **Canonical or Supabase-specific:** SEMI-CANONICAL — the specification "NEX warm/cheeky/down-to-earth" is a NEX-wide voice mandate. But rule enforcement may vary by substrate (accommodation content ≠ trade content voice specs, potentially).
- **Known limitations:** the actual voice specification is not published in ADRs. NEEDS_FOUNDER · what document is authoritative for NEX voice?

### R-04 · INTERNAL_NUMERIC_CONSISTENCY

- **Confidence:** OBSERVED
- **Evidence:** Contradiction 4 · "Title and summary claim 100mm maximum gap, but body states gaps must not exceed 90mm"
- **What it checks:** Numeric claims across sections of a single record (title · summary · body) agree
- **Input required:** record title · summary · body_markdown
- **Deterministic?** YES (numeric extraction + comparison)
- **Pass condition:** all numeric claims for the same measurement agree within tolerance
- **Fail condition:** two sections disagree on a numeric value for the same measurement
- **Contradiction behaviour:** contradiction row with clear numeric conflict summary
- **Canonical or Supabase-specific:** CANONICAL — trivially applicable to any record with numeric claims

### R-05 · AUTHORITY_REFERENCE_CONSISTENCY

- **Confidence:** OBSERVED
- **Evidence:** Contradiction 5 · "References Approved Document K which specifies 100mm sphere test, contradicting the 90mm claim in body"
- **What it checks:** Cited external authorities agree with the record's own claims
- **Input required:** record body · known external authority knowledge base (Approved Documents · industry standards)
- **Deterministic?** MOSTLY — depends on external-authority KB being canonical
- **Pass condition:** cited authority's stated value matches record's claim
- **Fail condition:** citation contradicts record claim
- **Canonical or Supabase-specific:** CANONICAL where an external-authority KB exists · substrate-scoped otherwise
- **Known limitations:** external-authority KB is not documented in ADRs. NEEDS_FOUNDER · which external authorities does NEX treat as canonical (Approved Docs · BS · European Norms · other)?

### R-06 · CATEGORY_CONTENT_ALIGNMENT

- **Confidence:** OBSERVED
- **Evidence:** Contradiction 6 · "Record claims to be a 'NEX door' knowledge entry but contains only developer placeholder text about API keys"
- **What it checks:** Record's declared category matches actual content subject
- **Input required:** category · body
- **Deterministic?** LIKELY (topic detection heuristics)
- **Pass condition:** body subject is congruent with category taxonomy
- **Fail condition:** body subject is unrelated to category (e.g. category="NEX door" · body="API keys")
- **Canonical or Supabase-specific:** CANONICAL

### R-07 · CONNECTION_PLAUSIBILITY

- **Confidence:** OBSERVED
- **Evidence:** Contradiction 8 · "The record lacks plausible connection between six workers and baluster spacing proveout"
- **What it checks:** Record's asserted relationships/connections make sense
- **Input required:** record body · graph_edges references
- **Deterministic?** UNKNOWN — plausibility may involve heuristics or LLM-adjacent scoring
- **Pass condition:** connections are semantically coherent
- **Fail condition:** record asserts a connection that lacks a plausible bridge
- **Canonical or Supabase-specific:** CANONICAL — every knowledge record makes connections
- **Known limitations:** exact plausibility criteria not published. NEEDS_FOUNDER for parity.

### R-08 · FOUNDER_REJECTION_DEPRECATES

- **Confidence:** OBSERVED (from 178 DRAFT→DEPRECATED + 84 UNDER_REVIEW→DEPRECATED transitions in feedback context)
- **Evidence:** every rejection feedback row has `context.new_status='DEPRECATED'`
- **What it enforces:** `feedback_kind='rejection'` from `feedback_source='philip'` transitions the referenced record to `DEPRECATED` status
- **Input required:** `knowledge_feedback` row · referenced `record_id`
- **Deterministic?** YES
- **Pass condition:** N/A (this is a promotion path, not a validation)
- **Effect:** record status flips to DEPRECATED
- **Canonical or Supabase-specific:** CANONICAL — founder authority pattern per ADR-0309.1 · Rule 4 of the LAM
- **Applied to prompts:** 60% of rejections have `applied_to_prompts=false` (242 of 402) — suggesting **founder rejection is authoritative regardless of whether the LLM prompt integration ran**. Rejection stands even if downstream prompt updates were skipped.

### R-09 · FOUNDER_APPROVAL_PROMOTES

- **Confidence:** OBSERVED (61 UNDER_REVIEW→AUTHORITATIVE transitions)
- **Evidence:** every approval feedback row has `context.new_status='AUTHORITATIVE'`
- **What it enforces:** `feedback_kind='approval'` from `feedback_source='philip'` transitions from `UNDER_REVIEW` to `AUTHORITATIVE`
- **Path:** only observed on UNDER_REVIEW records · not DRAFT
- **Effect:** record's `authorised_by` field set to 'Philip' (all 22 Philip-authorised records match this pattern)
- **Canonical or Supabase-specific:** CANONICAL

### R-10 · AUTONOMOUS_VERIFIER_PROMOTION

- **Confidence:** OBSERVED (93 AUTHORITATIVE records with `authorised_by=null`)
- **Evidence:** cross-tab shows AUTHORITATIVE × null: 93 rows (7× more than AUTHORITATIVE × Philip: 22)
- **What it permits:** verifier may promote DRAFT (or UNDER_REVIEW) → AUTHORITATIVE without founder input under some conditions
- **Preconditions inferred:** must pass all validation rules (R-01 through R-07) · must have provenance · likely must have confidence above a threshold
- **Founder override:** founder can always override by issuing `feedback_kind='rejection'` (which sends the record to DEPRECATED per R-08)
- **Canonical or Supabase-specific:** **NEEDS_FOUNDER · this is the most sensitive rule.** The 93:22 ratio means most authoritative content was NOT reviewed by Philip. Founder must confirm whether this is intentional. If yes, `nex_dev` verifier gets the same permission. If no, current AUTHORITATIVE-null records may need retrospective review · this is out of scope for ADR-0314a.

### R-11 · PER_CLAIM_CONFIDENCE_SCORING

- **Confidence:** OBSERVED
- **Evidence:** `confidence_scores` has 4,228 rows across ~3,600 records — multiple claims per record
- **Structure:** id · record_id · claim_key · claim_text · classification · confidence_band · confidence_score · source_type · source_ref
- **What it enforces:** confidence is scored per-CLAIM within a record · not per-record aggregate
- **Bands:** `high` observed in sample · likely `medium` / `low` variants exist
- **Two idioms coexist:** `confidence_band` (categorical) AND `confidence_score` (numeric 0-100). Sample shows `confidence_band=high · confidence_score=0` which suggests one is authoritative and the other is display or vestigial.
- **Canonical or Supabase-specific:** CANONICAL — per-claim scoring is a strong pattern any future verifier should mirror
- **NEEDS_FOUNDER:** which of `confidence_band` vs `confidence_score` is the authoritative field? Rule TE8 says Router normalises to numeric 0-1 · but the input scale must be settled.

### R-12 · CLAIM_CLASSIFICATION_TAXONOMY

- **Confidence:** OBSERVED
- **Evidence:** every confidence_score row has `classification` (e.g. "NEX_concept")
- **What it enforces:** every claim is tagged with a classification from a controlled taxonomy
- **Known values (partial):** `NEX_concept` observed · other values likely exist
- **Canonical or Supabase-specific:** CANONICAL
- **NEEDS_FOUNDER:** full classification taxonomy · what values exist · what each means

### R-13 · GRAPH_EDGE_KIND_TAXONOMY

- **Confidence:** OBSERVED
- **Evidence:** `graph_edges` sample shows `edge_type='part_of'` and `edge_type='composes_with'`
- **What it enforces:** edges use a controlled `edge_type` vocabulary
- **Values observed:** part_of · composes_with — full distribution not fetched (query errored on final assemble)
- **Canonical or Supabase-specific:** CANONICAL — mirrors ADR-0309.1 relationship-kind pattern
- **NEEDS_FOUNDER:** full edge_type vocabulary

### R-14 · GAP_MARKER_ON_EDGES

- **Confidence:** OBSERVED
- **Evidence:** graph_edges has `is_gap_marker: boolean` flag · one sample row has `is_gap_marker: true`
- **What it enforces:** edges pointing at records that don't yet exist are marked as gap markers
- **Effect:** gap-marker edges are known knowledge gaps recorded structurally rather than in a separate gap ledger
- **Canonical or Supabase-specific:** CANONICAL — clever pattern · every verifier should preserve it

### R-15 · EDGE_PROVENANCE_REQUIRED

- **Confidence:** OBSERVED
- **Evidence:** every graph_edges sample has `provenance: "importer:data/knowledge/records/business/nex-business-brain.md"`
- **What it enforces:** every edge carries provenance (which file / process / author declared it)
- **Canonical or Supabase-specific:** CANONICAL — mirrors ADR-0309.1 Rule 5

### R-16 · PROVENANCE_LINK_REQUIRED_PER_RECORD

- **Confidence:** OBSERVED
- **Evidence:** `sources` has 3,625 rows vs `knowledge_records` 3,627 — near 1:1 · only 2 records lack a linked source
- **What it enforces:** every record has a provenance row in `sources`
- **Canonical or Supabase-specific:** CANONICAL — LAM Rule 5 restated

### R-17 · VERSIONING_ON_SIGNIFICANT_CHANGES

- **Confidence:** OBSERVED
- **Evidence:** `record_versions` has 22 rows for 3,627 records · sparse coverage
- **What it enforces:** version snapshots on significant changes (not every edit)
- **Version format:** `record_version="1.0.0"` semver-style
- **Body snapshot:** `body_markdown` copied into version row
- **Canonical or Supabase-specific:** CANONICAL — mirrors ADR-0309.1 Rule 10
- **NEEDS_FOUNDER:** what constitutes a "significant change"?

### R-18 · MULTIPLE_VERIFIER_IDENTITIES

- **Confidence:** OBSERVED
- **Evidence:** two verifier IDs seen (`quality-checker@677`, `quality-checker@22408`)
- **What it means:** more than one verifier instance runs · identities are logged per detection
- **Canonical or Supabase-specific:** CANONICAL — future `nex_dev` verifier gets its own `@id`
- **NEEDS_FOUNDER:** what is `@677` vs `@22408`? Two deployments? Two versions? Two rules? This must be clarified before rule-parity certification can complete.

### R-19 · INTERNAL_CONTRADICTIONS_FIRST_CLASS

- **Confidence:** OBSERVED (all 8 contradictions are internal · `record_a_id === record_b_id`)
- **What it enforces:** contradictions between claims WITHIN a single record are first-class Truth Engine outputs
- **Canonical or Supabase-specific:** CANONICAL

### R-20 · CROSS_RECORD_CONTRADICTION

- **Confidence:** UNKNOWN
- **Evidence gap:** zero cross-record contradictions observed in 8 samples. Cannot confirm whether the verifier attempts cross-record detection at all.
- **NEEDS_FOUNDER:** does `quality-checker@677` compare claims ACROSS records? If not, this is a Truth Engine capability gap that ADR-0314c (Cross-Substrate Contradiction Detection) must eventually address for cross-record AND cross-substrate coverage.

## Rules that require founder input · summary

Six rules cannot be certified until founder confirms:

| Rule | Question for founder |
|---|---|
| R-01 · INFLATED_CLAIM_QUANTITY | What is the plausibility-threshold table per domain? |
| R-02 · AUDIENCE_CONSISTENCY | What is the canonical audience-per-category mapping? |
| R-03 · VOICE_TONE_CONSISTENCY | What document is authoritative for NEX voice mandate? Where is "warm/cheeky/down-to-earth" formally specified? |
| R-05 · AUTHORITY_REFERENCE_CONSISTENCY | Which external authorities does NEX treat as canonical (Approved Docs · BS · European Norms · other)? |
| R-07 · CONNECTION_PLAUSIBILITY | What plausibility criteria are canonical? |
| R-10 · AUTONOMOUS_VERIFIER_PROMOTION | Is verifier-only promotion (DRAFT/UNDER_REVIEW → AUTHORITATIVE without founder input) intentional? 93 out of 115 AUTHORITATIVE records were promoted this way. |
| R-11 · PER_CLAIM_CONFIDENCE_SCORING | Which of `confidence_band` vs `confidence_score` is authoritative? |
| R-12 · CLAIM_CLASSIFICATION_TAXONOMY | Full classification value list? |
| R-13 · GRAPH_EDGE_KIND_TAXONOMY | Full edge_type vocabulary? |
| R-17 · VERSIONING_ON_SIGNIFICANT_CHANGES | Definition of "significant change" for versioning? |
| R-18 · MULTIPLE_VERIFIER_IDENTITIES | What is `@677` vs `@22408`? Distinct deployments? Versions? Rule subsets? |
| R-20 · CROSS_RECORD_CONTRADICTION | Does the verifier attempt cross-record contradiction detection? |

Founder answers unblock ADR-0314e (nex_dev verifier implementation). Without them, the `nex_dev` verifier can only implement the rules that are fully OBSERVED (R-04, R-06, R-08, R-09, R-14, R-15, R-16, R-19). Everything else needs founder-approved specification first.

## Certification test criteria (what any future verifier must satisfy)

Any future physical Truth Engine verifier (starting with `nex_dev`) must pass this certification before it can promote a canonical row past `guardian_ok`. Every criterion below refers to the precision terms (D-1 to D-10) and the three architectural guardrails (G-1 to G-3) locked above.

### Certification principle (founder-authored · locked)

> **A certified Truth Engine verifier must produce deterministic, reproducible, versioned and substrate-neutral verdicts, and must fail closed when a required rule or authority is unavailable.**

This single sentence is the certification bar. Every rule the verifier implements must satisfy it. Every future ADR that adds a verifier or amends a rule must satisfy it. Failure of any one component (deterministic · reproducible · versioned · substrate-neutral · fail-closed) voids the certification.

### C-1 · Rule-implementation coverage + explicit scope (D-10)

The verifier declares which of R-01 through R-20 it implements AND for each declared rule states its `object_scope` (LAM object types) and `layer_scope` (logical layers).

Rules not declared → verifier produces `unknown` (D-4 fail-closed) · never fabricates. Silent widening of scope (D-10) is a certification failure.

### C-2 · Reference fixture set + determinism (D-1)

For each rule the verifier implements, the certification requires a founder-authored test corpus with known correct outputs · positive cases · negative cases · edge cases · known false-positive traps.

The verifier must produce the fixture's expected outcomes deterministically (D-1). Any non-deterministic rule (voice · plausibility) is marked `heuristic` and requires per-verdict founder approval (per D-1 escape hatch). Fixture authoring deferred to ADR-0314a.1.

### C-3 · Output format · reproducibility (G-3)

Every verifier verdict must carry the five reproducibility components:

```
{
  object_stable_id,           // WHICH object
  object_snapshot_ref,        // WHICH version of the input state
  rule_version,               // WHICH rule (D-2 versioned)
  evidence_refs[],            // WHICH provenance justified the verdict
  verification_timestamp,     // WHEN the verdict was rendered
  verdict,                    // pass · fail · unknown · cannot_certify
  verdict_by,                 // verifier identity (or founder identity for overrides)
  contradiction_summary?,     // if verdict=fail
  prior_status,               // WHERE the ladder was before
  new_status,                 // WHERE the ladder is after
  override                    // true only when founder overrides · false for verifier verdicts
}
```

Given the first five fields, a future replay against `rule_version` must produce the same `verdict` (G-3 · D-6 reproducible).

### C-4 · Determinism proof (D-1) + idempotence (D-8)

Every verifier must, for every rule it declares:

- Produce the same verdict for the same input state · same rule_version (D-1)
- Produce the same verdict when the same verification is repeated back-to-back (D-8 idempotence)

A rule that fails either test cannot receive rule-parity certification.

### C-5 · Rule-parity audit trail (D-7 auditable)

The verifier logs every rule invocation with `rule_id · rule_version · input_hash · verdict · verification_timestamp · verifier_identity`. Log rows are inspectable by founder for spot-audit. Silent verification is forbidden (G-2).

### C-6 · Founder override respect (TE4)

Every verifier must recognise a founder override (`knowledge_feedback` row with `feedback_source='philip'` and `feedback_kind` in the promotion enum) and treat it as final. Verifier cannot silently re-promote a record that founder deprecated (D-9 monotonic promotion inverse requires founder authority) · verifier cannot silently deprecate a record that founder authorised.

### C-7 · Substrate-neutrality proof (D-3)

For each rule the verifier implements, the certification runs the SAME fixture against SAME-shaped rows in different physical substrates (nex_dev Postgres · Supabase · repo-file). Verdicts must be identical.

If a rule requires substrate-specific behaviour (differing schemas), the verifier declares `substrate_scope` explicitly and the certification ADR must certify that the LOGICAL verdict is unchanged across substrates. Silent divergence is a certification failure.

### C-8 · Non-bypass proof (G-2 · D-5)

The verifier certifies that:

- No canonical status transition can occur without a Truth Engine verdict OR a founder override
- Router `getKnowledge` calls do NOT trigger promotion — reads are inert
- LLM outputs cannot alter canonical status without going through Guardian → Truth Engine → substrate write path
- Worker jobs writing to canonical substrates must present a Truth Engine verdict per row

Attempts to bypass appear in the audit log (C-5) as `bypass_attempt` events and are rejected at the substrate write layer.

### C-9 · Rule-set version discipline (D-2 versioned)

The certification ADR ships with an explicit rule_version manifest (e.g. `R-04.v1.0.0`) and a table listing which historical verdicts were rendered against which rule_version.

Rule upgrades increment rule_version. Old verdicts remain valid against their historical rule_version. Recertifying a record under a new rule_version emits a new verdict (with the new rule_version cited) · never overwrites the old.

### C-10 · Fail-closed proof (D-4)

For each rule the verifier implements, certification includes a `fail_closed_test`: inputs that are ambiguous, incomplete, or reference unreachable substrates. Expected outcomes are `unknown` or `cannot_certify` · NEVER `authoritative`.

A rule that produces an authoritative verdict under uncertainty fails certification (G-1 explicit reference).

## What ADR-0314a does NOT do

- ❌ Does not modify `quality-checker@677` or `@22408`.
- ❌ Does not build a `nex_dev` verifier.
- ❌ Does not migrate any row.
- ❌ Does not change any status.
- ❌ Does not touch `contradictions`, `knowledge_feedback`, `record_versions`, `sources`, `confidence_scores`, `graph_edges`.
- ❌ Does not author the reference fixture set (deferred to ADR-0314a.1).
- ❌ Does not answer the NEEDS_FOUNDER rules (deferred to founder).
- ❌ Does not draft ADR-0314b, c, d, or e.
- ❌ Does not open Gate 3.
- ❌ Does not add new rules (R-01 to R-20 remain the enumerated set · precision doctrine and guardrails sharpen the existing rules, they do not expand scope).

## Follow-up ADRs (reserved slots)

- **ADR-0314a.1** · Reference Fixture Set — founder-authored positive/negative/edge cases per rule. Doctrine only · no code.
- **ADR-0314a.2** · NEEDS_FOUNDER Resolutions — the 12 questions from the "requires founder input" table above become a decision doc. Doctrine.
- **ADR-0314b** · Truth Engine Verdict Storage (already reserved).
- **ADR-0314c** · Cross-Substrate Contradiction Detection (already reserved).
- **ADR-0314d** · Founder Override Audit Discipline (already reserved).
- **ADR-0314e** · `nex_dev` Truth Engine Verifier Implementation (already reserved · **Gate 3 candidate — first executable ADR**).

## Freeze status · post-ADR-0314a

- Hard freeze on writes to `nex_dev` — held.
- Hard freeze on writes to Supabase — held.
- `quality-checker@677` untouched.
- `quality-checker@22408` untouched.
- No new verifier built.
- No table created.
- No rule fixture authored.
- No reference-authority KB built.
- Repo orphans untouched.
- English Brain expansion permanently frozen.
- Gate 3 remains CLOSED.

## References

- ADR-0028 · NEX Intelligence Constitution
- ADR-0300 · NEX own storage migration blueprint
- ADR-0308 · English Brain v1
- ADR-0309 · Layered Architecture
- ADR-0309.1 · Logical Authority Model
- ADR-0310 · Knowledge Router + Multi-Substrate Domain Authority
- ADR-0311 · Router Reference Interface
- ADR-0312 · Semantic ↔ Domain Bridge
- ADR-0313 · Repo Orphan Classification
- ADR-0314 · Unified NEX Truth Engine
- `data/nex-english-source-map/gate-2-supabase-audit.md`
- `data/nex-english-source-map/path-c-overlap-analysis-2026-09-11.md`

---

**End of ADR-0314a · audit doctrine only.**
**Zero code written. Zero verifier modified. Zero rows written. Zero rules invented.**
**Twenty rules enumerated with honest confidence labels.**
**Ten precision terms locked (D-1 to D-10).**
**Three architectural guardrails locked (G-1 · G-2 · G-3).**
**Ten certification criteria locked (C-1 to C-10) · each citing precision terms and guardrails explicitly.**
**Freeze in force across all substrates.**
