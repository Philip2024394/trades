---
authored_by: Philip O'Farrell (Platform Services rule + DOM concept + Asset Intelligence promotion + font catalog directive) · Master AI Engineer (schema + contracts)
authored_role: Founder platform doctrine + Master AI Engineer implementation architecture
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Platform Constitution · extends NDIP with Platform Services + Design Object Model
document_version: 1.0
document_type: MEGA_DOCTRINE · Design Platform architecture · elevates renderer to just one box among many
composes_with:
  - docs/brains/nex-design-intelligence-platform-ndip-philip-2026-08-04.md (parent NDIP constitution)
  - docs/brains/nex-pixel-rendering-engine-phase-e0-philip-2026-08-04.md (E.0 subsystem inside Rendering Platform)
  - docs/brains/nex-pattern-library-grammar-journey-philip-2026-08-04.md
  - docs/brains/nex-campaign-selection-engine-philip-2026-08-04.md
supersedes_framing:
  - "renderer" as the endpoint (renderer is now ONE box inside the Design Platform)
---

# Nex Design Platform + Design Object Model (DOM)

## The Rule (Philip 2026-08-04)

*"Everything in Nex must become a platform service."*

Stop adding features · strengthen the architecture. Every capability graduates into a NAMED platform service with a stable contract · versioned interface · independent tests · own health metrics · own dashboard.

## The 10 Platform Services

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Knowledge Platform      Reasoning Platform                  │
│  Recommendation Platform Planning Platform                   │
│  Marketing Platform      Design Platform                     │
│  Rendering Platform      Delivery Platform                   │
│  Asset Platform          Learning Platform                   │
│  Analytics Platform      Identity Platform                   │
│  Workflow Platform                                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Each platform:
- has ONE responsibility (violations are constitutional).
- exposes a STABLE public contract (`src/lib/nex/{platform-name}/index.ts`).
- has a documented interface (types file · doctrine · tests).
- may compose downward but never upward.
- can be swapped out without changing consumers.

**Rule:** if a proposed capability doesn't fit inside one existing platform, propose a new platform · never smear it across multiple.

## Phase E.1 is NOT "better SVG"

Philip 2026-08-04: *"Many people would continue improving SVG rendering. I wouldn't. I'd build the Design Platform."*

**Phase E.1 = build the Design Platform.** The renderer becomes just one box inside it:

```
Design Platform
  ├── Pattern Library         (already banked · Phase D.8)
  ├── Grammar Engine          (already shipped · Phase E.0)
  ├── Layout Engine           (already banked · 5 layout families)
  ├── Component Engine        (already banked · 12 components)
  ├── Asset Resolver          (shipped MVP · Phase E.0 · promoted to Asset Intelligence Platform)
  ├── Scene Graph             (shipped · Phase E.0.1)
  ├── Render Planner          (shipped · Phase E.0.1)
  ├── Renderer                (shipped · Phase E.0 · one box)
  ├── Export Engine           (Phase E.1)
  └── Analytics               (Phase F)
```

## The Biggest Missing Piece · The Design Object Model (DOM)

Philip 2026-08-04: *"The largest thing I still don't see is what I would call the Design Object Model (DOM). Not HTML DOM. Design DOM. Everything should inherit from DesignObject."*

**Every noun in Nex is a DesignObject.**

```
DesignObject (base)
  ├── ProductObject
  │     ├── Room (Kitchen · Hallway · Landing · LivingRoom · Bathroom)
  │     ├── Cabinet · Door · Handle · Worktop · Sink · Extractor
  │     ├── Flooring · Tile · Skirting · Coving
  │     ├── Staircase · Newel · Spindle · String · Handrail · Tread · Riser · Glass · LED
  │     └── Fixture · Fitting · Appliance
  │
  ├── MarketingObject
  │     ├── Headline · Subheadline · Body · Caption
  │     ├── CTA · Badge · Ribbon · UrgencyBar
  │     ├── Logo · Watermark
  │     ├── FeatureList · TestimonialQuote · PriceTag
  │     └── ContactBox · QRCode · SocialLink
  │
  ├── ConstructionObject
  │     ├── Beam · Joist · Stud · Wall · Ceiling · Floor
  │     ├── Doorway · Window · Skylight
  │     ├── Fastener · Wedge · Bracket · Bolt · Screw
  │     └── Material · Finish · Coating · Sealant
  │
  ├── DesignTokenObject
  │     ├── ColorToken · FontToken · SpacingToken · RadiusToken · ShadowToken
  │
  └── EnvironmentObject
        ├── Lighting · Camera · HDRI · Weather · TimeOfDay
```

