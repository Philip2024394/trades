# Public Surfaces — Foundation Reference

> What every non-logged-in visitor can reach and see. Source of truth for routing, layout, and the visitor-facing component tree.
>
> Scanned 2026-06-28. Anchored to file paths (and line numbers where useful). Facts vs Observations are labelled inline.

---

## 1. Routes (URL → file path → purpose)

### Marketing surface (uses `XratedHeader` + `XratedFooter`)

| URL | File | Purpose |
|---|---|---|
| `/` | `src/app/page.tsx` | Server redirect to `/trade-off` (Phase 1 bounce; rewire deferred) |
| `/trade-off` | `src/app/trade-off/page.tsx` | Xrated Trades landing — value-prop hero, URL claim, three "reasons" sections |
| `/trade-off/trades` | `src/app/trade-off/trades/page.tsx` | Templates gallery — every trade has a card, links to demo or signup |
| `/trade-off/pricing` | `src/app/trade-off/pricing/page.tsx` | Free / Paid £14.99 / Verified £19.99 / Verified+ £29.99 comparison |
| `/trade-off/faq` | `src/app/trade-off/faq/page.tsx` | 12 tradies-ask questions, FAQPage JSON-LD |
| `/trade-off/add-ons` | `src/app/trade-off/add-ons/page.tsx` | Public add-on registry driven by `XRATED_ADDONS` |
| `/trade-off/yard` | `src/app/trade-off/yard/page.tsx` | "The Yard" community feed — Hire / Available / Chat / Product posts |
| `/trade-off/why` | `src/app/trade-off/why/page.tsx` | Marketing — why a tradie needs a profile |
| `/trade-off/what` | `src/app/trade-off/what/page.tsx` | Marketing — what XratedTrade is |
| `/trade-off/how` | `src/app/trade-off/how/page.tsx` | Marketing — 4-step "how it works" |
| `/trade-off/compare` | `src/app/trade-off/compare/page.tsx` | "Why choose us" vs alternatives |
| `/trade-off/services` | `src/app/trade-off/services/page.tsx` | Service cards marketing |
| `/trade-off/reviews` | `src/app/trade-off/reviews/page.tsx` | Customer review marketing |
| `/trade-off/share` | `src/app/trade-off/share/page.tsx` | Share anywhere marketing |
| `/trade-off/success` | `src/app/trade-off/success/page.tsx` | Success stories |
| `/trade-off/tips` | `src/app/trade-off/tips/page.tsx` | Tips for trades |
| `/trade-off/trust` | `src/app/trade-off/trust/page.tsx` | Trust Score marketing |
| `/trade-off/verified` | `src/app/trade-off/verified/page.tsx` | Verified Business badge marketing |
| `/trade-off/verified-waitlist` | `src/app/trade-off/verified-waitlist/page.tsx` | Verified waitlist capture |
| `/trade-off/help` | `src/app/trade-off/help/page.tsx` | Help centre |
| `/trade-off/jobs` | `src/app/trade-off/jobs/page.tsx` | Jobs board surface |
| `/trade-off/jobs/post` | `src/app/trade-off/jobs/post/page.tsx` | Post-a-job form |
| `/trade-off/jobs/post/done` | `src/app/trade-off/jobs/post/done/page.tsx` | Post-a-job done screen |
| `/trade-off/jobs/[slug]` | `src/app/trade-off/jobs/[slug]/page.tsx` | Individual job detail |
| `/trade-off/[trade]` | `src/app/trade-off/[trade]/page.tsx` | Trade-category landing (UK SEO) |
| `/trade-off/[trade]/[city]` | `src/app/trade-off/[trade]/[city]/page.tsx` | Trade + city landing (UK SEO) |
| `/trade-off/search` | `src/app/trade-off/search/page.tsx` | Legacy search surface |
| `/trade-off/signup` | `src/app/trade-off/signup/page.tsx` | Signup wizard |
| `/trade-off/signup/done` | `src/app/trade-off/signup/done/page.tsx` | Post-signup screen |
| `/trade-off/upgrade` | `src/app/trade-off/upgrade/page.tsx` | Free → Paid upgrade |

