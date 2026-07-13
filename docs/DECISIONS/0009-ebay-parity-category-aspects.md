# ADR-0009: eBay-parity fields + category-driven Item Specifics

Status: Accepted
Date: 2026-07-13

## Context

The product editor started as a light form (name, price, image, blurb) and grew iteratively as we hit specific merchant scenarios. Before shipping Trade Center to real buyers we ran a full-scan of eBay UK's `AddItem` / `AddFixedPriceItem` field surface (Trading API docs + Seller Centre help + Taxonomy API) to gap-analyse what we collect. Result: eBay collects ~90 fields per listing across title, category, aspects, condition, description, format, variations, shipping, returns, business, tax, compliance, promotion. We had ~35.

Some of those gaps are legal (VAT/EPR) and stay on the merchant profile, not per-product. But three product-level gaps were critical enough to close before Trade Center opens:

1. **No category taxonomy on canteen products.** Trade Center browse filtered by trade, not by product category — so a buyer looking for "kitchen worktops" saw all products from every kitchen fitter, not just worktops.
2. **No per-category item specifics ("Aspects").** A power-tool listing and a paint listing had the same free-text `specs` array. Facet filtering was impossible.
3. **Condition, MPN/GTIN, dimensions, dispatch time, returns, compatibility, age restriction — all missing.** These are how buyers evaluate trust and how buyers filter.

## Decision

**Extend the existing `productCategories.ts` taxonomy** (originally built for the old `hammerex_xrated_products` table) to cover the full trade — 21 leaf categories from Cement & Aggregates to Heating & Boilers. Each category owns a typed `SpecField[]` — required / recommended / optional — with dropdown value lists for the ~70% of aspects that are enum-shaped. Free-text falls back to string input. This is directly modelled on eBay's Aspects system.

**Persist per-product** on `hammerex_canteen_products` via two new columns:

- `category_slug text` — indexed. The leaf category the product belongs to.
- `category_aspects jsonb` — `{ [aspectKey]: string | number }`. Values against the chosen category's schema.

**Editor UI** — Category is the first section in the form. Picking a category dynamically renders the aspects panel (Required in accent, Recommended below, Optional collapsed in `<details>`). Changing category resets aspects — no leaky keys.

**Extend the commerce block** with the missing eBay-critical fields on `commerce jsonb`:

- Identifiers: `brand`, `model`, `mpn`, `gtin` (all separate — eBay treats them independently)
- Condition ladder: 6-way (New / New-other / Certified-refurbished / Seller-refurbished / Used / For-parts) + a `conditionDescription` free-text field
- Physical: `weightKg`, `lengthMm`, `widthMm`, `heightMm`, `dispatchDays`
- Returns: `{accepted, windowDays: 14|30|60, paidBy: buyer|seller, restockingFeePercent}`
- Compatibility: `{label, value}[]` — "Fits X" fitment matrix
- Age restriction: `16 | 18 | null`

## Consequences

- **Positive:** Trade Center browse can filter by category + facet on aspects — the eBay/Shopify/Amazon UX buyers expect. Search relevance goes from "product name matches" to "product name matches AND correct category AND matches selected aspects".
- **Positive:** Buyers see condition, dispatch, returns, dimensions — the trust signals that drive marketplace conversion. Without them we look amateur next to eBay.
- **Positive:** MPN + GTIN enable product-catalog matching later (multiple merchants selling the same SKU can be grouped, price-compared, or auto-deduped).
- **Positive:** Compatibility fitment is a trade-specific edge — "fits Worcester Greenstar 30i" is exactly how tradespeople search for parts. eBay does this only for Parts & Accessories; we make it available on every product.
- **Positive:** The 21-category taxonomy lives in code (`productCategories.ts`), not in the DB. Adding a category = code change + deploy, no migration. Trade the "editable at runtime" flexibility for "no drift between schema + code" simplicity.
- **Negative:** ~55 new form fields in one editor. Long form. Mitigated by: mobile-first stacking, `<details>` collapse for optional aspects, sectioned card layout, sticky save bar. Merchants only touch fields they care about — nothing is required except name.
- **Negative:** Pre-migration rows with `condition="refurbished"` render as empty in the new dropdown. Small migration cost — merchants re-pick between certified-refurbished / seller-refurbished on next edit. Not worth a data-migration script for the tiny number of demo rows.
- **Neutral:** The taxonomy is intentionally shallow (1-level, 21 leaves). eBay is 4-6 levels. We may deepen later, but a flat list is faster to pick from on mobile — the eBay category-picker's tree navigation is notoriously slow.

## What's not built (yet)

- **Buyer-side faceted filter surface on Trade Center browse.** The category_aspects data is captured but browse doesn't yet render dynamic facet chips. Adding this is straightforward — group products by aspect value per category.
- **Business seller profile (VAT number, business address, VAT rate).** Legal for UK business sellers but belongs on the merchant profile, not the product editor. Own ADR when it lands.
- **EPR / WEEE / hazmat compliance IDs.** Also merchant-profile-scoped. Add when we have a merchant hitting the volume threshold.
- **Product-catalog matching from MPN/GTIN.** Data is captured; the "we found 3 other merchants selling this SKU" dedup surface is a future feature.
- **Compatibility as a filter surface.** Data captured; the "find parts that fit my X" filter UI ships when compatibility data density warrants.
- **Variation-level per-variant SKU / photo / price.** Current variant model is single-price. Extending is a schema decision worth its own ADR.

## Alternatives considered

- **Store aspects on `hammerex_canteen_products` as columns** — rejected. 21 categories × 5-8 aspects each = 100+ columns, most sparse. JSONB is the right shape.
- **Runtime-editable taxonomy in a DB table** — rejected for v1. Adding categories is rare (weekly at most). Code-first is faster to review + typecheck. Migrate to DB when merchants request custom aspects.
- **Match eBay's 4-level tree exactly (Home > DIY > Timber > Plywood > 18mm)** — rejected. Merchants can't navigate a 4-level tree on mobile in under 20 seconds. Flat list with 21 well-chosen leaves beats deep tree for this scale.
- **Reuse the old `hammerex_xrated_products` table** — rejected. Canteens are the future; xrated products is legacy. Aspects moving to the new table is the right migration direction.
- **Delay this and ship the marketplace without aspects, add later** — rejected. Once real listings exist we can't re-key aspects onto them retroactively without merchant work. Capture from day 1, filter/facet later.
