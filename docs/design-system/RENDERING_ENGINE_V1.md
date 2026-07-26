# NEX Rendering Engine V1 — Architecture

**Version:** 1.0 (design only — no implementation code yet)
**Owner:** Philip O'Farrell
**Established:** 2026-07-26
**Status:** Architecture blueprint. Awaiting per-phase implementation approval.

This document is the single source of truth for how the NEX renderer will be organised. It replaces the ad-hoc lighting and material calibration cycles of Q3 2026 with a scalable, mode-aware rendering pipeline.

---

## 1. Purpose

The NEX platform will render hundreds of finishes over its lifetime:
- 80+ timber species (American White Oak, European Oak, Walnut, Ash, Pine, etc.)
- 40+ paint colours (whites, blacks, greys, greens, blues, custom RAL)
- Stains (natural, dark, ebony, weathered)
- Metals (brushed brass, chrome, matte black, patinated)
- Glass (clear, frosted, tinted)
- Stone, concrete, LED accent lighting, carpet finishes

Each new finish must **inherit** consistent rendering behaviour without per-material calibration cycles. That is only possible if visual consistency is a property of the **renderer**, not of the individual material.

This document establishes the modular renderer architecture that makes that possible.

---

## 2. Non-negotiable constraints

Established by Philip 2026-07-26 as inputs to the design:

- **Staircase geometry is FROZEN.** Meshes, UVs, normals, custom UV pipelines, material property values, mesh transforms, shadow settings — no modifications without explicit written instruction. Renderer changes must produce correct results against the CURRENT staircase code.
- **No per-material fixes.** Emissive compensation, hidden fill lights aimed at specific faces, geometry splits, rear-material duplicates, per-material PBR tweaks — all forbidden as solutions to rendering deficits.
- **Global before local.** Any solution must apply uniformly to every material via renderer state. Never one-off overrides.
- **Preserve Photoreal capability.** The renderer must retain the ability to produce physically-accurate architectural renders. Configurator behaviour is an ADDITIONAL mode, not a replacement for physical accuracy.

---

## 3. Design principles

1. **Modes, not overrides.** Rendering behaviour is dictated by a `RendererMode` state. Every mode is a coherent preset touching lighting, environment, tone mapping, and post-processing together. Users switch modes; they do not tune individual settings.

2. **Managers, not settings.** Each subsystem (lighting, environment, tone mapping, post-processing) is encapsulated in a manager with a clean public API. No direct manipulation of THREE.js renderer/scene properties from outside.

3. **Materials are dumb.** A material declares "I am oak with these PBR properties." It does not know or care about which mode is active or whether it's front- or rear-facing. The renderer makes it look right regardless.

4. **Scale by inheritance, not by tuning.** New timber species, paints, metals inherit the mode's rendering behaviour automatically. Adding a new material is registering a preset — never a calibration cycle.

5. **Modes are declarative.** A mode is a configuration object, not a code path. Adding a new mode (e.g. "Diagram Mode" for technical drawings, "Night Mode" for dramatic scenes) means adding a config, not rewiring the pipeline.

---

## 4. Module architecture

Six modules. Each has a single responsibility, a public API, and a clean interface with the others.

```
┌────────────────────────────────────────────────────────────┐
│                    RendererManager                          │
│                  (top-level coordinator)                    │
├────────────────────────────────────────────────────────────┤
│  currentMode : RendererMode                                 │
│  setMode(mode)                                              │
│  render(scene, camera)                                      │
└─────────┬──────────────┬──────────────┬─────────┬──────────┘
          │              │              │         │
          ▼              ▼              ▼         ▼
   ┌──────────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────┐
   │Environment   │ │Lighting     │ │ToneMap   │ │PostProcessing│
   │Manager       │ │Manager      │ │Manager   │ │Manager       │
   ├──────────────┤ ├─────────────┤ ├──────────┤ ├──────────────┤
   │PMREM         │ │Directional  │ │Algorithm │ │Composer      │
   │HDRI          │ │Hemisphere   │ │Exposure  │ │Bloom (later) │
   │envIntensity  │ │Ambient      │ │Whitepoint│ │AO (later)    │
   │              │ │Presets      │ │          │ │              │
   └──────────────┘ └─────────────┘ └──────────┘ └──────────────┘
```

### 4.1 RendererManager

