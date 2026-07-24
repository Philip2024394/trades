# ADR Signoff Package · ADR-0016 through ADR-0021

**Review + signoff artifact · 2026-07-23 (amended 2026-07-23)**
**Purpose:** structured review process for ratifying the 6 blocking ADRs drafted Phase 0 Week 1-2.

**Objective:** all 6 ADRs move to **Status: Accepted** by end of Phase 0 Week 3.

**2026-07-23 amendments to this package:**
- ADR-0021 (Intelligence Domain Separation) added — drafted Phase 0 Week 2 · was not in original scope of this package
- ADR-0017 §8 Field Learning Loop amendment added post-substrate-ship — review checklist below extended to cover the amendment
- Companion doc `ADR_REVIEW_ARTIFACT_0016_0021.md` published as the ready-to-review summary · this package remains the process document

---

## The 6 ADRs

| ADR | Title | Signatories | Status | Amendment note |
|-----|-------|-------------|--------|----------------|
| ADR-0016 | Memory Privacy Architecture | CTO · Legal Counsel · Product Lead · DPO (if appointed) | Draft | — |
| ADR-0017 | Trade Brain Contract | CTO · Product Lead · Trade Brain Program Lead · First V0 Author | Draft | **§8 Field Learning Loop added 2026-07-23** — reviewers must acknowledge amendment |
| ADR-0018 | Twin Event Log Schema | CTO · Backend Lead · Product Lead · Legal Counsel | Draft | — |
| ADR-0019 | Workforce Trust Ladder | CTO · Product Lead · Legal Counsel · AI Safety Lead (if appointed) | Draft | — |
| ADR-0020 | Workforce Economy Honesty Framework | CTO · Product Lead · Legal Counsel · Compliance Lead | Draft | — |
| ADR-0021 | Intelligence Domain Separation | CTO · Product Lead · Trade Brain Program Lead · Backend Lead | Draft | Added Phase 0 Week 2 |

---

## Signoff process per ADR

### Stage 1 · Review preparation (Week 2 Day 1-2)

Signatories receive:
- Full ADR document
- Relevant context (Master Architecture · prior blueprint sections · Validation Report findings)
- 30-60 minute reading time expected per ADR

### Stage 2 · Review meeting (Week 2 Day 3-4)

Per ADR, 45-minute meeting:
- **10 min** — presenter walks the Decision + Context (typically CTO or Product Lead)
- **20 min** — questions + discussion
- **10 min** — proposed amendments captured
- **5 min** — signoff decision (Accept · Accept-with-amendments · Reject-and-redraft)

### Stage 3 · Amendment cycle (Week 2 Day 4-5 if needed)

If Accept-with-amendments:
- Amendments incorporated into ADR draft
- Circulated to signatories
- 24-hour async acknowledgement window
- Re-signoff via email confirmation

If Reject-and-redraft:
- Feedback captured
- New draft within 1 week
- New review meeting scheduled

### Stage 4 · Acceptance (Week 2 Day 5)

Upon full signoff:
- ADR status updated from Draft → Accepted
- `docs/DECISIONS/INDEX.md` updated
- MEMORY.md pointer updated
- Team notification

---

## Review checklist per ADR

Every reviewer completes before signoff meeting:

