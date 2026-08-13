# NEX Refacing · SEE-COMPOSITE Specification

## ⚠ SUPERSEDED · RETRACTED FROM ACTIVE STATUS (Philip 2026-08-12)

**This spec, as originally written, is NOT to be implemented for the homeowner MVP.**

The premise of this spec — visually modifying the customer's homeowner photograph to show their staircase transformed — was retracted after Philip's 2026-08-12 pivot. The new governing rule (LOCKED · **PR-19** in the architecture memory):

> **NEX does not promise to visually modify the homeowner's photograph. The homeowner photograph establishes the existing staircase and its design direction; Reference Library imagery establishes the proposed design direction. Accurate visualisation of the customer's actual staircase is a separate professional-capture workflow and requires its own specification.**

And:

> **NEX observes, does not pretend to measure.**

### Why this was retracted

- A normal homeowner photograph (arbitrary angle · variable quality · variable resolution · variable framing · foreground clutter) does not carry the reliable geometry needed to physically replace components in the pixels
- Trying to make it look convincing risks manufacturing certainty NEX does not have (violates PR-16 · violates PR-14's Refacing Case truthfulness)
- The real product value is: understand + direction + professional-ready Case · NOT a fake visual overlay
- Requiring homeowners to photograph like professionals would degrade the entry experience for millions of average customers

### What this means for the shipped product

- **Phase A of SEE UI IS the answer for the homeowner journey.** It is not a stepping stone.
- SHOW → FEEL → SEE (side-by-side reference presentation) → LOCK → CONNECT is the complete homeowner-side pipeline.
- The Refacing Case delivered to the Refacing Member at CONNECT contains the customer's actual photo + NEX's observed understanding + the chosen library direction + intent. The Member performs the actual survey and produces the actual quote.

### What remains valid from this document

The technical content below (composition pipeline · segmentation · perspective · masking · shadows · library gaps · PR-18 enforcement patterns · technology-stack analysis) is preserved as **reference for a possible FUTURE `PROFESSIONAL-CAPTURE-COMPOSITE-SPEC`** if NEX ever pursues a genuine "show me my actual staircase transformed" experience.

That future spec would require:
- A dedicated professional-photography or capture-device workflow (straight-on elevation · full flight · known scale reference · consistent lighting · sufficient resolution · multiple angles as needed)
- Its own GO SCOPE and its own GO LOCK
- Explicit authorisation from Philip
- No promise that ordinary homeowner photos are suitable input

### What is IMPLEMENTED today

Nothing from this spec. The compositor engine, the library composite assets, the new endpoints — none of it exists. The retraction happened before any implementation began. All code changes remain confined to the Phase A SEE UI shipped in the prior turn.

---

## Original spec content (preserved as reference · NOT active)

**Purpose (original · superseded):** define how NEX applies a chosen Reference Library design onto the customer's actual staircase photograph without generative AI or invention.
**Written:** 2026-08-12 · after SEE UI (Phase A) shipped.
**Status:** ⚠ SUPERSEDED · see preamble above.
**Authority chain (original):** implements Phase B alluded to in `SEE-UI-SPEC.md` §D.3 · consumes SEE UI outputs · governed by PR-16 + PR-18 above all else.

---

## Position

Phase A (shipped) shows the customer's BASE photo AND a Reference Library hero as two side-by-side photographs. Honest but not immersive.

Phase B (this spec) applies the chosen library design ONTO the customer's BASE photograph so they see their own staircase with the new components in place. This is the "wow" moment that competitors are chasing with generative AI — and it is exactly the moment where PR-18's "compose from library · don't invent" rule is tested hardest.

## The one sentence this spec exists to enforce

> **Every pixel in a composed preview traces back to either a specific region of the customer's BASE photograph OR a specific Reference Library component (identified by image_id) OR a deterministic drawing rule keyed to real library metadata. No pixel is invented, hallucinated, or generated from a language prompt.**

## Non-goals (LOCKED · never negotiable)

- ❌ **NO generative AI at any stage.** No Stable Diffusion · DALL-E · Midjourney · Flux · Imagen · SDXL · InstructPix2Pix · ControlNet-in-generation-mode · style-transfer models · diffusion models · text-to-image · image-to-image with generative decoder · anything of that class.
- ❌ **No "similar-looking" component substitution.** If the exact family/style/species isn't in the library, the composite doesn't happen for that component.
- ❌ **No shadow/lighting invention.** Composed components use their library lighting or a deterministic neutral blend · no AI-generated shadows.
- ❌ **No prediction of unseen surfaces.** The compositor never fills in what the BASE photo doesn't show.
- ❌ **No client-side compositing that isn't reproducible server-side.** Every composed preview must be re-derivable from the same inputs.

## Doctrinal authority chain (read in order before implementing)

1. `docs/refacing/STAGE-1-REMEDIATION-SPEC.md` — Stage 1 target journey
2. `docs/refacing/PR-12-EXECUTION-SPEC.md` — image intelligence schema + retrieval
3. `docs/refacing/SEE-UI-SPEC.md` — SHOW → FEEL → SEE → LOCK (Phase A · shipped)
4. Auto-memory `project_nex_refacing_architecture_v2_2026_08_12.md` — 18 PRs (especially PR-16 truthfulness + PR-18 composition from library)
5. Auto-memory `project_nex_refacing_step_unit_taxonomy_2026_08_12.md` — 4-family taxonomy + three-jobs image model
6. This spec

---

## §1 · The visual composition pipeline

### §1.1 · Input artefacts (all pre-existing · none invented)

| Input | Source | Confidence-marked? |
|---|---|---|
| BASE photograph | `case.existing_staircase.photos[]` · customer upload | N/A (raw pixels) |
| Segmented BASE regions | Segmentation model output · new pipeline (see §16) | YES · per-region confidence |
| Detected geometry | `case.existing_staircase.visible_geometry` per PR-12 field 7 · flight structure | YES · per-field confidence |
| Selected design | `case.selected_design` from Phase A LOCK · with `reference_image_ids[]` | YES · propagated from library entries |
| Library composite assets | NEW · `library_composite_v1[]` index adjacent to `images_v3[]` | YES · per-asset confidence |

### §1.2 · Output artefact

A single composed PNG plus a companion JSON manifest.

```
data/refacing-cases/composed/<rf_id>/
  <composition_id>.png
  <composition_id>.json
```

Where the JSON contains:
- `composition_id` (opaque · derived from case + design + timestamp hash)
- `refacing_case_id`
- `base_photo_image_id` (customer's BASE · attests to base pixels)
- `selected_design_direction` (safe-centre / warm-character / stretch-statement / custom)
- `pixel_provenance[]` (see §12)
- `composition_confidence` (aggregate · lowest per-region confidence propagates up)
- `geometry_used` (which detected geometry snapshot was consumed)
- `fallback_regions[]` (regions where compositor gave up → BASE pixels shown unchanged)
- `render_engine_version` (spec version + implementation version)

### §1.3 · Stages (LOCKED order)

```
1 · INGEST         · read BASE + geometry + selected_design
2 · SEGMENT        · identify BASE regions per component role
3 · MEASURE        · derive scale reference + perspective vectors from geometry
4 · CHECK LIBRARY  · confirm every required library composite asset exists
                     · abort composition (fall back to Phase A) if any required asset missing
5 · POSITION       · calculate anchor coordinates for each component overlay
6 · TRANSFORM      · warp component overlays to detected perspective
7 · COMPOSITE      · layer overlays over BASE with correct masking
8 · PROVENANCE     · emit pixel_provenance[] · compute composition_confidence
9 · RENDER         · flatten to PNG · write both PNG + JSON to storage
10 · VERIFY        · re-open the emitted composition · assert pixel_provenance covers 100% of pixel area
```

Every stage is deterministic given the same inputs. Two runs with the same BASE + design + library snapshot produce byte-identical outputs (except for timestamp field in the JSON).

---

## §2 · What CAN and CANNOT be composited

### §2.1 · CAN be composited (with confidence thresholds)

| Component role | Composition approach | Confidence threshold |
|---|---|---|
| Handrail | Vector polyline (SVG stroke) OR raster overlay | ≥ 0.75 perspective · ≥ 0.7 segmentation |
| Baluster | Repeated vector stroke OR raster tile | ≥ 0.75 perspective · ≥ 0.7 segmentation · ≥ 0.7 tread-count |
| Baserail | Vector polyline parallel to handrail | ≥ 0.75 perspective · ≥ 0.7 segmentation |
| Newel post (top + bottom) | Raster overlay with pre-computed alpha mask | ≥ 0.7 segmentation of newel base + top |
| Riser (per flight) | Raster texture applied to detected riser polygons | ≥ 0.7 segmentation |
| Tread finish (top surface) | Raster texture applied to detected tread polygons | ≥ 0.7 segmentation |
| Stringer overlay | Vector polyline OR raster texture | ≥ 0.7 segmentation |

### §2.2 · CANNOT be composited in Phase B (deferred or permanently excluded)

| Element | Why | Alternative |
|---|---|---|
| Balustrade shadows on wall behind | Requires 3D lighting solve · beyond deterministic pipeline | Use library entry's own shadows · blur/vignette edges |
| Under-stair storage interiors | Not visible in typical BASE photo | Show library hero side-by-side |
| Ceiling / soffit changes above staircase | Rarely in BASE frame | Out of scope |
| Wall colour changes | Not a staircase component · scope creep | Out of scope |
| Reflections in glass balustrades | Requires environment map · scene understanding | Use library entry's photographed reflections · flag limitation |
| Perspective changes ("what if I view from other side") | Requires unseen surface reconstruction · violates §1.3 · Stage 4 | Show alternate library hero from different angle if available |
| Any component NEX doesn't have a library entry for | PR-18 · never invent | Honest "we don't have that direction available yet" empty state |

### §2.3 · The "not composable this time" fallback (per composition, per component)

When a component fails its confidence gate OR its required library asset is missing:

- The BASE region for that component is LEFT AS-IS (BASE pixels preserved · unchanged)
- The composed JSON manifest records the failure in `fallback_regions[]`
- The customer-facing UI shows an honest note per §20

---

## §3 · Geometry model

### §3.1 · Coordinate space

Normalised BASE photo coordinates: (x, y) each in [0, 1] where (0, 0) is top-left, (1, 1) is bottom-right of BASE.

Third coordinate (z · optional) = estimated depth normalised [0, 1] where 0 = closest to camera, 1 = furthest. Used only for occlusion ordering.

### §3.2 · Component anchor points (derived from segmentation + geometry)

Every composable component has **named anchor points** in BASE coordinate space. The compositor's positioning stage (§5) resolves these from segmentation output.

- **Newel · top** anchor: (x, y, z) at the newel's top-cap centre
- **Newel · bottom** anchor: (x, y, z) at the newel's base plate centre
- **Handrail · start** anchor: (x, y, z) at the handrail's lower end (typically bottom newel's top-cap)
- **Handrail · end** anchor: (x, y, z) at the handrail's upper end
- **Baluster · pitch** anchor: horizontal spacing between successive balusters (mm-scaled)
- **Baluster · count** anchor: total number of balusters visible in the segmented region
- **Baserail · start** / **Baserail · end** anchors: parallel to handrail, offset by detected string height
- **Riser · per-flight** anchor list: one polygon per detected riser
- **Tread · per-flight** anchor list: one polygon per detected tread

Every anchor carries `_confidence` per PR-16.

### §3.3 · Flight geometry inheritance

Per the locked flight-based geometry (PR-12 field 7):

- Compositor iterates PER FLIGHT
- Landings are gaps between flights · not composed unless the library direction includes a landing treatment
- If flight 1 has confidence ≥ threshold but flight 2 does not → compose flight 1, leave flight 2 as BASE, note in `fallback_regions[]`

### §3.4 · Perspective estimation

- Detect vanishing point from: (a) parallel handrail + baserail lines, (b) tread edge lines, (c) newel vertical alignment
- Vanishing point stored as (vx, vy) in BASE coordinates · `vanishing_point_confidence`
- Flight angle = angle of the handrail line to the horizontal · `flight_angle_confidence`
- Camera tilt = angle of BASE horizon (if detectable · from wall edges or floor lines) · `camera_tilt_confidence`

**HONEST LIMIT:** if `vanishing_point_confidence < 0.75` → compositor aborts · falls back to Phase A. Never guess perspective from insufficient evidence.

### §3.5 · Scale determination

Absolute scale (pixels-per-mm) derived from:

1. **Preferred:** detected tread depth in pixels × known typical UK/EU stair tread depth (220mm ± 30mm · from `data/nex-staircase-*` reference values)
2. **Fallback:** detected newel height in pixels × typical newel height (900mm ± 100mm)
3. **Fallback 2:** detected riser height × typical riser (200mm ± 25mm)

Scale carries `pixels_per_mm_confidence` · median of source confidences.

**HONEST LIMIT:** if all three fail (`< 0.5`) → compositor aborts · falls back to Phase A.

---

## §4 · Component positioning rules (LOCKED per component role)

Every rule below is deterministic. Given the same anchors + scale, positioning is byte-identical.

### §4.1 · Handrail

- **Geometry:** polyline from `handrail.start` anchor to `handrail.end` anchor
- **Vector overlay:** SVG `<line>` with stroke-width = handrail profile height in mm × pixels_per_mm
- **Raster overlay:** the library handrail's alpha PNG, warped along the polyline via perspective-aware texture mapping
- **Positioning check:** if handrail line intersects a detected foreground object (person · pet · furniture) with foreground_confidence ≥ 0.6 → do NOT paint over the intersection region · preserve BASE pixels · note in `fallback_regions[]`

### §4.2 · Newel post (top + bottom)

- **Geometry:** vertical rectangular region from `newel.bottom` anchor to `newel.top` anchor
- **Height:** derived from anchor distance in pixels
- **Width:** derived from library newel's width in mm × pixels_per_mm
- **Raster overlay only** (newels are volumetric · SVG cannot represent them convincingly)
- **Perspective:** slight horizontal skew based on distance from vanishing point
- **Occlusion:** if the newel occludes a handrail attachment point, render newel BELOW the handrail layer

### §4.3 · Baluster

- **Geometry:** count derived from `baluster.count` (segmentation-observed) OR from library metadata IF customer's staircase geometry allows a specific per-tread count (typically 2 balusters per tread for regs-compliant designs)
- **Position:** evenly spaced along the handrail-to-baserail axis · pitch = detected tread depth (typically 220mm / 2 = 110mm per baluster with 2-per-tread)
- **Vector overlay:** SVG `<line>` per baluster · stroke-width = library baluster's width in mm × pixels_per_mm
- **Raster overlay:** single library baluster PNG repeated at each position with per-position perspective warp
- **Regs check:** baluster spacing must comply with detected regional regs (UK Part K: max 99mm gap). If library baluster width + generated spacing violates: compositor emits a warning to `fallback_regions[]` and DOES render, but the JSON flag surfaces to member at CONNECT

### §4.4 · Baserail

- **Geometry:** polyline parallel to handrail, offset perpendicular by detected string height
- **String height:** measured from tread edge to string top · typically 100-180mm
- **Vector overlay:** SVG `<line>`
- **Raster overlay:** library baserail alpha PNG warped along polyline

### §4.5 · Riser (per flight)

- **Geometry:** one quadrilateral per detected riser · four corners = segmentation output
- **Raster overlay:** library riser texture (PNG) warped to fit each quad via perspective transform
- **Vector overlay:** N/A (risers are surfaces, not lines)
- **Blending:** hard-edge replacement (no feathering · avoid halo)

### §4.6 · Tread (top surface)

- **Geometry:** one angled quadrilateral per detected tread top · projected onto BASE
- **Raster overlay:** library tread texture warped via perspective transform
- **Nosing:** if library specifies bullnose profile, add rounded-edge overlay along tread front edge
- **Blending:** hard-edge replacement · tread edges (nosings) get anti-aliased line to hide substitution seam

### §4.7 · Stringer

- **Geometry:** polyline along the outer edge of the stair · from base to top
- **Vector overlay OR raster:** depending on library entry type
- **Occlusion:** stringer sits BEHIND balusters and newels in Z-order

### §4.8 · Multi-flight logic

- Compose each flight independently using its own anchor set
- Landing between flights = LEFT AS BASE unless the library direction includes a landing treatment (rare · flagged if the design assumes one)
- Compose in flight-index order · flight 1 first · flight 2 layered above where they visually overlap

---

## §5 · Component representation formats

Library components must be authored in EITHER format. Each `library_composite_v1[]` entry declares which.

### §5.1 · Vector representation (SVG)

Used for: handrail · baluster · baserail · stringer · slim newels · tread nosings

Schema:
```json
{
  "asset_id": "lca_...",
  "component_role": "handrail",
  "representation": "vector",
  "svg_stroke": {
    "stroke": "#3d2817",
    "stroke_width_mm": 42,
    "stroke_linecap": "round",
    "profile": "traditional_moulded_v1"
  },
  "material_texture_ref": null,
  "confidence": "observed"
}
```

### §5.2 · Raster representation (PNG with alpha)

Used for: volumetric newels · tread surface finishes · riser surface finishes · detailed handrail carvings

Schema:
```json
{
  "asset_id": "lca_...",
  "component_role": "newel",
  "representation": "raster",
  "asset_url": "/composite-assets/newel_oak_square_flat_01.png",
  "asset_hash": "sha256:...",
  "physical_dimensions_mm": { "width": 91, "depth": 91, "height": 900 },
  "photographed_perspective": "orthographic_front",
  "photographed_lighting": "diffuse_neutral",
  "alpha_mask_present": true,
  "confidence": "observed"
}
```

### §5.3 · Companion library-side authoring

Every existing `images_v3[]` entry that documents a real refacing project MAY have companion `library_composite_v1[]` entries authored from it. This is a MANUAL / semi-automated authoring workflow (see §16). The composite assets are NEW · separate from `images_v3[]` · with their own governance.

**Never generate composite assets via AI · they are cutouts from real reference photos OR CAD-drawn SVG traced from real component specifications.**

---

## §6 · Perspective correction

### §6.1 · Method

- Estimate homography matrix H from BASE using detected parallel lines (handrail, baserail, tread edges)
- Component overlays transformed via H before compositing
- Vector overlays: apply H as SVG `transform` matrix
- Raster overlays: apply H as canvas / sharp perspective transform (4-point warp)

### §6.2 · Confidence gating

- If H's condition number > threshold (matrix is near-singular) → perspective unreliable → abort composition
- Detected vanishing point outside a plausible cone → abort composition

### §6.3 · Limitations acknowledged

- Two-point perspective only (typical staircase shot) · not three-point or fisheye
- Assumes camera at approximately eye-level · not extreme low or high angle
- Documented in §20 empty states

---

## §7 · Scale determination (recap · full detail)

Already covered in §3.5. Additional rules:

- Scale is computed ONCE per BASE and cached with the case's `visible_geometry`
- Never re-computed silently between compositions
- If library component's physical dimensions in mm are missing (composite asset lacks `physical_dimensions_mm`) → cannot scale that component → treat as library-gap per §11

---

## §8 · Masking and occlusion

### §8.1 · Segmentation-derived masks

- Segmentation model outputs per-role region masks with per-pixel confidence
- Compositor uses ONLY regions with pixel-confidence ≥ 0.7
- Below-threshold pixels: BASE pixels preserved · logged to `fallback_regions[]`

### §8.2 · Z-order (rendering layers · low index renders first · high index renders on top)

1. BASE photo (background)
2. Stringer overlay
3. Riser texture (per flight)
4. Tread top texture (per flight)
5. Baserail
6. Newel post (bottom · then top)
7. Baluster (repeated)
8. Handrail
9. Foreground preservation mask (BASE pixels for detected foreground objects · people · pets · furniture)

### §8.3 · Foreground preservation

- Segmentation model separately detects "foreground non-staircase objects" (person · pet · vase · rug · furniture)
- These regions are painted BACK from BASE at layer 9 · guaranteed to remain visible even if a composed overlay would have covered them
- This preserves the customer's actual scene · never magically removes their dog

### §8.4 · Edge blending

- Deterministic 2-3 pixel Gaussian blur along composed-vs-BASE edges (anti-aliasing seam)
- NEVER stylistic blur that hides substitution failures
- NEVER content-aware inpainting (that's invention)

---

## §9 · Shadows and lighting

### §9.1 · Phase B.1 policy: use library lighting · no shadow synthesis

- Library composite assets are photographed under diffuse neutral lighting (see §5.2 `photographed_lighting`)
- Compositor does NOT recompute shadows to match BASE's ambient lighting
- Slight luminance match: sample average luminance from adjacent BASE region · shift composite's histogram by matched delta (deterministic · not stylistic)

### §9.2 · Phase B.1 honest limitation

Customer preview may show a component with different apparent lighting from its surroundings. Copy on the preview:

> *"This preview uses NEX's reference lighting. Your staircase's actual lighting will differ slightly."*

### §9.3 · Phase B.3 (future) — proper shadow synthesis

- Would require estimating BASE light-source direction · deterministic shadow rendering per component geometry
- Explicitly out of scope for Phase B.1 and Phase B.2
- Requires separate GO SCOPE + spec if pursued

---

## §10 · Multi-flight and landing geometry

Already covered in §3.3 and §4.8. Additional rules:

### §10.1 · Landing composition

- Landings usually have flat treads that ARE refaced (or NOT · depending on customer preference)
- If library direction includes a landing treatment (`selected_design.material_composition[]` includes a landing entry): compose the landing tread surface as a single polygon
- Otherwise: leave landing as BASE

### §10.2 · Winder treads

- Winder treads are irregular (typically triangular)
- Segmentation must detect winder polygons explicitly
- If detected: apply the same tread texture as adjacent flight treads, warped to each winder's polygon
- If winder detection fails (`winder_confidence < 0.7`) → leave winders as BASE · flag in `fallback_regions[]`

### §10.3 · U-turn / quarter-turn / half-turn

- Composed per-flight per §4.8
- Flights meeting at a landing may show different perspective for each flight · handled by per-flight perspective estimation (§6)

---

## §11 · Handling library gaps (the PR-18 empty state)

This is THE critical section. Every branch below is a "we don't have that" honest fallback.

### §11.1 · Required component role has NO library entry matching family/style/species

- Compositor does NOT compose that component
- BASE region left unchanged
- Fallback recorded: `{ "component_role": "handrail", "reason": "no_library_entry_for_family_walnut_style_industrial_bold", "resolution": "preserved_base" }`
- Customer preview shows the composed image WITH the base handrail still visible AND a note per §20

### §11.2 · Required composite asset (SVG or raster) missing for existing images_v3 entry

- Same fallback as §11.1
- Additionally: emit an admin queue entry `{ "action": "author_composite_asset", "for_image_id": "...", "for_role": "..." }` so operators know which assets to author next

### §11.3 · Detected component region can't be reliably segmented

- If segmentation confidence < 0.7 for a region → do NOT overlay
- Base region preserved
- Fallback recorded with `reason: "low_segmentation_confidence"`

### §11.4 · Perspective / scale can't be reliably determined

- Compositor aborts ENTIRE composition
- Falls back to Phase A side-by-side (per SEE-UI-SPEC.md · already shipped)
- Customer preview shows the side-by-side view with a note

### §11.5 · Foreground occlusion covers too much of the staircase

- If foreground objects cover > 40% of detected staircase pixels → compositor aborts
- Falls back to Phase A
- Suggests customer re-take the photo without the obstruction

### §11.6 · The composed result violates PR-16 truthfulness

- If any layer has confidence < 0.5 AND is safety-critical (baluster spacing regs) → do NOT render that layer
- Alert surfaces in `fallback_regions[]` for member review at CONNECT

---

## §12 · Pixel-level provenance

### §12.1 · pixel_provenance[] schema

Every pixel region in the composed PNG traces to a source. Regions are polygons in BASE coordinate space.

```json
"pixel_provenance": [
  {
    "region_id": "rp_0001",
    "polygon": [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]],
    "source": "base_photo",
    "source_image_id": "img_case_rf_xxxxx_yyyy",
    "confidence": "observed",
    "notes": "Full BASE preserved as background layer"
  },
  {
    "region_id": "rp_0002",
    "polygon": [[0.2, 0.4], [0.35, 0.4], [0.35, 0.9], [0.2, 0.9]],
    "source": "library_component",
    "source_asset_id": "lca_newel_oak_square_flat_01",
    "source_image_id": "img_walnut_walnut-square-minimal-newel",
    "drawing_rule": null,
    "confidence": "inferred",
    "notes": "Bottom newel · raster overlay · perspective-corrected"
  },
  {
    "region_id": "rp_0003",
    "polygon": [[0.35, 0.42], [0.7, 0.15], [0.71, 0.16], [0.36, 0.43]],
    "source": "drawing_rule",
    "drawing_rule": "handrail_polyline_v1",
    "source_asset_id": "lca_handrail_traditional_moulded_v1",
    "source_image_id": "img_oak_handrail_reference",
    "svg_stroke": { "stroke": "#3d2817", "stroke_width_mm": 42 },
    "confidence": "inferred",
    "notes": "Handrail rendered via SVG stroke rule · warped to detected flight angle"
  }
]
```

### §12.2 · Provenance completeness invariant

`pixel_provenance[]` must cover 100% of the composed PNG's pixel area. Verified at stage 10 · VERIFY (§1.3). Fails = composition is rejected · falls back to Phase A.

### §12.3 · Provenance link into case.composition_provenance

- Every unique `source_image_id` in `pixel_provenance[]` extends `case.composition_provenance[]`
- Deduped · appended if not already present
- Existing Stage 8 validators (`validateCompositionProvenance`) run on the enlarged provenance array
- If any source_image_id doesn't exist in `images_v3[]` → PR-18 violation → composition rejected

---

## §13 · PR-16 uncertainty preservation

Every confidence marker propagates:

- Segmentation confidence → mask paint threshold → rendered layer confidence
- Perspective confidence → warp accuracy → layer confidence
- Scale confidence → component size accuracy → layer confidence
- Library asset confidence (inherited from images_v3 entry) → layer confidence

**Composition_confidence for the whole image** = MIN of all layer confidences · never averaged, never rounded up.

Customer preview:
- Composition_confidence ≥ 0.85: shown without caveat
- 0.7-0.85: shown with "This is NEX's best composition · a professional will refine it" caption
- < 0.7: NOT shown as composition · falls back to Phase A

---

## §14 · PR-18 no-invention enforcement (HARD)

### §14.1 · Deterministic pipeline invariant

Same inputs → same output. Two runs of the compositor with the same BASE + selected_design + library snapshot MUST produce byte-identical PNG + JSON.

Implementation implication:
- No random seeds
- No ML inference at composition time (segmentation ONCE per BASE, cached)
- No parallelisation that reorders operations non-deterministically
- CI test: run compositor twice on the same inputs, hash-diff outputs, fail build on any diff

### §14.2 · Asset-lookup invariant

Every asset used at composition time is looked up by `asset_id` in `library_composite_v1[]`. No fuzzy match. No fallback substitution. Missing asset → §11 fallback.

### §14.3 · No generative model in the pipeline

Hard-coded in the runtime: the compositor process has NO network egress to any generative model API. Enforced via container / process-level firewall rule.

CI test: static scan of composition-engine code + dependency tree for known generative-model libraries (`stable-diffusion` · `openai/dall-e` · `huggingface/diffusers` · etc.). Fails build if detected.

### §14.4 · Segmentation model may use ML — with constraints

Segmentation IS an ML task. Two acceptable model types:

1. **General-purpose segmentation** (e.g. SAM 2 / MobileSAM) — deterministic given the same input · output is a mask · not a generated image
2. **Classical computer vision** (edge detection · morphological ops · watershed · etc.) — no ML at all

Any segmentation model used MUST:
- Be deterministic (same input → same mask)
- Output masks + confidence only · never novel pixels
- Be self-hosted (no third-party API dependency for the "which pixels are the handrail" question)

---

## §15 · Confidence gates for auto-composition

Compositor decides at Stage 4 · CHECK LIBRARY · whether to proceed or fall back to Phase A:

| Check | Threshold | Fail action |
|---|---|---|
| Perspective (vanishing point) | ≥ 0.75 | Fall back to Phase A |
| Scale (pixels-per-mm) | ≥ 0.5 | Fall back to Phase A |
| Segmentation of primary component (whichever the design most changes) | ≥ 0.7 | Fall back to Phase A |
| Required library composite assets all present | 100% | Fall back to Phase A · flag missing assets for admin |
| BASE photo resolution | ≥ 800px on longer edge | Fall back to Phase A · suggest re-shoot |
| Foreground occlusion of staircase | < 40% of staircase area | Fall back to Phase A · suggest re-shoot |

---

## §16 · Technology stack requirements

This is the deliverable Philip specifically asked for: **exactly what technology is required to make Phase B work.**

### §16.1 · Segmentation

**Requirements:**
- Deterministic (fixed random seed) · self-hosted · reasonable inference latency (< 10s on CPU acceptable · < 2s on GPU preferred)
- Trained OR fine-tuned to distinguish: handrail · newel · baluster · baserail · tread · riser · stringer · foreground person · foreground furniture · staircase-not-otherwise-specified · non-staircase

**Viable options (in order of recommendation):**

1. **SAM 2 (Meta · Segment Anything Model)** fine-tuned on a staircase dataset · runs via `sam2` Python package or ONNX runtime · deterministic given fixed prompt point coordinates. Self-hostable. Best accuracy.
2. **MobileSAM** — lighter · CPU-viable · lower accuracy than SAM 2 · acceptable for smaller-scale MVP.
3. **Classical CV pipeline** — no ML · edge detection (Canny) + morphological operations + region growing · works decently on high-contrast staircases · fails on complex scenes. Fine for a fallback.
4. **Purpose-built model** trained from scratch on a staircase-specific dataset · highest accuracy but requires labelled data (5-10k staircase images minimum · expensive to build).

**Recommendation:** MobileSAM in a Node worker process (via ONNX runtime · CPU-viable · self-hosted) as MVP · migrate to SAM 2 fine-tuned model when the staircase dataset grows to justify it.

**Explicit NOT:** any third-party segmentation API that could see customer BASE photos (privacy · PR-18 audit chain integrity). Self-hosted only.

### §16.2 · Perspective / geometry estimation

**Requirements:**
- Homography matrix estimation from detected line correspondences
- Vanishing point detection from parallel line sets
- Deterministic

**Viable options:**

1. **OpenCV** (Node bindings via `opencv4nodejs` OR headless via a Python worker) — industry standard · deterministic · fast
2. **Pure JS homography** libraries (e.g. `perspective-transform` · `homography.js`) — slower · smaller footprint · fine for MVP
3. **Custom implementation** using standard linear algebra (`ml-matrix` etc.) — full control · more maintenance

**Recommendation:** OpenCV via Python worker OR `perspective-transform` (JS) for MVP.

### §16.3 · Composition / rendering

**Requirements:**
- Composite raster layers over a BASE with alpha-aware blending
- Render SVG overlays into PNG (server-side)
- Perspective-transform raster overlays via 4-point warp
- Deterministic

**Viable options:**

1. **Sharp** (Node · libvips-based) — very fast · supports composition · alpha · limited perspective transform
2. **Node-canvas** — full canvas API server-side · supports SVG · straightforward
3. **ImageMagick** via `gm` or `imagemagick-cli` — established · powerful · slower
4. **Client-side HTML Canvas + SVG** — interactive · lower server load · harder to enforce determinism

**Recommendation:** Server-side `sharp` + `node-canvas` for MVP. Client-side becomes viable for Phase B.2 interactive swaps.

### §16.4 · Library composite asset storage

**Requirements:**
- Store SVG stroke definitions AND raster PNGs with alpha
- Version-controlled
- Retrievable by `asset_id`

**Options:**

1. **Filesystem** (matches existing NEX pattern) — `public/composite-assets/[asset_id].{svg,png}` + `data/staircase-renovations/library_composite_v1.json` index
2. **Object Storage** (per NEX Storage constitution memory) — better for scale · adds infrastructure dependency

**Recommendation:** Filesystem for MVP · migrate to NEX Storage when the composite library grows past ~500 assets.

### §16.5 · Composed output storage

**Requirements:**
- Per-case · per-composition
- PNG + JSON manifest
- Access-controlled via same anonymous_return_token as case

**Options:**

1. **Filesystem** — `data/refacing-cases/composed/[rf_id]/[composition_id].{png,json}`
2. **NEX Storage** — better for scale

**Recommendation:** Filesystem for MVP.

### §16.6 · Enforcement infrastructure

- **CI test:** static scan of composition code + dependency tree for banned generative libraries (§14.3)
- **CI test:** round-trip determinism test (§14.1)
- **CI test:** `pixel_provenance[]` covers 100% invariant (§12.2)
- **Runtime firewall:** compositor process has no network egress to model-serving hosts (deployment-time policy)

---

## §17 · Client-vs-server decision

### §17.1 · Server-side (MVP · Phase B.1)

- Segmentation runs server-side (heavy · cached per BASE)
- Composition runs server-side (deterministic · easier PR-18 audit)
- Client requests composition via `POST /api/nex/refacing/cases/[rf_id]/compose` (NEW endpoint · not built yet)
- Response: composed PNG URL + composition JSON URL + composition_confidence

### §17.2 · Client-side augmentation (Phase B.2)

- Real-time preview of component swaps (customer taps "try walnut instead of oak") without full server round-trip
- Client-side canvas re-composites with pre-fetched composite assets
- Server-side re-runs the authoritative composition on save/lock (deterministic verification)

### §17.3 · Never client-only

- LOCK-time composition MUST be server-side · enforces PR-18 audit trail
- Client-only composition is a preview affordance only · never the artefact written to the Case

---

## §18 · Mobile UI for reviewing composition

### §18.1 · Composition preview screen (mobile-first)

Replaces or extends the SeeComparison screen from Phase A when composition succeeds:

```
┌──────────────────────────────┐
│  YOUR STAIRCASE · TRANSFORMED │  ← header
├──────────────────────────────┤
│                              │
│  [composed PNG · large]      │  ← the actual composed preview
│                              │
├──────────────────────────────┤
│  [◀ BEFORE ────●──── AFTER ▶] │  ← slider to reveal BASE vs composed
├──────────────────────────────┤
│  WHAT NEX COMPOSED           │
│  · Oak handrail              │  ← per-layer transparency list · from pixel_provenance
│  · Black metal balusters     │
│  · Painted risers            │
│  ⚠ Newel design not yet in   │  ← honest empty state per §11
│    library · your existing   │
│    newel is preserved        │
├──────────────────────────────┤
│  ⓘ  This is a preview based  │
│      on NEX's reference      │
│      lighting. Your actual   │
│      staircase's lighting    │
│      will differ slightly.   │
├──────────────────────────────┤
│  [ Choose this direction ]   │  ← primary · advances to LOCK
│  [ See something different ] │  ← secondary · returns to SeeGrid
└──────────────────────────────┘
```

### §18.2 · Before/after slider mechanics

- Horizontal drag reveals BASE (left) vs composed (right)
- On desktop: click-and-drag or keyboard arrow keys
- On mobile: touch drag
- Slider position saved in URL fragment so the customer's shared link can specify a reveal point

### §18.3 · Region-by-region toggle (optional · Phase B.2)

- Tap on a composed region → shows what changed (before/after crop)
- Reveals per-region confidence + which library asset was used
- HIDE by default · advanced-user feature

### §18.4 · Full-screen zoom

- Pinch/scroll to zoom composed preview
- Constrained to composed region · never zoom past image bounds

### §18.5 · Correction / rejection

- `[ This doesn't look right ]` link · opens a lightweight modal:
  - "What's off?" quick chips: "Wrong scale" · "Perspective looks wrong" · "Wrong material" · "Something else"
  - Free-text description (optional · max 200 chars)
  - Submitting: falls back to Phase A side-by-side · writes `case.composition_feedback[]` (NEW additive field) with the customer's note for the Member to see at CONNECT

---

## §19 · LOCK behaviour

### §19.1 · Case fields written at LOCK (extends Phase A's LOCK from SEE-UI-SPEC §F)

```typescript
case.selected_design.visualisation_image_id = <composition_id>;
case.composed_provenance = <pixel_provenance from the composition JSON>;
case.composition_metadata = {
  composition_id,
  composition_confidence,
  fallback_regions,   // never empty · honest about what wasn't composed
  render_engine_version,
};
```

`case.composition_provenance` (already existing from Phase A) is UNION'd with the pixel_provenance sources · every unique source_image_id added.

### §19.2 · Validators run at LOCK write

- Existing `validateRefacingCase` (PR-16 + PR-13 + PR-18) runs
- Additional Phase B validator: `validateComposedProvenance` (NEW · to be built in Phase B.1 implementation):
  - `pixel_provenance[]` covers 100% of composed pixel area
  - Every `source_image_id` in `pixel_provenance` exists in `images_v3[]`
  - Every `source_asset_id` exists in `library_composite_v1[]`
  - `composition_confidence >= 0.7` (lower rejects the write · falls back to Phase A)

### §19.3 · Status transition

Same as Phase A: `DESIGN_SELECTED` at composition completion, then `READY_FOR_ASSESSMENT` after contact attach.

### §19.4 · Composed PNG in the Member handoff

When a Refacing Member eventually receives the Case at CONNECT:

- They see BOTH the BASE photo AND the composed preview
- They can click through per-region provenance to see which library assets were used
- The composed preview is INFORMATIONAL for the Member · NEX still emphasises the survey confirms everything

---

## §20 · Empty and failure states

### §20.1 · Governing principle (LOCKED · from SEE-UI-SPEC §H)

> **"We don't have that direction available yet."**

### §20.2 · Per-failure surface

**S.1 · Full composition unavailable (perspective / scale confidence too low)**

- Fall back to Phase A side-by-side
- Copy: *"Your photo is a bit tricky for us to preview onto directly. Here's how this design looks on a similar staircase — a professional will show you exactly how it works during survey."*

**S.2 · Partial composition (some components composed, some not)**

- Show composed preview WITH BASE regions preserved for missing components
- Copy: *"NEX composed [handrail · balusters · risers] onto your staircase. Your existing [newel] is preserved because we don't have a matching design in our library yet."*

**S.3 · Foreground obstruction (person / furniture covers > 40%)**

- Compositor aborts
- Copy: *"There's something covering part of your staircase in this photo. Take a fresh photo with a clearer view for a better preview — or continue and we'll skip the visual overlay for now."*

**S.4 · Library gap for a critical component**

- Component-specific fallback per §11
- Copy: *"We don't have a [component] in this direction yet. When you request a professional assessment, they'll show you what's available."*

**S.5 · Composition confidence dropped mid-render**

- Same as S.1
- Log to admin queue for investigation

**S.6 · Customer taps "This doesn't look right"**

- Falls back to Phase A
- Note written to `composition_feedback[]` on the case
- Surfaces to Member at CONNECT

### §20.3 · Copy discipline

Every failure state:
- Names what NEX couldn't do
- Never blames the customer's photo (except S.3 which offers a concrete fix)
- Never says "AI failed" · "processing error" · any technical term
- Always offers a next action
- Preserves the composed-parts (if any) so the customer sees real progress

---

## §21 · Phased delivery

### §21.1 · Phase B.1 — SVG stroke overlay MVP (target: 3-4 weeks after GO LOCK)

Scope:
- Handrail · baserail · baluster overlays via SVG strokes
- Newel via raster overlay (requires initial composite asset authoring)
- Riser / tread via raster texture (requires authoring)
- Segmentation via MobileSAM
- Perspective via OpenCV or JS homography
- Server-side rendering via Node canvas + sharp
- Before/after slider on the preview screen
- Full PR-18 provenance
- ~15 composite assets authored (5 handrails · 5 balusters · 5 newels · covering the current 4 design directions)

Deliverable: customer sees a real "your staircase transformed" preview for the top 3 design directions.

### §21.2 · Phase B.2 — Photo cutout enhancement (target: 6-8 weeks after B.1 ships)

Scope:
- Full raster component library (150+ composite assets covering the top 30 canonical profile cells)
- Client-side preview for component swaps (real-time · no server round-trip)
- Region-by-region toggle UI
- Fine-tuned segmentation model on collected customer BASE photos (privacy-respected training set)

### §21.3 · Phase B.3 — Shadow synthesis / 3D reconstruction (SPECULATIVE · no timeline)

Scope:
- Estimated light-source direction from BASE
- Per-component shadow synthesis
- Optional 3D reconstruction for extreme angles

Requires separate SEE-COMPOSITE-B3-SPEC · not committed here.

---

## §22 · Amendment procedure

Amendments to this spec require:

1. Named change (which section · what changes · why)
2. Cross-reference against PR-1 through PR-18 · must not violate any
3. Cross-reference against locked memories (architecture v2 · Trade Exchange · Stage 1-7 · step-unit taxonomy)
4. If the amendment relaxes PR-18 in any way (allowing any generative pipeline · fuzzy matching · style-invented components): Philip's explicit written re-authorisation
5. Update of §14.3 CI test rules if the enforcement surface changes

## §23 · Governance

- **This spec does NOT authorise implementation.** Implementation requires the GO LOCK phrase named below.
- **This spec does NOT modify the shipped Phase A SEE UI.** SHOW/FEEL/SEE/LOCK continue to work as-is · Phase B augments the SEE step for cases where composition succeeds.
- **This spec does NOT open CONNECT · SURVEY · QUOTE · CONTRACT.** Those remain future GO LOCKs.
- **This spec does NOT authorise generative AI at any layer.** Segmentation ML is permitted with strict constraints (§14.4). Composition ML is BANNED.

---

## The next GO LOCK phrase required to begin implementation

> **`SEE COMPOSITE · GO LOCK — AUTHORISED`**

When Philip types that phrase — and only then — implementation of Phase B begins. Implementation MUST follow this order:

1. **GO SCOPE decisions** (BEFORE writing code):
   - Choose segmentation model (recommended: MobileSAM → SAM 2)
   - Choose perspective library (recommended: OpenCV Python worker OR JS homography)
   - Choose rendering stack (recommended: server-side sharp + node-canvas)
   - Choose asset storage (recommended: filesystem for MVP)
   - Choose deployment model for the ML worker (recommended: separate Node process · not in Next.js request handler)
2. **Composite asset authoring workflow spec** (SEPARATE spec · docs/refacing/COMPOSITE-ASSET-AUTHORING-SPEC.md · covers how ~15 initial composite assets get cut out from existing images_v3 entries)
3. **Schema additions** to `RefacingCase`: `composed_provenance` · `composition_metadata` · `composition_feedback`
4. **Storage layout** for composed outputs and library composite assets
5. **New library_composite_v1[] index** in `data/staircase-renovations/manifest.json` (additive · non-breaking)
6. **New API endpoints** (order):
   - `POST /api/nex/refacing/cases/[rf_id]/analyse-base` (runs segmentation + geometry · caches result on the case)
   - `POST /api/nex/refacing/cases/[rf_id]/compose` (runs composition for the current selected_design)
   - `POST /api/nex/refacing/cases/[rf_id]/composition-feedback` (customer "this doesn't look right")
7. **Compositor engine** implementation (server-side worker · CI-audited)
8. **New UI**: replace SeeComparison with SeeComposedPreview when composition available
9. **Fallback path**: if composition fails, use existing Phase A SeeComparison
10. **Tests**: PR-18 negative tests (attempt to compose with untraceable asset · assert reject) · determinism round-trip · provenance-100% invariant · empty-state coverage
11. **Visual QA** at 320/360/390/1280 + real device
12. **Report** following the Stage 8 / SEE UI report template

**Without the trigger phrase, nothing changes.** The Stage 8 code remains stable. Phase A remains the shipped SEE experience. Everything is reversible.

## Concise dependency list (for Philip's technology decision)

| Dependency | Purpose | MVP option | Enterprise option |
|---|---|---|---|
| Segmentation model | Identify BASE regions per component | MobileSAM (self-hosted CPU) | Fine-tuned SAM 2 on GPU |
| Perspective/homography | Warp overlays to match BASE perspective | perspective-transform (JS) | OpenCV via Python worker |
| Composition engine | Layer overlays over BASE + emit PNG | sharp + node-canvas | Same · scaled horizontally |
| Composite asset store | Store SVG + PNG cutouts + metadata | Filesystem | NEX Storage (per constitution) |
| Composed output store | Store composed PNGs + JSON manifests | Filesystem | NEX Storage |
| Compositor worker | Isolated process for composition jobs | Node worker in same host | Dedicated container / queue |
| ML runtime | Segmentation model host | ONNX Runtime Node | Triton / TorchServe |
| CI enforcement | PR-18 static scan + determinism tests | Vitest + custom scanner script | Same |
| Runtime firewall | Prevent egress to generative APIs | k8s NetworkPolicy or equivalent | Same |

**Absolute prerequisite before implementation:** author or acquire the composite asset library (~15 assets minimum). Without composite assets, the compositor has nothing real to draw from — and inventing what isn't there is exactly what PR-18 forbids.

**End of specification.**