**Responsibility:** top-level coordinator. Owns the THREE.WebGLRenderer instance. Manages the active `RendererMode`. Delegates configuration to the four subordinate managers.

**Public API:**
```
class RendererManager {
  constructor(canvas, config)
  setMode(mode)                    // switches all sub-managers to the mode's preset
  getMode()
  render(scene, camera)            // called every frame
  setSize(width, height)
  dispose()

  readonly threeRenderer            // exposed for camera controls only
  readonly environmentManager
  readonly lightingManager
  readonly toneMappingManager
  readonly postProcessingManager
}
```

**Does NOT:**
- Own scene meshes
- Own lights directly (LightingManager does)
- Know about specific materials

### 4.2 EnvironmentManager

**Responsibility:** image-based lighting. Loads HDRIs or built-in cubemaps, generates PMREMs via `THREE.PMREMGenerator`, assigns `scene.environment` and optionally `scene.background`.

**Public API:**
```
class EnvironmentManager {
  constructor(threeRenderer, scene)
  loadHDRI(url, options)
  useBuiltIn(preset)               // "neutral", "studio", "sunlit", "night", etc.
  setIntensity(value)              // globally scales environment contribution
  setBackground(showEnvironment)
  applyMode(mode)                  // called by RendererManager on mode switch
}
```

**Mode-specific behaviour** (configuration only, not conditional logic):
- Configurator: bright warm-neutral PMREM, environment shown as backdrop off (kept neutral background).
- Photoreal: HDRI matching the intended scene setting; environment optionally visible.
- Studio: white / very light PMREM; solid neutral background.

**Handles the primary technical mechanism** for eliminating rear-face darkness: IBL contribution from all directions provides "ambient from everywhere" without hidden fill lights or emissive compensation.

### 4.3 LightingManager

**Responsibility:** owns all scene lights (directional, hemispheric, ambient, point, spot). Owns Stairlights (which is currently window.__nexStairlights). Provides mode-specific light presets.

**Public API:**
```
class LightingManager {
  constructor(scene)
  applyMode(mode)                  // sets intensities/colours/positions per mode
  setLightIntensity(name, value)   // manual override, escape hatch
  setStairlightsMode(on|off)       // preserves current Stairlights toggle
}
```

**Mode-specific behaviour:**
- Configurator: reduced key intensity (~0.6), balanced fill (~0.5), warmer hemi ground (avoids `0x3a2f24` dark brown), so environment contribution dominates and directional lights add depth without dark rear faces.
- Photoreal: current lighting rig (key 1.4, fill 0.35, rim 0.5, hemi with dark ground). Strong contrast, dramatic shadows.
- Studio: minimal directional lights, environment does most of the work. Very even soft lighting.

**Never:**
- Add per-mesh fill lights
- Add lights specifically aimed at rear faces of specific components

### 4.4 ToneMappingManager

**Responsibility:** governs how HDR renderer output is mapped to display-referred colours.

**Public API:**
```
class ToneMappingManager {
  constructor(threeRenderer)
  setAlgorithm(algo)              // ACESFilmic, Neutral, Linear, Reinhard, Cineon
  setExposure(value)
  applyMode(mode)
}
```

**Mode-specific behaviour:**
- Configurator: `ACESFilmicToneMapping` or `NeutralToneMapping` (test both), exposure ~1.0 — gives clean colour reproduction of finishes.
- Photoreal: `ACESFilmicToneMapping`, exposure tuned for HDRI dynamic range.
- Studio: `NeutralToneMapping`, exposure ~1.0 — accurate colour, no film-look bias.

Tone mapping is a decisive factor in how timber colour is perceived. This module's presets are where "Walnut should look like walnut, not like burnt oak" gets enforced globally.

### 4.5 PostProcessingManager

**Responsibility:** optional screen-space effects via `EffectComposer`. Kept minimal in V1. Reserved for future enhancement.

**Public API:**
```
class PostProcessingManager {
  constructor(threeRenderer, scene, camera)
  addPass(pass)
  removePass(name)
  applyMode(mode)
  isEnabled()
}
```

**Mode-specific behaviour:**
- Configurator: OFF by default (no bloom, no DOF — keep colours pure).
- Photoreal: subtle bloom on emissive surfaces (LED strips), optional SSAO for depth.
- Studio: OFF.

**Roadmap:** SSAO for depth cues in later versions; bloom for emissive accent; DOF for cinematic marketing renders.

