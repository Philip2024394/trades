# M3 — Platform Core Completion

**Status:** architecture-only. **No code has been written.**
**Awaiting review + approval before implementation.**

**Adopted:** 2026-07-05
**Governs:** Milestone 3 as scoped in Constitution v1 Amendment 2 (Business OS).

---

## Table of contents

1. Business OS reframing
2. Revised M3 goal + 8 subsystems
3. Architecture diagram — Platform Core
4. Registry map (existing + new)
5. Cold-boot dependency graph
6. AI Composition Engine v2 flow
7. Container hierarchy
8. Layout hierarchy
9. Navigation hierarchy
10. Booking architecture
11. Dashboard architecture
12. Forms architecture
13. Implementation plan — batches + sequencing
14. Parallel Engineering Quality stream
15. Deliverables checklist
16. Approval requested

---

## 1. Business OS reframing

Everything the platform generates is now a **Business Operating
System** — not a website. Every generated deliverable is assembled
by walking the layer stack top-to-bottom:

```
Business  ─────► "who this merchant is"
   ↓             (trade, location, staff, hours, credentials)
Brand     ─────► "how they present"
   ↓             (name, logo, palette, voice)
Theme     ─────► "the visual language"
   ↓             (typography, motion, effect intensity)
Design Tokens  ► "atomic values consumed by every component"
   ↓
Navigation ────► "how users move through the app"
   ↓
Layouts   ─────► "page-scale composition templates"
   ↓
Containers ────► "block-scale positioning primitives"
   ↓
Sections  ─────► "content areas"
   ↓
Components ────► "atomic primitives"
   ↓
Business Apps ─► "installable domain features"
   ↓
CRM       ─────► "who bought what, when"
Bookings  ─────► "calendar, availability, slots"
Payments  ─────► "processors, orders, refunds"
Analytics ─────► "what happened"
SEO       ─────► "how they're found"
Automation ────► "what happens without them"
Publishing ────► "the delivery pipeline"
```

Every layer above `Containers` is a **composition input** (AI reads
it to make choices). Every layer at `Sections` and below is a
**runtime concern** (rendered into the delivered app).

**Implication for M3:** the Platform Core is everything from
**Layouts down to Containers** — the layers that ship in M3 make the
AI composition engine able to walk the top of the stack.

---

## 2. Revised M3 goal + 8 subsystems

**Goal:** deliver every Business OS layer from **Navigation**
downward as a registry-driven, AI-selectable subsystem. When M3
closes, the AI composer walks the full 14-step pipeline end-to-end.

### 8 subsystems

| # | Subsystem | Business OS layer | New registry? |
|---|---|---|---|
| 1 | Container System 100% | Containers | extends existing `designSystemRegistry` |
| 2 | Layout Engine | Layouts | **new** `layoutRegistry` |
| 3 | Navigation System | Navigation | **new** `navigationRegistry` |
| 4 | Dashboard Framework | Layouts + Sections (dashboard variant) | **new** `dashboardBlockRegistry` |
| 5 | Booking Engine | Bookings | **new** `bookingRegistry` |
| 6 | Forms Framework | Sections (form variant) + Runtime | **new** `formRegistry` |
| 7 | AI Composition Engine v2 | Composition Layer | consumes all above |
| 8 | Registry Completion | cross-cutting | validation of above |

Every subsystem must satisfy the Platform Constitution — Amendment 1
(§Registry Rules). This is non-negotiable.

---

## 3. Architecture diagram — Platform Core

