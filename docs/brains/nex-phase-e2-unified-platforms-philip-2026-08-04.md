---
authored_by: Philip O'Farrell (4 platform directives + Golden Rule + Reality Advisor + Spatial Intelligence + Universal Object Model + Geometry Layer) · Master AI Engineer (schema + contracts + phased plan)
authored_role: Founder platform doctrine + Master AI Engineer implementation architecture
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Phase E.2 · unified platform · introduces Geometry Layer + Reality Advisor + Spatial Intelligence
document_version: 1.0
document_type: MEGA_DOCTRINE · Phase E.2 · four platform directives bound as one system
composes_with:
  - docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md (E.1 parent)
  - docs/brains/nex-design-intelligence-platform-ndip-philip-2026-08-04.md (NDIP)
  - docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md (DOM)
  - docs/brains/nex-pixel-rendering-engine-phase-e0-philip-2026-08-04.md (E.0)
supersedes_framing:
  - "renderer at the centre" · the Asset Intelligence Platform is now at the centre (Philip 2026-08-04)
constitutional_rules_introduced:
  - rule_asset_intelligence_at_centre
  - rule_geometry_layer_universal_object_model
  - rule_reality_advisor_never_changes_design
  - rule_spatial_confidence_never_hidden
---

# Phase E.2 · Unified Platforms

Four platform directives from Philip 2026-08-04 · bound into one architecture.

## New Constitutional Position (Philip 2026-08-04)

*"The renderer is no longer the centre of the architecture. The Asset Intelligence Platform is."*

Every image · photograph · render · banner · specimen · logo · icon · texture · background · font · illustration becomes structured knowledge. **Nex never sees an image as "just a file." It sees a reusable design object.**

## Directive 1 · Unified Asset Intelligence Platform

### Every image becomes an Asset Object

Extended from the E.1 UniversalAsset schema · adds:

```yaml
asset_id · asset_type · product_family · industry · room · timber · colour_palette
lighting · perspective · hero_position · camera_angle · design_style · personality
marketing_tone · quality_score · image_hash · embedding · tags · compatible_assets
incompatible_assets · created_from · derived_assets · usage_history
performance_metrics · licensing · file_locations
```

### Every existing image must be indexed

- 54 staircase specimens · 23 marketing banners · kitchen renders · under-stair storage · joinery · front doors · loft ladders · future wardrobes · media walls · bathrooms — **every one receives metadata**. Nothing remains "just an image."

### Hero Image Intelligence

Every hero image knows:

- **camera** · composition · lighting · depth · negative space
- **safe areas** · CTA safe area · text safe area · logo safe area · social safe area
- **visual balance** · focal point · cropping limits
- **recommended layouts** · recommended theme packs · works-on channel list

**Runtime shipped this session:** `src/lib/nex/asset-platform/hero-image.ts`.

### Automatic Platform Variants

One design · many outputs (all 66 formats from the Design Sizes registry). The user never resizes anything · Nex generates every required version automatically.

### Smart Crop Engine

**Never stretch · never squash · never crop the product.** Detects stairs/door/kitchen/storage/people/logos/text/negative space → automatically repositions · maintains focal point. Implementation phased.

### Design Knowledge Learning

Every generated image becomes knowledge: Design Document · Scene Graph · Theme · Timber · Lighting · Objects · Fonts · Spacing · Component Layout · Render Manifest · Performance · User Feedback. Future renders improve.

### Asset Relationships

`oak_staircase → oak_kitchen → oak_flooring → oak_doors → oak_storage → oak_wardrobes` — one design graph.

## Directive 2 · Universal Object Model + Geometry Layer

*"Don't build separate 2D and 3D systems. Build a single Universal Design Object Model that both 2D and 3D renderers consume."*

### The new stack

