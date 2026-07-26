# NEX Renderer Freeze Contract V1

**Version:** 1.0
**Owner:** Philip O'Farrell
**Established:** 2026-07-26
**Status:** Binding contract on every contributor (human or AI) working on the NEX renderer.

This is not a checklist. A checklist verifies work AFTER the fact. **This contract defines what renderer work is NEVER allowed to touch.** It is enforced BEFORE code is written and referenced during every code review.

---

## Preamble

The NEX staircase engine has reached V1.0 production-ready state after ~40 iterations of material and geometry calibration. It is frozen. All future visual improvements happen at the renderer level.

To prevent scope creep and preserve the frozen state of the staircase engine, every renderer contribution is bound by this contract.

---

## Article 1 — Immutable Components

The renderer implementation **must not modify** any of the following without explicit written approval from Philip O'Farrell:

### 1.1 Staircase geometry
- Tread geometry (`treadGeometry`, `makeTreadGeometry`)
- Riser geometry (created via `makeBox` inside the RISES loop)
- String geometry (`stringGeometry`, `stringShape`)
- Baluster geometry (`balusterGeometry`, `balusterShape`, `makeStopChamferBaluster`)
- Newel geometry (`newelGeometry`, `topNewelDynamicGeometry`)
- Newel cap geometry (`makeNewelCap`)
- Baserail geometry (`baserailGeometry`, `baserailShape`)
- Handrail geometry (`handrailGeometry`)
- Wedge geometry (`treadWedgeGeometry`, `riserWedgeGeometry`)
- Angle block geometry (`blockGeometry`, `blockShape`)
- Sheeting geometry (`sheetingGeometry`)
- Groove geometry (`grooveGeometry`, `beadGeometry`)
- Round starting step geometry (`roundStep1Geom`, `roundStep2Geom`, `makeRoundStepGeometry`)
- LED strip geometry (`ledStripGeometry`)
- Ground / landing / back wall geometry

### 1.2 UV pipelines
- `fixBoxUVs` and every vertex it writes
- `fixStringUVs` block (in-line UV pass on `stringGeometry`)
- `splitTreadPerimeterByUnderside` (geometry post-processor)
- `splitStringCapsByZ` (geometry post-processor)
- Sheeting UV remap block

### 1.3 Vertex normals
- `computeVertexNormals()` invocations
- Any custom normal computation
- The non-indexed geometry structure of extruded meshes

### 1.4 Materials
- `treadMaterial`, `riserMaterial`, `stringMaterial`, `newelMaterial`
- `balusterMaterial`, `balusterWhiteMaterial`, `balusterCreamMaterial`
- `pineMaterial`, `sheetingMaterial`, `grooveMaterial`, `ledStripMaterial`
- `rearAngleBeadMaterial`, `rearStringMaterial`, `rearStringOuterMaterial`, `rearRiserMaterial`, `rearTreadMaterial` — remain defined but unassigned
- Any property on any of the above materials — `map`, `bumpMap`, `bumpScale`, `color`, `roughness`, `metalness`, `clearcoat`, `clearcoatRoughness`, `emissive`, `emissiveMap`, `emissiveIntensity`, `side`, `polygonOffset*`, all others

### 1.5 Material textures
- `baseColorMap`, `carpetMap`
- All `cloneTex()` clones — `riserTex`, `stringTex`, `balusterTex`, `pineTex`, `newelTex`, `sheetingTex`
- Texture URLs, wrapping modes, filtering, colour space, anisotropy

### 1.6 Mesh transforms
- `mesh.position`
- `mesh.rotation`
- `mesh.scale`
- `mesh.quaternion`
- `mesh.castShadow`
- `mesh.receiveShadow`
- Material assignment on any mesh
- Group memberships / scene graph parenting of staircase meshes