### 4.6 QualityManager — orthogonal quality preset

**Responsibility:** owns the quality-level state, separate from mode. Applies device-appropriate render-quality settings that do not change the visual mode identity.

**Public API:**
```
class QualityManager {
  constructor(threeRenderer, environmentManager, postProcessingManager)
  setLevel(level)                  // 'draft' | 'standard' | 'high' | 'ultra'
  getLevel()
  applyMode(mode)                  // reads mode to apply mode-x-quality combinations
}
```

**Quality preset dimensions:**
- Shadow map size (`1024`, `2048`, `4096`, `8192`)
- Anisotropic filtering level
- Environment PMREM resolution (`128`, `256`, `512`, `1024`)
- PostProcessing enable flags per mode
- `renderer.setPixelRatio` cap
- Antialiasing (MSAA vs FXAA vs none)

**Presets:**
| Level | Shadow map | Anisotropy | PMREM | Pixel ratio cap | Antialiasing | Post-processing |
|---|---|---|---|---|---|---|
| **Draft** | 1024 | 4 | 128 | 1.0 | none | off |
| **Standard** | 2048 | 8 | 256 | 1.5 | FXAA | off |
| **High** | 4096 | 16 | 512 | 2.0 | MSAA 4x | mode-default |
| **Ultra** | 8192 | max | 1024 | 2.0 | MSAA 8x | mode-max |

**Mode × Quality matrix** — quality applies within any mode. A user on a low-end laptop can select Configurator + Draft; a designer preparing a screenshot uses Studio + Ultra.

### 4.7 Not a manager, but declared for completeness — RendererMode

Not a class. A declarative configuration object:

```
const RendererMode = {
  Configurator: {
    id: 'configurator',
    label: 'Configurator',
    description: 'Customer-facing finish selection. Every material visible.',
    environment: { preset: 'neutral-warm', intensity: 1.0, showBackground: false },
    lighting:    { key: 0.6, fill: 0.5, rim: 0.3, hemi: 0.5, hemiGround: 0xa89070, ambient: 0.2 },
    toneMapping: { algorithm: 'ACESFilmic', exposure: 1.0 },
    postProcess: { enabled: false }
  },
  Photoreal: {
    id: 'photoreal',
    label: 'Photoreal',
    description: 'Marketing renders. Physical accuracy.',
    environment: { preset: 'showroom-hdri', intensity: 0.8, showBackground: true },
    lighting:    { key: 1.4, fill: 0.35, rim: 0.5, hemi: 0.35, hemiGround: 0x3a2f24, ambient: 0.25 },
    toneMapping: { algorithm: 'ACESFilmic', exposure: 1.0 },
    postProcess: { enabled: true, bloom: { threshold: 0.9, strength: 0.4 } }
  },
  Studio: {
    id: 'studio',
    label: 'Studio',
    description: 'Product page presentation. Clean, even, colour-accurate.',
    environment: { preset: 'white-studio', intensity: 1.2, showBackground: false },
    lighting:    { key: 0.4, fill: 0.4, rim: 0.2, hemi: 0.6, hemiGround: 0xd0c0b0, ambient: 0.3 },
    toneMapping: { algorithm: 'Neutral', exposure: 1.0 },
    postProcess: { enabled: false }
  }
}
```

Adding a new mode = adding a config object. Zero pipeline changes.

---

## 5. Data flow

```
User picks material (from configurator UI)
      │
      ▼
   Material assigned to mesh via existing MaterialManager (external to this doc; staircase-side)
      │
      ▼
Frame render:
   RendererManager.render(scene, camera)
      │
      ├─→ EnvironmentManager already applied scene.environment (set once at mode-switch)
      ├─→ LightingManager lights are children of scene (added once at mode-switch)
      ├─→ ToneMappingManager set threeRenderer.toneMapping (set once at mode-switch)
      ├─→ PostProcessingManager either uses composer.render() or falls through to threeRenderer.render()
      │
      ▼
Pixel output on canvas
```

Mode switch:
```
User selects mode
      │
      ▼
RendererManager.setMode(newMode)
      │
      ├─→ EnvironmentManager.applyMode(newMode)     // may async load HDRI
      ├─→ LightingManager.applyMode(newMode)        // updates intensities/colours
      ├─→ ToneMappingManager.applyMode(newMode)     // sets algorithm + exposure
      ├─→ PostProcessingManager.applyMode(newMode)  // enables/disables composer
      │
      ▼
Next render frame uses the new mode
```