```
Knowledge
    ↓
Recommendation Engine
    ↓
Design Document
    ↓
Universal Object Graph
    ↓
    ┌──────────┬──────────┬──────────┬──────────┐
    │          │          │          │          │
2D Renderer  SVG      3D Renderer  Print    Website Renderer
    │          │          │          │          │
   PNG       SVG    glTF/USD/USDZ   PDF       HTML/CSS
```

**Every object exists ONCE.** A staircase_001 becomes:

- 2D floor plan · website illustration · quotation image · marketing banner · photorealistic render · AR model · VR walkthrough · BIM object

**without redefining it.**

### The Geometry Layer (NEW · Philip 2026-08-04)

```
Design Object → Geometry Object → Material Object → Scene Object → Renderer
```

Every geometry object knows: **Bounding box · Origin · Rotation · Scale · Materials · Textures · Connectors · Collision · Animation points · LOD · Units.**

### Every product becomes intelligent (composition tree)

**Staircase:** Stringers · Treads · Risers · Landing · Handrail · Newels · Balusters · Glass · LEDs · Fixings · Accessories.

**Kitchen:** Cabinets · Doors · Worktop · Sink · Tap · Oven · Hob · Fridge · Lighting · Handles.

Every child object is reusable.

### 10 Render Targets

`render2D()` · `render3D()` · `renderElevation()` · `renderFloorPlan()` · `renderExplodedView()` · `renderAnimation()` · `renderAR()` · `renderVR()` · `renderPrint()` · `renderWebsite()` · `renderPDF()`.

**All consume the same Design Document.** Runtime enum shipped this session at `src/lib/nex/geometry-platform/render-targets.ts`.

### Material Intelligence

Every material is an object: Colour · Grain · Roughness · Normal Map · Reflection · Transparency · Texture · Manufacturer · Maintenance · Cost. One oak definition used everywhere.

### Camera Intelligence (10 profiles)

Marketing · Website · Instagram · Flyer · Technical · Construction · Exploded · Isometric · Floorplan · Section. Never guessed · always resolved from a catalog.

### Lighting Intelligence (8 profiles)

Luxury Warm · Modern Cool · Industrial · Showroom · Daylight · Golden Hour · Studio · Night LEDs. Renderer applies the profile · never invents.

### Animation

Every object animatable: staircase assembly · cabinet doors · loft ladder unfolding · under-stair drawers · wardrobe doors · LED transitions · camera fly-throughs · exploded technical views. Reusable across marketing · installation guides · training.

### Recommendation on rendering technology

**Do NOT build a 3D engine from scratch.** Build the Scene Graph + Geometry Layer · output to glTF · USD · USDZ. Proven engines (Three.js · Babylon.js · Blender · Unreal · Unity) consume those files. Nex owns the design/product/recommendation/geometry/material/planning INTELLIGENCE · rendering tech evolves.

## Directive 3 · Reality Advisor Platform (Construction Design Assistant)

### The Design Document never disappears

Voice answers "Why did you make the staircase like this?" by READING the Design Document · never inventing an explanation. Every decision is stored · every image contains invisible metadata explaining why.

### Voice edits naturally

*"Make the handrail darker."* → Nex updates ONE object (Handrail.Material.Finish → Dark Walnut). Nothing else changes.

### Construction Mode · 7-level realism classification

Every recommendation is classified:

1. **Realistic** — buildable today with standard practice.
2. **Possible** — buildable with engineering.
3. **Requires Engineering** — needs structural or specialist input.
4. **Requires Structural Changes** — building modification required.
5. **Building Regulations Required** — regs consent needed.
6. **Not Recommended** — feasible but strongly advised against.
7. **Impossible** — cannot be built.

Nex explains WHY at each level.

### Design Validation Engine · 7 scores per idea

- **Design Score** · **Construction Score** · **Safety Score** · **Budget Score** · **Maintenance Score** · **Building Regulation Score** · **Reality Score**.

