// Metadata sidecar for hero.trust_anchor_1. Server-safe registration so
// the AI routes can see this section (task #41 fix).
//
// The sibling `trustAnchor.tsx` is a "use client" module because the
// renderer uses client-side React features. Next.js does NOT run the
// module-level `sectionRegistry.register()` side effect on the server
// when a "use client" module is imported from an RSC / API route — so
// the server-side catalog was missing this section, and the AI router
// couldn't propose it.
//
// This file is NOT "use client", so its top-level register() call runs
// on BOTH the server (populating the API-route registry) AND the client
// (populating the editor registry). The renderer is imported from the
// sibling .tsx: on the server it becomes a client-component reference
// (never called), on the client it's the real component.

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { TrustAnchorHero } from "./trustAnchor";

type VisualEffect = "none" | "grid";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  backgroundImageUrl: string;
  ratingValue: number;
  ratingReviewCount: number;
  ratingLabel: string;
  badge1: string;
  badge2: string;
  badge3: string;
  badge4: string;
  verifiedSchemes: string[];
  responseCommitment: string;
  visualEffect: VisualEffect;
  surface: "dark" | "light";
};

const registration: SectionRegistration<Config> = {
  id: "hero.trust_anchor_1",
  name: "Trust Anchor Hero",
  version: "3.0.0",
  library: "hero",
  description:
    "Full-bleed photography hero with editorial 2-col + floating glass trust card on shadcn Card + Framer Motion. Mobile: banner-shaped stack. Desktop: 1600×800 banner with rating card. Best for trust-forward trades.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Verified & insured", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Headline", type: { kind: "text", maxLength: 120 }, default: "The trade your neighbours already trust.", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 240, multiline: true }, default: "127 five-star reviews, fully insured, Gas Safe registered. Same-day quotes over WhatsApp.", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "backgroundImageUrl", role: "background_media", label: "Hero photo", type: { kind: "image" }, default: "", description: "Full-bleed background photograph.", group: "Media" },
    { key: "primaryCtaLabel", role: "primary_action_label", label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "WhatsApp quote", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href", label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", role: "secondary_action_label", label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "See our work", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", role: "secondary_action_href", label: "Secondary CTA link", type: { kind: "link" }, default: "#projects", group: "CTAs" },
    { key: "responseCommitment", label: "Response commitment", type: { kind: "text", maxLength: 60 }, default: "Reply within 1hr · Mon-Sat", priority: "text", aiPromptable: true, group: "CTAs" },
    { key: "ratingValue", role: "rating_value", label: "Star rating", type: { kind: "number", min: 0, max: 5, step: 0.1 }, default: 4.9, group: "Trust card" },
    { key: "ratingReviewCount", label: "Review count", type: { kind: "number", min: 0, max: 999999, step: 1 }, default: 127, group: "Trust card" },
    { key: "ratingLabel", label: "Rating eyebrow", type: { kind: "text", maxLength: 40 }, default: "Google + Xrated rating", group: "Trust card" },
    { key: "badge1", label: "Badge 1 (free text)", type: { kind: "text", maxLength: 30 }, default: "", group: "Badges" },
    { key: "badge2", label: "Badge 2 (free text)", type: { kind: "text", maxLength: 30 }, default: "", group: "Badges" },
    { key: "badge3", label: "Badge 3 (free text)", type: { kind: "text", maxLength: 30 }, default: "", group: "Badges" },
    { key: "badge4", label: "Badge 4 (free text)", type: { kind: "text", maxLength: 30 }, default: "", group: "Badges" },
    { key: "verifiedSchemes", label: "Verified badges (auto-render when held)", type: { kind: "text", maxLength: 240 }, default: "", group: "Badges" },
    { key: "visualEffect", label: "Background effect", type: { kind: "select", options: [{ value: "grid", label: "Grid pattern (default)" }, { value: "none", label: "None" }] }, default: "grid", description: "Subtle Magic UI grid layered over the photo overlay for a designed feel.", group: "Layout" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }] }, default: "dark", group: "Layout" }
  ],
  animations: ["none", "fade-in", "slide-up"],
  aiPrompts: {
    explain: "Full-bleed photography trust hero with rating card. Explain when it beats trust_minimal.",
    improve: "Tighten the sub-line + headline. Return patched fields only.",
    rewrite: "Rewrite headline + subhead in a {tone} voice.",
    suggestAlternative: "Suggest an alternative for merchants without high-quality photography.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  telemetryTags: ["hero", "trust", "reviews", "full-bleed", "editorial", "shadcn", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "roofer", "boiler-installer", "kitchen-fitter"],

  // ─── Slice D extended manifest ──────────────────────────────────
  category: "hero",
  supportedThemes: ["modern", "corporate", "luxury"],
  supportedIndustries: [
    "electrician",
    "plumber",
    "gas-engineer",
    "roofer",
    "boiler-installer",
    "kitchen-fitter",
    "bathroom-fitter"
  ],
  responsiveBehaviour: {
    mobile: "stack",
    tablet: "stack",
    desktop: "split_60_40"
  },
  imagePlaceholders: [
    {
      configKey: "backgroundImageUrl",
      purpose: "hero",
      orientation: "landscape",
      recommendedWidthPx: 2400,
      recommendedAspect: "16/9"
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
    "Background photo carries aria-hidden — overlay ensures 4.5:1 contrast on text",
    "Floating trust card uses Card primitive with proper role",
    "Star row is aria-hidden — the numeric rating carries the accessible value",
    "Framer Motion staggered entrance respects prefers-reduced-motion"
  ],

  defaultConfig: () => ({
    eyebrow: "Verified & insured",
    heading: "The trade your neighbours already trust.",
    subheading: "127 five-star reviews, fully insured, Gas Safe registered. Same-day quotes over WhatsApp.",
    backgroundImageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2001_57_56%20PM.png",
    primaryCtaLabel: "WhatsApp quote",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "See our work",
    secondaryCtaHref: "#projects",
    responseCommitment: "Reply within 1hr · Mon-Sat",
    ratingValue: 4.9,
    ratingReviewCount: 127,
    ratingLabel: "Google + Xrated rating",
    badge1: "",
    badge2: "",
    badge3: "",
    badge4: "£5m insured",
    verifiedSchemes: ["gas-safe", "niceic", "trustmark"],
    visualEffect: "grid",
    surface: "dark"
  }),
  renderer: TrustAnchorHero
};

sectionRegistry.register(registration);
