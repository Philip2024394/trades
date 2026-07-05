# Xrated Trades — Mobile UI Kit Catalog

> **Rule:** No page hand-writes Tailwind class strings.
> Every visual element on the platform comes from a primitive in this kit.
> If the primitive doesn't exist, add it here first — never inline it.

Location: `src/platform/ui/`
Benchmark: The Golden Path preview (`/golden-path/preview`) must look like a £100M SaaS product.
Reference index: [`references/PATTERNS.md`](./references/PATTERNS.md) — 30 curated mobile-first patterns from top GitHub UI repos, filtered for trade fit. Every remaining Phase 5/6 primitive has 1-2 references documented there.

---

## Progress at a glance

| Phase | Focus | Status | Components |
|---|---|---|---|
| 1 | Foundation | ✅ Complete | Tokens, Grid, Card, Button, Nav, Sheets, Gallery, Content, Sections, Feedback |
| 2 | Heroes + Bands | ✅ Complete | SplitHero, MinimalHero, EmergencyHero, TrustBar, StatsBand, CtaBand, TestimonialBand, ProcessBand |
| 3 | Forms | ✅ Complete | FieldGroup, TextInput, TextArea, Select, RadioGroup, CheckboxGroup, Checkbox, Toggle, FormSection, StickySubmit, FileUpload |
| 4 | Data display + Overlays | ✅ Complete | DataTable, ListView, ActivityFeed, Timeline, Tabs, Popover, Tooltip, DropdownMenu |
| 5 | Media + Onboarding | 🚧 Next | ImageWithCaption, BeforeAfterSlider, AspectRatio, Avatar, OnboardingChecklist, Tour |
| 6 | Layout Recipes | ⏳ Planned | ServiceOverviewLayout, DashboardLayout, BookingLayout, CoachLayout, MarketplaceLayout |

---

## Phase 1 — Foundation (✅ complete)

### Tokens (`tokens/`)

| Token | Purpose |
|---|---|
| `spacing` | 4px scale, `SECTION_PAD_Y`, `TAP_TARGET_MIN` |
| `radius` | `CARD_RADIUS` scales mobile→desktop (`xl` → `2xl`) |
| `elevation` | 6 subtle shadow levels, `ELEVATION_INVERTED` for sticky-bottom |
| `typography` | 12 typed styles: `TYPE_DISPLAY` / `TYPE_H1..4` / `TYPE_BODY` / `TYPE_META` / `TYPE_BUTTON` etc. |
| `animation` | `DURATION.fast/base/slow` + `EASE.standard/enter/exit` + Tailwind `TRANSITION` classes |

### Content primitives (`content/`)

| Component | Purpose |
|---|---|
| `Overline` | Small uppercase label above a heading, 5 tones |
| `Chip` | Rounded pill, 6 tones × 3 sizes |
| `Badge` | Icon + text badge (tighter than Chip), 6 tones |
| `Divider` | 3 variants (line / hairline / dotted), 3 spacings, optional inline label |
| `Blockquote` | 2 variants: `default` (inline) + `spotlight` (hero-scale) |
| `Prose` | Long-form typography wrapper — styles h2/h3/p/ul/ol/a/code/blockquote |

### Section headers (`sections/`)

| Component | Purpose |
|---|---|
| `SectionHeader` | Overline + title + subtitle + trailing action. Left or center. |
| `PageHeader` | Larger page-level heading with breadcrumbs + overline + actions row |

### Feedback (`feedback/`)

| Component | Purpose |
|---|---|
| `Alert` | Inline banner, 4 intents (info / warning / success / danger) |
| `Callout` | Highlighted content block, 5 tones incl. `editorial` (dark) |

### Primitives (`primitives/`)

| Component | Purpose |
|---|---|
| `Grid` | 7 density presets: `icons` / `compact` / `cards` / `rich` / `feature` / `kpi` / `stats-3` |
| `SectionContainer` | Enforces max-width + padding + surface across every page section |
| `SurfaceCard` | 9 variants × 4 paddings |
| `Button` | 4 intents × 3 sizes, all WCAG-compliant (min-h 36/44/48px) |
| `EmptyState` | Icon + title + description + optional action |
| `Skeleton` / `SkeletonCard` | Loading placeholders — no spinners for content |

### Cards (`cards/`)

| Component | Purpose |
|---|---|
| `ServiceTile` | 3-up mobile compact / 2-3-up desktop expanded, with per-service icon |
| `ProjectTile` | 2-up mobile compact / 3-up desktop expanded, "Customer review" chip on quotes |
| `MetricCard` | KPI widget with optional trend delta |

### Navigation (`nav/`)

| Component | Purpose |
|---|---|
| `StickyTopNav` | Sticky brand + desktop links + mobile hamburger, wraps drawer |
| `MobileNavDrawer` | Right-side drawer with backdrop + footer slot |
| `StickyBottomActionBar` | Mobile-only bottom bar with left/right slots + configurable ratio |

