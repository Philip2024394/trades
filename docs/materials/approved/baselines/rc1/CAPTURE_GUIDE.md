# RC1 Baseline Pack — Capture Guide

**Version:** 1.0
**Owner:** Philip O'Farrell
**Established:** 2026-07-26
**Purpose:** Procedure for producing the RC1 Baseline Pack — the permanent visual fingerprint against which every future renderer change is diffed.

---

## 1. Prerequisites — before you start

- Clean checkout of `main` (or the branch that will be tagged as RC1).
- Browser open at `http://localhost:3008/staircase-preview/mat-002-flight-3d.html`.
- Console (F12) open — no red errors on load; hard-refresh (Ctrl+Shift+R) with cache disabled.
- No local edits in progress.
- Same OS, same browser, same GPU as you intend to use for all future RC1 regression checks. **Different hardware / browser / OS may produce sub-pixel differences that void the baseline.**

## 2. Gold Standard Staircase configuration

The current default configuration IS the Gold Standard for RC1. At page load:
- Straight flight, 13 rises, 12 treads (dimensional constants unchanged)
- Housed strings, 32 mm oak lamwood (per current file)
- American White Oak — the base timber
- Balustrade: 41 × 41 × 900 mm oak balusters (Oak swatch selected — the leftmost circular swatch, orange border)
- Timber handrail + baserail
- Round Starting Step: **ON**
- Sheeting: **ON**
- Stairlights: **ON** for one capture pass, **OFF** for the other
- Varnish: **ON** (default)

The full Gold Standard is captured in Photoreal Mode (which is the current renderer state — Configurator and Studio Modes don't exist yet, so Photoreal is captured now and additional modes' baselines are added when those phases ship).

## 3. Camera views — 7 fixed presets

Use the existing view buttons in the top-right panel. Click each button, wait for the ease-in animation to complete (approximately 1 second), then capture. Do not adjust the camera between views. Do not orbit or pan.

| # | Philip's spec | Existing button label | Purpose |
|---|---|---|---|
| 1 | Perspective Hero | **3-Quarter Hero** | Overall impression |
| 2 | Front Elevation | **Front Elevation** | Material consistency, tread top + riser front |
| 3 | Rear Elevation | **Back of Stairs** | Rear-face validation (string outer face, sheeting) |
| 4 | Left Elevation | **Side Elevation** | String validation (one side) |
| 5 | Right Elevation | *(no button — see note below)* | String validation (other side) |
| 6 | Top / Plan | **Top Plan** | Treads + handrail from above |
| 7 | Detail Close-up | **Standing at Foot** | Close range — bottom bullnose + newel + LED strip |

**Right Elevation note:** the current camera preset dictionary has one "Side Elevation" only. For RC1, capture the equivalent Right Elevation by:
- (a) Clicking "Side Elevation", then rotating the model 180° by dragging the canvas OR
- (b) Skipping this view for RC1 and adding a "Right Elevation" preset in a future non-renderer change (via a small addition to the `views` dictionary, which requires explicit approval per Freeze Contract Article 1.8).

**Recommendation:** capture (a) for RC1 to preserve the deterministic viewpoint, note the orbit position numerically, and add a proper Right Elevation preset later as a discrete change.

## 4. Render settings — LOCKED

Before capturing ANY image, confirm all of the following. Deviation invalidates the pack.

| Setting | Value |
|---|---|
| Renderer Mode | Photoreal (only mode currently implemented) |
| Renderer Quality | High (or the equivalent current default) |
| Canvas resolution | Full browser window at fixed dimensions (see §7 manifest) |
| Device Pixel Ratio | Fixed — do not change zoom |
| Browser zoom | 100 % — never adjust |
| Window size | Fixed pixel dimensions — record in manifest |
| Tone mapping | Whatever the current `renderer.toneMapping` is set to (do not modify) |
| Exposure | Whatever the current `renderer.toneMappingExposure` is set to (do not modify) |
| Camera FOV | Whatever the current camera is initialised with (do not modify) |
| Ambient / hemi / key / fill / rim lights | All at current default intensities (do not modify) |
| Varnish toggle | ON |
| Sheeting toggle | ON |
| Round Starting Step | ON |
| Baluster swatch | Oak (leftmost, orange border) |

