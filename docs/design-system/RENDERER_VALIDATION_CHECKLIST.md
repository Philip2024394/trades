# NEX Renderer Validation Checklist

**Version:** 1.0
**Owner:** Philip O'Farrell
**Established:** 2026-07-26
**Status:** Gate for every renderer implementation phase and every renderer enhancement thereafter.

This checklist is the release gate for every renderer change. It ensures the renderer evolves without unintentionally affecting the frozen staircase engine or regressing any previously-approved appearance.

**No renderer change may be merged until every applicable item in this checklist passes.**

---

## Validation hierarchy

Every renderer change is validated against four tiers, in order. A change must pass each tier before proceeding to the next.

| Tier | Test | Question answered |
|---|---|---|
| **1** | **Gold Standard Staircase** (`RENDERING_ENGINE_V1.md` §11.1) | Does the renderer still present the premium reference configuration correctly? |
| **2** | **Material Validation Scene** (§6) | Are all common materials still visually accurate and distinguishable? |
| **3** | **Functional Regression** (§2) | Do all configurator features (views, toggles, sliders, animations, controls) still work? |
| **4** | **Performance Validation** (§5) | Is performance acceptable across target quality levels? |

If Tier 1 fails, do not proceed to Tier 2. If Tier 2 fails, do not proceed to Tier 3. Escalate per §9 rather than working around by touching staircase geometry.

---

## When to run

- Before merging **any phase** in `RENDERING_ENGINE_V1.md` migration plan (Phases 0–7).
- Before merging any post-migration renderer enhancement (new mode, new HDRI, new post-effect, refactor).
- Before every release version bump that includes renderer changes.
- After any change to files under the renderer module directory.

Not required for:
- Staircase geometry changes (those follow the geometry-frozen rule — should be zero, and if they occur, they follow `MATERIAL_CALIBRATION_WORKFLOW.md`).
- Documentation-only changes.
- Non-renderer app code (business logic, pricing, UI unrelated to the renderer).

---

## 1. Regression checks — Photoreal Mode must be pixel-identical

Photoreal Mode is the current-day lighting rig preserved. Any change that alters Photoreal Mode's rendering without an explicit design decision is a regression.

- [ ] **American White Oak appearance unchanged** — front tread top, front riser face, handrail, newel posts, balusters compared against approved Photoreal baseline render.
- [ ] **Every APPROVED / FROZEN species in `APPROVAL_REGISTRY.md`** — visual comparison against each species' approved reference renders. Any deviation blocks the change.
- [ ] **Photoreal Mode render diff against pre-change baseline** — zero pixel differences unless the change explicitly declared a Photoreal appearance change (which requires separate approval).
- [ ] **Shadow rendering unchanged** — shadow map coverage, softness, bias identical.
- [ ] **Highlight rendering unchanged** — specular highlights on treads / handrails / balusters positioned and shaped identically.
- [ ] **Exposure and tone mapping unchanged** — screen brightness histogram identical to baseline.

---

## 2. Functional checks — features still work

Every user-facing feature must continue to function after every renderer change.

- [ ] **Camera views** — all 7 view buttons (`3-Quarter Hero`, `Side Elevation`, `Front Elevation`, `Top Plan`, `Walk-Up`, `Standing at Foot`, `Back of Stairs`) reach their target positions and orient correctly.
- [ ] **Free orbit** — mouse drag rotates, wheel zooms, right-click pans (or platform equivalent). No underside camera clip.
- [ ] **Varnish toggle** — on / off works, affects roughness / clearcoat on wood materials as before.
- [ ] **Sheeting toggle** — on adds the T&G panel + angle beads + groove strips, off removes them cleanly.
- [ ] **Sheeting tone slider** — moves through range −0.30 to +0.30, sheeting lightness adjusts in HSL space, no other material affected.
- [ ] **Stairlights toggle** — off = ambient scene, on = LED emissive at 4.5 + spotlights at intensity, scene lights dimmed per current values, background darkens.
- [ ] **Walk-up flight animation** — button triggers the full sequence (approach → ascend with per-step bounce → landing → 2-second 180° turn-around), no jerks.
- [ ] **Round starting step toggle** — off = hidden, on = both round-step meshes visible in correct positions.
- [ ] **Baluster swatches** — Oak / White stop-chamfered / Cream — each swap changes only the balusters, none of the other timber affected.
- [ ] **All mode toggles preserve their state** across mode switches (Configurator → Photoreal → Configurator: Stairlights ON stays ON).

