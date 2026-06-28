# Trade Center & Commerce — Foundation Reference

> The catalogue + cart side of the app. What merchants, supply yards, hire shops, and showroom trades configure to sell products direct.

Anchors: every claim is followed by `file:line` or `file`. "Fact" = explicit in source. "Obs" = inferred from comments / cross-reference. All paths absolute.

---

## 1. Which trades get commerce

### `isMerchantGradeTrade()` helper
- **File**: `C:\Users\Victus\trades\src\lib\tradeOff.ts:199-202`
- **Fact**: returns `true` only when `slug` is in the `MERCHANT_GRADE_TRADES` set defined at `tradeOff.ts:188-197`:
  - `building-merchant`, `builders-supplies`, `kitchen-fitter`, `stair-fitter`, `window-fitter`, `security-installer`, `tool-hire`, `heavy-machinery`.
- **Fact (`tradeOff.ts:179-187` comment)**: "Trades whose customers BUY from a catalogue rather than book labour by the hour — merchants, hire firms, and product-configurable installers." These auto-get Shop Mode on the £14.99/mo paid tier; cap of 200 products on paid, unlimited on Verified £20/mo.

### Auto-on Shop Mode behaviour
- **File**: `C:\Users\Victus\trades\src\lib\xratedAddons.ts:370-382` — `isShopModeOn()`.
- **Fact**: returns `true` when either (a) `addons_enabled.shop_mode === true`, or (b) `isMerchantGradeTrade(primary_trade)` — auto-on for the merchant-grade list above on every tier.
- **Storefront gate (`xratedAddons.ts:390-397`)**: `isStorefrontOn()` ORs `shop_mode` and `wholesale_mode` together. Wholesale Mode (£7/mo) includes the storefront for free.

### Sections that imply commerce
- The Shop Mode add-on (`xratedAddons.ts:116-137`, marketed as **"Trade Center"**) — product cards replace the services carousel.
- Services Prices add-on (`xratedAddons.ts:138-159`) — grid pricing with units (per hour / sqm / tree / day).
- Wholesale Mode add-on (`xratedAddons.ts:204-225`) — bulk tiers + distance delivery.
- Materials Network (`xratedAddons.ts:270-291`) — referrals to merchants. Not direct selling, but commercial.

**Fact**: The user-facing brand label for Shop Mode is "Trade Center" (`xratedAddons.ts:118`).

---

## 2. Product data shape

Primary type: `HammerexXratedProduct` at `C:\Users\Victus\trades\src\lib\supabase.ts:259-323`. Table: `hammerex_xrated_products`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (uuid) | Used to derive `ref` code (first 6 hex chars, uppercased) on PDP — `shop/[productSlug]/page.tsx:180-186`. |
| `listing_id` | `string` | FK to `hammerex_trade_off_listings`. |
| `kind` | `"product" \| "service"` | Drives unit semantics. |
| `unit` | `string \| null` | "per hour", "per tree", "per sqm" — Services Prices add-on. |
| `category` | `string \| null` | Customer-facing category. Drives storefront facets — `shop/page.tsx:65-93`. |
| `name` | `string` | Title-case display name. Parenthetical suffix is rendered smaller — `shop/[productSlug]/page.tsx:364-381`. |
| `description` | `string \| null` | Free-form body copy. |
| `specs` | `{ label, value }[] \| null` | Item-Specifics tab; eBay-style. |
| `features` | `string[] \| null` | Bullet list. |
| `faq` | `{ q, a }[] \| null` | Per-product FAQ, max 3 pairs (`supabase.ts:272-275`). |
| `video_url` | `string \| null` | PDP gallery slot. |
| `price_pence` | `number` | Canonical GBP price. |
| `vat_inclusive` | `boolean \| null` | NULL ⇒ seller not VAT registered (`shop/[productSlug]/page.tsx:227-238`). |
| `vat_rate_pct` | `number \| null` | Pairs with `vat_inclusive`. |
| `product_kind` | `"stock" \| "install"` | "install" routes to "Request site visit" WhatsApp flow instead of add-to-cart (`shop/[productSlug]/page.tsx:321-332`). |
| `stock_count` | `number \| null` | NULL = "In stock" (no number); 0 = OOS. |
| `cover_url` | `string \| null` | Card cover. |
| `gallery_urls` | `string[]` | Cap of 4 photos per product (Shop Mode marketing copy). |
| `dispatch_days` | `number \| null` | 0–2 ⇒ green FAST badge (`shop/[productSlug]/page.tsx:458-475`). |
| `variants` | array of `{ axis, axis_label?, label, stock_count?, price_delta_pence? }` | axis enum: `"size" \| "colour" \| "model" \| "material" \| "custom"` (`supabase.ts:285-292`). |
| `size_chart_url` | `string \| null` | Image — locked unit picker. |
| `size_chart_unit` | `"size"\|"kg"\|"litre"\|"cm"\|"other" \| null` | |
| `bulk_tiers` | array of `{ min_qty, max_qty?, price_pence }` | Multi-buy / wholesale tiers. Last tier may omit `max_qty` ("50+"). API enforces ≤5 tiers, ascending min_qty, non-overlapping (`supabase.ts:295-303`). |
| `compare_with` | `string[]` | Manual compare-3 picker IDs (max 2 — `shop/[productSlug]/page.tsx:108`). |
| `status` | `"live" \| "archived"` | |
| `sort_order` | `number` | |
| `slug` | `string \| null` | Per-product URL handle, unique-per-listing (`supabase.ts:307-313`). |
| `featured_at` | `string \| null` | Set when product is dragged into one of 6 Featured slots. |
| `warranty_header` / `warranty_text` / `returns_text` | `string \| null` | PDP overrides; defaults in `WarrantyReturnsBlock`. |

