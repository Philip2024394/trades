// Metadata sidecar for hero.emergency_247_1. Server-safe registration so the
// AI routes can see this section (task #41 fix).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { Emergency247Hero } from "./emergency247";

type VisualEffect = "none" | "grid";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  callPhoneNumber: string;
  callCtaLabel: string;
  whatsappCtaLabel: string;
  responseTime: string;
  responseTimeLabel: string;
  coverageArea: string;
  urgencyAccent: "red" | "orange" | "yellow";
  visualEffect: VisualEffect;
};

const registration: SectionRegistration<Config> = {
  id: "hero.emergency_247_1",
  name: "24/7 Emergency Hero",
  version: "3.0.0",
  library: "hero",
  description:
    "High-conversion hero for reactive trades. Massive Call Now button (60px tall), pulsing response-time chip, dark surface with urgent-colour glow. shadcn Button + Framer Motion. Optimised for panicking 2am customers.",
  editableFields: [
    { key: "eyebrow", label: "Small eyebrow", type: { kind: "text", maxLength: 40 }, default: "24/7 · No callout fee", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 80 }, default: "Emergency? We're on it.", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 180, multiline: true }, default: "Any hour, any day, across the region. Fully insured, £5M public liability, no fix no fee.", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "callPhoneNumber", label: "Phone number", type: { kind: "text", maxLength: 20 }, default: "0800 000 0000", priority: "text", role: "cta_call", group: "Actions" },
    { key: "callCtaLabel", label: "Call button label", type: { kind: "text", maxLength: 20 }, default: "Call Now", priority: "button", group: "Actions" },
    { key: "whatsappCtaLabel", label: "WhatsApp label", type: { kind: "text", maxLength: 20 }, default: "WhatsApp", priority: "button", role: "cta_whatsapp", group: "Actions" },
    { key: "responseTime", label: "Response time value", type: { kind: "text", maxLength: 30 }, default: "45 min", priority: "text", group: "Trust" },
    { key: "responseTimeLabel", label: "Response time label", type: { kind: "text", maxLength: 30 }, default: "AVG RESPONSE", priority: "text", group: "Trust" },
    { key: "coverageArea", label: "Coverage area", type: { kind: "text", maxLength: 60 }, default: "Serving all of Greater Manchester", priority: "text", role: "location_label", group: "Trust" },
    { key: "urgencyAccent", label: "Urgency colour", type: { kind: "select", options: [{ value: "red", label: "Red" }, { value: "orange", label: "Orange" }, { value: "yellow", label: "Yellow" }] }, default: "red", group: "Style" },
    { key: "visualEffect", label: "Background effect", type: { kind: "select", options: [{ value: "grid", label: "Grid pattern (default)" }, { value: "none", label: "None" }] }, default: "grid", description: "Subtle Magic UI grid layered under the urgency glow.", group: "Style" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A 24/7 emergency hero. Explain why panicking-user optimisation matters.",
    improve: "Tighten headline + subhead — under 6 words. Return patched fields only.",
    rewrite: "Rewrite copy in a {tone} voice — urgent-calm blend.",
    suggestAlternative: "Suggest an alternative when the trade isn't emergency-first.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 0 }, accessibility: { contrastMin: 4.5 }, sales: { primaryActionRequired: true, ctaAboveFold: true }, seo: { headingLevel: 1 }, mobile: { minTapTargetPx: 60 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["hero", "emergency", "24_7", "urgency", "shadcn", "framer_motion"],
  bestForVerticals: ["emergency-roofing", "plumber-emergency", "locksmith", "boiler-repair", "electrician-emergency", "recovery-service"],
  defaultConfig: () => ({
    eyebrow: "24/7 · No callout fee",
    heading: "Emergency? We're on it.",
    subheading: "Any hour, any day, across the region. Fully insured, £5M public liability, no fix no fee.",
    callPhoneNumber: "0800 000 0000",
    callCtaLabel: "Call Now",
    whatsappCtaLabel: "WhatsApp",
    responseTime: "45 min",
    responseTimeLabel: "AVG RESPONSE",
    coverageArea: "Serving all of Greater Manchester",
    urgencyAccent: "red",
    visualEffect: "grid"
  }),
  renderer: Emergency247Hero
};

sectionRegistry.register(registration);