### Customer search portal

| URL | File | Purpose |
|---|---|---|
| `/find` | `src/app/find/page.tsx` | "xratedtrades.com" search portal (country auto-detect via CDN headers) |
| `/find/beacon` | `src/app/find/beacon/page.tsx` | Project Beacon — push to 3 nearest trades |

### Tradie profile (uses `TradeProfileHeader` + `TradeProfileFooter`)

| URL | File | Purpose |
|---|---|---|
| `/trade/[slug]` | `src/app/trade/[slug]/page.tsx` | Main tradie profile — premium vs standard branched render |
| `/trade/[slug]/contact` | `src/app/trade/[slug]/contact/page.tsx` | Contact form + FAQ + Visit Us panel + social grid |
| `/trade/[slug]/faq` | `src/app/trade/[slug]/faq/page.tsx` | Standalone FAQ subpage with image lightbox, FAQPage JSON-LD |
| `/trade/[slug]/services` | `src/app/trade/[slug]/services/page.tsx` | Services subpage (catchment map) |
| `/trade/[slug]/services-prices` | `src/app/trade/[slug]/services-prices/page.tsx` | Priced services grid (Services Prices add-on) |
| `/trade/[slug]/shop` | `src/app/trade/[slug]/shop/page.tsx` | Trade Center storefront (Shop Mode / Wholesale Mode add-on) |
| `/trade/[slug]/shop/[productSlug]` | `src/app/trade/[slug]/shop/[productSlug]/page.tsx` | Product detail page (PDP) |
| `/trade/[slug]/cart` | `src/app/trade/[slug]/cart/page.tsx` | localStorage cart → WhatsApp composer (no payments) |
| `/trade/[slug]/materials` | `src/app/trade/[slug]/materials/page.tsx` | Curated merchant list (Materials Network add-on) |
| `/trade/[slug]/materials/[merchantSlug]` | `src/app/trade/[slug]/materials/[merchantSlug]/page.tsx` | Merchant deep-link |
| `/trade/[slug]/job-diary` | `src/app/trade/[slug]/job-diary/page.tsx` | Job Diary list (Job Diary add-on) |
| `/trade/[slug]/job-diary/[projectId]` | `src/app/trade/[slug]/job-diary/[projectId]/page.tsx` | Individual project page |
| `/trade/[slug]/job-diary/[projectId]/request-removal` | `…/request-removal/page.tsx` | Customer can request removal |
| `/trade/[slug]/downloads` | `src/app/trade/[slug]/downloads/page.tsx` | Gated PDFs with email capture (Downloads add-on) |
| `/trade/[slug]/review` | `src/app/trade/[slug]/review/page.tsx` | Submit-a-review form |
| `/trade/[slug]/trusted-trades` | `src/app/trade/[slug]/trusted-trades/page.tsx` | Recommended-trades grid |

**Fact**: `next.config` rewrites also expose `/<slug>`, `/<slug>/shop`, `/<slug>/cart`, etc. as the canonical public URLs (see `src/app/trade/[slug]/shop/page.tsx:1-3` comment). All the `/trade/[slug]/*` files above also answer the slug-only URL.

---

## 2. Landing pages

### `/trade-off` — Xrated Trades home
**File**: `src/app/trade-off/page.tsx` (703 lines, server component, `revalidate = 300`).

**Hero structure** (page.tsx:127-189):
- Full-bleed image (`XRATED_BRAND.heroImageUrl`)
- "Your trade. One link." H1 with yellow accent
- Yellow pill linking `/trade-off/add-ons` ("Now with 8 add-ons")
- `LandingUrlClaim` widget (the only real CTA — types slug, lands in signup with it pre-filled)
- Sub-line: "14-day trial · No card · See live profile →"

**Live stats** (page.tsx:53-73):
- Counts pulled from `hammerex_trade_off_listings` + `hammerex_trade_off_reviews`
- 63-baseline floor on live tradies (`63 + dbCount`) — **Observation**: this floor is hidden from the visitor and may surprise a future maintainer
- `HERO_COUNTRY_REACH = 5`, `TRADES_SUPPORTED = 30` — config constants, not DB-driven

