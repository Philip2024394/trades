# ADR-0015 · Canteen page and mobile-app template are decoupled surfaces

**Status:** accepted
**Date:** 2026-07-17
**Deciders:** Philip

## Context

Merchants have a public canteen page (`/trade-off/yard/canteens/[slug]`) and a mobile-app view (same URL + `?embed=1`) that renders inside a phone-mockup iframe on the templates picker (`/trade-off/edit/[slug]/templates`).

The templates picker exposes style controls (base hue, lightness, palette intensity, theme mode, hero shade, feed tile color, feed tile image) that persist to `hammerex_canteens`. Over successive iterations these style columns started bleeding into the canteen page renderer:

- `theme_mode="dark"` flipped the canteen page background to `#0A0A0A`, silently violating the golden rule that the canteen page bg is always platform off-white `#FBF6EC` (see `feedback_canteen_page_bg_white.md`).
- `feed_tile_color` / `feed_tile_image_url` overrode the canteen's Live Feed tile background.
- The palette generator produced hero last-word colors, feed tile fallback colors, and dark-mode surfaces on the canteen page.

Philip's directive (verbatim): "we need now stop and seperate the mobile app totally from cateen ui design . i dont want the app view template updating the ui - only data connected . revert back the app template design."

## Decision

The route `/trade-off/yard/canteens/[slug]` renders two visually distinct surfaces determined by `?embed=1`:

- **Canteen page (default)** — public trade page. Fixed platform design. Reads only DATA from `hammerex_canteens` (name, tagline, posts, products, members, reviews, host WhatsApp, header bg image). All style columns are ignored.
- **Mobile-app view (`?embed=1`)** — templates picker preview. Full consumer of the merchant's style columns (base_hue, lightness, palette_intensity, theme_mode, hero_shade, feed_tile_color, feed_tile_image_url). This is the only surface where those columns render.

## Enforcement

The split is enforced in three places:

1. **`page.tsx`** — computes palette / darkMode / heroVeilOpacity inside `if (isEmbedded)`. On the canteen path it passes `DEFAULT_PALETTE + darkMode=false + heroVeilOpacity=1` — the fixed platform defaults.
2. **`CanteenPageShell.tsx`** — every merchant-style read (`canteen.feedTileColor`, `canteen.feedTileImageUrl`) is gated by `isEmbedded` and falls back to fixed platform values. Page bg is a string literal `#FBF6EC` on both wrappers (already enforced pre-split).
3. **`Template.tsx`** — canteen-page-only chrome (Members/Products stats bar) is gated by `!isEmbedded` so it never bleeds into the mobile app preview.

## Consequences

**Good:**
- Merchant cannot break the canteen page design through the templates picker.
- Templates picker style controls remain fully functional, but affect only the mobile app preview.
- Every future style-driven property has one obvious home: the embed branch.

**Trade-offs:**
- Two paths through the same URL. Reviewers must remember the branch when touching any style-driven code.
- The `hammerex_canteens` row still carries columns that don't affect the canteen page. This is deliberate — they belong to the mobile app view. Columns will not be dropped.

## References

- Memory: `feedback_canteen_page_bg_white.md` (golden rule + enforcement notes)
- Related: `feedback_desktop_ipad_source_of_truth.md`, `feedback_canteen_mobile_app_off_limits.md`