---

## 3. Staircase engine integrity — the FROZEN rule holds

The staircase is production code. The renderer must not modify it.

- [ ] **No geometry modifications** — no changes to any mesh construction, `Shape`, `ExtrudeGeometry`, `BoxGeometry`, `PlaneGeometry` calls. Verify by diff of the mesh-construction sections of the source file.
- [ ] **No UV pipeline modifications** — `fixBoxUVs`, `fixStringUVs`, `splitTreadPerimeterByUnderside`, `splitStringCapsByZ` all byte-identical.
- [ ] **No material preset modifications** — `treadMaterial`, `stringMaterial`, `riserMaterial`, `newelMaterial`, `balusterMaterial`, `balusterWhiteMaterial`, `balusterCreamMaterial`, `pineMaterial`, `sheetingMaterial`, `grooveMaterial`, `ledStripMaterial`, `rearAngleBeadMaterial`, and any `rear*Material` instances byte-identical.
- [ ] **No mesh transform modifications** — `mesh.position`, `mesh.rotation`, `mesh.scale`, `castShadow`, `receiveShadow` unchanged.
- [ ] **No baluster / newel / handrail / baserail construction changes.**
- [ ] **No change to `receiveShadow` or `castShadow` on any mesh.**
- [ ] **No change to `TREAD_WIDTH`, `TREAD_DEPTH`, `RISE`, `GOING`, `NOSING`, `STRING_HEIGHT`, `STRING_THICK`, `NEWEL_SIZE`, `BALUSTER_SIZE`, `BALUSTER_SPACING_X`** or any dimensional constant.

**Enforcement:** file diff should show changes only in `src/lib/rendering/` (or equivalent) and in the small integration hooks in the main HTML file (e.g. constructing `RendererManager`).

### 3.1 Wrapped instance parity check

Whenever any THREE.js object (renderer, camera, controls, etc.) is wrapped by a manager, the wrapper MUST preserve every constructor option and post-construction property that the unwrapped instance had.

**Phase 0 RendererManager parity check** — before and after the wrap, the wrapped `WebGLRenderer` must have identical values on all of the following properties:

- [ ] `antialias` (from constructor)
- [ ] `alpha` (from constructor)
- [ ] `shadowMap.enabled`
- [ ] `shadowMap.type`
- [ ] `shadowMap.autoUpdate`
- [ ] `toneMapping`
- [ ] `toneMappingExposure`
- [ ] `outputColorSpace` (if configured)
- [ ] `useLegacyLights` / physically-correct-lights setting (if configured)
- [ ] `setPixelRatio()` argument value
- [ ] `setSize()` width and height
- [ ] `setClearColor()` colour and alpha (if set)
- [ ] Any other property the pre-wrap code writes directly to the renderer

A missing renderer property during the wrap can create a visual difference while everything else appears correct — this check catches that class of defect.

**Verification method:** at Phase 0 completion, log the pre-wrap and post-wrap property values side-by-side in the phase completion record. Any mismatch blocks the phase.

**Applies to future phases too:** whenever a new wrapper is introduced (e.g. a CameraManager wrapping the PerspectiveCamera in a future phase), the same class of parity check applies to that wrapper's target.

---

## 4. Runtime health

