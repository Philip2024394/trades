---
authored_by: Philip O'Farrell (Editing + Delivery + Design Memory + Image Critic + Learning Brain + Prompt Compiler + core reframe) · Master AI Engineer (schema + contracts)
authored_role: Founder platform doctrine + Master AI Engineer implementation architecture
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Phase E.5-E.7 · Editing · Delivery · Design Memory · Image Critic · Learning · Prompt Compiler
document_version: 1.0
document_type: MEGA_DOCTRINE · Phase E.5-E.7 · plus reframe pin
composes_with:
  - docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md (parent roadmap)
  - docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md (E.2 unified platforms)
  - docs/brains/nex-design-intelligence-platform-ndip-philip-2026-08-04.md (NDIP)
constitutional_rules_introduced:
  - rule_not_an_image_generator (CORE · Philip 2026-08-04)
  - rule_design_memory_never_starts_over
  - rule_delivery_platform_is_a_registry_not_a_switch
---

# Phase E.5–E.7 · Editing · Delivery · Design Memory · Image Critic · Learning Loop · Prompt Compiler

## The Core Reframe (Philip 2026-08-04)

*"Nex should not become the world's best image generator. It should become the world's best design intelligence platform that happens to generate images."*

**This is now a CORE constitutional principle.** Ranked with:
- Layer Separation Inviolable.
- Renderer Never Makes Aesthetic Decisions.
- Universal Object Model.
- No Image Without Knowledge.

**Practical consequence:** every future proposal is measured against the reframe. *"Should we build a diffusion model?"* → NO. *"Should we build a Prompt Compiler that hands a structured brief to any diffusion model?"* → YES. Nex's competitive advantage is the intelligence upstream of the pixel · not the pixel itself.

**The pipeline expresses the reframe:**

```
User
  ↓
Nex Knowledge Brain
  ↓
Design Intelligence
  ↓
Reality Advisor
  ↓
Editing Platform            (E.5 · NEW · natural-language commands)
  ↓
Planning Engine
  ↓
Universal Object Model
  ↓
Scene Graph
  ↓
Prompt Compiler             (E.7 · NEW · DesignDocument → structured prompt)
  ↓
Renderer OR Image Model     (renderer OR diffusion · both consume same compiled brief)
  ↓
Image Critic                (E.7 · NEW · 10-dimension scoring)
  ↓
Reality Checker             (composes with existing Reality Advisor)
  ↓
User
  ↓ every render captured →
Design Memory               (E.5 · NEW · persistent visual memory)
Learning Loop               (E.7 · NEW · feeds back into Knowledge)
Delivery Platform           (E.7 · NEW · exports to any target format)
```

**The image model is one component. Nex does everything before that. That is a much bigger competitive advantage.**

## Directive 1 · Phase E.5 Editing Platform

**Rule:** users modify the Design Document · not the image. Every edit is a high-level command interpreted into a Design History Operation.

**Command examples (Philip 2026-08-04):**
- *"Move the staircase 300mm left."*
- *"Replace oak with walnut."*
- *"Increase the logo by 15%."*
- *"Make the handrail darker."*
- *"Change the camera to Instagram."*
- *"Change the lighting to golden hour."*

**Contract:** `parseCommand(text, ctx) → EditCommand[]` → each `EditCommand` maps to a Design History `Operation`. The image is never touched · the DesignDocument mutates through the History Engine · the renderer produces the new pixels deterministically.

**Constitutional composition:** Editing Platform sits BETWEEN Voice/Intent and Design History. Never mutates the document directly · always emits Operations.

Location: `src/lib/nex/editing-platform/` (SHIPPED this session · MVP command parser + intent taxonomy).

## Directive 2 · Phase E.6 Voice & Explanation

**Already SHIPPED** (Phase E.7 in prior roadmap · `src/lib/nex/voice-platform/`). This doctrine confirms Voice as the LAST layer before user response · it reads · never invents · REFUSES when evidence missing.

