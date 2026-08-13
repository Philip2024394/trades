---
authored_by: Philip O'Farrell (8 directives) · Master AI Engineer (formalisation)
authored_role: Founder directives + Master AI Engineer schema
captured_at: 2026-08-03
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-03
architecture_layer: L2 · Marketing System evolution · Campaign + Persona + Performance + Components
document_version: 1.0
document_type: MEGA_DOCTRINE · 8 companion additions to the Marketing Intelligence system
composes_with:
  - docs/brains/nex-marketing-design-intelligence-philip-2026-08-03.md
  - docs/brains/nex-design-tokens-and-marketing-intelligence-philip-2026-08-03.md
  - docs/brains/nex-recommendation-objects-philip-2026-08-03.md
  - docs/brains/nex-domain-quality-dashboard-philip-2026-08-03.md
---

# NEX Campaign Intelligence + Personas + Performance + Component System + Marketing Tones + Storage Modules + Layout Families + Hero Product Classification

## The Doctrine

Philip 2026-08-03: *"You've taught NEX about products and marketing layouts, but there is still one major concept missing that would make the system even stronger: Campaign Intelligence."*

Eight companion additions to the Marketing Intelligence system. Each is a first-class capability that transforms banner templates into a **campaign-aware · persona-targeted · performance-measured · component-assembled marketing framework**.

## Addition 1 · Campaign Intelligence

**Rule:** every banner declares WHY it exists.

```yaml
campaign:
  objective: Lead Generation | Brand Awareness | Website Traffic | Followers | Direct Sales | Event Promotion
  platform: Facebook | Instagram | LinkedIn | Google Display | TikTok | Pinterest | YouTube | Print | Exhibition | Email
  audience: Homeowners | Architects | Builders | Developers | Interior Designers | Renovators | Commercial
  goal: Generate Quote Requests | Build Followers | Drive Traffic | Direct Enquiries | Event Attendance
  success_metric: Leads | CTR | Conversion | Followers | Website Visits | Phone Calls | WhatsApp Clicks
  cta_style: Call Today | Follow Us | Visit Website | Get Free Quote | Book Consultation | Learn More
```

Nex now recommends not just A banner, but the RIGHT banner for the marketing objective. Lead-generation query → `bottom_right_contact_box` architecture. Brand-awareness query → `full_width_cta_bar` architecture. Social-media query → `floating_contact_badge`.

## Addition 2 · Customer Personas

**Rule:** the SAME product is marketed differently to each persona.

```yaml
personas:
  luxury_homeowner:
    tone: sophisticated · aspirational
    palette: black_gold · walnut_cream · aqua_teal
    language: "Exceptional" · "Timeless" · "Bespoke"
    example_banners: [staircase_banner_003, staircase_banner_011, staircase_banner_012]

  builder:
    tone: practical · technical
    palette: modern_blue · corporate_grey · industrial_orange
    language: "Made to Measure" · "Built to Last" · "Fitted Right"
    example_banners: [staircase_banner_002, staircase_banner_007]

  architect:
    tone: precision · design-led
    palette: minimal_white · aqua_teal · luxury_black_gold
    language: "Architectural" · "Precision-Engineered" · "Structural"
    example_banners: [staircase_banner_008, staircase_banner_003]

  property_developer:
    tone: efficiency · scale
    palette: corporate_grey · modern_blue
    language: "Volume" · "Programme" · "Repeatable Quality"

  interior_designer:
    tone: aesthetic · coordinated
    palette: nature_green · traditional_brown · heritage_walnut_cream
    language: "Coordinated" · "Palette" · "Curated"
    example_banners: [understair_storage_banner_004]

  house_renovator:
    tone: transformative · lifestyle
    palette: nature_green_lifestyle · contemporary_navy
    language: "Transform" · "More Space" · "Peace of Mind"
    example_banners: [understair_storage_banner_002, understair_storage_banner_003]

  commercial_client:
    tone: functional · robust
    palette: corporate_grey · industrial_orange
    language: "Durable" · "Scalable" · "Compliant"
```

## Addition 3 · Banner Performance Analytics

**Rule:** every rendered banner logs performance metrics for future optimisation.

```yaml
banner_performance:
  banner_id: staircase_banner_001
  metrics:
    ctr: 0.084                        # click-through rate
    conversion_rate: 0.16
    quote_requests: 512
    phone_calls: 34
    whatsapp_clicks: 187
    website_visits: 2401
    instagram_followers_gained: 89
  measured_over: last_90_days
  campaigns_run: 12
  best_platform: Facebook             # highest CTR
  best_persona: luxury_homeowner
```