**Sections rendered** (in order):
1. Hero (above)
2. SuccessStat grid — 5 cells, mirrors profile stat grid (page.tsx:197-225)
3. "Built for every trade" — 5 country/trade illustrated tiles (page.tsx:113-119, 231-280)
4. Three "Why tradies switch" reasons with iPhone screenshots from ImageKit (page.tsx:287-444)
5. "How it works" — 4 steps (page.tsx:447-500)
6. Closing CTA (page.tsx:503-542)
7. `StickyMobileLandingBar`

**Featured profile resolver** (page.tsx:78-102): pinned to `demo-mike-watson-drywall-manchester`, falls back to most-verified live profile, then signup.

**Key components**:
- `XratedHeader` — black sticky, logo + alerts bell + account + burger
- `XratedFooter` — 4-column directory + brand row
- `LandingUrlClaim` — slug-claim input (`src/components/xrated/landing/LandingUrlClaim.tsx`)
- `StickyMobileLandingBar` (`src/components/xrated/landing/StickyMobileLandingBar.tsx`)
- `XratedViewTracker` — `page="landing"` analytics

### `/trade-off/pricing`
**File**: `src/app/trade-off/pricing/page.tsx` (763 lines).

- Hero with ImageKit banner + L-to-R dark gradient (pricing/page.tsx:204-225)
- `PricingTierCards` (client child, monthly/annual toggle)
- "Mental anchor" card — "Less than a single box of screws" (pricing/page.tsx:301-362)
- "We work. You stay on the tools." promise strip
- 4-column feature comparison table (Free / Paid / Verified) — desktop table + mobile stacked, ~60 rows grouped into 8 sections (pricing/page.tsx:50-134)
- Verified Plus £29.99 teaser (waitlist)
- 13-item `PRICING_FAQ` with FAQPage JSON-LD
- Closing CTA

### `/trade-off/faq`
**File**: `src/app/trade-off/faq/page.tsx` (191 lines). Server-rendered `<details>` accordions (no JS), 12 questions, FAQPage JSON-LD emitted via `faqJsonLd()` from `@/lib/seo`.

### `/trade-off/add-ons`
**File**: `src/app/trade-off/add-ons/page.tsx` (454 lines). Server iteration over `XRATED_ADDONS` (`src/lib/xratedAddons.ts`) — new add-ons appear automatically.

---

## 3. Trade profile (`/<slug>` or `/trade/<slug>`)

**File**: `src/app/trade/[slug]/page.tsx` (1389 lines, `revalidate = 300`).

### Render branching
Single page entry (`page.tsx:318-477`) loads `listing`, `projects`, `reviews`, then routes through `PremiumLayout` (always — see `page.tsx:444-454`). The `tier` prop drives feature gates:
- `effectiveTier(listing) === "app_trial" | "app_paid"` ⇒ `tier="paid"` (full white-label)
- everything else ⇒ `tier="free"` (Xrated header visible + yellow upgrade banner)
- `?preview=standard` query forces the standard layout for owner preview

`StandardLayout` (page.tsx:1099-1388) is still in the file but **Observation**: the live entry-point comment says "Single render path — both tiers go through PremiumLayout" — `StandardLayout` looks vestigial / dead code unless I missed a callsite.

### Sections rendered (paid layout, page.tsx:529-637, in order)

1. `PremiumHero` — avatar, name, trade, city, WhatsApp CTA, stats grid
2. `PastProjectsStrip` (gated: Job Diary add-on)
3. `FreeTierUpgradeBanner` (free tier only — yellow strip, "Upgrade — 30 days free")
4. `AboutAndVideo` — bio + `VideoLightbox` (paid only), `AboutFlipPanel` for bio
5. `ShopTeaser` (Shop Mode add-on) OR `ServicesTabbedGallery` (default)
6. `ClientsCarousel` — `ReviewsCarousel` with `EmptyState` if zero
7. `ServicesPricedSection` (Services Prices add-on)
8. `DownloadsSection` (Downloads add-on)
9. `JobDiarySection` (Job Diary add-on)
10. `MaterialsNetworkSection` (Materials Network add-on)
11. `TeamGrid`
12. `TrustedTradesCta` — when `listing.recommendations.length > 0`. Copy rebrands when Materials Network is also on.
13. `FaqPageCta` (FAQ Page add-on)
14. `BottomTrustStrip` — Free Quotes / Fast Response / Quality Guaranteed
15. `PremiumSocialFooter` — website chip only (full social grid lives on `/contact`)
16. `PoweredByXratedFooter` — soft credit on every profile
17. Sticky bottom: `ShopCartIsland` (shop mode) OR `PremiumStickyTrust`

