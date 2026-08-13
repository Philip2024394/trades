---
authored_by: Philip O'Farrell (mandate + 5-layer architecture + 10 principles) · Master AI Engineer (schema + interface contracts)
authored_role: Founder platform vision + Master AI Engineer implementation architecture
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · PLATFORM CONSTITUTION · promotes Phase E.0 into an infrastructure platform
document_version: 1.0
document_type: MEGA_DOCTRINE · Nex Design Intelligence Platform (NDIP) · supersedes "banner renderer" framing
composes_with:
  - docs/brains/nex-pixel-rendering-engine-phase-e0-philip-2026-08-04.md (implementation MVP · now framed as Phase E.0 of NDIP)
  - docs/brains/nex-pattern-library-grammar-journey-philip-2026-08-04.md
  - docs/brains/nex-campaign-selection-engine-philip-2026-08-04.md
  - docs/brains/nex-marketing-design-intelligence-philip-2026-08-03.md
supersedes_framing:
  - "banner rendering engine" (still a valid subsystem · but Nex is building a platform)
---

# The Nex Design Intelligence Platform (NDIP)

## The Mandate

Philip 2026-08-04: *"You should aim even higher than a design platform. What you're really building is a Design Intelligence Platform. A banner generator is a feature. A rendering engine is a subsystem. A design platform is a product. A Design Intelligence Platform is infrastructure that can power many products."*

## Mission

Build the world's most comprehensive AI-driven design intelligence platform for the home improvement, construction, joinery, and interior design industries. The platform should understand not just how to draw designs, but how to **reason** about them, **coordinate** them across an entire project, and produce **consistent** outputs across every medium.

## The 5 Independent Layers · single responsibility each

```
┌────────────────────┐
│  Knowledge Layer   │  Stores facts + relationships. Never draws.
└─────────┬──────────┘
          ▼
┌────────────────────┐
│  Reasoning Layer   │  Answers why/which. Never draws.
└─────────┬──────────┘
          ▼
┌────────────────────┐
│  Planning Layer    │  Produces structured DesignDocuments.
└─────────┬──────────┘
          ▼
┌────────────────────┐
│  Rendering Layer   │  Draws exactly what it was told. No creativity.
└─────────┬──────────┘
          ▼
┌────────────────────┐
│  Delivery Layer    │  Publishes in the correct format (PNG · PDF · HTML · etc.).
└────────────────────┘
```

**Constitutional rule:** each layer touches ONLY the layer directly below it. A Reasoning Layer function that draws pixels violates the architecture. A Rendering Layer function that decides which colour to use violates the architecture. Cross-layer bypasses are forbidden.

### 1 · Knowledge Layer

Stores facts and relationships: staircase knowledge · kitchen knowledge · marketing knowledge · design rules · building regulations · compatibility · materials · colours · finishes · product catalogues · brand assets. Already partially delivered by `src/lib/nex/knowledge-layer/` (Phase B.5).

### 2 · Reasoning Layer

Answers questions such as: *Why choose oak? · Is walnut compatible? · Which staircase fits this hallway? · Which campaign should be used? · Which banner performs best? · Which room should be designed next?* Partially delivered by `src/lib/nex/pipeline/recommend.ts` (Phase D.7) and `src/lib/nex/marketing/selectBanner.ts` (Phase D.9).

### 3 · Planning Layer

Produces structured plans. Every output becomes a structured **DesignDocument** rather than free text:

- Project Plan · Room Plan · Marketing Plan · Banner Plan · Website Plan · Quote Plan · Presentation Plan.

**NEW subsystem: the Render Planner.** Sits between the Reasoning Layer (Campaign Engine · Recommendation Engine) and the Rendering Layer. Takes a `RenderBrief` → produces a complete `DesignDocument` with every design decision RESOLVED (no ambiguity remains for the renderer).

### 4 · Rendering Layer

**ONE responsibility: draw precisely what it has been instructed to draw.** No creativity · no guessing · no business logic. Receives a complete DesignDocument · converts it into pixels (or other visual outputs).

### 5 · Delivery Layer

Publishes results in the correct format: PNG · PDF · SVG · HTML · PowerPoint · Brochure · Website page · Social post · Email · Video frame.

## The Universal DesignDocument

**Rule:** avoid creating separate types for each product. Define a universal model. Every output extends it.

```
DesignDocument (base)
    ├── BannerDocument
    ├── WebsiteDocument
    ├── BrochureDocument
    ├── QuoteDocument
    ├── FlyerDocument
    ├── PresentationDocument
    ├── RoomVisualisationDocument
    ├── KitchenPlanDocument
    ├── StaircaseProposalDocument
    ├── MarketingCampaignDocument
    └── ExhibitionStandDocument
```

