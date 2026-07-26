# NEX Material Calibration Workflow

**Version:** 1.0
**Owner:** Philip O'Farrell
**Established:** 2026-07-26
**Status:** Official visual QA standard for the NEX 3D preview and every future timber-based renderer surface.

This document is the source of truth for how material appearance is judged, calibrated, approved and regression-tested at NEX. It replaces any private cache (including Claude project memory) as the authoritative reference.

---

## 1. Calibration philosophy

**The rendered image is the source of truth. Code arithmetic is not.**

Real timber has hue, saturation, contrast, grain depth, lacquer response and shadowing that do not reduce to a brightness calculation. Guessing PBR values from light-intensity math produces "brighter" wood, not "correct" wood. Once the code and the render disagree on how a material looks, the render wins and calibration begins.

Calibration is a visual discipline, not an engineering one. The person or agent tuning the material is acting as a **senior CGI material artist**, not an engineer, until the material is approved.

---

## 2. Capture rules

Every calibration screenshot must be captured under **identical technical conditions** so comparison is meaningful.

| Setting | Locked value |
|---|---|
| Camera FOV | Fixed at the value used for the reference render — do not change between iterations |
| HDRI / environment | Same environment map across target and current |
| Exposure | Same tone-mapping and exposure setting |
| Zoom / distance | Same subject-to-camera distance |
| Render resolution | Same width × height |
| Scene lighting toggles | Documented state (e.g. Stairlights OFF, Sheeting ON) — same for target and current |
| Time of day (if HDRI is time-based) | Same |

If any of these settings differ between the target and current captures, **discard the comparison and re-capture**. Do not attempt to score a mismatched pair.

---

## 3. Composite image layout

Every calibration submission is a **single composite image**, not two separate images.

```
+-----------------------------------------------------------+
| TARGET (Front — American White Oak)                       |
|                                                           |
| [Handrail] [Newel] [Tread] [Riser]                        |
|                                                           |
+-----------------------------------------------------------+
| CURRENT (Rear)                                            |
|                                                           |
| [String] [Sheeting] [Blocks] [Risers] [Undersides]        |
|                                                           |
+-----------------------------------------------------------+
```

The two panels sit in the same image so the reviewer can compare directly without eye-jumping between windows. Aspect ratio and per-panel size must be equal.

---

## 4. Seven-attribute scoring system

Before any code change is proposed, the reviewer scores each attribute on the CURRENT panel with the TARGET panel as a reference of 10/10.

| Attribute | Rear score / 10 | Delta from target |
|---|---|---|
| **Hue** | — | shift in degrees (warmer / cooler) |
| **Brightness** | — | % of target |
| **Saturation** | — | % of target |
| **Grain visibility** | — | % of target contrast |
| **Lacquer sheen** | — | flatter / matches / glossier |
| **Contrast** | — | flatter / matches / higher |
| **Roughness** | — | rougher / matches / smoother |

Findings must be concrete:
- ❌ "it's darker"
- ✅ "brightness is 60 % of target"
- ❌ "the tone is off"
- ✅ "hue is 15° warmer, saturation is +12 %"

---

## 5. Allowed adjustment order

Adjust material properties in this **fixed order** — earlier categories before later ones. This prevents fighting: a change earlier in the list often eliminates the need for later ones.

1. **Base map** (which texture is bound to `.map`)
2. **Colour tint** (`.color`)
3. **Roughness** (`.roughness`, `.clearcoatRoughness`)
4. **Metalness** (`.metalness`)
5. **Bump / normal** (`.bumpMap`, `.normalMap`, `.bumpScale`)
6. **Clearcoat** (`.clearcoat`, `.clearcoatRoughness`)
7. **Emissive** (`.emissive`, `.emissiveMap`, `.emissiveIntensity`) — **always last resort**

Emissive is a *compensation* mechanism, not a primary tuning parameter. If a material needs emissive above 1.0 to look correct, an earlier property is wrong and should be fixed first.

---

## 6. Hard rule — one property per iteration

**Never adjust more than one material property in a single iteration.**

If two properties look wrong, adjust the first one, re-render, re-score, then decide whether the second still needs adjusting. Bundling changes destroys the ability to know what actually improved (or worsened) the render.

Corollary: **one material at a time.** Do not adjust `rearRiserMaterial` and `rearTreadMaterial` in the same iteration.

---

## 7. Acceptance criteria — visual indistinguishability

**The success criterion is visual indistinguishability, NOT mathematical equality.** A calibration is complete only when an experienced observer cannot distinguish the rear (or target) timber from the approved front reference (the Golden Reference — see §9) under the same render conditions.

