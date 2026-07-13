// Metadata sidecar for hero.trust_minimal_1. Server-safe registration so
// the AI routes can see this section (task #41 fix).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { TrustMinimalHero } from "./trustMinimal";

/** Optional Magic UI background layer. "grid" is the new default —
 *  a subtle line pattern that gives the section Linear/Stripe-tier
 *  depth without competing with the copy. "aurora" is the animated
 *  gradient variant for premium industries. "none" restores the flat
 *  v2.0.0 look. */
type VisualEffect = "none" | "grid" | "aurora";

type Config = {
  trustLabel: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  responseCommitment: string;
  visualEffect: VisualEffect;
  surface: "light" | "dark";
};

const registration: SectionRegistration<Config> = {
  id: "hero.trust_minimal_1",
  name: "Trust-first minimal hero",
  version: "2.0.0",
  library: "hero",
  description:
    "Clean centred hero on shadcn/ui + Framer Motion foundation. Trust chip at the top, big display headline, subhead, stacked dual CTA. Choreographed entrance animations respect prefers-reduced-motion. Accent from merchant theme token. Built for service-trust trades.",
  editableFields: [
    { key: "trustLabel", label: "Trust chip label", type: { kind: "text", maxLength: 40 }, default: "TRUSTED & CERTIFIED", priority: "text", role: "eyebrow", description: "Small chip at the top of the hero — creates immediate credibility.", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120, multiline: true }, default: "Your Trusted Electrical Experts", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Supporting line", type: { kind: "text", maxLength: 200, multiline: true }, default: "Safe. Certified. Reliable. Serving your home and business.", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 24 }, default: "Get a Free Quote", priority: "button", role: "primary_action_label", group: "CTAs" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "#quote", role: "primary_action_href", description: 'Type "#whatsapp" for WhatsApp, "tel:0…" for a phone.', group: "CTAs" },
    { key: "secondaryCtaLabel", label: "Secondary CTA label", type: { kind: "text", maxLength: 24 }, default: "View Services", priority: "button", role: "secondary_action_label", group: "CTAs" },
    { key: "secondaryCtaHref", label: "Secondary CTA link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "/services", role: "secondary_action_href", group: "CTAs" },
    { key: "responseCommitment", label: "Response commitment", type: { kind: "text", maxLength: 60 }, default: "Reply within 1hr · Mon-Sat", priority: "text", aiPromptable: true, group: "CTAs" },
    { key: "visualEffect", label: "Background effect", type: { kind: "select", options: [{ value: "grid", label: "Grid pattern (default)" }, { value: "aurora", label: "Aurora (animated gradient)" }, { value: "none", label: "None (flat)" }] }, default: "grid", description: "Magic UI background layer. Grid gives Linear/Stripe depth; Aurora is a slow animated gradient for premium industries.", group: "Layout" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }, default: "light", group: "Layout" }
  ],
  animations: ["none", "fade-in", "slide-up"],
  aiPrompts: {
    explain: "A trust-first minimal hero. Explain in 3 bullets why this pattern converts for service trades and 2 bullets on when it wouldn't fit.",
    improve: "Improve this hero WITHOUT changing the layout. Headline max 6 words. Sub-line max 15 words. CTAs verb-first. Return only patched fields.",
    rewrite: "Rewrite the trust chip, headline, and sub-line in a {tone} voice. Tone options: 'trade-plain', 'reassuring', 'premium'. Preserve field lengths within 10 percent.",
    suggestAlternative: "Suggest one alternative hero from library='hero' that fits a merchant whose value is their portfolio rather than their credentials.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { ctaAboveFold: true, primaryActionRequired: true },
    seo: { headingLevel: 1 },
    mobile: { minTapTargetPx: 48, noHorizontalScroll: true },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: [
    "hero",
    "minimal",
    "centred",
    "trust_first",
    "no_photo",
    "dual_cta",
    "mobile_perfect",
    "shadcn",
    "framer_motion"
  ],
  bestForVerticals: [
    "electrician",
    "plumber",
    "gas-engineer",
    "heating-engineer",
    "hvac-contractor",
    "locksmith",
    "handyman",
    "chimney-sweep"
  ],

  // ─── Slice D extended manifest ──────────────────────────────────
  category: "hero",
  supportedThemes: ["modern", "corporate", "minimal", "creative"],
  supportedIndustries: [
    "electrician",
    "plumber",
    "gas-engineer",
    "heating-engineer",
    "hvac-contractor",
    "locksmith",
    "handyman",
    "chimney-sweep"
  ],
  responsiveBehaviour: {
    mobile: "stack",
    tablet: "stack",
    desktop: "grid_2"
  },
  imagePlaceholders: [],
  lucideIconsUsed: ["ArrowRight", "Clock"],
  ctaArea: {
    hasPrimary: true,
    hasSecondary: true,
    isSticky: false
  },
  accessibilityNotes: [
    "H1 headline is the section's primary landmark",
    "44px+ tap targets on both CTAs (h-14 → 56px)",
    "Icons carry aria-hidden — labels convey meaning",
    "Framer Motion Reveal respects prefers-reduced-motion"
  ],

  defaultConfig: () => ({
    trustLabel: "TRUSTED & CERTIFIED",
    heading: "Your Trusted Electrical Experts",
    subheading: "Safe. Certified. Reliable. Serving your home and business.",
    primaryCtaLabel: "Get a Free Quote",
    primaryCtaHref: "#quote",
    secondaryCtaLabel: "View Services",
    secondaryCtaHref: "/services",
    responseCommitment: "Reply within 1hr · Mon-Sat",
    visualEffect: "grid",
    surface: "light"
  }),
  renderer: TrustMinimalHero
};

sectionRegistry.register(registration);