**Contract every DesignDocument shares:**

- `document_id` · `document_type` · `document_version` · `scene_graph` · `theme_pack` · `assets` · `export_target` · `metadata` · `provenance`.
- `scene_graph` (see next section) replaces flat `layers`.
- `provenance` explains WHY every design decision was made (Reasoning Layer chain · Knowledge Layer citations · asset resolver evidence · renderer version).

## Everything Is an Object

- **Products:** staircase · kitchen · door · wardrobe · flooring.
- **Marketing:** CTA · headline · badge · logo.
- **Rooms:** hallway · kitchen · landing · living room.
- **Materials:** oak · walnut · ash · glass · steel.

Everything described by structured properties · never hard-coded templates.

## The Universal Scene Graph

Whether producing a banner or a room visualisation · the internal representation is CONSISTENT.

```
Scene
  ├── Camera            (position · target · fov · aspect · perspective vs orthographic)
  ├── Lighting          (ambient · key · fill · rim · shadow policy)
  ├── Environment       (background · sky · walls · floor · HDRI ref)
  ├── Objects           (product placements · furniture · staircase geometry)
  ├── Materials         (per-object PBR references · texture bindings)
  ├── Typography        (headline · subheadline · body · CTA · contact)
  ├── Components        (feature_list · contact_box · badge · CTA button)
  ├── Branding          (logo · colour tokens · watermark policy)
  ├── Effects           (glass · glow · vignette · shadow · gradient)
  └── Export            (target format · dimensions · dpi · colour space · compression)
```

The renderer TRAVERSES the graph. Nothing more.

For 2D banners today · Camera/Lighting/Environment default to identity/none · Objects contain flat Layer nodes. The graph is future-proof for 3D room visualisation · interactive web graphics · animated content · AR/VR previews WITHOUT redesigning the architecture.

## The Render Planner (NEW · Philip 2026-08-04)

**Insertion:** between Campaign Engine and Renderer.

```
Campaign Engine
      ↓
Render Planner            (marketing intent → complete DesignDocument)
      ↓
Asset Resolver            (find hero · logo · icons · textures · fonts)
      ↓
Renderer                  (draws pixels only)
      ↓
Delivery Engine           (PNG · PDF · HTML · etc.)
```

**Responsibilities:**

- **Campaign Engine** — decides WHAT should be created (banner? brochure? quote?).
- **Render Planner** — converts marketing intent into a complete DesignDocument.
- **Asset Resolver** — finds the correct hero images · logos · icons · textures · fonts · theme assets.
- **Renderer** — draws pixels only.
- **Delivery Engine** — packages into the target format.

The renderer stays SIMPLE and DETERMINISTIC.

## The 10 Platform Principles (constitutional)

**1 · The renderer must never make aesthetic decisions.** No choosing fonts · colours · layouts · spacing · image positions. Everything specified before rendering begins. Constitutional violation if broken.

**2 · Deterministic rendering.** Same DesignDocument + same assets + same engine version → same output. Byte-identical when possible.

**3 · Everything is a DesignDocument.** Banner · website · brochure · quote · visualisation → same base type.

**4 · Everything is an object.** No hard-coded templates. Structured properties everywhere.

**5 · Universal scene graph.** Renderer traverses a graph · never a flat canvas. 2D today · 3D tomorrow · no architectural rewrite.

**6 · Universal Asset Resolver.** The renderer never searches for assets. Assets are RESOLVED before rendering.

**7 · Every decision is explainable.** Every DesignDocument carries a `provenance` object answering: why chosen · which knowledge · which compatibility rules · which tokens · which assets · which renderer version.

**8 · Layer separation is inviolable.** Knowledge → Reasoning → Planning → Rendering → Delivery. Only adjacent layers may compose. No bypasses.

**9 · Render manifest per render.** Every render emits a manifest (see next section) enabling versioning · reproducibility · comparison over time.

**10 · Additive migration always.** New capabilities extend the platform · never rewrite. BannerDocument is a specialization · not a replacement · for DesignDocument.

## The Render Manifest

**Rule:** every render produces not only an image but also metadata.

