---
authored_by: Philip O'Farrell (10-part Directive + Composition Layer + Document Tree + Layer Separation Rule + No Image Without Knowledge Rule) · Master AI Engineer (schema + contracts + phased execution plan)
authored_role: Founder platform doctrine + Master AI Engineer implementation architecture
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Phase E.1 · Universal Design Studio · replaces "banner renderer" framing
document_version: 1.0
document_type: MEGA_DOCTRINE · Phase E.1 · Universal Design Studio + Asset Intelligence + Composition Platform
composes_with:
  - docs/brains/nex-design-intelligence-platform-ndip-philip-2026-08-04.md (NDIP parent)
  - docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md (Design Platform + DOM)
  - docs/brains/nex-pixel-rendering-engine-phase-e0-philip-2026-08-04.md (E.0 subsystem)
  - docs/brains/nex-pattern-library-grammar-journey-philip-2026-08-04.md
supersedes_framing:
  - "banner renderer" endpoint (Nex is now a Universal Design Studio)
constitutional_rules_introduced:
  - rule_layer_separation
  - rule_no_image_without_knowledge
---

# Phase E.1 · The Nex Universal Design Studio + Asset Intelligence

## The Directive (Philip 2026-08-04)

*"The objective is no longer to render banners. The objective is to build a complete Design Studio that allows Nex to understand, reuse, learn from and render every design asset across every product, industry and platform. This is a constitutional platform extension, not a standalone feature."*

## The Two Goals

**Goal 1 · Nex UNDERSTANDS images (priority NOW).** Every image becomes structured knowledge · not a PNG in a folder. Searchable · linkable · queryable without any vision model. Foundation for everything else.

**Goal 2 · Nex CREATES images (later stages E.2 → E.7).** Once E.1 exists · Nex evolves through Image Intelligence → Asset Intelligence → Composition Intelligence → Prompt Planner → Image Generation → Image Analysis → Image Evolution. Each stage compounds.

## Two New Constitutional Rules

### Rule · Layer Separation is Inviolable (Philip 2026-08-04)

*"The renderer owns pixels. The planner owns layout. The reasoning engine owns decisions. Knowledge owns facts. No layer may assume responsibility belonging to another layer."*

This single principle prevents almost every form of architectural drift. Add to every code review checklist · every PR must demonstrate no layer-boundary violation.

### Rule · No Image Without Knowledge (Philip 2026-08-04)

*"No image enters the repository without becoming structured knowledge."*

Every image entering Nex — uploaded · AI-generated · imported · rendered · captured — MUST produce:

- metadata · design document · scene graph · marketing tags · product tags · style tags · colour palette · materials · coordinates · layout · campaign objective · hero product · editable regions · relationships to similar images.

An untagged image is a constitutional violation. 23 banner images become 23 intelligent objects — never 23 files.

## The Composition Platform · New Layer (Philip 2026-08-04)

Philip 2026-08-04: *"NDIP is missing one platform. I'd insert another layer."*

```
Knowledge  →  Reasoning  →  Planning  →  COMPOSITION  →  Rendering  →  Delivery
                                              ↑
                                        NEW LAYER
```

**Composition owns:**

- alignment · spacing · grids · balance · visual hierarchy · responsive layout · overlap rules · collision detection.

**Composition does NOT own:** aesthetic decisions (Planning) · pixel drawing (Rendering).

The renderer receives a fully-composed DesignDocument · never has to solve overlap · never has to auto-space · never has to balance visual weight.

Location: `src/lib/nex/composition-platform/` (scaffolded this session · full solver phased).

## The Full Platform Stack (Phase E.1)

```
Knowledge Platform
      ↓
Reasoning Platform
      ↓
Planning Platform
      ↓
Composition Platform      ← NEW (Philip 2026-08-04)
      ↓
Design Platform           ← DesignDocument + DOM + Fonts
      ↓
Rendering Platform        ← One box · draws pixels · zero decisions
      ↓
Delivery Platform         ← Export Engine (SVG · PNG · PDF · WEBP · ...)
      ↓
Learning Platform         ← Feeds analytics back into Knowledge
```

## The DesignDocument Tree (Philip 2026-08-04)

Philip 2026-08-04: *"Eventually DesignDocument evolves into something like..."*

