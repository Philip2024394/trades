# Trade Centre · International Readiness Audit
_Read-only audit · 2026-08-16 · zero code changes made_

Scope: what breaks (or silently misbehaves) when the 375 USA and 50 Ireland records
land next to the 471 UK records in `directory_seeds` (896 live rows total). Written
before any code change so Philip can lock the plan first.

## 1. Executive summary

- **Country is not modelled as a filter dimension anywhere in the UI.** The Trade
  Centre feed, the Refacing companies surface, the profile pages, the sheets, and
  the categorised filter panel all lack any country awareness. Every UK hardcode
  below is a symptom of this.
- **The 375 USA + 50 IE records ARE surfaced today** by the main feed and by the
  Refacing companies surface — but with UK visual assumptions applied to them
  (state codes rendered as region chips, "UK" fallback label on US cards, no ZIP
  formatting, no country flag). Nothing 404s; everything looks "British-shaped".
- **One immediate data-loss risk: the `verified_only` filter checkbox** on the main
  Trade Centre (`NexCentreLiveFeed`) will silently exclude every non-UK record —
  every US+IE row was imported with `verified=false`, and only the UK-refacing
  path is producing `verified=true` today.
- **Region ranking is UK-only.** `centroidOf()` in `src/lib/ukPostcodeCentroids.ts`
  understands only UK outward codes; every non-UK postcode (Eircode / US ZIP) will
  score `distance_km = null`, so proximity sort silently degrades to
  most-recently-published for non-UK users.
- **Address rendering assumes UK order** (town · county · postcode). US and IE
  records will render "state" in the county slot and "ZIP" in the postcode slot,
  visually valid but semantically wrong.
- **Refacing companies page (`/nex-app/refacing/companies`) filters ONLY by
  `category = "Staircase Refacing"`.** All 375 US records were imported under the
  `Staircase` category (not `Staircase Refacing`), so the Refacing surface currently
  under-shows US refacing specialists — verify per Slice 3.
- **No country picker exists.** Not started, not stubbed. The pinned architecture
  rule (ONE URL · country selector in top nav · panel grouped by region) is
  entirely un-implemented on the Trade Centre.

Biggest structural risk: **`ukPostcodeCentroids.ts`** — proximity ranking is the
only feature that will actually mis-rank rather than mis-label. Everything else
is cosmetic and can ship in an intentional order.

---

## 2. Surface inventory

Every Trade-Centre-relevant route today, with what it filters on and whether it
is country-safe:

| Route | Purpose | Filters today | Composed of | Country-safe? |
|-------|---------|---------------|-------------|----------------|
| `/nex-app/centre` | Main Trade Centre feed (masonry) | q · category · postcode · min/max price · verified_only · sort · trade-chip (All/Staircase/Refacing/Kitchen/Doors/Flooring) | `NexCentreLiveFeed.tsx` → `GET /api/nex/centre/feed` → `loadDirectorySeedsAsFeedItems` + `listCentreFeedItems` | **NO** — no country filter, `verified_only` silently drops US+IE, `postcode` box only understands UK, `merchant_city ?? merchant_postcode_prefix ?? "UK"` fallback |
| `/nex-app/refacing/companies` | Refacing-specific directory | category=`Staircase Refacing` hardcoded | `client.tsx` → same feed API → `TradeProfileSheet` | **NO** — hardcoded UK hero copy ("Trusted UK refacing trades") · "Verified only" pill · `merchant_city ?? ... ?? "UK"` fallback · category filter excludes non-UK refacing rows that were imported under `Staircase` category |
| `/nex-app/refacing/companies/[slug]` | Refacing detail page | slug lookup | `src/app/nex-app/refacing/companies/[slug]/page.tsx` reads directory_seeds directly | Partial — no country awareness in address formatting; `[town, county, postcode]` renders US state/ZIP with UK labels |
| `/nex-app/refacing/companies/[slug]/ask` | NEX-chat enquiry entry for a specific trade | slug lookup | `page.tsx` reads directory_seeds | Partial — not visually country-aware |
| `/nex-app/trade/[slug]` | Public trade profile (M6.1) | slug lookup | `src/app/nex-app/trade/[slug]/page.tsx` | Partial — reads `region` and renders it as a chip; UK region codes ("NW", "London") and US state codes ("CA", "TX") and IE counties ("Dublin") will all render fine as bare text · **but the page title hardcodes "UK staircase trade"** (line 84) which is factually wrong for US/IE records |
| `/nex-app/claim` | Claim CTA landing page | `?listing_id=<slug>` | `page.tsx` reads directory_seeds | Not country-aware; renders `[town, postcode]` as "Manchester, M20" — will render "Austin, 78701" or "Dublin, D02 XY01" without distinguishing |
| `GET /api/nex/centre/feed` | Feed API used by main + refacing | q · category · postcode · min/max price · limit · offset | route.ts → `directorySeedLoader.ts` | **NO** — accepts no `country` param; postcode field feeds `centroidOf()` which is UK-only |
| `POST /api/nex/centre-search` | AskNex assistant | free-text query · optional postcode | route.ts + Anthropic client | **NO** — system prompt hard-codes "UK marketplace" + "UK English throughout" (line 35, 45) |

