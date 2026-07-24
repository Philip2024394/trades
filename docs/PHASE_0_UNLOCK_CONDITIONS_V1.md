# Phase 0 Unlock Conditions · V1

**Master gate checklist · 2026-07-23**
**Purpose:** the single page a CTO or CEO reads to see every gate that must close before `NEX_BRAIN_RUNTIME_ENABLED=1` in production. When every box below is ticked, the DARK substrate goes live.

**Working principle:** the Nex Brain runtime substrate shipped 2026-07-23 is complete engineering-side. The remaining work is governance, contract, content, and legal. This document tracks it.

---

## What is being unlocked

Flipping `NEX_BRAIN_RUNTIME_ENABLED=1` activates:

- 6 endpoints under `/api/brain/*` start returning 200s instead of 503s
- Phase 24 catalog `withBrain()` wrappers begin routing specialist agents through the Brain loader
- `hammerex_nex_brain_field_outcomes` starts collecting real prediction-vs-actual rows via `/api/brain/learn`
- Confidence tiers computed on real learning-signal data (was previously Author-base only)
- First V1 Brain becomes reachable to merchants on Professional+ tier

Turning the flag on with any gate below open would either serve empty content (bad UX), violate Author authority (breaks ADR-0017 §4), or expose an unratified data model to production (breaks Phase 0 discipline).

---

## Gate 1 · ADRs Accepted (from Draft → Accepted)

| ADR | Owner | Status | Package |
|-----|-------|--------|---------|
| ADR-0016 Memory Privacy Architecture | CTO + Legal Counsel | ☐ Draft | `ADR_SIGNOFF_PACKAGE_0016_0020.md` + `ADR_REVIEW_ARTIFACT_0016_0021.md` |
| ADR-0017 Trade Brain Contract (**incl. §8 Field Learning Loop amendment**) | CTO + Product Lead + Program Lead + First V0 Author | ☐ Draft | same |
| ADR-0018 Twin Event Log Schema | CTO + Backend Lead | ☐ Draft | same |
| ADR-0019 Workforce Trust Ladder | CTO + Legal Counsel | ☐ Draft | same |
| ADR-0020 Workforce Economy Honesty Framework | CTO + Legal + Compliance | ☐ Draft | same |
| ADR-0021 Intelligence Domain Separation | CTO + Product + Program + Backend | ☐ Draft | same |