Reality Score 98% = *"This can genuinely be built."* Reality Score 35% = *"Looks nice but requires significant redesign to be practical."*

### Reality Advisor · new platform service (Philip's directive)

```
Knowledge → Reasoning → Planning → Reality Advisor → Validation → Rendering → Voice Explanation → Delivery
```

**Reality Advisor NEVER changes the design.** It only advises.

**Responsibilities:** structural feasibility · joinery feasibility · manufacturing feasibility · installation feasibility · cost realism · safety · building regulations · accessibility · maintenance · durability · material compatibility.

**Runtime shipped this session:** `src/lib/nex/reality-advisor/` with 7-level classification + 7-score validation contract.

### Conversation Memory

*"I don't like glossy kitchens."* → later *"Design my kitchen"* → Nex already knows Finish = Matt · no re-asking. Stored in `src/lib/nex/knowledge-layer/` user preferences (existing).

### Vision (Voice-first Construction Design Assistant)

1. User describes want (voice/text). 2. Nex designs from knowledge + prior conversation. 3. Nex validates realistically · flags structural/regulatory/practical concerns · distinguishes buildable from conceptual. 4. Nex generates visual. 5. User: *"Make the staircase wider and the handrail walnut."* → Nex updates only those parts. 6. User: *"Why did you choose that layout?"* → Nex explains from Design Document + Reality Advisor · never invents.

## Directive 4 · Spatial Intelligence Platform

### The rule (Philip 2026-08-04)

*"A picture alone does not contain real-world dimensions. Nex needs to distinguish between estimated and verified measurements."*

### Confidence bands (constitutional · never hidden)

| Level | % | Basis |
|-------|---|-------|
| **Verified** | 100% | Measured from CAD |
| **Calibrated** | 96% | One known reference in image |
| **Estimated** | 82% | AI vision · no CAD |
| **Guess** | 45% | No scale reference |

**Every measurement Nex ever shows carries its confidence.** Never present Estimated as Verified · never hide the band. Constitutional rule.

### Multiple unit systems

- **Length:** mm · cm · m · inch · foot · yard
- **Area:** mm² · cm² · m² · ft²
- **Volume:** mm³ · cm³ · m³ · litres · gallons
- **Weight:** grams · kg · tonnes · ounces · pounds
- **Liquid:** litres · millilitres · gallons · pints
- **Pressure:** psi · bar · Pa
- **Temperature:** °C · °F
- **Angles:** degrees · radians

Every value convertible automatically.

### Calibration (image-based)

User uploads photo → Nex asks *"Do you know one real measurement here (e.g. 762 mm door · 900 mm staircase)?"* → that known dimension calibrates the frame → Nex derives width · height · length · depth · area · volume · angles · clearances · headroom **with confidence per derivation.**

### Derived construction calculations

- **Concrete:** Length × Width × Depth → m³ → tonnes → bags.
- **Water:** Tank volume → litres → gallons → weight when full.
- **Timber:** dimensions → volume × density → weight.
- **Paint:** wall area − openings → paintable area / coverage → litres.
- **Tiles:** floor area / tile size + cut allowance → boxes.

### Intelligent construction advice

*"This island worktop is ~3.8 m long"* → Nex: *"Estimated weight 410 kg (quartz) · four installers recommended · floor loading check · delivery route required · steel reinforcement may be needed."*

### Object intelligence (staircase example)

Total rise · total run · number of treads · individual tread dimensions · timber volume · timber weight · glass area · handrail length · LED strip length · paint area · material cost estimate · delivery size · installation time.

### Construction intelligence (auto-generated)

Cutting lists · material schedules · bills of materials · weight calculations · cost estimates · carbon estimates · waste estimates · packing lists · installation sequence.

### Module layout (Philip's exact recommendation)