### Understanding
- [ ] I have read the full ADR
- [ ] I understand the Context (why this decision is needed)
- [ ] I understand the Decision (what we're committing to)
- [ ] I understand the Consequences (positive + negative + neutral)
- [ ] I understand the Alternatives Considered (why we rejected them)

### Correctness
- [ ] The Decision is technically sound within my area of expertise
- [ ] The Decision aligns with prior ADRs (no contradictions)
- [ ] The Decision aligns with Master Architecture v1.0
- [ ] The Alternatives Considered section is complete and honest
- [ ] The Consequences section is honest (both positive and negative acknowledged)

### Enforcement
- [ ] The Enforcement mechanisms are practical
- [ ] The Enforcement mechanisms are automatable where sensible
- [ ] Breaking this ADR would be detectable

### Dependencies
- [ ] Dependencies on other ADRs are correctly identified
- [ ] Dependencies on external work (Legal · Authors · etc.) are correctly identified
- [ ] I know what my area of responsibility becomes after signoff

### Risks
- [ ] Risks named in the ADR are complete (I cannot think of significant additional risks)
- [ ] Mitigations for named risks are practical

---

## Per-ADR reviewer focus areas

### ADR-0016 · Memory Privacy Architecture

**CTO focus:**
- Tiered K-anonymity implementation feasibility
- Cross-tenant query performance under K thresholds
- Enforcement at reader layer (belt-and-braces with RLS)

**Legal Counsel focus:**
- GDPR compliance (UK · EU · IE)
- Data portability workflow adequacy
- Right-to-be-forgotten cascade thoroughness
- Consent framework legality
- Cross-jurisdiction handling (Australia · US future)

**Product Lead focus:**
- "Not enough peers yet" UX viability in low-density regions
- Merchant transparency dashboard clarity
- Opt-in framing (does it feel like a gift or a request?)

**DPO focus (if appointed):**
- Sensitivity tiering completeness
- Audit trail sufficiency
- Breach notification pathway

**Key questions this ADR must answer at signoff:**
- Can K=10 pricing threshold sustain regional relevance at Y1 merchant density?
- Is cross-jurisdiction handling framed correctly for Y2 IE + AU launches?
- What happens if consent framework changes mid-Y1?

### ADR-0017 · Trade Brain Contract

**CTO focus:**
- JSON schema evolution pathway (V1 → V2 additive)
- Runtime loader boot audit robustness
- Version rollback mechanics

**Product Lead focus:**
- 6-module V1 delivers merchant-perceptible value?
- Deferred 4 modules feel like a gap or acceptable trade-off?
- Author correction workflow burden

**Trade Brain Program Lead focus (Product Lead if not yet appointed):**
- Author recruitment feasibility at £8k-£15k V1 honorarium band
- Editorial control clarity
- Attribution rights adequate incentive

**First V0 Author focus:**
- 6-module scope achievable in 6-8 weeks per Brain
- Editing tool requirements sufficient
- Correction chain workload sustainable at quarterly retainer

**Key questions this ADR must answer at signoff:**
- Is the honorarium band competitive for the target Author profile?
- Does 6-module V1 pass merchant advisory panel authenticity threshold?
- Can we author 4 Brains in parallel by Week 12?

### ADR-0018 · Twin Event Log Schema

**CTO focus:**
- Partitioning strategy under 100M+ events per year
- Snapshot cache invalidation correctness
- Time-travel query performance

**Backend Lead focus:**
- Event schema versioning migration path
- Approval-state enforcement at write path
- Cross-partition queries acceptable performance

**Product Lead focus:**
- 2 perspectives (Merchant + Homeowner) sufficient at V0
- BIM deferral impact on enterprise pipeline
- Handover pack completeness with V0 event set

**Legal Counsel focus:**
- 12-year retention alignment with UK construction contract law
- Legally admissible timestamp mechanism
- PII handling in event payloads (photos with GPS · customer signatures)

**Key questions this ADR must answer at signoff:**
- Can partition rollover be zero-downtime?
- Will homeowner perspective + merchant perspective satisfy Y1 use cases?
- What's the migration story if we need to add a Brain perspective at V2?

### ADR-0019 · Workforce Trust Ladder

**CTO focus:**
- Level-check enforcement at agent runtime (cannot bypass)
- Emergency Stop 2-second SLA implementable
- Downgrade trigger accuracy (avoid false-positive downgrades)

**Product Lead focus:**
- 4-level ladder distinguishable by merchants (per merchant advisory panel review)
- Level 4 opt-in flow not too friction-heavy for legitimate uses
- Vacation mode integration

**Legal Counsel focus:**
- Liability apportionment (Nex vs merchant vs autonomous action)
- Terms of Use language covering autonomous action
- Emergency Stop as safety valve legally sufficient

**AI Safety Lead focus (if appointed):**
- Adversarial evaluation of agent action classes
- Cross-tenant harm prevention
- Confidence calibration for level graduation

**Key questions this ADR must answer at signoff:**
- What's the fallback if Emergency Stop fails to halt within 2 seconds?
- How do we prevent an agent from silently drifting toward Level 4-worthy behaviours at Level 3?
- Is 100 approved events threshold for Level 4 eligibility correct?

### ADR-0020 · Workforce Economy Honesty Framework

**CTO focus:**
- Schema-level enforcement of anti-fabrication rules (reviews · credentials · portfolio · statistics)
- Verification cron sustainability at merchant scale
- Content safety filter false-positive rate

**Product Lead focus:**
- Warm-language + honesty compatibility feels natural
- Verification badge earning feels achievable
- Merchant response to "not verified yet" language

**Legal Counsel focus (essential):**
- Terms of Use disclaim of personhood + legal capacity
- Liability framework (Nex platform bugs vs merchant approval decisions)
- AI-generated content legal framing per jurisdiction
- Marketing regulator considerations (ASA · FTC · ACCC)

**Compliance Lead focus (Product Lead if not appointed):**
- Merchant onboarding disclosure adequacy
- Ongoing merchant reminder mechanisms
- Regulator response capability

**Key questions this ADR must answer at signoff:**
- Is the schema-level enforcement mechanism watertight against future feature pressure?
- Does the "verified badge" language pass legal review across UK · IE · AU?
- What's the response if a regulator questions our AI-employment framing?

---

## Post-signoff obligations

Upon acceptance of each ADR, signatories commit to:

1. **Champion the decision** — no relitigation without new evidence
2. **Enforce in their domain** — CTO in engineering · Product in feature spec · Legal in contract review
3. **Escalate violations** — bring them to Change Control Board
4. **Sunset review after 12 months** — is the decision still correct?

---

## Change control

Once Accepted:

- Modifications require a **superseding ADR** (never edit an Accepted ADR)
- Superseding ADR references the original + explains why the change is warranted
- Original marked "Superseded by ADR-NNNN" in INDEX
- Two signatories minimum for supersession approval

---

## Timeline (revised 2026-07-23)

- **Week 2 Day 1-2**: signatories receive ADRs 0016-0020 · read
- **Week 2 Day 3-4**: review meetings (one per ADR · 45 min each)
- **Week 3 (per `ADR_REVIEW_ARTIFACT_0016_0021.md` schedule)**: ADR-0021 added · 0017 §8 amendment reviewed · combined signoff meetings
- **Week 3 Friday**: all 6 ADRs Accepted · INDEX updated · Team notified

**Target: all 6 ADRs at Accepted status by end of Week 3 · Friday sign-off.**

Slippage risk: if any ADR requires substantive redraft, that ADR moves to Week 4 review · but no ADR blocks the others (they are logically independent). ADR-0021 is lowest-risk (independent · tightly scoped). ADR-0016 + 0020 highest-risk (Legal Counsel dependency).

---

## ADR-0017 §8 Field Learning Loop · amendment-specific review

The §8 amendment (added 2026-07-23 after Phase 0 substrate ship) MUST be reviewed as part of the ADR-0017 signoff meeting. Reviewers acknowledge:

- The 6 required loop mechanisms (Author-authored baseline · verified corrections · field outcome capture · prediction-vs-actual delta tracking · confidence updates · version history)
- The data flow: Brain prediction → Twin outcome → K-anonymised rollup → Author quarterly review → learning-loop version bump
- Author contract additions: quarterly review of field outcome patterns (paid via retainer) · right to reject/propose changes · attribution preserved
- Implementation dependency: Phase 29 Twin V0 + Phase 26 Memory V1 + `hammerex_nex_brain_field_outcomes` + `hammerex_nex_brain_learning_signals` tables (in pending migration `brain_content_v0.sql`)
- Confirmation that runtime substrate shipped 2026-07-23 is compatible with §8 · no rework required on §8 acceptance

**Amendment-specific signoff checkbox:**
- [ ] I acknowledge the §8 amendment and agree it is a natural extension of §5 (corrections chain), not a new scope

---

## ADR-0021 Intelligence Domain Separation · signoff-specific extension

ADR-0021 was added Phase 0 Week 2 after this package was originally drafted. Signoff process is identical to ADRs 0016-0020, with these signatory-specific checkpoints:

**CTO** — confirms retrieval API contracts (`retrieveFromBrain`, `retrieveFromBrains`) are the only sanctioned pattern · no `retrieveFromAll` · CI enforcement acceptable.

**Product Lead** — confirms the domain-separation UX (empty results honest · no silent expansion · explicit `brain_slugs`) is acceptable for merchant surfaces.

**Trade Brain Program Lead** — confirms per-Brain storage prefix + per-Brain retrieval isolation is workable for Author onboarding + tooling.

**Backend Lead** — confirms 5 separation levels (namespace · schema · storage · retrieval · ownership) are enforceable across Postgres + Supabase Storage + pgvector + Redis.

**ADR-0021 signoff checkbox (all 4):**
- [ ] The 5 domain categories × 5 separation levels are enforceable in the current stack
- [ ] The narrow admin exception is acceptable with weekly cross-domain-query audit
- [ ] Migration path for existing `hammerex_nex_knowledge_entries` is acceptable

---

## Post-acceptance immediate actions

Once ADRs Accepted:

1. Update `docs/DECISIONS/INDEX.md` status Draft → Accepted for all 6
2. Update MEMORY.md pointer entry
3. CI enforcement rules activated (schema-level constraints per ADR-0020 · RLS templates per ADR-0016 · retrieval scope enforcement per ADR-0021 · confidence math wired to `/api/brain/[slug]/confidence` endpoint per ADR-0017 §8)
4. Trade Brain Author contracts include ADR-0017 (incl. §8) + ADR-0021 as authoritative references
5. Workforce V0 code work begins referencing ADR-0019 as constraint
6. Memory V1 implementation proceeds referencing ADR-0016 as constraint
7. Nex Brain Runtime Substrate feature flag `NEX_BRAIN_RUNTIME_ENABLED` remains OFF until Author-authored Staircase Brain content lands + advisory panel signs off (per `PHASE_0_UNLOCK_CONDITIONS_V1.md`)
8. Pending migrations under `docs/implementation/pending-migrations/` promoted to `supabase/migrations/` per `MIGRATION_APPROVAL_PACKAGE.md`

---

**End of ADR Signoff Package · ADR-0016 through ADR-0021 (amended 2026-07-23).**
