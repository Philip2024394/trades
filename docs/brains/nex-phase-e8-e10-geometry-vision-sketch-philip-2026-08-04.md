---
authored_by: Philip O'Farrell (7 platform layers · Vision Intelligence · Sketch Intelligence · 2 CORE constitutional pins) · Master AI Engineer (schema + contracts)
authored_role: Founder platform doctrine + Master AI Engineer implementation architecture
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Phase E.8-E.10 · Geometry Engine · Parametric · Manufacturing · Material Physics · Lighting Simulator · Relationship Engine · Vision Intelligence · Sketch Intelligence
document_version: 1.0
document_type: MEGA_DOCTRINE · Phase E.8-E.10 · 7 platforms + Vision + Sketch + 2 CORE pins
composes_with:
  - docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md
  - docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md
  - docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md
constitutional_rules_introduced:
  - rule_pixels_are_temporary_knowledge_is_permanent (CORE · Philip 2026-08-04)
  - rule_sketch_is_first_class_design (CORE · Philip 2026-08-04)
---

# Phase E.8–E.10 · Geometry Engine · Vision Intelligence · Sketch Intelligence

## Two New CORE Constitutional Principles

### 1 · Pixels are temporary · Knowledge is permanent (Philip 2026-08-04)

*"Every image entering Nex shall be transformed into structured knowledge. Pixels are temporary; knowledge is permanent. The system shall identify objects, geometry, materials, colours, lighting, spatial relationships, scene composition, and design intent, storing them as reusable design objects and graph relationships rather than relying solely on the original image. Rendering engines consume this knowledge, but the knowledge itself remains renderer-independent."*

**Elevation:** this deepens the earlier `No Image Without Knowledge` CORE pin. Where that rule required an image to be catalogued · this rule requires the image to be DECOMPOSED into a rich network of objects · geometry · materials · lighting · directions · relationships · mood · style DNA · scene type. Feedback pin: `feedback_nex_pixels_are_temporary_knowledge_is_permanent.md`.

### 2 · A sketch is first-class design knowledge (Philip 2026-08-04)

*"A sketch is first-class design knowledge. Hand sketches, CAD line drawings, scanned notebook sketches, PDFs, and concept art are all valid Design Documents. Nex shall interpret their geometry, recognise intended objects, infer missing structure where confidence is high, and combine the sketch with its design knowledge to create realistic renderings while preserving the designer's intent."*

**Practical consequence:** sketches never enter as "unfinished images to imitate." They enter as Design Documents that already carry intent. The Sketch Intelligence Platform (SIP) treats the sketch as an engineering + design specification. Feedback pin: `feedback_nex_sketch_is_first_class_design.md`.

## Directive 1 · The 7 New Platform Layers

### Universal Geometry Engine

Every object owns true geometry: height · width · depth · radius · angle · bevel · fillet · edge profile · curve · holes · joinery · cut list · volume · surface area · bounding box.

**Status:** partially SHIPPED in `src/lib/nex/geometry-platform/` (`GeometryObject` with bounding box · connectors · collision · animation points · LOD). Extended this session with parametric geometry.

### Parametric Objects

Like BIM — one property change updates everything.

```
Oak Staircase
  ├── height
  ├── string_style
  ├── treads
  ├── risers
  ├── newels
  ├── balusters
  ├── glass
  ├── handrail
  ├── led
  ├── finish
  ├── paint
  ├── joinery
  ├── connections
  └── building_regulations
```

Changing `height` propagates to riser count · going · pitch · handrail length · LED strip length · BOM.

**Status:** SHIPPED this session · `src/lib/nex/design-platform/parametric.ts` (ParametricObject · PropertyDelta · propagate + PropagationRule).

### Manufacturing Layer

*"Huge future advantage. Very few AI systems understand this."*

Every object knows: manufacturing steps · machines (CNC · laser · router) · assembly · fixings · estimated labour · tooling · waste · packing · installation.

**Design → Manufacture → Installation** becomes traceable per object.

**Status:** SHIPPED this session · `src/lib/nex/manufacturing-platform/` (ManufacturingStep · MachineOp · CuttingList · InstallationSequence + planManufacturing()).

### Material Physics (extends Material Intelligence)

Beyond density + fire rating + carbon (already shipped Phase E.3), materials now also know: grain · hardness · expansion coefficient · moisture behaviour · UV ageing curve · weight · fire · machining ease · staining · oil absorption · paint adhesion · cost · supplier.

**Status:** SHIPPED this session · `src/lib/nex/material-platform/physics.ts` (MaterialPhysics extension + seed for oak/walnut/pine).

