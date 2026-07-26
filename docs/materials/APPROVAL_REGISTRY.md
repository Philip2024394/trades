# NEX Material Approval Registry

**Purpose:** Track the approval status of every timber species and finish in the NEX 3D preview and configurator. Approved materials become the visual regression baseline — see `docs/design-system/MATERIAL_CALIBRATION_WORKFLOW.md` §8.

**Reference-image location:** `trades/docs/materials/approved/{species-slug}/` — one folder per species, containing the seven approved composite renders listed in the checklist below.

**How to read the table:**
- `☐` = not yet reviewed / not passing
- `✅` = passed calibration against target, sign-off recorded
- `🔒` = frozen — no changes without full re-calibration

---

## Species — required approval scenarios

Every timber species must pass calibration in **all seven capture scenarios** before it can be marked APPROVED.

| # | Scenario | What it validates |
|---|---|---|
| 1 | Front | Walker-view surfaces (handrail, newel, tread top, riser front) |
| 2 | Rear | Back-of-flight surfaces (string outer, sheeting, riser back) |
| 3 | Underside | Downward-facing surfaces (tread underside, angle blocks, wedges) |
| 4 | Close-up | Grain detail, texture scale, bump response at short distance |
| 5 | Daylight | Neutral daylight HDRI response |
| 6 | Dark background | Reads correctly against low-luminance background — no muddy silhouette |
| 7 | Light background | Reads correctly against high-luminance background — no washed-out silhouette |

---

## Registry

| Species | Slug | Front | Rear | Underside | Close-up | Daylight | Dark BG | Light BG | Status | Notes | Approved By | Date |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|---|---|---|
| American White Oak | `oak-white-american` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | IN CALIBRATION (Photoreal APPROVED-pending-RC1; Configurator DEFERRED to Phase 5) | **Decision 2026-07-26 (Option A):** rear-face darkness confirmed as PBR / current-lighting-environment behaviour, NOT a material or geometry defect. Material assignment audit clean; UV mapping clean; no fallback material; no rendering bug. Under Freeze Contract, no code / material / lighting / camera changes made. RC1 captures current honest PBR output as authoritative baseline (rear darker preserved). **Phase 5 Configurator Mode** (per `RENDERING_ENGINE_V1.md`) is the planned architectural remedy — PMREM environment lighting provides IBL contribution from all directions, resolving rear-face readability at the renderer level without touching materials or staircase engine. Photoreal Mode must remain pixel-identical to RC1 baseline through all phases. Rear-face improvement is provable only against the honest RC1 baseline. Full investigation trail in session logs. | Philip O'Farrell | 2026-07-26 |
| European Oak | `oak-european` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | PENDING | Not yet started. Awaiting American White Oak sign-off to establish baseline workflow. | — | — |
| Walnut | `walnut` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | PENDING | — | — | — |
| Ash | `ash` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | PENDING | — | — | — |
| Pine | `pine` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | PENDING | Currently used as hidden-component material (wedges + angle blocks). Formal calibration required if exposed. | — | — |
| Black Stain | `stain-black` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | PENDING | — | — | — |
| Grey Wash | `wash-grey` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | PENDING | — | — | — |
| White Painted | `painted-white` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | PENDING | Sprayed finish rather than stain. Different lacquer response than translucent finishes. | — | — |

---

## Status glossary

| Status | Meaning |
|---|---|
| **PENDING** | Species not yet calibrated. No reference renders exist. |
| **IN CALIBRATION** | Active tuning in progress. Reference renders being captured and iterated. |
| **AWAITING SIGN-OFF** | All seven scenarios captured and reviewed; awaiting Philip's approval. |
| **APPROVED** | All seven scenarios pass. Reference renders saved to `approved/{slug}/`. Species is now part of the regression baseline. |
| **🔒 FROZEN** | Approved and locked. No renderer or material changes may affect this species without re-calibration and re-sign-off. |
| **QUARANTINED** | A renderer change broke this species. Blocks release until re-tuned and re-approved. |

---

## Sign-off requirements (per species, before APPROVED)

For each species, the sign-off entry must include:
1. All seven scenario composite images stored in `approved/{slug}/`:
   - `01-front.png`
   - `02-rear.png`
   - `03-underside.png`
   - `04-closeup.png`
   - `05-daylight.png`
   - `06-dark-bg.png`
   - `07-light-bg.png`
2. Per-scenario 7-attribute scoring table filed in `approved/{slug}/scoring.md`
3. Approver's initials and calendar date in the registry row above
4. Registry row status updated to `APPROVED` and moved to `🔒 FROZEN` after 24 h with no defect reports

---

## Regression check on any renderer change

Per `MATERIAL_CALIBRATION_WORKFLOW.md` §8: **no renderer change may be merged unless every APPROVED / FROZEN timber still passes visual comparison against its approved reference renders.**

Trigger a full re-render + comparison pass whenever:
- Any file in the lighting rig changes
- HDRI / environment / tone mapping changes
- Renderer settings (shadow map, physicallyCorrectLights, colour space) change
- THREE.js major or minor version upgrade
- Material system refactor
- New global material property added

If any species fails, mark it `QUARANTINED` and block the renderer change until re-tuned.

---

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-07-26 | Registry established. Eight species scaffolded. American White Oak marked IN CALIBRATION. | Philip O'Farrell |
| 2026-07-26 | American White Oak decision recorded (Option A): rear-face darkness confirmed as PBR lighting-environment behaviour, not a material/geometry defect. Deferred to Phase 5 Configurator Mode. Photoreal Mode approved-pending-RC1-capture. Zero code changes made. | Philip O'Farrell |