### multi_buy / bulk tiers
- **File**: `C:\Users\Victus\trades\src\components\trade-off\BulkTiersPanel.tsx:1-9` (editor), `C:\Users\Victus\trades\src\components\xrated\profile\BulkTierTable.tsx` (renderer).
- **Fact**: Edits POST to `/api/trade-off/products/upsert` — same endpoint as Shop Mode.
- **Fact**: `tierForQty()` is the shared match helper used by the PDP and the cart's `MultiBuyHint` (`CartPageBody.tsx:625-628`) — keeps cart & PDP consistent.

### Variants
- **Fact (`supabase.ts:285-292`)**: 5 axes — `size | colour | model | material | custom`. `axis_label` carries the freeform axis name when `axis='custom'`.
- **Obs (TS error log, see §9)**: PDP / Modal / ServiceModal still narrow `variantAxis` to `"size" | "colour"` only — the wider enum is in the DB but not yet flowed through to the renderers.

### gallery_urls
- **Fact**: capped at 4 photos. Loaded on ProductModal via `Array.from(new Set(all)).slice(0, 4)` — `ProductModal.tsx:100-102`.

### FAQ (per product)
- **Fact (`supabase.ts:272-275`)**: max 3 `{q,a}` pairs. Renders as collapsible accordion under cover on PDP. Empty/null hides the section.

### Item Specifics (eBay-style)
- **Fact**: `specs: {label, value}[] | null`. Editor: `C:\Users\Victus\trades\src\components\trade-off\ItemSpecsForm.tsx`.

### Compare Products
- **Fact**: `compare_with: string[]` — manual picks (max 2). PDP loads them via `loadCompareTargets()` and renders through `SiblingsWithCompare` / `CompareCell`. Toggle: `isCompareSectionOn()` defaults to ON unless explicitly `false` in `addons_enabled.compare_section` (`xratedAddons.ts:486-491`).

---

## 3. Public product pages

### `/trade/{slug}/shop` — product grid
- **File**: `C:\Users\Victus\trades\src\app\trade\[slug]\shop\page.tsx`.
- **Fact**: Server shell. Loads listing + first `PAGE_SIZE=24` products (`shop/page.tsx:31`) + facets (categories + price min/max). Hands off to `<StorefrontBody>` for search / filter / load-more.
- **Fact**: gates on `isStorefrontOn()` AND `effectiveTier()` ∈ {`app_trial`, `app_paid`} (`shop/page.tsx:135-139`). Anyone else gets `redirect(/${slug})`.
- **Fact**: `ShopCartIsland` sticky cart pinned at bottom (`shop/page.tsx:204`).
- **Public URL pattern (`shop/page.tsx:3-5`)**: lives at `/<slug>/shop` exposed via next.config rewrite (the file path uses `/trade/[slug]` but the customer-facing URL is bare `/<slug>`).