```
╔══════════════════════════════════════════════════════════════════╗
║                   AI COMPOSITION ENGINE v2                       ║
║  Reads every registry below; writes the final StudioLayoutJson.  ║
╚═══════════════════════╦══════════════════════════════════════════╝
                        │
   ┌────────────────────┴──────────────────────────────┐
   │                                                    │
   ▼                                                    ▼
┌──────────────────┐                          ┌──────────────────┐
│  Business Layer  │                          │   Brand Layer    │
│  (KG packages)   │                          │  (brand tokens)  │
└──────────────────┘                          └──────────────────┘
   │                                                    │
   └──────────┬─────────────────────────────────────────┘
              │
              ▼
       ┌────────────────┐
       │  Theme Layer   │  ← themePresets (6, now full design lang)
       └───────┬────────┘
               │
               ▼
       ┌────────────────┐
       │  Token Layer   │  ← designTokenRegistry (63 tokens today)
       └───────┬────────┘
               │
   ┌───────────┴──────────┬────────────────┬────────────────┐
   ▼                      ▼                ▼                ▼
┌────────┐         ┌─────────────┐   ┌────────────┐   ┌──────────┐
│  NAV   │ (M3)    │   LAYOUTS   │   │ CONTAINERS │   │ SECTIONS │
│Registry│         │  Registry   │◄──┤   Design   │◄──┤ Registry │
│  (8)   │         │    (12)     │   │  Registry  │   │  (100+   │
│        │         │             │   │(19+ ctnr)  │   │  in M4)  │
└────────┘         └─────────────┘   └────────────┘   └──────────┘
                          │                                │
                          │  consumes                      │
                          │  navigation +                  │
                          │  containers +                  │
                          │  sections                      │
                          └─────────┬──────────────────────┘
                                    │
                                    ▼
                          ┌─────────────────────┐
                          │  DASHBOARD Blocks   │  (M3)
                          │  BOOKING flows      │  (M3)
                          │  FORM schemas       │  (M3)
                          └─────────────────────┘

                                    │
                                    ▼
                          ┌─────────────────────┐
                          │  BUSINESS APPS      │
                          │  (appRegistry — 15+ │
                          │   target in M5)     │
                          └─────────────────────┘

                                    │
                                    ▼
                          ┌─────────────────────────────────────┐
                          │  RUNTIME BUSINESS SYSTEMS            │
                          │  CRM · Payments · Analytics · SEO ·  │
                          │  Automation · Publishing             │
                          └─────────────────────────────────────┘
```

**Reading the diagram:** each layer's registry is a discrete input to
the AI composer. The composer never invents; it *selects* from
registries. The Platform Core (M3) delivers everything from the Nav
Registry down to the Dashboard/Booking/Form registries.

---

## 4. Registry map (existing + new)

### Existing (post-M2) — 10 registries

| Registry | Population | Layer |
|---|---|---|
| `sectionRegistry` | 48 sections | Sections |
| `blueprintRegistry` | 52 blueprints | Layouts (legacy — supersedes into `layoutRegistry`) |
| `appRegistry` | 3 Apps | Business Apps |
| `packRegistry` | 1 Industry Pack | Business (bundled) |
| `designSystemRegistry` | 36 (25 primitives + 10 containers + 1 card) | Components + Containers |
| `buttonRegistry` | ~20 buttons | Components |
| `knowledgeDomainRegistry` | ~15 domains | Business |
| `knowledgePackageRegistry` | 13 packages | Business |
| `paymentProcessors` | ~20 processors | Payments |
| `designTokenRegistry` | 63 tokens (1 set) | Design Tokens |

### New in M3 — 5 registries

| Registry | Population target (M3 exit) | Layer |
|---|---|---|
| **`layoutRegistry`** | 12 layout templates | Layouts |
| **`navigationRegistry`** | 8 navigation patterns | Navigation |
| **`dashboardBlockRegistry`** | 11 dashboard block types | Dashboards |
| **`bookingRegistry`** | 4 booking flow templates + 3 integration adapters | Bookings |
| **`formRegistry`** | 8 form templates | Forms |

**Total registries after M3:** 15. Every one built via
`createRegistry` from the Registry Kit. No hand-rolled registries.

### Registry per Business OS layer (M3 exit state)

| Layer | Backing registry (post-M3) |
|---|---|
| Business | `knowledgePackageRegistry` (13 → M4 gives more) |
| Brand | brand overrides on Theme (deferred — full `brandRegistry` in M4) |
| Theme | `themePresets` (6) |
| Design Tokens | `designTokenRegistry` (63+) |
| Navigation | `navigationRegistry` (8) — **NEW** |
| Layouts | `layoutRegistry` (12) — **NEW** |
| Containers | `designSystemRegistry` (containers category, 19+) |
| Sections | `sectionRegistry` (48 → 100+ in M4) |
| Components | `designSystemRegistry` (primitives category, 25) |
| Business Apps | `appRegistry` (3 → 15+ in M5) |
| Bookings | `bookingRegistry` (4) — **NEW** |
| Forms | `formRegistry` (8) — **NEW** |
| Dashboards | `dashboardBlockRegistry` (11) — **NEW** |
| Payments | `paymentProcessors` (~20) |

---

## 5. Cold-boot dependency graph

Registries populated by barrel side-effect at boot. Order matters
when one registry's `.register()` validates against another.