### Modals / overlays
- `VideoLightbox` (`src/components/xrated/profile/VideoLightbox.tsx`)
- `ServiceModal`, `ProductModal` (`src/components/xrated/profile/`)
- `EmailGateModal` (Downloads add-on)
- `ViewCardModal` — business card share modal
- `BusinessCardPanel` (`src/components/trade-off/BusinessCardPanel.tsx`) — share-to-WhatsApp
- `FaqImageLightbox`

### Mobile vs desktop
- Mobile: `pb-20 md:pb-0` on `<main>` to give the sticky bottom bar room
- Mobile only: `TradeMobileActionBar` (free tier only, paid uses `PremiumStickyTrust` / `ShopCartIsland`)
- `OperatingHoursPanel` has a `bare` variant for inline embed (page.tsx:1079)
- `AboutAndVideo`: 5-col grid on `md+`, stacks single-column on mobile (page.tsx:851)

### File-by-file component map (profile section components)

`src/components/xrated/profile/` — 81 files. Key ones:

| Component | Purpose |
|---|---|
| `PremiumHero.tsx` | Top hero, avatar, WhatsApp CTA |
| `PremiumStickyTrust.tsx` | Bottom sticky trust + WA bar |
| `AboutFlipPanel.tsx` | Bio with flip-to-back |
| `VideoLightbox.tsx` | Self-hosted intro video |
| `ServicesTabbedGallery.tsx` | Default services display |
| `ServicesPricedSection.tsx` / `ServicesPricedGrid.tsx` / `ServiceCard.tsx` | Priced services add-on |
| `ReviewsCarousel.tsx` / `StarRatingRow.tsx` / `StarsRating.tsx` | Reviews |
| `TeamGrid.tsx` | Meet the team |
| `RecommendedTrades.tsx` | Trusted Trades grid |
| `OperatingHoursPanel.tsx` / `OfficeHoursMarquee.tsx` | Hours |
| `FaqAccordion.tsx` / `FaqPageCta.tsx` / `FaqPageClientChrome.tsx` / `FaqImageLightbox.tsx` / `FaqShareButton.tsx` | FAQ |
| `DownloadsSection.tsx` / `DownloadsGrid.tsx` / `DownloadCard.tsx` / `EmailGateModal.tsx` | Downloads add-on |
| `JobDiarySection.tsx` / `JobDiaryStream.tsx` / `PastProjectsStrip.tsx` | Job Diary add-on |
| `MaterialsNetworkSection.tsx` / `MaterialsQuoteButton.tsx` | Materials Network add-on |
| `ShopTeaser.tsx` / `StorefrontBody.tsx` / `ShopCartIsland.tsx` / `ProductCard.tsx` / `ProductModal.tsx` | Shop Mode |
| `BulkTierTable.tsx` / `WholesaleDeliveryWidget.tsx` | Wholesale Mode |
| `ProductDetailsTabs.tsx` / `ProductQABlock.tsx` / `ProductShareButton.tsx` / `ProductReviewsChart.tsx` / `WarrantyReturnsBlock.tsx` / `PriceDisplay.tsx` / `CurrencyDropdown.tsx` | PDP modules |
| `EnquireButton.tsx` / `ContactFormPanel.tsx` | Contact pathway |
| `ShareCardButton.tsx` / `ShareIconButton.tsx` / `ViewCardModal.tsx` | Share / business-card |
| `QrFooterDock.tsx` | Mobile sticky QR dock |
| `AvailabilityPill.tsx` / `StatusChip.tsx` / `DistanceBadge.tsx` | Status badges |
| `YardMapPreview.tsx` | Yard origin map |
| `VisitUsPanel.tsx` | Get-directions deep-link |

