# Mobile-First Pattern Library — 30 Curated References

> **Rule:** This file is documentation. We do not paste JSX from external repos.
> We extract the pattern (structure + proportions + interaction), rewrite it in
> our token vocabulary (`src/platform/ui/tokens/`), and add a
> `// Reference: <url>` header comment to the new primitive.
>
> Focus: **compact, mobile-first, trade-relevant**. Every pattern below was
> chosen because a tradesperson standing on a building site with one hand free
> could use it comfortably.

## How to use this file

1. Look up the pattern for the primitive you're building (Phase 5 / 6).
2. Skim the "What to keep" + "What to change" columns.
3. Build the primitive in `src/platform/ui/` using our tokens.
4. Add the `Reference:` URL to the top of the file.
5. Update this file's status column when the pattern is landed.

## Local research folder (outside our repo)

Clone the three highest-value references locally — **outside** the trades
repo so they never leak into commits:

```bash
mkdir -p ~/xrated-references && cd ~/xrated-references
git clone --depth 1 https://github.com/markmead/hyperui hyperui
git clone --depth 1 https://github.com/shadcn-ui/ui shadcn-ui
git clone --depth 1 https://github.com/arhamkhnz/next-shadcn-admin-dashboard admin-dash
```

Then browse locally to see the patterns cited below.

---

## Status legend

- ✅ Already in our kit (link to primitive)
- 🚧 Building next
- ⏳ Queued for later phase

---

## Section 1 — Media + Imagery (Phase 5 target)

### 1. Before-After image slider · 🚧
- **Source:** shadcn.io / shadcnspace — search `compare` or `before-after`
- **License:** MIT
- **Compact mobile size:** full-width card, aspect-[4/3], drag handle 44×44px
- **What to keep:** touch-drag reveal, 60% initial split, keyboard support (arrow keys ±5%)
- **What to change:** use `CARD_RADIUS`, keep our amber accent for the handle bar, add "Before" / "After" corner chips using `Chip` primitive
- **Trade fit:** roofers · painters · kitchen fitters · bathroom fitters · landscapers · tilers · plasterers · joiners · rendering
- **Kit target:** `src/platform/ui/gallery/BeforeAfterSlider.tsx`

### 2. Aspect-ratio image tile · 🚧
- **Source:** HyperUI · Marketing / Cards section
- **License:** MIT
- **Compact mobile size:** 2-per-row, aspect-[4/5] portrait, `rounded-xl`
- **What to keep:** `overflow-hidden` clip + `object-cover` fill
- **What to change:** wrap our existing `ProjectTile` — just extract the media area as a reusable primitive; use `AspectRatio` around any child (video, iframe, image)
- **Trade fit:** every trade — universal media wrapper
- **Kit target:** `src/platform/ui/media/AspectRatio.tsx`

### 3. Image with caption overlay · ⏳
- **Source:** Flowbite · Content sections · Image cards
- **License:** MIT
- **Compact mobile size:** full-width, dark gradient overlay from `bottom-40%` to transparent, caption text at `TYPE_H4`
- **What to keep:** dark gradient bar so caption reads on any photo
- **What to change:** use `bg-gradient-to-t from-neutral-900/85 via-neutral-900/40`; caption uses our type scale not Flowbite's
- **Trade fit:** case study heroes, project detail pages
- **Kit target:** `src/platform/ui/media/ImageWithCaption.tsx`

### 4. Video thumbnail with play badge · ⏳
- **Source:** Preline · Cards · Video preview
- **License:** MIT
- **Compact mobile size:** aspect-[16/9] card, centred play badge 48×48px `rounded-full bg-white/90`
- **What to keep:** play badge centred with amber ring on hover
- **What to change:** replace their SVG play with `Play` from Lucide (kit rule)
- **Trade fit:** trade demos, testimonial videos, before/after time-lapses
- **Kit target:** `src/platform/ui/media/VideoThumb.tsx`

### 5. Photo grid with "+N more" · ⏳
- **Source:** admin-dash (next-shadcn-admin) · Media gallery
- **License:** MIT
- **Compact mobile size:** 2×2 grid where the 4th tile shows `+N` overlay with amber gradient
- **What to keep:** 4-tile compact preview; "+N" tile links to full gallery
- **What to change:** use `Grid density="cards"` (already ours) + amber overlay using `bg-neutral-900/70`; count via `TYPE_H3`
- **Trade fit:** project count previews on service cards
- **Kit target:** `src/platform/ui/media/PhotoGridPreview.tsx`

