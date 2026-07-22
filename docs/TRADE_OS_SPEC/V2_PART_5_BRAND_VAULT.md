# Trade Operating System · Volume 2 · Part 5
## Brand Vault (Merchant Home Screen)

**Audience:** Product Designers, UX Architects, Frontend Engineers, AI Engineers
**Source:** ChatGPT design-brief architecture series, V2 Part 5.

---

## Philosophy

Most design software starts with a blank canvas. **The Trade OS never does.**

It starts with the merchant's business.

The Brand Vault is **not a dashboard.** It is the merchant's **digital headquarters.**

When a builder opens the platform they should immediately think: *"Everything about my business lives here."* Not: *"Where do I start?"*

Every Studio opens from here. Everything returns here.

```
                    TRADE OS
                    Brand Vault
                          │
      ┌───────────────────┼───────────────────┐
      │                   │                   │
 Brand Identity      Business Assets     AI Assistant
      │                   │                   │
      ▼                   ▼                   ▼
 Logo                 Van Wrap          Recommendations
 Colours              Website           Improvements
 Fonts                Business Card     Seasonal Ideas
 Tokens               Workwear          Growth
```

---

## Home Screen Layout (six zones — nothing else)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TRADE OS                                        Notifications   Profile      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Welcome back, John 👋                                                        │
│ Prestige Staircases Ltd                                                      │
│                                                                              │
│ Brand Health: 96% ★★★★★                                                     │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ QUICK ACTIONS                                                                │
│ [+ New Design]  [Generate Van]  [Business Cards]  [Website]  [Export]        │
├──────────────────────────────────────────────────────────────────────────────┤
│ MY BRAND                                                                     │
│ Logo      Colours      Typography      Brand Guide      Photography          │
├──────────────────────────────────────────────────────────────────────────────┤
│ MY ASSETS                                                                    │
│ Van        Cards       Website       Invoice      Signage      Workwear      │
├──────────────────────────────────────────────────────────────────────────────┤
│ RECENT ACTIVITY                                                              │
│ ✓ Van Updated                                                                │
│ ✓ Logo Improved                                                              │
│ ✓ Website Published                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ AI RECOMMENDATIONS                                                           │
│ • Business cards don't match new logo                                        │
│ • Autumn campaign ready                                                      │
│ • Improve website hero image                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### The Six Zones

1. **Hero** (welcome + Brand Health)
2. **Quick Actions** (5 buttons)
3. **My Brand** (5 cards: Logo · Colours · Typography · Brand Guide · Photography)
4. **My Assets** (visual cards per asset)
5. **Recent Activity** (Git-style timeline)
6. **AI Recommendations** (retention driver)

**Nothing else.**

---

## Zone 1 — Hero Panel

Large. Minimal. Beautiful. **Never clutter this.**

```
────────────────────────────────────────
Prestige Staircases Ltd
Premium Residential Joinery

★★★★★ Brand Health 96%
Last updated today

[Generate]  [Improve]  [Export]
────────────────────────────────────────
```

### Brand Health Card (signature feature)

```
★★★★★
Brand Health          96%

Consistency           98
Typography            97
Premium Feel          99
Print Ready          100
Accessibility         96
Marketing Ready       95
```

**Updates live.** No other trade platform offers a measurable brand quality score.

---

## Zone 2 — Quick Actions (only five, ever)

`Generate · Improve · Compare · Export · Ask AI`

Those five solve 90% of user needs.

---

## Zone 3 — My Brand Section

Large cards, each opens a dedicated Studio:

- **Logo** — current version (e.g. v6) → Edit
- **Colours** — 5 colours → Edit
- **Typography** — Inter / Sora → Edit
- **Voice** — Luxury / Friendly → Edit
- **Brand Guide** → Open
- **Photography** → Edit

---

## Zone 4 — My Assets

Visual cards, not folders. Each shows: thumbnail · version · status · updated · open · export.

```
Van Wrap         Business Cards   Website          Uniform
Updated Today    Approved         Published        Ready
[Open]           [Open]           [Open]           [Open]
```

### Asset Status (one only, never multiple)

`Draft · Generating · Awaiting Approval · Approved · Published · Needs Update`

---

## Zone 5 — Timeline (GitHub-style)

```
Today
  ✓ Logo updated
  ✓ Van regenerated
  ✓ Business card exported

Yesterday
  ✓ Website published
  ✓ Invoice template created

Monday
  ✓ Brand colours changed
```