## Every DesignObject has 7 Capabilities

Every object is:

1. **Renderable** — the Rendering Platform can draw it.
2. **Searchable** — the Knowledge Platform can find it.
3. **Recommendable** — the Recommendation Platform can suggest it.
4. **Configurable** — the Planning Platform can adjust its properties.
5. **Compatible** — the Compatibility Engine knows what it pairs with.
6. **Manufacturable** — the Workflow Platform knows how to produce it.
7. **Marketable** — the Marketing Platform knows how to sell it.

**Example: Oak Handrail.**

```yaml
design_object:
  id: oak_handrail_50mm_traditional
  type: ProductObject.Staircase.Handrail
  properties:
    material: oak_american_white
    profile: 50mm_round
    finish: satin_lacquer
  capabilities:
    renderable: true
    searchable: true
    recommendable: true
    configurable: [length_mm, mounting_style]
    compatible_with: [oak_newel, oak_spindle, oak_string, glass_panel]
    manufacturable: true
    marketable: true
  provenance:
    named_expert: Philip O'Farrell
    authored: 2026-08-04
    knowledge_refs: [nex-knowledge/staircase/knowledge.yaml#handrails]
```

**One object. Everywhere.** The knowledge layer stores it · the reasoning layer recommends it · the planning layer configures it · the design platform composes it · the renderer draws it · the delivery layer publishes it · the manufacturer builds it · the marketer sells it. **All from the SAME row.**

## Rename BannerSpecification → RenderDocument

Philip 2026-08-04: *"This is one of the few things I'd change immediately."*

**Naming migration (this session):**

- `BannerSpecification` (existing type) — kept as the internal resolved layer/layout unit.
- `RenderDocument` — the platform-level type (already introduced as `DesignDocument` in NDIP · this doctrine confirms the framing).
- `BannerDocument extends RenderDocument` — already SHIPPED (Phase E.0.1).
- Later: `WebsiteDocument extends RenderDocument` · `QuoteDocument extends RenderDocument` · `RoomDocument extends RenderDocument` · `BrochureDocument extends RenderDocument`.

**One renderer. Many outputs.** The renderer accepts `RenderDocument` · dispatches by `document_type`.

## Render Graphs (not lists)

Philip 2026-08-04: *"Professional rendering engines don't render lists. They render graphs."*

Already delivered · confirmed as constitutional in NDIP:

```
Render Graph
  ├── Scene
  ├── Camera
  ├── Lighting
  ├── Environment
  ├── Objects
  ├── Materials
  ├── Typography
  ├── Components
  ├── Branding
  ├── Effects
  └── Output
```

The renderer TRAVERSES the graph. Traversal is deterministic. Adding animation later = add a time axis to the graph · no rewrite. Adding 3D later = camera/lighting become real · no rewrite.

## The Asset Intelligence Platform (Asset Resolver promoted)

Philip 2026-08-04: *"Right now it appears to resolve assets. Eventually it should become a full Asset Intelligence Platform."*

**10 Responsibilities:**

1. **Versioning** — every asset has a version chain · previous versions retained · rollback supported.
2. **Quality scoring** — every asset scored (0-100) · from manifest metadata + usage analytics.
3. **Duplicate detection** — perceptual hash · alias graph · "you already have this."
4. **Semantic tagging** — every asset tagged with structured properties (colour · style · timber · scene · mood · era · trade).
5. **Style compatibility** — asset knows which theme packs · personalities · timber profiles it pairs with.
6. **Licensing** — every asset has licence terms · attribution requirements · commercial-use flags.
7. **Preferred asset selection** — scoring rank picks BEST asset given brief · not just first match.
8. **Fallback chains** — if preferred asset unavailable · resolver returns ranked alternatives.
9. **A/B testing** — resolver can serve 2 candidates + track which performs better.
10. **Usage analytics** — every resolution logged · asset performance measured over time.

