# ADR Review Artifact · ADR-0016 through ADR-0021

**Signoff-review confirmation · 2026-07-23**
**Purpose:** ready-to-review summary confirming each ADR meets the 5-field standard (decision clarity · technical consequences · security impact · product impact · implementation dependencies) BEFORE signoff meetings.

**Not a re-draft.** The ADRs themselves live at `docs/DECISIONS/0016-0021_*.md` and are the authoritative documents.

---

## ADR-0016 · Memory Privacy Architecture

**Decision clarity:** ✅ CLEAR
Tiered K-anonymity (K≥5 non-pricing · K≥10 pricing · K≥20 margin · PII never crosses). Sensitivity map deterministic from subject prefix. Consent-first opt-in per category. Regional granularity capped at ONS-region / state / province.

**Technical consequences:** ✅ FULLY SPECIFIED
- 4 new tables (`hammerex_nex_memory_trade` · `_region` · `_optout` · `_transparency_log`)
- Rollup cron algorithm specified in Memory V1 Technical Design §4
- Reader interface returns 3 explicit states (ok · insufficient_data · tier_locked)
- Cache strategy: 5-min Redis TTL with rollup-write invalidation

**Security impact:** ✅ ADDRESSED
- Cross-jurisdiction handling (UK DPA · UK GDPR · EU GDPR · AU Privacy Act · US state Y3+)
- Application-layer PII encryption on sensitive columns
- Data portability + RTBF workflows integrated
- Every consent recorded with version + timestamp + IP address
- ES-04 §8 provides workflow implementation

**Product impact:** ✅ SURFACED
- Cross-tenant reads require Professional+ tier
- Low-density regions surface honest "not enough peers yet" state (per Validation Report C-7)
- Memory correction UX inline (per Memory V2 spec)
- Contribution rate may be 30-50% initially · not 100%

**Implementation dependencies:**
- Blocks: Memory V1 · Phase 30 Market Intelligence · Memory V2 Dashboard
- Blocked by: Legal Counsel review (in flight Week 2-3)
- Related: ADR-0017 · ADR-0021

**Signoff readiness: READY** · Legal Counsel review is the only remaining gate.

---

## ADR-0017 · Trade Brain Contract

**Decision clarity:** ✅ CLEAR
10-module Brain schema · 6 required at V1 · 4 deferred to V2. JSON pack file format under `src/lib/nex/brains/<slug>/`. Named human author. Semver + rollback. Correction chain via `hammerex_nex_brain_corrections`.

**Technical consequences:** ✅ FULLY SPECIFIED
- File structure: `manifest.json` + `craft.json` + `regulations.<country>.json` + `materials.json` + `workflow.json` + `defects.json` + `pricing_model.json`
- Zod schemas at `src/lib/nex/brains/_schema/<module>.ts`
- Runtime loader with hot reload in dev
- Boot audit extends Phase 24 registry audit
- Trade Brain Author Tooling stores in structured tables, exports to JSON packs weekly via automated PR

**Security impact:** ✅ ADDRESSED
- Author-scoped RLS (Authors edit only their Brains)
- Merchants read Brain content · never edit directly
- Corrections require Author review before affecting content
- Version rollback preserves audit trail

**Product impact:** ✅ SURFACED
- 4-Brain V1 rollout realistic in Y1 (Electrician · Plumber · Roofer · Carpenter)
- Named authors build trust with merchants
- 4 modules deferred = known V1 depth gap (tools · tone · sub-specs · regional variants)
- Correction workflow paid via quarterly retainer

**Implementation dependencies:**
- Blocks: All Phase 27 authoring · Phase 28 Estimator V0 · Phase 31 Business Builder V2 · Phase 32 Workforce Trade Expert agents · Phase 29 Twin anomaly detection
- Blocked by: Trade Brain Author recruitment (in flight Week 2-4)
- Related: ADR-0016 (Brain corrections write to memory) · ADR-0021 (per-Brain domain separation)

**Signoff readiness: READY** · Author input on tooling requirements gathered Week 3 workshop.

---

## ADR-0018 · Twin Event Log Schema

