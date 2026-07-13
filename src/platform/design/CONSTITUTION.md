# Design Constitution — Xrated Trades / The Network

**Adopted:** 2026-07-09
**Governs:** every visual surface — customer-facing merchant profiles,
merchant Business OS dashboards, Studio editor, marketplace, and every
AI-composed layout.

This document is **enforceable**. The AI composer's system prompts
reference it. Studio's design registry validates against it. Any PR
that violates a NON-NEGOTIABLE rule below is rejected.

---

## 1. Two visual worlds

Xrated Trades has two distinct visual worlds. **Rules that apply
everywhere are §2. Rules that differ by world are §3.**

| World | Purpose | Audience | Design register |
|---|---|---|---|
| **A · Customer-facing** | Merchant profile pages a customer sees when searching a trade | End customers (homeowners, buyers) | Premium, editorial, photography-first. Linear × Stripe × Loveable bar. |
| **B · Operations** | Merchant's own Business OS dashboard (inventory, quotes, jobs, bids, analytics) | The tradesperson at their desk / on site | Industrial-Pro. Dense, high-contrast, borders-not-shadows, uppercase status. |

The AI composer detects world by the page being composed:
- Any page under `/trade/`, `/hire`, or a merchant slug → **World A**.
- Any page under `/studio/`, `/dashboard/`, `/os/` → **World B**.

---

## 2. NON-NEGOTIABLE — both worlds

### 2.1 Accessibility (WCAG 2.1 AA)

- **Body copy floor: 13 px.** (Stricter than WCAG's 12 px minimum —
  matches `feedback_streetlocal_text_size.md`.) Never smaller in
  paragraphs, table cells, buttons, badges, tooltips.
- **Eyebrow / status label floor: 11 px** — permitted only when
  UPPERCASE + `tracking-wider` + 700 weight + 4.5:1 contrast.
- **Tap target minimum: 44 × 44 px** on any touchable primary action
  (mobile + desktop). Secondary chrome (toolbar chip, kebab) may be
  36 px on desktop but never on mobile.
- **Text contrast: 4.5:1** on body, **3:1** on ≥ 18 px large text,
  measured against the actual surface (not the assumed background).
- **Focus rings visible.** Never `outline: none` without a visible
  replacement. 2 px ring, offset 2 px, brand-accent colour.

### 2.2 Typography

- **Inter** is the primary family. `Roboto` on the Industrial theme,
  `Manrope` on Corporate, `Playfair Display` headings on Luxury.
- **Never** invent a font. Only fonts registered in `platform/design/tokens/`
  are legal.
- **Type scale** comes from `platform/ui/tokens/typography.ts`. Never
  hard-code font sizes in components. Studio surfaces read tokens.

### 2.3 Icons

- **Lucide only.** No emoji as icons. No hand-drawn SVG unless the
  merchant uploads it as a brand asset.
- Inherit `currentColor`, `stroke-width: 2`. Never hard-code icon
  colour.
- Sizes: `h-4 w-4` (16 px), `h-5 w-5` (20 px), `h-6 w-6` (24 px).
  Reserve larger for hero decorations.

### 2.4 Images

- **`object-contain`** on every merchant / product / service / machine
  image. Only full-bleed hero banners with gradient overlays may use
  `object-cover`. (Enforces `feedback_global_images_contain.md`.)
- No lorem-ipsum, no stock filler in production. Realistic UK trades
  data everywhere ("Treated Timber 4×2", "Birmingham Yard", "£4.85 / m").

### 2.5 Colour tokens

- Every colour reference reads from `brand.*` Tailwind tokens or the
  active `designTokenRegistry` set. **Zero hard-coded hex** in
  components. Studio surfaces preserve merchant brand overrides.

### 2.6 Motion

- Skeleton loaders match the final dimensions of what's loading. **No
  spinners** except for < 200 ms micro-actions.
- No layout shift on hover. Colour / opacity / border changes only.
- Motion tokens (`animation.*`) drive durations — no ad-hoc `duration-[NNNms]`.

---

## 3. World-specific rules

### 3.1 World A — Customer-facing (merchant profiles)

The competitive bar is **Linear × Stripe × Loveable**. Every merchant
should look like they hired a boutique agency.

- **Full-bleed hero.** Full-width, ≥ 60 vh on desktop, real
  photography (merchant-uploaded or theme-aware pool pick). Gradient
  overlay for text contrast.
- **Rounded-lg (8 px)** on cards, buttons, inputs. **Rounded-full** on
  pills and avatars. Sharp 2 px radii are reserved for status badges.
- **Elevation** — soft shadows (elevation tokens `md` / `lg`) welcome
  on hero cards, floating CTAs, modals. Borders for supporting cards.
- **Whitespace** — generous. `p-6` / `p-8` on hero cards, `gap-6` /
  `gap-8` between sections. NOT the operations-dashboard `gap-4`.
- **Voice** — trades-native but polished. No "premium", "curated",
  "boutique", "elevated". Yes to real UK trade language ("on the tools",
  "smashed it", "Gas Safe registered").

### 3.2 World B — Operations (Business OS dashboards)

Industrial Pro aesthetic — dense, decisive, physical.

- **Fixed sidebar** — `w-60` (240 px), dark surface (charcoal `#1A1C1E`
  or `brand.surface.900` token).
- **12-column grid, `gap-4` exclusively.** Never `gap-6` / `gap-8` on
  operations pages.
- **Sticky header** `h-14` (56 px), white surface, subtle bottom
  border. Global search / command palette lives here.
- **Cards** — `bg-white`, `rounded-lg` (NOT `rounded-sm` — that fails
  the Linear-standard test), `border-gray-200/80`, `p-4`. **Borders
  over shadows** on dense operational cards.
- **Buttons** — primary = filled safety-orange, secondary = bordered
  dark. Minimum height **44 px** on touchable primary actions. Desktop
  toolbar chips may be **36 px**.
- **Tables** — dense mode. Row height **44 px minimum** for touchable
  rows; 36 px permitted for read-only desktop tables. Cell text
  **13 px** floor. Striped rows `even:bg-gray-50/50`.
- **Status pills** — `rounded-sm` (2 px), `px-2 py-0.5`, **11 px
  uppercase**, `tracking-wider`, 700 weight. Colour-code:
  green = live / in-stock, orange = pending / low, red = fail / out.
- **Physical indicators** — filled dot ⬤ + text, not colour-only.
- **F-pattern** — the top-left card holds the single most critical
  metric (out-of-stock alerts, urgent bids, overdue jobs). Secondary
  operational data centre-right. Long-form (tables, lists) below the fold.
- **Above-the-fold at 1440 × 900** must render the primary decision
  surface without scroll.

---

## 4. Enforcement

- **AI composer system prompt** appends §2 (both worlds) + the
  detected world's §3 rules on every `compose` / `orchestrate` /
  `mutate` call.
- **Design registry `.selfCheck()`** validates every registered
  component declares which world it targets and passes the world's
  rules.
- **CI lint** (M10) rejects `rounded-sm` on cards, `text-[10px]` in
  body / cells, `gap-6+` on operations pages, hard-coded hex.

---

## 5. Deviations require justification

If a merchant explicitly requests a rule bend ("I want giant 4-column
gap on my ops page"), the composer surfaces a Studio warning naming
the rule and the merchant's override lives in `brand.overrides.*`.
Deviations are never silent.