```
                    registryKit (no deps)
                          │
      ┌───────────────────┼───────────────────┐
      ▼                   ▼                   ▼
knowledgeDomain      paymentProcessors    designSystemRegistry
  Registry                                 (typography, primitives)
      │                                        │
      ▼                                        ▼
knowledgePackage                        designTokenRegistry
  Registry                              (consumes theme defaults)
      │                                        │
      │                                        ▼
      │                              designSystemRegistry
      │                              (containers depend on tokens)
      │                                        │
      ▼                                        ▼
appRegistry ◄─── packRegistry            navigationRegistry (M3)
      │             (deferred                  │
      ▼             validation)                ▼
sectionRegistry ◄────────────────────  layoutRegistry (M3)
                                              │
                                              ▼
                                      dashboardBlockRegistry (M3)
                                              │
                                              ▼
                                      bookingRegistry (M3)
                                              │
                                              ▼
                                      formRegistry (M3)
```

**Validation crossings during M3:**
- `layoutRegistry` validates that every referenced container id exists
  in `designSystemRegistry` (containers category)
- `layoutRegistry` validates that every referenced section id exists
  in `sectionRegistry`
- `navigationRegistry` validates against `designSystemRegistry` for
  the nav item component references
- `dashboardBlockRegistry` validates chart / table components exist
- `bookingRegistry` validates against `paymentProcessors` for deposit
  support
- `formRegistry` validates against `designSystemRegistry` (forms
  category — Input, Textarea, Select, etc.)

No cycles. Everything additive.

---

## 6. AI Composition Engine v2 flow

The 14-step deterministic pipeline. AI only makes choices at labelled
points (LLM); every other step is a pure function over registries.

```
[User prompt]
     │
     ▼
┌───────────────────────┐
│ 1. Business detection │  LLM   business.discover
│    → trade + coverage │        → validates against KG
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 2. Intent extraction  │  LLM   prompt.extract-intent (NEW)
│    → audience, tone,  │        outcomes[], goals[], style hints
│      style, urgency   │
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 3. Customer Journey   │  Pure  journey.selectFor(intent, trade)
│    → 3-5 stage plan   │        journey registry (M3, small)
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 4. Layout selection   │  Pure  layoutRegistry.selectFor(journey)
│    → Landing/Trades/  │        scored pick from 12
│      Booking/Dashboard│
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 5. Container plan     │  Pure  layout → container id sequence
│    → ordered stack    │
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 6. Navigation choice  │  Pure  navigationRegistry.selectFor(
│    → Top/Sidebar/Bot. │           layout, tradeSlug, devices)
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 7. Section selection  │  Pure  sectionRegistry filter by
│    → per container    │        containers' compatibleSections
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 8. Component fill     │  Pure  each section may specify
│    → primitives inside│        component slots (rare in M3)
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 9. App recommendation │  LLM   app.recommend
│    → 1-5 apps to      │        constrained to appRegistry
│      pre-install      │
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 10. Theme selection   │  Pure  suggestThemeForTrade(trade)
│                       │        + tone/style modifier
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 11. Token set choice  │  Pure  designTokenRegistry.selectFor(
│                       │           theme, brandOverrides)
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 12. Asset fill        │  Pure  assetLibrary.getRandomAsset(...)
│                       │        theme-palette-aware (M6 depth)
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 13. Business runtime  │  Pure  materialise booking / form /
│     hydration         │        dashboard schemas
└───────────────────────┘
     │
     ▼
┌───────────────────────┐
│ 14. Final assembly    │  Pure  buildLayoutFromSeeds()
│                       │        → StudioLayoutJson
└───────────────────────┘
     │
     ▼
[Rendered app]
```

**LLM calls:** exactly 3 (business detection, intent extraction, app
recommendation). Every other step is deterministic and inspectable.

---

## 7. Container hierarchy

Three tiers. AI selects at each tier independently.

```
┌───────────────────────────────────────────────────────────┐
│               TIER 1 — LAYOUT CONTAINERS                  │
│                       (page-scale)                        │
│                                                           │
│  ● hero            ● magazine                             │
│  ● single-column   ● dashboard-shell (M3)                 │
│                                                           │
│  Only 1 per page. Owns page-scale rhythm.                 │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│              TIER 2 — CONTENT CONTAINERS                  │
│                       (block-scale)                       │
│                                                           │
│  ● stack           ● grid           ● split               │
│  ● card            ● masonry        ● sidebar             │
│  ● timeline (M3)   ● pricing (M3)   ● gallery (M3)        │
│  ● portfolio (M3)  ● comparison (M3) ● wizard (M3)        │
│  ● accordion (M3)                                         │
│                                                           │
│  N per page. Composed inside Layout Containers.           │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│              TIER 3 — UTILITY CONTAINERS                  │
│                     (positioning only)                    │
│                                                           │
│  ● overlay        ● sticky         ● floating (M3)        │
│                                                           │
│  Wrap other containers for absolute / sticky / floating   │
│  positioning. No content of their own.                    │
└───────────────────────────────────────────────────────────┘
```

