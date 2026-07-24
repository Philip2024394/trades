# NEX Design Language V1

**Status:** authoritative · v1.1 · 2026-07-24 (refined after first design review — see §0.1)
**Owners:** CEO (Philip O'Farrell) + Design Lead (TBD) + CTO (TBD)
**Scope:** every visual and interaction decision across every NEX application, present and future
**Companion:** [MASTER_TRADE_TEMPLATE_v1.md](./MASTER_TRADE_TEMPLATE_v1.md) — the implementation guide that consumes this language

---

## §0. Purpose

This document is the rulebook. Every button, colour, motion, and interaction across every NEX-powered trade application inherits from it. It replaces ad-hoc design decisions with a shared vocabulary so 100+ trade apps can ship without re-designing the platform each time.

If a design decision is not specified here, **do not invent it in the app** — add it to this document first, then implement.

## §0.1 Scope: interaction architecture, not visual language

Refined 2026-07-24 after the first design review against real mockups:

- **This document defines interaction architecture:** the conversation-state machine, AI orchestration, trade inheritance, interaction rules, component behaviour, accessibility, tokens.
- **Visual language (colours, typography, imagery, cards, spacing feel) is defined by the canonical mockups** — currently the Staircase home page and Staircase chat page mockups (see §0.2). This document uses those mockups as source when specifying colour, typography, and layout tokens. When the mockups evolve, this document evolves with them.
- **Do not merge the two.** A mockup describes an experience; this document describes the OS that produces every future experience for every future trade.

## §0.2 Canonical visual references (v1.1)

- **Staircase home** — `tmp/staircase-homepage-mockup.png` (received 2026-07-24). Defines the accent orange, cream background, card style, quick-actions grid, popular styles row, tools row, project gallery, and bottom-nav pattern for the Discover state.
- **Staircase chat** — `tmp/staircase-chat-mockup.png` (received 2026-07-24). Defines the chat-page structure: business-identity banner, chat bubbles, inline product cards, quick-reply chip strip, Ask NEX input, bottom-tool-tile row.

Every trade app inherits the same interaction architecture (this doc) and the same visual language (mockups). Content changes; frame does not.

## §1. Governing philosophy

NEX is not a website builder. It is an AI Business Operating System. The design language expresses this in nine non-negotiables.

1. **Conversation is the primary way people accomplish tasks. Visual components appear when they make the task faster or clearer.** This is the master principle. Chat is the default entry to any intent; UI (galleries, product grids, calendars, quote summaries) is summoned when UI genuinely wins the task. Neither is a religion.
2. **Chat is persistent in capability, not in visibility.** The customer must be able to reach Nex from anywhere in the app in one tap. Nex does not need to occupy the screen at all times — an always-open chat panel is intimidating on first visit. Instead: the Ask NEX bar is present on the home surface; taps on quick actions, tool tiles, or the Ask bar slide the chat up into view.
3. **State beats page.** The system is organised around seven internal conversation states (Discover · Compare · Configure · Price · Book · Project · Aftercare). The customer never sees these labels — they feel the conversation changing naturally. Internally, every screen resolves to a state + canvas.
4. **Every button is intent, not a link to a page.** Buttons declare intent to the conversation ("show me styles", "book a visit", "calculate cost"). Whether the response renders as a chat message, an inline card, a canvas swap, or a slide-up chat is a rendering decision — the intent stays canonical.
5. **Bottom navigation is allowed when it represents operating-system destinations, not website pages.** Home, Projects, Messages, Business, Profile are OS areas — always-available surfaces the customer might jump between. That is a different pattern from a page-based navigation menu ("About · Services · Pricing · Blog · Contact") which is banned.
6. **One frame for every trade.** Nav shell, Ask NEX bar, chat panel, bottom nav are identical across every trade app. Content and module priority adapt.
7. **Brand is disciplined.** Merchants set primary colour, logo, hero photography, cluster preset. Everything structural (typography, spacing, component shapes, chat panel, motion, Nex accent orange, semantic colours) is Nex-controlled. This preserves the "you always know it's Nex" signature.
8. **Mobile-first, thumb-native.** Every layout is designed for thumb reach on a 360-430px viewport, then scaled up.
9. **Accessibility is baseline, not extra.** WCAG AA at minimum on every component. Keyboard-navigable end to end. Motion-reduced respected.
10. **The AI is honest.** Nex has a specific voice canon (workshop-warm, UK English, no marketing language, adviser-not-reviewer). Every microcopy decision defers to it.

---

## §2. The conversation-state model

The single most important architectural decision: **NEX apps have seven conversation states, not seven pages.**

### The seven states

| State | Purpose | User intent expressed as | Canvas UI examples |
|-------|---------|--------------------------|--------------------|
| **Discover** | Show what the business does. First-visit landing. | "What do you do?" / arriving cold | Hero + featured projects + trust strip + starter chat prompts |
| **Compare** | Help the user pick between options. | "Which one is right for me?" / "difference between X and Y" | Comparison table, product cards side-by-side, before/after gallery, "shortlist" chip strip |
| **Configure** | Turn a chosen option into a specific specification. | "I want X with Y and Z" | Configurator UI (options, materials, sizing), live-updating summary card |
| **Price** | Answer "what will it cost?" honestly. | "How much?" / "quote please" | Price-range card (percentages, tiers, "exact price depends on…" per no-£-rules), quote-builder form |
| **Book** | Convert intent into a real appointment or reservation. | "Come measure it up" / "book a survey" | Calendar picker, availability grid, appointment summary card, address form |
| **Project** | Manage a live project from win to handover. | "Where are we with my job?" | Timeline, milestone cards, photo updates, message thread |
| **Aftercare** | Support after handover — warranty, maintenance, upsell. | "It's making a noise" / "warranty question" | Warranty card, maintenance calendar, FAQ, message thread |

### State properties

- **The conversation persists across all states.** The user's history is the same thread — states don't reset it.
- **State transitions are declared by the AI**, either explicitly ("I'll show you the compare view") or implicitly (user asks "what's it cost" → Price state activates).
- **The canvas UI changes; the chat does not.** The chat panel is the persistent shell. The canvas area updates to show the state's UI. If the user asks a question in the middle of a Configure state, the AI answers in the chat without abandoning the canvas.
- **States are addressable but not URL-primary.** Deep links (e.g. for sharing) can target `state:compare?items=oak-cut-string,pine-closed-string`, but the primary interaction model is conversational, not URL-driven.
- **There is no "back button" mental model.** Users say "actually, show me kitchens instead" and the conversation transitions state. Browser back is honoured but the AI is the primary navigator.

### The canvas + chat pattern (v1.1 — persistent in capability, not in visibility)

Chat is instantly reachable but does not occupy the screen on first visit. Two surfaces:

**A. Canvas surface (default landing).** The Discover state canvas (or whichever state the customer is in). Shows content — hero, quick actions, product cards, etc. The Ask NEX bar is prominent under the hero. The chat panel is CLOSED but always one tap away via: (a) typing in the Ask NEX bar · (b) tapping any quick action / chip · (c) tapping the + FAB in the bottom nav · (d) tapping a product/project card that engages Nex.

**B. Chat surface.** Full-width conversation with Nex. Rich inline UI cards (product carousels, calendars, quote summaries) render inside the chat message stream. Ask NEX bar docked bottom. Bottom nav still present. Back arrow in top nav returns to the canvas surface.

**Transition motion:** chat panel slides up from the bottom (`--motion-medium --ease-nex-signature`), overlaying the canvas. Backdrop dims to 40% opacity. Reversible by tapping the back arrow, swiping down, or tapping the backdrop.

```
CANVAS SURFACE (default)              CHAT SURFACE (after engagement)
┌───────────────────────────┐          ┌───────────────────────────┐
│ NAV (wordmark + bell)     │          │ NAV (back + Nex info)     │
├───────────────────────────┤          ├───────────────────────────┤
│ HERO                      │          │ MERCHANT IDENTITY BANNER  │
│ Ask NEX bar               │          │                           │
│ Quick actions grid        │  slides  │ Chat message stream       │
│ Popular styles            │  ────►   │ (bubbles + inline cards)  │
│ Tools                     │   up     │                           │
│ Project gallery           │          │ Quick-reply chips         │
│                           │          │ Ask NEX input (bottom)    │
├───────────────────────────┤          ├───────────────────────────┤
│ BOTTOM NAV (5 items)      │          │ TOOL TILES ROW (6 items)  │
└───────────────────────────┘          │ (Gallery · Calc · etc)    │
                                       └───────────────────────────┘
```

**Rule:** the chat surface preserves the message history across the entire session. Backing out to canvas and re-entering does not reset — the conversation persists.

**Rule:** state transitions can happen without opening the chat surface. Tapping a "Popular Style" card may transition internally from Discover → Compare (state changes) while still rendering as a canvas surface with the comparison grid. Chat opens only when Nex has something to SAY, or when the user initiates typing.

---

## §3. Design tokens

All values below are **the source of truth**. Implement as CSS variables + a shared token JSON published as `@nex/design-tokens`.

### 3.1 Colours — structural palette

Neutral scale (used for text, backgrounds, borders — 90% of surfaces):

```
--nex-neutral-0     #FFFFFF   pure white — surfaces
--nex-neutral-50    #FAFAF9   canvas background
--nex-neutral-100   #F4F4F2   card background elevated
--nex-neutral-200   #E8E8E4   subtle borders, dividers
--nex-neutral-300   #D4D4CE   input borders, disabled outlines
--nex-neutral-400   #A3A39C   placeholder text, disabled text
--nex-neutral-500   #6E6E67   secondary text, icons
--nex-neutral-700   #3D3D38   primary text
--nex-neutral-900   #1A1A17   headings, high-emphasis text
```

Semantic colours (states, alerts, feedback):

```
--nex-success-500   #10B981   "in stock", success feedback (RESERVED — do not use for CTAs)
--nex-success-700   #047857   success text
--nex-warning-500   #F59E0B   caution, unsaved changes
--nex-warning-700   #B45309   warning text
--nex-error-500     #EF4444   error state, destructive action
--nex-error-700     #B91C1C   error text
--nex-info-500      #3B82F6   info, tips, tooltips
--nex-info-700      #1D4ED8   info text
```

Nex primary accent + primary CTA (unified in v1.1 per Staircase mockup — Nex is warm orange throughout):

```
--nex-accent-500    #F97316   orange — Nex signature + primary CTAs (Book, Get Quote, Send, chat send button, all conversion actions)
--nex-accent-600    #EA580C   accent hover
--nex-accent-700    #C2410C   accent active
--nex-accent-100    #FED7AA   accent subtle — active-chip background, quiet highlights
--nex-accent-50     #FFF7ED   accent whisper — user-bubble background, accent chip background
```

Cream surface + background (per Staircase mockup):

```
--nex-cream         #FBF6EC   app background — warm off-white
--nex-cream-elev    #FEFCF6   elevated card background — half-step lighter cream
```

Note on the v1.0 → v1.1 change: v1.0 spec used yellow accent + green CTA. v1.1 unifies these to orange throughout, matching the canonical mockups. Semantic colours (success #10B981, warning #F59E0B, error #EF4444) unchanged.

**Reserved constraint:** `#10B981` is the in-stock green — never repurpose it for CTAs. Orange (#F97316) is the CTA — never repurpose it for status.

### 3.2 Colours — merchant brand tokens

Merchant configures ONE primary brand colour. The system auto-derives:

```
--brand-primary            <merchant hex>
--brand-primary-hover      shift lightness -8%
--brand-primary-active     shift lightness -14%
--brand-primary-subtle     mix(--brand-primary, --nex-neutral-0, 92%)   for tinted backgrounds
--brand-primary-on         auto white or black based on contrast against --brand-primary (WCAG AA)
```

**Where merchant brand appears:**
- Logo mark position (nav left)
- Hero background tint (5% opacity overlay)
- Chip highlights in the "your saved shortlist" strip
- Brand-anchored badges ("Since 1987", accreditation strips)

**Where merchant brand does NOT appear:**
- Chat panel background (always neutral-0)
- Nex avatar / accent surfaces (always Nex accent)
- CTAs for booking/quote/purchase (always Nex CTA green — protects conversion consistency)
- Semantic feedback (success/error/warning — always Nex semantic palette)

### 3.3 Typography

Font stack (system + Inter for headings and body):

```
--font-sans:  Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
--font-mono:  ui-monospace, "SF Mono", Menlo, monospace
```

Scale — 1.25 major-third modular scale from 14px base:

```
--text-xs     12px   line-height 16px   captions, badges
--text-sm     14px   line-height 20px   body-secondary, chip text
--text-base   16px   line-height 24px   body, chat messages
--text-lg     18px   line-height 28px   emphasized body, small headings
--text-xl     22px   line-height 30px   section titles
--text-2xl    28px   line-height 36px   page titles
--text-3xl    36px   line-height 44px   hero headings
--text-4xl    48px   line-height 56px   hero display
```

Weights — restricted:

```
--font-normal   400   body, chat
--font-medium   500   emphasis, small headings
--font-semi     600   card titles, section titles
--font-bold     700   hero, primary buttons
```

**Never** use font-weight 300 (too thin for construction-industry legibility outdoors), font-weight 800/900 (too aggressive for adviser-not-reviewer tone).

### 3.4 Spacing scale — 4px base

```
--space-0    0
--space-1    4px
--space-2    8px
--space-3    12px
--space-4    16px
--space-5    20px
--space-6    24px
--space-8    32px
--space-10   40px
--space-12   48px
--space-16   64px
--space-20   80px
--space-24   96px
--space-32   128px
```

**Section rhythm** (vertical spacing between page sections): `--space-12` mobile, `--space-16` desktop.
**Card interior**: `--space-4` mobile, `--space-6` desktop.
**Grid gutter**: `--space-4` mobile, `--space-6` desktop.

### 3.5 Corner radius

```
--radius-none    0
--radius-sm      6px    inputs, chips, small badges
--radius-md      10px   buttons, small cards
--radius-lg      16px   cards, panels, modals
--radius-xl      24px   hero cards, chat bubbles (user side)
--radius-2xl     32px   large surfaces, drawer corners
--radius-pill    9999px pills, avatars, floating action buttons
```

Chat bubble corner rule: user messages use `--radius-xl` with the tail corner (bottom-right on user, bottom-left on AI) reduced to `--radius-sm` for direction cue.

### 3.6 Elevation / shadows

Four-level system. Every elevated surface uses one of these exactly.

```
--shadow-none    none
--shadow-sm      0 1px 2px 0 rgba(15, 17, 21, 0.06)                                cards, chips at rest
--shadow-md      0 4px 12px -2px rgba(15, 17, 21, 0.08), 0 2px 4px -1px rgba(15, 17, 21, 0.04)   floating cards, hover state
--shadow-lg      0 12px 24px -6px rgba(15, 17, 21, 0.12), 0 4px 8px -2px rgba(15, 17, 21, 0.06)  chat panel, drawers, modals
--shadow-xl      0 24px 48px -12px rgba(15, 17, 21, 0.18), 0 8px 16px -4px rgba(15, 17, 21, 0.08) hero photography, primary modals
```

Never mix shadows or invent variants. If nothing fits, use `--shadow-md`.

### 3.7 Motion tokens

Durations:

```
--motion-instant   0ms
--motion-fast      150ms   button press, hover, chip toggle
--motion-medium    250ms   card enter, panel open, state transition
--motion-slow      400ms   canvas swap between conversation states
--motion-hero      600ms   first-load hero reveal, big transitions
```

Easings:

```
--ease-out-quad         cubic-bezier(0.5, 1, 0.89, 1)          entering elements
--ease-in-quad          cubic-bezier(0.11, 0, 0.5, 0)          exiting elements
--ease-in-out           cubic-bezier(0.65, 0, 0.35, 1)         two-way transitions
--ease-nex-signature    cubic-bezier(0.16, 1, 0.3, 1)          Nex canvas swap, AI-thinking reveal
```

**Motion rule:** any state transition uses `--motion-slow --ease-nex-signature`. This is the Nex signature motion — reserved for state changes, not micro-interactions.

Motion-reduced media query respected everywhere: `@media (prefers-reduced-motion: reduce)` collapses all durations to `--motion-instant`.

### 3.8 Breakpoints

```
--bp-sm       640px    small tablets, large phones landscape
--bp-md       768px    tablets
--bp-lg       1024px   small laptops
--bp-xl       1280px   desktops
--bp-2xl      1536px   large desktops
```

Design primary: 375px (iPhone) → 430px (Pro Max) → 768px (iPad) → 1280px (laptop). Above 1440px, content max-width caps at 1440px + gutters (canvas + chat panel).

### 3.9 Grid

Canvas grid — 4-column mobile, 8-column tablet, 12-column desktop:

```
Mobile <640px:   4 col, gutter 16px, margin 16px
Tablet 640-1023: 8 col, gutter 20px, margin 24px
Desktop ≥1024px: 12 col with chat panel (chat = 400-480px), gutter 24px, margin 32px
```

Product cards + gallery cards use these column-span defaults:

```
Mobile:   2 col (2-up)
Tablet:   4 col (2-up)
Desktop:  4 col (3-up)
```

---

## §4. Iconography

- **Library:** Lucide React (permissive licence, wide component coverage, consistent stroke)
- **Stroke width:** 1.75px canonical (Lucide default 2px is too heavy; 1.5px reads thin on outdoor screens)
- **Sizes:** 16px (inline), 20px (buttons), 24px (nav), 32px (hero decoration)
- **Colour:** icons inherit text colour by default; brand-coloured icons only inside brand-anchored components

**Banned:**
- **Sparkles / star-with-motion-lines** — do not use as an "AI" indicator (per Trades CLAUDE.md — "No AI-star / Sparkles icons"). Star icons are fine only in review chips (they mean rating).
- **Emoji-as-icon** in production UI. Emoji are content, not UI.
- **Two overlapping icon libraries** in the same app.

---

## §5. Illustration + photography

### Illustration

Nex has NO in-house illustration style at V1. Illustration is deliberately avoided in production surfaces because it dates, adds file weight, and doesn't fit the workshop-warm tone. Empty states use text + a subtle Lucide icon at 40% opacity, not a spot illustration.

### Photography

- **All photography is real construction/trade work** — no stock photos of pristine studios, no AI-generated hero images, no models pretending to be tradespeople.
- **`object-contain` for every merchant / product / service / machine image.** Never crop the subject. Full-bleed heroes with gradients are the only permitted `object-cover` use (per Trades CLAUDE.md rule).
- **Hero images** — 16:9 aspect, minimum 1600×900, JPEG 80% quality or AVIF. Merchants upload their own.
- **Product images** — square 1:1, minimum 800×800, transparent PNG preferred for parts, JPEG for finished work.
- **Before/after** — always paired 1:1, same angle, same lighting. Nex UI enforces alignment via the paired uploader.

---

## §6. Component library

Every component below is atomic + composable. Components in `@nex/ui` npm package (to be built).

### 6.1 Buttons

Three tiers. That is it.

**Primary CTA** — the button that starts an AI conversation or converts:

```
Background:  --nex-cta-500
Text:        --nex-neutral-0
Padding:     12px 24px (mobile) / 14px 28px (desktop)
Font:        --text-base --font-semi
Radius:      --radius-md
Shadow:      --shadow-sm
Hover:       --nex-cta-700 background, --shadow-md
Active:      scale(0.98), --motion-fast
Disabled:    opacity 40%, cursor not-allowed
```

**Secondary** — supporting action ("Learn more", "See details"):

```
Background:  --nex-neutral-0
Text:        --nex-neutral-700
Border:      1px solid --nex-neutral-300
Padding:     12px 24px
Font:        --text-base --font-medium
Radius:      --radius-md
Hover:       --nex-neutral-50 background
```

**Tertiary** — inline, minimal ("Cancel", "Skip"):

```
Background:  transparent
Text:        --nex-neutral-500
Padding:     10px 16px
Font:        --text-sm --font-medium
Underline on hover
```

**Rule**: never use more than one primary CTA per visible surface. Multiple primaries destroy conversion clarity.

### 6.2 Chat bubbles

**AI (Nex) bubble:**

```
Background:  --nex-neutral-100
Text:        --nex-neutral-700
Padding:     12px 16px
Radius:      --radius-xl with bottom-left --radius-sm
Max width:   85% of chat panel
Avatar:      Nex avatar left, 32px, --nex-accent-500 mark
Font:        --text-base --font-normal
Line-height: 24px
```

**User bubble:**

```
Background:  --brand-primary-subtle (falls back to --nex-neutral-100 if merchant hasn't set brand)
Text:        --nex-neutral-700
Padding:     12px 16px
Radius:      --radius-xl with bottom-right --radius-sm
Max width:   85% of chat panel
Right-aligned
```

**Typing indicator:**

```
Three dots, 6px each, --nex-neutral-400 colour
Animation: pulse-out-pulse-in with 300ms stagger between dots
Position: below latest AI bubble
```

**Inline UI card inside chat** — when Nex needs to show a small piece of UI inside the chat (single product card, calendar snippet, map thumbnail):

```
Background:  --nex-neutral-0
Border:      1px solid --nex-neutral-200
Radius:      --radius-lg
Padding:     16px
Max width:   full chat panel width minus margins
Shadow:      --shadow-sm
```

For larger UI (comparison grid, full gallery, configurator), Nex opens the CANVAS not an inline card. Rule: if it needs more than ~300px vertical inside the chat, promote it to the canvas.

### 6.3 Cards

**Product card:**

```
Aspect:      3:4 image (top) + text block (bottom)
Image:       object-contain, 800×800 or 3:4 crop, --nex-neutral-100 background
Radius:      --radius-lg (whole card)
Padding:     16px (text block)
Title:       --text-lg --font-semi, 2-line clamp
Meta:        --text-sm --nex-neutral-500 (category, material)
Price:       PERCENTAGE ONLY per no-£-rule — "Entry tier · exact price depends on final design"
CTA button:  Full width secondary "See in chat"
```

**Project card (before/after):**

```
Aspect:      1:1 paired image (before-after swiper)
Overlay:     bottom gradient with title + location + trade
Radius:      --radius-lg
Interaction: tap → opens Discover state canvas gallery + AI comment
```

**Review card:**

```
Star row:    5 filled/unfilled stars, --nex-accent-500 (this is one of the ONLY places star icons are valid)
Quote:       --text-lg --font-normal, italic, 3-line clamp
Attribution: --text-sm — name, city, project type
```

**Video card:**

```
Poster:      16:9 image, --nex-neutral-100 background
Play icon:   64px circle, --nex-accent-500 fill, centred overlay
Duration:    bottom-right corner chip, --nex-neutral-900 background 60% opacity, white text
Radius:      --radius-lg
Interaction: tap → inline lightbox player
```

**Quote card (Price state):**

```
Header:      "Estimated range · [tier]", --text-lg --font-semi
Body:        Percentage-based comparison + list of variables that affect final price
Footer:      "Exact price depends on final design + timber + balustrade + finish + delivery + fit. Confirm with the merchant." (canonical per no-£-rule)
CTA:         Primary "Request full quote" → transitions to Book state
```

### 6.4 Chips + quick actions

**Quick action chip** (used in the "Quick AI Actions" module + in-chat suggestion strips):

```
Background:  --nex-neutral-100
Text:        --nex-neutral-700
Padding:     8px 14px
Font:        --text-sm --font-medium
Radius:      --radius-pill
Border:      1px solid transparent
Hover:       --nex-neutral-200, border --nex-neutral-300
Active:      --nex-accent-500 background, --nex-neutral-900 text (indicates selected)
Leading icon: optional, 16px Lucide, inherits text colour
```

### 6.5 Forms + inputs

**Text input:**

```
Height:     44px (mobile-thumb-safe) / 40px (desktop)
Padding:    12px 14px
Border:     1px solid --nex-neutral-300
Radius:     --radius-sm
Font:       --text-base --font-normal
Focus:      2px outline --nex-cta-500, no border colour change
Error:      2px outline --nex-error-500, helper text below in --nex-error-700
Disabled:   --nex-neutral-100 background, --nex-neutral-400 text
```

**Placeholder colour:** `--nex-neutral-400` — never fainter (accessibility).

**Text area** — same, min-height 96px.

**Select** — same input styling with 16px chevron-down (Lucide) right-aligned inside padding.

**Checkbox / radio** — 20px square/circle, --nex-neutral-300 border, --nex-cta-500 fill when checked with white check.

**Address / postcode input** — always attached to Nex's postcode auto-complete for UK postcodes.

**Never**: floating labels (accessibility issue on partial fill states). Always label-above-field.

### 6.6 Ask NEX bar

The primary input on every NEX surface. Not a search bar. Not a chat bubble. An **Ask NEX bar** — visually a rounded pill input that reads as familiar (like a search bar), functionally a conversation starter (like ChatGPT's home input).

```
Shape:         Rounded pill · height 48px (mobile) / 52px (desktop)
Background:    --nex-neutral-0 · 1px border --nex-neutral-200 · --shadow-sm
Left icon:     Lucide search icon (16px, --nex-neutral-400) — deliberately familiar
Placeholder:   "Ask NEX anything about [trade]..." or shorter "Ask NEX..."
Right icon:    Filter/settings icon in --nex-accent gradient pill OR mic OR send button (context-dependent — see below)
Focus:         2px --nex-accent-500 outline, no border colour change
```

**Right-icon rules per surface:**
- **Discover home surface (chat not yet open):** right icon is a subtle filter/preferences pill in the accent gradient. Tap focuses the input.
- **Inside the chat surface:** right icon splits — mic (voice input) + orange circular send button (paper-plane).

**Interaction behaviour:**
- On the Discover home surface, the Ask NEX bar appears prominently under the hero. Typing focus opens the chat panel (slides up). First keystroke expands the panel; user's typed content becomes the first message.
- Inside the chat surface, the Ask NEX bar is docked to the bottom above the tool tiles / bottom nav.

**Rationale:** users know how a search bar looks and works. Ask NEX borrows the visual familiarity but the function is conversational. This is what ChatGPT's home input does — it reads as search, behaves as chat.

**Do not** call it "search" in copy, tooltips, or ARIA labels. The accessible name is "Ask NEX". Screen readers announce it as such.

### 6.7 Navigation

**Top nav (fixed):**

```
Height:        56px mobile / 64px desktop
Background:    --nex-cream at 88% opacity + backdrop-blur 12px
Border-bottom: 1px solid --nex-neutral-200
Contents (Discover / OS home surfaces):
   Left: NEX wordmark (bold navy `--nex-neutral-900`) + trade subtitle small-caps (letter-spaced)
   Right: notification bell icon
Contents (Chat surface):
   Left: back arrow + Nex avatar 32px + merchant name (bold) + "AI Assistant for [trade]" subtitle + green online dot
   Right: 3-dot menu icon
```

No global menu. No hamburger. No dropdown of website pages.

**Bottom nav — OS destinations (permanent on mobile):**

Bottom nav is a permanent 5-item surface on mobile. Each item represents an **operating-system destination**, not a website page. These are always-available surfaces the customer might jump between during their relationship with the platform.

```
Height:        72px + safe-area padding
Background:    --nex-neutral-0 with top --shadow-md
Layout:        Rounded top corners --radius-2xl, floats above the canvas
Items:         5 slots: Home · Projects · [+ FAB] · Messages · Profile
Item spec:     Icon 24px above 11px label
Active state:  Icon + label in --nex-accent-500, small 4px dot centred below label
Inactive:      Icon + label in --nex-neutral-500
FAB (centre):  56px orange circle with white + icon, elevated above the bar (protrudes ~16px up)
```

The 5 OS destinations for V1:

| Destination | Purpose | State this typically activates |
|---|---|---|
| Home | The Discover surface (this trade app's landing) | discover |
| Projects | Customer's active + completed projects with this merchant | project |
| + (FAB) | New conversation — opens chat panel with fresh thread | discover with chat slid up |
| Messages | All conversations with this merchant, current + past | aftercare or project chat threads |
| Profile | Customer's account, saved shortlists, warranty summary | separate — future spec |

**These are NOT website pages.** No "About Us" tab. No "Services" tab. No "Blog" tab. The bottom nav does not fragment the trade content across screens — it gives the customer OS-level access to their own things (their projects, their messages, their profile) plus a shortcut to start a new conversation via the FAB.

**Business-owner variant:** merchants using the app for their own business get a slightly different bottom nav — Home · Projects · Business · Messages · Profile — where "Business" replaces the FAB and gives the owner their own admin surfaces.

**Desktop nav:** on desktop, the bottom nav collapses into a left rail (icons only) or a top secondary nav strip below the main nav (TBD when we ship desktop).

### 6.8 Floating action button

Reserved for one thing across the entire app: **Open chat** on desktop when the chat panel has been manually collapsed.

```
Position:    Fixed bottom-right, 24px from edges
Size:        56px diameter
Background:  --nex-accent-500
Icon:        Nex avatar mark, white, 24px
Shadow:      --shadow-lg
Animation:   Pulses once every 4s if the user has been idle >90s with no engagement
```

**Do not** use FABs for anything else. Multiple FABs across an app fragment the "Nex is one thing" intent.

### 6.9 Loading + skeleton states

**Skeleton screens** (preferred over spinners for content):

```
Background:  --nex-neutral-100
Highlight:   linear-gradient, 90deg, transparent → --nex-neutral-0 40% → transparent
Animation:   shimmer 1500ms linear infinite
Radius:      matches the eventual content radius
```

Product card skeleton: 3:4 image block + 2 text lines.
Chat message skeleton: bubble outline, 2 text lines.
Canvas swap skeleton: fills the canvas with a subtle grid of card outlines during state transition.

**Spinner** (only when duration is unknowable, e.g. AI response taking >2s):

```
Nex ring:     3-dot orbit around Nex avatar, --nex-accent-500
Size:         24px inline / 40px canvas overlay
Motion:       linear infinite 800ms rotation
```

**Never** use platform default spinners (WebKit gray ring, Chrome multicolor). Always Nex ring.

### 6.10 Empty states

Text-first, action-oriented:

```
Icon:        Lucide, 40px, --nex-neutral-400
Title:       --text-lg --font-semi, --nex-neutral-700
Body:        --text-sm --nex-neutral-500, one sentence
CTA:         Primary or secondary, single button
```

Example (empty comparison state): "Nothing to compare yet. Ask me to shortlist a few options and I'll bring them here."

**Never** use "Oops!" copy. **Never** cartoonify empty states.

### 6.11 Error handling

Errors are conversational. Never a modal that blocks the chat.

**Inline field error**: red outline + helper text (see 6.5).

**Network / AI error**: appears as a Nex chat message with a retry chip.

```
Nex bubble:  "I couldn't reach my brain just now — one second, trying again."
Chip:        "Retry now" (tertiary button)
Auto-retry:  Once after 3s. If retry fails, message becomes "I'm having trouble reaching my brain. You can keep typing and I'll respond once I'm back, or try again in a moment."
```

**Never**: red banners, alert() dialogs, error toast auto-dismiss. All errors preserve the conversation.

### 6.12 Notifications

Notifications are Nex chat messages, not toasts.

Example: after booking a survey, the confirmation isn't a green toast — it's a Nex message: "Booked — [merchant] will visit [address] on Thursday 14 August 2pm. I've added it to your project timeline. Anything else you'd like to prepare before then?"

The only toast-style notification permitted is a save-confirmation on the merchant admin surface, where chat may not be present.

---

## §7. Accessibility (WCAG AA baseline)

- Colour contrast: 4.5:1 for text on background. All token combinations pre-verified.
- Focus rings: 2px `--nex-cta-500` outline, never removed. `:focus-visible` used to hide only on mouse click.
- Keyboard: every interactive element reachable via Tab. Chat panel: `/` shortcut focuses the input from anywhere.
- Screen reader: chat messages announced via ARIA live regions. State transitions announce the new state name.
- Motion: `prefers-reduced-motion` respected — collapses all motion tokens to instant.
- Touch targets: 44×44px minimum on mobile (per Apple HIG).
- Text: `13px` absolute floor for text on donut app + dashboards per Trades CLAUDE.md; `12px` elsewhere.
- Language: `lang="en-GB"` on the html element (UK English is canonical).

---

## §8. Dark mode policy

**V1: light mode only.** No dark mode.

**Rationale:**
- Construction trade users are frequently outdoors — high-brightness sun conditions favour light backgrounds with dark text (contrast wins).
- Customer-facing chat is inherently document-like reading — light-mode wins for long conversations.
- Merchant admin surfaces are used during office hours, not late-night dev sessions.
- Building two themes doubles the design QA cost with negligible user demand in the target segment.
- Auto dark-mode via OS preference is DISABLED at V1 — the app forces light mode.

**V2 (Y2+) reconsideration triggers:**
- User research shows a specific trade segment prefers dark (e.g. metal fabricators working evening shifts)
- Merchant admin adds late-night workflows that dark mode would ease
- Never on customer-facing surfaces without evidence

---

## §9. Nex character — visual + voice rules inside UI

Nex has a specific visual and behavioural signature across every surface.

**Avatar:**
- 32px pill mark with the Nex accent yellow background and a simple abstract mark (TBD by brand — placeholder: stylised "N" in --nex-neutral-900)
- Appears in every AI chat bubble, in the chat panel header, in the FAB
- Never has a photograph, never a face, never a human-like avatar

**Voice** (embedded per feedback memories):
- Workshop-warm, UK English throughout
- Direct "you" language, contractions, em dashes, trade rhythms
- Never marketing language ("industry-leading", "cutting-edge", "revolutionary")
- Adviser-not-reviewer for company questions
- No prices in £ figures — always percentages/tiers with the canonical disclaimer
- Never "cheap" — use "less expensive", "more affordable", "budget-friendly"
- Relevance-first: answer the question, don't answer 5 unasked questions
- One follow-up question, not five
- Never judges businesses ("good", "excellent", "poor" all banned about companies)

**Nex never speaks as a page**. It never says "on this page you can find…" or "click here to…". It says "I'll show you the [thing]", then summons the UI.

---

## §10. Merchant brand adaptation — what changes vs what doesn't

### What merchant configures

| Token | How | Example |
|-------|-----|---------|
| `--brand-primary` | Hex picker or brand-colour uploader | `#8B2A2A` (deep red) |
| Logo mark | PNG upload, max 240×240, transparent background required | Merchant SVG or PNG |
| Business name | Text field, --text-lg cap 40 chars | "Stairplan Ltd" |
| Business tagline | Text field, --text-base cap 80 chars | "Custom staircases across the North" |
| Hero photography | JPEG/AVIF upload, 16:9, min 1600×900 | Merchant photo |
| Location(s) | UK city list | "Manchester + serving 30-mile radius" |
| Trade slug | Selected at signup | "staircase_maker" |
| Trade priority order | Selected from Master Template presets (see companion doc) | "Visual sell" preset |
| Contact channels | Phone, email, form, WhatsApp toggles | Toggles |
| Social links | URL list — Instagram, Facebook, YouTube, TikTok, LinkedIn | URL fields |

### What merchant cannot change

Everything else. Specifically:
- Any design token except the ones above
- The chat panel appearance
- The Nex avatar
- The Nex accent yellow (`--nex-accent-500`)
- The CTA green (`--nex-cta-500`)
- Semantic feedback colours
- Typography scale, weights, or font family
- Component shapes (radii, shadows, borders)
- Motion tokens or transitions
- Iconography style
- Layout of the master template (module order is preset-driven per trade, not free-form)
- Any text on Nex's chat bubbles (Nex speaks in her voice regardless of merchant)

### Why the constraint

Merchants sometimes want more control. Denying it is a feature: every NEX app must feel like a NEX app. A customer moving between a plumber and a staircase maker must recognise the pattern instantly. Merchant identity comes through in imagery, colour, and content — not in reinvented typography or spacing.

If a merchant requests customisation beyond the tokens above, the platform's answer is "no", not "no for now." This is a Platform Integrity rule (per Nex Intelligence Master Blueprint).

---

## §11. Component naming + code conventions

Component library published as `@nex/ui`. React (Next.js 15 app router). TypeScript strict. Tailwind CSS with the design tokens exposed as CSS variables.

Naming:
- Component: PascalCase, semantic (`ChatBubble`, `ProductCard`, `QuickActionChip`)
- Props: camelCase, no boolean-with-`is` prefix (`open` not `isOpen`)
- Slots: children first, then named slot props (`headerSlot`, `footerSlot`)
- Every component ships with a Storybook entry documenting states, sizes, and interactions

File layout:
```
packages/ui/
  src/
    tokens/        (design tokens as JS + CSS)
    components/
      Button/
        Button.tsx
        Button.stories.tsx
        Button.test.tsx
    hooks/
    utils/
```

Testing:
- Every component has a Storybook file rendering every state
- Every interactive component has a Playwright accessibility check
- Snapshot tests for visual regression via Percy or Chromatic (TBD)

---

## §12. Change control

This document is the source of truth. Changes proceed by:

1. Someone proposes a change as a Pull Request against this file with rationale + before/after examples
2. CEO + Design Lead + CTO review — all three must approve for structural changes (tokens, philosophy)
3. Component additions can be approved by Design Lead + one engineer
4. Deletions (removing a rule) require full three-approver review + a migration plan for consumers
5. Version bumps: minor (`v1.1`) for additions, major (`v2.0`) for breaking changes to tokens or philosophy

**When in doubt, refer to §1 (governing philosophy). If a decision violates the philosophy, it doesn't ship.**

---

---

## §13. Change log

**v1.1 · 2026-07-24** (same-day refinement after first design review)
- Added §0.1 scope clarification: this doc defines interaction architecture; visual language comes from canonical mockups.
- Added §0.2 canonical visual references (Staircase home + chat mockups).
- Rewrote §1 governing philosophy — new master principle #1 ("Conversation is the primary way people accomplish tasks. Visual components appear when they make the task faster or clearer."), reframed chat as persistent-in-capability-not-in-visibility, opened bottom nav for OS destinations.
- Unified accent colour: replaced yellow (`#FBBF24`) + green CTA (`#166534`) with orange (`#F97316`) throughout. Semantic colours unchanged.
- Added `--nex-cream` (#FBF6EC) as app background token.
- §6.6 renamed "Search" → "Ask NEX bar" with expanded interaction spec.
- §6.7 rewrote navigation to add permanent bottom nav for 5 OS destinations (Home · Projects · + · Messages · Profile).
- Rewrote §2 chat + canvas pattern to reflect canvas-default + chat-slides-up model.

**v1.0 · 2026-07-24** — initial issue.

---

**End of NEX Design Language V1.1.**
Companion: [MASTER_TRADE_TEMPLATE_v1.md](./MASTER_TRADE_TEMPLATE_v1.md) — how this language assembles into the universal trade app.
