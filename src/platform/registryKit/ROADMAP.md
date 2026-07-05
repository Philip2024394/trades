# XRATED TRADES AI PLATFORM — MASTER ROADMAP

**Version:** 1.1
**Adopted:** 2026-07-05 (after Milestone 2 completion)
**Amendments:** v1.1 — PMM referenced as milestone completion
  criterion. Chief Platform Architect framework binds every batch.
**Governs:** every milestone from M3 onward.

## Governance references (mandatory reading before any batch)

- Constitution — `CONSTITUTION.md` (v1 + Amendments 1–3)
- Platform Maturity Model (PMM) — `PLATFORM_MATURITY_MODEL.md`
- M3 architecture pack — `M3_PLATFORM_CORE.md`

**Milestone completion is measured by PMM deltas**, not feature
counts. "M3 is complete" is not acceptable; "M3 raised Foundation
82% → 100%, AI Composition 46% → 75%, Business OS 51% → 72%" is.

This roadmap is the sequencing plan for finishing the platform. It
supersedes any per-session ordering discussion. Every milestone must
be completed before the next begins unless an explicit dependency
exception is called out.

---

## Table of contents

1. Executive summary
2. Current state (post-M2)
3. Architecture layer model
4. Milestone overview
5. Per-milestone detail (M3–M10)
6. Dependency graph
7. Layer coverage matrix
8. Risks + trade-offs
9. Recommended next action

---

## 1. Executive summary

Milestones 1 and 2 built the **Foundation Layer** — a registry kit,
shared design system, container primitives, form system, tokens, and
theme extension. The AI now has a real catalogue to compose from.

Milestones 3 through 10 stand the rest of the platform up on that
foundation. The sequencing rule is **shipping order matches
consumption order**: no milestone builds a system that has nothing to
consume it, and no milestone consumes a system that has not shipped.

Concretely:
- **M3** finishes the Foundation Layer to 100%.
- **M4** expands the Composition Layer's inputs (components + sections).
- **M5** opens the Marketplace Layer so third parties can extend.
- **M6** fills the Content Layer with production-grade assets.
- **M7** delivers the mobile Experience Layer surface (PWA).
- **M8** makes AI composition intelligent (multi-turn, style-aware).
- **M9** delivers the Experience Layer's enterprise surface (teams,
  white label, plugins).
- **M10** ratifies production readiness (tests, performance,
  observability).

Total estimated calendar: **8–14 months** at current velocity. Total
estimated engineer-hours: **~1,200–1,600** hours.

---

## 2. Current state (post-M2)

Numbers that ground every downstream estimate.

| Surface | Post-M1 | Post-M2 |
|---|---|---|
| Registries | 9 | 10 |
| shadcn primitives | 7 | 25 |
| Container primitives | 1 | 10 |
| Design Registry entries | 7 | 36 |
| Design tokens | 0 | 63 |
| Theme presets | 6 | 6 (extended to full design language) |
| Sections registered | 48 | 48 |
| Blueprints | 52 | 52 |
| Knowledge Graph packages | 13 | 13 |
| Apps | 3 | 3 |
| Industry Packs | 1 | 1 |
| Unique curated images | 2 | 2 |
| Radix packages installed | 3 | 14 |
| Pre-existing type errors | 7 | 6 |
| Test files (executable) | 0 | 0 |

The two red numbers — **2 unique images** and **0 executable tests**
— are the two most important gaps and are addressed in M6 and M10.
Everything else grows through the sequence.

---

## 3. Architecture layer model

Adopted in Constitution v1 Amendment 1. Every remaining milestone
maps to one or two of these layers.

```
┌───────────────────────────────────────────────────────────────┐
│                     Experience Layer                          │
│  Studio editor · WYSIWYG · DnD · Publishing · Mobile · Teams  │
└───────────────────────────────────────────────────────────────┘
                              ▲
                              │ consumes
┌───────────────────────────────────────────────────────────────┐
│                     Marketplace Layer                         │
│  Apps · Packs · Templates · Plugins · Search · Install        │
└───────────────────────────────────────────────────────────────┘
                              ▲
                              │ consumes
┌───────────────────────────────────────────────────────────────┐
│                       Content Layer                           │
│  Images · Icons · Copy · Videos · Fonts · Animations          │
└───────────────────────────────────────────────────────────────┘
                              ▲
                              │ consumes
┌───────────────────────────────────────────────────────────────┐
│                    Composition Layer                          │
│  AI Composer · Prompt Parser · Section/Container/Theme Picker │
└───────────────────────────────────────────────────────────────┘
                              ▲
                              │ consumes
┌───────────────────────────────────────────────────────────────┐
│                    Foundation Layer                           │
│  Registries · Design System · Tokens · Themes · Containers    │
└───────────────────────────────────────────────────────────────┘
```

