# Trade Operating System · Volume 2 · Part 8
## Build Order for Studios (Dependency Architecture)

**Audience:** Platform Architects, AI Engineers, Product Engineers
**Source:** ChatGPT design-brief architecture series, V2 Part 8.

---

## Philosophy

The biggest mistake SaaS platforms make: building features in the order **customers ask** for them.

Instead, build in the order **the platform depends** on them. Like building a house — you don't install the kitchen before pouring the foundations.

**Everything depends on Brand DNA.**

---

## The Brand Dependency Pyramid

```
                        Marketing
                    ───────────────
                    Social Media
                Website / App Builder
          Vehicle • Signage • Workwear
      Business Cards • Letterheads • Print
         Logo • Colours • Typography
             Brand DNA Foundation
```

Everything higher depends on everything below.

---

## Phase 1 — Foundation Layer ⭐⭐⭐⭐⭐

Without this, nothing else should exist.

```
Business Discovery
       ↓
Brand DNA
       ↓
Logo Studio
       ↓
Colours
       ↓
Typography
       ↓
Brand Guide
```

### Studio 1 — Business Discovery
**Purpose:** Build Brand DNA.
**Merchant answers:** Company name · Trade · Service area · Target market · Price level · Existing website · Existing logo · Portfolio photos.
**Outputs:** Brand DNA v1. Everything depends on this.

### Studio 2 — Logo Studio
**Depends on:** Company Name · Trade · Target Market · Brand Personality.
**Outputs:** Master Logo · SVG · PNG · Icon · Mono · Reverse · Favicon. Also updates Brand Tokens.

### Studio 3 — Colour Studio
**Depends on:** Trade · Positioning · Logo · Brand Personality.
**Outputs:** Primary · Secondary · Accent · CMYK · RGB · HEX · Pantone.

### Studio 4 — Typography Studio
**Depends on:** Brand Style · Trade · Premium Level.
**Outputs:** Heading Font · Body Font · Spacing · Hierarchy.

### Studio 5 — Brand Guide Studio (automatic)
**Depends on:** Logo · Colours · Typography.
**Outputs:** Brand Guide PDF · Logo Rules · Spacing Rules · Photography Rules · Usage Examples.

Brand Guide is the **first complete asset**.

---

## Phase 2 — Print Foundation ⭐⭐⭐⭐

Once identity exists.

- **Business Card** — needs Logo · Colours · Typography · Phone · Website · QR · Brand Guide → Front · Back · PDF · Print Ready
- **Letterhead** — Logo · Colours · Typography · Address · VAT · Registration
- **Quote** — Brand · Business Details · VAT · Terms · Logo
- **Invoice** — Quote · Letterhead · Business Details · Brand

**Invoice depends on Quote. Not vice versa.**

---

## Phase 3 — Vehicle Branding ⭐⭐⭐⭐⭐

Now Brand Identity is stable. Vehicle Studio becomes possible.

**Needs:** Logo · Photography · Colour Palette · Typography · Brand Guide · Vehicle Rules
**Outputs:** Transit · Vivaro · Trafic · Custom · Fleet · Rear · Front · Sides · Printer Pack

Vehicle depends on almost everything built earlier.

---

## Phase 4 — Website
**Needs:** Logo · Colours · Typography · Photography · Brand Voice · Business Details · SEO · CTA Style
**Outputs:** Landing Page · About · Gallery · Contact · Services · Mobile

## Phase 5 — Social Media
**Needs:** Logo · Photography · Brand Colours · Website · Marketing Tone
**Outputs:** Instagram · Facebook · YouTube · TikTok · LinkedIn

## Phase 6 — Workwear
**Needs:** Logo · Colours · Embroidery Rules · Print Rules
**Outputs:** Polo · Hoodie · Hi-Vis · Cap · Jacket

## Phase 7 — Signage
**Needs:** Logo · Typography · Vehicle · Brand Guide
**Outputs:** Shop Signs · Yard Signs · Site Boards · Reception · Window Graphics

---

## Phase 8 — Marketing ⭐⭐⭐⭐⭐

**Marketing comes LAST.** Most platforms build marketing first. That is backwards.

Marketing depends on everything.

**Needs:** Brand · Website · Photography · Social · Print · Logo · Colours · Target Audience · Business Goals
**Outputs:** Seasonal Campaigns · Facebook Ads · Google Ads · Leaflets · Referral Cards · Email Campaigns · Sales Packs

