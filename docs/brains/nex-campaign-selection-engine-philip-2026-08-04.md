---
authored_by: Philip O'Farrell (directives) · Master AI Engineer (formalisation + runtime spec)
authored_role: Founder directives + Master AI Engineer runtime contract
captured_at: 2026-08-04
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-04
architecture_layer: L2 · Marketing System · Campaign Selection Engine
document_version: 1.0
document_type: MEGA_DOCTRINE · turns Marketing Framework from template library into recommendation system
composes_with:
  - docs/brains/nex-marketing-design-intelligence-philip-2026-08-03.md (banner metadata)
  - docs/brains/nex-design-tokens-and-marketing-intelligence-philip-2026-08-03.md (theme packs + timber profiles)
  - docs/brains/nex-campaign-intelligence-and-marketing-system-philip-2026-08-03.md (campaigns + personas + tones)
  - docs/brains/nex-recommendation-objects-philip-2026-08-03.md (Recommendation Object Phase D.7)
---

# NEX Campaign Selection Engine + Compatibility Rules + Marketing Knowledge Graph + Performance Feedback + Kitchen Mania Campaign Family + luxury_burgundy Theme

## The Directive

Philip 2026-08-04: *"The framework is now rich enough that the next improvements should focus on selection, not just generation. Introduce a campaign selection engine that decides which banner variant should be used before any rendering takes place."*

**Turns the framework from a TEMPLATE LIBRARY into a RECOMMENDATION SYSTEM.**

## Addition 1 · Campaign Selection Engine

**Rule:** every campaign brief becomes a SELECTION QUERY that returns the recommended banner variant.

Input:

```yaml
campaign:
  industry: staircase
  product: oak_staircase
  audience: homeowner
  goal: lead_generation
  platform: facebook
  tone: premium
```

Output:

```yaml
recommended:
  banner_id: staircase_banner_001
  theme_pack: luxury_black_gold
  cta_architecture: bottom_right_contact_box
  timber_profile: oak
  layout_family: premium_trade_banner_v1
  confidence: 0.94
  reasoning: "Oak+premium+lead_gen → luxury_black_gold theme (matches oak) → bottom_right_contact_box (best for lead_gen) → premium_trade_banner_v1 (classic layout for phone-first CTA)"
```

## Addition 2 · Compatibility Rules

**Rule:** timber-to-theme pairings ensure visually consistent combinations.

```yaml
timber_theme_compatibility:
  oak:
    preferred: [traditional_brown, luxury_black_gold, nature_green]
    acceptable: [modern_blue, corporate_grey]
    avoid: [industrial_orange, premium_purple, aqua_teal]

  walnut:
    preferred: [luxury_black_gold, heritage_walnut_cream, premium_purple]
    acceptable: [traditional_brown]
    avoid: [industrial_orange, nature_green]

  pine:
    preferred: [nature_green, minimal_white]
    acceptable: [traditional_brown]
    avoid: [luxury_black_gold, luxury_burgundy]

  mahogany:
    preferred: [traditional_brown, heritage_walnut_cream, luxury_burgundy]
    acceptable: [luxury_black_gold]
    avoid: [industrial_orange, aqua_teal, nature_green]

  glass:
    preferred: [aqua_teal, modern_blue, minimal_white, luxury_black_gold]
    acceptable: [premium_purple]
    avoid: [traditional_brown, nature_green]

  steel:
    preferred: [industrial_orange, corporate_grey, premium_purple]
    acceptable: [modern_blue, luxury_black_gold]
    avoid: [traditional_brown, heritage_walnut_cream, nature_green]
```

**Prevents visually inconsistent combinations and preserves design quality.**

## Addition 3 · Marketing Knowledge Graph

**Rule:** relationships between concepts (theme packs · timber profiles · campaigns · personas · CTA architectures · hero products) form a graph. Nex explains WHY it selected a banner using the graph.