```
src/lib/nex/spatial/
    units.ts                    (SHIPPED this session)
    confidence.ts               (SHIPPED this session)
    measurement.ts              (SHIPPED this session)
    calibration.ts              (SHIPPED this session)
    geometry.ts                 (SHIPPED this session)
    estimation.ts               (SHIPPED this session)
    bill-of-materials.ts        (SHIPPED this session)
    volume.ts                   (folded into geometry.ts)
    weight.ts                   (folded into estimation.ts)
    material-density.ts         (folded into estimation.ts)
    structural-loads.ts         (PENDING · Reality Advisor composes)
    index.ts                    (SHIPPED this session)
```

**Renderer remains responsible ONLY for drawing. Spatial Platform owns every measurement · conversion · engineering calculation.**

## The Golden Rule (elevated · Philip 2026-08-04)

**The renderer never designs.**
**The planner never draws.**
**The AI model never decides styling.**
**Only the Design Intelligence Platform decides design.**

Everything else executes deterministic instructions.

## Complete Long-Term Pipeline

```
User Request (voice or text)
    ↓
Conversation Memory
    ↓
Intent (Universal Intent Library)
    ↓
Knowledge Layer
    ↓
Recommendation Engine
    ↓
Design Document
    ↓
Reality Advisor (validate before commitment)
    ↓
Universal Object Graph (Geometry + Material + Camera + Lighting)
    ↓
Composition Platform (alignment · spacing · collision)
    ↓
Asset Intelligence Platform (Hero Image Intelligence · Smart Crop · Variants)
    ↓
Layout Planner
    ↓
Render Targets: 2D · SVG · 3D · Elevation · FloorPlan · Exploded · Animation · AR · VR · Print · Website · PDF
    ↓
Spatial Intelligence overlay (measurements · BOM · cost · installation)
    ↓
Render Manifest + Voice Explanation
    ↓
Delivery (any of 66 sizes)
    ↓
Learning Loop (feeds back into Asset Intelligence + Knowledge)
```

**Every pass makes Nex smarter.**

## Phased sub-delivery for Phase E.2

| Sub-phase | Scope | Status |
|-----------|-------|--------|
| **E.2.0** | Doctrine + Spatial + Reality Advisor + Geometry Platform scaffold + Hero Image Intelligence | SHIPPING (this session) |
| **E.2.1** | Asset Ingestion pipeline · retro-index 54 staircase + 23 banner specimens into UniversalAsset records | PENDING |
| **E.2.2** | Smart Crop Engine · focal-point-preserving auto-resize across all 66 formats | PENDING |
| **E.2.3** | Reality Advisor implementation · rules per domain (staircase · kitchen · joinery · roofing) | PENDING |
| **E.2.4** | Spatial Calibration Vision pipeline · one-known-reference → derive frame scale | PENDING |
| **E.2.5** | Object Composition Trees (staircase-children · kitchen-children) with Geometry Objects | PENDING |
| **E.2.6** | Material Intelligence Library · every material as a first-class object | PENDING |
| **E.2.7** | Render Target implementations (glTF · USD · USDZ · PDF · HTML) | PENDING |
| **E.2.8** | Voice Explanation subsystem · reads from Design Document + Render Manifest | PENDING |
| **E.2.9** | Bill-of-Materials generator per rendered object | PENDING |

## Governance

- **Constitutional:** Asset Intelligence Platform sits at the centre · every image → structured knowledge.
- **Constitutional:** Every object exists ONCE (Universal Object Model) · never duplicated per output format.
- **Constitutional:** Reality Advisor NEVER changes the design · only advises.
- **Constitutional:** Every measurement carries its confidence band · never presented as verified when estimated.
- **Constitutional:** Renderer never designs · Planner never draws · AI never decides styling.
- **Governance:** every new output format adds a Render Target · never a bespoke renderer.
- **Governance:** every measurement flows through `src/lib/nex/spatial/` · never inlined in renderer or planner.
- **Governance:** every construction advice flows through `src/lib/nex/reality-advisor/` · never inlined.
