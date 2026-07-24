# ADR-0017: Trade Brain Module Contract · 10-Module Schema · JSON Pack Format · Author Authority

Status: Draft (awaiting signoff)
Date: 2026-07-23
Related: `docs/PHASE_27_TRADE_EXPERT_BRAINS_BLUEPRINT.md` · `docs/ES-01_ENGINEERING_EXECUTION_BIBLE.md` §14.1 (correction #4) · `src/lib/nex/orch/catalog.ts`

## Context

Phase 24 shipped 40 trade specialist agents as thin knowledge-backed stubs. Phase 27 upgrades them into Trade Expert Brains — deep, structured, region-aware, authored by human master tradespeople.

Every Brain author writes against a fixed contract. If the contract is not locked before authoring begins, every subsequent Brain requires schema migrations to match the drift. Authors are contracted humans on paid honoraria — schema churn wastes their time and Nex's money.

ES-01 §14.1 correction #4 challenged the original Phase 27 blueprint which specified 10 modules per Brain at V1. Author capacity in 6 weeks per Brain does not sustain 10-module completeness. The correction: **ship 6 modules for V1, defer 4 modules to V2.**

This ADR locks:
1. The 10-module schema (superset)
2. Which 6 modules are V1-required
3. Which 4 modules are V2-deferred
4. The JSON pack file format
5. Author authority and correction chain

## Decision

### 1 · The 10-module Trade Brain schema

Every Trade Brain declares these 10 modules (some may be empty at V1):

| Module | Purpose | V1 required? |
|--------|---------|--------------|
| **craft** | Core techniques · sequence · terminology | Yes |
| **regulations** | Region-scoped official cites | Yes |
| **materials** | Species · grades · pack sizes · defect risk per SKU | Yes |
| **workflow** | Standard sequence for common jobs | Yes |
| **defects** | Common faults · causes · fixes | Yes |
| **pricing_model** | Trade-specific unit rates + regional multipliers | Yes |
| **tools + PPE** | Kit list per scope · safety kit | Deferred to V2 |
| **business_tone** | How a master tradesperson from that trade speaks | Deferred to V2 |
| **sub_specialisations** | Domestic / commercial / industrial / heritage etc. | Deferred to V2 |
| **regional_variants** | Local vocabulary · local suppliers · climate rules | Deferred to V2 |

**V1 = 6 modules · V2 = full 10 modules.**

Rationale for the split: V1 modules deliver correct trade answers for common merchant questions. V2 modules deepen with regional variance, tone, and specialisation depth that matters at scale but not at MVP.

### 2 · JSON pack file format

Every Brain lives at `src/lib/nex/brains/<trade_slug>/`:

```
brains/
  electrician/
    manifest.json           # Brain metadata + author + version
    craft.json              # Module: craft
    regulations.<country>.json  # Module: regulations, per-country fanout
    materials.json          # Module: materials
    workflow.json           # Module: workflow
    defects.json            # Module: defects
    pricing_model.json      # Module: pricing_model
    tools.json              # V2 module (may be absent at V1)
    business_tone.json      # V2 module (may be absent at V1)
    sub_specialisations.json # V2 module (may be absent at V1)
    regional_variants.json  # V2 module (may be absent at V1)
```

Every JSON file validates against a Zod schema at build time. Missing V1 module = boot audit failure. Missing V2 module at V1 = warning, not failure.

### 3 · Schema fields per module

Standardised across all Brains:

- Every module has `version`, `authored_by`, `authored_at`, `last_reviewed_at`
- Every fact has `evidence` (source citation) + `confidence` (low/medium/high)
- Every rule has `applies_when` (predicate) + `then` (recommendation) + `escalate_if` (safety escape)
- Every playbook has `steps` (ordered) + `checkpoints` (verifiable stages)

Concrete Zod schemas will live at `src/lib/nex/brains/_schema/<module>.ts`, generated from this ADR.

### 4 · Author authority

- Each Brain has ONE named human author (a contracted master tradesperson)
- Author holds authoritative editorial control over content
- Corrections proposed by merchants flow to author for review · author accepts, rejects, or defers
- Author is credited in every merchant-facing Brain surface: "Electrician Brain · authored by [Name], [Certifications] · reviewed [date]"

### 5 · Correction chain (per Phase 26 memory pattern)

- Merchant corrections don't overwrite Brain content
- Corrections append to `hammerex_nex_brain_corrections` (new table)
- Author reviews corrections weekly
- Author-accepted corrections cause a Brain version bump (V0.1 → V0.2 etc.)
- Rejected corrections retained with rationale for audit

### 6 · Version + rollback

- Semantic versioning per Brain: major.minor.patch
- Every merchant sees the current stable version
- Rollback is a config change · previous version JSON packs preserved in `src/lib/nex/brains/<slug>/archive/<version>/`
- Merchant advisory panel validates each new version before rollout

### 7 · Author recruitment framework

- Contracted, not employed · honorarium per Brain authored + retainer for maintenance
- Minimum qualifications: ≥15 years trade experience · verified certification · regional expertise
- Time commitment: ~120 hours per Brain V1 (6 modules) · ~200 hours per Brain V2 (all 10)
- IP: work-for-hire · Nex owns the pack · author retains credit + right to attribute in their CV

### 8 · Field Learning Loop · Living Intelligence Requirement

Every Brain is a **living system**, not a static encyclopedia. The correction chain in §5 handles merchant-flagged errors. This section codifies the broader learning loop that ensures Brains improve from real-world outcomes over time.

**Every Brain must support all 6 loop mechanisms:**

1. **Initial expert-authored knowledge** — per §1-§4 · the baseline the Author writes
2. **Verified merchant corrections** — per §5 · Author reviews weekly · accepted corrections version-bump the Brain
3. **Field outcome feedback** — every merchant project completion feeds outcome data back to the Brain (durations · costs · defect rates · customer satisfaction)
4. **Prediction vs actual comparison** — Estimator/Vision/workflow predictions logged with actuals · deltas tracked per Brain × merchant × region
5. **Confidence updates** — Brain-level confidence scores adjust based on prediction accuracy over rolling windows (a Brain whose staircase estimates run consistently 15% over gets its confidence tier adjusted for that subject)
6. **Version history** — every learning-loop-driven change tracked in `hammerex_nex_brain_versions` with rationale ("estimator delta trend > 12% over 90 days → labour hours adjusted") · Author sees + approves

**Data flow:**

```
Brain V0.1 (Author-authored)
    ↓
Merchant uses Brain → Estimator produces prediction ("3 days installation")
    ↓
Project completes → Actual outcome recorded via Phase 29 Twin ("4 days · uneven existing structure")
    ↓
Delta captured in hammerex_nex_brain_field_outcomes (new table implied)
    ↓
Weekly rollup: aggregated deltas per Brain × subject × region
    ↓
K-anonymity gate applied (per ADR-0016 tiered thresholds)
    ↓
Author reviews outcome patterns quarterly
    ↓
Author-approved changes → Brain V0.2 (learning-loop version bump)
    ↓
Merchants see improved predictions on next similar project
```

**What this ISN'T:**

- **Not** automatic content generation (Author must review + approve all learning-loop-driven changes)
- **Not** merchant-visible AI drift (changes are versioned, rollback-safe)
- **Not** cross-tenant PII leakage (K-anonymity gate enforced at aggregation)
- **Not** a substitute for Author expertise (Author remains authoritative source of truth)

**What this IS:**

- The mechanism by which a Brain becomes measurably more accurate over time
- The evidence trail proving Nex is a learning system, not a wrapper over documents
- The commercial moat: merchant density × time compounds into intelligence density
- The reason the specialist-brains thesis actually holds up in year 3 vs year 1

**Every Brain author's contract includes:**

- Quarterly review of field outcome patterns for their Brain (paid via retainer)
- Right to reject learning-loop-proposed changes with rationale
- Right to propose their own changes based on their observation of the field data
- Attribution preserved on original content · learning-loop-driven changes attributed as "field-informed update reviewed by [Author]"

**Implementation dependency:** requires Phase 29 Twin V0 (project completion outcomes captured) + Phase 26 Memory V1 (K-anonymised aggregation) + `hammerex_nex_brain_field_outcomes` table (to be added to migration `brain_content_v0.sql` before ADR acceptance).

**Rationale for adding this as ADR-level requirement (not implementation detail):**

Without codifying the Learning Loop as a Brain requirement, Brains ship, work well on day one, then quietly degrade as construction reality shifts (new regulations · price changes · technique evolution · regional variance emerging). Building the loop mechanism after the fact means retrofitting Brains that weren't designed for it. Codifying it upfront ensures every Brain author knows their content will be measured against outcomes, and the data pipeline is built alongside the initial content.

## Consequences

**Positive:**
- Contract locked before authoring begins · no schema migrations during author work
- 6-module V1 achievable in author capacity · 4-Brain V1 rollout realistic in Y1
- Named authors build trust with merchants · trade-body credibility earned
- Correction chain lets merchants influence Brain content without silent overwrites
- Rollback pathway protects against bad content updates

**Negative:**
- 4 modules deferred to V2 means V1 Brains have known depth gaps (tools inventory absent, tone thin, regional variance limited to what regulations module carries)
- Author recruitment is the biggest hidden bottleneck · Y1 revenue depends on it
- Correction review adds ongoing author workload (paid via retainer)
- IP is work-for-hire · some authors may prefer royalty model · Nex must be honest that royalty is Y3+ once cross-tenant data quality supports it

**Neutral:**
- V2 module additions per Brain do not require schema migration · additive fields only

## Alternatives Considered

- **10-module V1 completeness** (original blueprint) · rejected · unrealistic author capacity per ES-01 correction
- **3-module V1 minimum (craft + regulations + pricing)** · rejected · too thin · merchants would perceive Brains as shallow
- **YAML instead of JSON** · rejected · JSON parser is universal, Zod validation cleaner, tooling superior
- **Database-stored Brain content instead of file-based** · rejected for V1 · file-based enables git version control + PR review · reconsider at V3+ when authoring frequency justifies DB
- **Community-authored Brains (open source)** · rejected · quality control impossible without Nex editorial · revisit in Y3+ as published-playbook marketplace (Phase 27 blueprint §11.3)
- **Model fine-tuning per trade instead of structured packs** · rejected for V1 · deterministic structured content is auditable + correctable · fine-tuning becomes viable at Memory V3+ when calibrated data supports it (per ES-10 §6.3)
- **Royalty model for authors** · rejected for V1 · revenue not yet reliable · revisit at Y3 with proven merchant density

## Implementation Impact

- `src/lib/nex/brains/` new module (currently empty)
- `src/lib/nex/brains/_schema/` Zod schemas per module
- `src/lib/nex/brains/_loader.ts` Brain runtime loader with hot reload in dev
- Boot audit extends existing Phase 24 audit to check every Brain's JSON packs against schema
- Phase 24 `orch/catalog.ts` migrated: existing 30 specialist agents replaced with Brain-loading agents
- `hammerex_nex_brain_corrections` new table
- `hammerex_nex_brain_versions` new table
- CI validates every new PR touching `brains/` against schema before merge

## Dependencies

- **Blocks:** All Phase 27 authoring · Phase 28 Estimator V0 · Phase 31 Business Builder V2 · Phase 32 Workforce V0 Trade Expert agents · Phase 29 Twin V0 anomaly detection
- **Blocked by:** Trade Brain author recruitment (Phase 0 Week 1-4)
- **Related ADRs:** ADR-0016 (Memory Privacy · Brain corrections write to memory)

## Enforcement

- Boot audit refuses to start if any Brain has invalid JSON pack (fail-fast)
- CI blocks PR to `brains/` folder if schema validation fails
- Author-editorial changes require author signoff in PR
- Merchant advisory panel validates every V1 Brain before Commercial GA

## Sign-off Required

- [ ] CTO
- [ ] Product Lead
- [ ] Trade Brain Author Program Lead (owner of author recruitment)
- [ ] First V0 Author (Electrician) as content authority signatory
