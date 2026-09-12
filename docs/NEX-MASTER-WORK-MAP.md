# NEX Master Work & Architecture Map

**Version:** 1.0.0 · authored 2026-09-11 by Master AI · authorised by Philip
**Machine-readable source:** [`docs/nex-work-map.json`](./nex-work-map.json)
**HQ view:** `/nex-head-quarters/work-map`

---

## The rule

**Master AI MUST consult this map before beginning any audit, architecture exercise, implementation, migration, consolidation, or crawler work.**

**No new audit may be initiated when an existing audit already covers the area · unless this map identifies a specific unresolved question requiring a targeted re-audit.**

This map is the answer to *"have we done this before?"*

---

## Status legend

| Symbol | Status | Meaning |
|---|---|---|
| 🔵 | **DISCOVERED** | We know it exists. No design or implementation yet. |
| 🟡 | **AUDITED / DESIGNED** | Understood + architecture decision made (ADR exists). |
| 🟠 | **IMPLEMENTED** | Code/schema exists and passes tests. Not yet active in production. |
| 🟢 | **ACTIVE** | Operating in the NEX production system. |
| ⚫ | **DEFERRED** | Explicitly postponed. Reason recorded. |
| 🔴 | **BLOCKED** | Cannot proceed until a named dependency/decision exists. |

Progression: `DISCOVERED → AUDITED → IMPLEMENTED → ACTIVE` (`DEFERRED` / `BLOCKED` are lateral states)

---

## Capability index