`src/components/trade-off/` — also feeds the profile via `XratedViewTracker`, `WhatsappClickTracker`, `TradePhotoGallery`, `TradeReportButton`, `TradeAreaMap`, `TradeMobileActionBar`, `TradeProfileUrlChip`, `InstantQuoteForm`, `ProjectGalleryGrid`, `TradeSocialIcons`, `PreviewModeBar`.

### Contact subpage
`src/app/trade/[slug]/contact/page.tsx` (181 lines): `PremiumHero` (with `currentPage="contact"`) → `FaqAccordion` + `OfficeHoursMarquee` → `VisitUsPanel` (visit_us OR wholesale_origin coords) → `ContactFormPanel` (Email or WhatsApp send) → `FindUsOnSection` (full coloured social-icon grid).

### Cart subpage
`src/app/trade/[slug]/cart/page.tsx` (116 lines): server shell — loads shipping zones + wholesale zone, delegates to `CartPageBody`. Cart state lives in localStorage. `robots: { index: false }`.

### Shop subpage
`src/app/trade/[slug]/shop/page.tsx` (207 lines): SSR first page of 24 products, server-aggregates facet counts (categories, price range), hands off to `StorefrontBody` for search/filter/load-more.

### PDP
`src/app/trade/[slug]/shop/[productSlug]/page.tsx` (603 lines): gallery → category chip → price + bulk-tier table → variant picker + quantity + `ProductPageAddToCart` → description tabs → "You might also like" siblings rail with auto-compare. Add-on gates: `isCompareSectionOn`, `isDeliveryTabOn`, `isQAOn`, `isSpecTabOn`, `isWarrantyReturnsOn`. OG image generated by `/api/trade-off/product-og`.

---

## 4. Templates gallery (`/trade-off/trades`)

**Page**: `src/app/trade-off/trades/page.tsx` (502 lines). **Component**: `src/components/trade-off/TemplatesGallery.tsx` (352 lines, client). **Hero copy**: `src/components/trade-off/TemplatesHeroCopy.tsx`.

### How sections render
`TemplatesGallery` (`TemplatesGallery.tsx:44-259`):
- Sticky search + filter chip row at top (`top-0 z-10`)
- Filter chips: `All`, `Service`, `Installation`, `Manufacture`, `Sales`, `Hire` (from `SECTION_ORDER` in `@/lib/tradeTemplateSections`)
- When `filter === "all"` and no query: "Popular templates" row renders 8 hard-coded slugs (`TemplatesGallery.tsx:33-42`) — plumber, electrician, carpenter, kitchen-fitter, building-merchant, tool-hire, window-fitter, roofer
- Then section blocks: each section filters `matching` by `sectionsForTrade(t.slug).includes(sec)`
- Trades can appear in multiple sections (Stairs, Kitchens, Windows by design — `trades/page.tsx:91-99` for product-selling carve-out)

### Search + filter
- Type-ahead drop-down: top 8 matches under input (`TemplatesGallery.tsx:67-70, 137-166`)
- Suggestion click goes straight to `/trade-off/signup?trade=<slug>` — bypasses the gallery scroll
- 150ms blur delay so taps register before unmount (`TemplatesGallery.tsx:128-132`)

### Card → demo link inheritance
`trades/page.tsx:103-124`: `DEMO_BY_TRADE` maps trade-slug → demo profile from `DEMO_TRADE_SEEDS`. If the trade has no seeded demo, `demoHrefForTrade` walks `BANNER_FALLBACK_BY_TRADE` (from `@/lib/tradeOffHeroes`) until it finds a demo OR returns `null`.
- **TemplateCard**: `href={trade.liveDemoHref ?? '/trade-off/signup?trade=' + slug}` (`TemplatesGallery.tsx:305`). Every card lands on a live demo OR signup, never an error.

### Banner inheritance
`trades/page.tsx:178-184`: `tradeHeroFor(t.slug)` from `@/lib/tradeOffHeroes`. When no inherited art exists, the card renders a yellow brand-coloured placeholder with the trade name (`TemplatesGallery.tsx:317-327`).

