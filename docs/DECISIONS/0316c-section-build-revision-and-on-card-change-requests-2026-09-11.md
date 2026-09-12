# ADR-0316c · Section-Build Revision Model + On-Card Change Requests + Preview vs Live Distinction · 🔒 DOCTRINE LOCKED · Phase D.1 (design only)

**Status:** 🔒 DOCTRINE LOCKED · founder-authorised Phase D.1 refinement 2026-09-11 · design only · zero code · zero substrate mutation · Phase D.3 implementation itself remains BLOCKED
**Founder:** Philip · authorised via verbatim "Yes — you are exactly right about the intended workflow. I would make one important wording correction..." 2026-09-11
**Consumes + refines:** ADR-0316b Code-Autonomy Readiness + Section-Build Lifecycle · adds on-card founder communication + revision-per-change-request model · does NOT supersede
**Consumes:** ADR-0316 HQ Consolidation · ADR-0316a HQ Security Agent Design · Work Map v1.1 · file-capability-map · locked-doctrines

**Doctrine version:** `section_build_revision.v1.0.0` · **Applies to:** every future NEX1/NEX2/NEX3/Master AI section-build cycle · every founder change-request event

---

## Section 1 · Founder verbatim authorisation

**Wording correction (locked):**

> *"The page the founder views should be a PREVIEW of the completed build, not the production live page yet."*

**Two-actor Activate Live gate (locked):**

> *"The LIVE button should not simply publish because NEX1 says completed. It should be: NEX1: 'Completed and ready for your review.' Founder: 'I have reviewed it and I'm happy.' System: 'All security/technical gates still pass.' Founder: 'ACTIVATE LIVE.' Then it goes live."*

**Founder-directs-never-codes principle (locked):**

> *"You don't need to personally code the changes. You become the person directing and approving the finished product."*

**On-card change-request model (locked):**

> *"The founder should not need to leave the Work Map to communicate changes. A completed card could have: What would you like changed? [text-box] · 📷 ADD / REPLACE IMAGE · [SEND CHANGES TO NEX1]"*

**Revision-per-change model (locked):**

> *"Every change request should create a new revision, rather than overwriting the previous build. So you have: CAP-120 v1.0 → Founder change → v1.1 → Founder change → v1.2 → APPROVED → LIVE. That gives NEX a complete history and makes rollback extremely clean."*

**Image-upload-as-revision-attachment (locked):**

> *"The image upload should similarly be attached to the change request/revision, not simply replace an image in the database."*

**Work Map role clarification (locked):**

> *"The Work Map becomes the actual Founder ↔ NEX1 development control centre, rather than just a project-status page."*

**Permanent history (locked):**

> *"I would absolutely keep the completed build link permanently on the CAP card, together with the version/build ID, so months later you can see exactly what was built and approved."*

---

## Section 2 · Purpose

Refine and strengthen ADR-0316b in four specific areas · without superseding it:

1. **Preview vs Live wording** — locked as PREVIEW of completed build · NOT production live · never conflated
2. **Revision-per-change model** — every founder change request creates a new revision · never overwrites the previous
3. **On-card change communication** — founder types + attaches images + sends directly from the CAP card · never leaves the Work Map
4. **Founder-directs-never-codes** — founder role locked as director + approver · not implementer

**This ADR authors NO code.** It refines doctrine for the Phase D.3 · D.3.a · D.4 · D.4.a implementations to consume.

---

## Section 3 · Preview vs Live · locked wording distinction

**Wording correction locked (per founder correction):**

> The page the founder views on clicking "View Completed Build" is a **PREVIEW of the completed build** · NOT the production live page yet.

### 3.1 · Why this wording matters

The founder must never be confused about which environment they are viewing:

- **PREVIEW** = the isolated build artifact rendered in the preview environment (per ADR-0316b §5)
- **LIVE** = production · reached only via founder click on Activate Live · which requires all gates green + one-at-a-time verification

### 3.2 · Locked UI vocabulary

Every founder-facing surface must use the following words consistently. Alternative wording is rejected by the Security Agent theme linter (D.3.b):

