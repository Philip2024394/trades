---
authored_by: Philip O'Farrell (6 directives) · Master AI Engineer (formalisation)
authored_role: Founder directives + Master AI Engineer schema
captured_at: 2026-08-03
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-03
architecture_layer: L2 · extension of Marketing Design Intelligence + Domain Quality Dashboard
document_version: 1.0
document_type: MEGA_DOCTRINE · 6 companion additions to the Marketing intelligence system
composes_with:
  - docs/brains/nex-marketing-design-intelligence-philip-2026-08-03.md
  - docs/brains/nex-domain-quality-dashboard-philip-2026-08-03.md
  - docs/brains/nex-recommendation-objects-philip-2026-08-03.md
---

# NEX Design Tokens · Industry Theme Packs · CTA Architecture · Template Performance · Timber Marketing Profiles · Knowledge Growth Roadmap

## The Doctrine

Philip 2026-08-03: *"One area I'd add next — a Design Token System. Every banner simply references the token set. Changing an entire brand becomes: Brand A → Orange → Brand B → Blue without redesigning the template."*

Six companion additions to the Marketing Design Intelligence + Domain Quality Dashboard doctrines. Each is a first-class capability that turns the banner library into a **REUSABLE MARKETING FRAMEWORK**.

## Addition 1 · Design Token System

**Rule:** every banner references TOKENS · not hardcoded values.

```yaml
design_tokens:
  colors:
    primary: "#F58220"
    secondary: "#000000"
    accent: "#FFFFFF"
    cta_background: "#F58220"
    cta_text: "#FFFFFF"
    headline_text: "#000000"
  fonts:
    headline: "Montserrat ExtraBold"
    body: "Montserrat Medium"
    cta: "Montserrat Bold"
  spacing:
    border_radius: 12px
    cta_padding: 20px
    default: 24px
    safe_margin: 15px
  icon:
    size: 32px
    style: filled_outline
```

Every banner in the `premium_trade_banner_v1` family references tokens. **To rebrand: swap the token set. No redesign needed.**

## Addition 2 · Industry Theme Packs

**Rule:** every accent-colour combination shipped this session becomes a NAMED theme pack. Future trades inherit these packs instantly.

```yaml
theme_packs:
  luxury_black_gold:
    used_by: [staircase_banner_001, staircase_banner_003]
    colors: {primary: "#000000", secondary: "#D4AF37", accent: "#FFFFFF"}
    tier: luxury_architectural
    matches: [walnut_hero, floating_staircase, mono_string]

  modern_blue:
    used_by: [staircase_banner_002, joinery_banner_002]
    colors: {primary: "#1E40AF", secondary: "#FFFFFF", accent: "#000000"}
    tier: modern_professional
    matches: [oak_hero, steel_balustrade, contemporary_kitchen]

  industrial_orange:
    used_by: [staircase_banner_007]
    colors: {primary: "#F58220", secondary: "#000000", accent: "#FFFFFF"}
    tier: industrial_loft
    matches: [steel_and_oak_hero, brick_wall, open_riser]

  nature_green:
    used_by: [staircase_banner_005, staircase_banner_009, joinery_banner_001]
    colors: {primary: "#22C55E", secondary: "#FFFFFF", accent: "#000000"}
    tier: natural_family
    matches: [oak_hero, pine_hero, natural_timber]

  corporate_grey:
    tier: professional_corporate
    matches: [any_hero]

  traditional_brown:
    used_by: [staircase_banner_004, staircase_banner_011, staircase_banner_012]
    colors: {primary: "#8B4513", secondary: "#FFFFFF", accent: "#F5F5DC"}
    tier: heritage_traditional
    matches: [oak_hero, walnut_hero, mahogany_hero, turned_spindles, ball_finials]

  premium_purple:
    used_by: [staircase_banner_006]
    colors: {primary: "#7C3AED", secondary: "#000000", accent: "#FFFFFF"}
    tier: creative_premium
    matches: [industrial_oak_and_steel, loft_style]

  minimal_white:
    tier: scandinavian_minimalist
    matches: [pale_oak_hero, frameless_glass, handleless]

  aqua_teal:
    used_by: [staircase_banner_008]
    colors: {primary: "#14B8A6", secondary: "#FFFFFF", accent: "#000000"}
    tier: luxury_precision
    matches: [mono_string, frameless_glass, luxury_architectural]
```

**Every future trade (roofing · flooring · windows · landscaping · electricians · plumbers) inherits one of these 9 packs.**

## Addition 3 · CTA Architecture Types

**Rule:** every banner declares which CTA architecture it uses. 6 types identified so far:

| Type | Description | Best For | Examples |
|---|---|---|---|
| `bottom_right_contact_box` | Dedicated colored rectangle bottom-right containing WhatsApp/phone/website | Lead generation · contact-first | banners 001-012 |
| `full_width_cta_bar` | Bottom-full-width slogan bar (no dedicated contact box) | Brand awareness · lifestyle marketing | understair_storage_banner_001 |
| `split_cta_and_contact` | Slogan left · contact right (split bottom) | Print flyers · retail | future |
| `floating_contact_badge` | CTA + floating WhatsApp/Instagram badge (top-right or corner) | Social media campaigns | future |
| `qr_code_cta` | QR code panel linking to portfolio/booking page | Printed material · showroom posters | future |
| `multi_channel_contact_panel` | Multiple contact methods (phone + email + website + social) in one panel | Corporate · commercial | future |

**Nex chooses the CTA architecture based on the campaign type:** Lead gen → type_1 · Brand awareness → type_2 · Social → type_4 · Print → type_5.

## Addition 4 · Template Performance Metrics

**Rule:** every banner in the library carries running performance metrics.