### 6. Avatar cluster · ⏳
- **Source:** shadcn/ui · Avatar composition example
- **License:** MIT
- **Compact mobile size:** 3-4 avatars stacked with `-ml-2` overlap, 24×24 or 32×32
- **What to keep:** overlap technique + subtle white ring (`ring-2 ring-white`)
- **What to change:** last-slot shows "+N" count when >4 avatars; add trailing text slot ("+ 42 customers")
- **Trade fit:** team photo cluster, review count preview, "joined X customers"
- **Kit target:** `src/platform/ui/media/AvatarCluster.tsx`

---

## Section 2 — Onboarding + Progress (Phase 5 target)

### 7. Setup checklist card with % ring · 🚧
- **Source:** admin-dash · Dashboard · Onboarding widget
- **License:** MIT
- **Compact mobile size:** full-width card, ring SVG 48×48, 4-5 checkbox rows
- **What to keep:** progress ring next to title + numbered checklist below
- **What to change:** use `CheckboxGroup` (ours) for items, use `SurfaceCard` for the shell; ring uses `stroke-amber-400`
- **Trade fit:** merchant onboarding — "5 things to publish your website" (upload logo · add 3 projects · answer FAQs · connect calendar · request first review)
- **Kit target:** `src/platform/ui/onboarding/SetupChecklist.tsx`

### 8. Rich empty state with illustration · 🚧
- **Source:** Vercel Design (referenced via HyperUI empty-state block)
- **License:** MIT
- **Compact mobile size:** 240×160 SVG illustration + `TYPE_H3` title + supporting line + primary Button
- **What to keep:** SVG-not-icon feels intentional, 160-200px tall keeps the state visible above the fold on mobile
- **What to change:** ship named SVGs for our contexts (`NoLeadsIllustration`, `NoProjectsIllustration`, `AllDoneIllustration`) so contexts have identity; keep `EmptyState` primitive as the shell
- **Trade fit:** empty leads inbox · no projects yet · coach backlog all-clear
- **Kit target:** `src/platform/ui/onboarding/EmptyStateIllustrations.tsx`

### 9. Success card with subtle celebration · ⏳
- **Source:** launch-ui · Post-submit state
- **License:** MIT
- **Compact mobile size:** centered 280px width, 56×56 emerald ring + tick, 2-line copy
- **What to keep:** emerald ring pattern (already partly in `QuoteRequestSheet`); consolidate as reusable
- **What to change:** wrap into a `SuccessCard` primitive with `title` + `body` + optional `nextAction`; skip confetti (feels toy for tradespeople)
- **Trade fit:** quote submitted · review posted · project uploaded
- **Kit target:** `src/platform/ui/feedback/SuccessCard.tsx`

### 10. Multi-step progress dots · ⏳
- **Source:** shadcn.io · Wizard block
- **License:** MIT
- **Compact mobile size:** 3-5 dots, current dot `w-6 h-1.5` amber, others `w-1.5 h-1.5 neutral-300`
- **What to keep:** morphing width (dot grows into a bar for the active step)
- **What to change:** use our token colours, add optional step labels below at `TYPE_META`
- **Trade fit:** quote request wizard, booking wizard, coach guided setup
- **Kit target:** `src/platform/ui/onboarding/StepDots.tsx`

### 11. Feature tour tooltip · ⏳
- **Source:** admin-dash · Product tour overlay
- **License:** MIT
- **Compact mobile size:** anchored popover 260-300px wide, arrow, "1 of 4" counter, Skip + Next
- **What to keep:** anchored positioning + step counter + skip escape
- **What to change:** build on our `Popover` primitive; use `Button` for Skip / Next; store dismissal in `localStorage` keyed by `tourId`
- **Trade fit:** first-time Studio welcome tour · Coach feature discovery
- **Kit target:** `src/platform/ui/onboarding/FeatureTour.tsx`

