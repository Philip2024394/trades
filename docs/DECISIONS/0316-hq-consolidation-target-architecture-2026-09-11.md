# ADR-0316 · HQ Consolidation Target Architecture · 🔒 DOCTRINE LOCKED · Phase D.1 (design only)

**Status:** 🔒 DOCTRINE LOCKED · founder-authorised Phase D.1 2026-09-11 · design only · zero code · zero substrate mutation · consolidation implementation itself remains BLOCKED pending separate authorisation
**Founder:** Philip · authorised via verbatim "continue" 2026-09-11 following D.1 proposal
**Consumes:** ADR-0314g Acquisition Fabric target architecture (§6.4 UI reclassification candidates · anti-zoo principle) · ADR-0314f Guardian Responsibility Reconciliation · Work Map v1.1 (`docs/nex-work-map.json`) · project memory `project_nex_phase_abc_sequencing_and_acquisition_fabric_2026_09_11.md` · feedback memories `feedback_no_crawler_zoo_acquisition_fabric_target.md` (applies to HQ URLs too) · `feedback_one_canonical_knowledge_substrate.md` (applies to HQ views too)

**Doctrine version:** `hq_consolidation_target.v1.0.0` · **Applies to:** every future HQ page · sidebar entry · dashboard consolidation

---

## Section 1 · Founder verbatim authorisation

> *"master ai engineer do you suggest that we must only have 1 url for hq — this one http://localhost:3008/nex-head-quarters/work-map and move the other chart pages into that and add side links to open the pages. and also remove any side links and pages that have no benefit to nex app due to our updated diagram system"*
>
> — Philip · 2026-09-11 · initiating Phase D consolidation
>
> *"i want you to audit this as the most advanced and operational system ever built for hq · given founder full view control and understanding of the nex enterprise ... what do you suggest master ai engineer"*
>
> — Philip · 2026-09-11 · Phase D vision
>
> *"continue"*
>
> — Philip · 2026-09-11 · D.1 authorisation

---

## Section 2 · The problem this ADR solves

Two symptoms observed 2026-09-11:

1. **"Wrong HQ" confusion** — Master AI added the Work Map button to `/nex-head-quarters/*` but the founder was viewing `/nexapp/hq`. Two separate HQ paths exist with different shells · different sidebars · different navigation vocabularies.
2. **Sidebar / page sprawl** — 33 pages under `/nex-head-quarters/*` · additional HQ views under `/nexapp/*` · 12 rogue/demo pages already flagged in Work Map · 1 duplicate UI path pair (`/nex-app` + `/nexapp`). Founder cannot memorise which HQ has what.

**Constitutional principle** (already locked · applied here to HQ): the same anti-zoo doctrine that governs crawlers (`feedback_no_crawler_zoo_acquisition_fabric_target.md`) applies to HQ paths. Sharing a fabric · not multiplying kingdoms.

---

## Section 3 · Current-state audit (read-only inventory)

### 3.1 · Discovered HQ paths

| Path | Shell | Purpose | Sidebar owner | Status |
|---|---|---|---|---|
| `/nex-head-quarters` | `HQShell.tsx` | Reception (RealityStrip + OperationsCentre) · full sidebar | HQShell SECTIONS | 🟢 canonical (locked by this ADR) |
| `/nex-head-quarters/*` (33 sub-pages) | `HQShell.tsx` | Domain-specific control centres | HQShell SECTIONS | 🟢 canonical |
| `/nexapp/hq` | inline in `HqLiveClient.tsx` | Dark-theme n8n-style live-graph · agents · data-flow · growth | own header nav | 🟡 relocation candidate |
| `/nexapp/hq/*` | (none currently) | — | — | — |

### 3.2 · Sidebar entries under HQShell (33 declared in SECTIONS)

Groups per HQShell: `core` · `verticals` · `workforce` · `review` · `external`.

Current entries per Work Map lookup:
- **Reception** · **Work Map** (added D-day) · **Discovery** · **Knowledge Control Centre** · **Collector** (staircase-refacing + queue) · **Food Ops** · **Nex Storage** · **Data Platform Centre** · **Draft Review** · **Claim Review** · **Cle Review** · **Comms Social** · **Conversations** · **M4 Results** · **Vitals** · **Audit** · **Image Intake** · **Journal** · **Operations Centre** · **Factory** · **Directory Factory** · **Transport Data** · **Commerce** · **Discovery** · **Walker** · **Workforce** · **Commercial** · **Category Images** · **Calling** · **Media** · **Wallet Anomalies** · **Directory** · **Workers** · **Walker Health** · **Accommodation Agent** · **Live-Chat Completion** · **M4 Survey**

### 3.3 · Rogue pages (from Work Map v1.1 · already flagged)

