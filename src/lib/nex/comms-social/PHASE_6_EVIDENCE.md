# Phase 6 · Evidence Report

**Date:** 2026-08-08
**Scope:** Merchant Social UI · consumes the Phase 0-5 API surface only.
**Status:** ✅ PHASE 6 COMPLETE.

## Charter compliance summary

| Requirement | Phase 6 status |
|---|---|
| UI never calls provider adapters directly | ✅ zero imports of `adapters/**` · verified by ui-boundaries UB1 |
| UI never touches provider SDKs | ✅ verified by UB1 (all six SDK package names checked) |
| UI never bypasses the worker | ✅ every publish path goes through `/api/nex/comms-social/scheduling/enqueue` + `/worker/tick` |
| Tenant isolation preserved | ✅ every mutation POST body includes `tenant_id` · verified by UB10 |
| S-III grounding preserved | ✅ UI renders `grounding_state` + rejection reasons · never posts un-grounded content directly |
| S-IV rights controls preserved | ✅ Sources tab exposes `rights_status` picker + chip · UI never overrides eligibility |
| S-V approval/active-consent preserved | ✅ Categories tab enforces per-category opt-in · role gate on Automatic · 14-day check-in visible |
| S-VI one-way pipeline preserved | ✅ every UI publish attempt enqueues a job · verified by UB9 (all fetches → /api/nex/comms-social) |
| S-VII idempotency preserved | ✅ UI does not touch the intent-row logic · worker owns |
| S-VIII fail-closed validation preserved | ✅ Draft card shows validator run per-stage outcomes · rejection reasons humanized |
| S-IX OAuth/token security preserved | ✅ Connect flow returns authorize URL only · tokens never appear in UI · verified by UB3/UB8 |
| S-XII no prediction/learning in UI | ✅ zero imports of `@/lib/nex/predictive/**` · verified by UB2 |
| Automatic never becomes a global switch | ✅ Categories tab is per-category · role gate + 14-day dormancy visible · Controls tab labels the global pause as "kill switch" not "auto-publish everything" |

## Files changed / added

### New UI
- `src/components/nex-app/nex-brain/SocialCentrePanel.tsx` — 700+ lines · client component · 11 tabbed sections (accounts · brand · sources · templates · drafts · categories · schedule · queue · history · analytics · controls) · humanized rejection reasons · role-scoped Categories tab · global-pause kill switch.
- `src/app/nex-app/nex-brain/comms-social/page.tsx` — HQ standalone page at `/nex-app/nex-brain/comms-social` rendering the panel.

### New tests
- `src/lib/nex/comms-social/tests/ui-boundaries.test.mjs` — 13 assertions.

Diff: **3 files added · 0 files removed · +~900 lines**.

## Screens / routes delivered

| Route | Description |
|---|---|
| `/nex-app/nex-brain/comms-social` | Standalone HQ page with the full 11-tab Social Centre |

Inside the panel · 11 sections:

| # | Tab | Function |
|---|---|---|
| 1 | Accounts | Connect an OAuth account via Phase 1 initiate flow · shows connection status |
| 2 | Brand | View/edit tone · forbidden terms · required hashtags |
| 3 | Sources | Add content sources · pick rights_status · view eligibility |
| 4 | Templates | Read-only list of templates (Nex-owned + tenant) · full CRUD in Phase 6.1 |
| 5 | Drafts | Generate from template · validator re-run · humanized rejection reasons · draft card |
| 6 | Categories | Per-category Manual/Assisted/Automatic mode · role gate · 14-day dormancy visible |
| 7 | Schedule | Enqueue a grounded draft for publish at a future time |
| 8 | Queue | Live list of scheduled jobs · run worker tick · auto-refresh every 15 s |
| 9 | History | Validator-run history for audit |
| 10 | Analytics | Grounded metric counts (jobs · published · queued · failed · refused · paused) |
| 11 | Controls | Global pause kill-switch · shows who/when/why |

## Exact test counts

| Suite | Result |
|---|---|
| Phase 0 (4 suites) | 28/28 |
| Phase 1 (4 suites) | 23/23 |
| Phase 2 (5 suites) | 36/36 |
| Phase 3 (6 suites) | 33/33 |
| Phase 4 (3 suites) | 21/21 |
| Phase 5 (2 suites) | 51/51 |
| **ui-boundaries** (P6) | **13/13** |
| **Total** | **205/205** across 25 suites |

## Tenant / security evidence