Every layer above depends on every layer below. Milestones are
sequenced so lower layers finish (or reach a usable threshold) before
higher layers begin consuming them.

---

## 4. Milestone overview

| # | Milestone | Primary layer(s) | Depends on | Duration est. |
|---|---|---|---|---|
| M1 | Registry Foundation | Foundation | — | ✅ shipped |
| M2 | Design System Foundation | Foundation | M1 | ✅ shipped |
| **M3** | **Platform Core Completion** | **Foundation (finish)** | **M2** | **3–4 weeks** |
| **M4** | **Component & Section Expansion** | **Foundation + Composition** | **M3** | **6–8 weeks** |
| **M5** | **Marketplace Expansion** | **Marketplace** | **M4** | **6–8 weeks** |
| **M6** | **Asset Intelligence System** | **Content** | **M4 (baseline), M5 (marketplace hooks)** | **8–10 weeks** |
| **M7** | **Mobile Platform** | **Experience (mobile)** | **M3 (containers), M6 (assets)** | **4–6 weeks** |
| **M8** | **AI Automation Layer** | **Composition (depth)** | **M4, M6** | **6–8 weeks** |
| **M9** | **Enterprise & White Label** | **Experience (enterprise)** | **M5, M7** | **8–10 weeks** |
| **M10** | **Performance, Testing & Production Readiness** | **Cross-cutting** | **All** | **6–8 weeks (concurrent from M4)** |

**Notable exception:** M10's test-infra strand can start in parallel
with M4 — we should not wait until the end to install a test runner.
Details in the M10 entry.

---

## 5. Per-milestone detail

Each milestone below carries the same shape:
- **Layer + Constitution mapping**
- **Goal** — one sentence
- **Scope** — bullets
- **Deliverables** — concrete artefacts
- **Success criteria** — measurable exit conditions
- **Effort estimate**
- **Deferred out of this milestone**

---

### M3 — Platform Core Completion **[REVISED 2026-07-05]**

**Scope revised.** Original M3 was foundation cleanup (~3–4 weeks).
Revised M3 completes the *Platform Core* — 8 subsystems that together
turn the platform from "assembles a page" into "assembles a Business
OS." Detailed plan lives in `M3_PLATFORM_CORE.md`.

**Layer:** Foundation (78% → 100%) + Composition (v2) + first
Business OS layers above Foundation.

**Constitution items:** Design System, Container System, Layout
Engine, Navigation, Dashboard, Booking, Forms, AI Composition Engine
v2, Registry Completion, Business OS layered assembly (Amendment 2).

**Goal:** every Business OS layer above Containers has a registry-
driven implementation before M4 begins.

**Scope (8 subsystems):**
1. **Container System 100%** — Timeline, Booking, Pricing, Gallery,
   Portfolio, Comparison, Dashboard, Floating, Accordion, Wizard,
   sidebar variants, mobile-optimised, commerce-optimised.
2. **Layout Engine** — 12 layout templates (Landing, Trades,
   Ecommerce, Booking, SaaS, Dashboard, Portfolio, Directory,
   Marketplace, Restaurant, Magazine, Mobile App). AI selects layout
   from intent.
3. **Navigation System** — 8 nav patterns registered (Top, Mega,
   Sidebar, Bottom, Drawer, Sticky, Transparent, Floating).
4. **Dashboard Framework** — Analytics cards, Statistics, Charts,
   Tables, CRM, Orders, Jobs, Messages, Calendar, Activity, Notifications.
5. **Booking Engine** — Availability, Calendar, Slots, Reschedule,
   Cancellation, Reminders, Deposits, Stripe + Google Calendar +
   Outlook integrations.
6. **Forms Framework** — Builder, Zod validation, conditional fields,
   multi-step, file upload, signatures.
7. **AI Composition Engine v2** — 14-step pipeline (Prompt → Business
   → Intent → Customer Journey → Layout → Containers → Navigation →
   Sections → Components → Apps → Theme → Tokens → Assets → Final).
