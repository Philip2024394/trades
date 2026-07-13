# ADR-0012: Consumer-side variant picker (shared, mobile-first)

Status: Accepted
Date: 2026-07-13

## Context

ADR-0011 captured per-variant SKU / photo / price / stock on the merchant editor. Every override was persisted, every schema was ready — but no buyer ever saw them. The product detail surfaces (`ProductQuickView` inside `CanteenTabbedSection`, `CanteenTrendingSwipeSheet`) still displayed the base product's price and image regardless of variant. All the merchant work was invisible.

Every marketplace competing with eBay renders a variant picker on the buyer's PDP — size chips, colour swatches, live price update, image swap, out-of-stock indicators. Without it, per-variant pricing is a private schema, not a feature.

The build order is intentional: capture first, render second. Now render.

## Decision

Ship a **shared `CanteenVariantPicker` component** consumed by every product surface that renders a canteen product. Mobile-first chip rows for size + colour; internal state; emits the resolved `VariantSelectionState` upward via `onChange` so each surface can:

- Swap the visible image (variant's image override, or base)
- Update the visible price (variant's price override, or base)
- Include the selected variant in WhatsApp deep-links (`"I'm interested in Kitchen Base Unit (M · Ivory Mist)"`)
- Include the combo key in Trade Center URLs (`?v=M|Ivory Mist`) for downstream pre-selection

**Location:** `src/components/xrated/yard/CanteenVariantPicker.tsx`.

**Design rules:**

- **Mobile-first chip rows.** No dropdowns, no modal-inside-modal. Chip rows read on a phone.
- **44px min tap target** on every chip (mobile HIG).
- **Colour swatches** use the merchant-set hex when provided; fall back to name-only chips.
- **Out-of-stock chips** greyed + line-through, but remain tappable. Buyer can still enquire (WhatsApp message auto-appends "is this variant back in stock?").
- **Default selection** = first option on each axis. Buyer sees a sensible price from first render, doesn't have to tap to see anything.
- **Selected state** = brand-yellow (#FFB300) chip with dark neutral border for contrast.

**State management:**

- Picker owns internal `selectedSize` / `selectedColor` state.
- Parent gets the resolved combo via `onChange(state)`.
- In the swipe sheet, per-item selection state is keyed by item id so swiping between items preserves each item's choice independently.

**Wired surfaces this ADR:**

- `ProductQuickView` in `CanteenTabbedSection.tsx` — canteen page product detail
- `CanteenTrendingSwipeSheet` — trending category swipe view

**Not wired yet (deferred):**

- `/tc/product/[slug]` PDP — Trade Center marketplace product page. Data flows through (URL carries `?v=` combo key) but the PDP itself doesn't yet consume the picker. Own follow-up.

## Consequences

- **Positive:** Everything captured in ADR-0011 is now visible to buyers. A merchant selling "M/L/XL at £29/£32/£35 with 3 different colour photos" now sees the buyer's selection reflected in the CTAs.
- **Positive:** Mobile-first pattern that matches the trades' phone-primary usage. No dropdown-inside-modal soup.
- **Positive:** WhatsApp messages now contain the exact variant — merchant knows immediately what the buyer wants without a back-and-forth clarification.
- **Positive:** Trade Center URLs carry the combo key so a marketplace click-through preselects the same variant. Prevents the "buyer picked Navy in the canteen sheet, lands on TC PDP showing Ivory Mist by default" friction.
- **Positive:** Shared component. Any new surface that needs to render a canteen product (widget on Notebook, embed on external site, etc.) gets variant support "for free".
- **Negative:** Default-first-option selection can be misread as "the merchant recommends this size". Mitigated by the "You've selected" label under each axis making the selection explicit. Watching for real-buyer confusion.
- **Negative:** Out-of-stock chips staying tappable is a bet — some marketplaces disable them entirely. We keep them enquiry-able because our WhatsApp handoff means the merchant can still confirm restock timing. If click-through-to-OOS drives support tickets, revisit.
- **Neutral:** `CanteenTrendingSwipeSheet` now stores per-item variant state in a `Record<itemId, state>` so swiping doesn't lose selections. Extra memory footprint is trivial (small state per item, cleared on category change).

## Alternatives considered

- **Dropdown per axis instead of chip rows** — rejected. Chips are more scannable on phones and match every other marketplace UX (Amazon, ASOS, Shopify).
- **Force buyer to make a selection before showing price** — rejected. Blank price makes buyers bounce. Default-to-first with clear "You've selected" is friendlier.
- **Disable out-of-stock chips entirely** — rejected. Our WhatsApp handoff means restock enquiries are the whole point. Disabling kills the enquiry path.
- **Bottom-sheet modal picker** (like some ecommerce apps) — rejected. Inline chip rows below the price are one gesture; a modal is two. Won't add a modal for what's already a modal (in `ProductQuickView`).
- **Build per-surface pickers (no shared component)** — rejected. Guarantees divergence over time. One canonical picker means one place to fix bugs, one place to redesign, one place to add features (stock badges, sale prices, per-variant reviews later).

## What's not built (deferred)

- **Trade Center PDP (`/tc/product/[slug]`) consumption of `?v=` URL param.** URL is emitted from every surface but the PDP itself needs a separate ADR — the marketplace PDP has its own layout + checkout wiring that's out of scope here.
- **Per-variant reviews rollup.** eBay doesn't do this either. Skipping.
- **Variant image gallery** (multiple photos per variant). Currently one image override per variant. Extending to arrays is straightforward when the merchant demand materialises.
- **Variant availability by postcode / region.** Deferred until international shipping density warrants.
- **Bulk-buy tiers applied per-variant.** Currently multi-buy is product-level. Per-variant multi-buy is a small extension when needed.
