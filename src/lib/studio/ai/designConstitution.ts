// AI-composer design-constitution snippet.
//
// Compact, token-cache-friendly summary of platform/design/CONSTITUTION.md
// that gets appended to every `compose` / `orchestrate` / `mutate`
// system prompt. Full constitution stays in the .md for humans;
// this file is the machine-readable enforcement layer.
//
// Any drift here vs. CONSTITUTION.md is a bug — keep them in sync.

/** The world the composer is generating for. Customer-facing merchant
 *  profile pages (default) vs the merchant's own Business OS dashboards. */
export type DesignWorld = "customer-facing" | "operations";

/** Universal rules that apply to both worlds — appended on every
 *  composer call regardless of context. */
export const UNIVERSAL_DESIGN_RULES = `
DESIGN CONSTITUTION — universal (NON-NEGOTIABLE):
- Body copy floor: 13px. Never smaller in paragraphs, tables, buttons, badges.
- Eyebrow / status labels: 11px permitted only when UPPERCASE + tracking-wider + weight 700 + 4.5:1 contrast.
- Tap-target minimum: 44×44px on any touchable primary action. 36px permitted only on desktop toolbar chrome.
- Text contrast: 4.5:1 on body, 3:1 on 18px+ large text.
- Focus rings visible: 2px ring, offset 2px, brand-accent colour. Never outline:none without a replacement.
- Icons: Lucide only. Inherit currentColor + stroke-width 2. Sizes 16/20/24px. NO emoji as icons.
- Images: object-contain everywhere. Only full-bleed hero banners with gradient overlay use object-cover.
- Colour: read from brand.* tokens or the active designTokenRegistry set. ZERO hard-coded hex.
- Motion: skeletons match final dimensions. No spinners except <200ms micro-actions. No layout shift on hover.
- Voice: UK trades-native. NO "premium", "curated", "boutique", "elevated", "solutions", "empowering". YES to real UK trade language.
- Realistic UK data everywhere. NEVER lorem ipsum, NEVER stock filler copy.
`.trim();

const CUSTOMER_FACING_RULES = `
DESIGN CONSTITUTION — customer-facing merchant profile (World A):
- Bar is Linear × Stripe × Loveable. Boutique-agency polish.
- Full-bleed hero: full-width, ≥60vh desktop, real photography, gradient overlay for text contrast.
- Radius: rounded-lg (8px) on cards/buttons/inputs. rounded-full on pills/avatars. Sharp 2px reserved for status badges.
- Elevation: soft shadows (elevation md/lg) welcome on hero cards, floating CTAs, modals. Borders for supporting cards.
- Whitespace: generous — p-6/p-8 on hero cards, gap-6/gap-8 between sections. NEVER the operations gap-4.
`.trim();

const OPERATIONS_RULES = `
DESIGN CONSTITUTION — operations dashboard (World B — Industrial Pro):
- Fixed sidebar w-60 (240px), charcoal surface (#1A1C1E or brand.surface.900 token).
- Main canvas: 12-column grid, gap-4 EXCLUSIVELY. Never gap-6+.
- Sticky header h-14 (56px), white surface, subtle bottom-border, global search / command palette.
- Cards: bg-white, rounded-lg (NOT rounded-sm — fails Linear standard), border-gray-200/80, p-4. BORDERS over shadows.
- Buttons: primary = filled safety-orange (#E87500), secondary = bordered dark. Min 44px height on touchable primary.
- Tables: dense mode, row height 44px min (36px OK for read-only desktop), 13px cell text floor, striped rows even:bg-gray-50/50.
- Status pills: rounded-sm (2px), px-2 py-0.5, 11px UPPERCASE, tracking-wider, weight 700. Green=live, orange=pending/low, red=fail.
- Physical indicators (filled dot ⬤ + text), NOT colour-only.
- F-pattern: top-left holds the single most critical metric. Secondary data centre-right. Tables below the fold.
- Above-the-fold at 1440×900 renders the primary decision surface without scroll.
`.trim();

/** Compose the enforcement block for a given world. Returns a single
 *  string appended to the composer's system prompt. */
export function designConstitutionFor(world: DesignWorld): string {
  const worldRules =
    world === "operations" ? OPERATIONS_RULES : CUSTOMER_FACING_RULES;
  return `${UNIVERSAL_DESIGN_RULES}\n\n${worldRules}`;
}

/** Detect the world from the path being composed. Falls back to
 *  customer-facing (the default merchant profile flow). */
export function detectWorldFromPath(path: string | undefined | null): DesignWorld {
  if (!path) return "customer-facing";
  const p = path.toLowerCase();
  if (
    p.startsWith("/studio") ||
    p.startsWith("/dashboard") ||
    p.startsWith("/os") ||
    p.includes("/admin")
  ) {
    return "operations";
  }
  return "customer-facing";
}