- [ ] **No console errors** on page load. `F12` → Console shows zero red messages.
- [ ] **No shader compilation errors** — WebGL context messages clean.
- [ ] **No texture load failures** — Network tab shows 200 OK on every texture URL.
- [ ] **No THREE.js version mismatch warnings.**
- [ ] **No `RectAreaLightUniformsLib` or other addon load failures.**
- [ ] **Mode switch does not error** — Configurator → Photoreal → Studio → Configurator round-trip completes without exception.

---

## 5. Performance checks

- [ ] **Load time not degraded** — page-to-first-render time within 10% of baseline.
- [ ] **Frame rate unchanged or improved** — steady 60 fps in Photoreal mode on the reference device, no less than 30 fps in Configurator mode.
- [ ] **Mode switch time under 1 second** — including any HDRI decode / PMREM generation. If longer, loading indicator shown.
- [ ] **No memory leak on repeated mode switching** — 20 switches Configurator → Photoreal → Configurator does not increase heap size unboundedly.
- [ ] **Bundle size increase reported** — any renderer change that adds > 50 KB gzipped requires explicit approval.

---

## 6. Material Validation Scene

The Material Validation Scene is a fixed test scene containing every common material at fixed positions. Every renderer change is compared against this scene's baseline render.

**Contents (V1 minimum):**
| Position | Material |
|---|---|
| 1 | American White Oak (approved reference) |
| 2 | European Oak (once calibrated) |
| 3 | Walnut (once calibrated) |
| 4 | Ash (once calibrated) |
| 5 | Painted White |
| 6 | Painted Black |
| 7 | Clear Glass |
| 8 | Brushed Stainless Steel |
| 9 | Matte Black Steel |
| 10 | LED strip (emissive, off state and on state) |

**Layout:** ten identical geometry primitives (e.g. rectangular slabs) arranged in a grid on a neutral background. Same camera, same lighting per mode, same environment per mode.

**Purpose:** every renderer change is rendered against this scene in all three modes and diffed against the previous baseline. The change is only approved if:
- Every material improved OR stayed identical, and none regressed.
- Or: if a material regressed, there is an explicit accepted trade-off in writing.

**Deliverable:** to be built as part of Phase 5 (Configurator Mode). Prerequisite for merging Phase 5.

---

## 7. Cross-mode consistency

- [ ] **The user-selected timber / paint / metal is visually identifiable across all three modes.** Walnut in Photoreal looks like Walnut in Configurator looks like Walnut in Studio — same species character, only lighting/environment presentation differs.
- [ ] **No mode looks broken** — Studio Mode is not glowing, Configurator Mode is not flat, Photoreal Mode is not washed.
- [ ] **Mode UI toggle** shows current mode clearly, indicates loading state during HDRI decode.

---

## 8. Sign-off

Every applicable checkbox above must be ticked. Sign-off entry must include:

- Phase name / change description
- Date
- Approver initials
- Composite screenshots (Photoreal, Configurator, Studio, Material Validation Scene per mode) filed in the phase's approved-baseline folder
- Any accepted trade-offs listed explicitly

### 8.1 Phase completion record — template

For every completed phase, produce a completion record and commit it alongside the phase's implementation. This is the historical audit trail: six months from now, when investigating a regression, this record is what identifies when and how the change entered the codebase.

Save each record as `trades/docs/materials/approved/baselines/phase-{N}/COMPLETION.md`:

```markdown
# Phase {N} — Completion Record

Phase:            {N} — {short description, e.g. "LightingManager extraction"}
Status:           PASS | FAIL | PARTIAL
Started:          YYYY-MM-DD
Completed:        YYYY-MM-DD

## Tier results (per §Validation hierarchy)
Tier 1 — Gold Standard Staircase:     PASS | FAIL
Tier 2 — Material Validation Scene:   PASS | FAIL | N/A
Tier 3 — Functional Regression:       PASS | FAIL
Tier 4 — Performance Validation:      PASS | FAIL

## Frozen-code integrity (per §3)
Geometry changes:            None | {list}
UV pipeline changes:         None | {list}
Material preset changes:     None | {list}
Vertex normal changes:       None | {list}
Mesh transform changes:      None | {list}
Dimensional constant changes: None | {list}

## Renderer changes made
{Bullet list of files touched under the renderer module + summary of what each does.}

## Visual regressions
None | {list of surface + change description + accepted-or-blocked}

## Rollback verification
Rollback tag used:           {e.g. nex-staircase-platform-rc1 or phase-{N-1}}
Rollback test result:        PASS | FAIL

## Performance impact
Frame rate at reference device:  Before: __ fps, After: __ fps
Mode-switch time:                Before: __ ms, After: __ ms
Bundle size delta:               +__ KB gzipped

## Sign-off
Approved by:      _______________________
Date:             YYYY-MM-DD
Git commit hash:  _______________________
Git tag applied:  {e.g. rendering-engine-v2.0-phase-0}
```