```
DesignDocument
     ↓
  Page                    (top-level canvas · one per output format)
     ↓
  Section                 (horizontal bands · e.g. hero · features · footer)
     ↓
  Container               (grid cell · flex box · absolute region)
     ↓
  Component               (headline_block · contact_box · cta_button · feature_list)
     ↓
  Layer                   (z-indexed instance of a component)
     ↓
  Primitive               (leaf drawing element)
```

**Primitives (10 leaf types · universal):**

| Primitive | Purpose |
|-----------|---------|
| Rectangle | filled/stroked rectangles (including rounded) |
| Text | typography-rendered string with font style |
| Image | raster or vector image reference |
| Video | video reference (future E.2 · animation) |
| Gradient | linear · radial · conic |
| Shadow | drop · inner · long |
| Mask | clip path · alpha mask |
| Path | SVG path · vector geometry |
| Icon | catalogued icon reference |
| Border | stroke around any element |

Every visual atom in Nex is one of these 10 primitives. Components compose primitives. Layers stack components. Containers arrange layers. Sections group containers. Pages hold sections. DesignDocuments hold pages.

**Constitutional:** any new visual element MUST decompose to these primitives · no new primitive without an amendment to this doctrine.

## The 10 Directives of Phase E.1

### 1 · Universal Asset Library

Every image becomes structured knowledge:

```yaml
Asset
  id · title · description
  industry · product_family · hero_product
  theme_pack · timber_profile · colour_palette
  layout_family · camera_angle · lighting
  room_style · architectural_style · marketing_tone
  quality_rating · designer_notes · recommended_usage
  image_hash · file_hash
  linked_articles · linked_banner_templates · linked_products
  linked_recommendations · linked_render_documents
  usage_history · performance_metrics
```

Images become KNOWLEDGE · not FILES. Location: `src/lib/nex/asset-platform/asset-library.ts` (schema shipped this session · storage phased).

### 2 · Automatic Image Learning

Every new image → Nex extracts: colours · materials · timber species · metals · glass · architecture · furniture · staircase type · kitchen style · storage modules · doors · windows · lighting · mood · camera · composition · typography · icon placement · CTA layout · whitespace · safe areas · design patterns.

Storage into the Asset Library · reused for future rendering. **Nothing is wasted.**

### 3 · Image Relationships

Every image knows related images. Example:

```
Oak staircase
  ↔ Oak kitchen · Oak doors · Oak flooring · Oak panelling · Oak understair storage
  ↔ Oak wardrobes · Oak media walls · Oak furniture · Oak windows · Oak exterior doors
```

Recommendation Engine becomes VISUAL. `nex_asset_relationships` edge list.

### 4 · Universal Design Sizes

Every design renders into every required format automatically. **60+ format registry** (SHIPPED this session at `src/lib/nex/renderer/design-sizes.ts`):

- **Social** (23): Facebook Feed · Facebook Cover · Facebook Story · Instagram Feed · Instagram Story · Instagram Reel Cover · Instagram Carousel · LinkedIn Post · LinkedIn Cover · LinkedIn Company Banner · Pinterest Pin · Pinterest Story · TikTok Cover · YouTube Thumbnail · YouTube Banner · Twitter/X Post · Twitter Header · Threads · Google Business · WhatsApp Status · Telegram · Snapchat · Reddit.
- **Web** (11): Homepage Hero · Landing Hero · Blog Hero · Product Hero · Category Hero · Feature Banner · Popup Banner · Sidebar Banner · Email Header · CTA Strip · Footer Banner.
- **Print** (14): Business Cards · Flyers A5/A6 · Leaflets · Brochures · Booklets · Roll-up Banners · Posters A4/A3/A2/A1/A0 · Signboards · Shop Fascia · Vehicle Graphics · Window Vinyl · Exhibition Panels · Presentation Boards.
- **Documents** (10): PDF · Quotation Cover · Proposal Cover · Invoice Branding · Reports · Company Profiles · Sales Packs · Catalogues · Installation Guides · Manuals · Certificates.
- **Apps** (8): Splash Screen · Login Background · Dashboard Hero · Wallpaper · Chat Background · Loading Screen · Mobile Hero · Tablet Hero · Desktop Hero.

### 5 · Universal Export Engine

Every render exports to: SVG · PNG · JPG · WEBP · PDF · Print-ready PDF · EPS · TIFF · PSD (future) · Figma (future) · PowerPoint · Word · Canva export (future).

Phase E.1 scope: SVG (SHIPPED) · PNG (pipeline to headless raster) · WEBP. PDF/Print/PSD/Figma phased.