| Concept | Locked wording | Forbidden alternatives |
|---|---|---|
| The isolated build artifact + its rendering | **"Preview"** · **"Completed Build"** · **"View Preview"** · **"View Completed Build"** | "Live preview" · "Staged version" · "Test page" |
| The production activation | **"Activate Live"** · **"LIVE"** · **"Production"** | "Publish" · "Ship" · "Go" (ambiguous) |
| The current state before activation | **"Completed — Waiting Founder Approval"** | "Ready to ship" · "Ready to go" |
| The founder's action to promote preview to production | **"Activate Live"** (button label) | "Publish" · "Approve to live" · "Go live" |

### 3.3 · Preview URL discipline

- Every preview lives at a URL of the form: `/preview/CAP-XXX/v1.N.N?token=<founder-signed-token>`
- URL is stable across founder sessions (bookmarkable)
- URL is founder-signed · never publicly accessible · never search-indexed
- URL persists after activation (permanent audit link · see §7)
- Preview URLs never live at production route paths (e.g. never overrides `/nex-app` for other users)

---

## Section 4 · Revision-per-change-request model (locked)

**Locked principle (founder-authored):**

> Every change request creates a **new revision**. Never overwrites the previous. Complete history preserved.

### 4.1 · Revision numbering scheme

```
CAP-XXX v1.0 · initial build (NEX1 + team completes)
           ↓
CAP-XXX v1.0 → Founder review → Change request typed
           ↓
CAP-XXX v1.1 · new build addressing v1.0 change request
           ↓
CAP-XXX v1.1 → Founder review → Change request typed
           ↓
CAP-XXX v1.2 · new build addressing v1.1 change request
           ↓
CAP-XXX v1.2 → Founder review → APPROVED
           ↓
Founder clicks Activate Live
           ↓
CAP-XXX v1.2 → LIVE (production)
```

Each revision:
- Has its own build artifact ID (immutable · content-addressed)
- Has its own preview URL (permanent · bookmarkable)
- Has its own Security Agent run ID
- Has its own test results
- Has its own change-request payload (which specific change was requested for THIS revision)
- Has its own founder-review timestamp
- Points to its parent revision (v1.1 → parent v1.0)

### 4.2 · What versioning MUST enforce

- **Immutability**: an authored revision is never rebuilt or modified in place. New change = new revision.
- **Parent trail**: every revision knows its parent · walking back reveals full history
- **Diff clarity**: v1.2 vs v1.1 shows exactly what changed in response to which founder request
- **Rollback**: reverting from v1.2 to v1.1 is a one-click flag flip · v1.1 artifact is still available

### 4.3 · Semantic versioning discipline

- **v1.0 → v1.N**: revision within same feature scope (change requests are UI/wording/layout adjustments)
- **v1.N → v2.0**: MAJOR scope change requires founder-authored ADR (not just a change request)
- **v2.0 → vN.0**: successive major scopes each require their own ADR

Master AI does NOT autonomously choose major versions. Founder decides scope changes.

### 4.4 · Storage discipline

Every revision writes to:

- `nex.build_artifact` — one row per artifact (immutable · content-hash addressed)
- `nex.section_revision` — one row per CAP-XXX version (parent pointer · change_request_id · timestamps)
- `nex.change_request` — one row per founder-typed request (payload · attached image IDs · target CAP-XXX)

These substrates are authored under Phase D.3 (schema migration). None modify existing production tables. All rows carry the `is_pipeline=true` invariant (ADR-0314i §9 anti-competing-substrate).

---

## Section 5 · Image + asset attachment (locked)

**Locked principle (founder-authored):**

> Image uploads are attached to the change request / revision · NOT replacing images in the production database.

### 5.1 · Attachment flow

```
Founder on CAP card
    ↓
Types change request: "Replace hero image with staircase warehouse image"
    ↓
Clicks 📷 ADD / REPLACE IMAGE
    ↓
Uploads image (or selects from existing manifest)
    ↓
Image bound to change_request_id via foreign key
    ↓
Clicks SEND CHANGES TO NEX1
    ↓
NEX1 receives change_request + image reference
    ↓
NEX1 authors new revision (v1.N) referencing the uploaded image
    ↓
Preview shows the new image in the preview environment ONLY
    ↓
Production images unchanged until founder clicks Activate Live on the new revision
    ↓
On activation: image swap happens as part of the artifact promotion
```

### 5.2 · Image manifest compliance

Every uploaded image MUST:

- Land in `data/nex-image-manifest.json` at upload time (per ADR-0024 · locked doctrine DOC-031)
- Carry provenance: `uploaded_by · uploaded_at · change_request_id · target_cap_xxx`
- Never overwrite an existing manifest row · always append new
- Be image-manifest-validated by the Security Agent before the preview build proceeds

### 5.3 · What is forbidden

- ❌ Direct image swap in production DB
- ❌ Image upload that bypasses the manifest
- ❌ Image reused across change requests without explicit founder acknowledgement (each request must attach its own image or reference an existing manifest row)
- ❌ Third-party image copy (per ADR-0022 · locked doctrine DOC-029)

---

## Section 6 · On-card change-request UX (locked)

**Founder-locked card anatomy for the completed-waiting-approval state:**

```
┌─────────────────────────────────────────────┐
│ CAP-XXX · SECTION NAME                      │
│                                             │
│ 🟢 COMPLETED — WAITING FOUNDER APPROVAL     │
│                                             │
│ Build: v1.4.2                               │
│ Security: ✓ PASS                            │
│ Tests: ✓ PASS                               │
│                                             │
│ 🔗 VIEW COMPLETED BUILD                     │
│                                             │
│ ── FOUNDER REVIEW ───────────────────────── │
│                                             │
│ What would you like changed?                │
│ ┌─────────────────────────────────────────┐ │
│ │ Type UI, code, wording or feature       │ │
│ │ changes here...                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 📷 ADD / REPLACE IMAGE                      │
│                                             │
│ [ SEND CHANGES TO NEX1 ]                    │
│                                             │
│              [ 🔒 ACTIVATE LIVE ]           │
└─────────────────────────────────────────────┘
```

### 6.1 · Locked card requirements

- **Build version + Security + Tests status** always visible on the card
- **View Completed Build** link opens preview environment for THIS revision
- **Founder Review text-box** accepts free-form change requests (UI · code · wording · features)
- **Add / Replace Image** button uploads to manifest · binds to change request
- **Send Changes to NEX1** button submits the change-request payload · NEX1/Claude receives as scoped task against THIS CAP-XXX
- **Activate Live** button remains 🔒 locked until:
  - All security/technical gates pass for the CURRENT revision
  - No other capability is in ACTIVATING state (per ADR-0316b §4)
  - Founder has viewed the preview at least once (session-recorded)

### 6.2 · Zero navigation-away rule

**Founder-locked:**

> *"The founder should not need to leave the Work Map to communicate changes."*

The entire change-request loop happens on the CAP card:

- ✅ Text-box for changes on the card
- ✅ Image upload on the card
- ✅ Send button on the card
- ✅ Preview link opens in new tab (founder returns to same card)
- ✅ Response from NEX1/Claude (build progress · new revision ready) surfaces on the card
- ❌ No separate change-request page
- ❌ No email · Slack · external comment thread required
- ❌ No hunting through git history

### 6.3 · Change-request payload structure

Every change-request submission carries:

```
{
  "change_request_id": "uuid",
  "target_cap_xxx": "CAP-120",
  "target_revision": "v1.0",  // what revision the founder was looking at when they typed the request
  "founder_message": "text · verbatim founder request",
  "attached_images": [{"manifest_id", "role"}],
  "submitted_at": "ISO-8601",
  "founder_signature": "session-signed token"
}
```

### 6.4 · Response loop

NEX1 receives the change-request. Under Phase D.4 (delegation integration):

1. NEX1 acknowledges receipt (card shows "🔨 REBUILDING v1.1")
2. NEX1 proposes new code touching CAP-120
3. Security Agent inspects (Phase D.3)
4. Tests + impact-graph siblings run (Phase D.7)
5. New build artifact produced (v1.1)
6. New preview environment provisioned (Phase D.3)
7. Card flips to "🟢 COMPLETED — WAITING FOUNDER APPROVAL" for v1.1
8. Card carries: parent v1.0 · change_request_id · what was addressed
9. Founder reviews · types more if needed · or approves

---

## Section 7 · Founder-directs-never-codes model (locked)

**Founder-locked principle:**

> *"You don't need to personally code the changes. You become the person directing and approving the finished product."*

### 7.1 · Locked founder role in Phase D+

The founder's job in the section-build lifecycle:

- ✅ Author ADRs that establish target architecture + locked doctrine
- ✅ Authorise NEX1 to start building a capability
- ✅ Review completed builds via preview
- ✅ Type change requests · attach images · send to NEX1
- ✅ Approve completed revisions
- ✅ Click Activate Live (final constitutional authority)
- ✅ Emergency Revert (final constitutional authority)
- ✅ Author feedback memories when new discipline emerges

**The founder does NOT need to:**

- ❌ Write code (NEX1 does)
- ❌ Run tests (Security Agent + Test framework does)
- ❌ Provision preview environments (Phase D.3 machinery does)
- ❌ Author build artifacts (deterministic build pipeline does)
- ❌ Track versions (revision-per-change model does)
- ❌ Reconcile impact graphs (Work Map does)
- ❌ Enforce theme rules (Phase D.3.b linter does)
- ❌ Chase down cross-section side effects (Phase D.7 impact-test framework does)

### 7.2 · Scalability implication

This is what makes the model scale. As NEX grows to 200 · 500 · 5000 capabilities:

- Founder still reviews ~10-30 completed cards per day (or delegates approval authority for specific classes via ADR)
- Machinery handles the rest deterministically
- Every activation carries founder signature · every revert carries founder signature · every constitutional amendment carries founder signature

**The bottleneck is the founder's review capacity · not the founder's coding capacity.** Which is the correct place to have the bottleneck.

### 7.3 · What NEX1 gains (compared to Phase A observation-only)

Once Phase D.3 · D.3.a · D.4 land · NEX1 can:

- Propose code changes touching any registered CAP-XXX file
- Author new tests
- Rebuild after founder change requests
- Version each revision cleanly
- Never modify production without founder click

**NEX1 does NOT get an unrestricted write key.** Every proposal passes Security Agent. Every activation passes founder click.

---

## Section 8 · Permanent build history (locked)

**Founder-locked:**

> *"I would absolutely keep the completed build link permanently on the CAP card, together with the version/build ID, so months later you can see exactly what was built and approved."*

### 8.1 · Locked history requirement

Every CAP card maintains a complete revision timeline visible to the founder:

```
CAP-XXX · SECTION NAME · Revision history

  v1.4.2 · LIVE (current)     · activated 2026-09-11 14:22 · build af18c3d2 · [🔗 preview] [audit]
  v1.4.1 · APPROVED           · reverted 2026-09-08 09:11  · build 7a2e91f  · [🔗 preview] [audit]
  v1.4.0 · CHANGE REQUESTED   · request "make cards taller"· build c4d7ea1 · [🔗 preview] [audit]
  v1.3.0 · APPROVED · LIVE    · was live 2026-09-01→09-08  · build 12b45c8 · [🔗 preview] [audit]
  ...
  v1.0.0 · APPROVED · LIVE    · initial build 2026-08-15   · build a99f231 · [🔗 preview] [audit]
```

### 8.2 · Locked audit requirements

Every entry must link to:

- **Preview URL** — the original preview environment for that revision · still viewable months later
- **Audit page** — the full detail: change_request text · founder review timestamp · Security Agent run · test results · impact tests · founder signature at activation · founder signature at revert if applicable
- **Diff view** — what changed between this revision and its parent

### 8.3 · Retention discipline