8. **Registry Completion** — every new subsystem registry-driven; 5
   new registries (layout, navigation, dashboard, booking, form).

**Parallel: Engineering Quality Stream** — runs concurrently, not as a
gate. Type-error sweep, vitest install, SelfCheck boot hook, lint,
CI. Owned by the same engineer but time-sliced.

**Success criteria (M3 exit):**
- All 8 subsystems have working registries + ≥ minimum viable content
- AI composer executes the 14-step pipeline end-to-end for the 13 KG
  trades
- 100% of the Platform Core is registry-driven; no hand-coded
  subsystem
- Every new registry passes `selfCheck()` clean
- Engineering Quality stream delivers: 0 type errors, vitest running,
  boot-time SelfCheck warning surface

**Effort estimate (revised):** 480–640 hours / 12–16 weeks. Split ~85%
platform core, ~15% engineering quality stream.

**Deferred out of M3** (into later milestones):
- 100+ image asset library (M6)
- Marketplace UIs (M5)
- WYSIWYG canvas editing (M9)
- PWA installability (M7)
- Multi-turn AI conversation (M8)
- Enterprise teams / white label (M9)
- Real payment provider live integration (M5)

---

### M4 — Component & Section Expansion

**Layer:** Foundation (component depth) + Composition (composer has
more variety to pick from).
**Constitution items:** Design System depth, Section Library, "AI
composes from registries."

**Goal:** grow the section registry from 48 to 100+ with strong
category coverage, and refactor sections to consume M3 containers so
layouts stop being encoded inline.

**Scope:**
- **Missing section categories** (from CTO audit):
  - Booking (4 variants: calendar, slot-picker, wizard, quick-form)
  - Timeline (project milestones, before/after, history)
  - Portfolio (own library — not gallery)
  - Blog (post-list, single-post, category-grid)
  - Dashboard section (metric strip, chart card, activity feed)
- **Section variety per existing category** — every category to
  ≥ 3 variants (currently many have 1). Priority: Contact, Newsletter,
  Team, Pricing, Footer.
- **Retrofit existing sections to consume M3 containers.** Sections
  become content descriptors; container ids come from their manifest.
  This is the big Constitutional shift: "Sections never own layouts."
- **AI-composer expansion** — `composeHomeLayout()` learns container
  selection alongside section selection. New helper `composePage(pageId,
  intent)` handles Home / About / Services / Contact / Booking pages.
- **Section KG binding for remaining categories** — Team, Pricing,
  Portfolio, Blog all learn to pull content from `packageForTrade()`.