---

## Complete Dependency Graph

```
Business Discovery
        ↓
Brand DNA
        ↓
Logo
        ↓
Colours
        ↓
Typography
        ↓
Brand Guide
        ├───────────────┐
        ▼               ▼
Business Cards     Letterhead
        │               │
        ▼               ▼
Quote             Invoice
        │
        ├───────────────┐
        ▼               ▼
Vehicle          Website
        │               │
        ▼               ▼
Workwear        Social Media
        │               │
        └───────────────┐
                        ▼
                    Signage
                        │
                        ▼
                    Marketing
```

---

## Recommended Build Order for Development

If building Trade OS today:

**Phase 1 (MVP):** Business Discovery · Brand DNA · Logo · Colour · Typography · Brand Guide
**Phase 2:** Business Cards · Letterheads · Quote · Invoice
**Phase 3:** Vehicle Studio — this alone is worth launching
**Phase 4:** Website · Email Signature
**Phase 5:** Social · Photography
**Phase 6:** Workwear · Signage
**Phase 7:** Marketing Studio · Growth Studio · Advertising Studio

---

## Revenue Order (differs from dependency order)

Merchants usually **buy** in this order:

Logo → Van Wrap → Business Cards → Website → Workwear → Signage → Marketing → Advertising

**This is why Vehicle Studio is such a strong early commercial feature** even though it technically depends on identity work being done first. Ship the dependency chain internally so Vehicle Studio is ready by the time it's the merchant's second purchase.

---

## Dependency Matrix

| Studio | Depends On |
|-|-|
| Business Discovery | None |
| Brand DNA | Business Discovery |
| Logo | Brand DNA |
| Colour | Logo, Brand DNA |
| Typography | Brand DNA |
| Brand Guide | Logo, Colour, Typography |
| Business Cards | Brand Guide, Logo |
| Letterhead | Brand Guide |
| Quote | Letterhead |
| Invoice | Quote |
| Vehicle | Brand Guide, Logo, Colours, Typography |
| Website | Brand Guide, Photography, Brand Voice |
| Social | Website, Photography |
| Workwear | Logo, Colours |
| Signage | Logo, Vehicle |
| Marketing | Everything above |

---

## Parallel Generation Opportunities

Once Brand DNA is stable, several Studios generate in parallel:

```
             Brand Guide
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
 Business     Vehicle     Website
   Cards
      │           │           │
      └───────────┼───────────┘
                  ▼
            Marketing Assets
```

Significantly reduces overall generation time.

---

## Signature Addition — Asset Library Studio

Insert immediately after Brand Guide. Automatically creates + stores:

- Transparent logos
- Icon set
- Brand patterns
- Background textures
- Colour gradients
- Social profile images
- Watermarks
- Email signature assets
- Favicon set
- Print-safe logo variants

Every later Studio **reuses these** instead of recreating them.

**Reduces AI generation cost, improves consistency, and ensures every output shares the same visual DNA.** Long-term, the Asset Library becomes one of the most valuable components of the entire Trade OS.

---

## Networkers-specific implementation notes

- **The Van Wrap App manifest shipped in this slice** correctly declares `requires` for Logo + Colours + Typography + Brand Guide. Enforcement lives in `capabilityRegistry.execute()` — validates required brand fields before firing generator.
- **Build order tension resolved:** internally we build dependency-first (Discovery → Brand DNA → Logo → ...). Externally we market revenue-first (Van Wrap prominently featured). The Store surfaces Vehicle as a "Popular" bundle while the dependency graph ensures merchants have Logo + Colours filled before they can generate a van.
- **Asset Library Studio** becomes `src/apps/asset-library/` — third or fourth Studio to ship. Cheap AI cost + huge downstream value. All later Studios read from it before regenerating primitives.
- **Business Discovery Studio** = the 7-question flow from V1 Part 2 discussion, wired via `DiscoveryService` in the runtime interfaces. Populates Brand DNA v1 from merchant answers + Companies House inference + optional website scrape.
- **Parallel generation** implemented in the AI Orchestrator (V3 Q16, pending) — `generateBundle()` fires N independent App generators concurrently, each subscribed to the same Brand snapshot.
- **Dependency validation** already implemented in `capabilityRegistry.execute()` (this commit) — returns `missing_required_brand_field:<path>` when a required field isn't populated. Studio Store surfaces this as "Install Logo Studio first" per the UX spec.