**M3 targets:** 19+ total (10 shipped in M2 + 9 in M3). Constitution
list: Timeline, Booking, Pricing, Gallery, Portfolio, Comparison,
Dashboard shell, Floating, Accordion, Wizard.

**Every container declares:**
- `tier: "layout" | "content" | "utility"` (**new field**)
- `compatibleTier1: string[]` (only content containers declare this)
- `compatibleSections: string[]` (for the Layout Engine)

---

## 8. Layout hierarchy

Every Layout Template = ordered sequence of containers × constraints.

```
┌─────────────────────────────────────────────────────────────┐
│                      LAYOUT REGISTRY                        │
│  Every entry: id, name, category, sequence[], constraints   │
└─────────────────────────────────────────────────────────────┘
                            │
   ┌────────────────────────┼─────────────────────────┐
   ▼                        ▼                         ▼
┌────────────┐        ┌────────────┐          ┌─────────────┐
│ LANDING    │        │ TRADES     │          │ ECOMMERCE   │
│ Hero       │        │ Trust hero │          │ Header      │
│ Trust bar  │        │ Trust bar  │          │ Product hero│
│ Services   │        │ Services   │          │ Category    │
│ Testim.    │        │ Portfolio  │          │ Product grid│
│ CTA        │        │ Reviews    │          │ Reviews     │
│ Footer     │        │ FAQ        │          │ CTA         │
│            │        │ Contact    │          │ Footer      │
│            │        │ Footer     │          │             │
└────────────┘        └────────────┘          └─────────────┘

┌────────────┐        ┌────────────┐          ┌─────────────┐
│ BOOKING    │        │ SAAS       │          │ DASHBOARD   │
│ Simple hero│        │ Hero       │          │ Top nav     │
│ Calendar   │        │ Feature    │          │ Sidebar     │
│ Slot picker│        │ Comparison │          │ Metric strip│
│ Deposit    │        │ Pricing    │          │ Charts grid │
│ Confirm    │        │ Testim.    │          │ Table       │
│            │        │ CTA        │          │ Activity    │
│            │        │ Footer     │          │             │
└────────────┘        └────────────┘          └─────────────┘

┌────────────┐        ┌────────────┐          ┌─────────────┐
│ PORTFOLIO  │        │ DIRECTORY  │          │ MARKETPLACE │
│ Bio hero   │        │ Search hero│          │ Hero        │
│ Grid       │        │ Filter bar │          │ Categories  │
│ Case study │        │ Card grid  │          │ Featured    │
│ Bio + CTA  │        │ Map        │          │ Card grid   │
│ Footer     │        │ Pagination │          │ Search bar  │
│            │        │ Footer     │          │ CTA         │
└────────────┘        └────────────┘          └─────────────┘

┌────────────┐        ┌────────────┐
│ RESTAURANT │        │ MOBILE APP │
│ Photo hero │        │ Bottom nav │
│ Menu       │        │ Card feed  │
│ Reservat'n │        │ Detail modl│
│ Gallery    │        │ Bottom CTA │
│ Reviews    │        │            │
│ Location   │        │            │
│ Footer     │        │            │
└────────────┘        └────────────┘

MAGAZINE — long-form editorial layout (M3 target #12)
```

**Layout selection rules** (deterministic):
- `trade in [{ trades }]` → Trades layout
- `intent has commerce` → Ecommerce layout
- `intent has booking` → Booking layout
- `intent has portfolio` → Portfolio layout
- `intent has directory` → Directory layout
- default → Landing

**Every Layout Registration** declares:
- `sequence: LayoutStep[]` — ordered container ids + optional section
  constraints
- `defaultNavigation: string` — nav id to default to
- `variants: LayoutVariant[]` — mobile / dashboard / dark variants
- Standard `RegistrationBase` fields

---

## 9. Navigation hierarchy

8 patterns × 3 device variants × per-context behaviours.

