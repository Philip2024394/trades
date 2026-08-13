---
authored_by: Philip O'Farrell (Visual Learning Platform + Object DNA + Every-Upload-Improves-Nex CORE pin) · Master AI Engineer (schema + contracts)
authored_role: Founder platform doctrine + Master AI Engineer implementation architecture
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Phase E.16 · Visual Learning Platform + Object DNA / Object Library
document_version: 1.0
document_type: MEGA_DOCTRINE · Phase E.16 · compounding learning + persistent object identity + 1 CORE pin
composes_with:
  - docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md (VKEP · Vision Intelligence · Sketch Intelligence)
  - docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md (Vision + Sketch Intelligence platforms)
  - docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md (DOM foundation)
constitutional_rules_introduced:
  - rule_every_upload_permanently_improves_nex (CORE · Philip 2026-08-04)
---

# Phase E.16 · Visual Learning Platform + Object DNA / Object Library

## The New CORE Constitutional Principle (Philip 2026-08-04)

*"Every uploaded image must permanently improve Nex. An image is never processed for a single task and forgotten. Vision Intelligence extracts structured knowledge, Visual Learning compares it against the existing Object Library, new or improved objects are versioned into the Design Platform, confidence scores are updated, and future reasoning, rendering, construction advice, editing, manufacturing, and recommendations all benefit. The value of the platform must increase with every image it processes."*

**Elevation:** this becomes the seventh CORE constitutional principle · ranked with:
1. Layer Separation Inviolable.
2. Renderer Never Makes Aesthetic Decisions.
3. Universal Object Model.
4. No Image Without Knowledge.
5. Pixels are Temporary · Knowledge is Permanent.
6. Every Visual Input Becomes Reusable Knowledge.
7. **Every Upload Permanently Improves Nex.** (this session)

Feedback pin: `feedback_nex_every_upload_permanently_improves_nex.md`.

## The Two Platform Distinctions

### Vision Intelligence understands ONE image (already shipped · Phase E.8-E.9)

Takes a single visual input · produces a VisionAnalysis (objects · shapes · relationships · mood · Style DNA · scene · knowledge graph). Every call is independent.

### Visual Learning Platform (VLP) learns from MILLIONS of images (this session)

Takes every VKEP extraction · compares against every object already in the Object Library · improves confidence · merges duplicates · learns new styles/proportions · versions objects.

**Over years this becomes Nex's visual experience.**

## Directive · Object Library (Object DNA)

Every recognised object receives its own permanent identity.

```
Object ID · STAIR_HANDRAIL_028441
    ├── Shape signature
    ├── Material
    ├── Dimensions
    ├── Style
    ├── Manufacturing steps
    ├── Compatible objects
    ├── Cost
    ├── Weight
    ├── Construction rules
    ├── Image examples (evidence · references UniversalAsset ids)
    ├── Supplier links
    ├── History (versions · dedupe merges · confidence changes)
    └── Variants (colour · size · finish · timber species)
```

**Constitutional consequence:** the renderer doesn't CREATE handrails · it renders objects that already exist. Every design uses REAL objects with real supplier links · real cost · real construction rules · real compatibility rules.

**Location:** `src/lib/nex/object-library/` (SHIPPED this session · in-memory store · JSONL persistence phased · Supabase phased).

## Directive · Visual Learning Platform (VLP)

**Pipeline:**

```
Upload
    ↓
Vision Intelligence     (extract structured knowledge from one image)
    ↓
VKEP                    (write to Design Memory + Asset Library)
    ↓
Visual Learning         (compare against Object Library + improve)
    ├── Compare against every existing object
    ├── Improve confidence for matched objects
    ├── Merge duplicates
    ├── Register new objects with unique DNA
    ├── Learn styles (Pattern Learning aggregates)
    ├── Learn proportions
    └── Version updates back into the Object Library
    ↓
Every future reasoning / rendering / construction / editing / manufacturing / recommendation benefits.
```