`/tc/trade/[slug]` (under `src/app/tc/…`) is a separate app using fixture data
(`findTradeProfile`), not `directory_seeds` — out of scope for this audit.

---

## 3. UK hardcodes found

Grouped by category. Every row cites `file:line`.

### 3a. Literal "UK" / "United Kingdom" / default-country fallbacks

| File:line | What it does | Impact on US/IE |
|-----------|--------------|------------------|
| `src/lib/nex/centre-publishing/directorySeedsDb.ts:298` | `country: (row.country ?? "United Kingdom") as string,` — every DB row missing country defaults to "United Kingdom" | Not a problem today (all rows have country set), but any new US/IE row missing country would silently become UK |
| `src/lib/nex/centre-publishing/directorySeedLoader.ts:423` | `location = seed.town ?? postcode.split(" ")[0] ?? "UK"` — falls back to literal "UK" when a card has no town + no postcode | US card with missing town shows "UK" |
| `src/components/nex-app/centre/NexCentreLiveFeed.tsx:1005` | `location = item.merchant_city ?? item.merchant_postcode_prefix ?? "UK"` — product-card location line | US card with missing city displays "UK" |
| `src/components/nex-app/centre/ProductDetailsSheet.tsx:55` | Same `?? "UK"` fallback | Same |
| `src/components/nex-app/centre/MerchantProfileSheet.tsx:134` | Same `?? "UK"` fallback | Same |
| `src/components/nex-app/refacing/TradeProfileSheet.tsx:46` | Same `?? "UK"` fallback | Same on refacing surface |
| `src/app/nex-app/refacing/companies/client.tsx:391` | Refacing card: `location = item.merchant_city ?? item.merchant_postcode_prefix ?? "UK"` | Same |
| `src/app/nex-app/refacing/companies/client.tsx:212-213` | Overlay hero copy: *"Trusted UK refacing trades. Local companies first, fair rotation across every verified trade."* | Marketing copy tells US/IE users this is UK-only |
| `src/app/nex-app/refacing/companies/client.tsx:228` | Body copy repeat of *"Trusted UK refacing trades…"* | Same |
| `src/app/nex-app/refacing/companies/client.tsx:519-522` | Empty-state copy: *"NEX only shows verified refacing companies. As UK trades are discovered…"* | Same |
| `src/app/api/nex/centre-search/route.ts:35` | AskNex system prompt: *"You are NEX, the search assistant for NEX Trade Centre — a UK marketplace…"* | AskNex will frame every reply UK-first regardless of the querying user's country |
| `src/app/api/nex/centre-search/route.ts:45` | Rule: *"UK English throughout (colour, favour, tyre, £, mm, kg)"* | US customers get UK spelling + metric units + £ — even when their listings are US |
| `src/app/nex-app/trade/[slug]/page.tsx:84` | metadata generator: `const parts = [listing.business_name, listing.town, "UK staircase trade"]` | Every US and IE profile page has "UK staircase trade" in its meta description |
| `src/app/api/nex/centre/feed/route.ts:12` | Header comment: *"public feed reader"*, no country param defined in query params | Feed API is silently UK-shaped even though the DB is now multi-country |

### 3b. Region / county / state enum + list hardcodes

| File:line | What it does | Impact on US/IE |
|-----------|--------------|------------------|
| `deploy/postgres/init/051_directory_seeds_stage5_schema_extension.sql:61-66` | Region CHECK constraint originally hardcoded to 12 UK regions | **REMOVED by migration 053** — noted for context only |
| `src/app/nex-app/trade/[slug]/page.tsx:133-137` | Renders `listing.region` as a chip verbatim | UK: "NW" · IE: "Dublin" · US: "CA" — all render as bare text with no country context. A "CA" chip on a US-based company looks identical to a UK region code. |
| `src/lib/ukPostcodeCentroids.ts` (entire file) | Two-letter postcode area centroids for UK only | US ZIP "10001" and IE "D02" produce **no centroid** → `distance_km = null` → proximity sort silently defeated for non-UK postcodes |

**Note:** The Trade Centre UI does **NOT** currently render any hardcoded UK
county lists (Yorkshire / Manchester / Merseyside as fixed arrays). County text
comes from the seed's `county` column and just renders as-is.

### 3c. Postcode regex + normalisation