```
Theme Pack
    │
    ├── matches → Timber Profile      (via timber_theme_compatibility)
    ├── supports → Campaign Goal      (theme_pack.supported_goals)
    ├── recommends → CTA Architecture (theme_pack.default_cta)
    ├── targets → Audience            (theme_pack.audience)
    ├── references → Hero Product     (theme_pack.example_heroes)
    └── expresses → Brand Personality (theme_pack.personality)
```

Every selection returns a reasoning chain like: *"luxury_black_gold theme → matches oak (compatibility) → supports lead_generation (default_goal) → recommends bottom_right_contact_box CTA (default_cta) → targets luxury_homeowner (default_audience) → expresses luxury personality"*.

## Addition 4 · Performance Feedback

**Rule:** every rendered banner logs performance metrics. Metrics compute a QUALITY SCORE that influences future selection.

```yaml
banner_quality_score = (
  ctr × 0.30 +                  # click-through rate
  conversion_rate × 0.40 +      # quote-to-paid conversion
  quote_request_rate × 0.20 +   # quote requests per impression
  user_rating × 0.10            # thumb-up / thumb-down aggregate
)

# Applied per {campaign_type × persona × platform} bucket
# Bucket example: {promotional_offer × family_homeowner × facebook} → learns which banner wins
```

Banners with higher quality scores for a specific bucket bubble up in future selections. Composes with `data/nex-banner-performance.jsonl` append log.

## Addition 5 · Kitchen Mania Campaign Family (worked example)

**Rule:** related banners that share a campaign objective form a CAMPAIGN FAMILY. The 4 Kitchen Mania banners demonstrate:

- SAME product category (kitchen)
- SAME offer (worktop discount)
- SAME layout (classic_trade_layout)
- DIFFERENT theme pack per audience:

| Banner | Theme | Personality | Audience | Market Segment |
|---|---|---|---|---|
| kitchen_banner_001 | industrial_orange | sales_event | budget_renovator | value |
| kitchen_banner_002 | aqua_teal | professional | family_homeowner | professional |
| kitchen_banner_003 | luxury_burgundy | luxury | executive_homeowner | luxury |
| kitchen_banner_004 | nature_green | family | family_homeowner + house_renovator | premium_family |

**Same product · same offer · four persona-specific variants.**

Campaign selection query for *"Kitchen Mania promo · family homeowner · Facebook"* returns `kitchen_banner_002` OR `kitchen_banner_004` (both match family_homeowner + facebook · quality score decides).

## Addition 6 · Offer Object

**Rule:** every promotional banner declares a first-class OFFER OBJECT.

```yaml
offer:
  offer_name: Discounted Worktop Offer
  offer_type: [Percentage Discount, Free Upgrade, Bundle, BOGO, Bonus]
  discount_target: Worktops
  offer_duration: Editable (This Week Only, Limited Time, Summer, Winter, Anniversary)
  urgency_level: [Low, Medium, High]
  call_to_action: Pop Us a Call Today
  landing_goal: Free Kitchen Quote
  conversion_event: Phone Call
  promotional_language_triggers: [Prices Just Dropped, Sale, Limited Time, This Week Only, Free Upgrade, Free Sink, Free Appliances, 20% Off]
```

## Addition 7 · Brand Personality Engine

**Rule:** the SAME product marketed to DIFFERENT audiences requires different brand personality.

```yaml
brand_personality_types:
  sales_event:
    colours: [orange]
    tone: [urgent, promotional, high_energy]
    fits_audiences: [budget_renovator, first_time_buyer]
    fits_campaigns: [promotional_offer, seasonal_campaign, flash_sale]

  professional:
    colours: [teal, blue]
    tone: [trusted, reliable, premium]
    fits_audiences: [family_homeowner, small_business_owner]
    fits_campaigns: [lead_generation, brand_awareness]

  luxury:
    colours: [black, gold, burgundy]
    tone: [exclusive, prestigious]
    fits_audiences: [luxury_homeowner, executive_homeowner]
    fits_campaigns: [brand_awareness, product_launch, portfolio_showcase]

  family:
    colours: [green, warm_neutrals]
    tone: [warm, friendly, practical]
    fits_audiences: [family_homeowner, house_renovator]
    fits_campaigns: [lifestyle, seasonal_campaign]

  heritage:
    colours: [brown, walnut, mahogany]
    tone: [traditional, timeless, craftsmanship]
    fits_audiences: [luxury_homeowner, interior_designer, property_developer]
    fits_campaigns: [brand_awareness, testimonial, portfolio_showcase]
```

