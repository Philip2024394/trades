---
authored_by: Philip O'Farrell (mandate + 9-module architecture) · Master AI Engineer (implementation spec)
authored_role: Founder mandate + Master AI Engineer implementation contract
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Phase E.0 · turns Design Intelligence into Pixels
document_version: 1.0
document_type: MEGA_DOCTRINE · complete architecture for the NEX Pixel Rendering Engine
composes_with:
  - docs/brains/nex-pattern-library-grammar-journey-philip-2026-08-04.md
  - docs/brains/nex-campaign-selection-engine-philip-2026-08-04.md (feeds this renderer)
  - docs/brains/nex-marketing-design-intelligence-philip-2026-08-03.md (template metadata)
  - docs/brains/nex-design-tokens-and-marketing-intelligence-philip-2026-08-03.md (token system)
---

# NEX Pixel Rendering Engine · Phase E.0 (with Asset Resolver)

## The Mandate

Philip 2026-08-04: *"Brain storm the most powerful image creator built · your task is to engineer Nex to become 100% accurate with image creation from user prompt. There is no second place. Quality and detail and precision must be 101% for Nex."*

**Frame:** design rendering system, NOT a replacement for modern AI image generation. Nex Brain makes ALL design decisions. Renderer draws. Nothing else.

## The Pipeline

```
User Request
    ↓
Nex Intent
    ↓
Knowledge Layer
    ↓
Recommendation Engine
    ↓
Campaign Selection Engine (Phase D.9)
    ↓
Banner Planner (composes BannerSpecification from selected banner + pattern + grammar)
    ↓
Banner Specification
    ↓
Asset Resolver (NEW · picks hero/logo/icon/background from manifest)
    ↓
Pixel Renderer (9 modules)
    ↓
Export Engine (PNG · JPEG · WEBP · SVG · PDF)
    ↓
Rendered Banner (with metadata + editable layers)
```

## Core Principle

**Design decisions have already been made by Nex.** The renderer simply EXECUTES.
- Nex Brain decides.
- Renderer draws.
- Renderer has ZERO business logic.
- Renderer has ZERO design intelligence.
- Renderer has ZERO opinions.

## The 9 Core Modules

### 1. Canvas Engine
Responsible for canvas size · DPI · background · bleed · safe area · margins · alignment.
Supports formats: Facebook (1200×628 · 1080×1080 square) · Instagram (1080×1080 · 1080×1350 portrait · 1080×1920 story · 9×16 reel) · LinkedIn (1200×627 · 1584×396 banner) · Google Ads (300×250 · 728×90 · 320×50 · 300×600) · Print (A4 · A5 · Poster A3/A2) · Custom.

### 2. Image Engine
Loads hero images · logos · icons · backgrounds · transparent PNG.
Supports: crop · resize · rotate · mask · opacity · blur · shadow · reflection · brightness · contrast · saturation · vignette.
Sources: manifest URLs (ImageKit-CDN aware · automatic srcset).

### 3. Typography Engine
Supports headline · subheadline · paragraph · feature list · CTA · contact details.
Dynamic font sizing · automatic line wrap · maximum lines · letter spacing · line spacing · text shadows · outline · gradient text.
Font families: pulled from Design Tokens · fallbacks configured.

### 4. Shape Engine
Draws rectangles · rounded rectangles · circles · icons · badges · buttons · CTA panels · gradient panels · glass panels · dividers.

### 5. Effects Engine
Drop shadows · glows · glassmorphism · gradient overlays · noise · texture · vignette · lighting · reflections · outlines.

### 6. Component Engine
Every banner consists of components. Each component has: position · size · padding · rules · tokens · z-index.
Component library (from Phase D.8): headline_block · subheadline_block · feature_list · icon_list · hero_image · badge · contact_box · contact_bar · qr_code · social_links · cta_button · background_panel.

### 7. Layer Engine
Everything renders as layers with z-index:
Background → Hero → Overlay → Headline → Features → CTA → Contact → Logo → Effects.

### 8. Template Engine
Loads template definitions from manifest. Each template declares editable regions · safe areas · component positions · rules.
Templates: premium_trade_banner_v1 · classic_trade_layout_v1 · curved_lifestyle_layout_v1/v2/v3.

### 9. Design Token Engine
**No colours are hardcoded.** Everything comes from tokens: Primary · Secondary · Accent · Background · Border · CTA · Icon · Shadow · Radius · Padding · Spacing · Typography.
Changing Theme Pack changes everything automatically.

## The Contact Box (universal component)

Renderer automatically supports Phone · WhatsApp · Website · Instagram · Facebook · TikTok · Email · QR Code · Address.
Unused fields disappear automatically. Icon library included · consistent visual weight.

## Auto Layout

Renderer automatically adjusts font size · button size · text spacing · icon spacing · component height to prevent overlap.
Rules:
- Never truncate the headline (shrink font if needed to fit safe area).
- Never overlap the hero image (reflow text left/right of hero bounding box).
- Never break contact box padding (min 20px inner padding regardless of content length).
- Never violate safe area (bleed × margin × padding checked at layer resolve time).

## Safe Area System

Every editable region defines top · left · width · height · padding · minimum spacing · maximum lines · overflow behaviour (truncate · shrink · reflow · error).

## Animation Ready

Renderer architecture supports future video · HTML5 · Lottie · animated text · animated CTA · animated icons — without redesigning architecture.
Phase E.2 delivers animation runtime · Phase E.0 delivers the STATIC RENDERER only.