Materials are never touched during a mode switch. Meshes are never touched. Geometry is never touched.

---

## 6. Migration plan — from `mat-002-flight-3d.html` to modular architecture

The current file has ~2000 lines with lighting, environment, materials, meshes, and controls interleaved. Migration is incremental — no big-bang rewrite.

### Phase 0 — establish module skeletons (no visible change)
- Create `src/lib/rendering/` directory (or equivalent location).
- Add empty `RendererManager`, `EnvironmentManager`, `LightingManager`, `ToneMappingManager`, `PostProcessingManager` classes.
- Wire `RendererManager` into `mat-002-flight-3d.html`, replacing the direct `new THREE.WebGLRenderer(...)` call.
- Verify: page renders identically to before.

### Phase 1 — extract lighting into LightingManager
- Move the 5 scene lights (`ambientLight`, `hemiLight`, `keyLight`, `fillLight`, `rimLight`) into LightingManager.
- LightingManager exposes them via `.lights.key`, `.lights.fill`, etc. — Stairlights toggle continues to work through this indirection.
- No mode switching yet; LightingManager just holds current values.
- Verify: identical render.

### Phase 2 — extract tone mapping into ToneMappingManager
- Move `renderer.toneMapping = ...` and `renderer.toneMappingExposure = ...` into ToneMappingManager.
- No mode switching yet.
- Verify: identical render.

### Phase 3 — add EnvironmentManager with PMREM support
- New class. Provides `loadHDRI()` and `useBuiltIn()` methods.
- Initially: no environment map assigned — scene.environment stays null. Behaviour unchanged.
- Verify: identical render.

### Phase 4 — introduce RendererMode as a declarative preset
- Define the three mode objects.
- `RendererManager.setMode(mode)` dispatches to each sub-manager.
- Ship with default mode = `Photoreal` — so nothing changes visually.
- Verify: identical render in Photoreal mode.

### Phase 5 — implement Configurator Mode
- Add UI toggle in the right-hand panel (near Stairlights).
- Verify Configurator mode produces the intended finish-accurate appearance across all faces.
- **This is the milestone where American White Oak reaches APPROVED status in the material registry.**

### Phase 6 — implement Studio Mode
- Third preset.
- Add third UI toggle position.
- Verify white-background clean product-shot appearance.

### Phase 7 — post-processing (optional, later)
- Bloom on Photoreal mode for LED strip glow.
- SSAO if depth cues become needed.

---

## 7. Implementation phases — order of delivery

Each phase is independently reviewable and independently rollback-able. No phase blocks another mode's development.

| Phase | Deliverable | Renders identically to today? | Notes |
|---|---|---|---|
| 0 | Module skeletons + RendererManager wired | Yes | Pure refactor |
| 1 | LightingManager owns the 5 scene lights | Yes | Pure refactor |
| 2 | ToneMappingManager owns tone mapping | Yes | Pure refactor |
| 3 | EnvironmentManager exists (no env yet) | Yes | Additive infrastructure |
| 4 | RendererMode object + mode dispatch | Yes (Photoreal default) | Presets defined, not switched |
| 5 | Configurator Mode implemented + UI toggle | Photoreal identical; Configurator new | American White Oak passes calibration |
| 6 | Studio Mode implemented + UI toggle | Photoreal and Configurator identical to Phase 5 | Third mode available |
| 7 | Post-processing extensions | Optional | Phased over time |

---

## 8. Testing approach

Every phase must pass **`RENDERER_VALIDATION_CHECKLIST.md`** before merge — the checklist is the release gate. Key points from that document:

- **Photoreal Mode pixel-identical** to baseline for Phases 0–4 (pure refactor phases).
- **Material Validation Scene** — fixed scene containing every common material (Oak, Walnut, Ash, Painted White, Painted Black, Glass, Steel, LED). Every renderer change is rendered against this scene in all three modes and diffed against the previous baseline. Change is approved only if every material improved or stayed identical.
- **Approval registry check**: at Phase 5, run American White Oak through the 7-attribute scoring (from `MATERIAL_CALIBRATION_WORKFLOW.md` §4). Passing = APPROVED. Failing = Phase 5 not done.
- **Every future material change**: check against approved reference renders in Photoreal AND Configurator modes per `APPROVAL_REGISTRY.md` §Regression check.
- **Mode switch performance**: sub-second visual transition. HDRI loads may be async; UI shows a loader.
- **Quality level tests**: each Mode × Quality combination (Configurator×Draft through Studio×Ultra) validated on the reference device before quality dropdown ships.

