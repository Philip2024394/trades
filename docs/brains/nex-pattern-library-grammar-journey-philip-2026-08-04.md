---
authored_by: Philip O'Farrell (4 directives) · Master AI Engineer (formalisation)
authored_role: Founder directives + Master AI Engineer schema
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Marketing System · Pattern intelligence
document_version: 1.0
document_type: MEGA_DOCTRINE · turns Marketing framework into a design operating system
composes_with:
  - docs/brains/nex-campaign-selection-engine-philip-2026-08-04.md (Phase D.9)
  - docs/brains/nex-campaign-intelligence-and-marketing-system-philip-2026-08-03.md (Phase D.8)
  - docs/brains/nex-design-tokens-and-marketing-intelligence-philip-2026-08-03.md
  - docs/brains/nex-marketing-design-intelligence-philip-2026-08-03.md
---

# NEX Marketing Pattern Library + Marketing Grammar + Campaign Journey + Design Compatibility Extension

## The Doctrine

Philip 2026-08-04: *"Instead of storing only banners, store design patterns. Now Nex isn't copying banners — it understands WHY they look good."*

Four companion additions that shift the Marketing System from *"library of examples"* to *"design operating system with rules that COMPOSE new coherent campaigns."*

## Addition 1 · Marketing Pattern Library

**Rule:** patterns are reusable design DECISIONS, not templates.

```yaml
pattern:
  id: luxury_hero_right_layout
  applies_to: [luxury, executive, premium]

  headline:
    treatment: Large · 2-line · Bold · Uppercase
    max_chars_per_line: 20
    font_weight: 700
    letter_spacing: -0.02em

  subheadline:
    treatment: Sentence case
    font_size_ratio: 0.42  # relative to headline

  feature_list:
    count: 5
    format: bullet_icon
    max_chars_per_item: 32

  hero:
    position: right
    width_ratio: 0.55
    aspect: 4_3

  cta:
    position: bottom_right
    style: rectangular_pill
    background: theme_pack.cta_background

  contact:
    shape: rounded_rectangle
    corner_radius: 12

  spacing:
    default: 24px
    section: 48px

  padding:
    container: 32px
    text_inner: 20px

  icon_size:
    feature_list: 28px
    social: 24px
```

Nex now understands WHY luxury banners work: less text · larger imagery · more whitespace · smaller icons · simple CTA. When generating a NEW luxury banner, Nex applies the pattern, not the artwork.

## Addition 2 · Marketing Grammar

**Rule:** design rules by BRAND PERSONALITY encoded as compositional laws.

```yaml
marketing_grammar:

  luxury:
    text_density: LOW
    hero_dominance: HIGH
    whitespace: HIGH
    icon_size: SMALL
    cta_prominence: SUBTLE
    palette_saturation: LOW (deep tones · neutral accents)
    typography_scale: RESTRAINED (large but few weights)
    number_of_headline_lines: 2
    number_of_benefits: 3-4
    permit: [hero_full_bleed, subtle_gradient, minimal_icons]
    forbid: [discount_badge, urgency_bar, exclamation_marks, all_caps_ctas]

  promotion:
    text_density: HIGH
    hero_dominance: MEDIUM
    whitespace: LOW
    icon_size: LARGE
    cta_prominence: BOLD
    palette_saturation: HIGH (bright · attention-grabbing)
    typography_scale: AGGRESSIVE (multiple sizes, weights)
    number_of_headline_lines: 2-3
    number_of_benefits: 5-6
    permit: [discount_badge, urgency_bar, all_caps_ctas, price_sticker]
    forbid: [minimalist_layouts, ultra_subtle_ctas]

  professional:
    text_density: MEDIUM
    hero_dominance: MEDIUM
    whitespace: MEDIUM
    icon_size: MEDIUM
    cta_prominence: CLEAR (not shouty)
    palette_saturation: MEDIUM (trust colours · blues/teals)
    typography_scale: BALANCED
    number_of_headline_lines: 2
    number_of_benefits: 4-5
    permit: [feature_list_with_icons, trust_badges, testimonial_snippets]
    forbid: [neon_colours, urgency_bars, gimmicks]

  family:
    text_density: MEDIUM
    hero_dominance: MEDIUM
    whitespace: MEDIUM
    icon_size: MEDIUM
    cta_prominence: WELCOMING
    palette_saturation: WARM (greens, warm neutrals)
    typography_scale: FRIENDLY (rounded fonts optional)
    number_of_headline_lines: 2-3
    number_of_benefits: 4-5
    permit: [lifestyle_photography, warm_gradients, rounded_shapes]
    forbid: [aggressive_urgency, corporate_greys, neon]

  heritage:
    text_density: LOW
    hero_dominance: HIGH
    whitespace: HIGH
    icon_size: SMALL
    cta_prominence: SOPHISTICATED
    palette_saturation: LOW (browns, creams, walnut, mahogany)
    typography_scale: CLASSICAL (serif optional · restrained)
    number_of_headline_lines: 2
    number_of_benefits: 4
    permit: [serif_typography, decorative_dividers, subtle_textures]
    forbid: [neon, discount_badges, aggressive_ctas]
```