## Directive 3 · Phase E.7 Delivery Platform

**Rule (Philip 2026-08-04):** *"One Design Document exports to: SVG · PNG · JPG · WEBP · PDF · DOCX · PPTX · HTML · Website hero images · Social media formats · glTF · USD · USDZ."*

**Contract:** `Delivery Platform = registry of exporters + one dispatch function.**

```typescript
type Exporter = {
  format: DeliveryFormat;
  export(doc: DesignDocument, opts): Promise<DeliveryResult>;
  supported_render_targets: RenderTargetId[];
  status: "shipped" | "stub" | "external";
};
```

New formats add a registered Exporter · never a bespoke renderer. **Constitutional:** the Delivery Platform is a REGISTRY not a SWITCH statement.

Location: `src/lib/nex/delivery-platform/` (SHIPPED this session with SVG shipped + 10 registered stubs).

## Directive 4 · Design Memory (Philip's headline addition)

**Rule:** *"Not conversation memory. VISUAL memory."*

For every image, store:

```yaml
design_memory_entry:
  memory_id
  project_id
  captured_at
  original_brief                      # user's original request text/voice
  final_rendered_image_url
  design_document                     # snapshot at render time
  scene_graph
  object_graph
  design_decisions                    # reasoning chain
  reality_checks                      # RealityReport at time of render
  measurements                        # every Measurement at time of render
  style_tags
  compatible_products
  customer_edits                      # any post-render edits + reasons
  final_approved_version              # branch + version
  render_settings
  quality_score                       # Image Critic report