### `/trade/{slug}/shop/{productSlug}` — PDP
- **File**: `C:\Users\Victus\trades\src\app\trade\[slug]\shop\[productSlug]\page.tsx`.
- **Fact**: Server shell, 603 lines. Loads listing → product (by slug) → siblings (4) → compare targets (max 2) → review stats (batched).
- **Layout** (`shop/[productSlug]/page.tsx:13-17` comment): back link → gallery (left) | buy column (right) → siblings → reviews → Q&A (gated) → Warranty & Returns (gated) → StickyBuyBar.
- **Fact**: Generates per-product OG image via `/api/trade-off/product-og?slug=&productSlug=` (`shop/[productSlug]/page.tsx:255-257`).
- **Ref code (`shop/[productSlug]/page.tsx:180-186`)**: first 6 hex chars of UUID, uppercased ("Ref: A4F2K7"). Stable per listing.
- **Install kind** (`shop/[productSlug]/page.tsx:321-332`): when `product_kind='install'`, the buy column swaps the "Add to cart" CTA for "Request site visit" → opens WhatsApp with a survey-booking message. Sticky bar still has a generic "Chat now" WhatsApp link.
- **VAT line** (`shop/[productSlug]/page.tsx:227-238`): Three states — VAT inclusive ("Price includes VAT 20%"), VAT exclusive ("Price does not include VAT" + sub-line "£X inc 20% VAT"), unregistered ("Price does not include VAT — seller is not VAT registered").

### `StickyBuyBar`
- **File**: `C:\Users\Victus\trades\src\components\xrated\profile\StickyBuyBar.tsx:1-30`.
- **Fact**: Fixed-bottom rebuy island; hidden on initial paint, revealed when `#buy-column` scrolls off-screen. "Add to cart" inside the bar smooth-scrolls back to `#buy-column` — the existing `ProductPageAddToCart` island remains single source of truth for cart writes.
- **Fact**: Hidden entirely for `product_kind='install'` (`shop/[productSlug]/page.tsx:571-573`).

### Compare modal
- **File**: `C:\Users\Victus\trades\src\components\xrated\profile\CompareProductsModal.tsx`, cells in `CompareCell.tsx`.
- **Fact**: 3-up compare strip on the PDP, embeds the current product + up to 2 hand-picked `compare_with` IDs.

### Materials Network section (inline teaser)
- **File**: `C:\Users\Victus\trades\src\components\xrated\profile\MaterialsNetworkSection.tsx:1-11` — server component, max 3 merchant tiles.
- **Fact**: Self-hides when listing has zero live picks. Soft disclosure copy lives only on `/<slug>/materials`, not in the teaser.

---

## 4. Cart

### File: `CartPageBody`
- **Server shell**: `C:\Users\Victus\trades\src\app\trade\[slug]\cart\page.tsx:76-116`.
  - Gates on `isShopModeOn || isWholesaleModeOn` AND paid tier (`cart/page.tsx:90-94`). Otherwise redirects to `/${slug}`.
  - Loads `hammerex_xrated_shipping_zones` + a single `hammerex_xrated_wholesale_zones` row.
- **Client body**: `C:\Users\Victus\trades\src\components\xrated\profile\CartPageBody.tsx` (822 lines).
- **State store**: `localStorage` only — never sent to a server (`xratedCart.ts:1-6`).
- **Storage key**: `xrated_cart_v1::<slug>` — scoped per-tradesperson so two profiles on the same device don't share carts (`xratedCart.ts:50-52`).

### Composite cart key
- **Fact (`xratedCart.ts:103-108`)**: `sameLine()` compares `product_id` AND normalised `variant_label`. Two sizes/colours of the same product cohabit as **separate cart lines**.
- **Variant label normalisation** (`xratedCart.ts:68-73`): trims + null-coalesces empty.
- **No threadColor / no other axes**: unlike Hammerex (`productId+size+threadColor`), Trade Off cart key is just `product_id+variant_label`.

### Quantity limits
- **Fact (`xratedCart.ts:48`)**: `QTY_MAX = 99`. `clampQty()` floors and clamps `[1, 99]`.
- **UI stepper (`CartPageBody.tsx:478`)**: disables `-` at 1, `+` at 99.

### Checkout target
- **Fact**: **WhatsApp only** — no Stripe, no card payments.
- **Public cart "Send enquiry on WhatsApp" CTA**: `CartPageBody.tsx:445-456`. Composes a structured message with each line, subtotal, shipping/delivery, VAT (Wholesale), total.
- **Two builders**:
  - `buildWhatsappHref()` (`CartPageBody.tsx:770-821`) — standard retail flow with country zone + air/sea pick.
  - `buildWholesaleWhatsappHref()` (`CartPageBody.tsx:708-768`) — wholesale flow with distance band + min-order.
