# NEX Refacing · Stage 1 Remediation Spec

**Written:** 2026-08-12 (master AI engineer audit against locked doctrine)
**Amended:** 2026-08-12 (Philip lock · 9-verb pipeline · commercial-model correction)
**Status:** ACTIVE · consumed by any future `GO LOCK · REFACING FLOW · STAGE 8` implementation phase
**Authority:** implements `project_nex_refacing_flow_stage1_2026_08_10.md` (LOCKED) · `project_nex_refacing_architecture_v2_2026_08_12.md` (LOCKED · 9-verb pipeline + 15 PRODUCT RULES) · honours the 8-step build order from `project_nex_refacing_ecosystem_2026_08_10.md` · honours the Trade Exchange doctrine at `project_nex_refacing_trade_exchange_2026_08_10.md`

## Target architecture (v2 FINAL LOCK · governs V1-V8 below)

The remediation below MUST result in the following customer journey (LOCKED Philip 2026-08-12):

```
SHOW → FEEL → SEE → TRY → LOCK → CONNECT → SURVEY → QUOTE → CONTRACT
```

Where SHOW/FEEL/SEE/TRY/LOCK are NEX + homeowner stages, CONNECT is the handoff, and SURVEY/QUOTE/CONTRACT are member-side. Full detail: architecture memory `project_nex_refacing_architecture_v2_2026_08_12.md`.

**Key implementation rules from architecture memory that override earlier spec assumptions:**

- **PR-13** NEX NEVER QUOTES. Any UI that shows a NEX-attributed price to the homeowner violates the LOCKED trade exchange doctrine. Members provide prices after SURVEY. The `enquiry` endpoint below produces a Refacing Case for member routing, not a purchase.
- **PR-14** The output of LOCK is a structured Refacing Case (see architecture memory · Refacing Case structure section). This is the artefact NEX hands to the Member.
- **PR-15** NEX earns from Refacing Member subscription. NEX does NOT earn from homeowner transactions. Product surfaces must reflect this.
- **PR-8/9** SEE stage shows 2-4 designs (Safe Centre / Warm Character / Stretch Statement or equivalent span) with reason-for-existing copy, NO price line.
- **PR-12** Do NOT expand the 100-image customer catalogue as part of this remediation. Add metadata + retrieval intelligence to existing images instead.

## Position

An untracked refacing bundle exists at:

- `src/app/nex-app/staircase-renovations/page.tsx`
- `src/app/api/nex/staircase-renovations/{enquiry,manifest,plans}/route.ts`
- `src/components/nex-app/staircase-renovations/{RenovationsViewer,QuoteFlow}.tsx`
- `data/staircase-renovations/{manifest.json,plans-manifest.json,enquiries/,uploads/}`
- `public/staircase-renovations/{oak,painted,white,walnut,glass,modern,feature-wall,storage,materials,...}/`

The bundle is **pre-doctrine code** (created 2026-08-10/11, before the Stage 1 lock landed the same day). Stage 1 memory explicitly enumerates its non-conformances (lines 62-68). It is **parked as untracked**, **not committed**, **not shipped**, until a Stage 8 GO LOCK authorises a remediated implementation.

**Do not `git add` this bundle without following this spec.** Committing as-is would ship a surface the customer-journey doctrine says default-NO to.

## Doctrine reference (authoritative)

Every rewrite below cites the Stage 1 clause it satisfies. If Stage 1 memory changes, this spec MUST be re-derived.

- **A1-A4** entry point + separation from Design Library
- **B1-B5** entry UX (upload-first, browsable references, guided multi-photo)
- **C1-C6** Refacing Case identity + information

Plus the 8-step build order (ecosystem memory): images are step 8, not step 1.

## Violation → remediation matrix

### V1 · `sr_` submission ID is not the canonical Case ID (Stage 1 · C2, C5)

**Where:** `src/app/api/nex/staircase-renovations/enquiry/route.ts:111`

```ts
const enquiryId = `sr_${Date.now()}_${randomUUID().slice(0, 8)}`;
```

**Required change:**

- Introduce a canonical Refacing Case identity type `RefacingCaseId = \`rf_${string}\`` in `src/lib/nex/refacing/case-id.ts` (new file).
- Case IS created before the enquiry endpoint is ever called (per C1). Enquiry becomes a state transition on an existing Case, not a create.
- New endpoint `POST /api/nex/refacing/cases` creates a `DRAFT` Case, returns `{ refacing_case_id: "rf_..." }`.
- Existing enquiry becomes `POST /api/nex/refacing/cases/[rf_id]/enquiry` and asserts the Case exists.
- Legacy `sr_` IDs remain valid only inside `data/staircase-renovations/enquiries/*.json` historical records. New writes use `rf_`.

