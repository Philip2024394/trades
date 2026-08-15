# NEX Section Inventory · 2026-08-14

_Design System Finalisation · audit reflecting the library as-is. No section has been redesigned or added during this audit._

- **Total registered sections**: 51
- **Libraries**: 20
- **Proposed design families**: 5
- **Latent SSR-unsafe sections** (no `.meta.ts` sidecar): **23** (see Phase 19D — these render a different section in SSR than in standalone tsx via the library-fallback path)
- **Enumeration timestamp**: 2026-08-14T13:00:55.872Z

Live review surface: [`/nex-app/design-system/inventory`](http://localhost:3008/nex-app/design-system/inventory) (dev-only)

---

## Proposed families

- **Trust-First** (5) — Minimal · fast-load · image-optional · trust-signals dominant. Best for trades where credentials + response speed sell.
- **Editorial** (4) — Full-bleed photography · sophisticated typography. Best for architectural / luxury / portfolio-led businesses.
- **Trade-Native** (9) — Service-area · postcode · product-grid · local utility. Best for local trades whose USP is coverage + inventory.
- **Interactive** (7) — Motion-heavy · animated · video · kinetic. Best for businesses competing on modernity + energy.
- **Utility & Content** (26) — Every non-hero building block. Composes into any of the 4 hero families.

> ⚠ Family assignments are a proposal derived from existing metadata (telemetryTags, section id, library). Owner approves/renames/re-tags. Sections marked _Uncategorised_ need a decision.

---

## Trust-First · 5 sections

> Minimal · fast-load · image-optional · trust-signals dominant. Best for trades where credentials + response speed sell.

### `hero.badge_wall_1` · Accreditation Badge Wall Hero

Trust-first hero for regulated trades. Renders up to 8 accreditation badges as embossed metallic emblems. Perfect for gas, electrical, structural, roofing.

_**⚠ SSR-unsafe** · 30 editable fields · 4 AI-promptable_

![Accreditation Badge Wall Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.badge_wall_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Accreditation Badge Wall Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.badge_wall_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/badgeWall.tsx` |
| Category | hero |
| Best-for | gas-engineer, electrician, boiler-engineer, roofer, structural-engineer, scaffolder, plumber, asbestos-remover |
| Telemetry tags | `hero` `trust` `badges` `regulated-trades` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `supportingCopy` · `badge1Name` · `badge1Tier` · `badge1Number` · `badge2Name` · `badge2Tier` · `badge2Number` |

---

### `hero.minimal_centred_1` · Minimal centred hero

Photo-free, typography-first hero. Two CTAs, optional trust row. Fastest to load and reads perfectly on any screen — best for service trades where speed matters (emergency call-outs, plumbing, electrical).

_server-safe · 9 editable fields · 3 AI-promptable_

![Minimal centred hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.minimal_centred_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Minimal centred hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.minimal_centred_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/minimalCentred.tsx` |
| Category | hero |
| Best-for | plumbing, electrical, hvac, glazing, locksmith, boiler_repair, drain_clearance |
| Telemetry tags | `hero` `minimal` `centred` `typography_first` `no_photo` `two_cta` `trust_row` `fast_load` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `showTrustRow` · `trustItems` |

---

### `hero.stat_hero_1` · Stat-anchor hero

Data-forward hero anchored by 3 big stats (jobs / rating / years). Display headline below, dual CTA. shadcn Button + Framer Motion staggered entrance. Banner proportions on desktop. Best for merchants whose story is scale + longevity.

_`.meta ✓` · 16 editable fields · 2 AI-promptable_

![Stat-anchor hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.stat_hero_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Stat-anchor hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.stat_hero_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 3.0.0 |
| Source | `src/lib/studio/sections/hero/statHero.meta.ts` |
| Category | hero |
| Best-for | extension-builder, landscaper, roofer, commercial-roofing, structural-engineer, chartered-surveyor |
| Telemetry tags | `hero` `stats` `data_forward` `shadcn` `framer_motion` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `responseCommitment` · `stat1Value` · `stat1Label` · `stat2Value` · `stat2Label` |

---

### `hero.trust_anchor_1` · Trust Anchor Hero

Full-bleed photography hero with editorial 2-col + floating glass trust card on shadcn Card + Framer Motion. Mobile: banner-shaped stack. Desktop: 1600×800 banner with rating card. Best for trust-forward trades.

_`.meta ✓` · 19 editable fields · 5 AI-promptable · 1 image slot_

![Trust Anchor Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.trust_anchor_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Trust Anchor Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.trust_anchor_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 3.0.0 |
| Source | `src/lib/studio/sections/hero/trustAnchor.meta.ts` |
| Category | hero |
| Themes | modern, corporate, luxury |
| Best-for | electrician, plumber, gas-engineer, roofer, boiler-installer, kitchen-fitter, bathroom-fitter |
| Responsive | mobile: stack · tablet: stack · desktop: split_60_40 |
| Telemetry tags | `hero` `trust` `reviews` `full-bleed` `editorial` `shadcn` `framer_motion` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `backgroundImageUrl` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `responseCommitment` · `ratingValue` · `ratingReviewCount` · `ratingLabel` |

---

### `hero.trust_minimal_1` · Trust-first minimal hero

Clean centred hero on shadcn/ui + Framer Motion foundation. Trust chip at the top, big display headline, subhead, stacked dual CTA. Choreographed entrance animations respect prefers-reduced-motion. Accent from merchant theme token. Built for service-trust trades.

_`.meta ✓` · 10 editable fields · 3 AI-promptable_

![Trust-first minimal hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.trust_minimal_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Trust-first minimal hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.trust_minimal_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 2.0.0 |
| Source | `src/lib/studio/sections/hero/trustMinimal.meta.ts` |
| Category | hero |
| Themes | modern, corporate, minimal, creative |
| Best-for | electrician, plumber, gas-engineer, heating-engineer, hvac-contractor, locksmith, handyman, chimney-sweep |
| Responsive | mobile: stack · tablet: stack · desktop: grid_2 |
| Telemetry tags | `hero` `minimal` `centred` `trust_first` `no_photo` `dual_cta` `mobile_perfect` `shadcn` `framer_motion` |
| Editable field keys | `trustLabel` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `responseCommitment` · `visualEffect` · `surface` |

---

## Editorial · 4 sections

> Full-bleed photography · sophisticated typography. Best for architectural / luxury / portfolio-led businesses.

### `hero.magazine_editorial_1` · Editorial Magazine Hero

Premium magazine-spread hero with serif italic headline, drop-cap lead, pull-quote and portrait-crop photo. For high-end trades: bespoke kitchens, extensions, garden design.

_**⚠ SSR-unsafe** · 13 editable fields · 6 AI-promptable_

![Editorial Magazine Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.magazine_editorial_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Editorial Magazine Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.magazine_editorial_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/magazineEditorial.tsx` |
| Category | hero |
| Best-for | bespoke-kitchen, interior-designer, garden-designer, extension-builder, luxury-bathroom-fitter, carpenter, joiner, showroom |
| Telemetry tags | `hero` `editorial` `premium` `serif` |
| Editable field keys | `issue` · `section` · `credit` · `eyebrow` · `heading` · `subheading` · `bodyLead` · `primaryCtaLabel` · `primaryCtaHref` · `pullQuote` · `pullQuoteAuthor` · `heroImageUrl` |

---

### `hero.portfolio_mosaic_1` · Portfolio Mosaic Hero

6-photo mosaic background with centred copy. Built for visual trades whose portfolio is the pitch — builders, kitchen fitters, landscape designers, tilers.

_`.meta ✓` · 17 editable fields · 5 AI-promptable_

![Portfolio Mosaic Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.portfolio_mosaic_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Portfolio Mosaic Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.portfolio_mosaic_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/portfolioMosaic.meta.ts` |
| Category | hero |
| Best-for | builder, kitchen-fitter, bathroom-fitter, tiler, landscape-designer, decorator, carpenter, roofer … |
| Telemetry tags | `hero` `portfolio` `visual` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `photo1` · `photo2` · `photo3` · `photo4` · `photo5` |

---

### `hero.product_showroom_1` · Merchant Product Showroom Hero

Storefront-first hero for building merchants, tool suppliers, materials yards. Product grid on the right, copy + trade-account CTA + delivery chip on the left.

_`.meta ✓` · 25 editable fields · 5 AI-promptable_

![Merchant Product Showroom Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.product_showroom_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Merchant Product Showroom Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.product_showroom_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/productShowroom.meta.ts` |
| Category | hero |
| Best-for | building-merchant, builders-supplies, tool-hire, materials-yard, kitchen-showroom, bathroom-showroom, timber-merchant |
| Telemetry tags | `hero` `merchant` `product-grid` `trade-account` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `deliveryChip` · `tradeAccountChip` · `product1Image` · `product1Label` · `product1Badge` |

---

### `hero.split_photo_left_1` · Split photo hero

Full-bleed 50/50 editorial split on shadcn foundation. Photo left edge-to-edge on desktop; mobile: photo banner + tight content card + bottom CTA stack. Banner proportions (1600×800). Framer Motion staggered entrance.

_`.meta ✓` · 15 editable fields · 4 AI-promptable · 1 image slot_

![Split photo hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.split_photo_left_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Split photo hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.split_photo_left_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 3.0.0 |
| Source | `src/lib/studio/sections/hero/splitPhotoLeft.meta.ts` |
| Category | hero |
| Themes | modern, creative, minimal, luxury |
| Best-for | landscaper, landscape-gardener, garden-designer, carpenter, joiner, tiler, roofer, flat-roofing … |
| Responsive | mobile: stack · tablet: stack · desktop: split_50_50 |
| Telemetry tags | `hero` `split_layout` `photo_left` `shadcn` `framer_motion` `banner` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `responseCommitment` · `imageUrl` · `imageAlt` · `showRating` · `ratingText` |

---

## Trade-Native · 9 sections

> Service-area · postcode · product-grid · local utility. Best for local trades whose USP is coverage + inventory.

### `hero.before_after_slider_1` · Before/After Slider Hero

Interactive draggable slider revealing before/after photos of real work. Zero words needed. Perfect for painters, roofers, cleaners, restorers, tilers.

_**⚠ SSR-unsafe** · 14 editable fields · 5 AI-promptable_

![Before/After Slider Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.before_after_slider_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Before/After Slider Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.before_after_slider_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/beforeAfterSlider.tsx` |
| Category | hero |
| Best-for | painter, roofer, cleaner, restorer, tiler, landscape-designer, driveway-installer, carpet-cleaner |
| Telemetry tags | `hero` `interactive` `slider` `portfolio` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `beforeImageUrl` · `afterImageUrl` · `beforeLabel` · `afterLabel` · `jobDescription` |

---

### `hero.chat_bubble_hero_1` · WhatsApp Chat Hero

Show-don't-tell hero: renders a realistic WhatsApp conversation preview so customers see exactly what tapping the CTA produces.

_**⚠ SSR-unsafe** · 19 editable fields · 4 AI-promptable_

![WhatsApp Chat Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.chat_bubble_hero_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![WhatsApp Chat Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.chat_bubble_hero_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/chatBubbleHero.tsx` |
| Category | hero |
| Best-for | plumber, electrician, boiler-engineer, carpenter, roofer, cleaner, landscaper, handyman |
| Telemetry tags | `hero` `whatsapp` `chat` `show-dont-tell` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `ctaLabel` · `ctaHref` · `supportingCopy` · `customerName` · `customerAvatarUrl` · `onlineStatus` · `msg1Customer` · `msg1Time` · `msg2Merchant` |

---

### `hero.compare_hero_1` · Independent-vs-Corporate Compare Hero

Side-by-side comparison hero for independent trades competing with corporate chains. Every row is a real customer pain point solved by using an independent.

_**⚠ SSR-unsafe** · 16 editable fields · 4 AI-promptable_

![Independent-vs-Corporate Compare Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.compare_hero_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Independent-vs-Corporate Compare Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.compare_hero_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/compareHero.tsx` |
| Category | hero |
| Best-for | boiler-engineer, plumber, electrician, locksmith, drainage, damp-proofing, glazier |
| Telemetry tags | `hero` `compare` `positioning` `independent` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `usColumnLabel` · `themColumnLabel` · `row1` · `row2` · `row3` · `row4` · `row5` · `row6` · `primaryCtaLabel` |

---

### `hero.emergency_247_1` · 24/7 Emergency Hero

High-conversion hero for reactive trades. Massive Call Now button (60px tall), pulsing response-time chip, dark surface with urgent-colour glow. shadcn Button + Framer Motion. Optimised for panicking 2am customers.

_`.meta ✓` · 11 editable fields · 2 AI-promptable_

![24/7 Emergency Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.emergency_247_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![24/7 Emergency Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.emergency_247_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 3.0.0 |
| Source | `src/lib/studio/sections/hero/emergency247.meta.ts` |
| Category | hero |
| Best-for | emergency-roofing, plumber-emergency, locksmith, boiler-repair, electrician-emergency, recovery-service |
| Telemetry tags | `hero` `emergency` `24_7` `urgency` `shadcn` `framer_motion` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `callPhoneNumber` · `callCtaLabel` · `whatsappCtaLabel` · `responseTime` · `responseTimeLabel` · `coverageArea` · `urgencyAccent` · `visualEffect` |

---

### `hero.map_hero_1` · Coverage Map Hero

Location-first hero with a pure-SVG coverage map (rings + pins + pulsing beacon). Answers 'do you cover me?' instantly. Zero external map API.

_**⚠ SSR-unsafe** · 12 editable fields · 4 AI-promptable_

![Coverage Map Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.map_hero_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Coverage Map Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.map_hero_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/mapHero.tsx` |
| Category | hero |
| Best-for | plumber, electrician, boiler-engineer, mobile-mechanic, locksmith, building-merchant, plant-hire, landscaper |
| Telemetry tags | `hero` `map` `local` `coverage` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `backgroundImageUrl` · `locationLabel` · `pingXPercent` · `pingYPercent` · `chip1` · `chip2` · `chip3` |

---

### `hero.plant_hire_bold_1` · Bold trade hero

Bold industrial hero for plant hire + heavy-equipment merchants. Full-bleed background photo, dark surface, big display headline, dual CTA. Banner proportions on desktop. shadcn Button + Framer Motion.

_**⚠ SSR-unsafe** · 12 editable fields · 3 AI-promptable_

![Bold trade hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.plant_hire_bold_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Bold trade hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.plant_hire_bold_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 3.0.0 |
| Source | `src/lib/studio/sections/hero/plantHireBold.tsx` |
| Category | hero |
| Best-for | plant-hire, tool-hire, aggregate-supplier, concrete-supplier, skip-hire, building-merchant, commercial-vehicle-hire |
| Telemetry tags | `hero` `bold` `photo` `industrial` `shadcn` `framer_motion` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `backgroundImageUrl` · `overlayOpacity` · `showTrustBadge` · `trustBadgeText` · `visualEffect` |

---

### `hero.postcode_local_1` · Postcode-Local Hero

Search-first hero with big postcode input + 3 trust chips. On submit packages postcode into WhatsApp message. Banner proportions on desktop. Best for coverage-critical local trades.

_`.meta ✓` · 12 editable fields · 2 AI-promptable_

![Postcode-Local Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.postcode_local_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Postcode-Local Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.postcode_local_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 3.0.0 |
| Source | `src/lib/studio/sections/hero/postcodeLocal.meta.ts` |
| Category | hero |
| Best-for | electrician, plumber, gas-engineer, mobile-mechanic, locksmith, handyman, cleaner |
| Telemetry tags | `hero` `postcode` `search` `local` `shadcn` `framer_motion` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `postcodePlaceholder` · `submitLabel` · `chip1` · `chip2` · `chip3` · `supportingCopy` · `backgroundImageUrl` · `backgroundImageOpacity` · `surface` |

---

### `hero.qr_poster_hero_1` · QR Poster Hero

Giant scannable QR code as the hero. Van-vinyl / business-card / yard-sign friendly. Scans straight into WhatsApp. Prints cleanly too.

_**⚠ SSR-unsafe** · 14 editable fields · 4 AI-promptable_

![QR Poster Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.qr_poster_hero_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![QR Poster Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.qr_poster_hero_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/qrPosterHero.tsx` |
| Category | hero |
| Best-for | plumber, electrician, boiler-engineer, gas-engineer, carpenter, locksmith, roofer, cleaner … |
| Telemetry tags | `hero` `qr` `print-ready` `offline-marketing` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `qrTargetUrl` · `qrCallout` · `brandDomain` · `ctaLabel` · `ctaHref` · `credential1` · `credential2` · `credential3` · `surface` |

---

### `hero.review_wave_1` · Review-Wave Hero

Social-proof hero with a live-scrolling marquee of real review snippets across the top strip. Rating badge anchors bottom-left.

_**⚠ SSR-unsafe** · 23 editable fields · 5 AI-promptable_

![Review-Wave Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.review_wave_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Review-Wave Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.review_wave_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/reviewWave.tsx` |
| Category | hero |
| Best-for | plumber, electrician, carpenter, kitchen-fitter, roofer, gas-engineer, landscape-designer |
| Telemetry tags | `hero` `reviews` `social-proof` `marquee` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `ratingValue` · `ratingCount` · `review1` · `review1Author` · `review2` |

---

## Interactive · 7 sections

> Motion-heavy · animated · video · kinetic. Best for businesses competing on modernity + energy.

### `hero.animated_gradient_1` · Animated Gradient Hero

Zero-image mesh-gradient hero. Slow-drifting colour blobs create depth without a single kilobyte of image data. Perfect for merchants without brand photography.

_**⚠ SSR-unsafe** · 13 editable fields · 6 AI-promptable_

![Animated Gradient Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.animated_gradient_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Animated Gradient Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.animated_gradient_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/animatedGradient.tsx` |
| Category | hero |
| Best-for | * |
| Telemetry tags | `hero` `gradient` `image-free` `fast-loading` |
| Editable field keys | `chipLabel` · `eyebrow` · `heading` · `headingAccentWord` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `gradientIntensity` · `darkOrLight` · `backgroundImageUrl` |

---

### `hero.animation_hero_1` · Animated Tool Hero

The signature trade hero: a giant animated tool (hammer swings, saw slides, wrench turns, drill bit spins, paintbrush sweeps) on the right, headline + CTAs on the left. Pure SVG + CSS.

_**⚠ SSR-unsafe** · 14 editable fields · 5 AI-promptable_

![Animated Tool Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.animation_hero_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Animated Tool Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.animation_hero_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/animationHero.tsx` |
| Category | hero |
| Best-for | carpenter, joiner, builder, plumber, electrician, painter, roofer, landscape-designer … |
| Telemetry tags | `hero` `animation` `trade-native` `signature` |
| Editable field keys | `eyebrow` · `heading` · `headingAccent` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `chip1` · `chip2` · `tool` · `animationSpeed` |

---

### `hero.cursor_spotlight_1` · Cursor Spotlight Hero

Interactive spotlight follows the cursor and lights up the copy underneath a nearly-black overlay. Custom cursor ring. Falls back to fully-lit on touch devices.

_**⚠ SSR-unsafe** · 17 editable fields · 5 AI-promptable_

![Cursor Spotlight Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.cursor_spotlight_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Cursor Spotlight Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.cursor_spotlight_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/cursorSpotlight.tsx` |
| Category | hero |
| Best-for | electrician, boiler-engineer, locksmith, gas-engineer, roofer, security-installer |
| Telemetry tags | `hero` `interactive` `spotlight` `cursor` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `beamRadius` · `beamIntensity` · `darknessLevel` · `backgroundImageUrl` · `imageOpacity` |

---

### `hero.marquee_scroll_1` · Marquee Scroll Hero

Editorial marquee. Three rows of massive typography scroll in alternating directions at independent speeds, with static copy anchored in the middle. Balenciaga aesthetic for trades.

_**⚠ SSR-unsafe** · 17 editable fields · 5 AI-promptable_

![Marquee Scroll Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.marquee_scroll_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Marquee Scroll Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.marquee_scroll_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/marqueeScroll.tsx` |
| Category | hero |
| Best-for | * |
| Telemetry tags | `hero` `marquee` `editorial` `type` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `row1Words` · `row1SpeedSec` · `row2Words` · `row2SpeedSec` · `row3Words` |

---

### `hero.text_kinetic_1` · Kinetic Typography Hero

Text-animation-first hero. Six selectable kinetic-typography styles: roll-up, fall-down, wipe-reveal, blur-focus, word-rotate, typewriter. Zero JS, pure CSS.

_**⚠ SSR-unsafe** · 17 editable fields · 6 AI-promptable_

![Kinetic Typography Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.text_kinetic_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Kinetic Typography Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.text_kinetic_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/textKineticHero.tsx` |
| Category | hero |
| Best-for | * |
| Telemetry tags | `hero` `typography` `animation` `kinetic` |
| Editable field keys | `eyebrow` · `headingPrefix` · `headingRotator` · `headingSuffix` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `animationStyle` · `animationSpeed` · `loop` |

---

### `hero.tilt_3d_1` · 3D Tilt Card Hero

Apple / Stripe aesthetic. A big card containing copy + floating mock product tilts in 3D based on cursor position. Glare reflection follows the cursor across the surface.

_**⚠ SSR-unsafe** · 17 editable fields · 5 AI-promptable_

![3D Tilt Card Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.tilt_3d_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![3D Tilt Card Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.tilt_3d_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/tilt3d.tsx` |
| Category | hero |
| Best-for | kitchen-fitter, bathroom-fitter, showroom, bespoke-kitchen, interior-designer, plant-hire, tool-hire, extension-builder |
| Telemetry tags | `hero` `3d` `tilt` `interactive` `premium` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `mockCardTitle` · `mockCardCategory` · `mockCardPrice` · `mockCardBadge` · `mockCardImageUrl` |

---

### `hero.video_background_1` · Video Background Hero

Cinematic full-bleed video hero with muted autoplay loop. Poster fallback + overlay gradient + trust ribbon. Perfect for trades with real on-site footage.

_**⚠ SSR-unsafe** · 14 editable fields · 5 AI-promptable_

![Video Background Hero · desktop](tmp-nex-qa-screenshots/design-inventory/hero/hero.video_background_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Video Background Hero · mobile](tmp-nex-qa-screenshots/design-inventory/hero/hero.video_background_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `hero` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/hero/videoBackground.tsx` |
| Category | hero |
| Best-for | landscape-designer, plant-hire, builder, kitchen-fitter, showroom, extension-builder, roofer, driveway-installer |
| Telemetry tags | `hero` `video` `cinematic` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `videoMp4Url` · `videoWebmUrl` · `posterImageUrl` · `overlayOpacity` · `ribbon1` |

---

## Utility & Content · 26 sections

> Every non-hero building block. Composes into any of the 4 hero families.

### `banner.ribbon_1` · Ribbon banner

Slim horizontal promo band on shadcn foundation. Icon + message + optional CTA link. Three styles: accent (branded), dark, light-bordered.

_**⚠ SSR-unsafe** · 5 editable fields · 1 AI-promptable_

![Ribbon banner · desktop](tmp-nex-qa-screenshots/design-inventory/banner/banner.ribbon_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Ribbon banner · mobile](tmp-nex-qa-screenshots/design-inventory/banner/banner.ribbon_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `banner` |
| Version | 2.0.0 |
| Source | `src/lib/studio/sections/banner/ribbon.tsx` |
| Category | banner |
| Best-for | electrician, plumber, gas-engineer, emergency-callout, hvac-contractor, roofer |
| Telemetry tags | `banner` `ribbon` `promo` `shadcn` |
| Editable field keys | `icon` · `message` · `ctaLabel` · `ctaHref` · `style` |

---

### `brands.strip_1` · Brand logo strip

8-cell horizontal strip for accreditations, memberships, or supplier / manufacturer partners. Greyscale by default so mixed-colour logos look coherent. Empty slots in edit mode show a placeholder chip.

_**⚠ SSR-unsafe** · 20 editable fields · 1 AI-promptable_

![Brand logo strip · desktop](tmp-nex-qa-screenshots/design-inventory/brands/brands.strip_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Brand logo strip · mobile](tmp-nex-qa-screenshots/design-inventory/brands/brands.strip_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `brands` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/brands/strip.tsx` |
| Category | brands |
| Best-for | plumbing, electrical, hvac, boiler_repair, gas_safe, roofing, plant_hire, tool_hire … |
| Telemetry tags | `brands` `strip` `logos` `eight_slots` `greyscale` |
| Editable field keys | `eyebrow` · `heading` · `b1LogoUrl` · `b1Alt` · `b2LogoUrl` · `b2Alt` · `b3LogoUrl` · `b3Alt` · `b4LogoUrl` · `b4Alt` · `b5LogoUrl` · `b5Alt` |

---

### `addon.trade_connections` · Trade Connections

Local trades who install products in this category. Auto-scroll carousel. Appearance only.

_server-safe · 8 editable fields · 2 AI-promptable_

![Trade Connections · desktop](tmp-nex-qa-screenshots/design-inventory/categories/addon.trade_connections__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Trade Connections · mobile](tmp-nex-qa-screenshots/design-inventory/categories/addon.trade_connections__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `categories` |
| Version | 1.0.0 |
| Source | `(unknown)` |
| Category | categories |
| Best-for | building-merchant, builders-supplies, tool-hire, materials-yard |
| Telemetry tags | `addon` `trade_connections` |
| Editable field keys | `heading` · `helperCopy` · `disclaimerCopy` · `headingColor` · `helperColor` · `background` · `cardRadius` · `gridColumns` |

---

### `categories.grid_1` · Categories grid

Six category tiles for top-level navigation. Image, name, optional item count, link. Best for merchants with a range wide enough to warrant hub pages — plant hire (excavators / dumpers / rollers), builders' merchant (bricks / timber / insulation), tool hire.

_server-safe · 26 editable fields · 7 AI-promptable_

![Categories grid · desktop](tmp-nex-qa-screenshots/design-inventory/categories/categories.grid_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Categories grid · mobile](tmp-nex-qa-screenshots/design-inventory/categories/categories.grid_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `categories` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/categories/grid.tsx` |
| Category | categories |
| Best-for | plant_hire, tool_hire, building_merchant, key_cutting, spare_parts, hardware |
| Telemetry tags | `categories` `grid` `six_tiles` `navigation` `hub_pages` |
| Editable field keys | `eyebrow` · `heading` · `c1ImageUrl` · `c1Name` · `c1Count` · `c1Href` · `c2ImageUrl` · `c2Name` · `c2Count` · `c2Href` · `c3ImageUrl` · `c3Name` |

---

### `contact.split_1` · Contact · split

Contact form + panel side-by-side on shadcn Card + Framer Motion. Form left, WhatsApp + phone + email + hours cards right. Mobile: stacks. Desktop: 60/40 grid.

_`.meta ✓` · 17 editable fields · 2 AI-promptable_

![Contact · split · desktop](tmp-nex-qa-screenshots/design-inventory/contact/contact.split_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Contact · split · mobile](tmp-nex-qa-screenshots/design-inventory/contact/contact.split_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `contact` |
| Version | 2.0.0 |
| Source | `src/lib/studio/sections/contact/split.meta.ts` |
| Category | contact |
| Best-for | electrician, plumber, gas-engineer, hvac-contractor, handyman, landscaper, extension-builder |
| Telemetry tags | `contact` `form` `split` `shadcn` `framer_motion` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `formActionUrl` · `namePlaceholder` · `emailPlaceholder` · `phonePlaceholder` · `messagePlaceholder` · `showPhoneField` · `submitLabel` · `consentLine` · `whatsappCtaLabel` |

---

### `addon.ai_visualiser` · AI Visualiser

Homeowners see their renovation on their own space. Every render captures a name / email / WhatsApp / postcode lead — straight to your inbox.

_server-safe · 3 editable fields · 1 AI-promptable_

![AI Visualiser · desktop](tmp-nex-qa-screenshots/design-inventory/cta/addon.ai_visualiser__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![AI Visualiser · mobile](tmp-nex-qa-screenshots/design-inventory/cta/addon.ai_visualiser__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `cta` |
| Version | 1.0.0 |
| Source | `(unknown)` |
| Category | cta |
| Best-for | kitchen-fitter, bathroom-fitter, staircase-manufacturer, door-supplier, window-installer, flooring-installer, landscaper, driveway-installer … |
| Telemetry tags | `addon` `ai_visualiser` |
| Editable field keys | `size` · `headlineNoun` · `previewImageUrl` |

---

### `checkout.stack_1` · Checkout stack

Amount + product summary on the left, stack of payment buttons on the right. Merchant picks which providers to offer via a pipe-separated variant list.

_**⚠ SSR-unsafe** · 12 editable fields · 4 AI-promptable_

![Checkout stack · desktop](tmp-nex-qa-screenshots/design-inventory/cta/checkout.stack_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Checkout stack · mobile](tmp-nex-qa-screenshots/design-inventory/cta/checkout.stack_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `cta` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/cta/checkoutStack.tsx` |
| Category | cta |
| Best-for | * |
| Telemetry tags | `checkout` `payment` `cta` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `productName` · `amountMinor` · `currency` · `orderRef` · `description` · `returnUrl` · `cancelUrl` · `providerButtons` · `trustLine` |

---

### `cta.centred_1` · Centred CTA

One purpose, one action. Small kicker, big headline, sub-line, main button, optional second button. Best near the bottom of a page or between two long sections.

_server-safe · 9 editable fields · 3 AI-promptable_

![Centred CTA · desktop](tmp-nex-qa-screenshots/design-inventory/cta/cta.centred_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Centred CTA · mobile](tmp-nex-qa-screenshots/design-inventory/cta/cta.centred_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `cta` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/cta/centred.tsx` |
| Category | cta |
| Best-for | plumbing, electrical, hvac, landscaping, roofing, joinery |
| Telemetry tags | `cta` `centred` `typography_first` `two_cta` `trust_line` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `primaryCtaLabel` · `primaryCtaHref` · `secondaryCtaLabel` · `secondaryCtaHref` · `showTrustLine` · `trustLine` |

---

### `cta.compact_band_1` · Compact CTA band

Compact accent-tinted CTA band on shadcn Button + Framer Motion. Filled variant = solid accent surface matching the mockup's red band; outlined = soft bordered card.

_**⚠ SSR-unsafe** · 6 editable fields · 2 AI-promptable_

![Compact CTA band · desktop](tmp-nex-qa-screenshots/design-inventory/cta/cta.compact_band_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Compact CTA band · mobile](tmp-nex-qa-screenshots/design-inventory/cta/cta.compact_band_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `cta` |
| Version | 2.0.0 |
| Source | `src/lib/studio/sections/cta/compactBand.tsx` |
| Category | cta |
| Best-for | electrician, plumber, gas-engineer, emergency-callout, hvac-contractor, locksmith |
| Telemetry tags | `cta` `band` `compact` `high_contrast` `shadcn` `framer_motion` |
| Editable field keys | `heading` · `subheading` · `ctaLabel` · `ctaHref` · `ctaIcon` · `variant` |

---

### `faq.accordion_1` · FAQ Accordion

Expandable Q&A on shadcn Accordion (Radix). Proper keyboard nav + aria-expanded semantics. 6 Q&A slots; blueprints can also seed a preseed array. Framer Motion entrance choreography.

_`.meta ✓` · 16 editable fields · 13 AI-promptable_

![FAQ Accordion · desktop](tmp-nex-qa-screenshots/design-inventory/faq/faq.accordion_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![FAQ Accordion · mobile](tmp-nex-qa-screenshots/design-inventory/faq/faq.accordion_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `faq` |
| Version | 2.0.0 |
| Source | `src/lib/studio/sections/faq/accordion.meta.ts` |
| Category | faq |
| Themes | all |
| Best-for | all |
| Responsive | mobile: collapse · tablet: collapse · desktop: collapse |
| Telemetry tags | `faq` `accordion` `questions` `shadcn` `radix` `framer_motion` |
| Editable field keys | `eyebrow` · `heading` · `useKnowledgeGraph` · `q1` · `a1` · `q2` · `a2` · `q3` · `a3` · `q4` · `a4` · `q5` |

---

### `features.icon_grid_1` · Feature icon grid

4-cell 'why us' grid on shadcn Card + Framer Motion. Supports both fixed feature1..4 slots AND clean items[] array. Mobile: stacked; Tablet: 2-col; Desktop: 4-col.

_**⚠ SSR-unsafe** · 15 editable fields · 5 AI-promptable_

![Feature icon grid · desktop](tmp-nex-qa-screenshots/design-inventory/features/features.icon_grid_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Feature icon grid · mobile](tmp-nex-qa-screenshots/design-inventory/features/features.icon_grid_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `features` |
| Version | 3.0.0 |
| Source | `src/lib/studio/sections/features/iconGrid.tsx` |
| Category | features |
| Best-for | electrician, plumber, gas-engineer, hvac-contractor, roofer, landscaper, extension-builder |
| Telemetry tags | `features` `icon_grid` `shadcn` `framer_motion` |
| Editable field keys | `eyebrow` · `heading` · `feature1Icon` · `feature1Label` · `feature1Body` · `feature2Icon` · `feature2Label` · `feature2Body` · `feature3Icon` · `feature3Label` · `feature3Body` · `feature4Icon` |

---

### `features.three_up_reasons_1` · Three-up reasons (Why choose us)

Three-item value-prop grid on shadcn Card + Framer Motion. Circular Lucide icon + title + short body per item. Mobile: card-stacked; Desktop: 3-col grid. Ideal for 'Why choose us' below the trust bar.

_**⚠ SSR-unsafe** · 14 editable fields · 5 AI-promptable_

![Three-up reasons (Why choose us) · desktop](tmp-nex-qa-screenshots/design-inventory/features/features.three_up_reasons_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Three-up reasons (Why choose us) · mobile](tmp-nex-qa-screenshots/design-inventory/features/features.three_up_reasons_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `features` |
| Version | 2.0.0 |
| Source | `src/lib/studio/sections/features/threeUpReasons.tsx` |
| Category | features |
| Best-for | electrician, plumber, gas-engineer, hvac-contractor, roofer, landscaper, extension-builder |
| Telemetry tags | `features` `three_up` `reasons` `why_choose_us` `shadcn` `framer_motion` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `useKnowledgeGraph` · `item1Icon` · `item1Title` · `item1Body` · `item2Icon` · `item2Title` · `item2Body` · `item3Icon` · `item3Title` |

---

### `footer.minimal_1` · Footer · minimal

Dark 3-column link footer with brand line + tagline + WhatsApp/email chips + copyright. Framer Motion staggered entrance. Lucide icons.

_**⚠ SSR-unsafe** · 12 editable fields · 1 AI-promptable_

![Footer · minimal · desktop](tmp-nex-qa-screenshots/design-inventory/footer/footer.minimal_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Footer · minimal · mobile](tmp-nex-qa-screenshots/design-inventory/footer/footer.minimal_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `footer` |
| Version | 2.0.0 |
| Source | `src/lib/studio/sections/footer/minimal.tsx` |
| Category | footer |
| Best-for | electrician, plumber, gas-engineer, hvac-contractor, roofer, landscaper, extension-builder |
| Telemetry tags | `footer` `minimal` `3col` `shadcn` `framer_motion` |
| Editable field keys | `brandLine` · `tagline` · `col1Title` · `col1Links` · `col2Title` · `col2Links` · `col3Title` · `col3Links` · `contactWhatsappLabel` · `contactEmailLabel` · `contactEmailValue` · `copyright` |

---

### `gallery.grid_1` · Gallery grid

Photo gallery grid on shadcn foundation. Mobile: 2-col; Tablet: 3-col; Desktop: 4-col. Staggered Framer Motion reveal. Supports fixed photo1..8 slots OR items[] array.

_`.meta ✓` · 28 editable fields · 2 AI-promptable_

![Gallery grid · desktop](tmp-nex-qa-screenshots/design-inventory/gallery/gallery.grid_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Gallery grid · mobile](tmp-nex-qa-screenshots/design-inventory/gallery/gallery.grid_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `gallery` |
| Version | 2.0.0 |
| Source | `src/lib/studio/sections/gallery/grid.meta.ts` |
| Category | gallery |
| Best-for | landscaping, carpentry, tiling, roofing, extension-builder, kitchen-fitter, bathroom-fitter, painter |
| Telemetry tags | `gallery` `grid` `portfolio` `photo_heavy` `shadcn` `framer_motion` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `photo1Url` · `photo1Alt` · `photo1Href` · `photo2Url` · `photo2Alt` · `photo2Href` · `photo3Url` · `photo3Alt` · `photo3Href` |

---

### `map.embed_1` · Map embed

Google Maps embed via the legacy no-API-key URL. Merchant pastes an address, postcode, or place name and the map renders. 16:9 responsive iframe with lazy loading. Caption line below for hours or service-area reach.

_server-safe · 5 editable fields · 3 AI-promptable_

![Map embed · desktop](tmp-nex-qa-screenshots/design-inventory/map/map.embed_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Map embed · mobile](tmp-nex-qa-screenshots/design-inventory/map/map.embed_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `map` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/map/embed.tsx` |
| Category | map |
| Best-for | plant_hire, tool_hire, building_merchant, kitchen_install, bathroom_install, landscaping, hvac, plumbing … |
| Telemetry tags | `map` `google_maps` `embed` `no_api_key` `16_9` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `mapQuery` · `caption` |

---

### `addon.newsletter` · Newsletter

GDPR-compliant email capture. Merchants export the list; Thenetworkers never sends emails. Appearance only.

_server-safe · 10 editable fields · 3 AI-promptable_

![Newsletter · desktop](tmp-nex-qa-screenshots/design-inventory/newsletter/addon.newsletter__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Newsletter · mobile](tmp-nex-qa-screenshots/design-inventory/newsletter/addon.newsletter__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `newsletter` |
| Version | 1.0.0 |
| Source | `(unknown)` |
| Category | newsletter |
| Best-for | building-merchant, builders-supplies, tool-hire |
| Telemetry tags | `addon` `newsletter` |
| Editable field keys | `headingCopy` · `supportingCopy` · `buttonLabel` · `headingColor` · `supportingColor` · `background` · `buttonBackground` · `buttonInk` · `cardRadius` · `layout` |

---

### `newsletter.inline_1` · Newsletter signup

Centred email capture with a configurable form action URL. Native HTML POST — no JavaScript needed. Merchant pastes their Mailchimp / ConvertKit / Brevo form URL; the section handles the submit.

_server-safe · 8 editable fields · 3 AI-promptable_

![Newsletter signup · desktop](tmp-nex-qa-screenshots/design-inventory/newsletter/newsletter.inline_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Newsletter signup · mobile](tmp-nex-qa-screenshots/design-inventory/newsletter/newsletter.inline_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `newsletter` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/newsletter/inline.tsx` |
| Category | newsletter |
| Best-for | plumbing, electrical, hvac, landscaping, roofing, joinery, plant_hire, kitchen_install … |
| Telemetry tags | `newsletter` `inline` `email_capture` `no_js` `external_action` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `emailPlaceholder` · `buttonLabel` · `formActionUrl` · `showTrustLine` · `trustLine` |

---

### `pricing.three_tier_1` · 3-tier pricing

Three pricing cards side-by-side, middle one optionally lifted as "most popular". Comma-separated features become tick lists. Best for trades that package callout tiers, service plans, or maintenance contracts.

_server-safe · 26 editable fields · 7 AI-promptable_

![3-tier pricing · desktop](tmp-nex-qa-screenshots/design-inventory/pricing/pricing.three_tier_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![3-tier pricing · mobile](tmp-nex-qa-screenshots/design-inventory/pricing/pricing.three_tier_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `pricing` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/pricing/threeTier.tsx` |
| Category | pricing |
| Best-for | plumbing, electrical, hvac, boiler_repair, locksmith, drain_clearance, handyman |
| Telemetry tags | `pricing` `three_tier` `callout_pricing` `middle_popular` `feature_list` |
| Editable field keys | `eyebrow` · `heading` · `t1Name` · `t1Price` · `t1Period` · `t1Body` · `t1Features` · `t1CtaLabel` · `t1CtaHref` · `t1Popular` · `t2Name` · `t2Price` |

---

### `product_grid.classic_3col_1` · 3-column product grid

Six product cards in a 3-column grid. Photo, name, price pill, view-through link. Best for merchants with a compact catalogue — plant hire fleet, key blanks, spare parts, tool hire, hardware.

_server-safe · 29 editable fields · 7 AI-promptable_

![3-column product grid · desktop](tmp-nex-qa-screenshots/design-inventory/product_grid/product_grid.classic_3col_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![3-column product grid · mobile](tmp-nex-qa-screenshots/design-inventory/product_grid/product_grid.classic_3col_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `product_grid` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/product_grid/classic3col.tsx` |
| Category | product_grid |
| Best-for | plant_hire, tool_hire, building_merchant, key_cutting, spare_parts, hardware |
| Telemetry tags | `product_grid` `three_column` `six_tiles` `price_pill` `e_commerce` |
| Editable field keys | `eyebrow` · `heading` · `showSeeAll` · `seeAllLabel` · `seeAllHref` · `p1Name` · `p1Price` · `p1ImageUrl` · `p1Href` · `p2Name` · `p2Price` · `p2ImageUrl` |

---

### `services.list_1` · Services menu

Vertical services menu on shadcn Card + Framer Motion. Lucide-only icons (never emoji). Resolves content: items[] → legacy s1..s5 → Knowledge Graph packageForTrade(primaryTrade). Set useKnowledgeGraph: true to force graph resolution.

_`.meta ✓` · 29 editable fields · 6 AI-promptable_

![Services menu · desktop](tmp-nex-qa-screenshots/design-inventory/services/services.list_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Services menu · mobile](tmp-nex-qa-screenshots/design-inventory/services/services.list_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `services` |
| Version | 3.0.0 |
| Source | `src/lib/studio/sections/services/list.meta.ts` |
| Category | services |
| Themes | all |
| Best-for | all |
| Responsive | mobile: stack · tablet: stack · desktop: stack |
| Telemetry tags | `services` `list` `menu` `shadcn` `framer_motion` `knowledge_graph` `lucide` |
| Editable field keys | `eyebrow` · `heading` · `useKnowledgeGraph` · `s1Icon` · `s1Name` · `s1Body` · `s1Price` · `s1Href` · `s2Icon` · `s2Name` · `s2Body` · `s2Price` |

---

### `statistics.band_1` · Statistics band

Four big numbers with short labels — years in business, jobs completed, star rating, areas covered. Dark surface by default; toggle for a light band that matches the surrounding sections.

_`.meta ✓` · 11 editable fields · 9 AI-promptable_

![Statistics band · desktop](tmp-nex-qa-screenshots/design-inventory/statistics/statistics.band_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Statistics band · mobile](tmp-nex-qa-screenshots/design-inventory/statistics/statistics.band_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `statistics` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/statistics/band.meta.ts` |
| Category | statistics |
| Best-for | plumbing, electrical, hvac, landscaping, roofing, joinery, plant_hire, tool_hire … |
| Telemetry tags | `statistics` `trust_band` `four_stats` `big_numbers` `dark_surface` |
| Editable field keys | `eyebrow` · `heading` · `s1Value` · `s1Label` · `s2Value` · `s2Label` · `s3Value` · `s3Label` · `s4Value` · `s4Label` · `darkSurface` |

---

### `addon.meet_the_team` · Meet the Team

4-card team grid. Boss pinned, others auto-rotate. Appearance only — content lives in Team Manager.

_server-safe · 9 editable fields · 2 AI-promptable_

![Meet the Team · desktop](tmp-nex-qa-screenshots/design-inventory/team/addon.meet_the_team__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Meet the Team · mobile](tmp-nex-qa-screenshots/design-inventory/team/addon.meet_the_team__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `team` |
| Version | 1.0.0 |
| Source | `(unknown)` |
| Category | team |
| Best-for | building-merchant, builders-supplies, tool-hire, landscaper, roofer, carpenter, plasterer |
| Telemetry tags | `addon` `meet_the_team` |
| Editable field keys | `heading` · `helperCopy` · `headingColor` · `helperColor` · `background` · `bossAccent` · `cardRadius` · `rotateIntervalMs` · `showDirectDial` |

---

### `team.cards_1` · Team cards

Four portrait cards side-by-side: photo, name, role, one-line bio. Humanises the pitch on trust-heavy trades — landscaping, joinery, kitchen installers.

_server-safe · 19 editable fields · 6 AI-promptable_

![Team cards · desktop](tmp-nex-qa-screenshots/design-inventory/team/team.cards_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Team cards · mobile](tmp-nex-qa-screenshots/design-inventory/team/team.cards_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `team` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/team/cards.tsx` |
| Category | team |
| Best-for | landscaping, joinery, kitchen_install, bathroom_install, roofing, brickwork, plumbing, electrical … |
| Telemetry tags | `team` `cards` `four_slots` `portrait_photos` `trust` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `m1PhotoUrl` · `m1Name` · `m1Role` · `m1Bio` · `m2PhotoUrl` · `m2Name` · `m2Role` · `m2Bio` · `m3PhotoUrl` |

---

### `testimonials.card_grid_1` · Testimonials · card grid

Three-card social-proof grid on shadcn Card + Framer Motion. Aggregate rating strip. Lucide star + quote icons. Mobile: card-stacked; Desktop: 3-col grid. Optional KG binding seeds template quotes from customerTypes for the trade.

_`.meta ✓` · 15 editable fields · 5 AI-promptable_

![Testimonials · card grid · desktop](tmp-nex-qa-screenshots/design-inventory/testimonials/testimonials.card_grid_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Testimonials · card grid · mobile](tmp-nex-qa-screenshots/design-inventory/testimonials/testimonials.card_grid_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `testimonials` |
| Version | 2.0.0 |
| Source | `src/lib/studio/sections/testimonials/cardGrid.meta.ts` |
| Category | testimonials |
| Themes | all |
| Best-for | all |
| Responsive | mobile: stack · tablet: grid_2 · desktop: grid_3 |
| Telemetry tags | `testimonials` `reviews` `cards` `shadcn` `framer_motion` |
| Editable field keys | `eyebrow` · `heading` · `showAggregate` · `aggregateText` · `useKnowledgeGraph` · `quote1` · `author1` · `business1` · `quote2` · `author2` · `business2` · `quote3` |

---

### `trust_bar.icon_row_1` · Trust bar · icon row

Thin trust bar with 3-4 credential icons + short labels. Sits between the hero and services. Icons from the platform Lucide set; Framer Motion Reveal entrance; theme-aware surface (light / tinted / dark).

_`.meta ✓` · 11 editable fields_

![Trust bar · icon row · desktop](tmp-nex-qa-screenshots/design-inventory/trust_bar/trust_bar.icon_row_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Trust bar · icon row · mobile](tmp-nex-qa-screenshots/design-inventory/trust_bar/trust_bar.icon_row_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `trust_bar` |
| Version | 2.0.0 |
| Source | `src/lib/studio/sections/trust_bar/iconRow.meta.ts` |
| Category | trust_bar |
| Themes | all |
| Best-for | all |
| Responsive | mobile: carousel · tablet: grid_4 · desktop: grid_4 |
| Telemetry tags | `trust_bar` `icons` `compact` `shadcn` `framer_motion` |
| Editable field keys | `eyebrow` · `useKnowledgeGraph` · `item1Icon` · `item1Label` · `item2Icon` · `item2Label` · `item3Icon` · `item3Label` · `item4Icon` · `item4Label` · `surface` |

---

### `video.embed_1` · Video embed

Single 16:9 video embed (YouTube or Vimeo) with intro copy above and optional CTA below. Uses privacy-preserving embed domains and lazy iframe loading. Best for company overview, meet-the-team, or walk-throughs.

_server-safe · 7 editable fields · 2 AI-promptable_

![Video embed · desktop](tmp-nex-qa-screenshots/design-inventory/video/video.embed_1__desktop.png)

<details><summary>Mobile screenshot (390×844)</summary>

![Video embed · mobile](tmp-nex-qa-screenshots/design-inventory/video/video.embed_1__mobile.png)

</details>

| Field | Value |
| --- | --- |
| Library | `video` |
| Version | 1.0.0 |
| Source | `src/lib/studio/sections/video/embed.tsx` |
| Category | video |
| Best-for | landscaping, joinery, roofing, plant_hire, kitchen_install, bathroom_install, electrical, hvac … |
| Telemetry tags | `video` `embed` `youtube_vimeo` `16_9` `single_video` |
| Editable field keys | `eyebrow` · `heading` · `subheading` · `videoUrl` · `showCta` · `ctaLabel` · `ctaHref` |

---

## Appendix · Latent SSR-unsafe sections (23)

Every section here has a `"use client"` renderer with a module-scope `sectionRegistry.register(...)` and no `.meta.ts` sidecar. When Next.js SSR imports the sections barrel, these registrations do NOT run — the SSR catalog misses them. Any Blueprint that references one of these ids resolves via library-fallback (renders a different section) or fails validation entirely.

Fix pattern (Phase 19D · applied to `productShowroom` and `splitPhotoLeft`): create `<section>.meta.ts` next to the `.tsx`, move the `SectionRegistration` object into it, import the renderer from the sibling `.tsx`, and add the meta to `src/lib/studio/sections/index.ts`.

- `banner.ribbon_1`
- `brands.strip_1`
- `checkout.stack_1`
- `cta.compact_band_1`
- `features.icon_grid_1`
- `features.three_up_reasons_1`
- `footer.minimal_1`
- `hero.animated_gradient_1`
- `hero.animation_hero_1`
- `hero.badge_wall_1`
- `hero.before_after_slider_1`
- `hero.chat_bubble_hero_1`
- `hero.compare_hero_1`
- `hero.cursor_spotlight_1`
- `hero.magazine_editorial_1`
- `hero.map_hero_1`
- `hero.marquee_scroll_1`
- `hero.plant_hire_bold_1`
- `hero.qr_poster_hero_1`
- `hero.review_wave_1`
- `hero.text_kinetic_1`
- `hero.tilt_3d_1`
- `hero.video_background_1`