12 pages under `src/app/*` with no capability owner: `nex-anim-test` · `nex-frame-preview` · `nex-device-preview` · `nex-sample-pink` · `face-scan-debug` · `hero-swap-demo` · `live-edit-demo` · `nex-bike-rental-demo` · `nex-driver-directory-demo` · `nex-ride-status-demo` · `nex-mobility-connection-demo` · `homepage-split`.

Duplicate UI paths already flagged: `/nex-app` + `/nexapp`.

---

## Section 4 · Target architecture

**Locked target: ONE canonical HQ URL prefix — `/nex-head-quarters/*` — with a single shared shell (`HQShell.tsx`) and one authoritative sidebar.**

### 4.1 · Consolidation locked · four rules

1. **All founder-facing HQ views live under `/nex-head-quarters/*`.** No exceptions.
2. **Every sidebar entry MUST own a CAP-XXX** in `docs/nex-work-map.json`. Entries without a capability owner are removed or deferred.
3. **`/nexapp/hq` migrates to `/nex-head-quarters/live-graph`** as a sub-route. Old URL becomes a redirect for one release cycle · then is deleted.
4. **Rogue pages already flagged in Work Map are removed** unless a founder authorisation preserves them (per-page decision).

### 4.2 · Sidebar audit rule

Every entry in `HQShell.tsx` SECTIONS must resolve to a `capability_id` in the Work Map. The audit produces a table:

| Sidebar entry | Capability owner (CAP-XXX) | Decision |
|---|---|---|
| Reception | (locked · always present) | keep |
| Work Map | CAP-91 (HQ · new) | keep · promote to core |
| Live Graph | CAP-91 (HQ · consolidated from `/nexapp/hq`) | add |
| Knowledge Control Centre | CAP-42 (Knowledge Records) | keep |
| Nex Storage | CAP-41 (Specialist Substrates) | keep |
| Food Ops | CAP-52 (Food Workload) | keep |
| Accommodation Agent | CAP-51 (Accommodation Workload) | keep |
| Transport Data | CAP-53 (Transport Workload) | keep |
| Commerce | CAP-55 (Commerce/Marketplace) | keep |
| Walker + Walker Health + Workforce + Discovery | CAP-24 (Crawler Scripts) + CAP-73 (Specialist Workers) | keep · consider grouping under a single "Acquisition" section |
| Workers | CAP-73 (Specialist Workers) | keep |
| Vitals | CAP-71 (Master AI Intelligence) | keep |
| Image Intake | CAP-61 (Visual Intelligence) | keep · targeted follow-up per Work Map |
| Calling | CAP-56 (Services) or (Comms · pending capability assignment) | audit |
| Media | (pending capability assignment) | audit |
| Comms Social + Comms Social HQ | (pending capability assignment · Operational Scope per §7.3-B1) | audit + merge duplicate |
| M4 Results + M4 Survey | (pending capability assignment) | audit |
| Category Images | (pending capability assignment) | audit |
| Claim Review · Cle Review · Draft Review · Review · Audit | governance sub-cluster · candidate CAP additions to Work Map | audit + potentially consolidate |
| Data Platform Centre · Factory · Directory · Directory Factory · Operations Centre | operational clusters · candidates for grouping | audit |
| Conversations · Live-Chat Completion | CAP-63 (Chat) | keep · consider merging |
| Wallet Anomalies | (pending capability assignment · Compliance) | audit |
| Journal | (pending capability assignment) | audit |

**Result of audit** (this ADR does NOT execute · founder decides per-entry): every "audit" row above needs a founder decision to (a) map to an existing CAP-XXX, (b) create a new CAP-XXX in Work Map, or (c) remove.

### 4.3 · Migration path (for future authorised sub-phases)

Each sub-phase is a separate founder authorisation:

- **D.2 · file-path → CAP-XXX registry authored** — a JSON file (`docs/nex-file-capability-map.json`) mapping every `src/**/*` file to its owning CAP-XXX. Consumed by the Security Agent (ADR-0316a).
- **D.3 · `/nexapp/hq` relocation** — move `HqLiveClient.tsx` under `/nex-head-quarters/live-graph/`. Author redirect at `/nexapp/hq` → `/nex-head-quarters/live-graph`. Redirect stays for one release cycle.
- **D.4 · sidebar audit execution** — per-entry founder decisions applied · sidebar reordered · orphan entries removed.
- **D.5 · rogue-page removal** — 12 flagged pages deleted (with `git rm`) · deployment cache purged.
- **D.6 · `/nex-app` + `/nexapp` duplicate reconciliation** — separate ADR · larger scope · not covered by this consolidation.

### 4.4 · Redirect discipline

For every URL that changes:

- Old URL returns HTTP 308 (permanent redirect) to new URL for one release cycle
- After one cycle · old URL returns 410 Gone or is unregistered
- Both events are logged in a URL migration ledger (`docs/nex-url-migration-ledger.md` · authored in D.3)