**Phase-by-phase execution rule (Philip 2026-07-26):** do NOT bundle phases. Implement Phase 0 alone, pass the checklist, commit. Then Phase 1 alone. Then Phase 2 alone. And so on. Combining phases makes regression isolation exponentially harder.

---

## 9. Extension points

The architecture is designed to accept the following without pipeline changes:

- **New timber species / paint / metal / glass** — register as a material preset (no renderer change).
- **New mode** — add a `RendererMode` config object.
- **HDRI library** — pre-baked PMREMs cached in a materials-library CDN.
- **New light type** (e.g. area lights for LED tape) — subclass in LightingManager, mode presets pick it up.
- **New post effect** (bloom, SSAO, DOF, colour grade LUT) — add a pass to PostProcessingManager, mode presets enable/disable.
- **Screenshot API** for the marketing renderer — additional method on RendererManager that switches to Photoreal, renders, restores mode.
- **Regression pack** for approved species — automated per-mode diff against baseline renders.

---

## 10. Independent versioning — Staircase Engine / Rendering Engine / Material Library

The three subsystems evolve independently. Their versions must be stated separately in every release note:

```
NEX Platform Composition
──────────────────────────
Staircase Engine    v1.0    frozen — see RENDERER_FREEZE_CONTRACT §1
Rendering Engine    v1.0    legacy — being replaced by V2 per this document's migration plan
Material Library    v1.0    current base + rear-material family
```

**Semver applied per subsystem:**
- MAJOR: breaking public API change or Immutable Component modification (staircase engine).
- MINOR: additive feature (new mode, new species, new quality preset).
- PATCH: bug fix that does not change appearance or public API.

**Version compatibility matrix** (published with each release):

| Staircase Engine | Rendering Engine | Material Library | Notes |
|---|---|---|---|
| 1.0 | 1.0 | 1.0 | Current state (pre-Milestone 0) |
| 1.0 | 2.0 | 1.0 | After Configurator Mode ships (Phase 5) |
| 1.0 | 2.x | 1.x | Adding new species does not require renderer bump |
| 2.0 | 2.x | 1.x | Would require staircase engine change — RARE, escape-hatch only |

**Never assume the three subsystems evolve together.** A rendering-engine minor bump does not imply staircase-engine or material-library changes.

---

## 11. RC1 — NEX Staircase Platform Release Candidate 1 (prerequisite to Phase 0)

Before any renderer implementation begins, the current state is packaged as a Release Candidate — the permanent reference build that everything else measures against.

**RC1 contents:**
- Staircase Engine v1.0
- Rendering Engine v1.0 (legacy — replaced by V2 modular architecture)
- Material Library v1.0
- Governance docs v1.2 (this doc + `RENDERER_VALIDATION_CHECKLIST.md` + `RENDERER_FREEZE_CONTRACT.md`)
- Baseline Pack RC1 (see `RENDERER_VALIDATION_CHECKLIST.md` §11)

**Steps to produce RC1:**
1. **Baseline Pack** — capture the full baseline pack per `RENDERER_VALIDATION_CHECKLIST.md` §11 (7 camera angles × 2 lighting states × 5 materials = 70 reference images). Save into `trades/docs/materials/approved/baselines/rc1/`.
2. **Tag Staircase Engine v1.0** — `git tag -a staircase-engine-v1.0 -m "RC1 frozen per RENDERER_FREEZE_CONTRACT"`
3. **Tag Rendering Engine v1.0 (legacy)** — `git tag -a rendering-engine-v1.0-legacy -m "RC1 pre-modular renderer"`
4. **Tag Material Library v1.0** — `git tag -a material-library-v1.0 -m "RC1 material base + rear-material family"`
5. **Tag the platform RC** — `git tag -a nex-staircase-platform-rc1 -m "Reference build; foundation for renderer V2 migration"`
6. **Commit the three governance docs**.
7. **Verify** — checkout `nex-staircase-platform-rc1` in a fresh clone; visual output must match the Baseline Pack exactly.

