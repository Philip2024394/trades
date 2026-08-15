// Metadata sidecar for hero.split_photo_left_1. Server-safe registration
// (Phase 19D · Philip 2026-08-14).
//
// See productShowroom.meta.ts for the full explanation of the pattern.
// Short version: the sibling `splitPhotoLeft.tsx` is "use client" —
// its module-scope register() call never runs on the server. Without
// this sidecar, SSR falls back to library-fallback and silently renders
// a different hero than the standalone-tsx pipeline chose.

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { SplitPhotoLeftHero } from "./splitPhotoLeft";

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
  imageUrl: string;
  imageAlt: string;
  ratingText: string;
  showRating: boolean;
  verifiedSchemes: string[];
  visualEffect: VisualEffect;
  surface: "light" | "dark";
};

const registration: SectionRegistration<Config> = {
  id: "hero.split_photo_left_1",
  name: "Split photo hero",
  version: "3.0.0",
  library: "hero",
  description:
    "Full-bleed 50/50 editorial split on shadcn foundation. Photo left edge-to-edge on desktop; mobile: photo banner + tight content card + bottom CTA stack. Banner proportions (1600×800). Framer Motion staggered entrance.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Since 1998", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120, multiline: true }, default: "The work speaks. The photos prove it.", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Supporting line", type: { kind: "text", maxLength: 240, multiline: true }, default: "Domestic and commercial builds across the region. Every job photographed, referenced, and guaranteed for two years.", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 24 }, default: "See recent work", priority: "button", role: "primary_action_label", group: "CTAs" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "/portfolio", role: "primary_action_href", group: "CTAs" },
    { key: "secondaryCtaLabel", label: "Secondary CTA label", type: { kind: "text", maxLength: 24 }, default: "Get a quote", priority: "button", role: "secondary_action_label", group: "CTAs" },
    { key: "secondaryCtaHref", label: "Secondary CTA link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "#whatsapp", role: "secondary_action_href", group: "CTAs" },
    { key: "responseCommitment", label: "Response commitment", type: { kind: "text", maxLength: 60 }, default: "Reply within 1hr · Mon-Sat", priority: "text", aiPromptable: true, group: "CTAs" },
    { key: "imageUrl", label: "Photo", type: { kind: "image", aspectRatio: "4/3", recommendedWidthPx: 1600 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_03_18%20PM.png", priority: "image", role: "hero_media", group: "Media" },
    { key: "imageAlt", label: "Photo alt text", type: { kind: "text", maxLength: 120 }, default: "Recent job", group: "Media" },
    { key: "showRating", label: "Show star rating", type: { kind: "boolean" }, default: true, group: "Trust" },
    { key: "ratingText", label: "Rating text", type: { kind: "text", maxLength: 80 }, default: "4.9 · 380+ reviews", priority: "text", role: "trust_line", aiPromptable: true, group: "Trust" },
    { key: "verifiedSchemes", label: "Verified badges (auto-render when held)", type: { kind: "text", maxLength: 240 }, default: "", group: "Trust" },
    { key: "visualEffect", label: "Background effect", type: { kind: "select", options: [{ value: "grid", label: "Grid pattern (default)" }, { value: "aurora", label: "Aurora (animated gradient)" }, { value: "none", label: "None (flat)" }] }, default: "grid", description: "Magic UI background layer for the copy column.", group: "Layout" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }, default: "light", group: "Layout" }
  ],
  animations: ["none", "fade", "slide-up"],
  aiPrompts: {
    explain: "A split-photo hero for a UK trades merchant. Explain when this pattern beats trust_minimal in 3 bullets.",
    improve: "Tighten the sub-line + headline. Return patched fields only.",
    rewrite: "Rewrite the headline + sub-line in a {tone} voice.",
    suggestAlternative: "Suggest an alternative hero when the merchant has no strong single-image photo.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: {
    loading: { imageWeightBudgetKb: 480 },
    accessibility: { contrastMin: 4.5, requiredAlt: ["imageUrl"] },
    sales: { ctaAboveFold: true, primaryActionRequired: true, socialProofRecommended: true },
    seo: { headingLevel: 1 },
    mobile: { minTapTargetPx: 48, noHorizontalScroll: true },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: ["hero", "split_layout", "photo_left", "shadcn", "framer_motion", "banner"],
  bestForVerticals: ["landscaping", "joinery", "tiling", "roofing", "kitchen_install", "bathroom_install", "carpentry"],

  category: "hero",
  supportedThemes: ["modern", "creative", "minimal", "luxury"],
  supportedIndustries: [
    "landscaper",
    "landscape-gardener",
    "garden-designer",
    "carpenter",
    "joiner",
    "tiler",
    "roofer",
    "flat-roofing",
    "kitchen-fitter",
    "bathroom-fitter",
    "extension-builder",
    "painter",
    "plasterer"
  ],
  responsiveBehaviour: {
    mobile: "stack",
    tablet: "stack",
    desktop: "split_50_50"
  },
  imagePlaceholders: [
    {
      configKey: "imageUrl",
      purpose: "hero",
      orientation: "landscape",
      recommendedWidthPx: 1600,
      recommendedAspect: "4/3",
      altConfigKey: "imageAlt"
    }
  ],
  lucideIconsUsed: [
    "ArrowRight",
    "BadgeCheck",
    "ShieldCheck",
    "Star",
    "Clock"
  ],
  ctaArea: {
    hasPrimary: true,
    hasSecondary: true,
    isSticky: false
  },
  accessibilityNotes: [
    "Photo has meaningful alt text driven by imageAlt config",
    "Mobile photo banner uses gradient overlay for chip legibility",
    "H1 headline follows semantic order after eyebrow badge",
    "Framer Motion staggered entrance respects prefers-reduced-motion"
  ],

  defaultConfig: () => ({
    eyebrow: "Since 1998",
    heading: "The work speaks. The photos prove it.",
    subheading: "Domestic and commercial builds across the region. Every job photographed, referenced, and guaranteed for two years.",
    primaryCtaLabel: "See recent work",
    primaryCtaHref: "/portfolio",
    secondaryCtaLabel: "Get a quote",
    secondaryCtaHref: "#whatsapp",
    responseCommitment: "Reply within 1hr · Mon-Sat",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_03_18%20PM.png",
    imageAlt: "Recent job",
    ratingText: "4.9 · 380+ reviews",
    showRating: true,
    verifiedSchemes: [],
    visualEffect: "grid",
    surface: "light"
  }),
  renderer: SplitPhotoLeftHero
};

sectionRegistry.register(registration);