Over time Nex recommends banners based on REAL-WORLD RESULTS rather than only design principles. The best-performing theme_pack + persona + platform combinations bubble up automatically.

Storage: `data/nex-banner-performance.jsonl` (append-only · aggregated in Dashboard).

## Addition 4 · Component-Based Banner System

**Rule:** every banner is ASSEMBLED from reusable components.

```yaml
banner_components:
  - headline_block
  - subheadline_block
  - feature_list
  - icon_list
  - hero_image
  - badge
  - contact_box
  - contact_bar
  - qr_code
  - social_links
  - cta_button
  - background_panel
```

Nex generates entirely NEW banners by assembling proven components while preserving spacing · alignment · branding consistency (governed by the Design Token System).

Example composition:

```yaml
banner_composition:
  layout_family: premium_trade_banner_v1
  theme_pack: modern_blue
  components:
    - {type: headline_block,     position: top_left,    tokens: {font: headline_font, colour: primary_text}}
    - {type: feature_list,       position: middle_left, tokens: {icon_size: 32px, spacing: default}}
    - {type: hero_image,         position: right,       constraints: {aspect: 4_3, safe_area: true}}
    - {type: cta_button,         position: bottom_left, tokens: {padding: cta_padding, radius: border_radius}}
    - {type: contact_box,        position: bottom_right, tokens: {bg: cta_background, text: cta_text}}
```

## Addition 5 · Marketing Tone Classification

**Rule:** every banner's messaging is classified into a MARKETING TONE.

```yaml
marketing_tones:
  performance:
    keywords: [Engineered, Durable, Built to Last, Premium Materials, Precision]
    fits: [architects, builders, developers, commercial]
    theme_packs: [modern_blue, industrial_orange, corporate_grey]

  lifestyle:
    keywords: [More Space, Better Living, Everyday Ease, Clutter-Free, Peace of Mind, Every Inch Matters]
    fits: [homeowners, renovators, families]
    theme_packs: [nature_green_lifestyle, contemporary_navy, minimal_white]

  luxury:
    keywords: [Exceptional, Prestige, Classic Elegance, Rich in Colour, Statement]
    fits: [luxury_homeowners, interior_designers]
    theme_packs: [luxury_black_gold, heritage_walnut_cream, aqua_teal]

  family:
    keywords: [Safe, Practical, Beautiful, Organised, Built for Generations]
    fits: [homeowners, renovators]
    theme_packs: [nature_green, traditional_brown]

  modern:
    keywords: [Clean, Minimal, Smart Design, Innovative]
    fits: [architects, contemporary_homeowners]
    theme_packs: [aqua_teal, minimal_white, premium_purple]
```

## Addition 6 · Storage Module Intelligence (Under-Stair)

**Rule:** Under-stair storage is treated as a CONFIGURABLE COLLECTION of 20+ modules.

```yaml
understair_storage_modules:
  wardrobe: [hanging_rail, coats, jackets]
  shoe_storage: [pull_out, shelves, drawers]
  household: [vacuum, ironing_board, cleaning_products]
  display: [books, ornaments, plants]
  utility: [baskets, recycling, pet_storage]
  premium_options: [LED_lighting, soft_close, push_to_open, charging_station, hidden_safe]
```

Nex recommends SPECIFIC combinations: *"a coat wardrobe with pull-out shoe drawers and integrated LED lighting for a busy family hallway"* rather than generic "under-stair storage."

## Addition 7 · Layout Families (Second Family)

**Rule:** the banner library now formally supports MULTIPLE layout families under the `premium_trade_banner` template family.

```yaml
layout_families:
  premium_trade_banner_v1:
    style: rectangular_panel_layout
    hero: right
    info: left
    cta_types: [bottom_right_contact_box]
    examples: [staircase_banner_001 through 012, joinery_banner_001 and 002, joinery_banner_003 uses classic_trade_layout_v1 which is a subset]

  classic_trade_layout_v1:
    style: multi_service_company_banner
    hero: right
    info: left
    cta_types: [bottom_right_contact_box]
    examples: [joinery_banner_003]

  curved_lifestyle_layout_v1:
    style: curved_information_panel
    hero: left
    info: right (curved)
    cta_types: [full_width_cta_bar]
    examples: [understair_storage_banner_002]

  curved_lifestyle_layout_v2:
    style: curved_dark_panel
    hero: right
    info: left (curved dark)
    cta_types: [full_width_cta_bar]
    examples: [understair_storage_banner_003]

  curved_lifestyle_layout_v3:
    style: curved_light_panel
    hero: right
    info: left (curved light)
    cta_types: [full_width_cta_bar]
    examples: [understair_storage_banner_004]
```