### Description copy generator
`trades/page.tsx:156-173`: `descriptionForTrade(slug, label)` reads `sectionsForTrade(slug)[0]` and writes one of: "An app for selling X…", "An app for making and selling X…", "An app for fitting X…", "An app for renting X…", "An app for X as a labour service…". Topic stripped of suffixes ("Kitchen Sales" → "kitchens").

---

## 5. Search & Find (`/find`)

**File**: `src/app/find/page.tsx` (379 lines, `revalidate = 300`). Header/footer: `FindHeader`, `FindFooter`. Search bar: `FindSearchBar` (`src/components/xrated/find/FindSearchBar.tsx`, 202 lines).

### Filters available
SearchParams (`find/page.tsx:47-52`): `trade`, `city`, `postcode`, `country` (defaults to IP via `cf-ipcountry` or `x-vercel-ip-country` headers, falls back to `GB`).

### Country auto-detect
`find/page.tsx:89-100`: reads CDN headers from `next/headers`. `COUNTRY_CODE_TO_LABEL` (find/page.tsx:57-68) maps GB/UK/IE/US/AU/NZ/CA/ZA/AE/SG. `COUNTRY_STRAP_LABEL` controls the hero copy article ("the UK", "the US", "the UAE").
- **Observation**: filter chrome only flips on when explicit filters are present — auto-country defaulting is invisible (find/page.tsx:204-206).

### Query
`SELECT_COLS` is fixed string of 13 listing columns (find/page.tsx:120-121). Sort: `rating_avg desc nulls last`, `rating_count desc nulls last`, limit 24. UK + no filter ⇒ uses hard-coded `FEATURED_SLUGS` (find/page.tsx:111-118) in curated order.

### Result rendering
**Fact**: Every result renders as a `FindResultRow` (`src/components/xrated/find/FindResultRow.tsx`) — landscape row. **Observation**: `FindResultCard.tsx` exists in the same dir and exports `FindCardListing` (the type), but the page only imports the row variant — the card is unused on `/find` (`find/page.tsx:24-25, 333-339`).

### Empty state
"Updating soon — Come back soon" message (find/page.tsx:348-367). **Observation**: the empty-state copy has `&rsquo;` HTML entities inside a template literal at find/page.tsx:362 — those will render as the literal text "&rsquo;" rather than a curly apostrophe.

### Project Beacon
`/find/beacon` (`src/app/find/beacon/page.tsx` + `src/components/xrated/find/ProjectBeaconForm.tsx`) — push a project to the 3 nearest trades. Linked from the `/find` hero (find/page.tsx:276-287) — easy to miss.

---

## 6. Yard community feed (`/trade-off/yard`)

**File**: `src/app/trade-off/yard/page.tsx` (593 lines, `revalidate = 60`).

### Post types (kinds)
4 kinds — `available`, `needed`, `chat`, `product` (`yard/page.tsx:69-75, 137-143`).
- **Hire / Available / Product**: render as marketplace cards via `YardPostCard`
- **Chat**: renders Facebook-style vertical feed via `YardChatPost` in a `max-w-2xl` column
- All 4 stacked when filter = All; just the active kind when filter applied

### Composer
`src/components/trade-off/YardComposer.tsx` (718 lines). **Observation**: not rendered on the public yard page — only paid members can post (yard hero links to `/trade-off/signup?next=yard`). Composer lives in dashboard editing routes (e.g. `/trade-off/edit/[slug]/yard`).

### Read-only vs interactive surfaces
- **Public yard page**: feed is read-only. Reaction counts pre-loaded server-side via `loadFeed` (yard/page.tsx:108-119). `YardReactionBar` likely hydrates client-side to allow paid members to react (separate signup gate).
- **Filters**: `YardFilters` client island (`src/components/xrated/yard/YardFilters.tsx`, 152 lines). Sticky chips driven by `?kind` / `?trade` / `?region`.

### Hero
Full-bleed background image + L-to-R dark gradient (matches `/find` and `/tips`). `<details>` accordion for the long pitch — no JS (yard/page.tsx:218-258).

