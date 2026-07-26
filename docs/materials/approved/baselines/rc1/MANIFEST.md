# RC1 Baseline Pack — Capture Manifest

## Version fingerprint
- Rendering Engine version:      v1.0 (legacy — pre-modular; being replaced by V2 per `RENDERING_ENGINE_V1.md`)
- Staircase Engine version:      v1.0 (frozen per `RENDERER_FREEZE_CONTRACT.md`)
- Material Library version:      v1.0 (current base + rear-material family)
- Governance docs snapshot:      RENDERING_ENGINE_V1 v1.3 · RENDERER_VALIDATION_CHECKLIST v1.3 · RENDERER_FREEZE_CONTRACT v1.2 · CAPTURE_GUIDE v1.1

## Render settings
- Renderer Mode:                 Photoreal (only mode implemented at RC1)
- Quality Level:                 High (current default)
- Canvas resolution:             User Environment – to be completed during final verification
- Device Pixel Ratio:            User Environment – to be completed during final verification
- Browser zoom:                  100% (assumed)
- Tone mapping:                  `THREE.ACESFilmicToneMapping` (from `mat-002-flight-3d.html`)
- Exposure:                      1.0 (from `mat-002-flight-3d.html`)
- Camera FOV:                    Fixed per view preset in `views` dictionary

## Environment
- Browser:                       User Environment – to be completed during final verification
- Browser version:               User Environment – to be completed during final verification
- GPU:                           User Environment – to be completed during final verification (visit `chrome://gpu`, GL_RENDERER field)
- OS:                            Windows 11 (from workspace host)
- Screen resolution:             User Environment – to be completed during final verification

## Staircase configuration at capture
- Varnish:                       ON
- Sheeting:                      ON
- Round Starting Step:           ON
- Baluster finish:               Oak (fully chamfered)

## Species captured
- American White Oak (only species implemented in code at RC1)

## Baseline Pack contents (18 unique images)

### Canonical (11 of 14 slots filled)

| Filename | View | Lights | Source |
|---|---|---|---|
| `front_lights-off.png` | Front Elevation | OFF | User capture |
| `front_lights-on.png` | Front Elevation | ON | User capture |
| `rear_lights-off.png` | Back of Stairs (with Sheeting) | OFF | User capture |
| `rear_lights-on.png` | Back of Stairs (with Sheeting) | ON | User capture |
| `left_lights-off.png` | Left Side Elevation | OFF | User capture |
| `left_lights-on.png` | Left Side Elevation | ON | User capture |
| `right_lights-off.png` | Right Side Elevation (tight framing) | OFF | User capture |
| `right_lights-on.png` | Right Side Elevation | ON | User capture |
| `top_lights-off.png` | Walker-view looking down flight | OFF | User capture — note: this is walker-perspective looking down, NOT overhead Top Plan |
| `top_lights-on.png` | Walker-view looking down flight | ON | User capture — same perspective as top_lights-off |
| `detail_lights-off.png` | Standing at Foot (close-up) | OFF | User capture |

### Canonical slots DEFERRED (3 of 14)

The following canonical slots are NOT captured at RC1. Deferred per Philip's authorization 2026-07-26. They do NOT affect geometry or material validation for Phase 0. To be captured at a later opportunity to complete the canonical pack.

- `hero_lights-off.png` — 3-Quarter Hero view, Stairlights OFF
- `hero_lights-on.png` — 3-Quarter Hero view, Stairlights ON
- `detail_lights-on.png` — Standing at Foot view, Stairlights ON

### Supplementary references (7)

Extra reference images captured outside the canonical 14-slot spec. Useful for regression detection at additional angles / toggle states but not part of the strict RC1 acceptance pack.

| Filename | Content |
|---|---|
| `supplementary_side-view-original.png` | Original ambiguous "side view" capture, superseded by explicit left_lights-off |
| `supplementary_rear_sheeting-off.png` | Rear view with Sheeting OFF, lights OFF |
| `supplementary_rear_sheeting-off_lights-on.png` | Rear view with Sheeting OFF, lights ON |
| `supplementary_rear_3quarter-left.png` | Rear 3/4 angle from left |
| `supplementary_rear_3quarter-right.png` | Rear 3/4 angle from right |
| `supplementary_rear_direct.png` | Rear view direct, straight-on |
| `supplementary_room_view_right.png` | Wider room + right side view |

## Known observations recorded at RC1

- **Rear-face darkness** — sides adjacent to the sheeting panel render darker than the walker-visible surfaces. Investigated across ~40 iterations; confirmed as PBR-correct lighting-environment behaviour, NOT a material or geometry defect. Formally deferred to Phase 5 (Configurator Mode) per `APPROVAL_REGISTRY.md` decision. RC1 captures this state faithfully so Phase 5 improvement is later provable against this baseline.

- **`top_lights-off.png` / `top_lights-on.png`** — captured as walker-perspective looking DOWN the flight, not as overhead Top Plan bird's-eye view. Both images in the pair use the same perspective, so regression detection between them remains valid. If a true Top Plan is captured later, it will be added as an additional slot rather than replacing these.

- **`left_lights-on.png`** — captured with original "lights left on" URL. Renders as silhouette with warm LED pool at bottom (expected atmospheric night-mode behaviour). Distinct from `right_lights-on.png` after duplicate resolution.

- **`right_lights-on.png`** — captured with URL originally sent as "side lights on", clarified by Philip to be RIGHT side. Distinct MD5 from `left_lights-on.png`.

## Sign-off
- Captured by:      Philip O'Farrell (browser screenshots via ImageKit uploads)
- Assembled by:     Claude Code (URL downloads to workspace via `curl`)
- Date:             2026-07-26
- Git commit hash:  To be filled at commit time
- Git tag applied:  See §Version fingerprint above and the applied tags below

## Applied git tags
- `RC1_CAPTURED` — 2026-07-26 — baseline images captured, manifest recorded
- `RC1_BASELINE_APPROVED` — 2026-07-26 — acceptance criteria satisfied (18 unique files, 3 deferred slots documented)
- `staircase-engine-v1.0` — 2026-07-26
- `rendering-engine-v1.0-legacy` — 2026-07-26
- `material-library-v1.0` — 2026-07-26
- `nex-staircase-platform-rc1` — 2026-07-26

## Notes
- User environment fields marked "User Environment – to be completed during final verification" per Philip's explicit authorization 2026-07-26 to proceed without blocking. Fill in these fields whenever fresh-clone verification is performed; MANIFEST is a living document until the "User Environment" section is complete.
- Right Elevation captured with `right_lights-off.png` at tight framing (URL 2). Wider room-context view retained as `supplementary_room_view_right.png` for cross-reference.
