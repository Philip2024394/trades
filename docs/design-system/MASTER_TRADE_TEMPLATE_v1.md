# Master Trade Template V1

**Status:** authoritative · v1.1 · 2026-07-24 (refined after first design review — see §16 change log)
**Owners:** CEO (Philip O'Farrell) + Design Lead (TBD) + CTO (TBD) + Trade Brain Author(s)
**Scope:** the production specification for every NEX trade app — Carpenter, Builder, Plumber, Electrician, Bricklayer, Roofer, Landscaper, Painter, Plasterer, Kitchen, Staircase, Joinery, Metal Fabricator, and every future trade.
**Consumes:** [NEX_DESIGN_LANGUAGE_v1.md](./NEX_DESIGN_LANGUAGE_v1.md) — all tokens, components, and rules inherit from there.

---

## §0. What this document is

This is the ONE template every NEX trade app runs on. It defines:
- The fixed shell (nav · chat panel · footer) present in every trade app
- The seven conversation states and their canvas UI
- The module set that renders in the Discover state
- How trade-specific presets adjust module order and expert modules
- Every AI conversation each button launches
- Every state's data requirements, loading state, empty state, and error state
- Mobile-first responsive rules

There is no separate Staircase app, Plumber app, or Electrician app. There is ONE template with per-trade configuration. If a trade needs a component that isn't here, the addition happens to this template and then propagates to every trade — never as a one-off.

---

## §1. The fixed shell

Every NEX trade app has three parts that never vary structurally: nav, chat panel, footer. Merchant tokens change appearance (colour, logo); layout does not.

### 1.1 Top nav (fixed, thin)

Per Design Language §6.7. Height 56/64px, backdrop-blur, minimal.

**Contents:**
- **Left:** Merchant logo (max 32px height) + business name (`--text-lg --font-semi`). Tap → returns to Discover state (does not reload the page — issues a Nex command to transition state).
- **Right:** Only on mobile — single icon toggling the chat panel visibility.

**No hamburger menu. No dropdown. No page links.** The nav is a return-to-Discover affordance and a chat-toggle. That is all.

### 1.2 Chat surface (persistent in capability, not in visibility)

Per Design Language v1.1 §2 (revised). Chat is not an always-visible docked panel. It is a full-width surface the customer slides up when they engage. Reachable in one tap from anywhere:
- Typing in the Ask NEX bar (Discover surface)
- Tapping any Quick Action tile
- Tapping the + FAB in the bottom nav
- Tapping a product/project card that engages Nex

**Chat surface layout (mobile <1024px):**

Full-width overlay above the canvas, slides up with `--motion-medium --ease-nex-signature`. Backdrop dims to 40% opacity.

```
┌───────────────────────────────────────┐
│ NAV — back arrow · Nex avatar ·        │
│   [Merchant name] · "AI Assistant for │
│   [trade]" · online dot · 3-dot menu  │
├───────────────────────────────────────┤
│ MERCHANT IDENTITY BANNER              │
│  Logo · "Your [trade] Expert" ·        │
│  "Company Profile" pill                │
├───────────────────────────────────────┤
│                                        │
│  CHAT MESSAGE STREAM                  │
│  User bubbles (accent-50 bg, right)    │
│  Nex bubbles (white bg, avatar, left)  │
│  Inline UI cards (horizontal card      │
│    carousels for products/styles,      │
│    calendar snippets, quote summaries) │
│                                        │
│  Quick-reply chips (context-driven)    │
├───────────────────────────────────────┤
│ ASK NEX BAR — mic + orange send        │
├───────────────────────────────────────┤
│ TOOL TILES ROW (6 items — Gallery ·    │
│   Calculator · Materials · Regulations │
│   · Book Visit · Contact)              │
└───────────────────────────────────────┘
```

**Chat surface layout (desktop ≥1024px):** deferred. When we ship desktop, the chat becomes a right-side panel (440-480px) that can be pinned open OR opens on engagement. Same content spec.

**Message history is session-persistent.** Backing out to canvas and returning does not reset.

**Rule:** state transitions can occur without opening the chat surface. Tapping "Popular Styles" transitions Discover → Compare internally; the canvas swaps to a comparison grid; chat opens ONLY if Nex has something to say or the user types.

**Contents (top to bottom):**

1. **Chat panel header** — sticky top of panel
   - Nex avatar (32px, `--nex-accent-500`)
   - "Nex" + `--text-sm` subtitle showing current state ("Compare mode" / "Booking mode" / etc.)
   - Right icon: collapse (mobile/tablet only)

2. **Conversation history** — scrolling body
   - Nex + user chat bubbles per Design Language §6.2
   - Inline UI cards (single product, calendar snippet, etc.) rendered per §6.2
   - Skeleton bubble while AI thinking
   - Timestamps hidden by default; long-press / hover reveals

3. **Quick action chip strip** — sticky above input when Nex has offered options
   - Horizontal scroll, `--space-2` gap
   - Chip per Design Language §6.4
   - Tapping a chip sends its text as user message (and dismisses the strip)

4. **Chat input** — sticky bottom
   - Multiline text area, auto-grow to 4 lines then scroll
   - Left icon: message-circle (Lucide, 16px) — reinforces "ask" not "search"
   - Right button: send (pill button, `--nex-accent-500`)
   - Voice-input icon (mic) — Phase 2 addition, not V1

### 1.3 Bottom nav — OS destinations (permanent on mobile)

Per Design Language v1.1 §6.7. Permanent 5-item bottom nav representing operating-system destinations, not website pages.

**Standard 5 slots (customer-facing):**

| Slot | Icon (Lucide) | Label | State activated on tap |
|---|---|---|---|
| 1 | `home` | Home | Discover (this trade app's landing) |
| 2 | `folder-open` | Projects | Project state for active/completed projects |
| 3 | `plus` (FAB, orange, elevated) | — | Discover state + chat panel slides up with fresh thread |
| 4 | `message-circle` | Messages | Aftercare or Project chat threads (all conversations with this merchant) |
| 5 | `user` | Profile | Customer account (saved shortlists, warranty summaries, contact preferences) |

**Business-owner variant** (when a merchant uses their own app for admin):
- Home · Projects · Business · Messages · Profile (FAB replaced by "Business" icon)

**Visual spec (see Design Language §6.7):**
- 72px height + safe-area padding
- Rounded top corners `--radius-2xl`, floats above the canvas with `--shadow-md`
- Active item: icon + label in `--nex-accent-500` with 4px dot centred below label
- FAB: 56px orange circle protrudes ~16px above the bar

**Footer (below bottom nav on canvas surface only):** 3-line max footer strip with business name, contact icons (phone · email · WhatsApp), social icons, and a small "Powered by Nex" mark (mandatory, cannot be removed). This footer is NOT part of the chat surface — chat has its own tool tiles row instead.

---

## §2. The seven conversation states

Per Design Language §2, every NEX trade app is organised around seven states. Each state has:
- A **trigger** (what user intent activates it)
- A **canvas** (the UI that renders in the middle)
- An **AI role** (what Nex is doing during this state)
- A **success exit** (which state the user typically moves to next)

### 2.1 Discover — first-visit state

**Trigger:** cold visit (no session context), or explicit "start over" / "show me everything you do".

**Canvas:** the module stack below (§3). Order is trade-preset-driven (§5). This is the closest thing to a traditional homepage — but it's a conversation state, not a page.

**AI role:** greet, understand who the visitor is (homeowner · trade · returning · casual browser), offer quick-action chips to advance to a specific state.

**Success exit:** any of the six other states, based on visitor intent.

**Data required:** merchant profile (name, tagline, location, primary trade slug), hero photography, at least 3 featured projects, at least 3 products/services, at least 3 reviews.

**Loading state:** skeleton for each module in the current preset order.

**Empty state:** if merchant hasn't set up modules yet — Nex message: "This business is still being set up. I can tell you about [trade] in general, or take your details and pass them on."

### 2.2 Compare — decision-support state

**Trigger:** "which one is best for me", "difference between X and Y", "help me choose", explicit tap on a "Compare" chip.

**Canvas:**
- Comparison table (2-4 items side by side) — sticky left column of criteria, scrolling right columns of options
- OR product cards in a 2-up/3-up grid with a checkbox to add to shortlist
- OR before/after gallery with side-by-side comparison of two projects
- Sticky top: "Shortlist" strip with removable chips showing selected items

**AI role:** ask clarifying questions ("what's your priority — budget, longevity, or look?"), highlight distinctions ("oak resists dent better than pine; pine takes stain more evenly").

**Success exit:** Configure (user picks one) or back to Discover (nothing appeals).

**Data required:** structured product/service data with comparable attributes.

**Loading:** grid skeleton, sticky header solid.

**Empty:** "Nothing to compare yet. Tell me a bit about the project and I'll shortlist some options."

**Never in this state:** star ratings on options (implies verdict per never-judge-businesses rule), price ranges in £ (per no-£-rule).

### 2.3 Configure — specification state

**Trigger:** "I want X with Y and Z", "how would this look in oak", "make it 3m wide".

**Canvas:**
- Configurator UI on left/top: option groups (materials · dimensions · features · finish)
- Live-updating summary card on right/bottom: current spec + tier indicator
- Optional visual preview if Vision integration is wired (Phase 2)

**AI role:** interpret loose language into structured options ("something warm" → recommend oak, walnut), offer defaults when user hasn't specified, flag incompatible combinations.

**Success exit:** Price state.

**Data required:** trade-specific option schema (defined per Brain).

**Loading:** configurator skeleton on left, summary card skeleton right.

**Empty:** shouldn't happen — Configure state requires at least one selected product/service to enter.

**Regulatory checks in this state:** if merchant is a Staircase trade and user configures a rise >220mm private, Nex flags: "That rise breaches Approved Doc K limits for private stairs. Would you like me to suggest compliant options?" Similar per-trade compliance hooks.

### 2.4 Price — honest costing state

**Trigger:** "how much", "cost", "quote", "budget".

**Canvas:**
- Price-range card at top: tier indicator (Entry / Mid / Premium / Bespoke), percentage comparison, list of variables affecting price
- **NO £ figures displayed** (per Nex no-price rule)
- Below: quote-builder form if user wants a real quote (name · contact · address · project detail · preferred contact time)
- Right/bottom: "What affects the price" expandable list

**AI role:** explain tier concept, list the variables honestly, always end with the canonical disclaimer ("exact price depends on final design + [materials] + [features] + delivery + fit — confirm with the merchant"), transition to Book state if user wants a survey.

**Success exit:** Book state (survey/visit for real quote) or back to Configure (change spec).

**Data required:** trade-specific pricing tiers + variable list from Brain.

**Loading:** range card skeleton.

**Empty:** "Give me a spec first and I can talk you through the pricing tiers."

**Absolute prohibitions in this state:**
- No £ figures (per no-price rule)
- No "our lowest price is £X" language
- No comparison to other businesses on price
- No "trust me it'll be cheaper" — canonical disclaimer only

### 2.5 Book — convert-to-appointment state

**Trigger:** "book a survey", "come measure it up", "when can you visit", explicit tap on booking CTA.

**Canvas:**
- Calendar picker showing merchant availability (next 4 weeks)
- Slot cards for each date with time chips (morning · afternoon · evening if offered)
- Right/bottom: appointment summary card that builds as user selects
- Below: contact confirmation form (auto-filled if user provided details in Price state)

**AI role:** narrate the booking ("I've got you provisionally down for Thursday 14 August at 2pm"), confirm address and access requirements, set expectations ("[merchant] will call you the day before").

**Success exit:** Project state (booking confirmed).

**Data required:** merchant availability calendar (integrated), service area / travel time rules.

**Loading:** calendar skeleton (7-day column outlines).

**Empty:** "No visits available in the next 4 weeks. Want me to add you to the waiting list or check further ahead?"

**Confirmation UX:** the confirmation is a Nex chat message, not a green toast (per Design Language §6.12). Simultaneously creates the Project state timeline entry.

### 2.6 Project — active-job state

**Trigger:** returning user with active project, or "how's my job going".

**Canvas:**
- Timeline (vertical, milestones marked): Enquiry → Survey → Quote → Design → Order → Manufacture → Delivery → Install → Handover
- Current milestone highlighted
- Photo updates per milestone (merchant uploads)
- Message thread between customer and merchant, mediated by Nex

**AI role:** answer status questions ("where are we"), pass messages between customer and merchant, remind customer of pending decisions ("[merchant] needs your final material choice by Friday"), auto-summarise long threads.

**Success exit:** Aftercare state (project completes) or back to Configure (change order mid-project — with impact analysis).

**Data required:** project record with milestones, order-status feed from merchant admin.

**Loading:** timeline skeleton with milestone outlines.

**Empty:** "You don't have an active project with [merchant] right now. Want to start one?"

### 2.7 Aftercare — post-handover state

**Trigger:** completed project + user question, or "warranty", "maintenance", "it's making a noise".

**Canvas:**
- Warranty summary card (dates, coverage, next inspection due)
- Maintenance calendar (recommended actions — e.g. "check handrail fixings at 12 months")
- FAQ list specific to the installed product/service
- Message thread with merchant (same shell as Project state)

**AI role:** answer maintenance questions using Trade Brain content (e.g. "how often should I re-oil oak treads?"), diagnose defects using Defect module ("Squeaking staircase tread — most common cause is X"), flag when warranty covers the issue vs when it doesn't, book call-out visit if needed.

**Success exit:** Book state (call-out required) or back to itself.

**Data required:** project record with warranty terms, Trade Brain defect module, merchant call-out availability.

**Loading:** warranty card skeleton.

**Empty:** "No projects to look after yet. Once your first job with [merchant] is complete, I'll manage warranty and maintenance for you from here."

---

## §3. Discover state — the module set

The Discover state canvas is composed of the modules below. Every trade renders these modules; ORDER varies by trade preset (§5).

Modules render vertically on mobile, in a responsive grid on desktop when adjacent modules can share a row.

### 3.1 Hero

**Content:**
- Full-bleed hero photo (16:9 aspect, `object-cover` — the only place `object-cover` is permitted per Design Language §5)
- Overlay bottom-left: Business name (large `--text-3xl`), tagline (--text-lg), location
- Overlay bottom-right: **primary CTA** "Ask Nex about your project" — opens chat with prompt "What are you working on today?"

**Size:** Hero occupies 60% of first viewport on mobile, 50% on desktop.

**Data required:** merchant hero photo (1600×900 min), business name, tagline, location.

**Empty state:** if no hero photo, use `--nex-neutral-100` background with merchant logo centred + tagline.

**Motion:** Hero fades in on first load with `--motion-hero --ease-out-quad`.

### 3.2 Company branding strip

**Content:**
- Merchant logo (larger, 64px)
- Business name + tagline (repeated smaller for scroll context)
- Trust bar: years established · trade body memberships · service area radius · response-time promise ("replies within 4h")

**Size:** Full-width strip, 96px tall on mobile, 120px desktop.

**Data required:** all merchant profile fields.

**Trade adaptation:** For Electricians / Plumbers (Trust-sell cluster — §5), this strip is **immediately below hero**, above the AI panel. For Staircase / Kitchens (Visual-sell), it's below the AI panel to prioritise projects.

### 3.3 Nex AI Panel

The signature module. This is what makes NEX visibly different from every website builder.

**Content:**
- Prominent card, full-width, `--nex-neutral-100` background, `--radius-lg`
- Nex avatar (48px, larger than the chat panel avatar for prominence)
- Headline: `--text-2xl --font-semi` — "I'm Nex, I know [trade]. Ask me anything."
- Subhead: `--text-base --nex-neutral-500` — "Design ideas, prices, availability, warranty — I've got you."
- Prompt input: large chat input, placeholder "What are you working on?", primary "Ask" button
- Below input: 4 quick-action chips (see 3.4)

**Interaction:** typing or clicking a chip immediately opens the chat panel + advances the conversation. The AI Panel module remains visible on scroll but the chat panel is where the conversation happens.

**Data required:** trade slug (determines the copy: "I know staircases" / "I know electrics").

**No merchant customisation** of this module beyond the trade slug. Consistent Nex signature across every trade.

### 3.4 Quick AI Actions grid (6-10 tiles per canonical mockup)

Per Design Language v1.1 §6.4 and the canonical Staircase home mockup. Grid of tile-style quick actions immediately below the hero + Ask NEX bar. Not chips — **tiles**. Each tile: outlined icon on top, bold title below, one-line description below that.

**Tile grid layout:**
- Mobile: 5 columns × 2 rows (10 tiles) OR 4 columns × 2 rows (8 tiles) depending on trade config
- Grid card container: `--nex-cream-elev` background · `--radius-lg` · `--shadow-sm` · `--space-4` padding
- Per-tile: icon 24-28px, title `--text-sm --font-semi`, description `--text-xs --nex-neutral-500`

**Universal tile set (present in a Cluster A trade like Staircase):**
1. 3D Design — visualise in 3D (canvas variant, activates Configure or a visualiser once shipped)
2. Plan & Calculate — dimensions, rise, run (activates Configure or Calculator canvas)
3. Cost Estimator — get instant estimates (activates Price)
4. Materials — wood, metal, glass & more (activates Compare with materials filter)
5. Components — stringers, treads, balusters (activates Compare with components filter)
6. Building Codes — regulations & safety standards (activates Discover with regulations canvas)
7. Installation Guide — step-by-step instructions (activates Discover with installation canvas)
8. Inspiration — design ideas & styles (activates Discover with gallery canvas)
9. AI Assistant — ask anything about staircases (opens chat)
10. Suppliers — find trusted suppliers (activates Compare with suppliers filter)

**Trade-specific tile sets** vary by config. Cluster B trades (Electrician / Plumber) get:
- Emergency Call-Out, Boiler Service, Fault-Find Visit, Certifications, Regulations, Book Visit, Cost Estimator, AI Assistant

**Rule:** tile count 6-10 per trade (previously "max 6"). Grid layout adapts:
- 6 tiles: 3 × 2
- 8 tiles: 4 × 2
- 10 tiles: 5 × 2

If a trade needs more surfaces, they live in the chat surface's tool tile row (bottom), not in this grid.

**Data required:** trade config `quick_actions[]` array with 6-10 entries per Master Trade Template §6 schema.

### 3.5 Featured Projects

**Content:**
- Section title: "Recent projects" (--text-2xl --font-semi)
- Grid of Project Cards per Design Language §6.3
- Mobile 2-up, tablet 2-up, desktop 3-up
- 6-9 items typical; "See more" chip loads a Compare state variant

**Interaction:** tap card → transitions to Discover-gallery-canvas showing that project + related ones + a Nex intro.

**Data required:** minimum 3 projects with paired before/after photos, project location, project trade type.

**Empty state:** "This merchant hasn't uploaded projects yet. Want me to show you [trade] work in general?"

**Trade adaptation:** For Visual-sell trades, this is priority #1 module (right after AI Panel). For Trust-sell trades, it's after Reviews.

### 3.6 Products

**Content:**
- Section title: "Products" or "Services" (depends on trade — Kitchen has products, Plumber has services)
- Grid of Product Cards per Design Language §6.3
- Filters as chips at top: category, material, size range — chips launch Compare-state filters

**Interaction:** tap card → Compare state loaded with that item + suggested alternatives.

**Data required:** minimum 3 products/services per merchant.

**Empty state:** "This merchant hasn't listed products yet. Ask me about [trade] products in general and I'll help you shortlist."

**Trade adaptation:** hidden entirely for pure-service trades that don't sell products (e.g. some Painters, Plasterers).

### 3.7 Videos

**Content:**
- Section title: "See it in action"
- 2-3 Video Cards per Design Language §6.3
- Inline lightbox player on tap

**Data required:** minimum 1 video (YouTube / Vimeo / self-hosted).

**Empty state:** module hidden if no videos.

### 3.8 Before & After

**Content:**
- Section title: "Transformations"
- Paired 1:1 image swiper (draggable divider, or tap to toggle)
- 4-8 pairs typical

**Data required:** at least 2 paired projects with aligned photography.

**Empty state:** module hidden if no paired photos.

**Trade adaptation:** #1 for Painter, Plasterer, Renovation-focused trades. Lower priority for Electrician, Plumber.

### 3.9 Reviews

**Content:**
- Section title: "What clients say" (never "Testimonials" — too corporate)
- Review Cards per Design Language §6.3
- 3-6 cards; "Read more" chip loads a Compare state with all reviews (never a separate page)

**Data required:** minimum 3 reviews from verified sources (Google · Trustpilot · in-platform).

**Empty state:** "This merchant is newer to the platform — no reviews yet."

**Trade adaptation:** #1 module for Trust-sell trades (Electrician, Plumber, Roofer).

### 3.10 Social Links

**Content:**
- Small row of social icons — Instagram, Facebook, YouTube, TikTok, LinkedIn
- Latest Instagram / TikTok grid embed if available (Phase 2)

**Data required:** at least one social URL.

**Empty state:** module hidden.

### 3.11 Contact

**Content:**
- Contact channel buttons: Phone (call), Email (compose), WhatsApp (open), Contact form (opens Nex chat with structured intake)
- Business address + map thumbnail
- Response-time promise ("Replies within 4h")

**Data required:** phone, email, service area.

**Interaction:** all contact CTAs also work — but the primary suggestion is always "Ask Nex first — she'll pass to the team if needed." Direct contact remains available for people who prefer it.

---

## §4. Trade archetype clusters + module priority presets

Four archetype clusters cover every trade. Each cluster defines a default Discover module order. Merchants pick their preset at signup; each preset comes from the Brain-driven trade config.

### 4.1 Cluster A — Visual sell

**Trades:** Staircase makers · Kitchen companies · Joinery · Interior finishers · Landscaping design · Metal fabrication (bespoke)

**Customer buys with their eyes.** Prioritise projects + products + before-after.

**Discover module order:**
1. Hero
2. Nex AI Panel
3. Quick AI Actions
4. Featured Projects
5. Products
6. Before & After
7. Videos
8. Reviews
9. Company branding strip
10. Social Links
11. Contact

### 4.2 Cluster B — Trust sell

**Trades:** Electrician · Plumber · Roofer · Builder (general) · Gas Safe engineer · Heating engineer

**Customer buys on trust and response time.** Prioritise credentials + reviews + contact.

**Discover module order:**
1. Hero
2. Company branding strip (with accreditations + response promise front and centre)
3. Nex AI Panel
4. Quick AI Actions (includes "Emergency call-out")
5. Reviews
6. Featured Projects
7. Videos
8. Before & After
9. Social Links
10. Contact

Products module hidden (these trades typically don't sell products directly).

### 4.3 Cluster C — Transformation sell

**Trades:** Painter · Plasterer · Bricklayer · Renovation specialist · Cleaner (commercial)

**Customer needs to see the difference the trade makes.** Prioritise before-after prominently.

**Discover module order:**
1. Hero
2. Nex AI Panel
3. Quick AI Actions
4. Before & After (large, first-in-scroll)
5. Featured Projects
6. Reviews
7. Videos
8. Products (materials, finishes offered)
9. Company branding strip
10. Social Links
11. Contact

### 4.4 Cluster D — Volume commerce

**Trades:** Metal fabricators (stock lines) · Some joinery (stock stair parts) · Trade merchants adding a customer-facing app · Kitchen showroom brands

**Customer buys products at volume.** Prioritise products + configurator.

**Discover module order:**
1. Hero
2. Nex AI Panel
3. Quick AI Actions (includes "Bulk pricing" and "Trade account")
4. Products
5. Featured Projects (installations)
6. Reviews
7. Videos
8. Company branding strip
9. Contact
10. Social Links

Before & After hidden (not the buying trigger for this cluster).

### 4.5 Cluster override rules

- Merchant picks their cluster preset at signup based on trade slug + business type
- Can move themselves to a different preset via settings if their focus is unusual (e.g. a plumber who also sells own-brand tap products — moves to Cluster A)
- Cannot reorder modules within a preset (that would break the design consistency guarantee)
- Cannot mix modules from different presets (all-or-nothing preset selection)

---

## §5. Module → AI conversation mapping

Every interactive element on the Discover canvas launches a specific conversation state. This is the full map — no button leads to a page; every button leads to a state.

| Module element | Launches state | Initial Nex prompt |
|---|---|---|
| Hero → "Ask Nex about your project" CTA | Discover chat active | "What are you working on today?" |
| AI Panel input / Ask button | Whatever state matches the user's typed intent | (Nex classifies intent from message) |
| Quick chip "Design Ideas" | Discover → gallery canvas | "Here are some [trade] designs to get you thinking. Anything catching your eye?" |
| Quick chip "Products / Range" | Compare (all products loaded) | "Which of these interests you most? I can compare any two side by side." |
| Quick chip "Book Visit" | Book | "Happy to book you in — where would you like [merchant] to come?" |
| Quick chip "Cost / Pricing" | Price | "Pricing depends on a few things — let me walk you through how it works for [trade]." |
| Trade-specific chip (e.g. "Configure a stair") | Configure (with default template loaded) | "Let's design your [product] — I'll ask a few questions and shape it as we go." |
| Featured Project card tap | Discover → project-detail gallery canvas | "That's a [style] we did in [location] — want me to show you similar ones?" |
| Product card tap | Compare (this product + 2 auto-suggested alternatives) | "This is one of [merchant]'s [category]. I've picked two similar options to compare — want to shortlist any?" |
| Before/after card tap | Discover → before-after gallery canvas | "Here's the story of that transformation — the client wanted [X], we did [Y]." (only if merchant provided the story) |
| Video card tap | Discover with inline lightbox | (no new prompt — video plays, chat quiet) |
| Review card tap | Discover with review expanded | (no new prompt) |
| Contact "Send message" | Discover chat active | "What would you like me to pass to [merchant]?" |
| Contact "Call" | Native tel: link | (no chat interaction — direct phone) |
| Contact "WhatsApp" | Opens WhatsApp with pre-filled intro | (no chat interaction) |

**Design invariant:** the chat panel is always available. If a user opens WhatsApp externally then returns, the chat panel is still where they left it.

---

## §6. Configuration schema

Each trade's Brain feeds this template a JSON config. The config is authored per-Brain by the Trade Brain Author.

```jsonc
{
  "trade_slug": "staircase",
  "cluster": "visual_sell",                    // A / B / C / D
  "module_order_override": null,                // optional, forces a specific order (rare)

  "hero_prompt": "What are you working on today?",

  "ai_panel": {
    "headline": "I'm Nex. I know staircases.",
    "subhead": "Design ideas, timber choice, regs, prices — I've got you."
  },

  "quick_actions": [
    { "label": "Design Ideas",    "state": "discover", "canvas": "gallery" },
    { "label": "Products",        "state": "compare", "filter": null },
    { "label": "Book Visit",      "state": "book" },
    { "label": "Cost & Pricing",  "state": "price" },
    { "label": "Configure a stair", "state": "configure", "template": "straight_flight" },
    { "label": "Check building regs", "state": "discover", "canvas": "regulations" }
  ],

  "featured_projects_title": "Recent staircases",
  "products_title": "Range",                    // or "Services"
  "reviews_title": "What clients say",

  "regulatory_hooks": {
    "configure_alerts": [
      { "field": "rise_mm", "operator": ">", "value": 220, "message": "That breaches Approved Doc K private-stair rise limit." }
    ]
  },

  "compliance_module_slug": "regulations",      // which Brain module to reference for Compliance answers
  "defect_module_slug": "defects",
  "materials_module_slug": "materials",
  "workflow_module_slug": "workflow"
}
```

The config is READ ONLY at runtime — merchants cannot edit it. Only the Trade Brain Author changes trade config (via a future admin surface). This enforces the "every button = intent → state" architecture consistently.

---

## §7. Responsive behaviour — full breakdown

### Mobile <640px

- Chat panel: bottom-drawer, 88px handle when closed, full-height overlay when open
- Nav: 56px, minimal
- Canvas: single-column, all modules stack
- Every card: 2-up grid (product, project cards)
- Hero: 60% of viewport height
- Tap targets: 44px minimum

### Tablet 640-1023px

- Chat panel: bottom-drawer, taller than mobile (60% of viewport when open)
- Nav: 64px
- Canvas: 2-up grid for products/projects, before/after stays paired
- Modules that can share a row on desktop share on tablet if width allows

### Desktop ≥1024px

- Chat panel: docked right, 440px wide, always visible
- Nav: 64px
- Canvas: `calc(100vw - 440px - 64px)` wide, 12-column grid
- 3-up grid for products/projects
- Two modules can share a horizontal row when both are shorter than 400px tall
- Hero: 50% of viewport height

### Ultra-wide ≥1536px

- Canvas max-width caps at 1440px + centred with `--nex-neutral-50` gutters
- Chat panel remains 440px docked-right — does not stretch further

---

## §8. Data requirements per module (merchant onboarding)

Onboarding surfaces show progressive completion. Merchant sees "Discover state 60% complete — add 2 more projects to hit 80%".

| Module | Minimum data | Recommended | Enables |
|---|---|---|---|
| Hero | Business name, hero photo | Tagline, location | Every state |
| Company branding | Logo, address, phone | Established year, accreditations, service radius | Trust displays |
| Nex AI Panel | Trade slug (auto) | — | Always renders |
| Quick AI Actions | Trade slug (auto) | — | Always renders |
| Featured Projects | 3 projects with photo, title, location, trade | 9+ projects, paired before/after | Compare, Discover-gallery |
| Products | 3 products with photo, title, category | 12+ products with materials/options | Compare, Configure |
| Videos | — | 2+ videos | Video module |
| Before & After | — | 4+ paired photos | Before-after module |
| Reviews | 3 verified reviews | 20+ reviews across sources | Reviews module, Trust displays |
| Social Links | 1 social URL | All social channels | Social module |
| Contact | Phone or email | Address + WhatsApp + service area | Book, Contact module |

**Minimum viable trade app:** requires all "minimum" fields per applicable modules for the chosen cluster.

**Health score display** (merchant admin): "Your app is 72% ready. Adding [X] would move you to 85%. Nex has data-gap alerts if a customer asks about something you haven't set up."

---

## §9. States that AREN'T pages — explicit anti-patterns

To reinforce the state model, here is what NEX **does not have**:

- ❌ A "Products" page URL — Products is a Compare state
- ❌ A "Gallery" page URL — Gallery is a Discover-canvas variant
- ❌ A "Contact" page URL — Contact channels are inline in the shell footer + a state prompt
- ❌ A "Reviews" page URL — Reviews render in Discover module + expandable Compare-state variant
- ❌ A "Services" page URL — Services are Products (renamed for services trades)
- ❌ An "About Us" page URL — Company Branding is a module, not a page. Extended About-Us Nex prompts answer "who are you" in chat.
- ❌ A "Blog" section — content lives in Trade Brain, surfaced by conversation, not by scrolling a blog
- ❌ A "Sitemap" — there are no sites to map
- ❌ A "Search" bar — replaced by the chat input

**If a customer arrives via an external deep-link** (e.g. shared URL) the app resolves the URL to a state + canvas configuration. Sharing a specific product still works via `state:compare?items=slug-1,slug-2` — but the shared experience is a conversation state, not a page.

---

## §10. Performance budget

Master template performance targets. Enforced via Lighthouse CI on every merge.

| Metric | Mobile budget | Desktop budget |
|---|---|---|
| Largest Contentful Paint | ≤2.0s | ≤1.5s |
| First Input Delay | ≤100ms | ≤50ms |
| Cumulative Layout Shift | ≤0.05 | ≤0.05 |
| Time to Interactive | ≤3.0s | ≤2.0s |
| Total JS payload | ≤300KB gzipped initial | ≤400KB gzipped initial |
| Total image payload above fold | ≤400KB | ≤600KB |

**Chat panel initial paint budget:** ≤500ms after LCP. The panel must be ready to accept input as soon as the user has read the hero.

**AI response latency budgets:**
- First token from Nex: ≤600ms
- Full short response: ≤2.5s
- Rich UI card summon: ≤1.5s to skeleton, ≤4s to filled

---

## §11. State transition specification

Every state transition follows this pattern:

1. **Trigger fires** (user clicks chip, sends message, taps card)
2. **AI classifies intent** → determines destination state
3. **Nex speaks the transition** in the chat: "I'll show you the compare view" (except on obvious state entries — no need to narrate a hero-CTA tap)
4. **Canvas fades out** (`--motion-medium --ease-in-quad`)
5. **New canvas fades in** (`--motion-slow --ease-nex-signature`) — total transition time ≤650ms
6. **Chat panel does not animate** — it's the persistent shell
7. **URL updates** to reflect the new state (via replaceState, not pushState — the state is the app's memory, not the browser's)

**Never** flash-of-empty-canvas during transition. Skeleton the new canvas immediately.

**Never** hijack the browser back button. Back button returns to the previous state (via popstate handler that reads `state:` URL).

---

## §12. Merchant customisation — the hard limits

Per Design Language §10. The Master Trade Template enforces:

**Merchant configures via UI (admin):**
- Business identity: name, tagline, logo, hero photo, location, contact channels
- Brand primary colour (1 hex)
- Cluster preset selection (A/B/C/D)
- Contact channel toggles (phone, WhatsApp, form)
- Trade-specific chip labels (small overrides only — cannot add or remove chips)
- Availability calendar (for Book state)

**Merchant cannot change:**
- Module order (only cluster preset switches)
- Design tokens (typography, spacing, radii, shadows)
- Chat panel appearance
- Nex avatar / voice / responses
- State model
- Any semantic feedback colours
- The "Powered by Nex" footer signature (mandatory on every tier)

**Merchant asks for something not on the "can configure" list:** the answer is no. Refer them to the platform integrity principle.

---

## §13. Trade launch checklist

Before a trade template goes live for a merchant, all of the following must be true:

- [ ] Trade slug exists in the Brain registry
- [ ] Trade Brain has minimum V1 modules present (craft · regulations · materials · defects at minimum)
- [ ] Cluster preset chosen and defensible (matches actual trade buying pattern)
- [ ] Trade config JSON (§6 schema) authored and validated
- [ ] Quick actions defined (min 4, max 6)
- [ ] Regulatory hooks configured if trade has compliance-sensitive configuration (staircases, electrics, gas)
- [ ] Merchant profile 60%+ complete per §8
- [ ] All chat state prompts reviewed against Nex voice canon
- [ ] Mobile Lighthouse LCP ≤2.0s on representative merchant data
- [ ] AI response latency budget met per §10
- [ ] Accessibility check passed (axe-core clean, keyboard navigable end-to-end)
- [ ] Merchant sees onboarding walkthrough of the state model ("here's how customers experience your app")

Only when every box is ticked does the merchant's app go public under their thenetworkers.app subdomain.

---

## §14. Governance + change control

Same as Design Language §12. Structural changes to this template require CEO + Design Lead + CTO + a representative Trade Brain Author (rotating).

**When to update this template vs create a Phase-27 doc:**
- Additions to existing states (new module, new chip type) → update this template
- New conversation state (an 8th state beyond the 7) → new Phase 27 doc + this template revised to `v2.0`
- New cluster (5th trade archetype) → update this template if the cluster is a variation; new doc if it's a fundamentally different buying pattern

---

## §15. Deliberate absences

Things people will ask for that we explicitly do NOT add:

- **A "book demo" pop-up** — undermines the conversation-first philosophy
- **A newsletter signup modal** — replaced by "Ask me to keep you posted" in chat
- **A cookie banner** — required legally, but as a bottom-of-screen chip, never a modal blocking the chat
- **A live-chat widget from a third-party** — Nex IS the chat, no competing widget
- **Testimonial carousels that auto-rotate** — motion for its own sake, undermines chat's motion signature
- **A pricing table with £ figures** — direct violation of the no-price rule
- **A "meet the team" grid of stock photos** — feels corporate, breaks workshop-warm tone
- **A "trusted by" logo strip of famous clients** — feels salesy, breaks adviser-not-reviewer tone

If a merchant asks for any of the above, the answer is no + explanation.

---

---

## §16. Change log

**v1.1 · 2026-07-24** (same-day refinement after first design review with canonical mockups)
- Rewrote §1.2 chat panel spec: chat is now a full-width slide-up surface (not a docked side panel), matching the Staircase chat mockup. Preserves "persistent in capability" — one tap from anywhere — but no longer "persistent in visibility."
- Rewrote §1.3: replaced minimal footer with permanent 5-item bottom nav (Home · Projects · [+ FAB] · Messages · Profile) representing OS destinations. Small footer strip retained below the bottom nav on canvas surface only.
- Rewrote §3.4 Quick AI Actions: from "max 6 chips" to "6-10 tile grid" per canonical mockup. Tiles have icon + title + description; 5×2 layout at 10 tiles, 4×2 at 8, 3×2 at 6.
- Trade config schema in §6 remains compatible; `quick_actions[]` array simply carries 6-10 entries instead of 4-6.

**v1.0 · 2026-07-24** — initial issue.

---

**End of Master Trade Template V1.1.**
Consumes: [NEX_DESIGN_LANGUAGE_v1.md](./NEX_DESIGN_LANGUAGE_v1.md) v1.1
Canonical visual references: `tmp/staircase-homepage-mockup.png` · `tmp/staircase-chat-mockup.png`
Next revision: after 3 trade Brains ship and we have real merchant + customer usage data (target: Q1 2027).