**Location:** `src/lib/nex/asset-platform/` (scaffolded this session · full implementation phased).

## Render Manifest (elevated)

Every render emits:

- Render ID · Engine Version · Asset Versions · Grammar Score · Compatibility Score · Theme · Layout · Components · Timing · Warnings · Output Hash · Provenance chain.

Already SHIPPED (Phase E.0.1 · `render-manifest.ts`). This doctrine confirms it as constitutional.

## The Font Catalog (Philip's explicit ask 2026-08-04)

*"Also add the fonts for the image creation styles of text and banner text types."*

**Structure:** a comprehensive font catalog covering every banner text role × every brand personality × every layout family. The catalog is a first-class artefact of the Design Platform · not a hidden implementation detail.

**Text roles (11):** display · headline · sub_headline · sub_sub_headline · body · caption · cta · feature_list_item · contact_line · badge · testimonial_quote.

**Personalities (6):** luxury · professional · sales_event · family · heritage · lifestyle (matches Grammar Engine).

**Per (role × personality) the catalog declares:** family stack · weight · size_px_default · size_ratio_to_headline · letter_spacing · line_height · transform · fallback_stack.

**Font families used across all combinations:**

| Family | Role | Personality Coverage |
|--------|------|----------------------|
| **Playfair Display** | Serif display · elegant heritage | luxury · heritage |
| **Cormorant Garamond** | Serif refined | luxury · heritage |
| **Montserrat** | Sans display · versatile | professional · sales_event · family · lifestyle |
| **Montserrat ExtraBold** | Sans display · high impact | sales_event · family |
| **Inter** | Sans body · high legibility | all personalities body/caption |
| **Poppins** | Sans display · rounded modern | family · lifestyle · sales_event |
| **Oswald** | Condensed display · industrial | sales_event · professional |
| **Bebas Neue** | Condensed display · uppercase impact | sales_event · industrial |
| **Georgia** | Serif body · traditional web-safe | heritage · luxury body |
| **Merriweather** | Serif body · editorial | heritage · lifestyle body |
| **Lora** | Serif body · warm | family · lifestyle body |
| **Roboto** | Sans body · engineered | professional · corporate body |
| **Space Grotesk** | Sans display · geometric modern | lifestyle · professional accent |
| **Fraunces** | Serif display · new-classic luxury | luxury display |
| **DM Serif Display** | Serif display · high-contrast | luxury display |

**Location:** `src/lib/nex/renderer/font-catalog.ts` (SHIPPED this session).

## The Long-Term Architecture

```
Knowledge Platform
      ↓
Reasoning Platform
      ↓
Planning Platform
      ↓
Design Platform          ← this doctrine + Design Object Model + Font Catalog
      ↓
Rendering Platform       ← Phase E.0 shipped · one box inside Design Platform
      ↓
Delivery Platform        ← Phase E.1
      ↓
Learning Platform        ← Phase F
```

This can grow for 10 years without becoming brittle.

## Immediate Migration (this session)

- Publish this doctrine (SHIPPED).
- Introduce `src/lib/nex/design-platform/design-object.ts` — DesignObject base + 5 taxonomies + 7-capability contract.
- Introduce `src/lib/nex/asset-platform/types.ts` — Asset Intelligence Platform contract (10 responsibilities · MVP stubs).
- Introduce `src/lib/nex/renderer/font-catalog.ts` — 11 roles × 6 personalities font system.
- All additive · zero breaking changes to shipped runtime.
- Add tests.

## Assessment

Philip 2026-08-04: *"I would rate this milestone as foundational rather than finished. The most valuable achievement isn't the SVG renderer — it's the discipline of separating knowledge, planning, asset selection, validation, and rendering into independent responsibilities."*

**If Nex preserves these boundaries as they evolve into stable platform services, Nex won't just be able to generate banners. It will have a reusable design operating system capable of producing marketing assets · websites · quotations · room visualisations · and many other outputs from the same underlying design intelligence.**

That is the untouchable moat.