```yaml
banner_performance:
  banner_id: staircase_banner_001
  theme_pack: luxury_black_gold
  used_count: 3102              # times the template was rendered
  click_rate: 0.084             # 8.4% of impressions produce a click
  quote_requests: 512           # customer-initiated quote requests
  conversion_rate: 0.16         # 16% of quote requests → paid job
  star_rating: 5                # aggregated user rating
  measured_over: last_90_days
```

Populated by:
- `used_count` — every banner render logged to `data/nex-banner-usage.jsonl`
- `click_rate` — CTR from downstream campaign analytics (Facebook Pixel · Google Analytics)
- `quote_requests` — count of `book_survey` / `free_quote` action clicks
- `conversion_rate` — quote_requests ÷ paid_jobs (workspace-persisted; needs Phase F)
- `star_rating` — user thumbs-up ÷ (thumbs-up + thumbs-down)

Rendered on the Knowledge Dashboard alongside domain scorecards. **Nex learns which designs actually convert.**

## Addition 5 · Timber Marketing Profiles (Material-Based Marketing Hierarchy)

**Rule:** every timber species carries a MARKETING PROFILE that drives banner language, colour palette, imagery, tone.

```yaml
timber_marketing_profiles:
  pine:
    audience: First-time buyers · family homes · budget renovations
    message: Natural · warm · affordable · honest · every home
    theme_packs: [nature_green, minimal_white]
    hero_examples: [staircase_banner_009]

  oak:
    audience: Premium family homes · long-term investment
    message: Strong · timeless · dependable · built for generations
    theme_packs: [traditional_brown, nature_green, modern_blue]
    hero_examples: [staircase_banner_001, staircase_banner_002, staircase_banner_010]

  walnut:
    audience: Luxury renovations · executive homes
    message: Rich · sophisticated · statement · make an impression
    theme_packs: [luxury_black_gold, traditional_brown]
    hero_examples: [staircase_banner_003, staircase_banner_011]

  mahogany:
    audience: Executive · heritage properties · boutique developments
    message: Prestige · classic elegance · heritage · unmatched beauty
    theme_packs: [traditional_brown]
    hero_examples: [staircase_banner_012]

  glass:
    audience: Modern homes · architectural design
    message: Modern · architectural · minimal · innovation
    theme_packs: [luxury_black_gold, aqua_teal, minimal_white]
    hero_examples: [staircase_banner_003, staircase_banner_008, staircase_banner_005]

  steel:
    audience: Industrial · loft · contemporary · commercial
    message: Industrial · contemporary · engineered · precision
    theme_packs: [premium_purple, industrial_orange, corporate_grey]
    hero_examples: [staircase_banner_006, staircase_banner_007]
```

**When a customer says *"I want a mahogany staircase advert"*, Nex knows: heritage tone · burgundy palette · Georgian/Victorian audience · use `staircase_banner_012` as the base template.**

## Addition 6 · Knowledge Growth Roadmap (Dashboard Extension)

**Rule:** the Knowledge Dashboard scorecard adds MATURITY ROADMAP columns per domain:

| Domain | Coverage | Evidence | Images | Recommendations | Marketing | Status |
|---|---|---|---|---|---|---|
| Staircases | 96% | 94% | 98% | 95% | 100% | Gold |
| Kitchens | 82% | 85% | 74% | 80% | 65% | Silver |
| Flooring | 18% | 12% | 8% | 5% | 0% | Bronze |

- **Coverage** — sub-area coverage % (existing)
- **Evidence** — % of factual claims with source links (5-Metric #4)
- **Images** — % of expected specimen library complete
- **Recommendations** — % of the domain's recommendation set with FULL Phase D.7 object shape
- **Marketing** — % of the domain's banner templates in `premium_trade_banner_v1` family
- **Status** — Bronze / Silver / Gold overall

**Immediately obvious where the next investment should go.**

Runtime: `scripts/build-nex-knowledge-dashboard.mjs` (v2 · to be extended with these columns).

## Composition Summary

- **Design Tokens** — the palette layer.
- **Theme Packs** — named token sets.
- **Marketing Design Intelligence** (base doctrine) — banner metadata schema.
- **Recommendation Objects** — recommendations reference banner templates by ID + theme pack.
- **Domain Quality Dashboard** — surfaces theme pack usage + template performance.
- **Foundation Brain 9 (Professional Writing Style)** — timber marketing profiles inform tone.
- **Foundation Brain 12 (Show-Don't-Tell)** — banner recommendations surface via image insertion.

## What This Enables

When a homeowner asks *"design me a mahogany staircase advert for my heritage renovation business"*, Nex:

1. Identifies timber profile: **mahogany** → heritage/prestige tone.
2. Selects theme pack: **traditional_brown** (matches mahogany profile).
3. Loads template: **`staircase_banner_012`** (the flagship mahogany template).
4. Applies design tokens from the theme pack.
5. Fills editable regions with the customer's contact info.
6. Delivers a rendered banner AND logs `used_count` for future performance tracking.

**No design work needed. Just tokens + theme + template + customer content.**

## Governance

- Every new banner MUST declare `theme_pack` + `cta_architecture` + `timber_profile` (if timber-hero).
- Every rendered banner logs to `data/nex-banner-usage.jsonl` for performance tracking.
- Every theme pack is Philip-approved before being available for use.
- Every CTA architecture type must be listed in the taxonomy above · new types require doctrine update.

## Enhancement Opportunity

The banner library was already reusable. Now it is **THEMEABLE · MEASURABLE · MATERIAL-AWARE · ARCHITECTURALLY-CLASSIFIED**. Instead of "we have 15 banners", Nex has "9 theme packs × 6 timber profiles × 6 CTA architectures × 1 layout family = 324 possible combinations from ONE template". That's untouchable design-system leverage.