- All 7 attribute scores at 9/10 or higher
- No single attribute at 7/10 or lower
- Reviewer signs off with initials + date
- Composite images are saved into the material's approved-reference folder

**Until the standard is met, the material stays IN CALIBRATION.** Once it is met, the material moves to APPROVED, then 🔒 FROZEN, and becomes the regression baseline for every future renderer change (see APPROVAL_REGISTRY.md).

A material that cannot be brought to acceptance under the current renderer indicates a renderer limitation, not a material tuning issue — escalate rather than force through with emissive hacks.

---

## 8. Regression process

**Non-negotiable standard:**

> **No renderer change may be merged unless every APPROVED timber still passes visual comparison against its approved reference renders.**

This applies to any change that could affect appearance:
- Lighting rig changes (ambient, hemi, directional lights)
- Scene environment (HDRI, background)
- Tone mapping / exposure
- Renderer settings (shadow map, physicallyCorrectLights)
- THREE.js version upgrade
- Material system refactor
- New material property added

**Process:**
1. Before proposing the renderer change, re-capture the composite for every APPROVED species.
2. Compare against each species' approved reference renders.
3. If any species fails on any attribute → the renderer change is blocked until the material is re-tuned and re-approved.
4. If all pass → the renderer change is safe to merge, and reference renders are updated to reflect the new baseline (with a signed changelog entry).

**Rationale:** premium configurators (automotive, kitchen, luxury furniture) build reference libraries and treat approved renders as the standard. Ongoing renderer tweaks without regression checks cause silent visual drift that destroys the confidence customers have in the tool. NEX operates by the same standard.

---

## 9. Golden Reference Rule

The approved front tread tops and front riser faces are the **Golden Reference** for American White Oak. For every other species, the equivalent front-facing walker-visible surface becomes that species' Golden Reference once approved.

**Every iteration must answer this question first, before any other:**

> **Did the current change move the target surface closer to, further from, or make no difference compared with the Golden Reference?**

Rules:
- **Never evaluate a change in isolation.** Always compare directly against the Golden Reference in the composite.
- **The Golden Reference is fixed** for the duration of a calibration cycle. It does not drift, does not get "reinterpreted", does not get "temporarily lowered" to make the target easier to match.
- The Golden Reference cannot itself be changed without full re-calibration of every already-approved species that used it.

---

## 10. Iteration order — evidence before diagnosis

For every iteration, the sequence is fixed:

1. **Render** the current state.
2. **Observe** the rendered composite.
3. **Describe** exactly what changed since the previous composite in concrete visual terms (grain contrast, warmth, saturation, cream reduction, lacquer match, per-component improvement magnitude).
4. **Score** each of the 7 attributes against the Golden Reference (see §4).
5. **Decide** which of the three outcomes applies:
   - **Outcome 1 — matches Golden Reference:** freeze the change, close the iteration, proceed to remaining components (if any).
   - **Outcome 2 — better but not there yet:** the change was contributory. Keep it. Move to the next-highest-probability candidate for the next iteration.
   - **Outcome 3 — no visible change:** hypothesis disproved. Revert the change. Log the eliminated candidate. Move to the next-highest-probability candidate.
6. **Only after the outcome is decided** may a new single-property change be recommended.

**No diagnosis without observation. No recommendation without evidence.**

---

## 11. Iteration Regression Rule

**If any proposed change makes the target surface FURTHER from the Golden Reference — reject the change immediately.**

- Do not attempt to compensate by stacking additional adjustments on top.
- Revert to the last visually approved state.
- Continue calibration from that reverted state with a different candidate property.

Stacking compensating changes to fix a bad change is the fastest way to lose track of which property is doing what. One property change per iteration, immediate revert on regression, no exceptions.

---

## 12. Related documents

- `APPROVAL_REGISTRY.md` (in `trades/docs/materials/`) — per-species approval tracking, reference-image locations, sign-off records.
- `MATERIAL_ARCHITECTURE.md` (in this folder) — mesh-to-material assignment map, material inheritance tree, naming conventions.
- `NEX_DESIGN_LANGUAGE_v1.md` (in this folder) — visual identity rules that apply above the material level.

---

## 13. Change log

| Date | Change | Author |
|---|---|---|
| 2026-07-26 | v1.0 — initial standard established after emissive-guessing cycle failure on the mat-002 3D preview | Philip O'Farrell |
| 2026-07-26 | v1.1 — added §9 Golden Reference Rule, §10 Iteration order (evidence before diagnosis), §11 Iteration Regression Rule; strengthened §7 Acceptance Criteria with explicit "visual indistinguishability, not mathematical equality" standard | Philip O'Farrell |