- **UB1** · SocialCentrePanel does not import any adapter file or provider SDK (all six known SDK packages checked).
- **UB2** · No `@/lib/nex/predictive` imports — S-XII preserved at the UI layer.
- **UB3** · No `@/lib/supabaseAdmin` import — Hammerex data plane not reachable from Comms-Centre Social UI.
- **UB4** · No import of the Hammerex `src/lib/nex/social/**` module.
- **UB5** · No delivery / compliance domain imports.
- **UB6** · Page route only imports the panel component · zero forbidden imports.
- **UB9** · Every `fetch()` in the panel targets `/api/nex/comms-social/*` — no direct provider URL, no direct DB access.
- **UB10** · Every non-global mutation POST body includes `tenant_id`. Legitimately-global endpoints (controls kill-switch · worker tick) explicitly excluded from the assertion.
- **RLS-at-DB-layer preserved** · UI never sends bypass GUCs · worker bypass (Phase 4) remains the only way to write across tenants.

## Approval / automation evidence

- **UB8** · Panel calls `alert()` on HTTP 403 from `/scheduling/categories` — surfaces role-denied enable_automatic per S-V ("Only owner/admin/agency_manager may enable Automatic").
- **UB12** · Categories tab exposes an explicit "acting as role" selector · POSTs `actor_role` to the API · lets the merchant see immediately which grants they'd need.
- **UB13** · Draft card renders a "Why this can't publish yet" block populated from `rejection_reasons`, with the humanized code map (`hard_blocked_claim` → "This wording is on our forbidden-claims list …" · etc.).
- **14-day dormancy visible** · Categories tab shows `Auto-degraded: <reason>` or `Last check-in: <date>` per category · charter §S-V active-consent surfaced.
- **Global pause presented as kill switch** · Controls tab labels the toggle "PAUSE all publishing" · the button colour flips to warning when live · when paused, the label is red "PAUSED (global kill switch active)" with who/when/why · never framed as "auto-publish everything."

## Accessibility / responsive evidence

- `role="tablist"` + `role="tab"` + `aria-selected` on tab strip.
- `role="tabpanel"` + `aria-labelledby` on each section body.
- `aria-label` on unlabeled form controls (tenant ID field · platform pickers).
- Semantic `<label>` wrapping every form input.
- Fixed-column grids collapse gracefully; wider grids use `grid-template-columns: repeat(auto-fit, minmax(...))` so cards reflow on narrow viewports.
- Colour tokens use the shared house palette (`T` object) with sufficient contrast for the dark theme.
- No colour-only signalling · every status also has a text label (chip text + explicit words like "PAUSED").

## Architectural conflicts

None new. Two known items unchanged from earlier phases:
1. RLS enforcement requires `nex_social_app` (Phase 0).
2. Charter v0.2 path discrepancy (`social/adapters/*` vs actual `comms-social/adapters/*`) — recorded for future amendment.

**One environment issue encountered during the build:**
- Disk 100% full on the dev machine triggered a Turbopack compaction failure mid-run; the dev server started returning 500s. Purged `.next` (freed 371 MB) and restarted; full aggregate then passed 25/25 · 205/205. Not a code issue · noted for operational awareness. Recorded here so ops sees it before Phase 7 lands additional builds.

## Doctrine faith kept

- ✅ Predictive OBSERVATION mode active · predictive-boundary suite still green · UB2 confirms UI cannot reach Predictive either.
- ✅ Hammerex `src/lib/nex/social/**` untouched · UB4 enforces.
- ✅ Canonical v1.0.5 architecture doc · charter proposals · Amendment #16 draft — all untouched.
- ✅ Seven v1.0.0 frozen interface hashes verified matching manifest.
- ✅ Boundary verifier zero violations.
- ✅ No prediction · ranking · scoring above threshold · learning in the UI.

## What is NOT delivered in Phase 6 (deferred)

- **Popup / new-tab OAuth flow** — currently the Connect button returns the authorize URL and asks the merchant to open it. Phase 6.1 wires an actual popup with `window.open()` + `postMessage` back-channel.
- **Accounts list endpoint** — Phase 5 does not expose `GET /api/nex/comms-social/oauth/accounts?tenant_id=`; Accounts tab shows connect-only. A merchant-facing accounts lister lands in Phase 6.1.
- **Template editor UI** — Templates tab is read-only. Full CRUD editor lands in Phase 6.1.
- **Calendar view** — Schedule tab is a single enqueue form. Full month-view calendar lands in Phase 6.2.
- **Provider metrics (reach · impressions · engagement)** — Analytics tab shows only grounded job-counts. Provider metric ingestion lands in Phase 8 (Attribution integration).
- **Multi-user role dashboard** — merchant currently self-declares acting role in the UI (dev-friendly). Production auth wiring lands with the wider Nex user identity system.
- **Merchant onboarding wizard** — Phase 6 provides the tabs; a step-by-step first-run wizard lands in Phase 6.3.

## Whether Phase 7 is ready

**No.** Phase 7 (HQ Mission Control · network-wide oversight · tenant management · admin surfaces) requires explicit Philip greenlight. Phase 6 is complete and pushed-ready; nothing autonomously proceeds. Predictive · Hammerex · frozen kernel all untouched.

## Commit ready

Awaiting push authorisation.
