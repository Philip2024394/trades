---
authored_by: Philip O'Farrell (E.10-E.15 roadmap + Visual Knowledge Extraction Platform + Every-Visual-Input-Becomes-Knowledge CORE pin) · Master AI Engineer (contracts + phased plan)
authored_role: Founder platform doctrine + Master AI Engineer implementation architecture
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Phase E.10-E.15 · Reconstruction · Pattern Learning · Design DNA · Reality Reconstruction · UDL · Multi-Modal
document_version: 1.0
document_type: MEGA_DOCTRINE · 6 new platforms + Visual Knowledge Extraction Platform + 1 CORE pin
composes_with:
  - docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md (E.8-E.10 prior · Vision + Sketch)
  - docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md
constitutional_rules_introduced:
  - rule_every_visual_input_becomes_reusable_knowledge (CORE · Philip 2026-08-04)
---

# Phase E.10–E.15 · Design Reconstruction · Pattern Learning · Design DNA · Reality Reconstruction · UDL · Multi-Modal + Visual Knowledge Extraction Platform

## The New CORE Constitutional Principle (Philip 2026-08-04)

*"Every visual input shall become reusable knowledge. Nex shall never treat an image as pixels alone. Every sketch, photograph, CAD drawing, render, scan, or video frame shall be analysed into structured design objects, geometry, materials, lighting, relationships, measurements, and confidence. Rendering is only one possible output of this knowledge. Editing, reasoning, construction advice, manufacturing, documentation, and future designs all operate on the same Design Document rather than isolated pixels."*

**Elevation:** this generalises the earlier `Pixels are Temporary · Knowledge is Permanent` CORE pin from IMAGES specifically to ALL visual inputs (sketches · photos · CAD · renders · scans · video). Feedback pin: `feedback_nex_every_visual_input_becomes_knowledge.md`.

## Directive · Visual Knowledge Extraction Platform (VKEP)

Philip's refinement: *"Add a dedicated Visual Knowledge Extraction Platform BEFORE the Design Memory layer. Design Memory never stores 'images' as its primary knowledge. It stores understood design knowledge, with the original image attached as evidence."*

**Pipeline:**

```
Image / Sketch / Photo / CAD / Scan / Video Frame
    ↓
[Visual Knowledge Extraction Platform]
    ├── Detect Objects            (Vision Intelligence)
    ├── Recognise Materials       (Vision Intelligence + Material Platform)
    ├── Recognise Style           (Vision Intelligence · Style DNA)
    ├── Recognise Geometry        (Sketch Intelligence · Geometry Platform)
    ├── Recognise Lighting        (Vision Intelligence · Lighting Simulator)
    ├── Recognise Colours         (Vision Intelligence · Mood Profile)
    ├── Recognise Measurements    (Spatial Intelligence · with confidence)
    ├── Recognise Relationships   (Interior Relationship Engine)
    └── Build Design Objects      (Design Platform · DOM)
    ↓
Store in Design Memory (structured knowledge · not pixels)
Original image retained only as EVIDENCE.
```

**Location:** `src/lib/nex/visual-knowledge-extraction/` (SHIPPED this session · orchestrates the platform stack · writes to Design Memory + Asset Library).

## Directive · Phase E.10 · Design Reconstruction Engine

*"Instead of an image · Nex reconstructs Objects → Geometry → Materials → Lighting → Relationships → Scene Graph → Editable Design Document."*

Users edit design objects · not pixels. Instead of *"make it blue"* they edit `Material Object #17: oak → walnut`. Far more powerful.

**Contract:** `reconstruct(visualAnalysis, hint) → EditableDesignDocument`. Feeds Editing Platform + Design History.

**Location:** `src/lib/nex/design-reconstruction/` (SHIPPED this session · composes Vision Analysis + Sketch Interpretation into an editable proto-DesignDocument).

## Directive · Phase E.11 · Pattern Learning Engine

*"After analysing 20,000 staircases Nex learns oak usually pairs with warm white · glass balustrades · matt black hardware · natural walls. No human hardcodes those relationships."*

**Contract:** `Pattern Learning Engine` observes every VisionAnalysis · learns co-occurrence patterns · surfaces high-support pairings ("if oak then 78% of time warm_white lighting · 62% glass balustrade · 45% matt_black hardware").

**Location:** `src/lib/nex/pattern-learning/` (SHIPPED this session · in-memory co-occurrence counters + confidence-weighted pair mining).

## Directive · Phase E.12 · Design DNA Engine

*"Every project receives a fingerprint · Luxury 82% · Scandinavian 14% · Industrial 4% · Warmth 91% · Complexity Low · Contrast Medium · Symmetry High · Timber Oak. Now Nex understands why two projects feel similar."*

**Distinct from Style DNA** (image-level in Vision Intelligence). Design DNA is PROJECT-level · aggregates every VisionAnalysis + material choice + reasoning chain across a project.