**Deliverables:**
- ~50 new section registrations
- Container-aware section manifest field (`layoutContainerId?: string`)
- Refactored `composeHomeLayout()` + new `composePage()`
- Booking section family (blocks the Booking milestone in the CTO
  audit's original Phase 1)
- 5 new page-composition templates

**Success criteria:**
- Section count: 100+
- Every section category has ≥ 3 variants
- ≥ 50% of sections declare a `layoutContainerId`
- New `composePage()` produces valid layouts for 5 page ids × 13
  trades = 65 test cases
- Zero regressions in the 48 existing sections

**Effort estimate:** 240–320 hours / 6–8 weeks.

**Deferred:** WYSIWYG editor (M9), asset-heavy section variants (need
M6 assets first).

---

### M5 — Marketplace Expansion

**Layer:** Marketplace.
**Constitution items:** Marketplace — "Everything installable belongs
in the Marketplace."

**Goal:** turn the marketplace from infrastructure-only into a real
browsing + install experience. Grow App / Pack / Template content
past the demo threshold.

**Scope:**
- **App content** — 3 → 15 Apps. Core coverage: Reviews, Blog,
  Gallery, Service Menu, Quote Builder, Live Chat, WhatsApp Catalog,
  Cookie Banner, Analytics, Booking (from M4), Newsletter (existing),
  Team (existing), Meet-the-Team (existing), Trade Connections
  (existing), Materials Network.
- **Industry Pack content** — 1 → 6 Packs: Emergency Trades,
  Showroom Trades, Plant Hire, Materials Supply, Home Improvement,
  Commercial.
- **Template browser** — blueprints already exist (52); Studio surface
  gets a proper Template gallery + preview + one-click install.
- **Marketplace search + filter UIs** — kit already provides
  `.search()` and `.listByTag()`; wire into the Studio browser as
  chips + search box.
- **Install / Remove / Replace / Upgrade / Rollback flows** — UIs +
  API routes. Rollback via registry snapshots.
- **Ratings + reviews schema + endpoint** — no user reviews collected
  yet; ship the tables + endpoints. UI comes with M8 or M9.
- **Version history + upgrade diff view** — merchant sees what
  changed before accepting an upgrade.

**Deliverables:**
- 12 new App manifests + storage tables
- 5 new Industry Pack manifests
- Marketplace search bar + tag chips + filters
- Install/upgrade/rollback UI + APIs
- Ratings schema + API
- 3 SQL migrations (marketplace_ratings, marketplace_downloads,
  marketplace_version_history)

**Success criteria:**
- App count: 15+
- Pack count: 6+
- Template gallery renders 52 blueprints with preview thumbnails
- Search across marketplace returns weighted results
- Install / upgrade / rollback flows work end-to-end in dev

**Effort estimate:** 240–320 hours / 6–8 weeks.

**Deferred:** Publisher onboarding flow (M9), payment for paid Apps
(post-M9), analytics on install rates (M10).

---

### M6 — Asset Intelligence System

**Layer:** Content.
**Constitution items:** Asset Library, "No low-quality or outdated
assets", "Themes control images and gradients."

**Goal:** move from 2 curated images to a live asset intelligence
system that serves the AI composer with production-grade content.

**Scope:**
- **Curated image library** — 100+ industry-tagged URLs across the
  13 KG trades. Sources: Unsplash + Pexels + merchant-uploaded. Every
  URL carries: industry, category, style, mood, orientation, colour
  palette, license, attribution.
- **Icon library** — Lucide icons catalogued with metadata (industry
  affinity, trade tag, size guidance). Already in Design Registry
  from M3; M6 adds AI selection rules.
- **Illustration slots** — SVG illustration library for empty-states,
  onboarding, error pages.
- **Video asset support** — hero-video slot on Overlay + Hero
  containers.
- **Font marketplace** — Google Font pairs beyond the current 6, each
  with industry-recommendation metadata.
- **Animation marketplace** — Framer Motion + Magic UI presets
  catalogued.
- **Merchant-uploaded asset flow** — upload → auto-tag (colour palette
  extraction, orientation detection, optional AI-classified industry)
  → register in the asset library.
- **AI asset matching** — replaces the current djb2-hash pool pick
  with a scored match using the token-set colour palette so images
  harmonise with the theme.

**Deliverables:**
- ≥ 500 rows in `studio_asset_library` covering all 13 trades
- Icon tagging pass across Lucide inventory
- 30+ illustrations (empty-states, error pages, onboarding)
- Video asset column on the library + Overlay container support
- 20+ font pair recommendations
- 15+ animation presets
- Merchant upload → auto-tag pipeline
- Theme-aware asset scorer (extends `assetLibrary.getRandomAsset()`)

**Success criteria:**
- Every generated app in the AI composer shows a distinct hero image
  from at least 10 candidates
- 100% of the 13 KG trades have ≥ 20 industry-tagged images
- Merchant upload flow: submit → tagged → available in ≤ 30 seconds
- Asset scorer picks images whose dominant colour is within a
  configurable delta of the active token set's primary

**Effort estimate:** 300–400 hours / 8–10 weeks.

**Deferred:** Motion-video generation (M8 AI layer), 3D asset support
(post-M10), AI-generated custom illustrations (M8).

---

### M7 — Mobile Platform

**Layer:** Experience (mobile surface).
**Constitution items:** Mobile-First, PWA, Native features.

**Goal:** make every generated merchant site installable, offline-
capable, and mobile-native-feeling. Bring the "mobile app builder"
claim from web-only to installable.

**Scope:**
- **PWA foundation** — `public/manifest.json`, `apple-touch-icon`,
  `next-pwa` or manual service worker.
- **Install prompt** — one-tap install on Chrome + Safari.
- **Offline layout hydration** — last-rendered layout cached in
  IndexedDB; site loads offline in read-only mode.
- **Bottom navigation container** — new container primitive (belongs
  with M3 architecturally but scoped here because it's mobile-first
  behaviour).
- **Storefront push notifications** — merchant sends push updates to
  their own site's subscribers. Reuses the trade-directory push infra
  (already installed).
- **Native shell scaffold** — Capacitor project generation script; not
  a full native build, but the entry point that turns a published site
  into an APK / IPA candidate.
- **Camera + GPS surfaces** — form field types that request device
  APIs (photo upload for job diary, GPS check-in for site visits).
- **Mobile section variants** — sections with tighter mobile designs
  where the desktop pattern doesn't compress cleanly.

**Deliverables:**
- PWA-installable published sites
- Offline read of the last layout
- Bottom navigation container
- Push notification API for merchant storefronts
- Capacitor scaffold command
- 5 new mobile section variants (compact hero, tab-nav, bottom-cta,
  swipe-testimonial, mobile-drawer-menu)

**Success criteria:**
- Every published site passes Lighthouse PWA audit ≥ 90
- Manual test: install a merchant site, go offline, open — layout
  renders
- Push notification sent from Studio arrives on subscribed device

**Effort estimate:** 160–240 hours / 4–6 weeks.

**Deferred:** Full native app builds (deferred to a post-roadmap
strand once Capacitor scaffolds prove viable), Apple push (requires
APNs cert), background sync (post-M10).

---

### M8 — AI Automation Layer

**Layer:** Composition (depth).
**Constitution items:** AI Rules, Prompt Engine, Future AI pipeline.

**Goal:** the AI stops being a one-shot composer and becomes a
conversational, style-aware, layout-editing partner.

**Scope:**
- **Prompt parser expansion** — extract the remaining Constitution
  signals: `audience`, `style`, `brandPersonality`, `colourPreferences`,
  `tone`, `bookingNeeds`, `commerceNeeds`, `crmNeeds`. Add matching
  Zod schemas.
- **Multi-turn refinement** — after initial generation, merchant can
  say "make it more premium" / "swap to a dark palette" / "add a
  booking section"; AI updates the layout without regenerating from
  scratch.
- **Content generation in section blanks** — AI writes hero
  headlines, service descriptions, FAQs when the section has no
  content, respecting trade-plain voice + KG-derived truth.
- **Deep section AI** — `.aiPrompts` on every section registration
  gets fully wired (currently many are stubs).
- **Style-aware theme + token swap** — merchant says "make it feel
  premium" → AI swaps token set + theme preset + effect intensity
  (not just colours).
- **Growth Coach automation** — proactive recommendations, not just
  on-demand. Runs on layout save + weekly cron.
- **Layout AI operations** — `layout.replaceSection(id, prompt)`,
  `layout.rearrangeForOutcome(outcome)`, `layout.compressForMobile()`.
- **Image AI generation** — for merchants without their own photos,
  optional Anthropic/OpenAI image generation with brand-consistent
  prompts.
- **A/B test generation** — AI proposes a variant of a section; the
  experiments system (already scaffolded) rolls it out.

**Deliverables:**
- Extended `business.discover` + new `prompt.refine` LLM tasks
- Multi-turn AI session state (short-lived, cookie-scoped)
- Content-fill AI on every section that has aiPromptable fields
- Style-swap composer that respects brand overrides
- Growth Coach cron + save-time hook
- Layout operation API (`/api/studio/layout/replace-section` etc.)
- Optional image generation route (`/api/studio/media/generate`)
- A/B variant generator

**Success criteria:**
- Multi-turn conversation successfully iterates a layout across 3+
  turns
- Content-fill AI passes trade-plain voice validation (no marketing
  fluff) on 90% of generations
- Style-swap changes ≥ 4 dimensions (colour, radius, shadow,
  animation) on request
- Growth Coach surfaces 1+ recommendation per merchant per week

**Effort estimate:** 240–320 hours / 6–8 weeks.

**Deferred:** Fine-tuned models (post-M10), voice interface (post-M10),
real-time collaboration on AI edits (M9).

---

### M9 — Enterprise & White Label

**Layer:** Experience (enterprise + collaboration).
**Constitution items:** Enterprise features from the audit.

**Goal:** support agencies, resellers, teams, and platform integrators.

**Scope:**
- **Teams + roles + permissions** on brands. Currently every merchant
  session has full access to their brand.
- **Multi-tenant white label** — reseller domain routing so an agency
  can serve merchants under their own brand.
- **SDK for external integrations** — TypeScript SDK wrapping the
  registries + composer + preview iframe.
- **Plugin architecture** — third-party code loaded via manifest into
  the runtime (safe subset).
- **Presence + comments** on Studio pages — multi-editor.
- **Audit log** — every registry `.register()`, layout save, publish,
  install becomes an audit row.
- **API for external tools** — REST endpoints wrapping the SDK for
  no-code integrators (Zapier / n8n / Make.com).
- **Publisher onboarding for the Marketplace** — third-party App
  authors sign up, submit, get reviewed, publish. Ties in with M5's
  submissions infra.

**Deliverables:**
- `studio_teams`, `studio_permissions`, `studio_audit_log` migrations
- White-label domain routing at Next.js edge
- `@xrated/sdk` package publishable to npm
- Plugin loader with sandboxed execution
- Real-time presence via Supabase Realtime
- Audit log UI in admin
- Public API + docs
- Publisher onboarding flow + review queue

**Success criteria:**
- Agency user manages 5+ merchants under their own domain + brand
- SDK consumable from a fresh Next.js project in ≤ 10 minutes
- Two editors concurrent on the same page see each other's cursor
- Every state-changing action recorded in the audit log
- External developer publishes an App via the queue

**Effort estimate:** 320–400 hours / 8–10 weeks.

**Deferred:** SOC 2 compliance (post-M10), on-prem deploy
(post-roadmap), granular field-level permissions (post-M10).

---

### M10 — Performance, Testing & Production Readiness

**Layer:** Cross-cutting.
**Constitution items:** Testing, Performance, Security, Code Standards.

**Goal:** ratify production quality across every layer. This
milestone can start in parallel with M4 for the test-infra strand.

**Scope:**
- **Test infrastructure** *(start during M4)* — vitest configured in
  M3; M10 broadens: integration tests (Playwright), a11y CI
  (@axe-core/playwright), visual regression (Chromatic or Percy).
- **Performance budgets** — bundle-size CI + Lighthouse CI. Fail if a
  merchant site exceeds published budgets.
- **Registry snapshot cold-boot** — every registry writes its
  snapshot at build time so serverless cold starts hydrate from JSON
  rather than re-running all side-effect imports.
- **Client-bundle discipline** — `"server-only"` markers on Blueprint /
  App / Pack / KG registries so they never ship to the client.
- **Error tracking** — Sentry or equivalent. Registry telemetry hooks
  wired to it from M1's kit.
- **Observability** — analytics events from M1 flow to a warehouse
  (Supabase table or external destination).
- **SLO definitions** — publish targets for uptime, layout render
  time, AI response time, publish latency.
- **Security audit** — Radix + shadcn primitives are a11y-first but
  not audited for injection; sweep every `dangerouslySetInnerHTML` /
  RLS policy / auth boundary.
- **Load test** — 1000 concurrent merchant sites rendering; identify
  cold-start choke points.
- **Registry `.selfCheck()` gated in CI** — fails the build if any
  registry produces errors.

**Deliverables:**
- Playwright + axe-core CI
- Bundle-size + Lighthouse CI
- Registry snapshot generator
- Server-only marker file on 4 registries
- Sentry integration
- Analytics warehouse dispatch
- Documented SLOs
- Security audit report
- Load test report + fixes

**Success criteria:**
- CI runs unit + integration + a11y + Lighthouse on every PR
- No merchant site exceeds bundle budget
- Cold start p50 ≤ 800 ms
- Every registry has a self-check gate in CI
- 100% of state-mutating routes have RLS or explicit auth check
- 1000-tenant load test passes with p95 render ≤ 1.5 s

**Effort estimate:** 240–320 hours / 6–8 weeks (strand starts in M4).

**Deferred:** Chaos testing (post-roadmap), SOC 2 (post-roadmap),
distributed tracing (post-M10).

---

## 6. Dependency graph

```
                        M1 ─ Registry Foundation ✅
                        │
                        ▼
                        M2 ─ Design System Foundation ✅
                        │
                        ▼
                        M3 ─ Platform Core Completion
                        │
             ┌──────────┼──────────┐
             ▼          ▼          ▼
    M4 ─ Component +   M7 ─ Mobile   [M10 test infra
    Section Expansion  Platform      strand starts here]
             │          ▲
             │          │ needs
             │          │ M6 assets
             ▼          │
    M5 ─ Marketplace ───┤
    Expansion           │
             │          │
             ▼          │
    M6 ─ Asset Intel.───┘
             │
             ▼
    M8 ─ AI Automation
             │
             ▼
    M9 ─ Enterprise + White Label
             │
             ▼
    M10 ─ Production Readiness (finish + gate)
```

Key edges:
- **M4 → M5**: marketplace needs a wider component library to
  attract App authors.
- **M4 → M6**: assets are less valuable if there aren't components
  to place them in. Component expansion happens first.
- **M5 → M6**: Marketplace hooks are the entry point for third-party
  asset packs.
- **M6 → M7**: mobile experience benefits massively from a full asset
  bank (mobile sites feel poor with placeholder photos).
- **M6 → M8**: AI needs the asset library populated before
  style-aware selection is meaningful.
- **M7 → M9**: enterprise features benefit from a mobile-installable
  offering.

---

## 7. Layer coverage matrix

Each milestone's contribution to each layer.

| Milestone | Foundation | Composition | Content | Marketplace | Experience |
|---|:-:|:-:|:-:|:-:|:-:|
| M1 shipped | ✅ | — | — | — | — |
| M2 shipped | ✅ | ⚡ | — | — | — |
| M3 | 🎯 | ⚡ | — | — | — |
| M4 | ⚡ | 🎯 | — | — | — |
| M5 | — | ⚡ | — | 🎯 | ⚡ |
| M6 | — | ⚡ | 🎯 | ⚡ | ⚡ |
| M7 | ⚡ | — | ⚡ | — | 🎯 (mobile) |
| M8 | — | 🎯 | ⚡ | — | ⚡ |
| M9 | — | — | — | ⚡ | 🎯 (enterprise) |
| M10 | ⚡ | ⚡ | ⚡ | ⚡ | ⚡ (production ratification) |

Legend: 🎯 primary, ⚡ secondary.

By the end of M8 every layer has 🎯 coverage. M9 and M10 harden the
edges.

---

## 8. Risks + trade-offs

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| M4 becomes an infinite variety expansion | HIGH | Fixed exit criteria: 100 sections, 3+ variants per category, ≥ 50% container-refactored. Then stop. |
| M6 content curation blocks on licensing | MEDIUM | Start with Unsplash + Pexels (permissive licenses); merchant upload flow accepts self-owned photos. |
| M7 PWA on iOS is quirky | MEDIUM | Ship Chrome/Android first-class; iOS gets a documented workaround path. |
| M8 multi-turn AI cost inflation | MEDIUM | Cache aggressively; use cheapest provider for refinement steps; enforce budget hints already in `aiGateway`. |
| M9 real-time collaboration complexity | HIGH | Use Supabase Realtime for presence (proven); comments as async first, then live. |
| M10 test infra delayed | HIGH | Start test-infra strand in M4, not M10. |
| Registry drift across milestones | MEDIUM | Every milestone's exit criteria includes `registry.selfCheck()` clean. |
| Focus dilution across 7 in-flight products in the repo | HIGH | This roadmap governs `/trades`. Other verticals get their own roadmaps. |

### Trade-offs

- **We ship visual polish (M2 Magic UI + M6 assets) before deep AI
  smarts (M8).** Rationale: perceived quality drives adoption; smart
  AI on template output looks poor.
- **Marketplace expansion (M5) comes before content (M6).** Rationale:
  we need the marketplace as the *ingest* channel for third-party
  content. Otherwise M6 is a manual curation exercise that doesn't
  scale.
- **PWA (M7) before AI depth (M8).** Rationale: PWA is bounded scope;
  AI depth is open-ended. Ship the smaller wins first.
- **Enterprise (M9) before production readiness (M10).** Debatable —
  arguably production readiness should come first. But the M10 test
  strand starts in M4, so the CI gate is progressively built.

---

## 9. Recommended next action

**M3 — Platform Core Completion** is the next milestone.

Recommended entry sequence for M3 (three batches, each ~1 week):

**M3 Batch 1 — Sweep the pre-existing debt** (2–3 days):
- Fix 6 pre-existing type errors
- Install vitest + wire the 16 existing `.test.ts` files
- Ship SelfCheck dev-server hook
- Update `MEMORY.md` project doc

**M3 Batch 2 — Finish containers + docs** (5–7 days):
- Ship 9 remaining containers
- Ship per-primitive `.md` docs
- Icon token registry (Lucide catalogued)
- Font registry
- Animation preset registry

**M3 Batch 3 — Theme + tokens polish** (3–5 days):
- 6 dark-mode preset variants
- Brand-override merger utility
- Cross-registry sanity pass via `selfCheck()`
- M3 completion report

Then a checkpoint before M4 opens.

---

**Approval requested** for this roadmap as adopted policy. Once
approved, every session's plan output cites which milestone + batch
the work belongs to; drift is caught by the roadmap review.