### 12. Compact stats callout (dashboard variant) · ⏳
- **Source:** admin-dash · Analytics KPI card
- **License:** MIT
- **Compact mobile size:** 2-per-row on mobile, 4-per-row on desktop; icon+value+delta chip
- **What to keep:** delta chip pattern (already in our `MetricCard`)
- **What to change:** add optional sparkline slot for last-30-days trend; make sparkline heightless on very small screens
- **Trade fit:** coach dashboard, revenue widget, leads-this-month widget
- **Kit target:** extend `MetricCard` — add `sparkline?: ReactNode` prop

---

## Section 3 — Hero variants (backfill Phase 2)

### 13. Compact video hero (mobile portrait) · ⏳
- **Source:** HyperUI · Marketing / Hero video
- **License:** MIT
- **Compact mobile size:** full-width, aspect-[9/16] video with overlay text
- **What to keep:** `autoplay muted loop playsinline` attributes (essential for mobile video)
- **What to change:** amber CTA at bottom-center; overlay text uses `TYPE_DISPLAY`; fallback poster image
- **Trade fit:** kitchen fitter showroom reel, roofer time-lapse, painter transformation
- **Kit target:** `src/platform/ui/heroes/VideoHero.tsx`

### 14. Testimonial-first hero (quote > headline) · ⏳
- **Source:** launch-ui · Alt hero
- **License:** MIT
- **Compact mobile size:** 5-star row + oversized quote + attribution + CTA — no image
- **What to keep:** starts with 5 stars, not a headline — social proof upfront
- **What to change:** use `Blockquote variant="spotlight"` (ours) + amber stars; primary CTA below
- **Trade fit:** premium kitchen fitters, luxury door specialists — where reputation is the moat
- **Kit target:** `src/platform/ui/heroes/TestimonialHero.tsx`

### 15. Emergency banner strip above hero · ⏳
- **Source:** Preline · Alert strip pattern
- **License:** MIT
- **Compact mobile size:** full-width strip, 40-44px tall, red background, `Phone` icon + phone number + short message
- **What to keep:** strip sits above the top nav — always visible, always clickable
- **What to change:** use `bg-red-600` + our `TYPE_BUTTON`; `tel:` href
- **Trade fit:** emergency plumbers, electricians, locksmiths — pairs with `EmergencyHero`
- **Kit target:** `src/platform/ui/heroes/EmergencyStrip.tsx`

### 16. Booking-integrated hero · ⏳
- **Source:** shadcn.io · Booking hero blocks
- **License:** MIT
- **Compact mobile size:** headline + embedded 3-slot calendar picker (Next available: Tue 10am / Wed 2pm / Thu 9am)
- **What to keep:** show the next 3 available slots inline — reduces friction from "browse" to "book"
- **What to change:** use our `Button` for slot chips; hook to booking flow's `next-available` facet
- **Trade fit:** carpenter surveys, kitchen consultations, electrician EICR appointments
- **Kit target:** `src/platform/ui/heroes/BookingHero.tsx`

### 17. Editorial hero with sidebar meta · ⏳
- **Source:** Flowbite · Blog hero patterns
- **License:** MIT
- **Compact mobile size:** stack on mobile; sidebar meta collapses to horizontal chip strip
- **What to keep:** category chip + date + read-time layout for editorial content
- **What to change:** use `Chip` (ours) for category; `Overline` for date
- **Trade fit:** trade blog posts, case study long-forms, "how it's made" articles
- **Kit target:** `src/platform/ui/heroes/EditorialHero.tsx`

---

## Section 4 — Pricing + Estimates (new; Phase 6)

### 18. Compact 3-tier pricing cards · ⏳
- **Source:** HyperUI · Pricing sections
- **License:** MIT
- **Compact mobile size:** stack full-width on mobile; tab switcher for tier selection on very small screens
- **What to keep:** middle tier gets amber border + "Most popular" badge
- **What to change:** use `SurfaceCard variant="highlight"` for the middle tier; `CheckboxGroup`-like tick rows for features
- **Trade fit:** IF a trade ever offers tiered services (basic / premium / deluxe kitchen installation)
- **Kit target:** `src/platform/ui/pricing/PricingTiers.tsx`

### 19. Single-plan spotlight card · ⏳
- **Source:** launch-ui · Focused CTA card
- **License:** MIT
- **Compact mobile size:** one big dark card, price + description + big CTA
- **What to keep:** single-focus card — no analysis paralysis
- **What to change:** replace price with our "Free on-site survey — no obligation" copy pattern; CTA is `Button size="lg" block`
- **Trade fit:** free-survey trades (carpenters, roofers), where the price isn't the message
- **Kit target:** `src/platform/ui/pricing/SpotlightPlan.tsx`