**Decision clarity:** ✅ CLEAR
Append-only event log · partitioned by month · versioned Zod schemas per event kind. V0 ships 2 perspectives (Merchant + Homeowner). V0 ships WITHOUT BIM ingest. Weekly snapshot cache.

**Technical consequences:** ✅ FULLY SPECIFIED
- Complete SQL table spec in ADR §2
- Event schema versioning migration path (additive + breaking with 90d overlap)
- Approval-state enforcement at write path
- Partition-management cron via pg_cron

**Security impact:** ✅ ADDRESSED
- 12-year retention per UK construction contract law
- Cryptographically signed timestamps
- PII handling: photos with GPS stripped for customer-shared perspective
- GDPR RTBF cascade with 30-day appeal window + PII redaction in audit floor

**Product impact:** ✅ SURFACED
- 2 perspectives sufficient at V0 (Brain perspectives arrive V2)
- BIM deferral means enterprise merchants can't use Twin V0 for BIM workflows
- Homeowner-facing surface merchant-controlled visibility per event

**Implementation dependencies:**
- Blocks: Phase 29 Twin V0 · SiteBook V2 event integration
- Blocked by: Phase 27 Trade Brain V0 (perspective + anomaly detection needs Brain content)
- Related: ADR-0016 · ADR-0017 · ADR-0021

**Signoff readiness: READY** · Legal Counsel confirms 12-year retention + PII cascade Week 2.

---

## ADR-0019 · Workforce Trust Ladder

**Decision clarity:** ✅ CLEAR
4-level ladder (Observe · Draft · Prepare · Auto-Execute) + non-negotiable Level 5 Emergency Stop. Default Level 2 for every new agent. Level 4 opt-in per action class with hard caps.

**Technical consequences:** ✅ FULLY SPECIFIED
- 4 new tables (`hammerex_nex_workforce_agent_levels` · `_level_events` · `_pauses` · `_audit_log`)
- Runtime enforcement: every agent action checks level before executing
- Emergency Stop 2-second SLA via feature flag + agent worker polling
- Auto-downgrade triggers on approval-rate breach

**Security impact:** ✅ ADDRESSED
- Level 4 whitelist strictly limited to non-external-facing action classes
- Every autonomous execution audit-logged (not just anomalies)
- Emergency Stop non-negotiable safety guarantee
- Auto-downgrade prevents drift

**Product impact:** ✅ SURFACED
- 4 levels distinguishable by non-technical merchants (per ES-01 correction from 7)
- Approval fatigue at Level 2 addressed by weekly digest (Validation Report C-5)
- Some "obviously safe" automations require Level 3 approval even at scale

**Implementation dependencies:**
- Blocks: Phase 32 Workforce V0 · Phase 33 Workforce Economy V0
- Blocked by: ADR-0016 (audit log retention) · legal review of autonomous action liability
- Related: ADR-0017 · ADR-0020

**Signoff readiness: READY** · Legal Counsel confirms liability apportionment Week 2-3.

---

## ADR-0020 · Workforce Economy Honesty Framework

**Decision clarity:** ✅ CLEAR
AI always disclosed as AI. Zero fabrication enforced at schema level. Verification badges earned not granted. Warm-professional voice · never fake emotion. Approval-required for every external send.

**Technical consequences:** ✅ FULLY SPECIFIED
- Schema constraints on customer_reviews · merchant_credentials · portfolio_images tables reject writes without source_reference
- Verification cron per credential type (daily refresh)
- AI-generated image detector integrated into upload pipeline
- Content safety filter on every outward-facing AI draft

**Security impact:** ✅ ADDRESSED
- Terms of Use draft included in Legal Counsel deliverables Week 2
- Liability apportionment clear (Nex platform bugs vs merchant approval decisions)
- AI-generated content legal framing per jurisdiction
- Marketing regulator considerations (ASA · FTC · ACCC)

**Product impact:** ✅ SURFACED
- Category-shift framing (hire AI colleague) survives regulatory scrutiny
- Some competitive marketing tactics (fake urgency · generated testimonials) forbidden
- Verification cron adds ongoing ops cost per merchant

