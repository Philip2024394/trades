# Trade Operating System · Volume 2 · Part 7
## Capability Store (formerly App Store)

**Audience:** Product Architects, Platform Engineers, UX Designers, AI Engineers
**Source:** ChatGPT design-brief architecture series, V2 Part 7.

---

## Philosophy

The first major decision: **stop calling them "Apps."**

"App Store" makes merchants think of downloading software. That's not what they're buying. **They're buying business outcomes.**

Instead call them:
- **Capability Store** (recommended for internal + technical language)
- **Business Builder** (recommended for merchant-facing UI copy — see final section)

Each capability extends the merchant's Brand OS.

### The Vision

Think of the Capability Store as **Adobe Creative Cloud + Shopify Apps + Apple App Store**, but every capability understands the merchant's Brand DNA.

```
                Brand DNA
                    ↓
          Capability Runtime
                    ↓
 ┌──────────┬────────────┬────────────┬────────────┐
 ▼          ▼            ▼            ▼
Vehicle   Marketing   Website     Documents
Studio     Studio      Studio      Studio
 ▼          ▼            ▼            ▼
Capabilities (Apps)
```

Every capability plugs into the same runtime.

---

## Home Screen

```
┌──────────────────────────────────────────────────────────────────┐
                    Capability Store
        Grow your business with AI-powered Studios

  [ Search capabilities... ]
──────────────────────────────────────────────────────────────────
  Featured
    Vehicle Branding    Website Builder    Business Starter Pack
──────────────────────────────────────────────────────────────────
  Categories
    Identity · Vehicles · Marketing · Website · Print · Office ·
    Growth · Photography · Advertising · AI
──────────────────────────────────────────────────────────────────
```

---

## 12 Categories

### 1. Identity Studio (foundation)
Logo Designer · Brand Guide · Colour Palette · Typography · Brand Voice · Photography Style · Design Tokens

### 2. Vehicle Studio
Van Wrap · Fleet Wraps · Pickup · Lorry · Trailer · Magnetic Signs · Reflective Kit · Chapter 8 Vehicles · Emergency Vehicles

### 3. Print Studio
Business Cards · Letterheads · Compliment Slips · Flyers · Brochures · Folders · Presentation Packs · Gift Vouchers

### 4. Documents Studio ⭐
Invoices · Quotes · Purchase Orders · RAMS · Method Statements · Risk Assessments · Certificates · Warranty Documents

**Incredibly valuable for UK trades** — RAMS + Risk Assessments + Certificates alone justify a Studio subscription for many merchants.

### 5. Workwear Studio
Polo Shirts · Hoodies · Hi-Vis · Jackets · Caps · Beanies · Safety Helmets · Tool Bags

### 6. Website Studio
Landing Pages · Company Website · One Page Site · Portfolio · Contact Page · Careers · Customer Portal

### 7. Marketing Studio
Facebook Ads · Instagram · TikTok · Google Ads · Seasonal Campaigns · Referral Cards · Email Campaigns · Door Drops

### 8. Social Studio
Facebook Covers · Instagram Posts · Instagram Stories · YouTube Banner · LinkedIn · Pinterest · X · Threads

### 9. Signage Studio
Yard Signs · Shop Signs · Vehicle Decals · Window Graphics · Reception Signs · Site Boards · Safety Boards · Exhibition Graphics

### 10. Office Studio
Email Signature · PowerPoint · Proposal Template · Company Profile · Presentation Deck · Document Covers

### 11. Photography Studio
Hero Images · AI Photography · Project Gallery · Before/After · Staff Photos · Product Photos · Site Photography

### 12. Growth Studio (subscription product)
Seasonal Ideas · Competitor Analysis · Brand Audit · SEO Suggestions · Lead Magnets · Customer Reviews · Campaign Planner · Monthly Growth Report

---

## Store Layout

Large visual cards. **Never lists.**

```
Identity
┌─────────────────────────┐  ┌─────────────────────────┐
│ Logo Designer  ★★★★★    │  │ Brand Guide  ★★★★★      │
│                         │  │                         │
│ [Installed]             │  │ [Installed]             │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────┐
│ Typography              │
│                         │
│ [Install]               │
└─────────────────────────┘
```

---

## Capability Card (uniform across every capability)

```
┌─────────────────────────────────┐
│ Van Wrap Studio                 │
│ ★★★★★                          │
│ 98% merchant satisfaction       │
│                                 │
│ Creates:                        │
│  ✓ Side                         │
│  ✓ Rear                         │
│  ✓ Front                        │
│  ✓ Fleet                        │
│  ✓ Print Pack                   │
│                                 │
│ Time   45 sec                   │
│ Price  Included                 │
│                                 │
│ [Open]                          │
└─────────────────────────────────┘
```

---

## Installed vs Available (very obvious)

**Installed:** `[Open]  [Update]`
**Available premium:** `£6.99  [Install]`

No confusion.

---

## Search — natural language

Merchant types `Van` → results:
- Van Wrap
- Fleet
- Magnetic Signs
- Reflective Kit

Also supports: Business Cards · Invoice · Christmas · Facebook · Website. Natural-language matching, not keyword search.

