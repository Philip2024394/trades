# NEX Stairplan — Digital Staircase Catalogue + Rendering Engine

**Status:** Specification. Not yet implemented — awaiting catalogue asset creation.

**Purpose:** Turn the Geometry Engine's dimensional output into (a) photorealistic 3D visualisation for the customer, (b) exploded workshop drawings for the joiner, and (c) CNC machining paths for the router — all from the same underlying geometry. Photorealistic quality tier = Apple's product viewers, IKEA Place, Tesla configurator, Kitchen Craft, Bulthaup, luxury furniture configurators.

## The Digital Staircase Catalogue (Stairplan's IP)

The **Digital Staircase Catalogue** is a curated library of professionally-modelled staircase components — every handrail profile, newel post, baluster style, glass system, string design, tread profile and fixing that Stairplan can build. Not an AI-generated approximation; a fixed, defensible, IP-worthy asset that took months of professional 3D modelling to create.

**Classic Collection example scale:**
- 18 Handrails
- 35 Newel Posts
- 60 Balusters (including 40 iron balusters as a subset)
- 12 Glass Systems
- 20 String Styles
- 15 Tread Profiles
- 10 Nosing Profiles
- 30 Newel Caps
- 25 Metal Systems

The catalogue is the moat. Every staircase in Stairplan is assembled from THIS catalogue — never invented. Competitors would need to build one just as thoroughly to reach the same visual quality.

---

## Attachment-point system (why auto-assembly works)

Every catalogue component carries **connection metadata** so the Geometry Engine plugs parts together correctly by TYPE-matching, not bounding-box guesswork:

```json
"B-046": {
  "connections": {
    "bottom": { "x": 20, "y": 20, "z": 0,     "type": "dowel_pin", "diameter_mm": 12 },
    "top":    { "x": 20, "y": 20, "z": "top", "type": "dowel_pin", "diameter_mm": 12 }
  },
  "rotation_axis":  { "x": 20, "y": 20, "axis": "z" },
  "centre_line":    { "x": 20, "y": 20 },
  "stretch_allowed":{ "x": false, "y": false, "z": true },
  "height_range_mm":{ "min": 700, "max": 950 },
  "section_max_length_mm": null,
  "scarf_joint_supported": false
}
```

**How the Geometry Engine uses this:**

- A `dowel_pin` connection on a baluster's top matches a `dowel_socket` on a handrail's underside → engine plugs them together at the exact XYZ position
- A `mortice` on a newel matches a `tenon` on a handrail end → structural connection with correct joinery
- `housed_wedge` on a tread edge matches `string_housing` on a string → tread drops into string at the right spot
- `stretch_allowed.z: true` on a baluster tells the renderer this part CAN be scaled along its length within `height_range_mm`; a newel's `stretch_allowed: {all: false}` means it must be selected at the right height, never squeezed

**Common connection types:**

| Type | Description |
|---|---|
| `dowel_pin` / `dowel_socket` | Round timber dowel + matching hole |
| `mortice` / `tenon` | Traditional joinery, orientation-aware |
| `housed_wedge` / `string_housing` | Tread/riser locked into string groove with wedge |
| `pocket_screw` | Concealed screw into pocket hole |
| `point_fix_hole` | Pre-drilled hole in glass for stainless-steel disc fixing |
| `channel_slot` | Continuous base channel for glass to drop into |
| `floor_bolt` | Newel base fixed to floor structure |
| `steel_plate_bracket` | Cantilevered tread bracket welded to central spine |
| `wall_fix` | Handrail bracket screwed into wall |

---

## Core principle

**The Geometry Engine outputs dimensions + component IDs + attachment matching. The Rendering Engine loads GLB assets by ID and assembles them.**

```
Geometry Engine (V2)                    Rendering Engine
─────────────────                       ────────────────
{                          →→→          Loader.load('/assets/glb/newels/NP-004.glb')
  id: "NEWEL-001",                      → position, rotate, scale from geometry
  component: "newel",                   → apply MAT-001 European Oak PBR material
  library_id: "NP-004",   ─────────→    → apply HDR environment lighting
  world_position: {x,y,z},              → cast + receive shadows
  dimensions: {...},                    → tone-map + gamma-correct
  material_id: "MAT-001"                → render to viewport
}
```