| File:line | What it does | Impact on US/IE |
|-----------|--------------|------------------|
| `src/lib/nex/world/location.ts:142-144` | UK postcode shape regex; anything matching returns country="UK" | US ZIP "10001" won't match → falls through to "unknown"; **no false positive**, but no country resolution either |
| `src/lib/nex/world/location.ts:146` | Eircode regex (letter + 2 digits + 4 alphanumerics) | Correctly identifies IE |
| `src/lib/nex/centre-publishing/directorySeedsDb.ts:356` | `normPostcode = uppercase + strip non-alphanumeric` | Format-neutral so it works — but the dedupe unique index `uq_directory_seeds_email_lower` cares about email, not postcode; there is no cross-country postcode uniqueness assumption |
| `src/lib/studio/coverage/postcodesIo.ts:24-25` | UK outcode + full postcode regex | Used by studio coverage feature — not directly Trade Centre; noted for context |
| `src/components/xrated/profile/ReviewFormPanel.tsx:16` · `ContactFormPanel.tsx:50` · `app/api/trade-off/reviews/route.ts:19` · `app/api/trade-off/messages/route.ts:65` | UK postcode regex in xrated/trade-off surfaces — **outside Trade Centre scope** | No Trade Centre impact today, but relevant when those surfaces link to trade profiles |
| `src/lib/nex/centre-publishing/directorySeedLoader.ts:459` | `merchant_postcode_prefix: seed.postcode ? seed.postcode.split(" ")[0] : null` | UK-shaped assumption ("first token before space" = outcode). For US ZIP "10001" this becomes "10001" (fine). For IE "D02 XY01" this becomes "D02" (fine as a prefix). Not broken, but the term "postcode_prefix" is UK-flavoured and downstream code likely treats it as a UK outcode. |

### 3d. UK-only geographic / centroid data

| File:line | What it does | Impact on US/IE |
|-----------|--------------|------------------|
| `src/lib/ukPostcodeCentroids.ts:22-100+` | Full lookup of `E`, `EC`, `M`, `B`, `SW1` → lat/lng | US ZIP + IE Eircode produce no centroid |
| `src/lib/nex/centre-publishing/indexForSearch.ts:14` | `import { centroidOf, haversineKm } from "@/lib/ukPostcodeCentroids"` | Consumer — proximity ranking is UK-only |
| `src/lib/nex/centre-publishing/indexForSearch.ts:106-108` | `userCentroid = filters.postcode ? centroidOf(filters.postcode) : null` | If US customer supplies ZIP, `userCentroid=null`, all distances null, ranking falls to `published_at DESC`. Silent degradation, no error. |

### 3e. Currency / £ hardcodes on Trade Centre