**Contract:**

```typescript
learn(extraction, opts) → LearningReport {
  new_objects_registered: readonly ObjectDNA[],
  existing_objects_updated: readonly { object_id: string; version_before: number; version_after: number; changes: string[] }[],
  duplicates_merged: readonly { kept_id: string; merged_id: string; reason: string }[],
  confidence_improvements: readonly { object_id: string; delta: number }[],
  style_signals_learned: readonly { feature: string; value: string; support_delta: number }[],
}
```

**Location:** `src/lib/nex/visual-learning/` (SHIPPED this session · orchestrates comparison against Object Library · versioning · confidence updates · dedupe · style-signal capture).

## The Compounding Advantage

Philip 2026-08-04: *"Most AI companies train one giant model. You're building something different."*

```
Knowledge
    ↓
Object Library                                (Phase E.16 · SHIPPING this session)
    ↓
Design Rules
    ↓
Construction Rules
    ↓
Visual Learning                               (Phase E.16 · SHIPPING this session)
    ↓
Reality
    ↓
Planning
    ↓
Rendering
```

- Every new customer makes Nex smarter.
- Every uploaded image makes Nex smarter.
- Every staircase makes the staircase object library better.
- Every kitchen improves the kitchen knowledge.

That is a **compounding advantage** that no single-model AI company can match — because their model is FIXED after training · Nex's Object Library GROWS every day.

## Two Layers · Two Purposes

| Layer | Purpose | Runs per | Persistence |
|-------|---------|---------|-------------|
| Vision Intelligence | Understand ONE image | Per upload | Ephemeral (returned to caller) |
| Visual Learning Platform | Learn from ALL images | Aggregate | Permanent (Object Library grows forever) |

## Object DNA · what it means for the renderer

When a user asks *"design me a traditional oak staircase"*:

1. Knowledge Layer knows what "traditional oak staircase" is.
2. Recommendation Engine picks the design pattern.
3. **Object Library provides REAL objects** — real handrail (STAIR_HANDRAIL_028441) · real newel (STAIR_NEWEL_009812) · real spindle (STAIR_SPINDLE_004411) · real tread (STAIR_TREAD_017903).
4. Every object comes with its own construction rules · supplier links · cost · weight · compatible-objects list.
5. Composition Platform lays them out.
6. Renderer draws exactly what's specified.
7. BOM Engine produces a real cutting list because every object has real dimensions and real suppliers.

**No object is invented. Every object is real. Every object has evidence (image examples). Every object grows more accurate with every upload.**

## Governance

- Every VKEP extraction MUST flow through Visual Learning Platform after Design Memory is written.
- Every object recognised in an image is compared against the Object Library · never re-invented if a match exists.
- Every merge is auditable: `kept_id`, `merged_id`, `reason`, `at`, `by`.
- Every version bump records `changes` array so consumers can trace WHAT improved.
- Every image example a variant carries references a UniversalAsset id · never inline image bytes.
- Every Object DNA record carries `provenance.named_expert` per Rule c.
- Renderer NEVER creates handrails · it renders Object Library entries.

## Phased sub-delivery

| Sub-phase | Scope | Status |
|-----------|-------|--------|
| **E.16.0** | Object Library schema + in-memory store + Object DNA · Visual Learning Platform contract + MVP behaviour · doctrine + CORE pin | SHIPPING (this session) |
| E.16.1 | JSONL persistence for Object Library + version history | PENDING |
| E.16.2 | Supabase table `nex_object_library` + `nex_object_versions` + `nex_object_merges` | PENDING |
| E.16.3 | Perceptual-hash duplicate detection (image_examples similarity) | PENDING |
| E.16.4 | Vector index of Object DNA for k-nearest-neighbour lookup | PENDING |
| E.16.5 | UI: object-library browser · variant switcher · supplier picker | PENDING |
| E.16.6 | Analytics dashboard: how much the Object Library grew this week | PENDING |