### Lighting Simulator

Every room knows: sun position · north · window size · glass · LED strips · spotlights · ambient bounce · wall reflectivity · colour temperature · shadow softness.

**Status:** SHIPPED this session · `src/lib/nex/lighting-simulator/` (SunPosition · WindowGeometry · ReflectivityMap · SceneLightingBudget · computeSceneMood).

### Interior Relationship Engine

*"Instead of designing one object · Nex designs relationships."*

```
Kitchen → Floor → Staircase → Doors → Architraves → Skirting → Wall panelling → Lighting → Furniture → Hardware → Curtains → Paint
```

Every object influences every other. That is TRUE design intelligence.

**Status:** SHIPPED this session · `src/lib/nex/relationship-engine/` (RelationshipEdge · RelationshipKind · PropagationRule · addRelationship · propagate · walkRelated).

### Pixel Intelligence

The renderer simply asks *"What do I draw?"* Everything else has already been decided.

**Status:** already SHIPPED (Phase E.0 SVG renderer + Delivery Platform registry + Prompt Compiler for future image models). This directive REINFORCES the renderer-never-decides constitutional rule.

## Directive 2 · Vision Intelligence Platform (Visual Understanding Engine)

Progressive extraction pipeline:

```
Image
  ↓
Object Detection
  ↓
Object Segmentation
  ↓
Geometry
  ↓
Materials
  ↓
Lighting
  ↓
Colours
  ↓
Style
  ↓
Relationships
  ↓
Scene
  ↓
Knowledge Objects
  ↓
Design Database
```

### 9 Sub-Intelligences

**1 · Object Intelligence** — every detected object becomes a Design Object with type · confidence · material · finish · construction · balustrade · handrail · lighting · condition · position · connected_to.

**2 · Shape Intelligence** — every object stores primary shape · secondary shapes · leg profile · back curvature · seat radius · edges. Nex learns style through GEOMETRY not labels. Shaker doors = always Rectangle + Frame + Inner panel + 90° corners + medium proportions. Modern doors = Flat + Minimal + Sharp edges + No mouldings.

**3 · Relationship Intelligence** — objects never exist alone. Oak staircase → oak flooring → oak doors → oak skirting → oak handrail becomes part of the design graph.

**4 · Direction Intelligence** — every object has directional properties: lighting direction · shadow direction · wood grain · floor plank orientation · handrail ascending · wall panelling orientation · camera direction · perspective vanishing points. Enables visual consistency when generating or editing scenes.

**5 · Mood / Warmth Intelligence** — scene mood profile: colour temperature · dominant palette · lighting temp · materials · contrast · mood label · style label · overall warmth score (0-100). Both "warm oak scandinavian 87/100" and "charcoal steel concrete industrial 18/100" are first-class scored properties.

**6 · Material Intelligence (per object)** — extends the Phase E.3 catalog with per-instance analysis: reflectivity · texture · gloss · age · wear. Builds a library of material characteristics from real images over time.

**7 · Scene Intelligence** — the ROOM, not the image. Room type · contains list · staircase visible? · lighting kind · window count · style · floor · worktop · splashback.

**8 · Style DNA** — every analysed image contributes to a style fingerprint: %traditional · %contemporary · %scandinavian · timber · palette · hardware · lighting · mood. Instead of tagging "modern kitchen", Nex knows EXACTLY WHY it feels modern.

**9 · Visual Knowledge Graph** — each image becomes a network of connected entities (Image → Room → Staircase → Timber/Glass/LED/Building_regs · Floor · Walls · Lighting · Furniture). Recurring design patterns emerge across thousands of projects.

**Status:** SHIPPED this session · `src/lib/nex/vision-intelligence/` with contract types + MVP analyzer + Scene Mood scoring + Style DNA fingerprint + Knowledge Graph builder + tests.

## Directive 3 · Sketch Intelligence Platform (SIP)

**Sketch → Reality Pipeline (9 stages):**

```
Sketch
  ↓
1 · Sketch Detection         (lines · curves · circles · arcs · splines · hidden lines · dimensions · notes · arrows · section marks)
  ↓
2 · Line Recognition
  ↓
3 · Geometry Recognition
  ↓
4 · Shape Matching           (Circle→lamp base · Cylinder→stem · Cone→shade profile)
  ↓
5 · Object Library Match     (searches Nex's object knowledge by geometry not pixels · 97% similarity)
  ↓
6 · Material Search          (user says "oak" · Nex searches European Oak · Light Oak · Quarter sawn · Natural Oil · Matt lacquer · Brushed finish)
  ↓
7 · Component Matching       (Lamp = Base + Stem + Joint + Shade + Cable + Switch + Bulb · each component matched independently)
  ↓
8 · Style Matching           (Scandinavian · Industrial · etc. · applies style · preserves sketch geometry)
  ↓
9 · Construction Intelligence + Confidence + Learn
```