**Rule:** every banner generation call must resolve grammar rules for its declared brand personality. Grammar violations → warning · Nex asks *"are you sure? this combination breaks the luxury grammar rule 'no all-caps CTAs.'"*

## Addition 3 · Campaign Journey

**Rule:** a CAMPAIGN is a linked SEQUENCE of assets, not a single banner.

```yaml
campaign_journey:
  campaign_id: kitchen_mania_summer_2026
  objective: promotional_offer
  audience: family_homeowner
  timber: oak

  assets:
    - stage: awareness
      channel: facebook_feed_ad
      asset_type: landscape_banner
      template: kitchen_banner_002 (aqua_teal)
      metric: impressions

    - stage: consideration
      channel: instagram_story
      asset_type: portrait_9_16_story
      template: kitchen_story_002 (derived from banner_002)
      metric: clicks_to_website

    - stage: consideration
      channel: instagram_reel
      asset_type: reel_cover_9_16
      template: kitchen_reel_002 (derived from banner_002)
      metric: profile_visits

    - stage: consideration
      channel: website_hero
      asset_type: web_hero_1920x600
      template: kitchen_hero_002
      metric: landing_page_arrivals

    - stage: conversion
      channel: landing_page
      asset_type: long_form_landing
      template: kitchen_landing_002
      metric: quote_form_starts

    - stage: conversion
      channel: quote_form
      asset_type: form_page
      metric: quote_submissions

    - stage: nurture
      channel: email
      asset_type: email_hero_600px
      template: kitchen_email_002
      metric: email_opens_clicks

    - stage: closing
      channel: thank_you_page
      asset_type: web_thank_you
      metric: bookings_scheduled
```

**Nex can generate an ENTIRE COORDINATED CAMPAIGN from a single objective.** Every asset in the journey shares theme_pack · timber_profile · brand_personality · design tokens. Only aspect ratio · text layout · CTA architecture change per stage.

Storage: `data/nex-knowledge/_shared/campaign-journeys/{journey-id}.yaml`.

## Addition 4 · Design Compatibility Extension (Marketing)

**Rule:** compatibility rules extend to marketing (theme × product · not just theme × timber).

```yaml
marketing_compatibility:
  theme: nature_green
  works_with:
    - oak_staircase
    - shaker_kitchen
    - sage_cabinetry
    - brass_handles
    - herringbone_flooring
    - country_style
    - farmhouse_style
    - scandinavian
  avoid:
    - industrial_steel_staircase
    - neon_colours
    - high_tech_graphics
    - gloss_black_kitchen
    - chrome_hardware

  theme: luxury_burgundy
  works_with:
    - walnut_hero
    - mahogany_hero
    - marble_worktop
    - brass_accent
    - upholstered_seating
    - executive_home
  avoid:
    - pine_hero
    - budget_finishes
    - sales_event_banner_family
    - minimalist_scandinavian

  theme: industrial_orange
  works_with:
    - steel_staircase
    - concrete_wall
    - brick_feature
    - matt_black_kitchen
    - urban_loft
    - warehouse_conversion
  avoid:
    - georgian_home
    - traditional_moulding
    - heritage_walnut_cream_theme
    - pastel_palette
```

Nex enforces at BANNER GENERATION TIME: if the customer requests a luxury_burgundy theme banner with a pine hero, Nex flags the incompatibility.

## Composition Summary

The Marketing System is now a genuine DESIGN OPERATING SYSTEM composed of:

- **Product taxonomy** (existing · staircase/kitchen/etc.)
- **Campaign taxonomy** (10 categories · promotional_offer/brand_awareness/etc.)
- **Persona taxonomy** (7 personas)
- **Theme system** (12 packs)
- **Component library** (12 reusable components)
- **Layout families** (5 families)
- **CTA architectures** (6 types)
- **Design tokens** (colours · fonts · spacing · radius)
- **Recommendation engine** (Phase D.6/D.7)
- **Campaign Selection Engine** (Phase D.9)
- **Compatibility Rules** (timber × theme · Phase D.9)
- **NEW · Marketing Pattern Library** (design decisions · this doctrine)
- **NEW · Marketing Grammar** (personality → composition rules · this doctrine)
- **NEW · Campaign Journey** (linked assets across a full campaign · this doctrine)
- **NEW · Marketing Compatibility Extension** (theme × product · this doctrine)

**Next stage isn't creating more templates — it's enabling Nex to COMPOSE new marketing assets automatically from these building blocks while preserving consistent design quality and matching the campaign objective, audience, and product.**

That composition capability is delivered by the Pixel Rendering Engine (Phase E.0 · separate doctrine).

## Enhancement Opportunity

Every AI competitor treats each banner as a one-off asset. Nex treats every banner as an EXPRESSION of a pattern · grammar · journey · compatibility framework. When Nex generates a NEW banner for a NEW trade in a NEW theme, it inherits every design rule already learned. That's what makes 15 flagship banners into a compositional system capable of generating 100,000+ coherent variants.
