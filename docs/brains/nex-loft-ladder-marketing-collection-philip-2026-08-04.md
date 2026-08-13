---
authored_by: Philip O'Farrell (4 loft ladder banners · theme matrix · Object Library seed spec)
authored_role: Founder marketing doctrine + Object Library seed spec
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L3 · marketing_collection · joinery / loft ladders
document_version: 1.0
document_type: marketing_collection · reusable layout grammar × 4 theme packs · seeds Object Library
composes_with:
  - docs/brains/nex-phase-e16-visual-learning-object-dna-philip-2026-08-04.md (VLP + Object Library)
  - docs/brains/nex-marketing-design-intelligence-philip-2026-08-03.md (banner metadata schema)
---

# Loft Ladder Marketing Collection

One layout grammar · four theme packs · four audiences · one campaign family.

## The Theme Matrix (Philip 2026-08-04)

| Theme Pack | Audience | Brand Personality | Marketing Tone | Hero Product Variant |
|------------|----------|-------------------|----------------|----------------------|
| **industrial_black_gold** | Luxury homeowners | Premium · Professional · Practical | performance | timber_folding_loft_ladder |
| **modern_blue** | Modern families · installers | Professional · Trustworthy · Modern | professional | timber_folding_loft_ladder |
| **industrial_black_red** | Builders · trade · commercial | Industrial · Strong · Engineering-focused | performance | heavy_duty_steel_loft_ladder |
| **nature_green** | General homeowners · DIY | Family · Practical · Safe · Reliable | family | aluminium_loft_ladder |

**Insight:** Nex learns that Black+Red = strength/trade · Blue = modern/domestic · Black+Gold = premium/luxury · Green = family/practical · from a single small collection · the pattern generalises across every future domain.

## Shared Layout Grammar (constant across all 4 banners)

- **Left column** (marketing panel): headline → supporting slogan → feature list → CTA prompt.
- **Right column** (~60% of banner): hero product image · ladder angled toward viewer · open position.
- **Bottom strip**: phone CTA (bottom-left) + editable contact panel (bottom-right).
- **layout_family**: `premium_trade_banner_v1`.
- **cta_architecture**: `bottom_right_contact_box`.

## Editable Regions (constant per banner)

- `headline` (Extra Bold Sans · uppercase · 2 lines max)
- `subheadline` (medium weight · 4 lines max)
- `features` (4-6 items · themed circular icons)
- `phone_number` (inside CTA strip · bottom-left)
- `website` (bottom-right box)
- `email` (optional · under website)
- `social_media` (multi-channel panel toggle)
- `qr_code` (bottom-right corner · never covers ladder or opening)

## Safe Areas (never place content over)

Loft ladder · loft hatch · handrail · folding mechanism · wall lights · furniture · picture frame · indoor plant · feature icons · headline.

## Objects Registered into the Object Library (Object DNA seed)

Each object becomes a reusable ObjectDNA in `object-library` · variants added per theme pack. Auto-ids assigned via `nextId(family)` at seed time.

**LOFT_LADDER family:**
- Timber folding loft ladder · natural timber finish · steel hinges · handrail
- Heavy-duty steel folding loft ladder · matte black · red safety accents · gas/spring arms
- Aluminium folding loft ladder · brushed finish · spring arms · timber hatch

**Companion objects:**
- Loft hatch (white insulated · timber · steel-framed variants)
- Handrail (steel · timber variants)
- Ceiling opening frame
- Spotlight fixture (LED downlight)
- Feature wall (dark · grey · white · green variants) — scene composition only

## Marketing Personality Signals (fed to Pattern Learning)

- `theme_pack=industrial_black_gold` → `audience=luxury_homeowner` · `personality=premium`
- `theme_pack=modern_blue` → `audience=modern_family` · `personality=professional`
- `theme_pack=industrial_black_red` → `audience=builder_trade` · `personality=industrial`
- `theme_pack=nature_green` → `audience=general_homeowner` · `personality=family`

## What the platform does with this

1. **Vision Intelligence** analyses each banner → produces VisionAnalysis per image.
2. **VKEP** wraps each analysis into a DesignMemoryEntry with the raw image as evidence.
3. **Visual Learning Platform** compares each banner's detected objects against the Object Library · reinforces matches · registers new variants · captures style signals.
4. **Pattern Learning** learns the theme→audience→personality pairings from ≥ 4 observations.
5. **Design DNA** aggregates the collection into a project-level fingerprint.
6. **Recommendation Engine** future callers asking for "loft ladder banner for builders" retrieves the `industrial_black_red` variant with heavy_duty_steel_loft_ladder.
7. **Renderer** (Phase E.1+) uses the Object Library entries · never fabricates ladder geometry.

## Runtime seed

`scripts/seed-loft-ladder-collection.mjs` (SHIPPED this session) · registers the base ObjectDNA entries · runs `learn()` against the 4 banners' extracted knowledge · appends to `data/nex-learning-log.jsonl`.