## Exports

Facebook (feed · story · reel cover) · Instagram (feed · story · reel cover · carousel) · LinkedIn (banner · post) · Google Ads (all standard sizes) · TikTok · Pinterest · Print (A5 · A4 · A3 · A2 · Poster · Roller Banner) · Custom.

## Render Contract

```typescript
Input:  BannerSpecification (complete design decision object)
        ↓
        Renderer
        ↓
Output: RenderedBanner {
          asset_url: string;           // PNG/SVG/PDF export URL
          format: "png" | "jpeg" | "webp" | "svg" | "pdf";
          width_px: number;
          height_px: number;
          metadata: { theme_pack, timber, personality, template, ... };
          component_positions: Record<string, {x, y, width, height, z_index}>;
          editable_layers: Record<string, Layer>;  // for future editing
          render_log: string[];        // trace of every decision
          performance: { render_ms, layers_rendered, cache_hits };
        }
```

## The Asset Resolver (Philip 2026-08-04 addition)

**Rule:** an Asset Resolver sits BETWEEN Banner Specification and Pixel Renderer.

```
Nex Brain
    ↓
Banner Specification (spec only · no assets)
    ↓
Asset Resolver (selects hero · logo · icon set · background texture · variants)
    ↓
Pixel Renderer (assembles from resolved assets)
    ↓
Export Engine
```

**Responsibilities:**
- Select the correct hero image from the manifest based on theme_pack + hero_product_type + tone.
- Select the correct logo variant (light · dark · monochrome · full-colour) for the theme background.
- Select the correct icon set (line · filled · duotone) for the design personality.
- Select background textures / gradients matching the theme pack.
- Resolve all URLs to CDN endpoints (ImageKit · srcset · WebP where supported).
- Cache resolved asset bundles per BannerSpecification hash.

**Benefit:** the renderer stays focused purely on DRAWING · the resolver handles CHOOSING assets · scalable + maintainable.

## Phased Delivery

- **Phase E.0** — Static renderer · SVG output (production-quality vector · convertible to PNG downstream). Ships this session.
- **Phase E.1** — Editable layer export (for downstream Figma/Canva import).
- **Phase E.2** — Animation runtime (Lottie · CSS animations · SVG SMIL).
- **Phase E.3** — Responsive layouts (auto-adapt to any output aspect).
- **Phase E.4** — 3D effects (perspective transforms · pseudo-3D shadow language).
- **Phase E.5** — GPU acceleration for high-volume rendering.

## Non-Negotiable Design Rules

**Build this as PROFESSIONAL software architecture. Not a toy canvas.**

- Think Canva. Think Adobe Express. Think Figma renderer.
- Everything modular · testable · reusable.
- Every component independently rendered.
- **No business logic inside rendering.**
- Renderer only draws. Nex Brain makes all design decisions.

## MVP Scope for Phase E.0 (shipping now)

1. **BannerSpecification type system** — complete schema · Layer · Component · Region · Token references.
2. **Design Token runtime** — resolves theme_pack → colour + font + spacing tokens.
3. **Marketing Pattern Library runtime** — loads patterns · applies to spec.
4. **Marketing Grammar runtime** — validates spec against personality rules · warns on violations.
5. **Asset Resolver** — picks hero/logo/icon from manifest · returns resolved bundle.
6. **SVG Renderer** — MVP output format (production-quality vector · text · shapes · images) · exports to string · convertible to PNG downstream via any standard SVG-to-PNG library.
7. **Tests** — validate a real BannerSpecification renders to valid SVG.

## What Phase E.0 DOES NOT Ship

- Canvas-based PNG rasterisation (needs headless browser or native canvas · deferred to Phase E.1).
- Font subsetting (defer to Phase E.1).
- Effects engine (glass/glow/vignette · deferred to Phase E.1).
- Animation (Phase E.2).
- GPU acceleration (Phase E.5).

**These are intentional deferrals.** The MVP proves the architecture; production polish comes in phased releases.

## Success Metric

*A `BannerSpecification` for `kitchen_banner_002` (aqua_teal · family_homeowner · promotional_offer) produces an SVG output that visually matches the reference banner's layout · uses the correct theme tokens · resolves the correct hero + logo assets · passes Grammar validation. Output is a valid SVG string ready for downstream PNG conversion.*

## Governance

- Every renderer version is tagged (Phase E.0 · E.1 · etc.) in the exported metadata.
- Every render logs to `data/nex-render-log.jsonl` with input spec hash + output metrics.
- Every failed render (invalid spec · missing asset · grammar violation) logs with structured error.
- The renderer NEVER makes design decisions · violations of this rule are constitutional (Fifth Law: complete the work · here that means EXECUTE the spec · not INVENT the spec).

## Enhancement Opportunity

Every AI competitor's "image generator" produces one-off images that cannot be edited · themed · resized · or explained. Nex's Pixel Rendering Engine produces STRUCTURED · TOKEN-DRIVEN · COMPONENT-BASED · GRAMMAR-VALIDATED · TRACEABLE · EDITABLE output. Every pixel has a source. Every colour has a token. Every layout has a rule. **That is untouchable precision.** Combined with the Asset Resolver, Marketing Pattern Library, and Marketing Grammar, Nex can generate 100,000+ coherent marketing assets across every future domain while maintaining 101% design quality.