| ID | Capability | Group | Status | UI URL |
|---|---|---|---:|---|
| CAP-001 | Nine Domains + 5-axis Architecture | Constitutional | 🟢 ACTIVE | — |
| CAP-002 | R-DOMAIN-01 Anti-Substitution | Constitutional | 🟢 ACTIVE | — |
| CAP-003 | R-10 Gate-Model + Promotion Doctrine | Constitutional | 🟡 AUDITED | — |
| CAP-004 | Feedback Memory Discipline | Constitutional | 🟢 ACTIVE | — |
| CAP-005 | Phase A/B/C/Stage 1b Sequencing | Constitutional | 🟢 ACTIVE | — |
| CAP-011 | Truth Engine Verifier | Truth Engine + Guardians | 🟢 ACTIVE | — |
| CAP-012 | Ten Rule Modules (R-01…R-20) | Truth Engine + Guardians | 🟢 ACTIVE | — |
| CAP-013 | TE-Guardian | Truth Engine + Guardians | 🟢 ACTIVE | — |
| CAP-014 | Lab-Guardian (legacy · preserved) | Truth Engine + Guardians | 🟢 ACTIVE | — |
| CAP-015 | R-10 Authorisation Layer | Truth Engine + Guardians | ⚫ DEFERRED | — |
| CAP-016 | Baseline Fixture Set + Runner | Truth Engine + Guardians | 🟢 ACTIVE | — |
| CAP-017 | Cross-Substrate Contradiction Detection | Truth Engine + Guardians | 🟡 AUDITED | — |
| CAP-021 | Source Registry | Acquisition Fabric | 🟡 AUDITED | — |
| CAP-022 | Discovery Orchestrator | Acquisition Fabric | 🟡 AUDITED | — |
| CAP-023 | Crawl + Fetch Queues | Acquisition Fabric | 🟡 AUDITED | — |
| CAP-024 | Existing Crawler / Fetch Worker Scripts (26) | Acquisition Fabric | 🟢 ACTIVE | [/nex-head-quarters/walker](/nex-head-quarters/walker) |
| CAP-025 | Normaliser | Processing Layer | 🟡 AUDITED | — |
| CAP-026 | Deduplicator + Content Hash | Processing Layer | 🟡 AUDITED | — |
| CAP-027 | Change Detection | Processing Layer | 🟡 AUDITED | — |
| CAP-028 | Entity Resolution / Identity Graph | Processing Layer | 🟡 AUDITED | — |
| CAP-029 | Classifier (multi-axis) | Processing Layer | 🟠 IMPLEMENTED | — |
| CAP-030 | Location Intelligence | Processing Layer | 🟡 AUDITED | — |
| CAP-031 | Claim Extractor | Processing Layer | 🟡 AUDITED | — |
| CAP-032 | Evidence Recorder | Processing Layer | 🟡 AUDITED (🔴 collision on nex.evidence) | — |
| CAP-033 | Fact Verification (bridged to Truth Engine) | Processing Layer | 🟠 IMPLEMENTED | — |
| CAP-034 | Knowledge Gap Registry (autonomous loop) | Processing Layer | 🟡 AUDITED | — |
| CAP-041 | Specialist Knowledge Substrates | Knowledge Substrate | 🟢 ACTIVE | [/nex-head-quarters/nex-storage](/nex-head-quarters/nex-storage) |
| CAP-042 | NEX Knowledge Records | Knowledge Substrate | 🟢 ACTIVE | [/nex-head-quarters/knowledge-control-centre](/nex-head-quarters/knowledge-control-centre) |
| CAP-043 | Bridge Relations (semantic) | Knowledge Substrate | 🟠 IMPLEMENTED | — |
| CAP-044 | Concept Substrate | Knowledge Substrate | 🟢 ACTIVE | — |
| CAP-045 | Supabase Knowledge Mirror | Knowledge Substrate | 🟢 ACTIVE | — |
| CAP-046 | Knowledge Router | Knowledge Substrate | 🟠 IMPLEMENTED | — |
| CAP-051 | Accommodation Workload | Domain Workloads | 🟢 ACTIVE | [/nex-head-quarters/accommodation-agent](/nex-head-quarters/accommodation-agent) |
| CAP-052 | Food Workload | Domain Workloads | 🟢 ACTIVE | [/nex-head-quarters/food-ops](/nex-head-quarters/food-ops) |
| CAP-053 | Transport Workload | Domain Workloads | 🟠 IMPLEMENTED | [/nex-head-quarters/transport-data](/nex-head-quarters/transport-data) |
| CAP-054 | Attractions Workload | Domain Workloads | 🟠 IMPLEMENTED | — |
| CAP-055 | Commerce / Marketplace | Domain Workloads | 🟠 IMPLEMENTED | [/nex-head-quarters/commerce](/nex-head-quarters/commerce) |
| CAP-056 | Services Workload | Domain Workloads | 🟠 IMPLEMENTED | — |
| CAP-057 | Travel Workload | Domain Workloads | 🔵 DISCOVERED | — |
| CAP-058 | Business Workload (cross-Domain classifier) | Domain Workloads | 🟢 ACTIVE | — |
| CAP-059 | Code Domain (NEX1) | Domain Workloads | 🟢 ACTIVE | — |
| CAP-061 | **Image / Visual Intelligence** | Multimodal | 🟠 IMPLEMENTED (⚠️ audit-loop warning · see below) | [/nex-head-quarters/image-intake](/nex-head-quarters/image-intake) |
| CAP-062 | Voice Pipeline (Phase 12) | Multimodal | 🟠 IMPLEMENTED | [/nex-voice-demo](/nex-voice-demo) |
| CAP-063 | Chat / Conversation | Multimodal | 🟢 ACTIVE | [/nex-appchat](/nex-appchat) |
| CAP-064 | Vision Intelligence (analyze) | Multimodal | 🟠 IMPLEMENTED | — |
| CAP-071 | Master AI Intelligence Layer | Agents / Workers | 🟢 ACTIVE | [/nex-head-quarters/vitals](/nex-head-quarters/vitals) |
| CAP-072 | Programmer Worker | Agents / Workers | 🟢 ACTIVE | — |
| CAP-073 | 11 Specialist Domain Workers | Agents / Workers | 🟢 ACTIVE | [/nex-head-quarters/workers](/nex-head-quarters/workers) |
| CAP-081 | Language Engine | English Brain / Language | 🟢 ACTIVE | — |
| CAP-082 | Deterministic Q&A (P1-P5) | English Brain / Language | 🟢 ACTIVE | [/nex-appchat](/nex-appchat) |
| CAP-091 | NEX HQ (33 pages) | UI Surfaces | 🟢 ACTIVE | [/nex-head-quarters](/nex-head-quarters) |
| CAP-092 | NEX App / NEX-App Shell | UI Surfaces | 🟢 ACTIVE (⚠️ duplication) | [/nexapp](/nexapp) |
| CAP-093 | NEX-Live | UI Surfaces | 🟢 ACTIVE | [/nex-live](/nex-live) |
| CAP-094 | NEX-Door | UI Surfaces | 🟢 ACTIVE | [/nex-door](/nex-door) |
| CAP-095 | NEX Provider Suite | UI Surfaces | 🟢 ACTIVE | [/nex-provider-register](/nex-provider-register) |
| CAP-096 | Trade Centre + Merchant Directory + Homeowner + Yard | UI Surfaces | 🟢 ACTIVE | [/find](/find) |
| CAP-101 | Provenance Layer (accommodation) | Governance | 🟢 ACTIVE | — |
| CAP-102 | Memory System (auto-memory) | Governance | 🟢 ACTIVE | — |
| CAP-103 | Gate 3 Constitutional Discipline | Governance | 🟢 ACTIVE | — |
| CAP-111 | Indonesia (populated country) | Country / Language | 🟢 ACTIVE | [/nex-did-you-know-indonesia](/nex-did-you-know-indonesia) |
| CAP-112 | Country Expansion (UK · USA · etc.) | Country / Language | ⚫ DEFERRED | — |