```
                       NAVIGATION REGISTRY
                              │
   ┌──────────────────────────┼──────────────────────────┐
   ▼                          ▼                          ▼
DESKTOP NAV               MOBILE NAV                UNIVERSAL
                                                (device-adaptive)

┌──────────────┐         ┌──────────────┐        ┌───────────────┐
│ 1. Top Nav   │         │ 5. Drawer    │        │ Sticky wrapper│
│    horiz.    │         │    hamburger │        │  (any nav)    │
│    logo+links│         │    slide-in  │        │               │
└──────────────┘         └──────────────┘        │ Transparent   │
                                                 │  (any nav)    │
┌──────────────┐         ┌──────────────┐        │               │
│ 2. Mega Menu │         │ 6. Bottom    │        │ Floating      │
│    multi-col │         │    (icons +  │        │  (any nav)    │
│    dropdown  │         │    labels)   │        └───────────────┘
└──────────────┘         └──────────────┘

┌──────────────┐
│ 3. Sidebar   │
│    vertical  │
│    dashboard │
└──────────────┘

┌──────────────┐         ┌──────────────┐
│ 4. Sticky    │         │ 7. Sticky    │
│    (top var) │         │    mobile CTA│
└──────────────┘         └──────────────┘

┌──────────────┐         ┌──────────────┐
│ Transparent  │         │ 8. Floating  │
│ Hero-overlay │         │    Action    │
│ variant      │         │    Button    │
└──────────────┘         └──────────────┘
```

**Each Navigation Registration** declares:
- `pattern: "top" | "mega" | "sidebar" | "bottom" | "drawer" |
   "sticky" | "transparent" | "floating"`
- `devices: readonly ("mobile" | "tablet" | "desktop")[]`
- `contentShape: "navigation"` (from Design Registry)
- Standard `RegistrationBase` fields

**AI selection rule** (deterministic):
- `layout === "dashboard"` → sidebar (desktop) + drawer (mobile)
- `layout === "mobile-app"` → bottom nav
- `layout has "landing" || "trades"` → sticky top (desktop) + drawer (mobile)
- `layout === "restaurant"` → transparent top over hero (desktop) + drawer (mobile)

---

## 10. Booking architecture

Full booking flow — the highest-conversion trade UX.

```
┌────────────────────────────────────────────────────────────────┐
│                     BOOKING ENGINE                             │
│                                                                │
│  1. Availability model                                         │
│     ┌─────────────────────────────────────────────────────┐   │
│     │  studio_booking_availability                        │   │
│     │  brand_id, weekday, start_time, end_time, capacity  │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                                │
│  2. Slot generation                                            │
│     ┌─────────────────────────────────────────────────────┐   │
│     │  generateSlots(availability, date, service_duration)│   │
│     │  → SlotView[] with { start, end, remaining }        │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                                │
│  3. Booking flow                                               │
│     ┌─────────────────────────────────────────────────────┐   │
│     │  Choose service → Choose date → Choose slot →       │   │
│     │  Customer info → (optional) Deposit → Confirm       │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                                │
│  4. Persistence                                                │
│     ┌─────────────────────────────────────────────────────┐   │
│     │  studio_bookings                                    │   │
│     │  status: pending / confirmed / cancelled / no-show  │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                                │
│  5. Reminders                                                  │
│     ┌─────────────────────────────────────────────────────┐   │
│     │  cron: hourly. Fires email + optional SMS at        │   │
│     │  { -24h, -1h } of booking start                     │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                                │
│  6. Reschedule / Cancel                                        │
│     ┌─────────────────────────────────────────────────────┐   │
│     │  Merchant-set policy: allowed until X hours before  │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                                │
│  7. Deposit                                                    │
│     ┌─────────────────────────────────────────────────────┐   │
│     │  Optional Stripe integration.                       │   │
│     │  Deposit percent set per service.                   │   │
│     │  Remainder invoiced after service.                  │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                                │
│  8. Calendar sync (Google + Outlook)                           │
│     ┌─────────────────────────────────────────────────────┐   │
│     │  OAuth per brand. Two-way sync so busy blocks in    │   │
│     │  their personal calendar prevent booking.           │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**`bookingRegistry` populations (M3 target):**
- `flow.simple` — service → slot → confirm (no deposit, no auth)
- `flow.with-deposit` — service → slot → deposit → confirm
- `flow.wizard-quote` — quote request → merchant confirms → book
- `flow.emergency` — postcode → auto-slot next available

**Integration adapters (registry-driven — like `paymentProcessors`):**
- `bookingIntegrationRegistry`:
  - `stripe-deposit`
  - `google-calendar`
  - `outlook-calendar`

**Storage tables (new migrations):**
- `studio_booking_availability`
- `studio_booking_services` (name, duration, price, deposit%)
- `studio_bookings`
- `studio_booking_calendar_tokens` (OAuth)

**Reused from platform:**
- `paymentProcessors` (deposit routing)
- `formRegistry` (customer info step uses a Form)
- Resend (reminder email)
- web-push (optional storefront push reminders)

---

## 11. Dashboard architecture

The merchant's Business OS control panel.

```
┌────────────────────────────────────────────────────────────────┐
│                   DASHBOARD FRAMEWORK                          │
│                                                                │
│  A Dashboard = Layout (`dashboard-shell`)                      │
│              + Navigation (sidebar / bottom on mobile)         │
│              + N Dashboard Blocks                              │
│                                                                │
│  Every Dashboard Block is a registered component that:         │
│    ● renders from a data-loading contract                      │
│    ● declares which registries + tables it depends on          │
│    ● supports at least 3 sizes (1x1, 2x1, 2x2 in a 4-col grid) │
│                                                                │
└────────────────────────────────────────────────────────────────┘