- **PDP CTAs**: side-by-side "Add to cart" (yellow) + "Enquiry Now" (green `#0F7A3F`) — `ProductPageAddToCart` (`shop/[productSlug]/page.tsx:511-521`).
- **Cart-page metadata** (`cart/page.tsx:69-72`): "No card payments — Firstname confirms the final price." `robots.index: false`.

---

## 5. Shipping

### `ShippingZonesEditor`
- **File**: `C:\Users\Victus\trades\src\components\trade-off\ShippingZonesEditor.tsx:1-9`.
- **Fact**: Per-country air/sea pricing. Curated 30-country shortlist + free-type ISO-2 (`ShippingZonesEditor.tsx:35-66`).
- **API**: `/api/trade-off/shipping-zones/{list,upsert,delete}/route.ts`.

### Two-tier shipping model

There are **two parallel shipping config systems**:

**(A) Per-listing retail shipping** (`HammerexTradeOffListing.retail_shipping_*` — `supabase.ts:216-236`):
- `retail_shipping_mode`: `"free" | "uk_flat" | "uk_areas" | "pickup" | "uk_over_threshold" | null`.
- `retail_shipping_uk_pence` — used when `mode='uk_flat'`.
- `retail_shipping_uk_areas: RetailShippingArea[] | null` — `{ area, price_pence }[]` when `mode='uk_areas'`.
- `retail_shipping_international: RetailShippingIntl[] | null` — `{ country_code, country_name, price_pence, dispatch_days, delivery_days }[]`. Independent of UK mode.
- Editor: `C:\Users\Victus\trades\src\components\trade-off\RetailShippingEditor.tsx`.
- Renders on PDP under VAT row via `shippingSummaryLine()` (`shop/[productSlug]/page.tsx:199-223`).

**(B) Per-listing per-country shipping zones** (`HammerexXratedShippingZone` — `supabase.ts:326-338`):
- One row per `(listing_id, country_code)`.
- `air_price_pence` + `sea_price_pence` + ETA (min/max days).
- Used by the cart page country picker + air/sea mode toggle.

