# Trade OS · Studio Interface Specification

> **Internal document.** Repo-only. Not for external contractors without NDA.
> Source: ChatGPT design-brief architecture series, UI recommendation.

The interface spec for every Studio in the Trade OS. Applies to Brand Studio, Vehicle Studio, Print Studio, Website Studio, Social Studio, Marketing Studio, Photography Studio, App Studio, Office Studio, and Signage Studio — one shared shell, one component library, one interaction model across all Studios.

---

## Core UX Principle

### Creative Director first. Editor second.

Every design tool on the market is **editor first** — users see hundreds of buttons before they see value.

The Trade OS inverts this. Instead of asking *"What colour would you like?"* the platform says *"We've created three premium directions for your business."* The merchant chooses a direction, and only then edits details.

**Rule: show only the controls relevant to the current task.** Complex property panels are replaced with AI actions (Improve Design, Generate Variations, Compare Versions, Explain Changes).

---

## Layout

Three-panel shell across every Studio:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TRADE OS STUDIO                                    Save · Share · Export │
├───────────────┬──────────────────────────────────────────────────────────┤
│               │                                                          │
│ BRAND         │                                                          │
│  Company      │                LIVE PREVIEW                              │
│  Brand DNA    │                                                          │
│  Assets       │              (Canvas / iframe)                           │
│               │                                                          │
├───────────────┤                                                          │
│ DESIGN        │                                                          │
│  Layout       │                                                          │
│  Colours      │                                                          │
│  Typography   │                                                          │
│  Images       │                                                          │
│  Logo         │                                                          │
│  Effects      │                                                          │
├───────────────┤                                                          │
│ AI            │                                                          │
│  Generate     │                                                          │
│  Improve      │                                                          │
│  Compare      │                                                          │
│  Explain      │                                                          │
│  History      │                                                          │
├───────────────┤                                                          │
│ EXPORT        │                                                          │
│  PNG          │                                                          │
│  PDF          │                                                          │
│  SVG          │                                                          │
│  Printer Pack │                                                          │
└───────────────┴──────────────────────────────────────────────────────────┘
```

- **Left**: collapsible navigation for Brand DNA + Studios + AI actions + Assets + Export. Organised into 4 vertical groups.
- **Centre**: large live preview. Canvas or iframe depending on Studio.
- **Right**: optional Inspector (appears only when relevant to the current selection).

**Only ~20 major actions visible at any time.** Professional designers use a few powerful controls. Amateurs use hundreds of weak ones. Follow the professional pattern.

---

## Left Navigation — full spec

### Dashboard
- 🏠 Home

### Brand
- Brand DNA
- Logo
- Colours
- Typography
- Photography
- Voice
- Brand Guide

### Studios
- Vehicle Studio
- Print Studio
- Website Studio
- Social Studio
- Marketing Studio
- Photography Studio
- App Studio
- Office Studio
- Signage Studio

### AI
- Generate
- Improve Design
- Generate Variations
- Design Critic
- Premium Review
- Compare Designs
- Ask AI

### Assets
- Brand Vault
- Images
- Icons
- Fonts
- Templates
- Uploads

### Export
- PNG
- SVG
- PDF
- Printer Pack
- ZIP
- Share

---

## Top Toolbar (9 items, nothing more)

`Undo · Redo · History · Save · Duplicate · Regenerate · Compare · Export · Share`

---

## Right Preview Tabs

Never static. Tabs across the top of the preview panel:

| Tab | What it shows |
|-|-|
| **Preview** | The actual design as the customer sees it |
| **Mockups** | One-click: Van, Business Card, Uniform, Website, Sign, Invoice, Office |
| **Production** | Bleed, cut lines, CMYK, resolution, safe area, print notes |
| **Versions** | v1 · v2 · v3 · v4 — rollback |
| **History** | Timeline of every change (per Brand Timeline feature) |
| **AI Review** | Creative Director scores with rating stars |

### AI Review tab format

```
★★★★★
Brand            98
Typography       96
Hierarchy        95
Trust            97
Premium          99
Vehicle Layout   98
```

Feels like an agency review.

---

## Floating AI Button (bottom-right)

Instead of hunting menus, merchant types natural language:

- "Make logo larger"
- "Move phone higher"
- "Use darker wood"
- "Remove black"
- "Add luxury feel"
- "Try navy"
- "Show another layout"
- "Less busy"
- "More modern"
- "Use customer photos"

GPT + Prompt Compiler translate → apply → re-render.

---

## Signature Feature 1 — Improve Design button

One click: `✨ Improve Design`

AI responds:

> **I've made 7 improvements.**
> ✓ Better logo spacing
> ✓ Better typography
> ✓ Cleaner hierarchy
> ✓ Better balance
> ✓ Stronger premium feel
> ✓ Larger phone number
> ✓ Improved contrast

**No editor on the market has this.** The Design Critic identifies each weakness against the scoring rubric, applies deterministic fixes where possible, and re-runs the compiler for anything requiring regeneration.

## Signature Feature 2 — Show me 4 ideas

One click. AI outputs four labelled directions:

- **Executive**
- **Luxury**
- **Bold**
- **Minimal**

No prompt from the merchant. The system picks four Brand DNA-aligned variants and generates them in parallel.

## Signature Feature 3 — Creative Director Panel

Replaces property panels. Instead of "Font size: 14px" sliders, the panel shows:

```
Creative Director