The Geometry Engine NEVER cares about how things look. The Rendering Engine NEVER recalculates dimensions.

---

## Directory structure

```
trades/
├── public/
│   ├── staircase-configurator/index.html    (existing prototype — primitives)
│   └── assets/                              (new — created by 3D artist)
│       ├── glb/
│       │   ├── handrails/
│       │   │   ├── HR-001-modern-square.glb
│       │   │   ├── HR-002-mopstick.glb
│       │   │   ├── HR-003-oval.glb
│       │   │   └── HR-004-contemporary.glb
│       │   ├── newels/
│       │   │   ├── NP-001-square.glb
│       │   │   └── ...
│       │   ├── newel-caps/
│       │   ├── balusters/
│       │   ├── strings/
│       │   ├── treads/
│       │   ├── glass/
│       │   ├── glass-fixings/
│       │   └── led/
│       ├── textures/                        (PBR texture sets per timber species)
│       │   ├── MAT-001-european-oak/
│       │   │   ├── albedo.jpg
│       │   │   ├── roughness.jpg
│       │   │   ├── normal.jpg
│       │   │   └── ao.jpg
│       │   ├── MAT-002-american-white-oak/
│       │   └── ...
│       └── hdr/
│           ├── studio-warm.hdr              (default lighting)
│           ├── daylight-neutral.hdr
│           └── evening-warm.hdr
```

---

## Rendering Engine class API

```javascript
import { StaircaseRenderer } from './staircase-renderer.mjs';

const renderer = new StaircaseRenderer({
  canvas: document.getElementById('viewer-canvas'),
  assetBase: '/assets/',
  environment: 'studio-warm',    // HDR to load
  quality: 'high'                // 'low' | 'medium' | 'high'
});

// Preload common components in background
await renderer.preload(['NP-004', 'HR-001', 'B-004', 'GP-001']);

// Consume Geometry Engine output
renderer.render(geometryModel);

// Camera presets
renderer.setCamera('hero');       // front-corner-quarter view
renderer.setCamera('plan');       // top-down
renderer.setCamera('elevation');  // pure side
renderer.setCamera('section');    // cut through
renderer.setCamera('walkthrough');// first-person moving up flight
```

---

## Pipeline

### 1. Asset loading (once per session)