**Implementation dependencies:**
- Blocks: Phase 31 Business Builder V2 · Phase 33 Workforce Economy V0 · Employment Centre hire flow
- Blocked by: Legal Counsel Terms of Use draft + review · Public register verification adapter development
- Related: ADR-0019 · ADR-0016

**Signoff readiness: READY** · Terms of Use draft is critical dependency · targeting Week 2-3.

---

## ADR-0021 · Intelligence Domain Separation

**Decision clarity:** ✅ CLEAR
5 domain categories (Trade Brains · Business Brains · Memory Layers · Regulatory Knowledge · Product Knowledge) × 5 separation levels (namespace · schema · storage · retrieval · ownership). Cross-domain retrieval requires explicit multi-domain array · no wildcards.

**Technical consequences:** ✅ FULLY SPECIFIED
- Supabase Storage bucket structure defined (`trade-brains/<slug>/{images,drawings,regulations,examples,training}/` etc.)
- Retrieval API contracts defined (`retrieveFromBrain` · `retrieveFromBrains` · `retrieveRegulation`)
- Forbidden: `retrieveFromAll()` · `retrieveFromEverything()`
- CI enforcement via ESLint rule + retrieval function contract

**Security impact:** ✅ ADDRESSED
- Domain isolation limits blast radius of any single Brain compromise
- Storage access control scoped per domain
- Cross-domain queries in production logs weekly audited
- Admin diagnostic tools use narrow exception (audit-logged)

**Product impact:** ✅ SURFACED
- Nex retains "specialist expert brains" positioning · doesn't devolve into "chatbot with documents"
- LLM cost per query bounded predictably
- Legitimate compound queries require explicit routing
- Cannot ship "unified search" feature merchants might request

**Implementation dependencies:**
- Blocks: any implementation of unified search feature · any implicit cross-domain retrieval
- Blocked by: none (this ADR is independent)
- Related: ADR-0016 (per-layer memory separation extends to platform-wide) · ADR-0017 (per-Brain file separation extends to storage + retrieval) · Phase 24 mesh (routing pattern already implements the principle)

**Signoff readiness: READY** · No blocking dependencies.

---

## Signoff Meeting Schedule (Week 3)

| Day | ADR | Signatories present | Duration |
|-----|-----|--------------------|----------|
| Monday AM | ADR-0016 · Memory Privacy | CTO · Legal · Product · DPO | 45 min |
| Monday PM | ADR-0021 · Domain Separation | CTO · Product · Backend · Trade Brain Program Lead | 45 min |
| Tuesday AM | ADR-0017 · Trade Brain Contract | CTO · Product · Trade Brain Program Lead · Electrician Author | 45 min |
| Tuesday PM | ADR-0018 · Twin Event Log | CTO · Backend · Product · Legal | 45 min |
| Wednesday AM | ADR-0019 · Workforce Trust Ladder | CTO · Product · Legal · AI Safety Lead | 45 min |
| Wednesday PM | ADR-0020 · Honesty Framework | CTO · Product · Legal · Compliance | 45 min |
| Thursday | Amendments cycle if needed | Owner per ADR | as needed |
| Friday | Final signoff · INDEX status Draft → Accepted | CTO signs formally | 30 min |

**Target: all 6 ADRs at Accepted status by Friday end of Week 3.**

Slippage risk: any ADR requiring substantive redraft moves to Week 4. ADR-0021 is lowest-risk (independent, tightly scoped). ADR-0016 + 0020 highest-risk (Legal Counsel dependency).

---

## Post-Acceptance Immediate Actions

Upon Friday acceptance:

1. `docs/DECISIONS/INDEX.md` updates status Draft → Accepted for all 6
2. `MEMORY.md` pointers updated
3. CI enforcement rules activated (schema-level constraints per ADR-0020 · RLS templates per ADR-0016 · retrieval scope enforcement per ADR-0021)
4. Trade Brain Author contracts include ADR-0017 as authoritative reference
5. Migration schemas prepared in `docs/implementation/pending-migrations/` promoted to `supabase/migrations/`
6. Foundation implementation work (RBAC · GDPR · Model Outage) unblocks

---

**End of ADR Review Artifact.**
