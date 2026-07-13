// Metadata sidecar for trust_bar.icon_row_1. Server-safe registration so the AI routes can see this section (task #41 fix).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { IconRowSection } from "./iconRow";

type Config = {
  eyebrow: string;
  item1Icon: string;
  item1Label: string;
  item2Icon: string;
  item2Label: string;
  item3Icon: string;
  item3Label: string;
  item4Icon: string;
  item4Label: string;
  /** When true, pulls trust items from the Knowledge Graph — the
   *  package's compliance elements filtered by credentialScheme
   *  (Gas Safe / NICEIC / TrustMark / etc.). */
  useKnowledgeGraph: boolean;
  surface: "light" | "dark" | "tinted";
};

// Inlined from iconRow.tsx — "use client" non-component exports become
// opaque proxies on the server, so we recreate the icon-key list here.
const ICON_KEYS = [
  "shield",
  "badge",
  "star",
  "pin",
  "award",
  "wrench",
  "bolt",
  "clock",
  "users"
];

const registration: SectionRegistration<Config> = {
  id: "trust_bar.icon_row_1",
  name: "Trust bar · icon row",
  version: "2.0.0",
  library: "trust_bar",
  description:
    "Thin trust bar with 3-4 credential icons + short labels. Sits between the hero and services. Icons from the platform Lucide set; Framer Motion Reveal entrance; theme-aware surface (light / tinted / dark).",
  editableFields: [
    { key: "eyebrow", label: "Small eyebrow (optional)", type: { kind: "text", maxLength: 40 }, default: "", priority: "text", role: "eyebrow", description: "Optional label above the icon row.", group: "Copy" },
    { key: "useKnowledgeGraph", label: "Pull credentials from Knowledge Graph", type: { kind: "boolean" }, default: false, description: "When ON, ignores the 4 items below and shows the mandatory credential schemes for this trade (Gas Safe / NICEIC / TrustMark / etc.).", group: "Data source" },
    { key: "item1Icon", label: "Item 1 icon", type: { kind: "select", options: ICON_KEYS.map((v) => ({ value: v, label: v })) }, default: "shield", group: "Item 1" },
    { key: "item1Label", label: "Item 1 label", type: { kind: "text", maxLength: 30 }, default: "Gas Safe Registered", priority: "text", group: "Item 1" },
    { key: "item2Icon", label: "Item 2 icon", type: { kind: "select", options: ICON_KEYS.map((v) => ({ value: v, label: v })) }, default: "badge", group: "Item 2" },
    { key: "item2Label", label: "Item 2 label", type: { kind: "text", maxLength: 30 }, default: "NICEIC Approved", priority: "text", group: "Item 2" },
    { key: "item3Icon", label: "Item 3 icon", type: { kind: "select", options: ICON_KEYS.map((v) => ({ value: v, label: v })) }, default: "star", group: "Item 3" },
    { key: "item3Label", label: "Item 3 label", type: { kind: "text", maxLength: 30 }, default: "5.0 · 1000+ Reviews", priority: "text", group: "Item 3" },
    { key: "item4Icon", label: "Item 4 icon", type: { kind: "select", options: ICON_KEYS.map((v) => ({ value: v, label: v })) }, default: "pin", group: "Item 4" },
    { key: "item4Label", label: "Item 4 label", type: { kind: "text", maxLength: 30 }, default: "Local Experts", priority: "text", group: "Item 4" },
    {
      key: "surface",
      role: "surface_mode",
      label: "Surface",
      type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "tinted", label: "Tinted" }, { value: "dark", label: "Dark" }] },
      default: "tinted",
      group: "Layout"
    }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A thin trust bar with icon + label items. Explain why this pattern builds credibility in 3 bullets.",
    improve: "Improve labels to be shorter and higher-impact. Return only patched fields.",
    rewrite: "Rewrite the 4 labels in a {tone} voice.",
    suggestAlternative: "Suggest one alternative section for below the hero when trust markers aren't the main story.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: false, socialProofRecommended: true },
    seo: { headingLevel: 3 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent"] }
  },
  telemetryTags: ["trust_bar", "icons", "compact", "shadcn", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "hvac-contractor", "roofer", "landscaper", "extension-builder"],

  // ─── Slice D extended manifest ──────────────────────────────────
  category: "trust",
  supportedThemes: ["all"],
  supportedIndustries: ["all"],
  responsiveBehaviour: {
    mobile: "carousel",
    tablet: "grid_4",
    desktop: "grid_4"
  },
  imagePlaceholders: [],
  lucideIconsUsed: ["ShieldCheck", "BadgeCheck", "Star", "MapPin", "Award", "Wrench", "Zap", "Clock", "Users"],
  ctaArea: {
    hasPrimary: false,
    hasSecondary: false
  },
  accessibilityNotes: [
    "Icons are aria-hidden — the visible label is the accessible name",
    "Horizontal-scroll on mobile uses no scrollbar — visual affordance only, keyboard users tab through labels",
    "Uppercase label styling is purely visual — semantic case preserved for screen readers"
  ],

  defaultConfig: () => ({
    eyebrow: "",
    useKnowledgeGraph: true,
    // Fallback content — used only when Knowledge Graph pull is off AND
    // the merchant hasn't authored their own credentials.
    item1Icon: "shield",
    item1Label: "",
    item2Icon: "badge",
    item2Label: "",
    item3Icon: "star",
    item3Label: "",
    item4Icon: "pin",
    item4Label: "",
    surface: "tinted"
  }),
  renderer: IconRowSection
};

sectionRegistry.register(registration);