- Build artifacts retained: **forever** (immutable · content-addressed · space-efficient via deduplication)
- Preview environments retained: **rehydratable-on-demand** (may not run continuously to save resources · but rehydrate in ≤ 60 seconds when founder clicks the historical link)
- Audit records retained: **forever** (append-only to growth ledger · never truncated)
- Change requests retained: **forever** (founder's own words · preserved verbatim)

Retention shortens only via founder-authored ADR.

---

## Section 9 · Card state machine v2 (integrated with revision cycle · refines ADR-0316b §6)

The 8-state lifecycle in ADR-0316b §6 remains valid. This ADR adds the revision cycle overlay:

```
🔨 BUILDING v1.0
     ↓
🧪 TESTING v1.0
     ↓
👁 AWAITING PREVIEW v1.0     [ card shows: v1.0 · Build ID · gates green · Preview link · Founder text-box · Activate 🔒 ]
     ↓
[Founder clicks Preview]
     ↓
🔍 IN REVIEW v1.0            [ same card · session flag set · founder viewing preview ]
     ↓
[Founder types change request + optionally attaches image]
     ↓
[Founder clicks SEND CHANGES TO NEX1]
     ↓
🔁 REQUEST UPDATE v1.0       [ card shows: change_request_id · payload preserved · v1.0 archived as historical entry · new revision v1.1 spawning ]
     ↓
🔨 BUILDING v1.1              [ NEX1 addressing v1.0 change request ]
     ↓
🧪 TESTING v1.1
     ↓
👁 AWAITING PREVIEW v1.1     [ card now shows v1.1 as current · v1.0 in history · preview link points to v1.1 ]
     ↓
[Founder clicks Preview]
     ↓
🔍 IN REVIEW v1.1
     ↓
[Founder can: request more changes → 🔁 REQUEST UPDATE v1.1 → 🔨 BUILDING v1.2 → ...]
[Or: click Approve]
     ↓
✅ APPROVED v1.1              [ Activate Live button unlocked IF no other ACTIVATING + all gates green ]
     ↓
[Founder clicks Activate Live]
     ↓
⏳ ACTIVATING v1.1            [ activation verification gate per ADR-0316b §4.1 · one at a time ]
     ↓
🟢 ACTIVE v1.1                [ live in production · v1.0 preserved in history · Emergency Revert visible ]
```

### 9.1 · Locked concurrency rules for revisions

- Multiple revisions of the SAME CAP-XXX may exist in history (immutable)
- Only ONE revision may be `ACTIVE` per CAP-XXX at any time (the current live version)
- Only ONE revision may be `ACTIVATING` at any time GLOBALLY across all capabilities (per ADR-0316b §4)
- Multiple revisions may be in `BUILDING` · `TESTING` · `AWAITING_PREVIEW` · `REQUEST_UPDATE` states simultaneously across different capabilities

### 9.2 · Emergency revert now revision-aware

When founder clicks Emergency Revert on live v1.4.2:

- Flag flip: production instantly stops serving v1.4.2 · returns to the last previously-approved revision (v1.4.1 or v1.3.0 etc.)
- Card state: `v1.4.2 ⚫ REVERTED` · previous revision (e.g. v1.4.1) becomes `🟢 ACTIVE`
- Growth ledger appends: `reverted_by · reverted_at · reverted_from_version · reverted_to_version · reason`
- Founder can immediately approve a fix (new revision v1.4.3) via the standard flow

---

## Section 10 · The Work Map role · locked as development control centre

**Founder-locked:**

> *"The Work Map becomes the actual Founder ↔ NEX1 development control centre, rather than just a project-status page."*

### 10.1 · Locked capabilities of the Work Map

Beyond ADR-0316b §8 (Master Inventory), the Work Map now serves as:

- **Progress dashboard** — heartbeat on active builds · next-best for growth · retro-benefit red dots (existing v1.1 functionality)
- **Founder review queue** — cards flip to "COMPLETED — WAITING FOUNDER APPROVAL" for founder attention (added in Phase D.4.a)
- **Development control centre** — on-card change requests · image uploads · send-to-NEX1 · Activate Live · Emergency Revert (added in Phase D.4.a + D.3)
- **Historical audit** — permanent revision timeline · preview URLs preserved · full change-request history (added in Phase D.10)
- **Site index for NEX1/2/3** — machine-readable at `/api/nex/work-map` for programmer agents (existing v1.1 functionality)

### 10.2 · The one place for founder interaction

**No other founder-communication surface is authored.** Every change · every review · every approval · every revert happens on the Work Map. This is deliberate:

- Founder never confuses "which app is this in?"
- NEX1 never receives change requests via a channel it doesn't know about
- Security Agent never sees a proposal outside its inspection window
- Growth ledger never misses an audit entry

### 10.3 · Card as the atomic unit

The CAP card is the smallest addressable unit of founder-NEX1 communication. Every action carries CAP-XXX context implicitly. Every response threads back to the card.

---

## Section 11 · Enforcement implications (doctrine · not implemented by this ADR)

- **Every Phase D.3 Security Agent implementation** must produce build artifacts with immutable content-addressed IDs · one per revision · never rebuilt in place
- **Every Phase D.4.a founder-review-queue implementation** must render cards per §6 anatomy · text-box + image-upload + send-button + Activate 🔒 · zero navigation-away
- **Every image upload** must land in `data/nex-image-manifest.json` per ADR-0024 · bound to `change_request_id` per §5
- **Every card must display revision history** per §8.1 · with preview links preserved indefinitely
- **Every state transition** must respect the v2 state machine per §9 · revision-aware · never overwrite
- **Every founder communication** happens on the CAP card · per §10.2 · no side channels
- **Every wording surface** must use the locked vocabulary per §3.2 · Security Agent theme linter (D.3.b) enforces
- **Every capability's public API** must be revision-stable across change requests unless founder-authored major version bump (§4.3)

---

## Section 12 · Sub-phase impact (locked additions to ADR-0316b §10)

This ADR strengthens but does not replace the D.3-D.11 sub-phase plan. Additional locked requirements:

- **D.3** must author: `nex.build_artifact` · `nex.section_revision` · `nex.change_request` schemas · immutable · content-addressed · with `is_pipeline=true` per ADR-0314i §9
- **D.3** must author preview environment provisioning that respects revision numbering (per §4 · §5)
- **D.3.b** (theme linter) must enforce locked vocabulary (§3.2 · "Preview" · "Activate Live" · "Completed — Waiting Founder Approval")
- **D.4.a** (founder review queue) must implement the on-card change-request UX exactly per §6 anatomy · zero navigation-away
- **D.4.a** must implement image-upload attachment binding to `change_request_id` per §5
- **D.4.a** must implement Send Changes to NEX1 endpoint that spawns a scoped delegation task against the target CAP-XXX
- **D.4.a** must implement the revision-aware Emergency Revert per §9.2
- **D.10** must author the growth ledger schema extension that tracks every revision · every change_request · every founder signature · retention-forever

---

## Section 13 · What this ADR did NOT do

- ❌ No code authored
- ❌ No migrations authored
- ❌ No substrate mutation (`nex.*` · `nex_test.*` · `nex_lab_*` · Supabase all frozen)
- ❌ No new tables created (schemas for `nex.build_artifact` · `nex.section_revision` · `nex.change_request` are DEFINED as future D.3 requirements · not created)
- ❌ No preview environment provisioned (Phase D.3)
- ❌ No on-card UI built (Phase D.4.a)
- ❌ No image upload endpoint (Phase D.4.a · ADR-0024 compliance required)
- ❌ No revision-history UI (Phase D.10)
- ❌ No emergency-revert wired (Phase D.4.a)
- ❌ No Work Map JSON modification
- ❌ No file-capability-map modification (mapping for new schemas added in Phase D.9 when they exist)
- ❌ No locked-doctrines modification (new doctrines for revision integrity + change-request payload structure added in Phase D.10)
- ❌ No NEX1 delegation loop change (Phase D.4)
- ❌ No Stage 1a foundation modified
- ❌ No Stage 1b resumption
- ❌ No nex.evidence collision resolution
- ❌ No UI theme rule change (adds locked vocabulary · enforced at D.3.b)
- ❌ No autonomous operation authorised
- ❌ No absolute-safety claim locked (per ADR-0316b §11 · "strong enforced controls" not "impossible to harm")
- ❌ No calendar-time gate authorised (per ADR-0316b §4 · one-at-a-time verification gate)

---

## Section 14 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | Phase D section-build lifecycle refined: (1) preview is PREVIEW of completed build · NEVER conflated with production live; (2) revision-per-change-request model locked (v1.0 → v1.1 → v1.2 → APPROVED · never overwrite); (3) image uploads bind to change_request_id · never replace production DB assets directly; (4) on-card change-request UX locked (text-box + image upload + send button + Activate 🔒 · founder never leaves Work Map); (5) permanent revision history · preview URLs preserved forever · rehydratable-on-demand; (6) founder-directs-never-codes principle locked · founder becomes reviewer/approver not implementer; (7) locked UI vocabulary (Preview · Completed Build · Activate Live · Completed — Waiting Founder Approval). Work Map is now the canonical Founder ↔ NEX1 development control centre. |
| **Decided by** | Philip |
| **Decision date** | 2026-09-11 |
| **ADR** | 0316c · this file · refines ADR-0316b · consumed by Phase D.3 · D.3.b · D.4.a · D.10 implementation ADRs · every future NEX1/2/3 section-build cycle |
| **Effective from** | `section_build_revision.v1.0.0` |
| **Supersedes** | none · refines ADR-0316b without replacing it |
| **Reason** | Founder verbatim (2026-09-11): preview must never be confused with production live · revisions preserve complete history for clean rollback · on-card founder communication removes friction and scales · founder role is direct + approve not code + implement · Work Map becomes the actual development control centre. |

---

## Section 15 · Cross-references

**Consumed by (future ADRs):**
- Phase D.3 Security Agent implementation (build artifact + revision schema)
- Phase D.3.b theme linter (locked vocabulary enforcement)
- Phase D.4 NEX1 delegation integration (change-request payload consumption)
- Phase D.4.a founder review queue (on-card UX)
- Phase D.10 strength-delta + retro-benefit tracking (revision-aware growth ledger)
- Every future capability revision authored by NEX1/NEX2/NEX3
- Every future founder change request

**Consumes:**
- ADR-0316b Code-Autonomy Readiness + Section-Build Lifecycle (refined here · not superseded)
- ADR-0316 HQ Consolidation Target Architecture
- ADR-0316a HQ Security Agent Design
- ADR-0314f Guardian Responsibility Reconciliation
- ADR-0314i Stage 1b Founder Decisions (§9 anti-competing-substrate · applies to new pipeline schemas)
- ADR-0024 Image Manifest doctrine
- Work Map v1.1
- File-capability-map v1.0.0
- Locked-doctrines v1.0.0

**Referenced by future candidate slots:**
- ADR-0316d Preview Environment Provisioning (D.3 implementation doctrine)
- ADR-0316e On-Card Change-Request Payload Schema (D.4.a implementation doctrine)
- ADR-0316f Emergency Revert Protocol (D.4.a implementation doctrine)

---

## Section 16 · Master AI STOPS · awaiting founder review

**Master AI does NOT autonomously proceed to Phase D.3 · D.3.a · D.3.b · D.4 · D.4.a · D.5 · D.6 · D.7 · D.8 · D.9 · D.10 · D.11.** Each sub-phase requires separate founder authorisation.

**Master AI does NOT autonomously resume Stage 1b implementation.** The nex.evidence collision remains parallel unresolved (task #161).

**Current position after ADR-0316c:**

- Phase A · Stage 1a · 🟢 COMPLETE
- Phase B · Guardian reconciliation (3-way) · 🟢 LOCKED
- Phase C · Acquisition Fabric · 🟢 LOCKED
- Stage 1b Wiring + Founder Decisions · 🟢 LOCKED · apply halted at nex.evidence collision
- Work Map v1.1 · 🟢 ACTIVE
- Phase D.1 · HQ Consolidation Target · 🟢 LOCKED (ADR-0316)
- Phase D.1 · Security Agent Design · 🟢 LOCKED (ADR-0316a)
- Phase D.2 · registries authored · 🟢 SHIPPED
- Phase D.1 · Code-Autonomy + Lifecycle · 🟢 LOCKED (ADR-0316b)
- **Phase D.1 · Section-Build Revision + On-Card Change Requests · 🟢 LOCKED (this ADR · ADR-0316c)**
- Phase D.3 · D.3.a · D.3.b · D.4 · D.4.a · D.5 · D.6 · D.7 · D.8 · D.9 · D.10 · D.11 · 🔴 BLOCKED pending own founder authorisation

**Substrate posture:** unchanged · everything frozen · Gate 3 remains OPEN · Stage 1a foundation preserved · Lab-Guardian ledger preserved · specialist tables preserved · nex.evidence collision preserved.

**Founder decision points now open:**

1. Approve ADR-0316c as locked doctrine (this ADR complete)
2. Direct nex.evidence collision resolution (separate track · task #161)
3. Authorise Phase D.3 (Security Agent implementation) as next code-authoring sub-phase
4. Or select any single sub-phase D.3.a · D.3.b · D.4 · D.4.a · D.7 · D.8 · D.9 · D.10 · D.11 for authoring
5. Master AI does not choose order

---

**End of ADR-0316c · Section-Build Revision Model + On-Card Change Requests + Preview vs Live Distinction · doctrine locked · every sub-phase implementation remains BLOCKED pending founder authorisation.**
