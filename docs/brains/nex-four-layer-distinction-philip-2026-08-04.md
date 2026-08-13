---
authored_by: Philip O'Farrell (4-layer distinction · Evidence · Observations · Knowledge · Decisions) · Master AI Engineer (contracts + mapping)
authored_role: Founder architectural refinement + Master AI Engineer platform mapping
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · CROSS-CUTTING · Four-Layer Distinction · applies to every existing platform
document_version: 1.0
document_type: MEGA_DOCTRINE · Four-Layer Distinction + Layer-Distinction CORE pin
composes_with:
  - docs/brains/nex-phase-e16-visual-learning-object-dna-philip-2026-08-04.md (Object Library + VLP)
  - docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md (VKEP + Vision + Sketch + Reality)
  - docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md (DOM foundation)
constitutional_rules_introduced:
  - rule_evidence_observations_knowledge_decisions_are_separate (CORE · Philip 2026-08-04)
---

# Four-Layer Distinction · Evidence · Observations · Knowledge · Decisions

## The Principle (Philip 2026-08-04)

*"If the system is now centred around structured design knowledge, I'd introduce an explicit distinction between four layers."*

| Layer | Purpose |
|-------|---------|
| **Evidence** | Original photos, scans, sketches, documents. What we RECEIVED. |
| **Observations** | Facts extracted from evidence, each with provenance and confidence. What we DERIVED. |
| **Knowledge** | Normalised objects and relationships ("closed string staircase", "oak tread"). What we KNOW. |
| **Decisions** | User-approved changes, recommendations, and final design choices. What was CHOSEN. |

**This separation answers three critical questions without conflating layers:**

- *"What did we observe?"*
- *"What do we know?"*
- *"What did the user choose?"*

## New CORE Constitutional Principle

**Rule (Philip 2026-08-04 · CORE):** *"Evidence, Observations, Knowledge, and Decisions are four separate layers. No platform may conflate them. Every stored fact must be classifiable into exactly one layer. Consumers can trace any design output back through Decisions → Knowledge → Observations → Evidence without ambiguity."*

**Elevation:** eighth CORE constitutional principle, ranked with the other seven (Layer Separation · Renderer Never Decides · Universal Object Model · No Image Without Knowledge · Pixels are Temporary · Every Visual Input Becomes Knowledge · Every Upload Improves Nex). Feedback pin: `feedback_nex_evidence_observations_knowledge_decisions.md`.

## Mapping Existing Platforms Onto the Four Layers

| Platform / Runtime module | Layer | Role |
|---------------------------|-------|------|
| `asset-platform/asset-library.ts` (UniversalAsset · raw URLs · file_hash · storage) | **Evidence** | Original bytes · perceptual hash · storage keys |
| Raw image URLs · sketch scans · CAD files · PDFs · 3D scans · video frames | **Evidence** | Received as-is |
| `vision-intelligence/analyze.ts` (VisionAnalysis · mood · style_dna · shape_signatures · relationships) | **Observations** | Extracted from one image · carries confidence + provenance |
| `sketch-intelligence/interpret.ts` (SketchInterpretation · per-component confidence) | **Observations** | Extracted from one sketch |
| `reality-reconstruction/reconstruct.ts` (RoomReconstruction · measurements + Confidence bands) | **Observations** | Extracted from N photos |
| `spatial/measurement.ts` (Measurement + Confidence) | **Observations** | Numeric facts with confidence |
| `vkep/extract.ts` (VKEPExtraction) | **Observations** | Orchestrates evidence → observations |
| `object-library/store.ts` (ObjectDNA · versioned) | **Knowledge** | Normalised · reusable · versioned |
| `material-platform/catalog.ts` (MaterialIntelligence) | **Knowledge** | Curated per Rule c |
| `material-platform/physics.ts` (MaterialPhysics) | **Knowledge** | Structured material properties |
| `construction-platform/rules.ts` (ConstructionRule) | **Knowledge** | Building regs codified |
| `knowledge-layer/` (Bronze · Silver · Gold FAQs · articles) | **Knowledge** | Authored + inherited domain knowledge |
| `design-platform/design-object.ts` (DesignObject taxonomy) | **Knowledge** | Formal domain vocabulary |
| `pattern-learning/mine.ts` (Pairing · learned associations) | **Knowledge** | Mined patterns become knowledge |
| `visual-learning/learn.ts` (versions Knowledge · updates from Observations) | **Knowledge** (bridge) | Consumes Observations · updates Knowledge |
| `design-history/` (recorded Operations) | **Decisions** | Every user-approved change |
| `design-memory/` `final_approved_version` field | **Decisions** | User's canonical choice |
| `editing-platform/` (parsed EditCommand → Operation) | **Decisions** | User-initiated edits |
| `reality-advisor/` accepted concerns · Planner overrides | **Decisions** | Judgement calls made by user or Planner |
| `recommendation-engine/` accepted recommendations (Decision) vs. offered (Observation of Knowledge applied to context) | **Decisions** (when accepted) |
| `voice-platform/` explanations | **Reads-only** across all 4 layers · never adds a new fact |

## Query Patterns Unlocked by the Distinction

**"What did we observe about this room?"** → query `vkep/extract` results by `project_id` → returns every Observation with confidence.

**"What do we know about oak handrails in general?"** → query `object-library` by family=STAIR_HANDRAIL · material=oak → returns normalised Knowledge.

**"What did the user choose in this project?"** → query `design-history` by branch + `design-memory` `final_approved_version` → returns Decisions.

**"Why did we know THAT?"** → walk from the Knowledge back through Observations back through Evidence via `image_example_asset_ids` chain.

**"What did the user override?"** → diff `reality-advisor` concerns against `design-history` Operations · gaps = overrides.

## Governance

- Every stored fact MUST be classifiable into exactly one layer (Evidence · Observation · Knowledge · Decision).
- No platform may CONFLATE layers · e.g. `object-library` may not store raw pixel bytes (that's Evidence) · `vision-intelligence` may not store user Decisions (that's the History Engine).
- Every Observation carries provenance + confidence back to its Evidence source.
- Every Knowledge update carries a version + `changes` log back to the Observations that triggered it.
- Every Decision carries a `reason` field back to the Knowledge/Observation that motivated it (or `"user override"` if none).
- Consumers can WALK all four layers backward without ambiguity · Voice Intelligence uses this to answer "why" questions truthfully.
- Every new capability added to Nex MUST declare which layer it lives in before merge.

## Runtime Support (shipped this session)

`src/lib/nex/four-layer/` — typed constants (`Layer` enum · `LAYER_DESCRIPTION` · `LAYER_QUESTIONS`) + `classifyModule(moduleId) → Layer` helper + `layerFor(moduleId)` reference table pre-populated with every existing platform. Provides a single canonical mapping for every future PR to consult.

## Assessment (Philip 2026-08-04)

*"Across the updates you've shared over the last day, there's a consistent evolution: Behavioural governance · Intent routing · Knowledge architecture · Cross-domain validation · Structured visual understanding. Those layers complement one another rather than overlapping. The next challenge won't be adding more features — it will be ensuring that each new capability continues to fit into these boundaries without forcing changes to the core architecture. If that remains true as the platform grows, it's a strong indication that the underlying design is scaling effectively."*
