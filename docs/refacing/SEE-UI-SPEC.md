# NEX Refacing · SEE UI Specification (SHOW → FEEL → SEE → LOCK)

**Purpose:** implementation specification for the next homeowner-facing Refacing experience — the pipeline from photo upload through direction selection.
**Written:** 2026-08-12 · after Stage 8 QA-FIX LOCK accepted.
**Status:** SPECIFICATION ONLY · NOT authorised to implement · awaiting Philip's typed `SEE UI · GO LOCK · AUTHORISED`.
**Authority chain:** implements the SHOW/FEEL/SEE/LOCK verbs from `project_nex_refacing_architecture_v2_2026_08_12.md` (LOCKED) · consumes retrieval + case-store from `docs/refacing/PR-12-EXECUTION-SPEC.md` · builds on the V1-V8 remediation completed in Stage 8.

---

## Position

Stage 8 built the foundation: schema · validators · case store · upload-first entry (`/nex-app/refacing`) · resume surface (`/your-project/[rf_id]`). What's missing is the middle of the pipeline: after the customer uploads a staircase and before a Refacing Member is contacted. This spec defines that middle.

Concretely, this spec covers the surfaces that render between:

- **After** the customer taps upload on `/nex-app/refacing` and the photo attaches successfully (status = `BASE_UPLOADED`)
- **Before** the customer taps "Request a professional assessment" (which transitions to `READY_FOR_ASSESSMENT` and eventually to CONNECT)

## The one sentence this spec exists to enforce

> **The customer sees their own staircase transformed into a small number of complete design directions, each one composed from real reference imagery in the NEX library. NEX never invents a component that isn't in the library.**

## Non-goals (LOCKED)