### 1.7 Dimensional constants
- `RISE`, `GOING`, `RISES`, `TREADS`
- `NOSING`, `TREAD_DEPTH`, `TREAD_WIDTH`, `TREAD_THICK`
- `STRING_HEIGHT`, `STRING_THICK`, `STRING_TREAD_OVERLAP`, `STRING_NOSING_TOP_OFFSET`
- `NEWEL_SIZE`, `NEWEL_HEIGHT_BOTTOM`
- `BALUSTER_SIZE`, `BALUSTER_SPACING_X`, `BALUSTER_START_X`, `BALUSTER_END_X`, `BALUSTER_RAIL_INSET`
- `RISER_THICK`, `BASERAIL_VERTICAL_HEIGHT`, `HANDRAIL_HEIGHT`, `HANDRAIL_WIDTH`
- `SHEETING_THICKNESS`, `SHEETING_WIDTH`, `ANGLE_BEAD_SIZE`
- `LACQUER_COLOR`, `LACQUER_ROUGHNESS`
- `OVERALL_RISE`, `OVERALL_RUN`
- `pitchAngle`, `pitchCos`, `pitchSin`, `topEdgeY`
- All other dimensional / structural constants defined outside the renderer module

### 1.8 Camera and controls
- Camera preset positions in the `views` dictionary
- `OrbitControls` configuration (min/max polar angle, damping, target)
- `animateCameraTo` implementation
- Walk-up flight animation logic and its phases

### 1.9 User configuration logic
- Baluster swap function (`__nexBalusterFinish`)
- Sheeting add/remove (`__nexSheeting`)
- Round starting step add/remove (`__nexRoundStep`)
- Stairlights toggle logic
- Sheeting tone slider handler
- Varnish toggle handler
- Any window.__nex* exports

---

## Article 2 — Renderer Scope

The renderer implementation **may modify** only the following:

- The THREE.WebGLRenderer instance (its constructor options, `setSize`, `setPixelRatio`, `outputColorSpace`, `toneMapping`, `toneMappingExposure`, `shadowMap.enabled`, `shadowMap.type`)
- `scene.environment` and `scene.background` (via EnvironmentManager)
- PMREM generation and HDRI loading
- Scene light intensity values (mode-driven presets in LightingManager)
- Scene light colours (mode-driven presets — but only within the LightingManager, never inline in the mesh code)
- Scene light positions (mode-driven presets)
- HemisphereLight sky/ground colour parameters (mode-driven presets)
- Ambient light intensity (mode-driven presets)
- Shadow map size, bias, radius (per QualityManager preset)
- Post-processing passes (bloom, SSAO, DOF) — added via EffectComposer only
- Renderer mode configuration objects
- Quality preset configuration objects
- UI controls for mode / quality selection
- Any new class file under the renderer module directory

**All modifications must be inside the dedicated renderer module directory.** Inline modifications to the main HTML file are limited to the integration hooks (constructing `RendererManager`, wiring UI toggles).

---

## Article 3 — Golden Rule

> **If a renderer problem appears to require changing geometry, materials, textures, UVs, or any other Immutable Component listed in Article 1, STOP immediately and report the limitation. Do not attempt to work around by modifying the staircase engine.**

The correct response to such a limitation is:
1. Halt work on the current phase.
2. Document the limitation in writing (file location + specific reason).
3. Propose a renderer-only solution, even if partial.
4. If no renderer-only solution exists, escalate to Philip for a decision on whether to:
   - Accept the limitation as a known constraint of Configurator Mode, or
   - Authorise a specific, minimal, reviewed staircase engine change, or
   - Redesign the renderer approach

Never silently patch a staircase file to fix a renderer issue.

---

## Article 4 — Forbidden Anti-Patterns

The following patterns from prior calibration cycles are explicitly forbidden:

- Adding emissive to any material to compensate for lighting deficits
- Adding hidden fill lights aimed at specific meshes or faces
- Reducing `receiveShadow` or `castShadow` on any mesh to hide shadow-map artefacts
- Splitting geometry to isolate a face with a rendering issue
- Duplicating a material into a `rear*Material` variant with modified properties
- Overriding a single material's roughness / clearcoat to compensate for a lighting effect
- Modifying UV projection to work around a shading artefact
- Bundling multiple phases in a single commit
- Applying "one property tuning" without a diagnostic that establishes the exact target value

---

## Article 5 — Enforcement

- Every renderer commit is reviewed against this contract by human sign-off (Philip or delegated reviewer).
- Any commit that violates Article 1 is rejected and reverted.
- Any commit that violates Article 3 (silently patched staircase without escalation) triggers immediate revert AND requires a written apology to the contract record.
- The contract may only be amended by Philip in writing, appended to the change log below, with a version bump.

---

## Article 6 — Scope of this contract

This contract applies to:
- Every phase of the `RENDERING_ENGINE_V1.md` migration plan
- Every renderer enhancement thereafter
- Every future contributor (human or AI) working in the renderer module