**Only after RC1 is tagged may Phase 0 begin.**

RC1 is the permanent rollback point and the visual fingerprint against which every future renderer change is diffed.

### 11.1 Gold Standard Staircase (RC1 reference model)

The **Gold Standard Staircase** is one specific staircase configuration that exercises almost every rendering challenge in the system. It is the primary visual benchmark: every renderer change is judged first against this configuration BEFORE the broader Material Validation Scene.

**Gold Standard configuration:**
- Straight flight (13 rises, standard dimensions from current file)
- Open string on both sides
- American White Oak (primary timber)
- Glass balustrade panels (replaces balusters in this configuration)
- Timber handrail (Oak)
- Stainless steel fixings (baluster shoes, connectors)
- LED tread lighting — **enabled** (Stairlights ON)
- Sheeting on the back — **enabled**
- One rounded starting tread (Round Starting Step toggle ON)
- One newel at bottom, one newel at top

**Why this configuration:** it combines every material family the renderer must handle at V1 — timber, glass, metal, emissive LED, painted-free wood. Any renderer change that presents this staircase correctly across all three modes has proven itself against the widest range of surface types simultaneously.

**Location:** stored as the primary reference build tagged `nex-staircase-platform-rc1`. Baseline Pack captures apply to this configuration (see `RENDERER_VALIDATION_CHECKLIST.md` §11). If any renderer experiment produces unacceptable regression, `git checkout nex-staircase-platform-rc1` restores the known-good foundation.

---

## 11.5 Acceptance criteria per mode

The renderer is complete for a given mode when the mode meets all of its acceptance criteria. Not "does this one string look better" — mode-level success only.

**Configurator Mode — customer-facing default**
- Every material in the Baseline Pack is clearly distinguishable from every other.
- Rear-facing surfaces remain readable (not black, not muddy).
- Colour differences between materials are preserved (Oak reads as different from Walnut, White Paint reads as different from Painted Cream).
- Frame rate stable at the target for the tester's device / quality level.
- Zero staircase code changes required to achieve any of the above.

**Photoreal Mode — marketing renders**
- Marketing-image quality (subjective standard; final call by Philip).
- Natural shadows preserved (no shadow flattening).
- Physically plausible lighting (no artificial rear-fills, no emissive on wood).
- High realism — visible depth, contrast, specular highlights on lacquered surfaces.

**Studio Mode — product page / catalogue presentation**
- Neutral background (near-white).
- Uniform illumination — every visible surface reads at similar brightness.
- Colour-accurate — timber species match approved reference colour values.
- No dramatic shadows, no artistic lighting bias.
- Ideal for documentation, catalogues, comparison grids.

Modes are approved individually. Configurator Mode being approved does not depend on Photoreal Mode being approved and vice versa.

---

## 12. What this document does NOT cover

- Material definitions themselves (that lives in `MATERIAL_ARCHITECTURE.md`)
- Calibration workflow (that lives in `MATERIAL_CALIBRATION_WORKFLOW.md`)
- Approval registry (that lives in `APPROVAL_REGISTRY.md`)
- Staircase geometry (frozen; see the memory pointer + `staircase-canonical-knowledge-from-philip-v1.md`)
- Camera controls, orbit behaviour, UI framework
- Business logic (pricing, BOM, quotation)

Those are separate systems that interact with the renderer through clean interfaces but are not the renderer's concern.

---

## 11. Change log

| Date | Change | Author |
|---|---|---|
| 2026-07-26 | v1.0 — initial architecture. Established after material-calibration cycles concluded that per-material fixes do not scale. | Philip O'Farrell |
| 2026-07-26 | v1.1 — added §4.6 QualityManager (four levels: Draft / Standard / High / Ultra as an axis orthogonal to Mode); tied testing approach to `RENDERER_VALIDATION_CHECKLIST.md`; added Material Validation Scene requirement (Phase 5 prerequisite); locked in phase-by-phase execution rule (no bundling). | Philip O'Farrell |
| 2026-07-26 | v1.2 — added §10 Independent versioning (Staircase Engine / Rendering Engine / Material Library evolve separately) and §11 Milestone 0 Freeze & Tag prerequisite. Cross-linked `RENDERER_FREEZE_CONTRACT.md` v1.0 as the enforcement mechanism for the frozen-geometry rule. | Philip O'Farrell |