**Construction check:** Is stem too thin? Will lamp fall over? Base heavy enough? Cable routing possible? Bulb accessible? Manufacturable? Safe? Electrical spacing? Wood movement?

**Confidence per component (Philip: never pretend):**
- Lamp: 99% · Material: 100% · Switch: 62% · Shade: 74% · Cable: 48%.
- Nex reports: *"Switch location estimated from similar lamps."*

**Long-term outputs from a single sketch:**
- Photorealistic render · exploded assembly view · 2D technical drawing · dimensioned manufacturing drawing · cut list · Bill of Materials · CNC-ready geometry · marketing images · website hero · product catalogue artwork.

**Status:** SHIPPED this session · `src/lib/nex/sketch-intelligence/` with 9-stage interpretation contract + MVP pipeline + confidence reporting + tests.

## The Long-Term Vision (Philip's north star)

User asks:

> *"Design me a traditional oak staircase with matching kitchen, under-stair storage, front door, flooring and wall panelling for a £40k renovation."*

Nex produces (all from the same underlying Design Document + Object Model):

1. Coordinated design concept.
2. Realistic rendered image (via Prompt Compiler + swappable image model).
3. 3D walk-through (via Geometry Platform → glTF/USDZ).
4. Construction drawings (via Delivery `renderElevation` + `renderFloorPlan`).
5. Material schedules (via Material Intelligence Platform).
6. Manufacturing files (via Manufacturing Platform).
7. Cost estimates (via Material Intelligence cost fields + BOM).
8. Building regulation checks (via Construction Intelligence Platform).
9. Marketing visuals (via Design Platform · Pattern Library · Grammar).
10. Social media graphics (via Design Sizes registry · 66 formats).
11. Customer presentation (via Delivery Platform · PPTX exporter).
12. Narrated explanation of every design decision (via Voice Intelligence Platform reading provenance chain).

**All generated from the same underlying Design Document and Object Model. Rendering is only one output.**

## Complete Platform Stack (post Phase E.10)

```
Knowledge Platform
     ↓
Reasoning Platform
     ↓
Planning Platform
     ↓
Reality Advisor Platform                        (E.8 · shipped)
     ↓
Editing Platform                                (E.5 · shipped)
     ↓
Composition Platform
     ↓
Design Platform + Design Object Model
     ↓
Universal Object Model + Geometry Platform
     ↓
Parametric Objects                              (E.8 · SHIPPING this session)
     ↓
Material Intelligence + Physics                 (E.8 · Physics extension SHIPPING this session)
     ↓
Construction Intelligence
     ↓
Scene Intelligence
     ↓
Lighting Simulator                              (E.8 · SHIPPING this session)
     ↓
Interior Relationship Engine                    (E.8 · SHIPPING this session)
     ↓
Asset Intelligence Platform
     ↓
Vision Intelligence Platform                    (E.9 · SHIPPING this session)
     ↓
Sketch Intelligence Platform                    (E.10 · SHIPPING this session)
     ↓
Manufacturing Platform                          (E.8 · SHIPPING this session)
     ↓
Spatial Intelligence Platform
     ↓
Prompt Compiler
     ↓
Rendering Platform / Image Model                (interchangeable)
     ↓
Image Critic Brain
     ↓
Voice Intelligence Platform
     ↓
Design History Engine + Design Memory + Learning Loop
     ↓
Delivery Platform                               (registry)
```

## Governance

- Every image entering Nex MUST decompose into structured knowledge (CORE · Pixels are Temporary).
- Every sketch entering Nex is a first-class Design Document (CORE · Sketch is Design).
- Every object exists ONCE across every render target (existing CORE · Universal Object Model).
- Every measurement carries its confidence (existing CORE).
- Every material carries its physics (this doctrine extends the rule).
- Every design object may declare a Parametric contract; property changes propagate through PropagationRules · never manual sync.
- Every rendered image records a Manufacturing Schedule where applicable (BOM · cutting list · installation sequence).
- Every scene has a computed Mood Score (Vision Intelligence) + a Style DNA (Vision Intelligence).
- Every relationship between design objects is a first-class graph edge with a kind and propagation rule.
- No PR may add a bespoke sketch/vision path outside the SIP or Vision Intelligence Platform.