**Total capabilities registered: 61** · Status distribution: 🟢 34 ACTIVE · 🟠 11 IMPLEMENTED · 🟡 13 AUDITED · 🔵 1 DISCOVERED · ⚫ 2 DEFERRED · 🔴 0 BLOCKED (as of 2026-09-11)

---

## Do-not-repeat register (completed investigations)

Master AI MUST NOT re-audit any of the following without a specifically identified unresolved question.

| Investigation ID | Name | Do-Not-Repeat | Reason |
|---|---|:---:|---|
| **AUD-001** | NEX Lab / Crawler / Scraper / Acquisition Architecture Audit | ✅ | Phase C architecture locked in ADR-0314g. Consolidation candidates in §6.4. |
| **AUD-002** | Image Capability Audits (ADR-0028/29/30/33/34 + ADR-0314g §6.4) | ✅ | General image architecture already audited multiple times. **Targeted follow-up still needed**: existing Supabase image DATABASE/storage mapping into the Phase C architecture. DO NOT re-audit general architecture. |
| **AUD-003** | Stage 1 Constitutional Completion Audit | ✅ | 18/18 dimensions PASS. ADR-0314a.2.s-constitutional-completion-audit. |
| **AUD-004** | Domain Brain Coverage Audit | ✅ | 204 nex tables · 46,114 provenance rows · project_nex_intelligence_storage_grid_build_2026_09_08 covers. |
| **AUD-005** | Accommodation Rule Book v4 (42-section founder BEGIN) | ✅ | 127 tests · 8 country profiles · 50-question acceptance corpus. Rule Book v4 authoritative. |
| **AUD-006** | Stage 1a Fixture-Runner Determinism Proof | ✅ | 33/33 fixtures · 5-run byte-identical · Stage 1a exit report locked. |

---

## ⚠️ CAP-061 · Image / Visual Intelligence · audit-loop warning

**Founder observed**: "The image situation is exactly the warning sign: audited twice, understood twice, but not yet promoted into a clearly mapped implementation area."

**Audits already covering general image architecture (DO NOT REPEAT):**

- ADR-0028 NEX Intelligence Constitution
- ADR-0029 NEX Image Tagger Directive
- ADR-0030 Intelligence Layers Before Admin
- ADR-0033 Quality Over Quantity + Brain Isolation
- ADR-0034 NEX identity
- ADR-0027 Golden Rules
- ADR-0314a.2.s NEX Lab / Crawler / Scraper / Acquisition Audit §6.4
- ADR-0314g §6.4 Image/News Labs reclassification candidate

**What IS still needed (targeted only)**:

1. Audit the existing Supabase image DATABASE and storage — inventory rows · not architecture
2. Map existing image records into the Phase C Acquisition Fabric object model (Source → Raw Capture → Candidate → Entity → Claim → Evidence)
3. Design a migration/adapter from existing storage to the Layer B4 Image source-adapter + Layer C7 Claim Extractor with `extraction_method='vision'`
4. Implement the Visual Intelligence pipeline as a Phase C consolidation ADR