**Interface (implemented in Stage 8):**

```ts
// src/lib/nex/refacing/case-id.ts
export type RefacingCaseId = `rf_${string}`;
export function newRefacingCaseId(): RefacingCaseId { /* rf_<ts>_<8char> */ }
export function isRefacingCaseId(v: unknown): v is RefacingCaseId;
```

### V2 · Contact upsert happens at entry, not at quote-request-or-later (Stage 1 · C4)

**Where:** `src/app/api/nex/staircase-renovations/enquiry/route.ts:161-182` — `upsertContact` runs inside the enquiry-create path, which today is the entry.

**Required change:**

- Case creation MUST NOT require `name/phone/email`. Anonymous Case entry is a first-class supported state.
- Contact upsert moves to a later transition: either `POST /cases/[rf_id]/quote-request` or an explicit `POST /cases/[rf_id]/attach-contact`.
- No forced registration screen at entry (per C4). Existing QuoteFlow modal's identity fields still capture at the *quote* boundary, not at *entry*.

### V3 · Entry is browse-first, not upload-first (Stage 1 · B1, B4)

**Where:** `src/app/nex-app/staircase-renovations/page.tsx` renders `RenovationsViewer` (a categories carousel) as the first screen.

**Required change:**

- Rename route surface: internal route becomes `/nex-app/refacing/*` (A1 permits either; `staircase-renovations` may remain as a redirect alias only).
- New entry page renders an **upload-first** hero:
  - Primary CTA: `"START WITH YOUR STAIRCASE"` (verbatim per B1)
  - Secondary text link: `"See refacing ideas first"` opens the reference carousel (which becomes the SECONDARY surface, not the primary)
  - Boundary marker copy at top: `"NEX REFACING · Keep your staircase. Change its appearance."` (verbatim per A4)
- Desktop: drag-and-drop zone + upload button. Mobile: camera capture (`<input type="file" accept="image/*" capture="environment">`) + file picker.
- Multi-photo guided capture per B5: suggested views are hints not gates. Existing `PHOTO_SLOTS` in `QuoteFlow.tsx:36-41` are the correct slot vocabulary; they move earlier in the flow (into the entry surface, not gated behind the Quote modal).

### V4 · Design Library / Refacing separation is not visible in navigation (Stage 1 · A3, A4)

**Where:** No enforced separation exists in the current header / navigation shell.

**Required change:**

- Two distinct labelled entry points anywhere Refacing is offered:
  - **REFACE YOUR EXISTING STAIRCASE** → `/nex-app/refacing`
  - **EXPLORE STAIRCASE DESIGNS** → existing Design Library route (whichever it currently is; documented in Stage 8 discovery)
- No ambiguous `Staircases` gateway that could route the customer to the wrong journey.
- Boundary marker per A4 rendered as the first block on `/nex-app/refacing`.

### V5 · Viewer state is transient in-browser · no Case concept (Stage 1 · C1, C6)

**Where:** `src/components/nex-app/staircase-renovations/RenovationsViewer.tsx` — `useState` for category, image index, material picker; no persistence to a Case.

**Required change:**

- Every viewer interaction that could be re-derived from a Case (saved references, material choice, viewed collections) writes through to the Case via a small hook `useRefacingCase()` (new file `src/lib/nex/refacing/use-case.ts`).
- Anonymous Case lives in a durable store (Stage 8 decides: signed cookie + server-side JSON, or a magic-link token). The hook is agnostic to the storage impl.
- `RenovationsViewer` receives `caseId: RefacingCaseId | null` prop. When null, first save-reference action creates the Case then attaches. When set, all mutations reference it.
- QuoteFlow's `context: QuoteContext` is enriched with `refacing_case_id: RefacingCaseId`.

### V6 · No "Your Refacing Project" resume surface (Stage 1 · C6)

**Where:** does not exist.

**Required change:**

- New route `/nex-app/refacing/your-project/[rf_id]` renders the Case's current state:
  - Saved references
  - Uploaded BASE photos
  - Intent description (from later stages, but the shell is built now)
  - Status: `AWAITING_BASE_STAIRCASE` | `BASE_UPLOADED` | `INTENT_DEFINED` | ... (from C1 lifecycle)
- Case resume mechanism (session token / magic link) is a Stage 8 sub-decision. This spec only requires the surface exists and reads from a Case store.

### V7 · Manifest is single-material categories, not component-role vocabulary (Stage 1 · downstream note + Visual System memory)

**Where:** `data/staircase-renovations/manifest.json` — 10 categories (oak, painted, white, walnut, glass, modern, feature-wall, storage, ...). Each is a wood species or a lifestyle bucket, not a component role.

**Required change:**