DASHBOARD BLOCK REGISTRY (M3, 11 registered):

┌─────────────────┬─────────────────┬────────────────┐
│ analytics.card  │ statistics.big  │ chart.line     │
│ (single metric  │ (large number   │ (Recharts —    │
│  + delta)       │  + delta)       │  installed M6) │
└─────────────────┴─────────────────┴────────────────┘
┌─────────────────┬─────────────────┬────────────────┐
│ chart.bar       │ chart.donut     │ table.data     │
│                 │                 │ (TanStack —    │
│                 │                 │  installed M6) │
└─────────────────┴─────────────────┴────────────────┘
┌─────────────────┬─────────────────┬────────────────┐
│ crm.contact-list│ orders.recent   │ jobs.pipeline  │
└─────────────────┴─────────────────┴────────────────┘
┌─────────────────┬─────────────────┬────────────────┐
│ messages.inbox  │ calendar.week   │ activity.feed  │
└─────────────────┴─────────────────┴────────────────┘
        │
        ▼
┌─────────────────┐
│notifications.   │
│center           │
└─────────────────┘
```

**Deferred to later milestones** (each requires its own subsystem):
- TanStack Table wrap-in (dependency for `table.data`) → M6 or as
  quick prep here
- Recharts wrap-in (dependency for `chart.*`) → same
- Actual data pipes to charts (M8)

**M3 ships:** the registry + block components + a working Dashboard
Layout that reads from mock data. Real integrations arrive as the
underlying systems ship in M5+.

---

## 12. Forms architecture

Every form on every generated app shares one architecture.

```
┌────────────────────────────────────────────────────────────────┐
│                   FORMS FRAMEWORK                              │
│                                                                │
│  A Form = Schema (Zod) + Fields (Form Registry) + Runtime      │
│                                                                │
└────────────────────────────────────────────────────────────────┘

              ┌───────────────────────┐
              │  FORM REGISTRATION    │
              │                       │
              │  id: forms.quote-req  │
              │  fields: FormField[]  │
              │  schema: () => Zod    │
              │  submitEndpoint: str  │
              │  successMessage: str  │
              │  category: forms      │
              │  version, tags, ...   │
              └───────────┬───────────┘
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
   FormField[]         Zod Schema        Submit adapter
                                          (Formspree /
                                           custom URL /
                                           Supabase table)

FIELD PRIMITIVES (M3):
  ● text                ● textarea         ● email
  ● tel                 ● number           ● date
  ● time                ● datetime         ● select
  ● multi-select        ● checkbox         ● radio-group
  ● switch              ● file-upload      ● signature
  ● postcode            ● address          ● photo-upload
  ● multi-step group    ● conditional grp

BUILDER (Studio surface — not shipped in M3):
  Merchant drags fields; form is saved as a formRegistry entry.

TEMPLATE FORMS (M3 target):
  ● forms.contact              ● forms.quote-request
  ● forms.newsletter           ● forms.callback-request
  ● forms.booking-info         ● forms.job-application
  ● forms.review-submit        ● forms.custom-blank
