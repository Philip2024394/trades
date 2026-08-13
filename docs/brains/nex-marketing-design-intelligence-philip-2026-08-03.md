---
authored_by: Philip O'Farrell (doctrine) · Master AI Engineer (metadata schema formalisation)
authored_role: Founder doctrine + Master AI Engineer implementation contract
captured_at: 2026-08-03
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-03
architecture_layer: L2 · foundational infrastructure for future Domain 003
document_version: 1.0
document_type: MEGA_DOCTRINE · marketing template metadata contract
composes_with:
  - Recommendation Engine (Phase D.6 · marketing category)
  - Knowledge Layer (banners stored as knowledge items)
  - ADR-0024 (Image Manifest Rule)
  - _shared/design-coordination/ (banner style choices coordinate with product design)
---

# NEX Marketing Design Intelligence

## The Doctrine

Philip 2026-08-03: *"NEX shouldn't just store banner images — it should store the STRUCTURE · INTENT · EDITABLE REGIONS of each design. That's how professional design systems work."*

This doctrine defines the metadata schema for every marketing template Nex stores. It is the FOUNDATIONAL INFRASTRUCTURE for a future Domain 003 · Marketing Design Intelligence — but does NOT yet constitute a full domain. We're building the schema now so every banner from today onwards can be captured with design intelligence, ready for the full domain when Philip authorises it.

## The Core Insight

Instead of *"Here's banner 27"*, Nex stores:

- **Banner ID** (unique identifier)
- **Template Family** (which reusable layout it belongs to)
- **Industry** (which trades this template serves)
- **Style** (design language)
- **Layout Map** (where every element lives)
- **Editable Regions** (with coordinates + safe areas + allowed content types)
- **Design Rules** (do's and don'ts)
- **Hero Product Metadata** (what the featured product actually is)
- **Marketing Goal** (why the banner exists)
- **Recommended Platforms** (where to publish)

## The Mandatory Metadata Schema

Every marketing template (banner · flyer · business card · vehicle graphic · exhibition stand · social ad) MUST carry:

```yaml
banner_id: staircase_banner_001
template_family: premium_trade_banner
industry: [staircase, joinery]
orientation: landscape
quality: A+

style:
  - modern
  - premium
  - luxury
  - contemporary

colour_palette:
  primary: [black, gold, white]
  secondary: [oak, glass, warm_led]

layout_pattern: left_information + right_hero_image + bottom_cta

layout_map:
  logo: top_left
  headline: top_left
  feature_list: middle_left
  hero_image: right
  cta_box: bottom_right
  phone: bottom_left

editable_regions:
  - id: cta_box
    location: bottom_right
    safe_area: {x: 58%, y: 83%, w: 37%, h: 11%}
    background: solid_black
    preferred_text: white
    allowed_content:
      - WhatsApp Number
      - Mobile Number
      - QR Code
      - Website
      - Free Quote
      - Book Survey
    disallowed_content:
      - Large image
      - Long paragraph
      - Logo
    recommended_font: bold sans serif
    alignment: centre
    maximum_lines: 2
    padding: 20px
  - id: company_heading
    editable: true
  - id: slogan
    editable: true
  - id: feature_list
    editable: true
  - id: hero_image
    editable: true
    rules: [never obstruct, keep aspect ratio]

design_rules:
  - Never cover the hero product.
  - Keep the CTA inside the dedicated box.
  - Maintain generous spacing around the headline.
  - Preserve the contrast between {colour1} · {colour2} · {colour3}.
  - Keep icons together as one feature group.
  - Use the hero image to showcase craftsmanship rather than adding text over it.

hero_product_metadata:
  type: modern straight-flight staircase
  construction: closed risers · oak treads · white painted stringer
  balustrade: frameless glass · slim black clamps
  lighting: integrated LED tread
  style: contemporary luxury

marketing_goal: generate leads · build trust · showcase craftsmanship

recommended_platforms:
  - Facebook
  - Instagram
  - Website
  - Google Business Profile
  - LinkedIn
  - Printed flyer
  - Exhibition banner
```

## Banner Families (reusable layout patterns)

**Rule:** never author a NEW layout from scratch when an existing family fits.

### Current Families

- **`premium_trade_banner`** — left-information + right-hero-image + bottom-cta. Used across joinery + staircase + kitchen · differentiated by brand colours + hero image + service list.
- **`hero-only_banner`** (future) — full-bleed hero image + minimal text overlay + CTA corner.
- **`grid_banner`** (future) — 4-panel grid showcasing multiple products.
- **`portrait_social_banner`** (future) — 4:5 or 9:16 aspect for Instagram/TikTok stories.
- **`business_card`** (future) — small-format identity + contact template.

### Family Inheritance

A banner_family declaration specifies:
- The SHARED LAYOUT (positions + dimensions of every zone).
- The VARIABLES (brand colours · hero image · headline · feature list · service icons · CTA content).

When authoring a new banner in an existing family, Nex reuses the layout + rules from the family and only stores the variable content.

## Style Taxonomy

Every banner declares style tags for retrieval + recommendation:

- **Modern Contemporary** — clean · minimal · handleless · matt finishes
- **Modern Industrial** — black steel · exposed brick · oak · matte black
- **Luxury Architectural** — floating · frameless glass · walnut · dark stone · double-height
- **Traditional British** — oak · white spindles · turned newels · painted walls · closed string
- **Farmhouse** — painted cabinets · stone · timber worktops · Belfast sink
- **Scandinavian** — pale oak · white · minimal · natural
- **Coastal** — light · white · rope · pale timber
- **Heritage / Restoration** — carved detail · in-frame · classical proportions

When a user asks *"traditional oak staircase for my Victorian home"*, Nex retrieves all banners + reference images + articles tagged `Traditional British` — a connected design ecosystem where marketing assets · product knowledge · style guidance all reinforce each other.

## The Editable Region Contract

Every editable region declares WHAT can go there and HOW.

```yaml
editable_regions:
  - id: cta_box
    purpose: [WhatsApp Number, QR Code, Website, Offer]
    coordinates: {x, y, width, height}
    safe_area: {x, y, width, height}
    background: colour or gradient
    preferred_text_colour: colour
    disallowed_content: [Large Image, Long Paragraph]
    recommended_font: font family
    minimum_font_size: 16pt
    alignment: centre | left | right
    maximum_lines: n
    padding: 20px
    allow_resize: true|false
```

When a customer says *"Add my WhatsApp"*, Nex knows:
- CTA Box → Bottom Right → white text → 18-22pt → centre aligned → add WhatsApp icon → keep 20px padding.
- No guessing. Predictable output every time.

## Design Rules (mandatory per template)

Every template carries a list of do's and don'ts that Nex enforces when personalising:

- Never cover the hero product.
- Keep contact details in the dedicated CTA box.
- Preserve the colour palette.
- Maintain visual hierarchy (headline → benefits → hero → contact → CTA).
- Preserve safe margins around every element.
- Use consistent fonts.

## Marketing Goal + Recommended Platforms

Every banner declares:
- **Marketing Goal** — generate leads · build trust · showcase craftsmanship · brand awareness · promotional offer.
- **Recommended Platforms** — where the banner is intended to be published (Facebook · Instagram · LinkedIn · Website · Print · Exhibition).

This lets Nex answer *"give me a Facebook banner for my staircase company"* by filtering `template_family = premium_trade_banner AND industry contains staircase AND Facebook in recommended_platforms`.

## Composition with Existing Systems

- **Knowledge Layer** — banners stored as knowledge items with `subject_domain: marketing_banner`. Retrieval via existing `retrieve()` API using `filters.item_types: ["image"]` + banner-specific tags.
- **Image Manifest (ADR-0024)** — every banner in the manifest with rich description + tags + editable_regions in description.
- **Recommendation Engine (Phase D.6)** — when a marketing query fires, Nex recommends banners from the manifest filtered by industry + style.
- **Design Pattern Library** — banners are treated as design patterns · pairs with · avoid rules apply.

## What This Enables

When a homeowner uploads a photo of their staircase and asks *"design me a marketing banner"*, Nex:

1. Identifies the staircase style from the photo (Traditional British · Modern Contemporary · etc.)
2. Retrieves a matching banner from the `premium_trade_banner` family with matching style tags.
3. Preserves the layout + design rules.
4. Swaps the hero image for the customer's photo (respecting hero_image editable region rules).
5. Fills the CTA box with the customer's WhatsApp/website (respecting allowed_content).
6. Delivers a customised banner that FEELS like it was designed for them.

**No design work needed. Just template + intelligence + customer content.**

## What This Does NOT Do (yet)

- Does not include a full Domain 003 · Marketing Design Intelligence (deferred per Philip's guidance).
- Does not include a runtime banner personalisation engine (image compositing · text overlay). That's a future runtime.
- Does not cover all marketing template types (business cards · vehicle graphics · exhibition stands · social posts · email headers · YouTube thumbnails). Only banners so far.

Those are future extensions of this doctrine.

## Governance

- Every banner authored from today onwards MUST include the full metadata schema in its manifest description.
- Every banner MUST declare a `banner_family` (reuse existing or propose new to Philip).
- Every banner MUST declare `subject_domain: marketing_banner` (not "staircase" or "kitchen") to avoid polluting product-reference galleries.
- Every banner MUST cite `cross_domain_reference` to the featured product domain(s) so retrieval can find it from either angle.

## Composition Summary

- **Rule c (Attributable Origin)** — every template Philip-authored or Philip-approved.
- **ADR-0024 (Image Manifest Rule)** — every template has a manifest row.
- **ADR-0028 (Master Knowledge Engine)** — templates carry rich metadata for AI to understand, not just describe.
- **ADR-0033 (Quality Over Quantity)** — templates below score 70 stay draft.
- **Recommendation Engine** — future extension: when a marketing goal query fires, recommend the right template family + hero image + CTA content.
- **Foundation Brain 12 (Show-Don't-Tell)** — when Nex offers marketing help, surface the template image first.
