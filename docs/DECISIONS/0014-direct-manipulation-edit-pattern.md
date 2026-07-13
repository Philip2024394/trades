# ADR 0014 — Direct-manipulation edit pattern

**Status:** Accepted
**Date:** 2026-07-14
**Deciders:** Philip
**Supersedes:** N/A
**Superseded by:** —

## Context

Merchants on Thenetworkers need to manage a lot: their canteen appearance, products, services, live listings, kitchen designs (or trade equivalent), profile, trending strip, reviews, members, plan and storage, and (soon) more.

Two competing UI paradigms exist in the codebase as of 2026-07-14:

1. **Shadow admin dashboards** — separate pages at routes like `/trade-off/yard/manage`, `/trade-off/yard/canteens/{slug}/manage`, and `/trade-off/edit/{slug}/**` (33 sub-features). Each hosts a list-of-things with per-row action buttons.
2. **Direct manipulation** — edit-in-place on the thing you're looking at. The Edit-mode carousel on the canteen (added this iteration) and the 3-dots menu on each Yard post card (also this iteration) both follow this pattern.

Both paradigms currently co-exist for the same domain objects (Yard posts had `/yard/manage` AND now 3-dots on cards; canteen had `/canteens/{slug}/manage` AND now the Edit-mode tile carousel). Left unchecked, this drift will produce N different admin paradigms for N surfaces and merchants will re-learn each one.

Reference platforms cited in the Trade Center thesis (memory: `project_trade_center_is_os_not_ecommerce`) — Figma, Linear, Slack, VS Code, Stripe, Notion — universally use direct manipulation for object-level editing. None of them ship a `/manage/frames` page.

Baymard's field-count research (surfaced during Pricing & Delivery consolidation this session) also supports the pattern: fewer surfaces, fewer fields per surface, less merchant abandonment.

## Decision

**Direct manipulation is the canonical edit pattern for every merchant-owned domain object on Thenetworkers.**

Concretely:

1. **Object-level actions live on the object.** A product's Edit / Boost / Archive / Delete controls live on the product card, not in a `/products` admin list. Same for Yard posts, comments, reviews, members, kitchen designs.
2. **The interaction surface is a 3-dots menu** (`MoreHorizontal` Lucide icon) top-right of the card, visible only when the signed-in viewer owns the object. Desktop renders it as a dropdown; mobile renders it as a bottom sheet. Reference implementation: `src/components/xrated/yard/PostCardActionsMenu.tsx`.
3. **Surface-level actions live in a tile carousel** on the surface itself, gated by Edit mode. The canonical example is the canteen's Edit-mode carousel (Add Product, Add Service, Live Listing, Kitchen Designs, Edit Profile, Edit Trending, Manage Reviews, Plan & Storage, Members, Reviews, plus the hero-level Button Features button). Every tile turns yellow when its flow is open and its inline panel renders directly under the carousel.
4. **A single Edit-mode toggle** in the AppShell chip (top-right, visible on every page and every breakpoint) is the only entry point to editing. No per-page duplicate toggle buttons.
5. **Documentation is a first-class tile.** Button Features lives as a hero-level yellow pill (above the carousel) and opens an inline documentation panel that names every tile, what it does, where its output surfaces, and its current status (Live / Coming soon). This is both onboarding and internal spec.
6. **Shadow admin pages retire.** Existing pages under `/manage` and `/edit/{slug}/**` are backing surfaces during migration — they redirect (`/yard/manage` → `/yard?mine=1`, 2026-07-14) or are linked from within the equivalent Edit-mode tile. When their sections are fully ported to inline panels, the shadow page is deleted.

## Consequences

**Positive:**

- Merchants learn ONE interaction paradigm across the platform. Every action on a card is `⋮` → menu. Every surface-level action is a tile in the Edit-mode carousel. No relearning.
- No context switching. Merchants edit where they see, not in a separate admin. Matches Figma/Linear/Slack thesis.
- Contextual editing reduces destructive mistakes — you delete the post you're looking at, not a row 8 of a table.
- The pattern is composable — new domain objects just get a card with a 3-dots menu; new surface actions just get a tile in the carousel.
- Fewer pages to maintain. `YardManageList.tsx` (~700 lines) was deleted this session with zero functionality loss; the pattern lets us retire more as they get ported.

**Negative:**

- Bulk-editing many objects at once (e.g. "archive all 40 old posts") is harder than a list view with checkboxes. Acceptable trade-off for now — bulk editing is rare and can be added later as a "Select mode" toggle inside a filter chip if merchants ask for it.
- Some functionality (e.g. Stripe boost checkout, storage-meter progress, Founding-100 gamification) currently lives on `/canteens/{slug}/manage` and hasn't been ported to inline panels yet. Bridge implementation: the Plan & Storage tile shipped this session opens a panel that links to the classic manager page for each sub-section. Zero functionality loss during the migration.
- The pattern requires that each domain object row/card has a stable identity field (`listing_id` for Yard posts, `id` for products, etc.) and the API endpoints accept cookie-session auth (not just magic-link tokens). This session added cookie-session fallback to `PATCH/DELETE /api/trade-off/yard/posts/[id]` — future ports need to do the same for any endpoint that will be called from an in-card menu.
- Existing pages under `/trade-off/edit/{slug}/**` (33 sub-features) are NOT covered by this ADR yet. Each needs a per-feature port plan before deletion. Do not mass-nuke that directory.

## Reference implementations

- **Carousel + tile:** `src/app/trade-off/yard/canteens/[slug]/CanteenPageShell.tsx` — `CanteenHeroStats` (Edit-mode branch) + `EditActionSquare` component + `ButtonFeaturesPanel` for docs.
- **3-dots on card:** `src/components/xrated/yard/PostCardActionsMenu.tsx` — pulse-ping dot animation, click-outside close, mobile sheet vs desktop dropdown, confirm-before-delete pattern.
- **Cookie-fallback auth:** `src/app/api/trade-off/yard/posts/[id]/route.ts` `authorise()` — precedence: body slug+token (magic-link) → cookie session (signed-in merchant).
- **Shadow-page retirement:** `src/app/trade-off/yard/manage/page.tsx` — reduced to a `redirect()` stub after `YardManageList.tsx` was deleted.
- **Button Features:** `ButtonFeaturesPanel` inside `CanteenPageShell.tsx` — the reference-manual pattern. Kept in sync as tiles ship or move from "coming soon" to "live".

## Notes

- The 3-dots pulse animation is intentionally quieter than the Live Listing green dot (which uses `#10B981`, the reserved live-indicator green). Amber-tinted pulse (`rgba(255,179,0,0.35)`) signals "you can act on this" without competing for attention.
- Yellow (`#FFB300`) means SELECTED on carousel tiles — every tile defaults to cream white; the tile whose flow is open turns yellow with a dark-green (`#166534`) ring. Do not overload yellow for anything else in the carousel.
- The pattern is compatible with the platform's manifest-first architecture (see ADR-0001) — each domain object's tile + 3-dots menu can be declared per-App in its manifest, so future Apps get consistent editing UX for free.