**Rule:** no phase is considered complete without a signed completion record on disk. A phase that skips this step cannot be tagged and cannot unblock the next phase.

---

## 9. Escalation

If any check fails and cannot be resolved:
- Stop the phase.
- Document the failure in the phase's log.
- Return to design.
- Do not attempt to work around by touching staircase geometry or per-material properties (violates the frozen rule).

---

## 11. Baseline Pack — visual fingerprint for regression detection

The Baseline Pack is a structured set of reference images captured at RC1 tag time. Every renderer change is diffed against this pack — any material that regresses against its baseline blocks the change.

**Location:** `trades/docs/materials/approved/baselines/rc1/`

**Structure:** each image is captured with locked settings (same camera FOV, same resolution, same tone mapping, same exposure). File naming: `{view}_{lights}_{material}.png`.

**7 camera angles:**
- `front`
- `rear`
- `left`
- `right`
- `perspective` (3-Quarter Hero)
- `top`
- `isometric`

**× 2 lighting states:**
- `lights-off` (Stairlights toggle OFF)
- `lights-on` (Stairlights toggle ON)

**× 5 materials at RC1 (Material Validation Scene subset):**
- `oak-white-american` (current default)
- `walnut` (once calibrated — placeholder image if not yet available)
- `paint-white`
- `paint-black`
- `glass-clear`

**Total baseline images at RC1: 7 × 2 × 5 = 70 files.**

As new materials reach APPROVED status (Ash, European Oak, Painted Grey, Brass, etc.), they are added to the pack under the same 7 × 2 grid. Every new material grows the pack by 14 images.

**Regression check on every renderer change:**
1. Re-render every image in the current pack under the same locked settings.
2. Diff each against the RC1 baseline (or the current approved baseline if the material has been updated).
3. Any material with a visible regression blocks the merge.

**Baseline update:**
- The pack is UPDATED (not just captured) whenever the renderer legitimately improves — e.g. when Configurator Mode ships in Phase 5 and Walnut moves from PENDING to APPROVED. The old baseline is preserved in `approved/baselines/rc1/` as-is; new baseline is captured into `approved/baselines/rc{n}/` at each RC bump.
- The Freeze Contract's Golden Rule applies — if any material change would require altering staircase geometry to achieve, STOP and escalate. Never change the geometry to make a baseline pass.

---

## 12. Change log

| Date | Change | Author |
|---|---|---|
| 2026-07-26 | v1.0 — initial checklist established alongside `RENDERING_ENGINE_V1.md` architecture blueprint. | Philip O'Farrell |
| 2026-07-26 | v1.1 — added §11 Baseline Pack structure (7 angles × 2 lighting × 5 materials = 70 images at RC1). Prerequisite artifact for RC1 tag. | Philip O'Farrell |
| 2026-07-26 | v1.2 — added §8.1 Phase completion record template. Every phase must produce a signed completion record before the phase is considered done or the next phase begins. | Philip O'Farrell |
| 2026-07-26 | v1.3 — added §3.1 Wrapped instance parity check (RendererManager and any future wrapper must preserve every constructor option and post-construction property of the wrapped THREE.js instance; mismatch blocks the phase). | Philip O'Farrell |