## Addition 8 · Kitchen Market Segmentation

```yaml
kitchen_market_segments:
  value: {theme: industrial_orange, focus: "Price & Offers", customer: "Budget Conscious"}
  professional: {theme: aqua_teal, focus: "Quality & Trust", customer: "Family Homeowners"}
  luxury: {theme: luxury_burgundy, focus: "Premium Design & Lifestyle", customer: "Executive Homeowners"}
  premium_family: {theme: nature_green, focus: "Natural Warmth", customer: "Modern Family Homes"}
```

## Addition 9 · luxury_burgundy Theme Pack (NEW · 12th theme)

```yaml
theme_pack:
  id: luxury_burgundy
  colours:
    primary: [burgundy, gold, white_marble]
    accent: gold
  personality: luxury (sophisticated · warm · exclusive · designer_interior)
  timber_compatibility: [walnut, mahogany]
  audience: [executive_homeowner, interior_designer]
  example_heroes: [luxury_contemporary_kitchen, walnut_staircase, mahogany_staircase]
  contrasts_with: [luxury_black_gold (harder edge), heritage_walnut_cream (traditional)]
  example_banner: kitchen_banner_003
```

## Addition 10 · Campaign Categories (10 categories formalised)

```yaml
campaign_categories:
  brand_awareness: Build company recognition
  lead_generation: Generate quote requests
  promotional_offer: Sell a discount or limited-time deal
  product_launch: Introduce a new product or range
  seasonal_campaign: Christmas · Summer · Black Friday
  showroom_event: Invite customers to an open day
  cross_sell: Promote related services
  customer_testimonial: Build trust with reviews
  before_after: Showcase transformations
  portfolio_showcase: Display completed projects
```

## Runtime · Selection Algorithm

```
FUNCTION selectBanner(campaign):
  1. Score all banners on match to campaign.audience (via brand_personality + persona lookup)
  2. Filter by campaign.industry + product_family + hero_product_type
  3. Apply compatibility rules (timber↔theme) to eliminate poor pairings
  4. Rank remaining candidates by:
     - persona_match_score × 0.35
     - campaign_type_match × 0.25
     - platform_match × 0.15
     - theme_compatibility_score × 0.15
     - historical_quality_score × 0.10
  5. Return top candidate with full reasoning chain
```

## Composition with Existing Systems

- **Recommendation Engine (Phase D.6)** — Campaign Selection Engine sits ABOVE the Recommendation Engine · when the user's intent is *marketing*, the pipeline routes through Campaign Selection first, then wraps the result in a Recommendation Object (Phase D.7).
- **Marketing Design Intelligence** — the selection engine reads banner metadata from the manifest.
- **Design Tokens + Theme Packs** — the selection engine chooses a theme pack; the token system applies the palette.
- **Foundation Brain 6 (Recommendations)** — every selection carries reasoning (WHY this banner).
- **5-Metric Quality Model** — banner quality score contributes to Retrieval Accuracy + Answer Quality + User Success metrics.

## Enhancement Opportunity

The framework was already themeable, measurable, material-aware, and architecturally classified. Now it's **INTELLIGENTLY SELECTABLE**. A campaign brief → a specific banner variant with reasoning · compatibility-checked · performance-aware. That is the difference between a marketing FRAMEWORK and a marketing ADVISOR. Every future domain (roofing · flooring · electricians) inherits this selection engine automatically.