### 6 · Non-destructive Effects Engine

Every DesignDocument supports editable effects · never flattened:

- Blur · Glass Blur · Gradient · Glow · Shadow · Depth · Noise · Film Grain · Bloom · Colour Overlay · Opacity · Mask · Feather · Texture · Vignette · Light Rays · Lens Flare · Background Removal · AI Cutout · Rounded Corners · Perspective Warp.

Stored as editable layers · reversible · re-renderable.

### 7 · Multi-Layer Rendering

Everything editable · Photoshop/Figma style:

```
Background → Lighting → Architecture → Furniture → Hero Product → Icons → Text
    → CTA → Logos → QR → Social Icons → Effects → Export
```

Every layer independently editable · reorderable · toggleable.

### 8 · Design Memory

Every rendered document stored. The Design Studio remembers:

- who created it · why · campaign · industry · objective · performance · A/B test results · versions · downloads · customer edits · future improvements.

Rendering becomes CUMULATIVE LEARNING. Location: `data/nex-design-memory.jsonl` (future).

### 9 · Asset Intelligence

Every new asset · Nex automatically: classifies · tags · scores quality · detects duplicates · finds visually similar · links to products · links to banner families · links to knowledge articles · links to recommendations · links to render documents.

**No manual tagging where automation is reliable.** Implementation lives in Asset Intelligence Platform (contract shipped Phase E.0.5 · full implementation phased).

### 10 · Constitutional Renderer Discipline (reinforced)

*"The renderer must never make aesthetic decisions."*

- Brain decides.
- Planner composes.
- Design Studio manages assets · formats · editable layers.
- Renderer draws exactly what it's told · deterministically.

**Permanent · never violated.**

## Phased Delivery for Phase E.1

| Sub-phase | Scope | Status |
|-----------|-------|--------|
| **E.1.0** | Doctrine + Composition Platform scaffold + Primitive taxonomy + Document Tree + Design Sizes registry (60+) + Universal Asset schema | SHIPPING (this session) |
| **E.1.1** | Automatic Image Learning pipeline (existing manifest → Asset Library migration) | PENDING |
| **E.1.2** | Image Relationship edge list · visual recommendation graph | PENDING |
| **E.1.3** | Universal Export Engine · PNG rasterisation via resvg or sharp | PENDING |
| **E.1.4** | Non-destructive Effects Engine · 20+ effects as editable layers | PENDING |
| **E.1.5** | Multi-layer editor UI · Photoshop/Figma paradigm | PENDING |
| **E.1.6** | Design Memory storage + query · `data/nex-design-memory.jsonl` | PENDING |
| **E.1.7** | Full Asset Intelligence Platform implementation (10 responsibilities) | PENDING |
| **E.1.8** | Composition solver · alignment/spacing/balance/collision | PENDING |

## The Long-Term Closed Loop

```
User
  ↓
Intent
  ↓
Knowledge
  ↓
Recommendation
  ↓
DesignDocument
  ↓
Composition
  ↓
Scene Graph
  ↓
Asset Selection (Asset Intelligence Platform)
  ↓
Prompt Builder                    (E.4 · when native image generation lands)
  ↓
Image Generation                  (E.5)
  ↓
Image Analysis                    (E.6)
  ↓
Knowledge Update                  (E.7 · loops back to Knowledge)
  ↓
Future Learning
```

**Every image makes Nex smarter.** This is the compounding advantage — each new image isn't just another asset · it improves Nex's ability to search · recommend · compose · and eventually generate better designs.

## Assessment · Philip 2026-08-04

*"With NDIP, DesignDocument, Scene Graph, Render Planner, and Render Manifest you're laying groundwork for a general-purpose design platform. If you continue to keep the separation of concerns this strict, the same knowledge base will drive marketing graphics · quotations · websites · PDFs · room visualisations · future interactive design tools without duplicating logic. At this stage prioritise expanding the platform HORIZONTALLY (new document types + composition capabilities) rather than adding isolated rendering features."*

## Governance

- Every future capability MUST be classified into ONE platform · never smeared.
- Every image ENTERING Nex MUST become structured knowledge (constitutional).
- Every layer separation violation is a PR blocker (constitutional).
- Every new visual primitive requires an amendment to this doctrine.
- Every future output format extends `design-sizes.ts` · never invents its own dimensions ad hoc.