- Reference library re-tagging per Visual System memory role vocabulary:
  - `BASE_STAIRCASE` (customer's actual staircase — never comes from the reference library)
  - `TREAD_REFERENCE`
  - `HANDRAIL_REFERENCE`
  - `MATERIAL_REFERENCE`
  - `BALUSTER_REFERENCE`
  - `NEWEL_REFERENCE`
  - `WHOLE_STAIRCASE_REFERENCE` (existing catalogue images fall here by default)
- Existing 10 flat categories are PRESERVED for display (Stage 7 memory: "existing flat categories PRESERVED") but supplemented with a `role_tags[]` array per image so the Brain retrieval layer (Stage 8+) can compose by role.
- Manifest becomes a superset, not a replacement: additive migration, no image URL changes.
- Manifest note block at `manifest.json:4-13` gets a new item explaining the role_tags rule.

### V8 · Images loaded before steps 1-7 complete (Ecosystem 8-step build order)

**Where:** `public/staircase-renovations/{oak,painted,white,walnut,glass,modern,feature-wall,storage,materials}/`

**Required change:**

- Images remain on disk (no destructive delete — governance rule).
- They are **explicitly labelled illustrative-not-authoritative** in the manifest note block (already partially done at `manifest.json:10`).
- No new image additions are made until Steps 1-6 are locked into code (Stages 1-6 memory → code) and Step 7 (image schema) is designed.
- Adding images before Stage 7 code exists violates the 8-step order and this spec.

## Cluster of changes that DO NOT belong in Stage 1 remediation

To keep this spec surgical, the following are **out of scope** and defer to their own Stage GO LOCKs:

- Stage 2 (MUST REMAIN / MUST CHANGE / MUST NOT CHANGE vocabulary) — `project_nex_refacing_flow_stage2_2026_08_10.md`
- Stage 3 (Contractor Exchange · matching · state machine · escalation) — `project_nex_refacing_flow_stage3_2026_08_10.md`
- Stage 4 (Role-conditional Chat) — `project_nex_refacing_flow_stage4_2026_08_10.md`
- Stage 5 (HQ monitoring signals) — `project_nex_refacing_flow_stage5_2026_08_10.md`
- Stage 6 (event bus + interfaces + Package schema) — `project_nex_refacing_flow_stage6_2026_08_10.md`
- Stage 7 (image schema + role tagging + validator) — `project_nex_refacing_flow_stage7_2026_08_10.md`
- Any NEX Chat integration — blocked by `chat/page.tsx` off-limits rule until the audit runs

The remediation above is the minimum needed to make the CUSTOMER ENTRY surface (Stage 1) doctrinally clean. Everything downstream stays parked.

## Stage 8 GO LOCK checklist (Philip authorisation required before code changes start)

Before any of V1-V8 are implemented, confirm:

- [ ] `NEX CHAT ARCHITECTURE AUDIT` has run (per Stage 3 memory prerequisite for Stage 4, which downstream code depends on)
- [ ] `11-step flow lock` has been confirmed (per Visual System memory Phase 1 gate)
- [ ] Case-store impl chosen: signed cookie vs. Supabase table vs. Postgres table (Stage 8 decision; Stage 1 memory C6 leaves this open)
- [ ] Anonymous-return mechanism chosen: session token vs. magic link vs. account attachment (Stage 1 memory C6 leaves this open)
- [ ] `GO LOCK · REFACING FLOW · STAGE 8` typed by Philip in the session that begins implementation

## Execution order (once Stage 8 gate is passed)

1. **V1** — create `RefacingCaseId` type + `POST /api/nex/refacing/cases` endpoint (no UI change yet)
2. **V5** — add `useRefacingCase()` hook + `caseId` prop to `RenovationsViewer` (still browse-first; Case now persists)
3. **V2** — move contact upsert out of enquiry-create into a separate `attach-contact` transition
4. **V3** — new upload-first entry page at `/nex-app/refacing` (old carousel becomes secondary)
5. **V4** — nav separation copy + boundary marker
6. **V6** — `/your-project/[rf_id]` resume surface
7. **V7** — additive `role_tags[]` field on manifest images (no URL changes)
8. **V8** — no action; discipline (do not add images until Steps 1-6 land in code)

Each of V1-V7 lands as its own PR, each with a passing test that asserts the corresponding Stage 1 clause (e.g. `assert enquiry_id.startsWith("rf_")`).

## Governance

- **This spec is amendable only by re-derivation** from an updated Stage 1 memory lock.
- **This spec does NOT authorise implementation.** Implementation requires the Stage 8 GO LOCK typed by Philip.
- **If a future proposal contradicts this spec AND Stage 1 memory:** default answer is NO. Cite this file.