```

**Workflow:** user says *"Make me another one like last month but with walnut instead of oak"* → Nex loads the memory · swaps ONE material_ref via Editing Platform → Design History records the operation · Renderer re-renders · preserves everything else. **Nothing starts from scratch.**

Location: `src/lib/nex/design-memory/` (SHIPPED this session with full schema + in-memory store · JSONL persistence phased).

## Directive 5 · Image Critic Brain

**Rule:** *"Not 'looks nice'. Score across 10 dimensions."*

10 dimensions (Philip's exact list):
1. Realism · 2. Lighting · 3. Composition · 4. Typography · 5. Brand consistency · 6. Construction accuracy · 7. Anatomy · 8. Perspective · 9. Marketing quality · 10. Accessibility.

**Contract:** `critique(image_ref, context) → CritiqueReport { scores[10], overall, issues[], suggestions[] }`. Feeds Learning Loop + informs Reality Advisor + surfaces suggested edits for the user.

Location: `src/lib/nex/image-critic/` (SHIPPED this session · MVP heuristics · vision-model integration phased).

## Directive 6 · Learning Loop / Learning Brain

**Rule:** *"Every render becomes knowledge. After thousands of jobs · Nex becomes better."*

Store per render:
- Prompt · scene · objects · materials · output · user edits · final accepted · rating · learn signals.

**Contract:** `LearningLoop.capture(record)` · `LearningLoop.query(filter)`. Populated by Design Memory + Image Critic + Editing Platform · consumed by Knowledge Layer (future feed) + Recommendation Engine (higher priority for historically successful choices).

Location: `src/lib/nex/learning-loop/` (SHIPPED this session · append-only in-memory store · JSONL persistence phased · integration with existing `data/nex-learning-log.jsonl` phased).

## Directive 7 · Prompt Compiler (bridge to any diffusion/flow-matching/transformer model)

**Rule (Philip 2026-08-04):** *"Nex should never depend on a single architecture. Diffusion · Flow Matching · Transformer · Future model."*

**Contract:** `compilePrompt(doc, target) → CompiledPrompt { positive · negative · control_maps · reference_images · guidance_scale · seed_policy }`. Takes a fully-specified DesignDocument · produces a structured brief the image model can consume WITHOUT losing the design intent.

**Composition:** Prompt Compiler is the LAST step before the image model · it PRESERVES every design decision as an explicit prompt fragment · so the diffusion model becomes a `paint` executor rather than a `design` decider.

Location: `src/lib/nex/prompt-compiler/` (SHIPPED this session · MVP that translates DesignDocument metadata + material refs + camera + lighting into a positive/negative prompt structure).

## Missing capabilities that were captured (already SHIPPED · reconfirmed)

- **Construction Intelligence** — ✅ shipped (`src/lib/nex/construction-platform/`).
- **Material Intelligence** — ✅ shipped (`src/lib/nex/material-platform/`).
- **Measurement Intelligence** — ✅ shipped (`src/lib/nex/spatial/`).
- **Explainability** — ✅ shipped (Voice Intelligence + Render Manifest provenance).
- **Editability** — ✅ shipping this session (Editing Platform + Design History).
- **Deterministic Rendering** — ✅ shipped (NDIP · Render Manifest · determinism hash).

## Constitutional pins introduced this session

**1 · Not an Image Generator (CORE)** — Nex is a Design Intelligence Platform that happens to generate images. Every future proposal tests against this reframe. Feedback pin: `feedback_nex_not_an_image_generator.md`.

**2 · Design Memory Never Starts Over** — user requests like *"make another like last month but walnut"* MUST load the prior memory · swap the one changing object · preserve everything else. Never re-render from scratch. Feedback pin: `feedback_nex_design_memory_never_starts_over.md`.

**3 · Delivery Platform is a Registry Not a Switch** — new output formats add a registered Exporter · never a bespoke renderer · never a switch statement in a hot path. Feedback pin: `feedback_nex_delivery_is_a_registry.md`.

## Phased sub-delivery

| Sub-phase | Scope | Status |
|-----------|-------|--------|
| **E.5.0** | Editing Platform · MVP command parser + intent taxonomy + Design History integration | SHIPPING (this session) |
| **E.7.0** | Delivery Platform · registry + 11 exporter stubs + SVG shipped | SHIPPING (this session) |
| **E.7.1** | Design Memory · schema + in-memory store + findSimilar/reuse | SHIPPING (this session) |
| **E.7.2** | Image Critic · 10-dimension scoring · MVP heuristics | SHIPPING (this session) |
| **E.7.3** | Learning Loop · capture + query | SHIPPING (this session) |
| **E.7.4** | Prompt Compiler · DesignDocument → structured brief for any image model | SHIPPING (this session) |
| E.5.1 | Editing Platform · vision-language parser · handles free-form commands | PENDING |
| E.7.5 | Delivery Platform · PNG raster via headless renderer | PENDING |
| E.7.6 | Delivery Platform · PDF/DOCX/PPTX/HTML/glTF/USDZ | PENDING |
| E.7.7 | Design Memory · JSONL + Supabase persistence + Vector index | PENDING |
| E.7.8 | Image Critic · vision-model integration for real scoring | PENDING |
| E.7.9 | Learning Loop · Analytics dashboard · feeds back into Knowledge | PENDING |

## Assessment

Philip 2026-08-04: *"The long-term value won't come from generating pixels. It will come from the fact that every image · design · material · product · scene · measurement · and marketing asset exists as structured knowledge that can be reused across websites · quotations · brochures · social media · 3D visualisations · construction guidance · and future renderers. That creates a platform that can adopt newer image-generation models over time without having to rebuild the intelligence that makes the designs coherent and technically correct."*

## Governance

- Every new PR must classify into ONE platform · never smeared.
- Every image ENTERING or LEAVING Nex must produce a Design Memory record + Asset Library entry (CORE constitutional).
- Every editing action must flow through the Editing Platform → Design History (CORE constitutional).
- Every output format must be a registered Delivery Exporter · never a bespoke renderer (CORE constitutional).
- Every design decision remains editable · nothing is flattened (CORE constitutional).
- Every render is deterministic (CORE constitutional).