### 4.5 · Preserved (unchanged)

- Consumer-facing `/nexapp/*` product surfaces (chat · lab · voice · settings · directory · search · etc.) — NOT HQ · stay where they are.
- Merchant-facing `/[slug]` canteen pages (per ADR-0002).
- Trade Centre · SiteBook · The Yard · Homeowner surfaces.
- All product routes at root level (`/find` · `/homeowners` · `/community` · `/feed` etc.).

**Only HQ paths consolidate. Product paths are outside this ADR's scope.**

---

## Section 5 · Enforcement implications (doctrine · not implemented by this ADR)

- **Every new HQ page ADR** must specify its URL under `/nex-head-quarters/*` · never elsewhere. Any exception requires a founder-authored amendment to this ADR.
- **Every sidebar entry addition** must cite the CAP-XXX it owns. PR review fails without it (once HQ Security Agent lands per ADR-0316a).
- **Every URL migration** must go through the D.4 redirect discipline · no silent unpublishing of routes.
- **Every rogue-page review** produces a founder decision recorded in the Work Map · never quietly deleted.

---

## Section 6 · What this ADR did NOT do

- ❌ No code authored
- ❌ No migrations authored
- ❌ No files moved or renamed
- ❌ No `/nexapp/hq` relocation started
- ❌ No sidebar entries added or removed
- ❌ No rogue pages deleted
- ❌ No redirect installed
- ❌ No new capability added to Work Map
- ❌ No sub-phase D.2 · D.3 · D.4 · D.5 · D.6 initiated
- ❌ No consumer-facing `/nexapp/*` surface touched
- ❌ No `/nex-app` + `/nexapp` duplicate resolved (separate ADR)
- ❌ No UI theme rules altered

---

## Section 7 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | Single canonical HQ URL prefix locked as `/nex-head-quarters/*`. Every founder-facing HQ view lives under it. Every sidebar entry owns a CAP-XXX. `/nexapp/hq` migrates to `/nex-head-quarters/live-graph` in D.3. Rogue pages removed in D.5. Consumer-facing `/nexapp/*` surfaces preserved. Migration executes in sub-phases D.2 → D.6 · each own founder authorisation. |
| **Decided by** | Philip |
| **Decision date** | 2026-09-11 |
| **ADR** | 0316 · this file · consumed by ADR-0316a (Security Agent) · by future D.2-D.6 migration ADRs · by Work Map maintenance |
| **Effective from** | `hq_consolidation_target.v1.0.0` |
| **Supersedes** | none · superior to (does not delete) Work Map v1.1 rogue-page section |
| **Reason** | Founder verbatim: prevent "wrong HQ" confusion · apply anti-zoo doctrine to HQ URLs · give founder one canonical view + one authoritative sidebar. Work Map becomes site index for both founder and NEX1/2/3. |

---

## Section 8 · Cross-references

**Consumed by (future ADRs):**
- ADR-0316a HQ Security Agent Design (this Phase D.1 pair)
- Sub-phase D.2 file-path → CAP-XXX registry
- Sub-phase D.3 `/nexapp/hq` relocation
- Sub-phase D.4 sidebar audit execution
- Sub-phase D.5 rogue-page removal
- Sub-phase D.6 `/nex-app` + `/nexapp` reconciliation (separate)

**Consumes:**
- ADR-0314g Acquisition Fabric target (anti-zoo principle)
- ADR-0314f Guardian Responsibility Reconciliation
- Work Map v1.1 (`docs/nex-work-map.json`)
- Feedback memories: no crawler zoo · one canonical Knowledge · observation ≠ authority

---

## Section 9 · Master AI STOPS · awaiting founder review

**Master AI does NOT autonomously proceed to D.2 · D.3 · D.4 · D.5 · D.6.** Each sub-phase requires a separate founder authorisation.

**Current position after Phase D.1 first ADR:**

- Phase A · Stage 1a · 🟢 COMPLETE
- Phase B · Guardian reconciliation · 🟢 LOCKED
- Phase C · Acquisition Fabric · 🟢 LOCKED
- Stage 1b Wiring bridge + founder decisions · 🟢 LOCKED · implementation halted at 1b.2 (nex.evidence collision)
- Work Map v1.1 · 🟢 ACTIVE
- **Phase D.1 · HQ Consolidation Target · 🟢 LOCKED (this ADR)**
- Phase D.1 · HQ Security Agent Design · 🟡 authoring next (ADR-0316a)
- Phase D.2 · D.3 · D.4 · D.5 · D.6 · 🔴 BLOCKED pending own founder authorisation

**Substrate posture:** unchanged · everything frozen · Gate 3 remains OPEN.

---

**End of ADR-0316 · HQ Consolidation Target Architecture · doctrine locked · Phase D.2 onward remain BLOCKED pending founder authorisation.**
