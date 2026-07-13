# ADR-0011: Per-variant SKU / photo / price via override map

Status: Accepted
Date: 2026-07-13

## Context

The initial variants shape (ADR-0009 addendum) stored flat lists of size labels and colour options. Every variant of a product shared a single price, image and SKU pulled from the product-level fields. A merchant selling a T-shirt in Black, White and Navy could not:

- Charge £2 more for the Navy variant
- Show a different photo per colour (buyers can't see what "Navy" looks like)
- Assign a different SKU per size/colour (breaks inventory management + returns)
- Track stock separately per combination (out-of-stock Navy still appears available)

eBay solves this with a full variation matrix: each variant row is a first-class row with its own SKU, price, quantity and up to 12 photos. That's overkill for our current merchant scale but the direction is right — buyers expect per-variant pricing on any marketplace that competes with eBay.

## Decision

Extend the existing `variants` JSONB shape with an **`overrides` map** — no new column, no new table. Keys of the map are stable combo keys derived from the axis + option lists:

- `axis="size"` → the size label (`"M"`, `"L"`, `"10"`)
- `axis="color"` → the colour name (`"Ivory Mist"`)
- `axis="size_color"` → `${size}|${color}` (`"M|Ivory Mist"`)

Each override is a partial that can carry any subset of `{ sku, imageUrl, priceGbp, stock, mpn, gtin }`. Missing fields fall back to the product-level values. Empty overrides object (or absent key) means "identical to base product".

**Editor UI** (`PerVariantDetails` in `ProductEditorForm.tsx`):

- Renders one collapsible row per combo. Row title = combo label ("M · Ivory Mist"); body = SKU + image upload + price override + stock + MPN + GTIN.
- Compact by default — merchant sees the combo label, effective price, stock badge, SKU. Expands only when clicked, so a product with 20 variants doesn't dump a wall of fields.
- Yellow badge on the row shows the number of overridden fields at a glance.
- Copy-from-previous shortcut lets the merchant clone another variant's overrides (excluding image, which is always variant-specific).
- Reset button per row wipes that variant's overrides in one click.
- Image upload reuses `/api/trade-off/canteen-product/upload-image` — same endpoint, no new API surface.

**Save API** — the sanitiser accepts the map, coerces every field defensively (SKU length capped, price ≥0, stock 0–100k, MPN/GTIN length capped), and drops empty stubs.

**Backward compatibility** — existing products with variants but no `overrides` continue to work: every combo uses the base price / image / SKU as before. No migration needed. Rows written before this change simply have `overrides: undefined`.

**Cleanup logic** — when `buildVariants()` runs, it drops any override key that no longer matches a valid combo (merchant removed a size/colour while an override lingered). Prevents orphaned data.

## Consequences

- **Positive:** Real variant selling unblocked. Merchants can now genuinely list "M/L/XL at £29/£32/£35" or "same shirt in 4 colours with different photos". This is table-stakes for a marketplace competing with eBay.
- **Positive:** Backward-compatible. Zero-override products work unchanged. Migration = no-op.
- **Positive:** Storage cost tiny. An override is only stored when non-empty; empty stubs are pruned. A product with 30 variants and no overrides adds zero bytes over the current shape.
- **Positive:** One image endpoint. `/api/trade-off/canteen-product/upload-image` handles per-variant uploads without modification — the URL is stored on the override, not on a separate "variant images" table.
- **Negative:** JSONB queries for "find products where a specific variant is in stock" are awkward. Not a problem until Trade Center browse wants to render variant-level facets (e.g. "Colour: Navy, in stock"). At that point we consider a normalised `product_variants` table.
- **Negative:** Consumer surfaces (`ProductQuickView`, `CanteenTrendingSwipeSheet`, Trade Center PDP) don't yet render a variant picker. Data is captured but not shown to buyers. Explicitly out of scope for this ADR — a follow-up ADR wires the buyer UI.
- **Neutral:** The merchant-side `copy from previous` shortcut is opinionated (excludes image copy). If merchants complain, we revisit. For now, image-per-variant is the whole point of overriding.

## What's not built (deferred)

- **Consumer-side variant picker.** Buyer's product view still shows the base product only. Building the picker requires reading `overrides` from `CanteenProduct.variants` and rendering a chip row per axis; picked combo swaps the visible image + price. Own ADR when it lands (ADR-0012 candidate).
- **Per-variant stock enforcement.** We store stock counts but don't decrement them on sale. Ties into whether Trade Center handles checkout end-to-end or defers to WhatsApp handoff. See ADR-0003.
- **Bulk-editing (spreadsheet-style)**. eBay lets sellers edit variations in a table. Deferred until merchants ask for it.
- **Variation-level GTIN validation** (check digit). Deferred — Grow to it if bad barcodes become a support problem.

## Alternatives considered

- **New `product_variants` table** — rejected for v1. Normalised schema is right long-term but too much migration cost while variants remain rare in our data. If variant density passes ~10% of listings, revisit.
- **Store overrides on a sibling column (`variant_overrides jsonb`)** — rejected. Keeping overrides inside `variants` means the shape stays cohesive and every variant read is one column. Splitting adds join overhead for zero benefit at this scale.
- **Match eBay exactly (up to 5 axes, 250 variations, per-variant everything)** — rejected. Overkill. Two-axis (size + colour) covers ~95% of trade goods. Extending to 3+ axes is straightforward when needed.
- **Force the merchant to fill every override before enabling variants** — rejected. Too much friction. A merchant selling 3 sizes at one price should still work.