**Notes:**
- ADR-0017 is the tightest gate for the substrate (the whole runtime references it).
- ADR-0021 is closest to code (the router already enforces it — signoff formalises what's shipped).
- ADR-0016 and ADR-0020 highest risk (Legal dependency).
- Signoff meeting schedule lives in `ADR_REVIEW_ARTIFACT_0016_0021.md` §Signoff Meeting Schedule.

**Gate 1 closed when:** all 6 ADRs at `Status: Accepted` in `docs/DECISIONS/INDEX.md`.

---

## Gate 2 · First Trade Brain Author under contract

| Item | Owner | Status |
|------|-------|--------|
| Author Recruitment Package published | Product Lead | ✅ 2026-07-23 |
| Author Contract Template V0 drafted | Product Lead | ✅ 2026-07-23 |
| Contract Template Legal Counsel review | Legal Counsel | ☐ |
| First Author candidate identified (Electrician per Priority #1) | Product Lead + Program Lead | ☐ |
| First Author interview stages complete (Stage 1-3 per Recruitment §6) | Program Lead | ☐ |
| First Author contract signed | Both parties | ☐ |
| Author onboarding (Week 1 per Recruitment §7) complete | Program Lead | ☐ |

**Gate 2 closed when:** at least one Trade Brain Author has a signed contract AND completed onboarding. Multiple Authors may proceed in parallel but only one is required to close this gate.

---

## Gate 3 · Merchant Advisory Panel formalised

| Item | Owner | Status |
|------|-------|--------|
| Advisory Panel Charter V1 drafted | Product Lead | ✅ 2026-07-23 |
| Charter ratified (CEO + CTO + Product + Legal signoff per Charter §Approval) | CEO | ☐ |
| Panel members recruited (5-9 members per Charter §2) | Product Lead | ☐ |
| Induction complete for all seated members (Charter §8) | Product Lead | ☐ |
| Panel Chair elected | Panel | ☐ |
| First Halfway Review meeting scheduled | Panel Chair + Product Lead | ☐ |

**Gate 3 closed when:** Panel is seated, inducted, and chaired. First meeting need not have occurred — it will occur naturally at Author V1 Week 8.

---

## Gate 4 · Pending migrations approved + applied to staging

| Migration | Package | Status |
|-----------|---------|--------|
| `rbac_v0.sql` | Approval Package §2.1 | ☐ Held |
| `gdpr_requests.sql` | Approval Package §2.2 | ☐ Held |
| `ai_provider_status.sql` | Approval Package §2.3 | ☐ Held |
| `brain_content_v0.sql` (incl. §8 tables) | Approval Package §2.4 | ☐ Held |
| `brain_vision_and_estimate_rules_v0.sql` | Approval Package §2.5 | ☐ Held |

**Package:** `docs/implementation/pending-migrations/APPROVAL_PACKAGE.md`

**Gate 4 closed when:** all 5 migrations have per-file signoffs complete (per Approval Package §2) AND are applied to staging (production apply is a separate authorised action per Approval Package §3).

---

## Gate 5 · First Brain content authored

| Content milestone | Owner | Status |
|-------------------|-------|--------|
| Author begins authoring V1 modules (Craft first per Author Contract §2) | Author | ☐ |
| M2 milestone (Craft + Regulations submitted) | Author | ☐ |
| Advisory Panel Halfway Review (per Charter §4 Meeting 1) | Panel | ☐ |
| M3-M4 milestones (Materials + Workflow + Defects + Pricing) | Author | ☐ |
| Author fills in `expected_answer` + `expected_confidence_tier` for the 100 scenarios in `src/lib/nex/brains/staircase/__tests__/scenarios/staircase_scenarios.json` — scenarios convert from structural to accuracy tests | Author | ☐ |
| Advisory Panel Signoff Review (per Charter §4 Meeting 2) | Panel | ☐ |
| Brain manifest status moves to `published` in registry | Product Lead | ☐ |

**Gate 5 closed when:** first Brain reaches `status = published`.

---

## Gate 6 · Brain Content Production Pipeline established

Architecture does not create knowledge. A repeatable operational process must exist before flag flip so Brain #2 can follow Brain #1 without reinventing the pipeline each time.

| Item | Owner | Status |
|------|-------|--------|
| Pipeline runbook drafted (`BRAIN_CONTENT_PRODUCTION_PIPELINE_V1.md`) | Product Lead | ✅ 2026-07-23 |
| AI-Structuring approach chosen (A · Author-drafts / B · AI-drafts / C · Interview mode) per Runbook §12 | CTO + Product + first Author | ☐ |
| Chosen approach captured in a small ADR (proposed ADR-0022 · Brain Content Capture Method) if it deviates from current Tooling Spec assumption | CTO | ☐ |
| First Author walks Steps 1-7 end-to-end · pipeline metrics captured in `BRAIN_PIPELINE_METRICS_BASELINE.md` | Program Lead | ☐ |
| Pipeline bottleneck review completed after first walkthrough (Panel meeting slots · Program Lead capacity · Tooling scale) | Program Lead | ☐ |

**Gate 6 closed when:** the pipeline has been walked once by a real Author for a real Brain end-to-end AND the baseline metrics exist to plan Brain #2. Prevents the "one bespoke Brain, then a scaling crisis" trap.

**Note on ordering:** Gate 6 runs largely in parallel with Gates 2 + 3 + 5 (the pipeline IS how Gates 2 + 3 + 5 execute in practice). It closes when Brain #1 has actually shipped through the pipeline, at which point the pipeline is proven.

---

## Gate 7 · Flag flip authorised

Every gate above closed AND:

| Condition | Owner | Status |
|-----------|-------|--------|
| Migration promotion PR applied to production (per Approval Package §3) | CTO | ☐ |
| Post-migration verification queries pass (row counts, RLS checks) | Backend Lead | ☐ |
| Staging environment has run for at least 7 days with flag ON and first Brain loaded | Backend Lead | ☐ |
| `docs/DB_SCHEMA.md` regenerated after migration apply | Backend Lead | ☐ |
| CTO signs formal flag-flip authorisation | CTO | ☐ |

**Gate 7 closed when:** CTO authorises setting `NEX_BRAIN_RUNTIME_ENABLED=1` in production environment.

At the moment Gate 7 closes and the environment variable is set, the substrate becomes the first working intelligence slice.

---

## Timeline (indicative · not a commitment)

Assuming ADR signoffs land Week 3 as scheduled in `ADR_REVIEW_ARTIFACT_0016_0021.md`:

- **Week 3** — Gate 1 closes (ADRs Accepted)
- **Week 3-4** — Gate 4 approvals begin (migrations applied to staging)
- **Week 3-4** — Gate 3 recruitment begins (Panel members identified)
- **Week 4-6** — Gate 2 Author interview + contract cycle
- **Week 6** — First Author onboards (Gate 2 closes for at least one Author)
- **Week 7-8** — Gate 3 closes (Panel seated + first Halfway Review meeting scheduled)
- **Week 8-20** — Gate 5 Author authoring V1
- **Week 15-16** — Gate 5 first Advisory Panel Signoff Review
- **Week 16** — Gate 5 closes for first Brain
- **Week 15-16** — Gate 6 pipeline runbook walked end-to-end + baseline metrics captured (in parallel with Gate 5 finish)
- **Week 17-18** — Gate 7 staging burn-in + verification
- **Week 18-20** — Gate 7 closes · flag flip authorised · production goes live

This is a **~4 month** path from Phase 0 Week 3 to first production Brain, gated primarily by Author authoring time (Week 8-20). Everything before that is preparation. Everything after that is verification.

If Author authoring runs on the shorter end (12 weeks per Author Contract §2), the whole timeline compresses by ~4 weeks.

---

## What this document is NOT

- Not a project plan — the actual delivery cadence lives in `NEX_IMPLEMENTATION_ROADMAP_V2.md`
- Not a status report — this is a gate checklist, not a percent-complete tracker
- Not something to reopen unless a gate is being ticked or a gate materially changes

**Update discipline:** the only meaningful edits to this file are (a) ticking checkboxes when a gate genuinely closes, or (b) adding a new gate if one is discovered.

---

## Cross-references (living index)

- ADR signoff process: `ADR_SIGNOFF_PACKAGE_0016_0020.md` + `ADR_REVIEW_ARTIFACT_0016_0021.md`
- Author recruitment: `TRADE_BRAIN_AUTHOR_RECRUITMENT_PACKAGE.md`
- Author tooling: `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md`
- Author contract template: `TRADE_BRAIN_AUTHOR_CONTRACT_TEMPLATE_V0.md`
- Advisory Panel charter: `MERCHANT_ADVISORY_PANEL_CHARTER_V1.md`
- Brain Content Production runbook: `BRAIN_CONTENT_PRODUCTION_PIPELINE_V1.md`
- Migration approval: `implementation/pending-migrations/APPROVAL_PACKAGE.md`
- Runtime substrate reference: `NEX_BRAIN_PLATFORM_AND_ENGINE_V1.md` Part 5
- Reference Brain implementation: `brains/staircase-brain-specification.md`
- Master architecture: `NEX_MASTER_ARCHITECTURE_V1.md`
- Implementation delivery cadence: `NEX_IMPLEMENTATION_ROADMAP_V2.md`

---

**End of Phase 0 Unlock Conditions V1.**