### Stats strip
Live counts: total, needed, available, chat, product. UK-only filter baked into the query (`yard/page.tsx:62, 132`).

---

## 7. Hidden / lesser-known features

Things a casual reader will MISS:

1. **`?preview=standard` query on `/<slug>`** lets the listing owner force the old standard layout for visual comparison (`trade/[slug]/page.tsx:327-331`) — no signed token because the profile is already public.
2. **`PoweredByXratedFooter`** appends `?ref=<slug>` to the marketing link (`trade/[slug]/page.tsx:803`) — every public profile is a viral acquisition link.
3. **TrustedTradesCta copy rebrands** when the Materials Network add-on is on — eyebrow becomes "Trade Materials & Companies I Work With" instead of "My Trusted Trades" (`trade/[slug]/page.tsx:687-740`).
4. **Reviews carousel auto-detects empty state** and shows an upgrade nudge for free-tier profiles ("Reviews unlock on the paid profile") instead of the add-review CTA (`trade/[slug]/page.tsx:945-977`).
5. **Visit Us deep-link is dual-source**: `visit_us_enabled` + lat/lng OR Wholesale Mode `wholesale_origin_lat/lng` (contact/page.tsx:84-104). The wholesale fallback is silent.
6. **QR code download** at `/trade/[slug]/qr.png?download=1` is reachable from the standard layout download button (page.tsx:1366-1378) — **Observation**: only the standard (now-dead) layout exposes this; the premium layout never links to it.
7. **JSON-LD trifecta on every profile**: BreadcrumbList, LocalBusiness, and (when `video_url` is set) VideoObject (`trade/[slug]/page.tsx:395-429`) — VideoObject Schema picks up both self-hosted MP4 and YouTube URLs.
8. **Country auto-detect on `/find` is invisible** — visitor never sees a "country" badge unless they explicitly filter (find/page.tsx:204-206).
9. **`POPULAR_SLUGS` ordering** in the templates gallery is hard-coded — plumber leads (`TemplatesGallery.tsx:33-42`), not driven by signups.
10. **YardComposer is 718 lines** — biggest single component touching public surfaces, but ONLY runs in dashboard editing routes, never the public yard.
11. **`TradeShowcaseGrid` + `TradesOnStandby` + `FeaturedTradiesRail` + `LivePulseTicker` + `AutoFlipJobsSpotlight` + `SearchHero` + `TradeIconChips`** exist under `src/components/xrated/landing/` — most are NOT used on `/trade-off` (which pivoted to a SaaS-pitch hero). **Observation**: likely dead from the customer-directory era.
12. **Two header components**: `XratedHeader` (marketing routes, opens BurgerMenu) and `TradeProfileHeader` (lean black bar, profile routes). Different visual languages — easy to confuse.
13. **`WhatsappLeadsNudge`, `LossAversionPreview`, `LivePreviewIframe`** — `src/components/trade-off/` UI patterns used in dashboard. Don't accidentally render on public surfaces.

---

## 8. Known gaps and tech debt

Anchored, with severity tag (`[high]` = breaks UX or money flow, `[med]` = confusing/fragile, `[low]` = cleanup).

1. **[med] `StandardLayout` looks like dead code**. `trade/[slug]/page.tsx:1099-1388` defines `StandardLayout` but the comment at line 439-443 says "Single render path — both tiers go through PremiumLayout with feature gates driven by tier". `?preview=standard` still flips to free-tier `PremiumLayout`, never `StandardLayout`. ~290 lines of unreachable code — but it owns the only QR-download link. Verify before removing.

2. **[med] `FindResultCard` looks unused on `/find`**. Type `FindCardListing` is exported and the page imports it, but the page only ever renders `FindResultRow` (find/page.tsx:333-339). Either kill the card or wire a layout toggle.

3. **[low] HTML entities in template literal at `/find` empty state**. `find/page.tsx:362` writes `We&rsquo;re adding more…` inside a JS string — will render literally as `&rsquo;`, not `'`.

