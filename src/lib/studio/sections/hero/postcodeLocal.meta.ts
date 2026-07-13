// Metadata sidecar for hero.postcode_local_1. Server-safe registration so the AI routes can see this section (task #41 fix).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { PostcodeLocalHero } from "./postcodeLocal";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  postcodePlaceholder: string;
  submitLabel: string;
  chip1: string;
  chip2: string;
  chip3: string;
  supportingCopy: string;
  surface: "dark" | "light";
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
};

const registration: SectionRegistration<Config> = {
  id: "hero.postcode_local_1",
  name: "Postcode-Local Hero",
  version: "3.0.0",
  library: "hero",
  description:
    "Search-first hero with big postcode input + 3 trust chips. On submit packages postcode into WhatsApp message. Banner proportions on desktop. Best for coverage-critical local trades.",
  editableFields: [
    { key: "eyebrow", label: "Small eyebrow", type: { kind: "text", maxLength: 40 }, default: "Local & fully insured", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 80 }, default: "Are you in our area?", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Supporting line", type: { kind: "text", maxLength: 180, multiline: true }, default: "Type your postcode to see if we cover you — instant answer, no signup.", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "postcodePlaceholder", label: "Postcode placeholder", type: { kind: "text", maxLength: 40 }, default: "Enter your postcode", group: "Search" },
    { key: "submitLabel", label: "Submit label", type: { kind: "text", maxLength: 20 }, default: "Check coverage", priority: "button", role: "primary_action_label", group: "Search" },
    { key: "chip1", label: "Chip 1 (response time)", type: { kind: "text", maxLength: 30 }, default: "1hr response", priority: "text", group: "Trust chips" },
    { key: "chip2", label: "Chip 2 (insurance)", type: { kind: "text", maxLength: 30 }, default: "£5M insured", priority: "text", group: "Trust chips" },
    { key: "chip3", label: "Chip 3 (years)", type: { kind: "text", maxLength: 30 }, default: "12 years local", priority: "text", group: "Trust chips" },
    { key: "supportingCopy", label: "Supporting copy", type: { kind: "text", maxLength: 120 }, default: "We cover most of the Greater Manchester area. Not sure? Ask.", priority: "text", group: "Copy" },
    { key: "backgroundImageUrl", role: "background_media", label: "Background image (optional)", type: { kind: "image" }, default: "", group: "Media" },
    { key: "backgroundImageOpacity", label: "Background image opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 0.15, group: "Media" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }] }, default: "dark", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A postcode-local search hero. Explain when it beats a static hero.",
    improve: "Tighten headline + chips. Return patched fields only.",
    rewrite: "Rewrite copy in a {tone} voice, preserving structure.",
    suggestAlternative: "Suggest an alternative for national-coverage merchants.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 200 }, accessibility: { contrastMin: 4.5 }, sales: { primaryActionRequired: true, ctaAboveFold: true }, seo: { headingLevel: 1 }, mobile: { minTapTargetPx: 48 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["hero", "postcode", "search", "local", "shadcn", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "mobile-mechanic", "locksmith", "handyman", "cleaner"],
  defaultConfig: () => ({
    eyebrow: "Local & fully insured",
    heading: "Are you in our area?",
    subheading: "Type your postcode to see if we cover you — instant answer, no signup.",
    postcodePlaceholder: "Enter your postcode",
    submitLabel: "Check coverage",
    chip1: "1hr response",
    chip2: "£5M insured",
    chip3: "12 years local",
    supportingCopy: "We cover most of the Greater Manchester area. Not sure? Ask.",
    surface: "dark",
    backgroundImageUrl: "",
    backgroundImageOpacity: 0.15
  }),
  renderer: PostcodeLocalHero
};

sectionRegistry.register(registration);