The ONLY variable across the pack is:
- Which camera view is active
- Whether Stairlights is ON or OFF

Nothing else changes.

## 5. Materials to capture at RC1

**Current implementation state:** the code implements one timber species only — American White Oak — plus three baluster finish variants (Oak / White stop-chamfered / Cream).

European Oak, Walnut, Ash, Painted White etc. do NOT yet exist as material presets. They are added in a future material-library update, at which point the Baseline Pack grows.

**RC1 pack scope (achievable today):**
- American White Oak with **Oak** balusters — 7 views × 2 lighting states = **14 images**
- (Optional additions at RC1, if you want to lock in the baluster variants now:)
  - American White Oak with **White stop-chamfered** balusters — 7 views × 2 lighting = 14 images
  - American White Oak with **Cream chamfered** balusters — 7 views × 2 lighting = 14 images

**Minimum RC1 pack: 14 images.** Full baluster-variant pack: 42 images.

Any additional wood species / paint / stain / metal / glass baseline is added when those material presets ship — the pack grows over time.

## 6. Folder structure & filename convention

Deterministic. No dates in filenames (versioning belongs to git tags, not filenames).

```
trades/docs/materials/approved/baselines/rc1/
├── CAPTURE_GUIDE.md                          (this file)
├── MANIFEST.md                               (per §7 template)
└── photoreal/
    └── american-white-oak/
        ├── baluster-oak/
        │   ├── hero_lights-off.png
        │   ├── hero_lights-on.png
        │   ├── front_lights-off.png
        │   ├── front_lights-on.png
        │   ├── rear_lights-off.png
        │   ├── rear_lights-on.png
        │   ├── left_lights-off.png
        │   ├── left_lights-on.png
        │   ├── right_lights-off.png
        │   ├── right_lights-on.png
        │   ├── top_lights-off.png
        │   ├── top_lights-on.png
        │   ├── detail_lights-off.png
        │   └── detail_lights-on.png
        ├── baluster-white/          (optional)
        │   └── (same 14 files)
        └── baluster-cream/          (optional)
            └── (same 14 files)
```

Filename pattern: `{view}_{lights-state}.png` where view is one of `hero | front | rear | left | right | top | detail` and lights-state is `lights-off | lights-on`.

## 7. Capture manifest — MANIFEST.md template

Save the following as `trades/docs/materials/approved/baselines/rc1/MANIFEST.md` alongside the images:

```markdown
# RC1 Baseline Pack — Capture Manifest

## Version fingerprint
- Rendering Engine version:      v1.0 (legacy — pre-modular)
- Staircase Engine version:      v1.0
- Material Library version:      v1.0
- Governance docs snapshot:      RENDERING_ENGINE_V1 v1.3, RENDERER_VALIDATION_CHECKLIST v1.1, RENDERER_FREEZE_CONTRACT v1.2

## Render settings
- Renderer Mode:                 Photoreal
- Quality Level:                 High (current default)
- Canvas width × height:         ____ × ____ px (record actual values)
- Device Pixel Ratio:            ____
- Browser zoom:                  100%
- Tone mapping:                  ____ (current default)
- Exposure:                      ____ (current default)
- Camera FOV:                    ____°

## Environment
- Browser:                       ____ v____
- GPU:                           ____
- OS:                            ____
- Screen resolution:             ____ × ____ px

## Configuration
- Varnish:                       ON
- Sheeting:                      ON
- Round Starting Step:           ON
- Baluster finish(es) captured:  Oak / White stop-chamfer / Cream
- Species captured:              American White Oak

## Sign-off
- Captured by:                   ____________________
- Date:                          ____________________
- Git commit hash:               ____________________
- Git tag applied:               nex-staircase-platform-rc1

## Notes
- Right Elevation view captured via free-orbit from Left Elevation position + 180° rotation.
  Numerical orbit end position: azimuth ____, polar ____.
- (Any other capture-time observations)
```