Merchant understands exactly what happened.

---

## Zone 6 — AI Recommendations (retention driver)

```
★★★★★  Recommendations

  • Update workwear to match new logo
  • Generate Christmas campaign
  • Website hero is outdated
  • Add QR code to van
  • Your competitors use darker branding
  • Business cards don't match invoice
  • Generate matching email signature
```

Each recommendation is **one click** to action.

---

## AI Creative Director Panel

Not a chatbot. A persistent panel.

```
Creative Director

Brand Score  96

Today's Advice
  • Move logo 8% higher
  • Increase phone size
  • Generate matching polo shirt
  • Simplify typography
  • Create luxury website hero
```

Feels like an **agency account manager**, not an AI wrapper.

---

## Command Bar (Cmd/Ctrl + K)

Top of every screen. Natural language:

- "Create matching hoodie"
- "Generate black van"
- "Make logo larger"
- "Show previous version"
- "Export printer pack"

**No menus.** Aligns with the UI Spec Command Palette feature.

---

## Universal Search

Searches everything: Logo · Business Cards · Invoice · Van · Prompt · Export · Colours · Brand Guide.

**Think Spotlight on macOS.**

---

## Notifications (useful only, never marketing)

- Export finished
- Printer downloaded files
- Logo approved
- Website published
- Brand Health improved
- Seasonal campaign available

---

## Merchant Insights (tiny analytics)

```
Brand Health         96%
Assets                18
Exports               42
Views                120
Design Consistency   98%
Most Used         Van Wrap
```

---

## Context Panel (asset selected)

```
Van Wrap
Created    Yesterday
Version    6
AI Score   98
Print Score 100

[Open]  [Duplicate]  [Export]  [History]
```

---

## Merchant Psychology

The first thing merchants care about isn't editing. It's **reassurance.**

The homepage answers four questions:
1. Is my brand healthy?
2. Where is everything?
3. What's changed?
4. What should I do next?

**Not** "What colour?"

---

## Empty State (brand new merchant)

Instead of an empty dashboard:

```
Welcome to Trade OS
Let's build your business.

Step 1 — Create Logo
Step 2 — Choose Colours
Step 3 — Generate Van

Estimated 12 minutes
Progress 0%
```

Feels like onboarding.

---

## Returning Merchant (no onboarding, immediately useful)

```
Welcome back

Brand Health 96%

3 Assets Need Updating
1 Export Finished

Today's Recommendation
  Generate Autumn Promotion
```

---

## Mobile Layout (four tabs only)

`Home · Studios · Assets · Profile`

Plus floating AI button bottom-right. Nothing more.

---

## Bonus feature — Brand Timeline

A visual history of the business evolving over time.

```
2026
  Logo v1
     ↓
  Van v1
     ↓
  Website v1
     ↓
  New Colours
     ↓
  Van v2
     ↓
  Fleet Added
     ↓
  Office Branding
     ↓
  Brand Health  82 → 97
```

Merchants don't just see files; they see the **growth of their business**. Creates emotional attachment and reinforces that Trade OS is the long-term home for their brand, not just another design tool.

---

## Networkers-specific implementation notes

- **Route:** `/studio/vault` (new) — the merchant's home. Existing `/studio/home` becomes an alias or redirect.
- **Data sources ready today:**
  - Brand DNA from `hammerex_brand_identity` (already exists from V1 foundation migration)
  - Brand snapshots from `hammerex_brand_snapshots` (already exists)
  - Recent activity from `hammerex_events` (shipping in this slice)
  - Van assets from `hammerex_van_sessions` + `hammerex_van_generations` (already exists)
- **Brand Health score** computed by the Design Critic (V3 Q12) — for now, deterministic score from field-fill % + AA-contrast + logo-present. Real critic score replaces once V3 lands.
- **AI Recommendations** driven by Mate's existing proactive engine (`hammerex_mate_signals`) — extend the detector set to include brand-drift + missing-asset + seasonal-opportunity detectors.
- **Command Bar (Cmd+K)** is a global overlay — mount once in the Studio layout, hook into every Studio's action registry.
- **Empty state onboarding** = the Discovery Agent (V1 Part 1 mention) running its 7 questions inline as steps.
- **Brand Timeline visualisation** reads directly from the append-only `hammerex_events` table filtered by merchant + brand.
- **The six zones** map cleanly to six React sections in `src/app/studio/vault/page.tsx` — pure composition, no invented widgets.