Overall Score  97

Suggestions
  • Increase logo 8%
  • Reduce photo size
  • Move CTA higher
  • Improve balance
  • Increase premium feel
  • Reduce clutter
```

Feels like having Pentagram reviewing your work.

## Signature Feature 4 — Command Palette

`Cmd/Ctrl + K` anywhere. Natural-language command:

- "Generate a luxury van"
- "Make the logo 15% larger"
- "Switch to navy"
- "Export printer pack"
- "Show previous version"
- "Create matching business card"
- "Generate website hero"

Fastest interaction pattern for power users. Modelled on Cursor + VS Code. Every menu item must ALSO be reachable via the palette.

## Signature Feature 5 — Brand Health score

Top-right corner. Persistent.

```
Brand Health  97%  ★★★★★

Identity         100
Consistency       98
Premium Feel      95
Trust             97
Print Ready      100
Marketing Ready   96
```

**No one in this market offers a measurable brand quality score.** It's the moat that turns Studio from a design tool into a business advisor.

---

## Brand Vault (the merchant's home)

Merchant doesn't own "designs". Merchant owns their **Brand**.

```
My Brand
├── Logo
├── Brand Guide
├── Colours
├── Typography
├── Photography
├── Assets
├── Website
├── Van
├── Cards
├── Signs
├── Invoices
├── Exports
└── History
```

Everything lives here. Aligns with the Master Rule (`docs/TRADE_OS_SPEC/PRINCIPLES.md`) — the merchant owns the recipe, images are the cache.

---

## One-click Brand Sync

Merchant changes Gold → Navy. System immediately shows:

> **18 assets affected**
>
> [Preview Changes]

Nothing regenerates automatically. Preview + approval flow first (per V1 Part 1 Regeneration Model).

---

## Design System Requirements

- **Whitespace over density** — merchant's brand colours are the visual focus, UI chrome recedes
- **8px spacing grid**
- **12-16px rounded card corners**
- **Subtle elevation** (no heavy shadows, no drop-shadows on preview canvas)
- **Neutral colour palette for chrome** — white / near-black / soft grey. Colour comes from the merchant's brand
- **Consistent across every Studio** — same shell, same component library, same interaction model

---

## Networkers-specific implementation notes

- **Existing shell at `/studio/build`** — left form/chat + centre iframe + right InspectorRail — is the ARCHITECTURAL match for this spec. Layout is right. What needs upgrading:
  1. Left panel needs to become the 4-group navigation (Brand / Design / AI / Export) not just a form
  2. Top toolbar needs the 9-item strip
  3. Right preview needs the 6 tabs (Preview / Mockups / Production / Versions / History / AI Review)
  4. Floating AI button needs to be added bottom-right
  5. Command palette needs to be added (Cmd/Ctrl + K)
  6. Brand Health score needs to be added top-right
- **Improve Design, Show 4 Ideas, Creative Director Panel** are all Studio-App-level features that route through the AI Orchestrator (per V1 Part 1).
- **Brand Vault** becomes a first-class route at `/studio/vault` or similar — populated from the `hammerex_brand_identity` + `hammerex_brand_snapshots` tables shipped today.
- **Design token file** needs to lock down the neutral chrome palette so every Studio uses the same shell tokens.