| File:line | What it does | Impact on US/IE |
|-----------|--------------|------------------|
| `src/components/nex-app/centre/NexCentreLiveFeed.tsx:94-97` | `Intl.NumberFormat("en-GB", { currency: "GBP" })` on the price formatter | Every price on the feed is £ regardless of merchant country. If US directory records had prices (they don't — `price_pence: 0` on directory seeds), they'd show as £. Not blocking today but wrong for a multi-country product feed. |
| `src/components/nex-app/centre/NexCentreLiveFeed.tsx:804,816` | Filter labels: "Min price (£)" / "Max price (£)" | US users see £ symbol in the filter |
| `src/components/nex-app/centre/NexCentreLiveFeed.tsx:1069` | `<div>{price}</div>` with GBP-formatted price | Same — irrelevant while directory records have price=0 |
| `src/components/nex-app/centre/ProductDetailsSheet.tsx:27-29` | Same GBP formatter | Same |
| `src/components/nex-app/centre/MerchantProfileSheet.tsx:478` | `£{(p.price_pence / 100).toFixed(2)}` | Same |
| `src/components/nex-app/centre/NexCentreShell.tsx:493, 739, 761` | `£{o.price_from_gbp.toLocaleString("en-GB")}` — this is the legacy Shell (not currently the main feed) | Not on the live path; noted for completeness |

### 3f. Route / URL assumptions

**Good news:** the Trade Centre app never builds `/uk` URLs. There is **no**
`/nex-app/uk/...` route pattern. Refacing rendered `?category=...` params, not
country params. The one URL fingerprint that could imply per-country routing is:

| File:line | What it does | Impact |
|-----------|--------------|--------|
| `src/app/sitemap.ts:58` | `"/trade-off/uk/compare-platforms"` in the sitemap | Belongs to trade-off, not Trade Centre. No Trade Centre-side per-country URL exists (good — the architecture rule "ONE URL, country as filter" is not yet violated) |

### 3g. Refacing category filter (potential silent under-filter)

| File:line | What it does | Impact on US/IE |
|-----------|--------------|------------------|
| `src/app/nex-app/refacing/companies/client.tsx:153` | Only queries `category = "Staircase Refacing"` | If US refacing specialists were imported with category `Staircase` (not `Staircase Refacing`), the Refacing companies page under-filters them. **Verify by inspecting Stage 5B-USA import mapping** — noted as follow-up, not confirmed here since we did no DB queries. |
| `src/lib/nex/centre-publishing/categories.ts:22-25` | `TRADE_CENTER_CATEGORIES` contains only `"Staircase Refacing"` today | Filter category taxonomy has no country dimension; a "US Staircase Refacing" vs "UK Staircase Refacing" distinction cannot be expressed without a new schema axis |

### 3h. Map bounds / centre coordinates

No hardcoded map bounds found in the Trade Centre surfaces. `TradeAreaMap.tsx`
(xrated app) and `WholesaleDeliveryWidget.tsx` use `ukPostcodeCentroids` but are
not Trade Centre surfaces.

### 3i. Copy hardcoded in NEX AI system prompt (customer-facing)

`src/app/api/nex/centre-search/route.ts:35,45` — already listed in 3a. Called out
separately here because every AskNex reply is UK-flavoured even if the customer
searched for a US business.

---

## 4. Today's behavior for US and IE records

Read from the actual code paths. No DB queries were made — findings are derived
from tracing the feed loader + filter code with the known imported values
(country ∈ {'United Kingdom', 'Ireland', 'USA'}, region = UK regions | IE
counties | US state codes).

### 4a. Main Trade Centre (`/nex-app/centre`)

**A US user landing here today sees:**
- All 375 US + 50 IE + 471 UK records interleaved in the masonry — no filter
  drops them by default (`NexCentreLiveFeed` passes no country param;
  `loadDirectorySeedsAsFeedItems` reads every category with no country filter;
  `filterMock` inside `route.ts` does not consider country).
- US card location line: `merchant_city` (US city if present) OR
  `merchant_postcode_prefix` (first 5 chars of ZIP) OR literal "UK". Confirmed
  at `NexCentreLiveFeed.tsx:1005`.
- No visual indication of country — no flag, no country code, no separation
  between US · IE · UK cards.
- Category chips (Staircase / Refacing / Kitchen / Doors / Flooring) don't
  distinguish country. Tapping "Staircase" pulls the full 896 rows if all are
  in that category.
- The **"Verified only" checkbox** at `NexCentreLiveFeed.tsx:225-231` filters
  to `merchant_verification_level ∈ {"verified", "partner"}`. `merchant_verification_level`
  is derived at `directorySeedLoader.ts:431-438` from
  `directory_state === "paid_member" → "partner"` else `seed.verified → "verified"`.
  Every US and IE record was imported with `verified=false` and `directory_state="listed"`,
  so **every non-UK record silently disappears when this checkbox is on**.
- The **postcode filter** feeds `centroidOf()` which returns `undefined` for
  US ZIP / IE Eircode → `userCentroid = null` → `distance_km = null` for every
  merchant → proximity sort silently no-ops.
- The AskNex reply frames results in UK English with £ — even for a US-specific
  query. See `centre-search/route.ts:35,45`.

**An IE user sees the same behavior** — no country separation, UK-shaped price
formatting, and if they filter by "verified only" every IE record disappears.

### 4b. Refacing surface (`/nex-app/refacing/companies`)

**A US user landing here today sees:**
- Hard-coded hero title "Staircase Refacing Companies" + copy "Trusted UK
  refacing trades. Local companies first…" (`client.tsx:210, 213, 228`) — the
  page identifies itself as UK even to US visitors.
- Feed request: `qs = { category: "Staircase Refacing", limit: "100" }`
  (`client.tsx:153`). If a US refacing specialist was imported under `category
  = "Staircase"` (not `"Staircase Refacing"`) they will **not appear on this
  page at all**. **Verify per Slice 3.**
- Cards render `location = merchant_city ?? merchant_postcode_prefix ?? "UK"`.
  US cards without a city show "UK".
- Empty-state copy: "As UK trades are discovered and imported, they will
  appear here…" (`client.tsx:521`) — UK-scoped even if empty because filters
  matched no US records.
- Fair-rotation pill: "Verified only" (`client.tsx:239`) is decorative on this
  page (not tied to a filter) — misleading regardless of country.

**IE user:** same behavior. If IE refacing companies were imported under
`Staircase Refacing`, they appear; otherwise they don't.

### 4c. Trade profile (`/nex-app/trade/[slug]`)

**A US listing rendered here today:**
- Address line 103: `[listing.town, listing.county, listing.postcode].filter(Boolean).join(" · ")`.
  US: "Austin · Travis County · 78701" — cosmetically valid but semantically
  a US state should appear, not a county. `county` column carries US county
  values ("Travis County"), and `region` (a top-level chip) carries the state
  code ("TX"). The trade profile shows both — so a US company gets **two
  region signals** ("TX" chip + "Travis County" text) with no explanation.
- IE listing: "Dublin · Dublin · D02 XY01" — town and county are often
  identical in Ireland which reads oddly.
- Business-type chip works (values are country-agnostic).
- Metadata description (`generateMetadata` at line 84): hardcodes "UK staircase
  trade" — every US and IE profile's SEO description will say "UK staircase
  trade". **Actively wrong for search engines.**
- No 404 · nothing crashes · page renders cleanly. Cosmetic + SEO defects only.

### 4d. Other surfaces

- **`/nex-app/refacing/companies/[slug]`** — reads `[town, county, postcode]`
  and joins with commas. Same address-formatting issue as 4c. `directory_state`
  humaniser handles all values. Cover-image + capabilities are country-agnostic.
- **`/nex-app/refacing/companies/[slug]/ask`** — pure enquiry-chat entry;
  address rendering minimal. No country breakage.
- **`/nex-app/claim`** — `locationLine = [town, postcode].join(", ")`. US
  displays "Austin, 78701". Cosmetic only.
- **`GET /api/nex/centre/feed`** — accepts NO country query param. Currently
  returns everything or filters by category only. All 896 rows are eligible;
  the API is country-blind, not country-broken.
- **`POST /api/nex/centre-search`** — the AskNex assistant. System prompt frames
  the entire product as UK-only ("You are NEX, the search assistant for NEX
  Trade Centre — a UK marketplace…"). Every US and IE customer will get UK
  spelling, £ prices, and UK-oriented category suggestions.

---

## 5. Existing components: reuse / extend / replace

| Component / hook / util | Path | Current job | Verdict | Rationale |
|--------------------------|------|-------------|---------|-----------|
| `NexCentreLiveFeed` | `src/components/nex-app/centre/NexCentreLiveFeed.tsx` | Main Trade Centre masonry + filter UI | **EXTEND** | Add country selector to header + country param to filter state + wire through to feed API |
| `NexCentreLiveFeed › FilterPanel` | same file | Category · postcode · price · verified · sort | **EXTEND** | Need country + region controls; today's `postcode` box is UK-shaped |
| `HeroChip` row | `NexCentreLiveFeed.tsx` (approx line 553) | Trade-domain chips (All/Staircase/Refacing/Kitchen…) | **REUSE** | Country-orthogonal — no change needed |
| `centroidOf` / `haversineKm` | `src/lib/ukPostcodeCentroids.ts` | UK-only postcode → lat/lng | **REPLACE** with a country-aware resolver that consults `ukPostcodeCentroids` for UK, an Eircode routing key table for IE, and a US ZIP centroid dataset for US. Design so the loader picks the right table by country code. |
| `listCentreFeedItems` | `src/lib/nex/centre-publishing/indexForSearch.ts` | Reads product offers + merchant identity + banner | **EXTEND** | Add country filter param (optional); currently reads no country from filters |
| `loadDirectorySeedsAsFeedItems` | `src/lib/nex/centre-publishing/directorySeedLoader.ts` | Reads seeds (all or by category) | **EXTEND** | Accept `country?` and forward to `listDirectorySeedsByCountry(...)` (new fn) |
| `listDirectorySeeds` / `listDirectorySeedsByCategory` | `src/lib/nex/centre-publishing/directorySeedsDb.ts` | Reads directory_seeds | **EXTEND** | Add `.eq("country", ...)` filter + new `listDirectorySeedsByCountryAndCategory` variant |
| `seedToFeedItem` | `directorySeedLoader.ts:419` | Seed → CentreFeedItem | **EXTEND** | Propagate country + region so cards can render them |
| `CentreFeedItem` type | `src/lib/nex/centre-publishing/types.ts` | Item shape sent to client | **EXTEND** | Add `merchant_country: string \| null`, `merchant_region: string \| null` |
| `TradeProfileSheet` | `src/components/nex-app/refacing/TradeProfileSheet.tsx` | Slider on refacing cards | **EXTEND** | Add country-aware location line and country flag chip |
| `MerchantProfileSheet` | `src/components/nex-app/centre/MerchantProfileSheet.tsx` | Main-feed sheet | **EXTEND** | Same |
| `ProductDetailsSheet` | `src/components/nex-app/centre/ProductDetailsSheet.tsx` | Product-focused sheet | **EXTEND** | Same |
| `Trade profile page` | `src/app/nex-app/trade/[slug]/page.tsx` | Public M6.1 profile | **EXTEND** | Country-aware address formatting; country-aware metadata; region chip should carry country context |
| `Refacing companies client` | `src/app/nex-app/refacing/companies/client.tsx` | Refacing directory | **EXTEND** | Copy that says "UK trades" must become country-aware; category filter must be reconciled with US/IE refacing (Slice 3) |
| `AskNex system prompt` | `src/app/api/nex/centre-search/route.ts:35-47` | Guides LLM replies | **EXTEND** | Take country from request, adjust spelling + currency + regs framing per country. This is `nex-brain` boundary — recommend NOT changing during this pass unless Philip explicitly opts in. |
| `TRADE_CENTER_CATEGORIES` | `src/lib/nex/centre-publishing/categories.ts` | Category enum | **REUSE** | Countries are orthogonal to category; no change needed here |
| `resolveLocation` | `src/lib/nex/world/location.ts` | Country resolution chain (merchant → project → customer → device → IP) | **REUSE / EXTEND** | Already handles UK, IE, AU, US, CA, NZ, AE. Use this as the IP-geolocation initial default per the architecture rule — but do NOT let it restrict content. Adaptor may need a passthrough for "All countries". |
| `normaliseCountry` | `src/lib/nex/world/location.ts:29` | Free-text country → CountryCode | **REUSE** | Already handles all needed countries |
| `countryFromPostcode` | `src/lib/nex/world/location.ts:138` | Very conservative postcode-shape → country | **REUSE / EXTEND** | Currently UK + IE only; add US ZIP `^\d{5}(-\d{4})?$` when a US branch is needed. Optional. |
| `assignRefacingHeroPool` | `src/lib/refacing/refacingHeroPool.ts` (referenced by refacing client) | Pool of hero images for unclaimed refacing cards | **REUSE** | Country-orthogonal |

---

## 6. Database schema reality

Read from `supabase/migrations/20260813120000_directory_seeds.sql` +
`deploy/postgres/init/051_directory_seeds_stage5_schema_extension.sql` +
`deploy/postgres/init/053_drop_region_check.sql`.

### Current column shape (relevant)

- `country` — `text NOT NULL DEFAULT 'United Kingdom'` — free-text. No CHECK.
  Live values: `'United Kingdom'` (471), `'Ireland'` (50), `'USA'` (375).
- `region` — `text` — free-text since migration 053. Live values include UK
  regions ("NW", "London", "Yorkshire", "Scotland", "Wales", "NI"), IE
  counties ("Dublin", "Cork", "Munster", …), and US state codes ("CA", "TX",
  "FL", …). No CHECK enforces internal shape per country — that lives in the
  app layer (per Philip's 053 rule).
- `county` — `text` — free-text. UK: county name. IE: county repeated. US:
  US county name (e.g. "Travis County").
- `town` — `text` — city / town.
- `postcode` — `text` — UK postcode / IE Eircode / US ZIP. Free-text.
- `latitude` / `longitude` — `numeric` — optional; not enforced.
- `business_type` — CHECK constrained to Philip's 6 values. Country-agnostic.
- `internal_verification_state` — CHECK constrained to 4 values. Country-agnostic.
- `capabilities` (jsonb) — country-agnostic map.
- `provenance` (jsonb) — free-form. Currently carries `discovered_by_agents`
  like `["US-1"]` or `["IE-3"]`.
- `directory_state` — CHECK constrained (`listed` / `verified` / `claimed` /
  `paid_member`). Country-agnostic.
- `lifecycle_status` — CHECK constrained. Country-agnostic.
- `verified` boolean, `claimed` boolean — country-agnostic.

### Constraints that still assume UK

None on the `country` or `region` column after migration 053.

### Gap: `company_location` vs `service_area`

**Not modelled today.** The current schema has one location per company:
`town / county / postcode / region / country`. A Manchester company that
serves UK + Ireland has no way to express that. The pinned architecture rule
requires this distinction — but Philip's task rules say do NOT change the
schema now unless it is an unblocker. Every filter in Slices 1-4 works
against `country` (company_location) — the multi-service-area extension is a
Slice 8+ enhancement.

Proposal (deferred):
- Add `service_area_countries text[] NOT NULL DEFAULT '{country}'` on
  `directory_seeds` — backfill from `country` at migration time.
- Filter changes: `country = 'X'` → `country = 'X' OR 'X' = ANY(service_area_countries)`
- Enables "Manchester manufacturer serves Ireland" without inventing a
  duplicate record.

---

## 7. Proposed architecture

### 7a. URL model

**ONE URL for every surface. Country is a filter, never a route segment.**

- `/nex-app/centre` — full Trade Centre; country selected via top-nav panel.
- `/nex-app/refacing/companies` — refacing directory; country selected via
  the same top-nav panel (shared between surfaces).
- `/nex-app/trade/[slug]` — profile pages remain slug-only; country is
  displayed on the page but does not appear in the URL.
- Deep-links may accept `?country=US` as a hint, but the canonical URL for
  every surface stays country-free. Selected country persists across visits
  (see 7f).

Banned: `/nex-app/us/centre`, `/uk/centre`, `?country=uk` as canonical.

### 7b. Country picker component

- New shared component: `<CountryPicker />` used in every Trade Centre
  header slot.
- Rendered as a **panel** (not a `<select>`), grouped by region:
  - **Europe** — United Kingdom, Ireland, Germany (future), France (future)…
  - **North America** — USA, Canada
  - **APAC**, **MEA**, **South America** — future
- Always includes "All countries" as the top option.
- Always includes a "Change market" affordance in a persistent header/footer
  slot so a user who dismissed the picker can bring it back.
- Panel entries display country flag + name + count of live records in that
  country (from a lightweight `?country=<X>&count_only=true` API).

### 7c. Geography data model

- **Countries + regions per country** live in a new pure module:
  `src/lib/nex/geography/countries.ts` — declarative.
  ```
  { code: "GB", name: "United Kingdom", canonicalDBValue: "United Kingdom",
    region: "Europe", regions: [{code:"NW",name:"North-West"}, ...] }
  { code: "IE", name: "Ireland", canonicalDBValue: "Ireland", regions: [...] }
  { code: "US", name: "United States", canonicalDBValue: "USA",
    regions: [{code:"CA", name:"California"}, {code:"TX", name:"Texas"}, ...] }
  ```
- Every UI region chip uses the country-context lookup to expand codes to
  friendly names ("CA" → "California" when country=US; "NW" → "North-West"
  when country=UK).
- Normalisation utility maps DB values ↔ ISO codes so the app can store the
  human-readable string that already exists in the DB.

### 7d. Filter model

Locked order per architecture rule: **country → region → trade → capability**.
Every list query respects this order at the SQL layer. Region options are a
function of selected country. Trade options are a function of what exists in
the (country · region) intersection. Capability options ditto.

Feed API extended:
```
GET /api/nex/centre/feed?country=US&region=CA&trade=Staircase&capability=refacing
```
Every param optional; passing none returns "All countries" (current behavior).

### 7e. IP geolocation

- Initial default only. IP → country via existing `resolveLocation` chain.
- Never a content restriction — the user always sees an unambiguous "You're
  in USA, showing US trades. Change market" chip they can dismiss.
- "All countries" is always one tap away from any IP default.

### 7f. Persistence

- Selected country persists in `localStorage.nex_selected_country` (or a
  cookie if we later need SSR-time knowledge of it).
- "Change market" affordance always visible in the Trade Centre header.
- Priority chain: URL `?country=` → localStorage → IP default → "All countries".

### 7g. Address rendering (per-country format)

Small pure formatter `formatAddress(seed, { country })`:
- UK: `town, county, postcode` (e.g. "Manchester, Greater Manchester, M20 2AB")
- IE: `town, county, eircode` (e.g. "Cork, Co. Cork, T12 XY01")
- USA: `city, ST ZIP` (e.g. "Austin, TX 78701") — state pulled from `region`,
  not `county`.
- Region chip label: country-aware (`region` → `regionLabel(region, country)`)

### 7h. company_location vs service_area (deferred)

Do not add `service_area_countries` column in this pass. Get USA visible
correctly first. Revisit as Slice 8+ once M6.3+ is unblocked.

---

## 8. Implementation plan (for Philip's approval)

Ordered slices — each one focused; do not batch. Slice 1 is the minimum change
that unblocks USA display without regression. Slices 4+ are hardening.

### Slice 1 · Country as a first-class filter dimension (feed API + type)
- Files:
  - `src/lib/nex/centre-publishing/types.ts` — add `merchant_country`,
    `merchant_region` to `CentreFeedItem`; add `country` to `CentreFeedFilters`.
  - `src/lib/nex/centre-publishing/directorySeedsDb.ts` — new
    `listDirectorySeedsByCountry(country)` + optional variant with category
    + region params.
  - `src/lib/nex/centre-publishing/directorySeedLoader.ts` — accept `country`
    filter, forward to db layer; propagate country + region into feed items.
  - `src/app/api/nex/centre/feed/route.ts` — accept `?country` and `?region`
    params; pass through.
- What changes: API is country-aware; passing no `country` returns everything
  (backward compatible).
- Risk: low; every consumer that ignores the new fields keeps working.
- Test: call API with `?country=USA` and confirm 375 rows returned; without
  it, all 896 returned.
- **Unblocker for USA display: yes** (nothing else is required to have USA
  reachable via a country filter).

### Slice 2 · Country picker component + top-nav integration
- Files:
  - `src/lib/nex/geography/countries.ts` — new declarative country/region map.
  - `src/components/nex-app/centre/CountryPicker.tsx` — new panel component.
  - `src/components/nex-app/centre/NexCentreLiveFeed.tsx` — mount the picker
    in the header; wire selected country into `filters.country`; add "Change
    market" affordance.
  - `src/app/nex-app/refacing/companies/client.tsx` — mount the picker in
    the refacing header; pass `country` into the feed call.
- What changes: user-visible country picker on both Trade-Centre surfaces.
- Risk: UI change; no data-shape change from Slice 1.
- Test: pick "United Kingdom" → only 471 UK cards. Pick "Ireland" → only 50.
  Pick "USA" → only 375. Pick "All countries" → 896.

### Slice 3 · Verify + fix category mapping for US refacing
- Files: verify by DB inspection (not this audit) which category the US
  refacing specialists were imported under. If not `Staircase Refacing`,
  either:
  - (a) update the seed rows so US refacing records carry the same category
    as UK refacing records, OR
  - (b) change `RefacingCompanies` filter to accept a capability-based query
    (`capability=refacing`) not a category query, so US refacing rows appear
    regardless of category name.
- What changes: refacing surface actually shows US + IE refacing specialists.
- Risk: touches production data OR touches Refacing filter semantics — pick
  one; recommend (b) since the memory-locked schema treats capability as
  first-class.
- Test: pick country=USA on refacing page — confirm US refacing records
  visible.

### Slice 4 · Address renderer + region chip labels + country flag
- Files:
  - `src/lib/nex/geography/formatAddress.ts` — new per-country formatter.
  - `src/lib/nex/geography/regionLabel.ts` — new per-country region label
    lookup.
  - `src/app/nex-app/trade/[slug]/page.tsx` — swap `[town, county, postcode]`
    for `formatAddress(seed, { country })`; use `regionLabel(region, country)`
    on the chip; add small country flag/name chip.
  - `src/components/nex-app/refacing/TradeProfileSheet.tsx`,
    `MerchantProfileSheet.tsx`, `ProductDetailsSheet.tsx`,
    `refacing/companies/[slug]/page.tsx`,
    `refacing/companies/client.tsx` (card location line),
    `NexCentreLiveFeed.tsx` (card location line),
    `claim/page.tsx` (locationLine) — all consume `formatAddress`.
- What changes: US card shows "Austin, TX 78701" not "Austin, Travis County, 78701";
  IE card shows correct Eircode format; UK unchanged.
- Risk: touches many card renderers; keep the function pure + snapshot-testable.
- Test: render one seed per country and confirm expected string per country.

### Slice 5 · Kill UK-hardcoded copy on the customer-facing paths
- Files:
  - `src/app/nex-app/refacing/companies/client.tsx` — replace hardcoded
    "UK refacing trades" copy with country-aware copy that reads from the
    selected country ("Trusted {country} refacing trades …") + "All countries"
    variant.
  - `src/app/nex-app/trade/[slug]/page.tsx:84` — metadata description uses
    the seed's actual country, not hardcoded "UK staircase trade".
  - `NexCentreLiveFeed.tsx` — swap `?? "UK"` fallbacks for `?? countryLabel(country)`.
  - Sheets: same.
- Risk: purely cosmetic.
- Test: view each page with country selected and confirm no orphaned "UK"
  literals when country=USA.

### Slice 6 · "Verified only" filter must degrade honestly across countries
- Files: `src/components/nex-app/centre/NexCentreLiveFeed.tsx:225-231`.
- What changes: when the current country has zero `verified=true` records,
  disable the checkbox OR add a hint ("No verified records for this country
  yet"). Do NOT silently return empty results.
- Risk: minimal.
- Test: with country=USA, confirm the filter either disables or explains.

### Slice 7 · Proximity ranking upgraded (postcode centroid resolver)
- Files:
  - `src/lib/nex/geography/postcodeCentroid.ts` — new; wraps the existing
    UK dataset + adds a US ZIP centroid table (small starter dataset OK; or
    latitude/longitude directly from the seed if present) + IE Eircode
    routing key lookup (or simply skip proximity if no data).
  - `src/lib/nex/centre-publishing/indexForSearch.ts` — swap `centroidOf`
    import for the new resolver; pass the country context.
- Risk: touches ranking. Snapshot the current ranking for the UK; regression-test.
- Test: US ZIP `10001` → non-null centroid → NYC merchants rank first.

### Slice 8 · AskNex country awareness (OPTIONAL · nex-brain scope)
- Files: `src/app/api/nex/centre-search/route.ts:35-47`.
- What changes: system prompt derived from the customer's active country;
  spelling + currency conventions swap per country.
- Risk: touches the nex-brain surface — Philip's freeze rules may apply.
  Recommend deferring until after Slices 1-7 land.

### Slice 9 · Schema · service_area (DEFERRED · not required to display USA)
- Add `service_area_countries text[]` (default = `[country]`), migrate,
  extend filters. Only when there is a real "Manchester serves Ireland"
  business worth expressing.

**Order that unblocks USA display fastest:** Slice 1 + Slice 2 alone make
US, IE, and UK records reachable via a country filter on both Trade Centre
surfaces. Slice 3 makes the Refacing surface honest. Slice 4 makes US
addresses stop lying. Slices 5-7 are polish + one ranking hardening. Slice 8
is nex-brain scope. Slice 9 is schema (deferred).

---

## 9. Explicit non-goals for this pass

- No new discovery agents.
- No M6.3 (Stripe) work.
- No NEX brain (M4 / conversation-learning / knowledge-inbox / claim-review)
  changes.
- No schema changes unless flagged as unblocker (none flagged today).
- No changes to the 896 production `directory_seeds` rows.
- No changes to any file under `nex-brain/**`, `nex-conv/**`, or `M4-*`.
- No changes to the non-Trade-Centre "xrated" / "trade-off" / "tc/" apps,
  even where they share UK-shape assumptions.
- No new URL routes; all changes live under existing `/nex-app/centre`,
  `/nex-app/refacing/companies`, `/nex-app/trade/[slug]`, and the existing
  feed API.
- No third-party services or SDKs beyond what the codebase already uses.
- No visual redesign of cards / sheets / filter UI — country dimension slots
  into the existing shape.