---

## Capability Detail Page

Click **Van Wrap**:

```
Vehicle Studio
★★★★★
Professional commercial wrap

Features
  ✓ AI Layout · ✓ Fleet · ✓ Side · ✓ Rear · ✓ Front · ✓ Print Files

Uses (from Brand DNA)
  Colours · Logo · Photography · Typography

Outputs
  PNG · SVG · PDF · Printer Pack

Time   42 seconds
Cost   Included

[Generate]
```

---

## AI Recommendations

The store recommends capabilities. Merchant has Van + Website + Cards → AI says:

> **Most merchants also install:**
> ✓ Workwear
> ✓ Yard Signs
> ✓ Email Signature

Exactly like Amazon.

---

## Dependency System

Capabilities know what they require.

**Website** needs: Logo · Colours · Typography · Brand Guide.

If missing: `Install Logo Studio first`.

### Capability Graph

```
Logo → Brand Guide → Colours → Typography → Photography → Vehicle → Website → Marketing
```

The Store understands + respects dependencies.

---

## Capability Manifest (aligns with V1 Part 3 App Manifest)

```ts
interface Capability {
  id:             string;
  name:           string;
  version:        string;
  category:       string;
  requires:       string[];
  produces:       string[];
  price:          number;
  installed:      boolean;
  rating:         number;
  estimatedTime:  number;
}
```

---

## Store AI (unique to Trade OS)

Merchant says: *"I need to advertise my plumbing business."*

Store responds:

> **Recommended Bundle**
> ✓ Facebook Ads
> ✓ Van Wrap
> ✓ Yard Sign
> ✓ Website Hero
> ✓ Google Ads
>
> [Install All]

No searching.

---

## Collections — sell business goals, not tools

### New Business
Logo · Business Cards · Website · Van · Email

### Get More Customers
Google Ads · Facebook · SEO · Landing Page · Review Cards

### Look Professional
Workwear · Vehicle · Signage · Brand Guide · Office

### Construction Starter
Van · Invoices · RAMS · Risk Assessments · Site Boards

### Seasonal Collections
Spring Promotions · Summer Campaign · Christmas Offers · Black Friday · Winter Maintenance

**One click installs everything.**

---

## Merchant Journey

```
Merchant
    ↓
Capability Store
    ↓
Install Vehicle Studio
    ↓
Generate Van
    ↓
Stored in Brand Vault
    ↓
AI Recommends Website
    ↓
Website Installed
    ↓
AI Recommends Marketing
    ↓
Merchant Grows
```

Every capability leads naturally to the next.

---

## Smart Upsell (never "Buy More")

Instead:

> Your new van wrap is ready.
> Would you like matching:
> ✓ Business Cards
> ✓ Website Hero
> ✓ Hoodie
>
> [Generate All]

Feels like **good service**, not sales.

---

## Ratings — business outcomes not stars

```
★★★★★
Saved merchants        14 hours
Average approval       97%
Average generation     41 seconds
```

More meaningful than "4.7 stars from 200 reviews".

---

## Recommendation — call it "Business Builder"

Because that's what merchants actually think they're buying.

Instead of: *"Install Van Wrap App"* → *"Build my vehicle branding."*
Instead of: *"Install Office Studio"* → *"Create professional business documents."*

**Sell the result, not the software.**

---

## Signature Feature — Business Roadmap

Progress path per merchant:

```
Business Brand
██████████ 100%

Vehicle Branding
██████░░░░ 60%

Website
███░░░░░░░ 30%

Marketing
░░░░░░░░░░ 0%

Workwear
░░░░░░░░░░ 0%

Office Documents
████████░░ 80%

Overall Business Completion  68%
```

Clicking any incomplete section opens the exact capability needed to finish it.

**This transforms the platform from a collection of tools into a guided system that helps merchants build a complete professional business identity over time.**

---

## Networkers-specific implementation notes

- **UI copy convention:** merchant-facing surfaces use "Business Builder" and Studio names. Internal code, docs, and admin surfaces use "Capability Store" for architectural clarity.
- **12 categories = 12 top-level Studios** already spec'd in the UI Interface doc left-nav. Aligns.
- **Capability Manifest matches V1 Part 3** `StudioAppManifest`. The `Capability` interface above is the merchant-store-facing subset (surface data only). One manifest, two projections.
- **AI Recommendations** driven by Mate's proactive engine + the App dependency graph. New Mate tool `recommend_capabilities` that reads the merchant's installed set + brand completeness score → returns the next 3-5 capabilities.
- **Collections** (New Business / Get More Customers / etc) live as `hammerex_capability_collections` — a curated table of bundle definitions, admin-editable. Adding new collections requires no code change.
- **Dependency validation** enforced at install time — Capability Registry rejects install if `requires[]` are unmet. Prompts user to install prerequisites first.
- **Business Roadmap** widget mounts on the Brand Vault home screen (V2 Part 5 Zone 6 area). Computed from `hammerex_capability_installations` per merchant vs the full Studio taxonomy.
- **Route:** `/studio/store` (new). Existing `/studio/apps` route redirects here to preserve link continuity.