- ❌ NO open-ended generative AI image synthesis (violates PR-18 · the "banana handrail" prevention)
- ❌ NO component-picker / configurator as the primary interaction (violates PR-2)
- ❌ NO homeowner pricing (violates PR-13)
- ❌ NO NEX-attributed quotes (violates PR-13)
- ❌ NO surfacing of internal taxonomy · confidence markers · image_ids · case IDs · membership tiers (violates PR-11)
- ❌ NO downstream stage implementation (CONNECT / SURVEY / QUOTE / CONTRACT stay future GO LOCKs)
- ❌ NO Trade Exchange changes
- ❌ NO admin tagger UI (PR-12 workflow is a separate future spec)
- ❌ NO changes to the Stage 8 files (they're stable · this spec adds new surfaces alongside them)

## Doctrinal authority chain (read in order before implementing)

1. `docs/refacing/STAGE-1-REMEDIATION-SPEC.md` — the target journey
2. `docs/refacing/PR-12-EXECUTION-SPEC.md` — image intelligence schema + retrieval + provenance
3. Auto-memory `project_nex_refacing_architecture_v2_2026_08_12.md` — 18 PRs · 9-verb pipeline · Refacing Case structure · flight-based geometry · truthfulness contract
4. Auto-memory `project_nex_refacing_trade_exchange_2026_08_10.md` — commercial model + Truth-Law
5. This spec

---

## Section A · SHOW · Photo Understanding

### A.1 · What triggers SHOW

After a successful `POST /api/nex/refacing/cases/[rf_id]/attach-photo` response, the customer is redirected to `/nex-app/refacing/your-project/[rf_id]`. The existing Stage 8 `YourProjectView` already renders a resume view — SHOW is a **new panel that opens as soon as the case has status `BASE_UPLOADED`** and no `visible_components` yet.

### A.2 · Screen sequence

```
[customer arrives at /your-project/[rf_id] after upload]
                      │
                      ▼
        ┌──────────────────────────┐
        │   Your existing staircase │
        │   [photo · large]         │
        └──────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────┐
        │   Here's what we can see  │
        │   ✓ 12 visible treads     │
        │   ✓ Painted risers        │
        │   ✓ Timber handrail       │
        │   ✓ Turned balusters      │
        └──────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────┐
        │   A few things can't be   │
        │   confirmed from a photo  │
        │   · exact dimensions      │
        │   · precise timber species│
        │   · structural condition  │
        │   These will be confirmed │
        │   during survey.          │
        └──────────────────────────┘
                      │
                      ▼
        [ Looks right ] [ Something's off ]
                      │
                      ▼
        proceed to FEEL           correction UI (A.5)
```

### A.3 · Copy patterns (LOCKED verbatim per PR-16 truthfulness contract)

**Panel 1 · Title:**
> Your existing staircase

**Panel 2 · Title:**
> Here's what we can see

**Panel 2 · Items:** rendered from `existing_staircase.visible_components[]`. Each item's copy is derived from `component_role` via the existing `friendlyRole()` map in `YourProjectView.tsx`, extended with:
- `whole_staircase` → "Full staircase in view"
- `feature_step` → "Feature step visible (curved/bullnose)"
- Anything else → falls through to homeowner-friendly per-role labels (never render the raw enum)

**Panel 3 · Title:**
> A few things can't be confirmed from a photo

**Panel 3 · Items:** rendered from `unknown_items[]`. Copy already exists in `attach-photo/route.ts` (dimensions · species · structural). May be extended per case complexity but always in plain language.

**Panel 3 · Footer:**
> A local staircase professional will confirm these during survey.

**Actions:**
- Primary: `[ Looks right ]` (dark filled button)
- Secondary: `[ Something's off ]` (outline button)

### A.4 · What NEX MAY infer at SHOW (per PR-16)

Populated by the Brain during a background analysis job triggered by `attach-photo` completion. The job writes to `case.existing_staircase.visible_components[]` and `case.existing_staircase.visible_geometry`:

- Geometry `configuration` (with `configuration_confidence`)
- Per-flight `visible_tread_count` (with per-flight `_confidence`)
- Per-flight `orientation` (with `_confidence`)
- `overall_shape.string_type` and `.riser_openness` (with `_confidence`)
- Per-role component presence: baluster · newel · handrail · tread · riser (each with `component_role_confidence`)

All confidence values default to `inferred` at ingestion. Never `observed` from photo-only evidence per PR-16 field-naming rule.

### A.5 · Correction UI on `[ Something's off ]`

Progressive-disclosure sheet. Never a full form. Homeowner taps chips to correct:

- `Add / remove component` — checkbox list of the 12 `COMPONENT_ROLES` (rendered with friendly labels · never the enum). Adding sets confidence to `inferred` with `customer_asserted: true`. Removing marks the component as `not_visible_in_photo`.
- `Adjust step count` — per-flight ± controls. Updates `visible_tread_count`. Sets `visible_tread_count_confidence` to `inferred` with `customer_asserted: true`.
- `Redo photo` — reopens the upload widget from `RefacingEntry`. Adds a new BasePhoto to `existing_staircase.photos[]` and re-triggers analysis. Never deletes the previous photo (per Refacing Case history immutability).

Case status remains `BASE_UPLOADED`. FEEL becomes available only after `[ Looks right ]` OR after all correction operations settle and the customer taps "Continue" from the correction UI.

### A.6 · Status transitions from SHOW

| Action | Status transition |
|---|---|
| `[ Looks right ]` | `BASE_UPLOADED` → `BASE_CONFIRMED` (NEW status · add to `CASE_STATUSES`) |
| `[ Something's off ]` → correct → Continue | `BASE_UPLOADED` → `BASE_CONFIRMED` (same terminal state) |
| Redo photo | Status stays `BASE_UPLOADED` · new photo appended |

**New status required:** `BASE_CONFIRMED`. Add to `case-schema.ts` `CASE_STATUSES` array (source-of-truth). Homeowner label (via `homeownerStatusLabel`): `"Photo confirmed"`.

---

## Section B · FEEL · Intent Capture

### B.1 · When FEEL runs

Only when `case.status === "BASE_CONFIRMED"`. Case advances to `INTENT_DEFINED` at the end.

### B.2 · Screen sequence (max 3 questions · locked ceiling per PR-2 spirit)

**Screen B-1 · The feeling question (required · single screen)**

Title: *"How would you like your staircase to feel?"*
Subtitle: *"Pick as many as you like."*

Six visual tiles (icon + label · multi-select):
- More modern
- More natural
- More elegant
- More dramatic
- More open
- Not sure yet

Tapping "Not sure yet" clears the other selections and disables them. Any other tap clears "Not sure yet". Multi-select otherwise.

**Screen B-2 · Preserve question (conditional · skip if "Not sure" chosen · skip if photo did not identify any candidate MUST_REMAIN components)**

Title: *"Anything you'd definitely like to keep?"*
Subtitle: *"Tap what should stay as-is."*

Tiles rendered from `existing_staircase.visible_components[]` filtered to items that are typical MUST_REMAIN candidates:
- Newel post (if visible)
- Handrail (if visible)
- Existing carpet runner (if visible)
- Existing wall panelling (if visible)

Plus a `Nothing — start fresh` tile.

Each selection creates an `IntentEntry` with `treatment: "MUST_NOT_CHANGE"` and `customer_confirmed: true`. `"Nothing — start fresh"` creates no entries.

**Screen B-3 · Optional refinement (conditional · skip in MVP)**

Not built in MVP. Reserved for future — questions like "What's the mood of your hallway?" for style-vector refinement. This spec doesn't authorise Screen B-3 yet — flagged for a future SEE-v2 spec if evidence supports it.

### B.3 · What gets written to the Case at FEEL exit

```json
{
  "customer_intent": {
    "feelings": ["more-modern", "more-natural"],
    "transformation_scope": null,
    "intent_entries": [
      {
        "item": "newel",
        "treatment": "MUST_NOT_CHANGE",
        "customer_confirmed": true
      }
    ]
  }
}
```

Case status advances: `BASE_CONFIRMED` → `INTENT_DEFINED`.

Homeowner status label: `"You've told NEX what you want"` — align with existing `homeownerStatusLabel` map.

### B.4 · What FEEL does NOT ask

- Material questions ("Wood / metal / glass?") — Brain derives from feelings + BASE + preserve constraints
- Style keywords ("Modern / traditional?") — inferred, not asked
- Budget / price
- Measurements
- Regulations
- Anything requiring staircase terminology

### B.5 · Copy patterns (LOCKED)

The six feeling values are the exact locked strings from architecture memory. The tile labels use hyphen-free rendering: `More modern` · `More natural` · `More elegant` · `More dramatic` · `More open` · `Not sure yet`.

---

## Section C · SEE · Design Directions

### C.1 · When SEE runs

When `case.status === "INTENT_DEFINED"`. Case advances to `CONCEPT_READY` on render, then to `DESIGN_SELECTED` when the customer picks one direction and to `READY_FOR_ASSESSMENT` when they confirm at LOCK.

### C.2 · Retrieval mechanism

Server-side query on the `images_v3[]` library using `retrieveSeeDirections()` from `src/lib/nex/refacing/retrieval.ts`. Input query object built at the API-route level from the Case:

```typescript
const query: SeeQuery = {
  feelings: case.customer_intent.feelings,
  style_preferences: mapFeelingsToStyles(case.customer_intent.feelings),
  mood_preferences: mapFeelingsToMoods(case.customer_intent.feelings),
  must_not_change_component_roles: case.customer_intent.intent_entries
    .filter(e => e.treatment === "MUST_NOT_CHANGE")
    .map(e => componentRoleFromItem(e.item))
    .filter(Boolean),
  material_family_hint: inferMaterialFamilyHint(case.customer_intent.feelings),
};

const directions = retrieveSeeDirections(await loadImagesV3(), query);
```

`mapFeelingsToStyles` / `mapFeelingsToMoods` / `inferMaterialFamilyHint` are three new pure functions in a new file `src/lib/nex/refacing/feeling-map.ts` (NEW). Locked mapping:

| Feeling | Style hints | Mood hints | Material hint |
|---|---|---|---|
| more-modern | modern, minimal | restrained, airy | (none · Brain picks) |
| more-natural | warm-natural, classic | cosy, restrained | wood |
| more-elegant | classic, luxury, traditional | restrained, understated | (none) |
| more-dramatic | signature, industrial | bold, dramatic | (none) |
| more-open | modern, minimal | airy | glass |
| not-sure-yet | (all styles) | (all moods) | (none) |

Multi-select feelings union the hints. Empty results → widen (drop mood constraint first, then style).

### C.3 · Presentation

**MVP composition mechanism (LOCKED · Phase A):** side-by-side reference presentation. No masked overlay. No AI generation. The customer's BASE photo is shown on its own, and each retrieved direction is shown as a curated Reference Library whole-staircase hero photo alongside it.

Per direction card (there will be 2-4 cards from `retrieveSeeDirections`):

```
┌──────────────────────────────┐
│ [Reference Library hero photo]│   ← from images_v3[] · role=whole_staircase
│                              │   OR role=in_situ_room
│                              │
├──────────────────────────────┤
│ SAFE CENTRE                  │  ← direction name (locked copy)
│ A clean modern look          │  ← reason_for_existing (locked)
│ Oak + simple black balustrade│  ← key_materials_description
│                              │
│ [ See this on my staircase ] │  ← primary CTA on the card
└──────────────────────────────┘
```

**Above the direction cards:** the customer's BASE photo remains anchored (either sticky at top on mobile, or in a persistent left column on desktop). The customer never loses sight of what they started with.

**Below the direction cards:** the Save & Share block (see Section E).

### C.4 · Design card copy (LOCKED per architecture memory)

Direction names + reason-for-existing + material description all render from the `SeeDirection` returned by `retrieveSeeDirections`. Copy pattern LOCKED per architecture memory:

```
[NAME IN CAPS]
For [reason for existing · one line]
[Key materials · one line]
```

NO price line. NO "from £X" affordance anywhere. Ever.

### C.5 · Provenance (PR-18 · absolute)

Every card renders from a single `hero_image` (a real `ImagesV3Entry`). The direction's `reference_image_ids[]` currently contains just the hero's `image_id`. As the customer refines (Section E), additional component swap-image_ids may join the array — always tracking to real library entries. Cards where the retrieval couldn't populate `reference_image_ids` are never rendered.

### C.6 · Explicit rejection of generative approaches

**BANNED for MVP AND permanently:**
- Prompting a general-purpose AI image model to synthesise a staircase
- Prompting a general-purpose AI image model to synthesise a component
- Any pipeline that produces a rendered pixel not derivable from an existing library entry

**RETRACTED as a homeowner-MVP direction (Philip 2026-08-12 · PR-19):**
A future "compositing overlay onto customer photo" experience is NOT on the product roadmap. NEX does not visually modify the homeowner's photograph. If NEX ever pursues a genuine "show my actual staircase transformed" experience, it will require a dedicated PROFESSIONAL-CAPTURE workflow (controlled photography · reliable geometry · known scale) and its own separate spec + separate GO LOCK. The retracted SEE-COMPOSITE-SPEC.md preserves the technical analysis as reference only.

### C.7 · What "See this on my staircase" does

Locked interaction for MVP · Phase A:

Tapping the card CTA does NOT masked-overlay onto BASE. Instead, the customer is taken to a full-screen comparison view:

```
┌──────────────────────────────┐
│    YOUR STAIRCASE            │
│    [BASE photo · large]      │
├──────────────────────────────┤
│    THIS DIRECTION            │
│    [Reference hero · large]  │
├──────────────────────────────┤
│    WHY THIS WORKS            │
│    · Preserves your newel    │  (bullets derived from `must_not_change_component_roles` + design's `material_composition` overlap)
│    · Oak treads + white risers│
│    · Black metal balusters   │
│                              │
│ [ Choose this direction ]    │  ← primary
│ [ See something different ]  │  ← secondary · returns to grid
└──────────────────────────────┘
```

Copy pattern for WHY THIS WORKS bullets is generated from the intersection of the customer's intent (MUST_NOT_CHANGE + feelings) and the direction's tags. Never invented.

---

## Section D · Design Composition · Mechanism (LOCKED)

### D.1 · The four artefacts (distinct at all times)

| Artefact | What it is | Where it lives | Homeowner sees? |
|---|---|---|---|
| **Original staircase photograph** | BASE photo uploaded by customer | `existing_staircase.photos[]` on the Case · file at `data/refacing-cases/uploads/[rf_id]/[image_id].[ext]` | YES · anchored throughout SEE |
| **Reference Library component imagery** | Individual `images_v3[]` entries with `component_role` = baluster/newel/handrail/tread/riser/etc. | `data/staircase-renovations/images_v3[]` + file at `public/staircase-renovations/...` | Only via curated direction cards (never a raw catalogue) |
| **Retrieved design direction** | The `SeeDirection` object returned by `retrieveSeeDirections()` · hero image + provenance + reason copy | In-memory during the SEE render · never persisted unless the customer selects it | YES · as a card |
| **Composed design presentation** | The visual arrangement of the direction card · side-by-side reference presentation · HTML/CSS · not persisted as an image · Phase B compositing onto customer photo is RETRACTED per PR-19 | HTML/CSS layout · never a modified customer photograph | YES · as the interactive card + comparison view |

**Never merge these four.** Never let a "composed design presentation" carry pixels that don't trace back to either the original photograph OR a specific `images_v3[]` entry.

### D.2 · Phase A · MVP composition (LOCKED)

**Side-by-side reference presentation.**

No pixel composition. The customer sees their BASE photo AND a curated Reference Library hero AND textual reasoning. That IS the composition. It's honest, cheap to build, and doctrinally clean.

Provenance is trivial:
- BASE photo: `existing_staircase.photos[].image_id`
- Direction: `reference_image_ids[]` on the `SeeDirection` (populated by retrieval)

No compositor engine. No segmentation. No masks. No rendering pipeline.

**Why Phase A is enough for MVP:** interior-design research (per the earlier research report) shows customers respond well to "here's what you have · here's what it could be" as long as the "what it could be" is a coherent completed design shown in context (a real staircase, not a component grid). Havenly does this. IKEA room-set catalogues do this. It works.

### D.3 · Phase B compositing · RETRACTED per PR-19 (Philip 2026-08-12)

Only pursue if Phase A conversion data proves the customer wants pixel-level "on my staircase" preview. Do not build speculatively.

If pursued, the mechanism must be:
1. Server-side segmentation on BASE photo (identify tread region · riser region · balustrade region · newel region). Segmentation model is deterministic and constrained.
2. Retrieve component images from `images_v3[]` with pre-computed transparent-background renders (this is a library-tagging concern, not a UI concern · would need a separate library-image pipeline).
3. Perspective-correct overlay onto BASE regions.
4. Emit a composite PNG with metadata: `composition_provenance[]` per PR-18.

**BANNED for the homeowner-MVP surface (and BANNED for any future professional-capture workflow):**
- Prompt-to-image models (Stable Diffusion / DALL-E / Midjourney / etc.)
- Any component that isn't a real library image
- Any "style transfer" that hallucinates finish/colour details not present in the source

### D.4 · Provenance is written at LOCK (F), not at SEE render

During SEE, the direction is transient. `composition_provenance[]` on the Case is populated ONLY when the customer taps `[ Choose this direction ]` at F.

---

## Section E · Homeowner Interaction

### E.1 · Primary CTAs per screen

| Screen | Primary CTA | Effect |
|---|---|---|
| SHOW (Section A) | `[ Looks right ]` | Advance to FEEL |
| FEEL Screen B-1 | `[ Continue ]` (only enabled after ≥1 tile chosen) | Advance to FEEL B-2 (if candidates exist) or straight to SEE |
| FEEL Screen B-2 | `[ Continue ]` (always enabled · "Nothing — start fresh" is valid) | Advance to SEE |
| SEE grid | (no page-level CTA · card CTAs handle direction picks) | — |
| SEE card | `[ See this on my staircase ]` | Open comparison view |
| SEE comparison | `[ Choose this direction ]` | Advance to LOCK (F) |

### E.2 · Secondary CTAs

| Screen | Secondary | Effect |
|---|---|---|
| SHOW | `[ Something's off ]` | Open correction UI (A.5) |
| FEEL B-1 | `[ Skip · not sure ]` (redundant with "Not sure yet" tile · keep only the tile) | — |
| FEEL B-2 | `[ Skip ]` | Advance to SEE with no MUST_NOT_CHANGE entries |
| SEE grid | (each card has quiet `[ Save this ]` icon-button · adds direction to saved-directions on the Case without picking) | — |
| SEE comparison | `[ See something different ]` | Return to SEE grid |

### E.3 · Save & Share (LOCKED per PR-3 · placed between SEE and LOCK)

**Placement:** immediately below the SEE grid · always visible.

**Copy (verbatim per architecture memory):**
```
Save your staircase ideas

[ Save for later ]  [ Share with your partner ]  [ Continue without saving ]
```

**Behaviour:**
- `[ Save for later ]` — saves the current SEE state (all rendered directions with their `reference_image_ids[]`) to `case.saved_directions[]` (new field · see F.3). No account required. If the customer has provided a magic-link email destination in a light modal, NEX also sends the email. If not, the save is anchored via the existing `anonymous_return_token`.
- `[ Share with your partner ]` — opens the browser share sheet with the resume URL `/nex-app/refacing/your-project/[rf_id]` + a homeowner-friendly title/text. The recipient lands on the same Case with the same designs. Never a Case ID visible in the URL — see follow-up flagged in QA report.
- `[ Continue without saving ]` — dismisses the save block for the current session. Does not delete anything.

### E.4 · Go back

Every screen has a top-left `←` icon button. On:
- SHOW → returns to `/nex-app/refacing` (upload surface)
- FEEL → returns to SHOW (with the confirmed BASE preserved · never re-runs analysis)
- SEE → returns to FEEL (with the customer's feelings preserved · never re-runs retrieval unless feelings change)
- SEE comparison → returns to SEE grid

### E.5 · Change direction (after choosing)

The comparison view is reversible until the customer taps `[ Choose this direction ]`. After the choice is made, the customer can still return to SEE grid via a `[ Change direction ]` action on the LOCK screen. This re-transitions Case status: `DESIGN_SELECTED` → `INTENT_DEFINED` → SEE re-renders. `composition_provenance[]` is cleared to prevent stale provenance leaking.

### E.6 · Continue to LOCK

At the comparison view, `[ Choose this direction ]` writes the SelectedDesign to the Case (see F). Case status: `CONCEPT_READY` → `DESIGN_SELECTED`. The customer is taken to a LOCK confirmation screen (see F.5).

---

## Section F · LOCK · What Gets Written

### F.1 · Case fields populated at LOCK

When the customer taps `[ Choose this direction ]`:

```typescript
case.selected_design = {
  direction: <SafeCentre | WarmCharacter | StretchStatement | Custom>,
  name: <SeeDirection.suggested_name>,
  reason_for_existing: <SeeDirection.reason_for_existing>,
  key_materials_description: <SeeDirection.key_materials_description>,
  canonical_profile_ids: <hero image's canonical_profile_ids>,
  canonical_profile_ids_confidence: <hero's confidence · propagated>,
  style: <hero's style>,
  mood: <hero's mood>,
  material_composition: <hero's material_composition · deep-copied>,
  visualisation_image_id: undefined,  // Phase A · no composite exists
  reference_image_ids: <SeeDirection.reference_image_ids>,
  component_selections: <derived from hero's material_composition · one per component_role>,
};

case.composition_provenance = case.selected_design.component_selections.map(cs => ({
  component_role: cs.component_role,
  image_id: cs.image_id,
  source: "reference_library",
}));

case.requested_work = {
  areas: <derived from hero's component_selections · areas NEX plans to touch>,
  quote_requirement: "supply_plus_installation",  // default · overridable in later stage
};

case.status = "DESIGN_SELECTED";
```

Validators run on write (per Stage 8 case-store):
- PR-16 · every field has confidence markers OR is on an exempt path
- PR-13 · no NEX-attributed price fields present (they aren't · this pipeline never adds them)
- PR-18 · every claimed `component_selections[].component_role` has a matching `composition_provenance[]` entry pointing to a known `image_id` in `images_v3[]`

Any validation failure = the write fails, the customer stays on the SEE comparison view, an honest error surface is shown ("Something's off with this design · try another"). No silent fallback.

### F.2 · New `saved_directions[]` field (schema addition · minimal)

For E.3 · Save & Share, add to `RefacingCase`:

```typescript
saved_directions?: Array<{
  direction: DesignDirection;
  name: string;
  reason_for_existing: string;
  key_materials_description: string;
  reference_image_ids: string[];
  saved_at: string;
}>;
```

Non-doctrinal · additive · does not affect PR-16 (no observable attributes) or PR-18 (not a composed design commitment).

### F.3 · LOCK confirmation screen (F.5 · what the customer sees after choosing)

```
┌──────────────────────────────┐
│    YOU'VE CHOSEN             │
│    [Hero image · large]      │
│                              │
│    WARM CHARACTER            │
│    For a warmer, more natural│
│    home                      │
│    Oak + softer detailing    │
│    + black metal             │
├──────────────────────────────┤
│    WHAT NEX WILL SEND        │
│    A local staircase         │
│    professional will receive:│
│    · Your existing staircase │
│      (photos + notes)        │
│    · What you'd like to      │
│      change                  │
│    · The design direction    │
│      you chose               │
│    · What still needs        │
│      surveying               │
├──────────────────────────────┤
│ [ Request professional       │
│   assessment ]               │
│                              │
│ [ Change direction ]         │
│   (secondary link)           │
└──────────────────────────────┘
```

Tapping `[ Request professional assessment ]` opens the contact-attach modal (already built in Stage 8: `attach-contact` endpoint). Status transitions `DESIGN_SELECTED` → `READY_FOR_ASSESSMENT`. That's the boundary between homeowner-side (SHOW → FEEL → SEE → LOCK) and downstream (CONNECT · out of scope for this spec).

### F.4 · What's in the Case for a professional to act upon

When `case.status === "READY_FOR_ASSESSMENT"`, the Refacing Case contains:

- `existing_staircase.photos[]` — BASE image(s) uploaded by the customer
- `existing_staircase.visible_components[]` — customer-confirmed observations with confidence markers
- `existing_staircase.visible_geometry` — per-flight structure with confidence
- `customer_intent.feelings[]` — the 1-6 feeling tags they picked
- `customer_intent.intent_entries[]` — MUST_NOT_CHANGE items with `customer_confirmed: true`
- `selected_design` — full direction + composition
- `composition_provenance[]` — every visible element traces to a library `image_id`
- `unknown_items[]` — the honest list of what can't be confirmed from a photo (PR-16)
- `contact` — populated at attach-contact

That's the complete artefact the Member receives at CONNECT. See PR-14.

---

## Section G · Mobile UI · Mobile-First Design (320 / 360 / 390 → then desktop)

### G.1 · Layout constraints

Baseline: `w-full max-w-md mx-auto overflow-x-hidden` on every top-level screen container (matches Stage 8 QA-FIX pattern). All content sits inside this responsive column. Desktop naturally centers.

### G.2 · Screen-by-screen mobile spec

**SHOW screen:**
- Full-width BASE photo · aspect-ratio preserved (typical staircase photo is 3:4 or 4:5)
- `object-contain` on a cream/neutral backdrop (matches parent shell)
- Below photo: stacked panels ("Here's what we can see" · "A few things can't be confirmed") · each 16px vertical rhythm
- Sticky bottom action bar with `[ Looks right ]` (dark filled · full-width minus 32px padding) and `[ Something's off ]` (outline · smaller · below or beside)
- Bottom nav (parent shell) hides during this screen to give the actions visual priority

**FEEL B-1:**
- Six tiles in 2-column grid on mobile (3-column on desktop)
- Each tile: 96px min-height · icon (32px) · label (12px semibold · centered)
- Tapped state: cream fill + accent border
- Sticky bottom `[ Continue ]` (disabled until ≥1 selected · animates in on first tap)

**FEEL B-2:**
- Preserve tiles rendered from visible components · 1-column stacked list (each row: icon + label + short "seen in your photo" caption)
- Tapping toggles selection · visible tick affordance
- Sticky bottom `[ Continue ]` (always enabled)

**SEE grid:**
- BASE photo pinned at top · sticky as customer scrolls · shrinks to ~120px height as they scroll past
- Below: direction cards stacked · one per row on mobile
- Each card: full-width hero image (16:9) + text block + `[ See this on my staircase ]` CTA
- Save & Share block at bottom · sticky footer treatment on mobile

**SEE comparison:**
- BASE photo on top (full-width) · Reference hero below (full-width) · separator line between
- Text block below the two images with "WHY THIS WORKS" bullets
- Sticky bottom bar: `[ Choose this direction ]` primary · `[ See something different ]` secondary

**LOCK confirmation:**
- Hero image (16:9 full-width)
- Direction name + reason + materials
- "WHAT NEX WILL SEND" bullet list
- `[ Request professional assessment ]` sticky primary
- `[ Change direction ]` quiet secondary link below

### G.3 · Typography (per NEX Design Language v1.1)

- H1 · 22px semibold · leading-tight
- H2 (section titles) · 18px semibold
- Body · 14px regular · leading-snug
- Small · 12px regular · neutral-500
- Chip · 10px semibold uppercase tracking-widest · accent-500

Never hardcode font-size in px if the existing token system supports it. Prefer the same inline `text-[Npx]` pattern the existing Stage 8 components use.

### G.4 · Colour tokens

Use only the tokens defined in `src/app/nex-app/nex-app.css`:
- `--nex-cream` · `--nex-cream-elev` for backgrounds
- `--nex-neutral-*` for text
- `--nex-accent-500` (orange) for primary CTAs and selection states
- `--nex-neutral-900` for dark filled buttons

No new tokens. If a colour need arises that isn't covered, escalate — don't invent.

### G.5 · Motion

Reuse Stage 8 patterns:
- `framer-motion` for panel enter/exit (240ms · `[0.16, 1, 0.3, 1]` easing)
- Chip/tile tap feedback: `active:scale-95`
- Screen transitions: fade + horizontal slide (240ms) for forward/back nav

### G.6 · Touch targets

Minimum 44×44px per WCAG 2.5.5. All interactive elements verified at 320px viewport.

---

## Section H · Empty / Failure States

### H.1 · Governing principle (LOCKED)

> **"We don't have that direction available yet."**

Never invent a direction. Never fill an empty slot with a generic AI staircase. Never show a "coming soon" placeholder that pretends more content exists than does.

### H.2 · Per-failure surface

**H.2.a · No suitable Reference Library direction exists**
(Retrieval widening exhausted · zero cards)

Copy:
> We don't have a design direction that matches what you're looking for yet.
> Our library is growing every week.
> Here's what NEX has today:
>
> [ Browse all directions ]   [ Save your intent and we'll email when we have a match ]

The "save intent" option writes an intent-note to the Case with `case.status` unchanged. NEX operators see this in the admin queue (feeds the PR-12 curation prioritisation).

**H.2.b · Requested component isn't in the library**
(A retrieved direction card claims a component role that has no matching `component_role` entries in the library)

Card doesn't render. Retrieval widening tries alternatives. If none available, follow H.2.a. Never render a partial card. Never render a card with a broken component reference.

**H.2.c · Photograph is insufficient**
(BASE analysis returns very low confidence on all fields · e.g. photo is too dark, too small, wrong angle)

Detection: at ingestion, if `visible_components[].length === 0` OR every visible_geometry field has confidence `unknown`, treat as insufficient.

Copy on the SHOW screen:
> Your photo shows some of your staircase but not enough for NEX to work with reliably.
> Take another photo of your staircase from the bottom, in daylight if you can, showing as much of the full flight as possible.
> [ Take another photo ]   [ Continue anyway · NEX will ask more questions later ]

"Continue anyway" keeps the customer moving. FEEL still runs. At SEE, the Brain will retrieve based purely on feelings (no BASE-geometry filter), which produces broader (and less "on my staircase") directions.

**H.2.d · Multiple interpretations are possible**
(BASE analysis returns two plausible geometries · e.g. quarter-landing vs half-turn)

Detection: multiple candidate configurations with similar confidence scores from the analysis pass.

Copy on the SHOW correction UI:
> NEX isn't sure whether your staircase turns at a landing or continues straight.
> [ Turns at a landing ]   [ Continues straight ]   [ Not sure — I'll show a professional in person ]

Customer answer writes `configuration_confidence: 'observed'` (customer-asserted). "Not sure" leaves it `inferred` and adds an `unknown_item` about "true configuration to be confirmed on survey."

**H.2.e · Photo analysis background job fails**
(Server-side · transient)

Copy on SHOW:
> NEX is still looking at your photo. This usually takes a few seconds.
> [ Refresh ]

If failure persists (retry ×3), fall back to H.2.c copy. Never show technical error strings to the homeowner.

### H.3 · Copy discipline

Every empty/failure state:
- Names what NEX does not know or cannot do
- Never blames the customer
- Never says "coming soon" without a real timeframe
- Never says "AI failed" · "server error" · or any technical term
- Always offers a next action

---

## Section I · Commercial Boundary (HARD)

**No homeowner surface built under this spec may display:**
- Any monetary value in any currency
- The word "quote" · "price" · "cost" · "estimate" · "£" · "$" · any equivalent
- Membership status of any kind
- Contractor ranking or identifier
- The word "member" in a subscription/payment sense
- The word "lead" in a lead-selling sense
- "£15" anywhere · ever

**The homeowner sees no marketplace mechanics.** Every reference to the trade side uses the phrase "local staircase professional" (verbatim from Stage 8 QA-FIX).

**Validators at write time (per Stage 8 case-store) already enforce PR-13 (no NEX price on Case).** This spec adds no new bypass path.

**CONNECT (the transition from `READY_FOR_ASSESSMENT` to member handoff) is downstream. This spec ends at the transition to `READY_FOR_ASSESSMENT`. What happens after — including PR-17 under-3-members behaviour, matching algorithm invocation, Member notification, SLA clock — is a separate future GO LOCK.**

---

## Section J · Member Value (the ultimate output)

### J.1 · The Refacing Case at `READY_FOR_ASSESSMENT` (checklist)

When a Member eventually receives a Case at CONNECT (downstream · not built here), it must contain enough to answer these Member questions:

- **What's the customer's existing staircase?** → `existing_staircase.photos[]` + `visible_components[]` + `visible_geometry`
- **What do they want to change?** → `customer_intent.feelings[]` + `intent_entries[]`
- **What have they chosen visually?** → `selected_design` with hero image + reference_image_ids + material_composition
- **Where does that direction come from · can I trust it?** → `composition_provenance[]` traces every element to a real library image the Member can see
- **What's still unknown?** → `unknown_items[]` (honest, per PR-16)
- **Where and how do I reach them?** → `contact` (attached at the final step)

This is the "genuinely qualified refacing project with enough information for me to act" that the architecture memory names as the Member's success criterion.

### J.2 · What the SEE UI must NOT compromise on for the Member's sake

- Confidence markers must survive the SEE render (never rounded down to certainty for UI simplicity)
- Provenance must be complete (never a "we composed this from the vibe of the direction" fallback)
- Unknown items must accumulate as the customer refines (adding a MUST_NOT_CHANGE surface may reveal new unknowns the Member should see)

### J.3 · What SEE UI does NOT try to solve

- The Member's quote workflow (out of scope · trade-side UI)
- The matching logic (Cluster B · Trade Exchange doctrine · downstream)
- Compatibility check between component swaps (PR-4 · downstream)
- Physical measurement capture (survey · Member-side)

---

## Amendment procedure

Any amendment to this spec requires:
1. A named change (which section · what changes · why)
2. Cross-reference check against the 18 PRs · must not violate any
3. Cross-reference check against locked memories (architecture v2 · Trade Exchange · Stage 1-7 · BASE Analysis Protocol · step-unit taxonomy)
4. A note in an amendment section below with date + author
5. If the amendment relaxes PR-18 (composition-from-library) in ANY way, Philip's explicit written re-authorisation of PR-18's boundaries

## Governance

- **This spec does NOT authorise implementation.** Implementation requires the explicit GO LOCK phrase named below.
- **This spec does NOT modify Stage 8.** The current V1-V8 remediation surfaces stay as they are. This spec adds NEW surfaces after `BASE_UPLOADED`.
- **This spec does NOT open CONNECT · SURVEY · QUOTE · CONTRACT · matching · acquisition workflow.** Those remain future GO LOCKs, each with their own spec + authorisation.
- **This spec does NOT authorise generative AI at any layer.** Side-by-side reference presentation IS the composition mechanism. Photograph modification is BANNED for the homeowner surface per PR-19. Any future "show my actual staircase transformed" surface would require a professional-capture workflow with its own separate spec + separate GO LOCK.

---

## The next GO LOCK phrase required to begin implementation

> **`SEE UI · GO LOCK — AUTHORISED`**

When Philip types that phrase — and only then — implementation of the surfaces defined in this document begins. Implementation MUST follow the order:

1. Add `BASE_CONFIRMED` status to `CASE_STATUSES` in `case-schema.ts` (schema-only · reversible)
2. Add `saved_directions?[]` field to `RefacingCase` (additive · reversible)
3. Build `feeling-map.ts` (pure functions · no side effects)
4. Build `POST /api/nex/refacing/cases/[rf_id]/confirm-base` endpoint (SHOW → BASE_CONFIRMED transition)
5. Build `POST /api/nex/refacing/cases/[rf_id]/intent` endpoint (FEEL → INTENT_DEFINED transition)
6. Build `GET /api/nex/refacing/cases/[rf_id]/directions` endpoint (SEE retrieval · calls `retrieveSeeDirections`)
7. Build `POST /api/nex/refacing/cases/[rf_id]/select-direction` endpoint (SEE → DESIGN_SELECTED)
8. Build `POST /api/nex/refacing/cases/[rf_id]/save-direction` endpoint (Save & Share · additive)
9. Build UI components in this order: SHOW panels → FEEL screens → SEE grid → SEE comparison → LOCK confirmation
10. Wire the customer journey into `/nex-app/refacing/your-project/[rf_id]` as an in-view flow (progressive disclosure · never a separate route unless mobile-back semantics require it)
11. Tests (Vitest for endpoints + retrieval assertions · PR-18 negative tests for the direction selection path)
12. Screenshot QA at 320 · 360 · 390 · 1280 viewports (with real mobile-emulation this time · not just headless CLI)
13. Report following the Stage 8 final-report template

**Without the trigger phrase, nothing changes.** The Stage 8 code remains stable. The specs sit ready. Everything is reversible.

**End of specification.**