```

**Every form flow:**
1. Registry lookup → get schema + fields
2. `<Form>` wraps `useForm(zodResolver(schema))`
3. `<FormField>` per field from the fields[] declaration
4. Submit → POST to declared endpoint + persist to
   `studio_form_submissions` if merchant enabled
5. Response → toast + optional redirect

**Persistence:**
- `studio_form_templates` (registry mirror for merchant-authored forms)
- `studio_form_submissions` (every submission)

---

## 13. Implementation plan — batches + sequencing

Total scope: 8 subsystems + engineering quality stream.

### Batches

| Batch | Subsystem | Scope | Duration |
|---|---|---|---|
| **B1** | Registry additions | 5 new registries created empty | 1 week |
| **B2** | Container System 100% | 9 remaining containers + tier field | 2 weeks |
| **B3** | Navigation System | 8 nav patterns registered + renderers | 2 weeks |
| **B4** | Layout Engine | 12 layout templates + selector | 2 weeks |
| **B5** | Forms Framework | Field primitives + template registrations | 1.5 weeks |
| **B6** | Dashboard Framework | Dashboard shell + 11 block types | 2 weeks |
| **B7** | Booking Engine | 4 flows + Stripe deposit + email reminders + Google Calendar sync | 3 weeks |
| **B8** | AI Composition Engine v2 | 14-step pipeline + intent extractor + journey selector | 2 weeks |
| **B9** | M3 completion report + registry self-check | Full cross-registry validation | 0.5 weeks |

**Total: ~16 weeks focused work.** Parallel engineering quality
stream adds no calendar time (concurrent time-slicing).

### Sequencing constraints

- **B1 first** — every subsystem below writes into registries created
  in B1
- **B2 before B4** — layouts declare compatible containers; those
  containers must exist
- **B3 before B4** — layouts declare default navigation
- **B5 before B7** — booking uses a Form for customer info
- **B5 before B8** — AI composer references form registrations
- **B6 before B8** — dashboard blocks are catalogued for AI selection
- **B8 last** — pipeline consumes every prior registry

### Checkpoints (5)

- Checkpoint after B1 (registries in place)
- Checkpoint after B4 (Layout Engine end-to-end for Landing +
  Trades layouts)
- Checkpoint after B6 (Dashboard + Forms + Nav all working)
- Checkpoint after B7 (Booking end-to-end)
- Final at B9 (M3 completion report)

---

## 14. Parallel Engineering Quality stream

Concurrent with B1–B9. Time-sliced (~15% of focused hours).

| Sprint | Deliverable |
|---|---|
| Week 1 | Fix 6 pre-existing type errors in `trade-off/edit/**` |
| Week 2 | Install vitest + configure it for the 16 existing `.test.ts` files |
| Week 3 | SelfCheck boot hook — run `.selfCheck()` on every registry at dev-server start; log warnings to terminal |
| Week 4 | Add `next lint` script + fix top 20 lint warnings |
| Week 5 | Add M3-specific unit tests for the 5 new registries |
| Week 6 | Wire GitHub Actions to run typecheck + lint + vitest on PR |
| Week 7 | Add `@axe-core/react` for a11y smoke tests on the shadcn primitives + new containers |
| Week 8 | First pass Playwright integration test hitting `/studio/generate` |
| Week 9 | Bundle-size CI (fail if `.next/` output exceeds baseline + 10%) |
| Week 10 | Lighthouse CI on the generated preview surface |
| Week 11 | Registry telemetry export to Supabase (warehouse table + insert on registration) |
| Week 12 | M3 CI acceptance gate — typecheck clean, tests green, self-check green, lint clean |
| Buffer weeks 13–16 | Fix regressions found during main batches |

This stream is **owned by the platform engineer** and time-sliced —
not a separate team, not a separate milestone.

---

## 15. Deliverables checklist

### Registries created (5)
- [ ] `layoutRegistry`
- [ ] `navigationRegistry`
- [ ] `dashboardBlockRegistry`
- [ ] `bookingRegistry`
- [ ] `formRegistry`

### Containers (9 new → 19 total)
- [ ] `containers.timeline`
- [ ] `containers.pricing`
- [ ] `containers.gallery`
- [ ] `containers.portfolio`
- [ ] `containers.comparison`
- [ ] `containers.dashboard-shell`
- [ ] `containers.floating`
- [ ] `containers.accordion`
- [ ] `containers.wizard`

### Layouts (12)
- [ ] `layouts.landing`
- [ ] `layouts.trades`
- [ ] `layouts.ecommerce`
- [ ] `layouts.booking`
- [ ] `layouts.saas`
- [ ] `layouts.dashboard`
- [ ] `layouts.portfolio`
- [ ] `layouts.directory`
- [ ] `layouts.marketplace`
- [ ] `layouts.restaurant`
- [ ] `layouts.magazine`
- [ ] `layouts.mobile-app`

### Navigation (8)
- [ ] `navigation.top`
- [ ] `navigation.mega`
- [ ] `navigation.sidebar`
- [ ] `navigation.bottom`
- [ ] `navigation.drawer`
- [ ] `navigation.sticky`
- [ ] `navigation.transparent`
- [ ] `navigation.floating`

### Dashboard blocks (11)
- [ ] `dashboard.analytics-card`
- [ ] `dashboard.statistics-big`
- [ ] `dashboard.chart-line`
- [ ] `dashboard.chart-bar`
- [ ] `dashboard.chart-donut`
- [ ] `dashboard.table-data`
- [ ] `dashboard.crm-contact-list`
- [ ] `dashboard.orders-recent`
- [ ] `dashboard.jobs-pipeline`
- [ ] `dashboard.messages-inbox`
- [ ] `dashboard.calendar-week`
- [ ] `dashboard.activity-feed`
- [ ] `dashboard.notifications-center`

### Booking (4 flows + 3 integrations + 4 migrations)
- [ ] `booking.flow.simple`
- [ ] `booking.flow.with-deposit`
- [ ] `booking.flow.wizard-quote`
- [ ] `booking.flow.emergency`
- [ ] `bookingIntegrations.stripe-deposit`
- [ ] `bookingIntegrations.google-calendar`
- [ ] `bookingIntegrations.outlook-calendar`
- [ ] Migration: `studio_booking_availability`
- [ ] Migration: `studio_booking_services`
- [ ] Migration: `studio_bookings`
- [ ] Migration: `studio_booking_calendar_tokens`

### Forms (8 templates + field library)
- [ ] `forms.contact`
- [ ] `forms.quote-request`
- [ ] `forms.newsletter`
- [ ] `forms.callback-request`
- [ ] `forms.booking-info`
- [ ] `forms.job-application`
- [ ] `forms.review-submit`
- [ ] `forms.custom-blank`
- [ ] Field library: text, textarea, email, tel, number, date, time,
      datetime, select, multi-select, checkbox, radio-group, switch,
      file-upload, signature, postcode, address, photo-upload,
      multi-step group, conditional group

### AI Composition Engine v2
- [ ] New LLM task: `prompt.extract-intent`
- [ ] `journeyRegistry` (tiny — 5–8 canonical journeys)
- [ ] Deterministic layout selector
- [ ] Deterministic navigation selector
- [ ] Container-plan generator
- [ ] Pipeline orchestrator (`composePipeline(prompt): FinalApp`)
- [ ] 13-trade × 5-page composition smoke test

### Engineering Quality Stream
- [ ] 0 pre-existing type errors
- [ ] `pnpm test` runs vitest across all `.test.ts`
- [ ] SelfCheck boot hook
- [ ] `next lint` script + < 5 warnings
- [ ] GitHub Actions CI (typecheck + lint + test)
- [ ] a11y smoke tests
- [ ] Playwright integration test
- [ ] Bundle-size CI
- [ ] Lighthouse CI
- [ ] Registry telemetry warehouse export

### Documentation
- [ ] Per-registry API reference (5 new)
- [ ] Per-subsystem architecture doc (Layout, Navigation, Dashboard,
      Booking, Forms)
- [ ] Business OS Amendment 2 propagation to `MEMORY.md`
- [ ] M3 completion report

---

## 16. Approval requested

**No code has been written for M3.** This is the master plan +
architecture pack the Constitution requires before implementation.

**Three approvals needed:**

1. **Approve the 8-subsystem scope** — everything in §2. Any
   subsystem you want reprioritised into a later milestone?
2. **Approve the batch sequencing** — B1 → B2/B3 (parallel-safe) →
   B4 → B5 → B6 → B7 → B8 → B9. Any batch to swap?
3. **Approve the engineering quality stream as parallel work** — no
   separate milestone; concurrent time-slicing owned by the same
   engineer.

Once approved, I open with **B1 — Registry additions** (~1 week
scope, low risk, unlocks every downstream batch).

**Note on effort estimate:** revised M3 is **12–16 weeks** vs the
original 3–4 weeks. This is honest reflection of the expanded scope,
not scope creep. Every subsystem is Constitution-mandated. If you'd
prefer to split M3 into two smaller milestones (M3a: Foundation +
Layout Engine + Navigation; M3b: Dashboard + Booking + Forms + AI v2
+ Registry Completion), I can restructure — but recommend keeping it
as one because AI Composition Engine v2 (B8) needs every other
subsystem present to be meaningful.