4. **[med] Hard-coded `63` floor on live-tradies counter** in landing hero (`trade-off/page.tsx:56`). A future maintainer will struggle to understand why the count is "wrong". Move to env or DB-config.

5. **[med] `HERO_COUNTRY_REACH = 5`, `TRADES_SUPPORTED = 30`** (trade-off/page.tsx:69-73) are config constants but `TRADES_SUPPORTED` is misleading — the actual `TRADE_OFF_TRADES` registry has 100+ entries (gallery uses `.length` for its hero count). The landing strip says "30 Trades" while the templates page says "100+ trades · 5 categories" — visitor inconsistency.

6. **[med] Marketing `/trade-off/jobs` exists** but the landing page comments say "Customer-facing search, TradesOnStandby and live-jobs flows have been removed" (`trade-off/page.tsx:5-6`). Are jobs still a product? If not, the `jobs/*` tree is orphaned and the burger menu should drop it.

7. **[low] ImageKit URLs all over public surfaces** (hero images on `/`, `/find`, `/yard`, `/pricing`, `/trade-off`). User's memory says Hammerex auto-migrates ImageKit → Supabase Storage daily. **Observation**: same cron should cover xratedtrade.com but I didn't verify it does — these URLs will break if ImageKit is shut off.

8. **[med] `PremiumSocialFooter` only renders the website chip** on the home page (`trade/[slug]/page.tsx:752-790`); the comment says "the full coloured social grid moved to the /contact subpage". If a tradesperson never fills the website field they get a silent missing footer — no graceful "see /contact" link unless `listing.website` truthy.

9. **[low] `/find` country auto-detect** falls back to `GB` on every error (find/page.tsx:96-99) — silently swallows `headers()` exceptions. Fine for dev, but a Vercel CDN regression would hide the bug.

10. **[low] `PremiumLayout` re-checks every add-on gate against `isPaid`** even though the dashboard already gates the toggle. Defensive but duplicate (`trade/[slug]/page.tsx:511-528`). Document the "leaked toggle on a free profile can't bypass the gate" intent in `@/lib/xratedAddons` so the duplication makes sense at a glance.

11. **[high] `/trade/[slug]/page.tsx` is 1389 lines** in a single file with 9 inline sub-components defined at module scope. Maintenance hazard — splitting `PremiumLayout`, `FreeTierUpgradeBanner`, `TrustedTradesCta`, `PoweredByXratedFooter`, `AboutAndVideo`, `ClientsCarousel`, `BottomTrustStrip`, `ServiceAreaAndHours`, `StandardLayout` into `src/components/xrated/profile/` would un-cluster it.

12. **[med] `effectiveTier` + `isStorefrontOn` + `isPaid` gate logic** is recomputed in the page, in `cart/page.tsx`, in `shop/page.tsx`, in `shop/[productSlug]/page.tsx`. Inconsistency risk — a new add-on gate would have to land in 4 places.

13. **[low] Two redirect-on-bad-state patterns**: cart redirects to `/<slug>` when shop+wholesale both off (cart/page.tsx:92-94); shop redirects to `/<slug>` when paid+storefront off (shop/page.tsx:136-139). Good UX, but no "you came from a stale share link" message — users may bounce confused.

---

## Reference data

- **Total LoC, public-surface pages** (`src/app/page.tsx` + `/trade-off/page.tsx` + `/trade-off/trades` + `/trade-off/pricing` + `/trade-off/faq` + `/trade-off/add-ons` + `/trade-off/yard` + `/find/page.tsx` + `/trade/[slug]/*` 7 files): ~6.0k lines.
- **Total LoC, public-surface components** (`src/components/xrated/profile/` 81 files = 17.1k + `landing/` ~1.9k + `yard/` ~1.0k + `find/` ~0.9k + `trade-off/` ~17.2k + `XratedHeader/Footer/BurgerMenu/TradeProfileHeader` etc.): **~38–40k lines**.
- **Grand total public-surface code**: **~44–46k lines**.

(Counts via `wc -l` 2026-06-28. Excludes /trade-off/edit/* dashboard, /trade-off/jobs/*, marketing sub-pages like /why /how /what etc. except where landed under the routes table.)