### 20. Estimate summary card · ⏳
- **Source:** admin-dash · Invoice / Order summary
- **License:** MIT
- **Compact mobile size:** stacked line items with right-aligned prices, divider, total row
- **What to keep:** `text-tabular-nums` on prices so digits align vertically
- **What to change:** use our `Divider variant="hairline"` between line items and total
- **Trade fit:** post-quote confirmation, job summary in booking flow, invoice preview
- **Kit target:** `src/platform/ui/pricing/EstimateSummary.tsx`

### 21. Comparison strip (single row of features) · ⏳
- **Source:** Flowbite · Compact comparison
- **License:** MIT
- **Compact mobile size:** table collapses to accordion of features on mobile
- **What to keep:** feature row with tick / cross / dash cells
- **What to change:** use `DataTable` (ours) with `hideOnMobile` columns for the least important features
- **Trade fit:** door type comparison (composite vs solid vs uPVC), material comparison
- **Kit target:** `src/platform/ui/pricing/CompareStrip.tsx`

---

## Section 5 — Lists + Data patterns (backfill Phase 4)

### 22. Notification card with actions · ⏳
- **Source:** admin-dash · Notification centre
- **License:** MIT
- **Compact mobile size:** 60-80px tall, icon dot + title + 1 line body + timestamp + Mark-read / Dismiss actions
- **What to keep:** unread indicator dot on the far left
- **What to change:** use `ListView` (ours) as the shell; unread dot is a 6×6 amber circle
- **Trade fit:** coach alerts, new lead pings, review received
- **Kit target:** `src/platform/ui/data/NotificationCard.tsx`

### 23. Compact review card (star + snippet + author) · ⏳
- **Source:** launch-ui · Testimonial grid
- **License:** MIT
- **Compact mobile size:** 2-per-row on mobile, dense card with truncated quote
- **What to keep:** 3-line truncation with fade-out — hint that there's more without clutter
- **What to change:** use `Blockquote variant="default"` (ours) + `Star` rating row above; author with tiny avatar
- **Trade fit:** trade review grid, testimonial section on service pages
- **Kit target:** `src/platform/ui/data/ReviewCard.tsx`

### 24. Booking slot card · ⏳
- **Source:** admin-dash · Calendar / Booking slot picker
- **License:** MIT
- **Compact mobile size:** 3-per-row on mobile, `Day / Time / Duration` stacked
- **What to keep:** three-tap flow (day → time → confirm) — mobile-native
- **What to change:** selected state uses `SurfaceCard variant="highlight"`; disabled slots are muted
- **Trade fit:** surveyor booking, consultation slot picker
- **Kit target:** `src/platform/ui/data/BookingSlotGrid.tsx`

### 25. Job status badge row · ⏳
- **Source:** admin-dash · Pipeline visualisation
- **License:** MIT
- **Compact mobile size:** 4-5 pill stages horizontal, current one filled, others outlined
- **What to keep:** connector lines between pills — subtle "→" glyphs
- **What to change:** use `Chip` + amber for active, `neutral` outline for pending
- **Trade fit:** job pipeline (Quoted → Accepted → Scheduled → In Progress → Complete)
- **Kit target:** `src/platform/ui/data/StatusPipeline.tsx`

---

## Section 6 — Navigation patterns (backfill Phase 1)

### 26. Bottom tab bar with center CTA · ⏳
- **Source:** admin-dash · Mobile app shell
- **License:** MIT
- **Compact mobile size:** 5 slots, center slot is elevated 56×56 amber circle
- **What to keep:** center slot is 8-12px taller than sides — reads as the primary CTA
- **What to change:** integrate with our `StickyBottomActionBar` — the primary action IS the CTA; 4 tab slots either side
- **Trade fit:** merchant Studio mobile shell (Home / Leads / [+ Add] / Coach / Settings)
- **Kit target:** `src/platform/ui/nav/BottomTabBar.tsx`

