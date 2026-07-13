# ADR-0008: Per-product surface flags

Status: Accepted
Date: 2026-07-13

## Context

A canteen product can appear on three surfaces: the merchant's canteen page (Products tab), the trending swipe sheet on the mobile app, and the Trade Center marketplace. Previously, Trade Center visibility was controlled by a merchant-wide `send_to_trade_center` toggle — the merchant chose "all products go to TC" or "none do". Trending visibility had no toggle at all — every product was eligible.

That model breaks the single-upload workflow. A merchant with one item they want to keep canteen-exclusive (a bespoke piece, a discounted line only for local buyers, a specialised skill they don't want the marketplace to commoditise) had to duplicate their whole product schema or opt-out globally. Neither is right.

The user was explicit: **upload once, flow to every surface where the merchant has paid membership, with per-surface control per product.**

## Decision

Every canteen product row carries three independent boolean flags:

- `show_in_canteen_products` — the canteen page Products tab
- `show_in_trending` — the trending swipe sheet
- `show_in_trade_center` — the Trade Center marketplace

All three default to `true` so existing rows behave identically to before. Every filter that reads products checks its own flag before rendering.

The merchant-wide `send_to_trade_center` flag stays as a **master switch** — Trade Center listing additionally requires it to be `true`. Two gates protect the marketplace: the merchant's tier + preference, and the per-product decision. Defence-in-depth against a merchant flipping the master off but leaving per-product flags stuck on.

Editor UI: three toggle cards in the "Where this product shows" section of `/trade-off/edit/[slug]/products/[id]`. Locked toggles (below the merchant's tier) render an upgrade CTA instead of a disabled state, per feedback memory `studio_add_library_upgrade_path`.

## Consequences

- **Positive:** True one-upload-many-surfaces workflow. A merchant edits a product once, then decides where each product should live independently. This is the "Business OS" pattern, not the marketplace pattern.
- **Positive:** Enables merchant strategies — "canteen for premium bespoke, Trade Center for shipped commodities" without duplicate inventory. Encourages TC adoption because the merchant retains control per product.
- **Positive:** Makes tier upgrades concrete. Free tier sees "trending" and "Trade Center" as locked cards with an upgrade CTA next to each product they'd have posted anyway. Every product edit is a lightweight upsell moment.
- **Positive:** Defence-in-depth against tier-flip abuse: even if the merchant's master switch stays on after a downgrade, per-product flags remain the operational gate.
- **Negative:** Three columns to migrate, three filters to keep in sync. If any filter is missed at read-time, a hidden product leaks. Read paths audited: `productsForCanteenFromDb` (filtered at shell via `publicProducts`), `browseAllProductsFromDb` (filtered inside the query), trending ribbon (filtered inside `CanteenPageShell` before prop pass).
- **Neutral:** Trade Center now has two independent gates (merchant master + per-product flag). The extra check is invisible to merchants but changes ops mental model for support ("if a product isn't showing on TC, check both").

## Alternatives considered

- **Keep the single merchant-wide `send_to_trade_center`** — rejected. Too coarse. Forces merchants into "all or nothing" and blocks the exact workflow they asked for.
- **One `visible_surfaces` array column (`{"canteen", "trending", "trade_center"}`)** — rejected. Array containment queries are harder to index than boolean columns on Postgres, and the UI toggles map 1:1 to columns anyway.
- **Per-product `send_to_trade_center` only, no per-product flags for canteen/trending** — rejected. Trending needs its own gate for the same reasons TC does — merchants want to feature-tune their swipe sheet without hiding a product from their own page.
- **Move all surface logic into a "channels" side-table** — over-engineering for 3 booleans. Would be right if the surface count ever grows past 5–6.