## 8. Step-by-step procedure

Repeat for each baluster finish (Oak, White, Cream).

**A. Preparation**
1. Hard refresh (Ctrl+Shift+R) with DevTools Network tab open, Disable cache ticked.
2. Confirm `mat-002-flight-3d.html` loads with status 200, not from cache.
3. Confirm no red errors in Console.
4. Ensure browser is at 100% zoom, window at target dimensions (record in manifest).

**B. Set the baluster finish**
5. Click the target baluster swatch (Oak / White / Cream). Confirm the border of the active swatch turns orange.

**C. Ensure default toggle state**
6. Confirm Varnish is ON (default).
7. Confirm Sheeting is ON (click if not).
8. Confirm Round Starting Step is ON (click if not).
9. Confirm Stairlights is OFF for the first capture pass.

**D. First pass — Stairlights OFF**
10. Click view button 1 (`3-Quarter Hero`). Wait for the camera animation to settle (~1 second).
11. Capture the canvas (screenshot tool or DevTools screenshot).
12. Save to `photoreal/american-white-oak/baluster-{finish}/hero_lights-off.png`.
13. Repeat steps 10–12 for each of the 7 views.

**E. Second pass — Stairlights ON**
14. Click the Stairlights toggle. Confirm the button turns orange and scene background darkens.
15. Repeat steps 10–12 for each of the 7 views, saving with the `_lights-on` suffix.

**F. Verify**
16. Confirm 14 files exist for this baluster finish.
17. Open each file and visually confirm nothing is corrupted / cropped / mis-labelled.

**G. Optional — capture additional baluster finishes**
18. Repeat B–F for White and Cream if you want the full 42-image pack.

## 9. Acceptance criteria — pack is complete only if

- [ ] All target images exist at the expected file paths (14 minimum / 42 for full baluster set)
- [ ] Filenames match the convention in §6
- [ ] Every image loads (open each one to verify)
- [ ] No camera drift between paired lights-off / lights-on captures (compare pairs — subject should be in identical framing)
- [ ] No accidental exposure differences (histogram spot-check first and last capture in the pack)
- [ ] No missing material variant (if capturing baluster set)
- [ ] No missing view
- [ ] Manifest completed with all required version, environment, and sign-off fields
- [ ] Manifest committed alongside the images

**Do not create the git tags until every acceptance criterion is checked.**

## 10. Next step — dual-tag sequence (workflow checkpoints + version identity)

Both tag families are used. **Workflow tags** answer "where are we in the engineering process?" — they mark process state and form the compliance trail. **Version identity tags** answer "what exact product state is this?" — they are stable release anchors.

Apply in this order:

### Step 1 — after Baseline Pack captured (before acceptance check)

Stage and commit the pack:
```
git add trades/docs/materials/approved/baselines/rc1/
git commit -m "RC1 Baseline Pack captured — American White Oak Photoreal"
```

Apply the workflow checkpoint:
```
git tag -a RC1_CAPTURED -m "Baseline images captured; captures, metrics, manifest recorded"
```

### Step 2 — after acceptance criteria pass (§9)

Verify every acceptance criterion is checked. If any fail, revert and re-capture.

Once all pass, apply the workflow checkpoint AND the four version identity tags at this commit:
```
git tag -a RC1_BASELINE_APPROVED -m "Acceptance criteria passed; baseline locked as reference"

git tag -a staircase-engine-v1.0        -m "RC1 frozen per RENDERER_FREEZE_CONTRACT"
git tag -a rendering-engine-v1.0-legacy -m "RC1 pre-modular renderer"
git tag -a material-library-v1.0        -m "RC1 material base + rear-material family"
git tag -a nex-staircase-platform-rc1   -m "Reference build; foundation for renderer V2 migration"
```