Nex chooses layout family based on hero product + tone + platform. Product-focused lead-gen → `premium_trade_banner_v1`. Lifestyle brand-awareness → `curved_lifestyle_layout_v1/v2/v3`. Multi-service company promo → `classic_trade_layout_v1`.

## Addition 8 · Hero Product Type Classification + Joinery Service Catalogue

**Rule:** every banner declares `hero_product_type`. Enables cross-domain grouping.

```yaml
hero_product_types:
  - staircase
  - kitchen
  - front_entrance_door
  - back_door
  - french_door
  - sliding_door
  - window
  - under_stair_storage
  - media_wall
  - wardrobe
  - internal_door
  - fitted_furniture
  - home_office
  - utility_room
  - pantry
  - boot_room
  - alcove_furniture
```

**Joinery Service Catalogue (Philip 2026-08-03 formalisation):**

```yaml
external_joinery: [Front Doors, Back Doors, French Doors, Sliding Doors, Windows, Garage Doors, Porch Joinery]
internal_joinery: [Staircases, Under-Stair Storage, Kitchens, Wardrobes, Media Walls, Alcove Furniture, Home Offices, Utility Rooms, Pantries, Boot Rooms, Internal Doors]
```

This enables cross-domain consultant questions:
- *"Can the same joiner make my front door and staircase?"*
- *"If I'm replacing my front door, what other joinery should I consider?"*
- *"Can you match my new front door with my staircase, internal doors, and fitted furniture?"*

Nex acts as a WHOLE-HOME JOINERY CONSULTANT rather than answering isolated product questions.

## Under-Stair Storage Style Collection (formalisation)

```yaml
understair_storage_style_collection:
  industrial_modern:
    colours: [black, gold]
    audience: [loft_apartments, contemporary_homes]
    example: understair_storage_banner_001

  family_lifestyle:
    colours: [white, sage_green]
    audience: [family_homes, new_builds]
    example: understair_storage_banner_002

  contemporary_luxury:
    colours: [navy, sky_blue]
    audience: [modern_renovations, designer_interiors]
    example: understair_storage_banner_003

  heritage_luxury:
    colours: [walnut, cream]
    audience: [executive_homes, traditional_properties]
    example: understair_storage_banner_004
```

## Combinatorial Leverage (updated)

Marketing library now spans:
- **2 template families** (premium_trade_banner + classic_trade_layout)
- **5 layout families** (v1 · classic_v1 · curved_lifestyle_v1/v2/v3)
- **11 theme packs**
- **6 timber marketing profiles**
- **6 CTA architectures**
- **5 marketing tones**
- **7 customer personas**
- **17 hero product types**

**Combinatorial capacity: 5 layouts × 11 themes × 6 tones × 7 personas × 17 hero types ≈ 39,270 unique banner variants from ONE component system.**

## Governance

- Every new banner MUST declare: `banner_family` + `layout_family` + `theme_pack` + `cta_architecture` + `hero_product_type` + `marketing_tone` + optional `persona` + optional `campaign`.
- Every rendered banner logs performance to `data/nex-banner-performance.jsonl`.
- Component definitions live at `data/nex-knowledge/_shared/banner-components/` (future).
- Persona definitions live at `data/nex-knowledge/_shared/marketing-personas/` (future).

## Composition with Existing Systems

- **Marketing Design Intelligence (base)** — the banner metadata schema.
- **Design Token System** — every component references tokens.
- **Recommendation Objects (Phase D.7)** — recommendations can now reference specific banner templates by ID + persona + campaign.
- **Foundation Brain 9 (Professional Writing Style)** — marketing tones inform the register per persona.
- **Foundation Brain 13 (Match User Knowledge)** — persona classification composes with identity register.
- **Domain Quality Dashboard** — banner performance metrics render alongside domain scorecards.

## Enhancement Opportunity

The banner library has evolved from *"we have 15 banners"* → *"we have 39,270 possible variants generated from a component system with campaign intelligence + persona targeting + performance analytics."* Nex is no longer selecting templates. It's RECOMMENDING and GENERATING marketing assets tailored to specific business goals, audiences, and measurable performance data. That's the difference between a design tool and a marketing operating system.