This contract does NOT apply to:
- Staircase engine work — that is governed by its own frozen-state rules
- Application-level features (pricing, BOM, quotation, UI outside the renderer panel)
- Documentation-only changes

---

## Article 7 — Escape hatch

There is exactly one escape hatch. If Philip determines that a renderer-only solution is impossible and that a staircase change is warranted:

1. Philip authorises the change in writing.
2. The change is scoped to a specific file, specific lines, specific reason.
3. The staircase engine version is bumped (see `RENDERING_ENGINE_V1.md` §12 versioning).
4. `APPROVAL_REGISTRY.md` is re-run against every APPROVED species to confirm no regression.
5. The contract change log below is updated.

No other route through Article 1 is permitted.

---

## Article 8 — Universal Benefit Rule

**No renderer feature may be added unless it benefits every staircase and every material.**

Any proposed renderer change must pass this filter before implementation begins:

1. Does the change help every timber species (Oak, Walnut, Ash, Pine, etc.)?
2. Does the change help every paint / stain / finish variant?
3. Does the change help every non-timber material (glass, metal, LED, carpet)?
4. Does the change help every staircase configuration (housed string, cut string, curved, quarter-turn, kite winder)?

If the answer to any of these is "no", the change probably does not belong in the renderer. It likely belongs in:
- The **material library** — if it only benefits one species / finish
- The **staircase engine** — if it only benefits one staircase configuration
- A **material preset** — if it only affects one customer choice

The renderer is a horizontal capability. It elevates every material and every configuration equally, or it stays out.

**Corollary:** if the same renderer change makes Walnut look better but makes Ash look worse, that is not a universal benefit and the change is rejected.

**Long-term principle — Domain Agnosticism:**
The renderer must know nothing about staircases specifically. It sees only:
- Meshes
- Materials
- Lights
- Cameras
- Scene environment

It knows nothing about strings, treads, risers, balusters, newels, or any other staircase-domain concept. That domain knowledge lives in the staircase engine, not the renderer.

Adhering to this principle means the same renderer can eventually be pointed at:
- Staircases (today's use case)
- Doors, kitchens, wardrobes, flooring, furniture, upholstered goods, cabinets (future NEX products)

...with zero renderer changes required per product type. Any renderer code that would reference `treadMaterial`, `stringMaterial`, or any staircase-specific concept is rejected on this principle alone.

**Long-term principle — Renderer Determinism:**

Given a fixed set of inputs:
- Renderer mode (Configurator / Photoreal / Studio)
- Quality level (Draft / Standard / High / Ultra)
- Camera position and orientation
- Material presets assigned to meshes
- Geometry

...the renderer MUST always produce the same image, byte-for-byte where possible, visually identical always.

**Corollary — No side-effect mutations.** Managers must not modify materials or geometry as a side effect of switching modes or quality levels. `LightingManager.applyMode()` must not touch any material property. `EnvironmentManager.setPreset()` must not touch any mesh. `QualityManager.setLevel()` must not touch any material or geometry.

Managers own **renderer state only**. Materials and geometry are inputs to the renderer; they are never outputs of it.

This principle makes regression testing against the Baseline Pack deterministic — any pixel difference between two renders with the same inputs is a bug, not a feature. Without determinism, every regression could be attributed to "well, that mode switched something," and the release gate becomes meaningless.

---

## Article 9 — Signature

By contributing renderer code to NEX, the contributor agrees to abide by this contract.

**Contract holder:** Philip O'Farrell
**Effective from:** 2026-07-26
**Applies to:** all renderer work from Milestone 0 onward

---

## 10. Change log

| Date | Change | Author |
|---|---|---|
| 2026-07-26 | v1.0 — contract established alongside `RENDERING_ENGINE_V1.md` v1.1 and `RENDERER_VALIDATION_CHECKLIST.md`. | Philip O'Farrell |
| 2026-07-26 | v1.1 — added Article 8 Universal Benefit Rule (no renderer feature added unless it benefits every staircase and every material). | Philip O'Farrell |
| 2026-07-26 | v1.2 — added long-term principles to Article 8: Domain Agnosticism (renderer knows nothing about staircase concepts) and Renderer Determinism (same inputs = same output; no side-effect mutations of materials or geometry from manager state changes). | Philip O'Farrell |