### Sheets (`sheets/`)

| Component | Purpose |
|---|---|
| `BottomSheet` | Mobile bottom sheet + desktop centered modal in one component |

### Gallery (`gallery/`)

| Component | Purpose |
|---|---|
| `SwipeGallery` | Horizontal snap-scroll on mobile with progress dots, grid on desktop |

---

## Phase 2 — Heroes + Bands (✅ complete)

### Heroes (`heroes/`)

| Component | Purpose | Status |
|---|---|---|
| `SplitHero` | Text left + image right (Phil's site pattern), mobile → 1fr + fixed image column | ✅ Built |
| `MinimalHero` | Centered headline + CTA, no image | ✅ Built |
| `EmergencyHero` | 24/7 badge, Call Now hero for emergency trades | ✅ Built |
| `EditorialHero` | Magazine-style, large photography, sparse text | ⏳ Deferred to Phase 5 |
| `FullBleedHero` | Background image + overlay text | ⏳ Deferred to Phase 5 |

### Bands (`bands/`)

| Component | Purpose | Status |
|---|---|---|
| `TrustBar` | Logo/badge strip — "As seen on", "Certified by", "Trusted since 2010" | ✅ Built |
| `StatsBand` | 3-4 stat callouts inline — "15 years / 800 jobs / 5★ rating" | ✅ Built |
| `CtaBand` | Full-width CTA section — "Ready to talk to Phil?" | ✅ Built |
| `TestimonialBand` | Featured quote or 3-up quote grid | ✅ Built |
| `ProcessBand` | Numbered 3-4 step process — "How we work" | ✅ Built |
| `LogoStrip` | Client / partner / supplier logo grid | ⏳ Deferred to Phase 5 |

---

## Phase 3 — Forms (✅ complete)

| Component | Purpose | Status |
|---|---|---|
| `FieldGroup` | Consistent field wrapper — label + labelBadge + hint + error + slot | ✅ Built |
| `TextInput` | Single-line text with label, hint, error, prefix/suffix, character counter | ✅ Built |
| `TextArea` | Multi-line text with character counter | ✅ Built |
| `Select` | Native `<select>` + styled shell + chevron | ✅ Built |
| `RadioGroup` | Styled radio buttons — list variant + cards variant (with description + icon) | ✅ Built |
| `CheckboxGroup` | Styled checkboxes — list + cards variants | ✅ Built |
| `Checkbox` | Single checkbox (consent / terms fields) | ✅ Built |
| `Toggle` | iOS-style switch | ✅ Built |
| `FormSection` | Numbered step group of fields with heading + description | ✅ Built |
| `StickySubmit` | Sticky submit action row (container or viewport scope) | ✅ Built |
| `FileUpload` | Drag+drop + button + mobile camera capture + preview grid | ✅ Built |
| `DatePicker` | Calendar dropdown (mobile: BottomSheet variant) | ⏳ Deferred to Phase 5 |
| `TimePicker` | Time selector | ⏳ Deferred to Phase 5 |
| `InlineValidation` | Real-time field validation display | ⏳ Deferred to Phase 4 |

---

## Phase 4 — Data display + Overlays (✅ complete)

| Component | Purpose | Status |
|---|---|---|
| `DataTable` | Responsive `<table>` on desktop, stacked labelled cards on mobile | ✅ Built |
| `ListView` | Vertical item list with icons + subtitle + meta + optional action, dividers, hover state | ✅ Built |
| `ActivityFeed` | Vertical timeline of activity items with tone-coloured icon dots + action links | ✅ Built |
| `Timeline` | Journey pattern with numbered nodes + done/current/upcoming status | ✅ Built |
| `Tabs` | Segmented control with underline + pills variants, count badges | ✅ Built |
| `Popover` | Anchored overlay with click-outside + Escape close | ✅ Built |
| `Tooltip` | CSS-only hover / focus tooltip (4 sides) | ✅ Built |
| `DropdownMenu` | Actions menu composed on Popover with icon + label + danger + disabled + dividers | ✅ Built |
| `CommandPalette` | Cmd+K search + actions | ⏳ Deferred to Phase 6 |
| `ContextMenu` | Right-click / long-press menu | ⏳ Deferred to Phase 6 |

---

## Phase 5 — Media + Onboarding (⏳ planned)

| Component | Purpose |
|---|---|
| `ImageWithCaption` | Consistent captioned image |
| `BeforeAfterSlider` | Drag-slider for before/after project comparison |
| `AspectRatio` | Ratio wrapper (4:3, 16:9, square, portrait) |
| `Avatar` | User avatar with initials fallback |
| `VideoEmbed` | Responsive video wrapper |
| `OnboardingChecklist` | Merchant setup progress |
| `Tour` | Interactive product tour overlay |
| `EmptyStateIllustrations` | Named SVG illustrations for empty states |
| `SkeletonPreset` | Named skeleton compositions (SkeletonHero, SkeletonList, SkeletonForm) |

---

## Phase 6 — Layout Recipes (⏳ planned)

These are **declarative page compositions**. A page says `<ServiceOverviewLayout>` and the kit assembles the correct primitives in the correct order.

| Recipe | Slots |
|---|---|
| `ServiceOverviewLayout` | Hero → Quick Stats → Featured Services → Projects → Reviews → CTA |
| `DashboardLayout` | Greeting → Business Score → Priority Actions → KPIs → Activity → Insights |
| `BookingLayout` | Hero → Steps → Calendar → Details → Summary → Payment → Confirmation |
| `CoachLayout` | Score header → Backlog by timeframe → Explainer drilldown |
| `MarketplaceLayout` | Filter bar → Result grid → Featured band → Pagination |
| `SettingsLayout` | Sidebar nav → Section content → Sticky save bar |

---

## Hero image sizing rules

The `SplitHero` mobile layout uses `grid-cols-[minmax(0,1fr)_128px]` — the `minmax(0, 1fr)` on the text column is what prevents the headline from squeezing the image column. Never remove it.

- **Mobile (≤ 640px):** Image column is fixed 128px wide, `aspect-[3/4]` portrait — gives the image real visual weight without wrapping the headline into thin ribbons.
- **Small (≥ 640px):** Image column grows to 180px, still portrait aspect.
- **Medium+ (≥ 768px):** 50/50 grid split with landscape `aspect-[4/3]` image slot.

Pass `imageIcon` to fill the placeholder with a trade-relevant Lucide icon (DoorOpen / Flame / ChefHat / Hammer). The placeholder ships an amber radial glow behind the icon so it never looks like a dev artifact.

## When to use `TrustBar`

Reserve the "Accredited by" TrustBar for **high-risk / regulated trades** where certification is legally required or safety-critical:

- Electricians (NICEIC, NAPIT, Part P)
- Gas engineers (Gas Safe)
- Roofers + scaffolders (working-at-height)
- Pest control + chemical spraying (RSPH, BASIS)
- Steel fabricators (CE marking, CSCS)
- Fire-safety installers (FIRAS, BAFE)

For **low-risk residential trades** (generic carpentry, painting, tiling), don't stack an "Accredited by" band — trust signals belong in the value-props section and the trust panel. A blanket accreditation strip on a low-risk trade signals over-selling.

## Design principles this kit enforces

1. **Mobile-first, always.** Every component starts at 320px and enhances up.
2. **44px tap target minimum.** Every interactive element passes WCAG.
3. **Typography scale.** 12px absolute floor for readable copy. `TYPE_*` tokens only.
4. **Section padding token.** `py-12 md:py-16` — never `py-16` alone.
5. **Card radius token.** `rounded-xl md:rounded-2xl` — never `rounded-2xl` alone.
6. **No hand-rolled grids.** `<Grid density="...">` always.
7. **No hand-rolled shadows.** `ELEVATION[n]` only.
8. **Lucide icons only.** No emojis-as-icons.
9. **`object-contain` on merchant media.** `object-cover` only for full-bleed hero backgrounds.
10. **Skeletons over spinners** for content loading.

---

## Migration status by page

| Page | Kit adoption | Notes |
|---|---|---|
| `/golden-path/preview` (Phil's site) | 🟢 95% | Hero + Stats + Trust + Services + How we work + Projects + Contact + Sticky + **Quote request form (BottomSheet)** all migrated. Real 3-step form with 11 primitives composed. Trust panel + FAQ accordion + footer still hand-rolled |
| `/golden-path` | 🔴 0% | Step cards still hand-rolled — next |
| `BusinessCoachPanel` | 🔴 0% | Uses hand-rolled cards — next |
| `StrategyExplainerPanel` | 🔴 0% | Uses hand-rolled cards — next |
| `StudioShell` | 🔴 0% | Uses shadcn — needs kit-first refactor |
| Payment orders dashboard | 🔴 0% | Hand-rolled — kit migration deferred |
| Blueprint wizard | 🔴 0% | Hand-rolled — kit migration deferred |

---

## How to add a new primitive

1. Add the file under `src/platform/ui/<category>/<Name>.tsx`.
2. Consume tokens — never hard-code spacing / radius / colours outside the token scale.
3. Always accept `className?: string` and merge with `.trim()`.
4. Export from `src/platform/ui/index.ts` (both the component AND its Props type).
5. Update this CATALOG.md — move from "planned" to "complete", add a row.
6. If it's used on Phil's site, migrate that usage in the same commit.