- **GLTFLoader** (Three.js built-in): loads GLB components. Use `.glb` (binary) not `.gltf` (JSON) for smaller file sizes.
- **RGBELoader** (Three.js `examples/jsm/loaders`): loads HDR environment maps for image-based lighting.
- **TextureLoader**: loads PBR texture sets per timber species.
- **Preloading strategy**: on app start, load the DEFAULT component set (customer's landing config). Load alternatives lazily as the customer navigates to them.

### 2. Scene assembly (per parameter change)

For each component in the Geometry Engine output:

```javascript
for (const component of geometryModel.components) {
  const glb = assetCache.get(component.library_id);
  const instance = glb.scene.clone();

  // Position from geometry
  instance.position.set(
    component.world_position.x,
    component.world_position.z,   // Z-up in geometry → Y-up in Three
    component.world_position.y
  );

  // Rotation from geometry
  instance.rotation.set(
    THREE.MathUtils.degToRad(component.rotation.pitch_deg),
    THREE.MathUtils.degToRad(component.rotation.yaw_deg),
    THREE.MathUtils.degToRad(component.rotation.roll_deg)
  );

  // Scale non-uniformly if the component has stretchable dimensions
  //   (e.g. handrails scale along length; newels don't scale)
  if (component.component === 'handrail' || component.component === 'string') {
    const baseLength = glb.userData.baseLength ?? 1000;
    instance.scale.x = component.dimensions.length_diagonal.nominal / baseLength;
  } else if (component.component === 'tread' || component.component === 'landing') {
    // treads scale in width + depth
    instance.scale.x = component.dimensions.length.nominal / (glb.userData.baseLength ?? 300);
    instance.scale.z = component.dimensions.width.nominal / (glb.userData.baseWidth ?? 900);
  }

  // Apply timber material
  applyMaterial(instance, component.material_id);

  scene.add(instance);
}
```

### 3. Material application (PBR per timber species)

Each MAT-XXX has a PBR texture set. The Rendering Engine swaps material on GLB mesh:

```javascript
function applyMaterial(instance, materialId) {
  const texSet = pbrCache.get(materialId);
  instance.traverse(child => {
    if (!child.isMesh) return;
    child.material = new THREE.MeshStandardMaterial({
      map: texSet.albedo,
      roughnessMap: texSet.roughness,
      normalMap: texSet.normal,
      aoMap: texSet.ao,
      envMap: hdrEnvironment,
      envMapIntensity: 0.8
    });
    child.castShadow = true;
    child.receiveShadow = true;
  });
}
```

### 4. Lighting

- **HDR environment map** as `scene.environment` — provides IBL (image-based lighting) so PBR materials look correct
- **Sun (directional light)** — casts primary shadow, warm ~5000K colour temperature
- **Fill (directional or hemisphere)** — softens shadow contrast, cooler tint
- **Ground shadow catcher** — `ShadowMaterial` on a large plane so the staircase visibly sits on a floor

### 5. Post-processing (optional, quality: high)

- `ACESFilmicToneMapping` on renderer — cinematic tone-mapping
- Ambient occlusion (SSAO) — deepens creases + contact shadows
- Bloom (subtle) — for LED strip glow only
- FXAA or SMAA — antialiasing

### 6. LOD (Level of Detail)

For performance during interactive orbit:
- **Low-poly variants** loaded for balusters/spindles when count > 40
- **Full detail** on treads, strings, newels always
- **Switch to full detail** when camera stops moving for >500ms (auto-recompose)

---

## Three render modes from the same geometry

Same staircase model, three completely different renderers:

### Mode 1: PHOTOREALISTIC (customer marketing)

- HDR environment (living room / hallway / studio / evening scene)
- Ray-traced shadows + reflections (or high-quality raster equivalents)
- PBR wood + glass + metal materials, high-res textures
- ACES filmic tone mapping
- Contact-shadow ambient occlusion
- Subtle bloom for LED strips only
- Camera presets: hero, walkthrough, over-shoulder-from-hallway
- Purpose: customer emotional response — "is this a photograph?"
- Payload target: <8MB for hero shot

### Mode 2: WORKSHOP VIEW (joiner)

Consumes same geometry, renders differently:
- Exploded axonometric — parts pulled apart along assembly axis
- Every component labelled with its part number (PART-001, TREAD-005, HR-014)
- Dimensions overlaid: length, depth, thickness for each part
- Fixing positions highlighted with symbols (dowel, mortice, wedge, pocket screw)
- Timber sizes called out per part
- Bill of materials as sidebar
- Camera presets: full-exploded, per-assembly (string+treads, balustrade, landing)
- Purpose: workshop understands exactly what to build without ambiguity
- Export target: PDF

### Mode 3: CNC VIEW (router)

Same geometry again:
- Each component reduced to its 2D or 3D machining paths
- Tool numbers annotated (12mm router, 8mm drill, 45° chamfer bit, etc.)
- Operation sequence numbered (1: rough profile, 2: housing, 3: chamfer, 4: drilling)
- Estimated cycle time per component
- Total machining time per material batch
- Feed rates + spindle speeds per operation
- Purpose: CNC operator loads the file directly into the router
- Export target: DXF, STEP or CNC-router-native format (varies by machine)

**All three modes share the same underlying geometry.** Change one parameter (widen the flight by 100mm) → all three renderers re-emit consistently. No drift possible between "what the customer saw", "what the workshop built" and "what the CNC cut".

---

## Camera presets

| Preset | Position | Target | Use |
|---|---|---|---|
| `hero` | Front-right, elevated | Staircase centre | Default marketing shot |
| `plan` | Directly above | Staircase centre | Plan-view mode tab |
| `elevation` | Directly to the side, no rotation | Staircase centre | Elevation-view mode tab |
| `section` | Side but sliced through | Staircase centre + clipping plane | Section-view mode tab |
| `walkthrough` | First-person, at bottom of flight | Up the flight, camera pans up | Immersive walk-up |
| `component_focus` | Auto-computed to frame one clicked component | The clicked component's centre | Click a handrail → camera flies to it |

## Camera modes (interaction, not just presets)

### Walk Upstairs mode

Instead of orbiting around a floating object, the camera walks up the flight like a real person:
- Start position: bottom of flight, ~1650mm above tread (eye height), facing up
- Slow motion: ~0.3m/s along the pitch line, ~2-3s per tread
- Head bob: subtle vertical oscillation matching walking gait
- Camera looks forward + slightly up as you climb, then swings around at landings
- Optional: subtle footstep audio synced to tread landings

**This sells staircases better than any orbit spin.** Especially powerful on half-turn and curved staircases where the walk-through reveals the geometry a static view can't. Reserve this mode for the "wow" moment after the customer's finished designing.

### Compare Split-Screen mode

Screen divides vertically. Left half renders configuration A; right half renders configuration B. Both cameras rotate together (synchronized OrbitControls). Both models update together when a shared parameter changes.

- Timber A vs Timber B (Oak on left, Walnut on right — see the tonal difference instantly)
- Balustrade A vs Balustrade B (turned spindles vs glass)
- Layout A vs Layout B (straight vs half-turn — see the footprint change)
- Price differential shown live in the divider

Customer instantly understands the design trade-off in a way brochure copy never conveys.

### Real House Mode (contextual environment)

The staircase renders INSIDE a real room instead of floating in empty grey space:
- Room environment options: white-walls-oak-floor (modern), grey-carpet-neutral (contemporary), period-hallway (traditional), coastal-white-cottage (light), warehouse-loft (industrial)
- Windows in the room match the environment's implied lighting direction
- Furniture props (console table, art, plant) frame the entrance
- Environment auto-switches based on Designer Preset chosen — Scandinavian preset loads scandi-white-loft; Traditional English preset loads period-hallway

**Customer instantly imagines the staircase in their own home.** This is the emotional-design leap kitchen software has made for years; staircase configurators mostly haven't.

## Timber-changes-room emotional linkage

When the customer changes timber, don't only change the staircase's material — change the WHOLE ROOM to match. Because different timbers suit different interiors, and showing the customer a walnut staircase against Scandi-white walls doesn't help them decide.

Rule of thumb linkage (all HDR environments loaded from the Real House Mode library):
- **Oak / Ash / Pine** → loads `scandi-white-loft.hdr` or `warm-daylight-neutral.hdr`
- **Walnut / Cherry / Mahogany** → loads `luxury-open-plan-evening.hdr` or `period-hallway-daylight.hdr`
- **Painted timber** → loads `coastal-cottage-morning.hdr`
- **Metal-heavy configurations (steel spine + cable)** → loads `warehouse-conversion-dusk.hdr`

Not just lighting — the FLOOR TIMBER in the room, the WALL COLOUR, the FURNITURE all respond. Walnut staircase auto-triggers darker parquet, deeper wall tone, richer furniture. Customer sees the staircase in the CONTEXT it belongs in, not in a neutral vacuum.

## Interactive component focus

Click any component in the 3D view → camera flies to that component in ~800ms with cinematic ease → info popup slides in:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HR-003 Oval Handrail
American White Oak (MAT-002)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Length in this design: 3400 mm
Weight: 18 kg
Cost: £295
Compatible with: Glass · Metal · Traditional · Modern
[View gallery →]
[Read Nex's take →]
[Change component →]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Component IDs and metadata come from the catalogue — same source as pricing, BOM, and drawings. The renderer just displays them.

---

## Performance targets

| Metric | Target |
|---|---|
| First paint after component load | <1.5s on 4G mobile |
| Parameter change → new render | <200ms |
| Frame rate during orbit | 60fps mid-range mobile |
| Total GLB payload | <5MB for default set |
| PBR texture payload per species | <2MB (1K textures) or <8MB (2K textures for hero shots) |

---

## Fallback for missing assets

Until real GLB files exist, the Rendering Engine falls back to the current primitive-box representation with a clear developer-console warning:

```
[Renderer] Asset /assets/glb/newels/NP-004.glb not found — using primitive fallback.
```

This lets the app run even before the asset library's complete, and demonstrates the ID-driven architecture is correct even when assets are placeholders.

---

## Asset creation pipeline (for the 3D artist)

Each GLB should:

1. **Origin at logical zero** — for a newel, origin at bottom-centre of base. For a handrail, origin at start of the run. For a tread, origin at back-left (against string).
2. **Base dimensions in metadata** — GLB `userData.baseLength`, `userData.baseWidth`, `userData.baseHeight` in mm so the renderer knows what to scale from.
3. **UVs mapped for tiling** — timber grain textures should tile correctly along any axis the component stretches.
4. **Meshes named** — each subpart named so the material swapper can find them (e.g. `Newel_Body`, `Newel_Base`, `Newel_Chamfer_L`).
5. **Poly count reasonable** — target 500-3000 tris per component for orbit performance.
6. **Draco compressed** — use `.glb` with Draco geometry compression to keep file sizes small.

---

## What Nex does with this

Nex reads the customer's brief and RECOMMENDS component combinations from the library:

> **Customer:** "I want a modern staircase for our new build"
> **Nex:** "For a modern new-build I'd suggest **NP-004 Modern Box** newels + **HR-001 Modern Square** handrail + **B-004 Glass Panel** balusters with **GF-001 Point Fixings** — in **MAT-001 European Oak** for warmth or **MAT-004 American Walnut** for luxury. Want me to switch you to that combination?"

The Geometry Engine builds exactly that combination. The Rendering Engine loads exactly those GLB files. Every pixel corresponds to a real, quotable, manufacturable component.

---

## Designer Presets (curated starting points)

Rather than dumping a blank canvas + 40 component options on a beginner, Stairplan offers curated starting configurations. See `data/staircase-components.json` → `designer_presets`.

Current presets:
- **Scandinavian** — bright pale timber, open lines, hidden fixings
- **Modern Luxury** — walnut + glass + LED + floating feel
- **Traditional English** — turned balusters + oak + stop-chamfered newels
- **Industrial Loft** — black metal + ash treads + cable balustrade
- **Coastal Cottage** — painted turned balusters + oak handrail + warm textures

Each preset references components by canonical ID from the catalogue. Selecting a preset:
1. Loads the specified component IDs into the Geometry Engine
2. Loads the recommended timber MAT-XXX
3. Loads the paired room environment (Real House Mode)
4. Advanced user can then tweak any single choice while keeping the rest of the preset

**Beginners aren't overwhelmed. Advanced users aren't limited.**

---

## Complete Design Pack (final customer output)

When the customer finishes designing, they don't just "Download Image". They get a professional design deliverable:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR STAIRCASE — Designed by NEX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project reference:      NX-2026-07-25-4821
Layout:                 Half-turn with landing
Configuration:          Modern Luxury preset (customised)
Rendered on:            2026-07-25 at 18:42

CONTENTS
├── 3D hero render (photorealistic)
├── 3D walk-through video (30s)
├── Floor plan drawing (top view, dimensioned)
├── Side elevation drawing
├── Doc K compliance report (all 20 checks · APPROVED)
├── Material list (BOM by component ID + timber)
├── Estimated cost breakdown
├── Manufacturing summary (workshop-ready)
├── QR code (opens 3D viewer on any phone)
└── Shareable link (send to partner/architect/builder)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Every one of those outputs is generated by a downstream engine consuming the SAME geometry model (per the canonical ID rule). No drift between what the customer designed, what the workshop builds, what the CNC cuts, what the installer fits.

**This is where Stairplan stops looking like software and starts looking like a professional design studio's deliverable.**