### 27. Segmented tab with sliding indicator · ⏳
- **Source:** shadcn/ui · Tab with animated indicator
- **License:** MIT
- **Compact mobile size:** grow to viewport width, indicator slides via `transform: translateX()`
- **What to keep:** animated indicator on transition — feels iOS-native
- **What to change:** extend our existing `Tabs` component with `animated?: boolean` prop; use `TRANSITION.base` for timing
- **Trade fit:** filter tabs on leads list, dashboard time-range switcher
- **Kit target:** extend `src/platform/ui/overlays/Tabs.tsx`

### 28. Search input with backdrop blur · ⏳
- **Source:** launch-ui · Search overlay
- **License:** MIT
- **Compact mobile size:** full-width, elevated on scroll, `backdrop-blur` when sticky
- **What to keep:** sticky-top + backdrop-blur pattern
- **What to change:** use `TextInput` (ours) with `prefix={Search}`; sticky wrapper with `ELEVATION[3]`
- **Trade fit:** leads search, project search, help articles search
- **Kit target:** `src/platform/ui/nav/SearchInput.tsx`

### 29. Filter chip row (horizontal scroll) · ⏳
- **Source:** HyperUI · Filter bar
- **License:** MIT
- **Compact mobile size:** horizontal scroll snap, `-mx-4 px-4` for edge-to-edge on mobile
- **What to keep:** `snap-x snap-mandatory` for chip snapping
- **What to change:** chips are our `Chip` primitive with `onClick` for toggle state; selected chips use `tone="dark"`
- **Trade fit:** filter leads by status, filter projects by service, filter reviews by rating
- **Kit target:** `src/platform/ui/nav/FilterChipRow.tsx`

### 30. Sticky sub-nav after hero scroll · ⏳
- **Source:** Preline · Anchor nav
- **License:** MIT
- **Compact mobile size:** appears after user scrolls past hero; horizontal scroll on mobile
- **What to keep:** IntersectionObserver-triggered appearance
- **What to change:** replace their utility CSS with our `sticky top-14 z-30`; anchor items are `Chip`s
- **Trade fit:** long service pages with jump-nav (Services / Projects / Reviews / FAQ / Contact)
- **Kit target:** `src/platform/ui/nav/StickyAnchorNav.tsx`

---

## Summary — where each pattern lands

| Phase | New primitives | Backfill existing |
|---|---|---|
| **Phase 5 · Media** | BeforeAfterSlider · AspectRatio · ImageWithCaption · VideoThumb · PhotoGridPreview · AvatarCluster | — |
| **Phase 5 · Onboarding** | SetupChecklist · EmptyStateIllustrations · SuccessCard · StepDots · FeatureTour | Extend `MetricCard` with sparkline |
| **Phase 2 · Heroes** (backfill) | VideoHero · TestimonialHero · EmergencyStrip · BookingHero · EditorialHero | — |
| **Phase 6 · Pricing** | PricingTiers · SpotlightPlan · EstimateSummary · CompareStrip | — |
| **Phase 4 · Data** (backfill) | NotificationCard · ReviewCard · BookingSlotGrid · StatusPipeline | — |
| **Phase 1 · Nav** (backfill) | BottomTabBar · SearchInput · FilterChipRow · StickyAnchorNav | Extend `Tabs` with animated indicator |

**Total planned:** 30 patterns → 26 new primitives + 4 extensions to existing.

## Trade filter — what we deliberately DIDN'T salvage

| Pattern | Why rejected |
|---|---|
| Crypto ticker / wallet | No trade relevance |
| Ecommerce checkout multi-step | Booking flow already covers merchant needs; trades don't ship products |
| Social feed / likes | Not the audience |
| Enterprise data table with 20+ columns | Trades don't run row-heavy analytics |
| Marketing pop-up modal | Aggressive; damages trust |
| Dark-mode toggle in nav | Merchants don't switch themes mid-session |
| Chatbot floating bubble | Adds noise; the coach panel is the assistant |
| Kanban board with drag-drop | Overkill; StatusPipeline covers it |
| Full-page wizard with progress sidebar | Mobile-hostile; BottomSheet + StepDots is better |
| Confetti celebration | Feels toy — tradespeople want confidence, not fireworks |

## Licensing note

All 30 patterns come from repos licensed **MIT** or **Apache 2.0** (both permit copying with attribution). Because we rewrite in our token vocabulary rather than paste source, our attribution requirement is a `// Reference: <url>` header comment on each new primitive. Not per-file license header.
