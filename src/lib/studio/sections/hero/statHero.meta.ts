// Metadata sidecar for hero.stat_hero_1. Server-safe registration so the AI routes can see this section (task #41 fix).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { StatHero } from "./statHero";

type VisualEffect = "none" | "grid" | "aurora";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  responseCommitment: string;
  stat1Value: string; stat1Label: string;
  stat2Value: string; stat2Label: string;
  stat3Value: string; stat3Label: string;
  visualEffect: VisualEffect;
  surface: "light" | "dark";
};

const registration: SectionRegistration<Config> = {
  id: "hero.stat_hero_1",
  name: "Stat-anchor hero",
  version: "3.0.0",
  library: "hero",
  description:
    "Data-forward hero anchored by 3 big stats (jobs / rating / years). Display headline below, dual CTA. shadcn Button + Framer Motion staggered entrance. Banner proportions on desktop. Best for merchants whose story is scale + longevity.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 40 }, default: "Trusted for 12 years", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120, multiline: true }, default: "The numbers do the talking.", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Supporting line", type: { kind: "text", maxLength: 200, multiline: true }, default: "Local, fully insured, guaranteed. Every job traceable back to a real customer.", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 24 }, default: "Get a Quote", priority: "button", role: "primary_action_label", group: "CTAs" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link" }, default: "#quote", role: "primary_action_href", group: "CTAs" },
    { key: "secondaryCtaLabel", label: "Secondary CTA label", type: { kind: "text", maxLength: 24 }, default: "See our work", priority: "button", role: "secondary_action_label", group: "CTAs" },
    { key: "secondaryCtaHref", label: "Secondary CTA link", type: { kind: "link" }, default: "/portfolio", role: "secondary_action_href", group: "CTAs" },
    { key: "responseCommitment", label: "Response commitment", type: { kind: "text", maxLength: 60 }, default: "Reply within 1hr · Mon-Sat", priority: "text", group: "CTAs" },
    { key: "stat1Value", label: "Stat 1 value", type: { kind: "text", maxLength: 10 }, default: "500+", priority: "text", role: "stat_value", group: "Stats" },
    { key: "stat1Label", label: "Stat 1 label", type: { kind: "text", maxLength: 30 }, default: "Jobs completed", priority: "text", role: "stat_label", group: "Stats" },
    { key: "stat2Value", label: "Stat 2 value", type: { kind: "text", maxLength: 10 }, default: "4.9★", priority: "text", role: "stat_value", group: "Stats" },
    { key: "stat2Label", label: "Stat 2 label", type: { kind: "text", maxLength: 30 }, default: "380+ reviews", priority: "text", role: "stat_label", group: "Stats" },
    { key: "stat3Value", label: "Stat 3 value", type: { kind: "text", maxLength: 10 }, default: "12yr", priority: "text", role: "stat_value", group: "Stats" },
    { key: "stat3Label", label: "Stat 3 label", type: { kind: "text", maxLength: 30 }, default: "In business", priority: "text", role: "stat_label", group: "Stats" },
    { key: "visualEffect", label: "Background effect", type: { kind: "select", options: [{ value: "grid", label: "Grid pattern (default)" }, { value: "aurora", label: "Aurora (animated gradient)" }, { value: "none", label: "None (flat)" }] }, default: "grid", description: "Magic UI background layer.", group: "Layout" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }, default: "light", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A stat-anchor hero. Explain when data-forward beats trust-forward.",
    improve: "Tighten headline + subhead. Return patched fields only.",
    rewrite: "Rewrite headline + subhead in a {tone} voice.",
    suggestAlternative: "Suggest an alternative for merchants without stats to boast.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 0 }, accessibility: { contrastMin: 4.5 }, sales: { primaryActionRequired: true, socialProofRecommended: true }, seo: { headingLevel: 1 }, mobile: { minTapTargetPx: 48 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["hero", "stats", "data_forward", "shadcn", "framer_motion"],
  bestForVerticals: ["extension-builder", "landscaper", "roofer", "commercial-roofing", "structural-engineer", "chartered-surveyor"],
  defaultConfig: () => ({
    eyebrow: "Trusted for 12 years",
    heading: "The numbers do the talking.",
    subheading: "Local, fully insured, guaranteed. Every job traceable back to a real customer.",
    primaryCtaLabel: "Get a Quote",
    primaryCtaHref: "#quote",
    secondaryCtaLabel: "See our work",
    secondaryCtaHref: "/portfolio",
    responseCommitment: "Reply within 1hr · Mon-Sat",
    stat1Value: "500+", stat1Label: "Jobs completed",
    stat2Value: "4.9★", stat2Label: "380+ reviews",
    stat3Value: "12yr", stat3Label: "In business",
    visualEffect: "grid",
    surface: "light"
  }),
  renderer: StatHero
};

sectionRegistry.register(registration);