**Contract:** `computeDesignDNA(projectId, visionAnalyses[]) → DesignDNAFingerprint` + `similarity(a, b) → number`.

**Location:** `src/lib/nex/design-dna/` (SHIPPED this session).

## Directive · Phase E.13 · Reality Reconstruction

*"If the user uploads 2 photos of a kitchen · Nex reconstructs Room · Walls · Windows · Doors · Floor · Ceiling · Lighting · Cabinets · Measurements · Confidence. Now it can genuinely redesign the space instead of painting over a photograph."*

**Contract:** `reconstructRoom(photos[], hints) → RoomReconstruction` with:
- room_type · walls[] · windows[] · doors[] · floor · ceiling · lighting_fixtures[] · cabinet_positions[] · every measurement carries a Confidence band (Verified/Calibrated/Estimated/Guess).

**Location:** `src/lib/nex/reality-reconstruction/` (SHIPPED this session · composes Vision Analysis + Scene Platform Room types + Spatial Intelligence measurements).

## Directive · Phase E.14 · Universal Design Language (UDL)

*"Sketch · Photo · CAD · PDF · 3D Scan · Video · Voice · Text → Universal Design Document. Everything converges into one representation. Everything renders from one representation."*

**Contract:** `UniversalDesignLanguage` interface with 8 converters (fromSketch · fromPhoto · fromCAD · fromPDF · fromScan · fromVideo · fromVoice · fromText). Each returns the same base DesignDocument shape. New input modalities add a converter · never a new document format.

**Location:** `src/lib/nex/udl/` (SHIPPED this session · contract + 3 MVP converters wrapping existing platforms).

## Directive · Phase E.15 · Multi-Modal Design Intelligence

Final ingestion orchestrator:

```
Voice · Text · Sketch · Photo · PDF · Video · LiDAR · Measurements · Conversation History
    ↓
Reasoning
    ↓
Reality Advisor
    ↓
Construction Intelligence
    ↓
Planning
    ↓
Scene Graph
    ↓
Rendering
```

**Contract:** `ingest(inputs[]) → { design_document, provenance, confidence }`. Dispatches each input to the right ingestion pipeline via UDL · fuses the results.

**Location:** `src/lib/nex/multimodal/` (SHIPPED this session · dispatch table + fusion contract).

## The Layered Stack (post Phase E.15)

```
Multi-Modal Intelligence                                  (E.15 · orchestrator)
     ↓
Universal Design Language                                 (E.14 · converters)
     ↓
Visual Knowledge Extraction Platform                      (Philip refinement · this session)
     ↓ ─ ─ ─ decomposes visual input into knowledge ─ ─ ─
Vision Intelligence Platform          (E.8/9)             Sketch Intelligence Platform (E.9)
     ↓                                                             ↓
Design Reconstruction Engine                              (E.10 · this session)
     ↓
Pattern Learning Engine                                   (E.11 · this session)
     ↓
Design DNA Engine                                         (E.12 · this session)
     ↓
Reality Reconstruction Platform                           (E.13 · this session)
     ↓
[all pipe into] Design Memory · Asset Library · Learning Loop · Design History
     ↓
Reasoning · Planning · Reality Advisor · Construction · Composition · Design Platform · Geometry · Material · Lighting Simulator · Scene · Interior Relationships · Spatial
     ↓
Editing Platform · Voice · Rendering · Prompt Compiler · Delivery
```

## Rule for Visual Knowledge Extraction (from Philip's refinement)

*"Design Memory never stores 'images' as its primary knowledge. It stores understood design knowledge, with the original image attached as evidence."*

Implemented in this session: `visual-knowledge-extraction/extract.ts` writes a `DesignMemoryEntry` whose `design_document` field is the DECOMPOSED knowledge · and whose `final_rendered_asset_id` field references the UniversalAsset that carries the raw image as evidence. Consumers query the DECOMPOSED knowledge for reasoning · editing · recommendation · construction advice · estimation · future designs. Nex only reaches back to the raw bytes for regeneration or user display · never for design decisions.

## Governance

- Every visual input flows through Visual Knowledge Extraction Platform · which routes to Vision Intelligence + Sketch Intelligence + Reality Reconstruction + Spatial Intelligence + Pattern Learning + Design DNA.
- Design Memory holds STRUCTURED KNOWLEDGE · not images.
- New input modalities extend UDL · never invent a new document format.
- Pattern Learning surfaces MINED pairings · never hardcoded rules.
- Design DNA fingerprints are DERIVED · never manually assigned.
- Reality Reconstruction reports EVERY measurement with a confidence band.
- Multi-Modal Intelligence NEVER blends modalities without recording each modality's provenance.

## Assessment (Philip 2026-08-04)

*"The renderer becomes one relatively small service inside a much larger ecosystem. The long-term value isn't that Nex can produce an image — it's that Nex can understand, remember, explain, edit, validate, and regenerate designs from a shared knowledge model. That foundation is much harder to replicate than a standalone image generation feature."*