```yaml
render_id: rnd_000123
render_document: banner_kitchen_003
document_type: BannerDocument
document_version: 1.0
theme_pack: luxury_burgundy
layout_family: premium_trade_banner_v1
scene_graph_nodes: 24
hero_asset: kitchen_oak_014
logo_asset: logo_white_v2
icon_bundle: nex_line_icons_v1
font_set:
  heading: Montserrat ExtraBold
  body: Inter
components_rendered: 12
render_time_ms: 148
engine_version: e0.1
determinism_hash: 9a3f5c7e...        # sha256 of (spec + assets + engine_version)
grammar_violations: []
provenance:
  campaign_engine: Kitchen Mania Summer 2026
  reasoning_chain: [audience=family_homeowner · timber=oak · theme_compatibility=aqua_teal]
  knowledge_citations: [nex-knowledge/kitchen/knowledge.yaml#luxury_family_segment]
  asset_evidence: [manifest#kitchen_oak_014 score=0.87]
```

This gives us: **versioning · reproducibility · debuggability · quality-tracking across time.**

## Deterministic Rendering (elevated to core rule)

**The same input MUST always produce the same output.**

Practical requirements:

- No `Date.now()` or `Math.random()` inside the renderer.
- Font metrics come from the theme pack · never runtime-measured (measurement varies by platform).
- Asset URLs are ALWAYS versioned (immutable CDN keys · no `?t=timestamp`).
- Engine version stamped into every manifest.
- Determinism hash = sha256(canonicalized(DesignDocument) + canonicalized(ResolvedAssets) + engine_version) — reproduced identically means same output.

This improves reproducibility · testing · quality control · regression detection.

## Future Expansion (foundation is enough for all)

Once NDIP exists · these all become EXTENSIONS · never rewrites:

- 2D marketing graphics (Phase E.0 · shipped 2026-08-04).
- Interactive websites (Phase E.6 · scene-graph-driven HTML).
- Print catalogues (Phase E.7 · PDF delivery).
- Technical drawings (Phase E.8 · vector rendering with dimensions).
- 3D room visualisations (Phase E.9 · scene graph promotes Camera/Lighting).
- Product configurators (Phase E.10 · interactive scene graph).
- Animated social content (Phase E.11 · scene graph time axis).
- AR/VR previews (Phase E.12 · scene graph target).

**The Knowledge Layer stays constant. Only Rendering + Delivery evolve.**

## The Untouchable Advantage

Every AI competitor treats each design as a one-off asset. Nex treats every design as an INSTANCE of a DesignDocument produced by a Render Planner from a Reasoning Layer decision based on a Knowledge Layer fact — and every step is EXPLAINABLE · TRACEABLE · REPRODUCIBLE · DETERMINISTIC.

**A banner generator can be copied. A rendering engine can be copied. A design platform can be copied.**

**A Design Intelligence Platform grounded in Nex's Knowledge Layer + 15 Foundation Brains + 170 domains + 5 Laws + Rule-c authored knowledge CANNOT be copied.** It IS the moat.

## Immediate Migration (this session)

- BannerSpecification → **BannerDocument** (specialization of DesignDocument · additive · backward compatible).
- Add `DesignDocument` base type.
- Add **RenderPlanner** interface (`plan(brief): DesignDocument`).
- Add **render_manifest** to every RenderedBanner output.
- Add `provenance` field to DesignDocument (empty allowed for MVP).
- Add `scene_graph` structure alongside flat `layers` (2D layers become `Scene.Objects` seed).
- Renderer receives DesignDocument OR BannerDocument (union type).
- Determinism hash included in manifest.

## Phased NDIP Delivery

| Phase | Scope | Status |
|-------|-------|--------|
| **E.0** | Banner renderer MVP · SVG output · grammar validator · asset resolver | SHIPPED 2026-08-04 |
| **E.0.1** | DesignDocument + Render Planner + Render Manifest + Determinism Hash | SHIPPING 2026-08-04 (this doc) |
| **E.1** | Effects Engine · PNG rasterisation · editable layer export | PENDING |
| **E.2** | Animation runtime | PENDING |
| **E.3** | Responsive layouts | PENDING |
| **E.4** | 3D perspective transforms | PENDING |
| **E.5** | GPU acceleration | PENDING |
| **E.6** | Website document type · HTML delivery | PENDING |
| **E.7** | Brochure document type · PDF delivery | PENDING |
| **E.8** | Technical drawing document type · vector output | PENDING |
| **E.9** | Room visualisation · scene graph 3D | PENDING |
| **E.10** | Product configurator | PENDING |
| **E.11** | Animated social content | PENDING |
| **E.12** | AR/VR previews | PENDING |

## Governance

- Every future renderer PR MUST NOT add aesthetic decisions to the renderer.
- Every future NDIP capability MUST extend DesignDocument · never fork it.
- Every render MUST produce a manifest.
- Every architectural drift is a constitutional violation (do not merge).