**What must not be repeated**: general image-architecture reasoning. That is done.

---

## Rogue / unclear pages (14 identified)

These UI paths exist under `src/app/*` but do not clearly map to a capability. Each needs a founder decision: **keep** · **namespace under /dev/** · or **remove**.

### 🚩 Review (12 pages · appear to be dev/demo scaffolding)

| Path | URL | Reason |
|---|---|---|
| `src/app/nex-anim-test/` | `/nex-anim-test` | Animation test · likely dev-only |
| `src/app/nex-frame-preview/` | `/nex-frame-preview` | Frame preview · candidate for `/dev/` namespace |
| `src/app/nex-device-preview/` | `/nex-device-preview` | Device preview · candidate for `/dev/` namespace |
| `src/app/nex-sample-pink/` | `/nex-sample-pink` | Sample page · candidate for removal |
| `src/app/face-scan-debug/` | `/face-scan-debug` | Debug page · candidate for `/dev/` namespace or removal |
| `src/app/hero-swap-demo/` | `/hero-swap-demo` | Demo page |
| `src/app/live-edit-demo/` | `/live-edit-demo` | Demo page |
| `src/app/nex-bike-rental-demo/` | `/nex-bike-rental-demo` | Demo page (prod path is `/nex-bike-rental-register`) |
| `src/app/nex-driver-directory-demo/` | `/nex-driver-directory-demo` | Demo page |
| `src/app/nex-ride-status-demo/` | `/nex-ride-status-demo` | Demo page |
| `src/app/nex-mobility-connection-demo/` | `/nex-mobility-connection-demo` | Demo page |
| `src/app/homepage-split/` | `/homepage-split` | Likely A/B variant · not clearly owned |

### ✅ Reviewed · keep (2 pages)

| Path | URL | Reason |
|---|---|---|
| `src/app/nex-voice-demo/` | `/nex-voice-demo` | Voice Pipeline demo · maps to CAP-062 |
| `src/app/header-off/` | `/header-off` | Header-Off Observatory · founder-facing · maps to ISG audit |

---

## Duplicate UI paths (consolidation candidates)

| Paths | Flag | Reason |
|---|---|---|
| `src/app/nex-app/` + `src/app/nexapp/` | consolidate | Two NEX app shells · candidate for consolidation ADR |

---

## How to use this map

### Before initiating any work:

1. Search the capability index for the topic
2. Check the capability's status + last verified date
3. Check the audit/architecture/implementation references
4. Consult the **do-not-repeat register** if planning an audit
5. If the answer is *"already covered"*, do NOT start another audit. State what's covered · what remains · propose a targeted follow-up if needed.

### When capability moves forward:

1. Update the capability's status in `docs/nex-work-map.json`
2. Update `last_verified` date
3. Update `next_authorised_action`
4. If a capability moves to `ACTIVE`, ensure `ui_url` is populated when it has a UI surface
5. If a new capability emerges, allocate a new CAP-XXX identity in the appropriate group series

### When authoring an ADR:

1. Cite the CAP-XXX identity being touched
2. Add the ADR file path to the capability's `audit_refs` or `architecture_refs`
3. If the ADR closes an investigation, add a `completed_investigation` entry (AUD-XXX) with `do_not_repeat: true`

---

## Live map location

- **Human-readable (this file)**: `docs/NEX-MASTER-WORK-MAP.md`
- **Machine-readable (source of truth for UI)**: `docs/nex-work-map.json`
- **HQ UI page**: `/nex-head-quarters/work-map` — clickable capability cards · status pills · rogue pages · duplicate paths

**Founder should be able to click through from the HQ page directly to any completed UI capability.** That is the design intent.

---

## Provenance

- Authored 2026-09-11 by Master AI
- Authorised by Philip 2026-09-11 (verbatim: *"master ai engineer build the world class first system rock solid"*)
- Consumes: all ADRs in `docs/DECISIONS/*` · all feedback memories · Stage 1a exit report · Phase B + Phase C + Stage 1b Wiring + Stage 1b Founder Decisions
- Constitutional gate: this map is now the **first thing Master AI consults** before any audit / architecture / implementation / migration / consolidation / crawler work

---

**End of NEX Master Work & Architecture Map v1.0.0.**