### Shipping modes (mode A)
| Mode | Meaning |
|---|---|
| `"free"` | "Free UK shipping" |
| `"uk_flat"` | One UK price (`retail_shipping_uk_pence`) |
| `"uk_areas"` | Per-area prices ("UK shipping from £X") |
| `"pickup"` | (Inferred — used in edit form's selector; not handled by `BuyColumnDetails` per TS error §9) |
| `"uk_over_threshold"` | (Inferred — used in edit form's selector; not handled by `BuyColumnDetails`) |
| `null` | "Shipping confirmed by WhatsApp" |

### Where shipping cost calculates
- **Retail flow**: `pickShippingPence(zone, mode)` (`CartPageBody.tsx:688-694`) — picks `air_price_pence` or `sea_price_pence` from the selected country zone.
- **Wholesale flow**: `/api/trade-off/wholesale-quote/route.ts` (200 lines). Distance-banded — see §6.

---

## 6. Wholesale Mode add-on

**What it changes** — per `xratedAddons.ts:204-225` and code:
- Adds bulk tier pricing (`bulk_tiers` array on each product).
- Unlocks the **WholesaleDeliveryWidget** in the cart (`CartPageBody.tsx:351-358`) — customer enters their location, gets a live banded distance quote.
- Adds VAT lines to the cart when `listing.wholesale_prices_ex_vat !== false` (`CartPageBody.tsx:72-75`).
- Cart switches to wholesale WhatsApp composer with VAT subtotal + delivery band + km distance (`CartPageBody.tsx:708-768`).
- **PDP**: surfaces `BulkTierTable` under the buy column when `isWholesaleModeOn(listing)` AND tiers present (`shop/[productSlug]/page.tsx:317`).
- Storefront auto-included with Wholesale (no separate Shop Mode toggle needed) — `xratedAddons.ts:390-397`.

**Yard origin** (`HammerexTradeOffListing.wholesale_origin_lat / wholesale_origin_lng` — inferred from `CartPageBody.tsx:69-72`). Editor: `YardOriginEditor.tsx`.

**Delivery zone shape** (`HammerexXratedWholesaleZone` — `supabase.ts:344-359`):
- `free_radius_km`, `free_postcodes[]`, `banded_pricing: { max_km, price_pence, min_order_pence? }[]`, `min_order_pence`, `max_delivery_km`.
- Editor: `C:\Users\Victus\trades\src\components\trade-off\WholesaleZonesEditor.tsx`.

**Files involved**:
- `C:\Users\Victus\trades\src\components\trade-off\WholesaleModeEditor.tsx` (shell — yard / zones / tiers).
- `C:\Users\Victus\trades\src\components\trade-off\WholesaleZonesEditor.tsx`.
- `C:\Users\Victus\trades\src\components\trade-off\YardOriginEditor.tsx`.
- `C:\Users\Victus\trades\src\components\trade-off\BulkTiersPanel.tsx`.
- `C:\Users\Victus\trades\src\components\xrated\profile\WholesaleDeliveryWidget.tsx`.
- `C:\Users\Victus\trades\src\components\xrated\profile\BulkTierTable.tsx`.
- API: `/api/trade-off/wholesale-{origin,zones,quote}`.

**Pricing**: £7/mo (`xratedAddons.ts:215`).

---

## 7. Materials Network

### What it is
- **Marketing copy (`xratedAddons.ts:270-291`)**: tradesperson picks up to 12 builder's merchants they trust; customers tap through to send a WhatsApp quote; tradesperson earns a referral fee when the merchant marks the lead "fulfilled". **Trust-based commission** — no payment plumbing in the app. £3/mo.

### Editor
- **File**: `C:\Users\Victus\trades\src\components\trade-off\MaterialsNetworkEditor.tsx:1-15` (603 lines).
- **Two halves**: merchant picker (search + select up to `MAX_PICKS=12`, drag-reorder, edit intro_note inline) + earnings ledger (read-only).
- **Privacy boundary** (`MaterialsNetworkEditor.tsx:8-11`): customer name / WA / postcode never reach this surface — server strips them. The earnings ledger also strips them by design (`supabase.ts:566-568`).

### Public render
- **Inline teaser**: `C:\Users\Victus\trades\src\components\xrated\profile\MaterialsNetworkSection.tsx` — max 3 merchant tiles on profile.
- **Dedicated page**: `C:\Users\Victus\trades\src\app\trade\[slug]\materials\page.tsx` — full list + always-rendered soft disclosure ("$firstName may earn a referral fee from these merchants — it costs you nothing extra" — `materials/page.tsx:158-163`).
- **Merchant deep-link**: `C:\Users\Victus\trades\src\app\trade\[slug]\materials\[merchantSlug]\page.tsx` — "you're here via {tradie}" presentation + `MaterialsQuoteButton` that POSTs to the referral-create API then opens WhatsApp with the `MN-{ref_code}` attribution token.

### Data shape
- `hammerex_xrated_merchant_picks` (`supabase.ts:549-558`): `{ tradie_listing_id, merchant_listing_id, intro_note ≤200 chars, sort_order, status }`.
- `hammerex_xrated_merchant_referrals` (`supabase.ts:569-596`): `ref_code` (human-visible "MN-A4F2K7"), 24-hour last-click sticky dedup, fulfillment status enum (`pending | fulfilled | declined | expired | disputed`).
- `hammerex_xrated_tradie_earnings` (view, `supabase.ts:600-607`): aggregated counts + commission totals. Read-only.

### API routes
- `picks/{list, upsert, delete, reorder, suggestions}` — pick CRUD + search.
- `referrals/{create, fulfil, decline, list}` — referral lifecycle.
- `commission/upsert` — merchant-side commission-rate config.
- All under `C:\Users\Victus\trades\src\app\api\trade-off\materials-network\`.

---

## 8. Pricing display

### Multi-currency / FX
**Multi-currency IS present.** This is a deviation from the brief's assumption that it shouldn't be here.
- **File**: `C:\Users\Victus\trades\src\lib\fx.ts` (24 lines).
- **Fact (`fx.ts:1-9`)**: canonical pricing is GBP; FX is **display-only**, labelled "indicative". Rates last verified `2026-06-23` against XE mid-market. Same shape as the Hammerex (`hammer`) repo so the helpers port line-for-line.
- **Supported display currencies**: `GBP | USD | EUR | AUD` (`CurrencyDropdown.tsx:19`). IDR is kept as the cross-rate denominator only (not exposed in UI — `fx.ts:14-16`).
- **Components**:
  - `C:\Users\Victus\trades\src\components\xrated\profile\CurrencyDropdown.tsx` — display picker pill, persists choice to `localStorage` key `xrated_currency`, broadcasts via `CustomEvent`.
  - `C:\Users\Victus\trades\src\components\xrated\profile\PriceDisplay.tsx` — converts via `IDR` cross-rate; always shows the real GBP underneath in muted grey.
- **Surfaces**: PDP only — `shop/[productSlug]/page.tsx:400-401`. Cart, ProductCard tile, ShopTeaser, CompareCell all use raw `formatGbp()` from `xratedCart.ts:251-257` or local helpers.

**Assessment**: this matches the brief's note that IDR was imported from Hammerex/Indocity. The actual customer-facing UI exposes GBP + 3 tourist currencies (USD/EUR/AUD) — not IDR. Whether to keep this at all on a UK-only product is an open call.

### Per-trade theme accent
- **Fact**: `themeColor = listing.theme_color || "#FFB300"` (`shop/[productSlug]/page.tsx:309`). Default Hammerex-yellow. Plumbed into `ProductCard`, `ProductCardGrid`, `ProductPageAddToCart` for accent fills.

---

## 9. Known gaps and tech debt

### Pre-existing TypeScript errors in commerce code

From `npx tsc --noEmit`:

1. **`src/app/trade-off/edit/[slug]/page.tsx:162`** — TS2739
   Starter-products 4th slot literal is missing `gallery_urls` and `faq` fields (slots 0–2 have them, slot 3 doesn't). Object literal shape drift.

2. **`src/app/trade-off/signup/TradeOffForm.tsx:165`** — TS2739
   Same pattern as above — starter-products 4th slot is missing `gallery_urls`, `variants_axis`, `variants_axis_label`, `variants_rows`, `faq`.

3. **`src/app/trade/[slug]/shop/[productSlug]/page.tsx:394`** — TS2322
   `listing.retail_shipping_mode` type includes `"pickup" | "uk_over_threshold"` but `BuyColumnDetails` prop type only accepts `"free" | "uk_flat" | "uk_areas" | null | undefined`. PDP doesn't know about pickup or threshold modes.

4. **`src/components/xrated/profile/ProductModal.tsx:116`** — TS2322
   `variants[0].axis` is `"size" | "colour" | "model" | "material" | "custom"` but `variantAxis` is typed `"size" | "colour"`. New axes (model/material/custom) added to schema, modal renderer not yet updated.

5. **`src/components/xrated/profile/ProductPageAddToCart.tsx:49`** — same as ProductModal (TS2322).

6. **`src/components/xrated/profile/ServiceModal.tsx:79`** — same as ProductModal (TS2322).

7. **`src/lib/demoTradeSeeds.ts:67-71`** — TS5097 (5 lines)
   Import paths end with `.ts` extension without `allowImportingTsExtensions` enabled. Not strictly commerce, but seeds the demo products.

**Total: 10 TS errors** in commerce / commerce-adjacent code. Of those, 4 (#3–#6) are clearly load-bearing schema drift: variants gained 3 new axes (`model | material | custom`) and shipping gained 2 new modes (`pickup | uk_over_threshold`) but the consuming UI components weren't updated.

### Other observations
- `ShopModeEditor.tsx` is **2958 lines** — significant size, ripe for split (Obs).
- Cart never persists server-side; loss on device wipe / cross-device move. Stated intent per `xratedCart.ts:1-6` (Fact).
- `materials_network` referrals depend on merchants self-marking "fulfilled" — no enforcement (Fact, `xratedAddons.ts:283-289`).
- `ProductModal.tsx` still exists alongside the dedicated PDP — modal opens via `ProductCard.tsx` (Fact, `ProductCard.tsx:26-37`), but `ShopTeaser` uses `ProductCardLink` to navigate to the PDP instead (`ShopTeaser.tsx:5-9`). Two competing card-tap behaviours coexist depending on which surface renders the card.

---

## Rough Lines-of-Code totals

| Bucket | LoC |
|---|---|
| Page shells (cart, shop, PDP, materials × 2) | 1,364 |
| Commerce components (`profile/Product*`, `Cart*`, `Shop*`, `Compare*`, `BulkTier*`, `Wholesale*`, `Materials*`, `Sticky*`, `Siblings*`, `QtyStepper*`, `PriceDisplay*`, `CurrencyDropdown*`, `Warranty*`, `PaymentIcons*`) | 6,824 |
| Dashboard editors (ShopMode, BulkTiers, Shipping, Materials, Wholesale × 2, RetailShipping) | ≈ 4,500 (ShopMode alone 2,958; remainder ≈ 1,500) |
| Cart library + Materials helper | 330 |
| API routes (products, shipping-zones, wholesale-{quote,zones,origin}, materials-network) | 3,644 |
| **Total commerce footprint** | **≈ 16,700 LoC** |