### Step 3 — after fresh-clone verification

In a fresh clone: `git checkout nex-staircase-platform-rc1`, hard refresh, confirm rendered output matches every image in the Baseline Pack.

If it matches:
```
git tag -a PHASE0_READY -m "Baseline frozen and rollback verified; migration work permitted"
```

**Phase 0 implementation may begin only after `PHASE0_READY` exists.**

### Step 4 — after Phase 0 completes

Only after:
- Phase 0 implementation delivered
- `RENDERER_VALIDATION_CHECKLIST.md` walked end-to-end and every applicable item ticked
- Phase completion record filed at `trades/docs/materials/approved/baselines/phase-0/COMPLETION.md`
- Photoreal Mode confirmed pixel-identical to RC1 baseline

Apply:
```
git tag -a PHASE0_COMPLETE -m "Phase 0 completed; COMPLETION.md signed; validation checklist passed"
```

Push all tags:
```
git push origin --tags
```

### Tag lookup quick-reference

| Question | Answer via tag |
|---|---|
| "Where are we in the engineering process?" | `RC1_CAPTURED` / `RC1_BASELINE_APPROVED` / `PHASE0_READY` / `PHASE0_COMPLETE` |
| "What is the last approved RC1 state?" | `RC1_BASELINE_APPROVED` |
| "What was the renderer at RC1 (before V2 migration)?" | `rendering-engine-v1.0-legacy` |
| "What was the staircase engine at RC1?" | `staircase-engine-v1.0` |
| "What is the full reference build?" | `nex-staircase-platform-rc1` |
| "Did Phase 0 pass governance?" | `PHASE0_COMPLETE` exists = yes |

### Future change classes (not part of RC1)

- `CAMERA_PRESET_CHANGE_R01` — the future addition of a Right Elevation preset. Its own change record with its own validation entry. Not part of any RC1 or renderer-phase tag.
- Later phases follow the same dual-tag pattern: `PHASE{N}_READY` / `PHASE{N}_COMPLETE` for workflow, and `rendering-engine-v{X}.{Y}` for version identity.

## 11. What NOT to do

- Do NOT edit the staircase engine to make a capture easier. Freeze Contract Article 1 applies.
- Do NOT edit the current renderer to add new camera views for the pack (Article 1.8). Use existing views; add new ones only as a separate approved change.
- Do NOT alter tone mapping, exposure, or lighting to "improve" the baseline. The baseline is what the renderer produces today. If today's render is imperfect, that's what the baseline records; Phase 5 addresses it via Configurator Mode.
- Do NOT capture from a device / browser / OS you won't use for regression. Cross-device sub-pixel drift is real.
- Do NOT embed dates in filenames. Git tags carry the version.

## 12. Change log

| Date | Change | Author |
|---|---|---|
| 2026-07-26 | v1.0 — initial capture guide established at RC1 preparation. Covers American White Oak (only currently-implemented species) across 7 existing camera views × 2 lighting states, optionally × 3 baluster finishes. | Philip O'Farrell |
| 2026-07-26 | v1.1 — §10 restructured to dual-tag sequence: workflow checkpoints (`RC1_CAPTURED` → `RC1_BASELINE_APPROVED` → `PHASE0_READY` → `PHASE0_COMPLETE`) applied at each transition, version identity tags (`staircase-engine-v1.0`, `rendering-engine-v1.0-legacy`, `material-library-v1.0`, `nex-staircase-platform-rc1`) applied at `RC1_BASELINE_APPROVED` moment. Workflow tags = process compliance trail; version tags = release anchors. `CAMERA_PRESET_CHANGE_R01` isolated as separate future change class. | Philip O'Farrell |
