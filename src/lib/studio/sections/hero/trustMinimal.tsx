// hero.trust_minimal_1 — Phase 1 rebuild on shadcn/ui + Framer Motion.
//
// Same visual pattern as v1 (Trusted & Certified chip → display headline
// → subhead → stacked dual CTA → response line) but now built on:
//   • shadcn/ui Button + Badge primitives (typography scale + focus
//     rings + accessible states out of the box)
//   • Framer Motion Reveal / RevealStack for choreographed entrances
//     with prefers-reduced-motion respect
//   • Platform typography scale (display-md / body-md / eyebrow) —
//     never hard-coded pixel sizes
//   • cn() for deterministic class merging + easier subclass overrides
//
// Version bumped to 2.0.0. Config schema unchanged so the 5 blueprints
// wiring this hero keep working.

"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { GridPattern } from "@/components/magicui/grid-pattern";
import { AuroraBackground } from "@/components/magicui/aurora-background";
import { cn } from "@/lib/utils";

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

function TrustMinimalHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  // Merchant-scoped accent still comes from studio_brand_tokens so the
  // theme colour picker flows through even though the shadcn semantic
  // ring/primary is a platform default. Where the primary CTA renders
  // we override to accent so per-brand colour wins.
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";
  const visualEffect: VisualEffect =
    config.visualEffect === "aurora" || config.visualEffect === "none"
      ? config.visualEffect
      : "grid";

  // Defensive fallbacks.
  // trustLabel is kept in the type + editable fields for backwards
  // compat (blueprints seeded it) but is no longer rendered — the
  // headline + subhead carry the trust signal on their own.
  const heading =
    (typeof config.heading === "string" && config.heading) ||
    "Your headline here.";
  const subheading =
    typeof config.subheading === "string" ? config.subheading : "";
  const responseCommitment =
    typeof config.responseCommitment === "string"
      ? config.responseCommitment
      : "";

  // Assembly-runtime overrides.
  const assemblyPrimary =
    data.assemblyCtaBySlot?.["home.primary-cta"] ?? null;
  const assemblySecondary =
    data.assemblyCtaBySlot?.["home.secondary-cta"] ?? null;
  const primaryLabel = assemblyPrimary?.label ?? config.primaryCtaLabel;
  const primaryHref = assemblyPrimary
    ? assemblyPrimary.href
    : config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryLabel =
    assemblySecondary?.label ?? config.secondaryCtaLabel;
  const secondaryHref = assemblySecondary
    ? assemblySecondary.href
    : config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  return (
    <section
      className={cn(
        // overflow-x-clip is stronger than overflow-hidden — even margin
        // transforms + Framer Motion animations can't push content
        // beyond the section width. Prevents any horizontal scroll on
        // narrow viewports.
        "relative isolate w-full overflow-x-clip overflow-y-visible",
        isDark ? "bg-foreground text-background" : "bg-background text-foreground"
      )}
      {...sectionRootAttrs(
        instanceId,
        "hero.trust_minimal_1",
        "Trust-first minimal hero"
      )}
    >
      {/* ─── Magic UI premium background layer ─────────────────────
          Sits behind the radial glow so the ambient light still
          reads. Grid = engineered/precision feel (trades). Aurora =
          animated gradient (premium industries). Users flip via the
          visualEffect config field. */}
      {visualEffect === "grid" && (
        <GridPattern
          size={48}
          strokeWidth={1}
          className={cn(
            "-z-20",
            isDark ? "text-white/[0.06]" : "text-neutral-900/[0.06]"
          )}
        />
      )}
      {visualEffect === "aurora" && (
        <AuroraBackground accent={accent} className="-z-20" />
      )}

      {/* Ambient radial glow behind the headline — subtle premium
          depth like Linear/Vercel. Colour follows the merchant accent. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${accent}18 0%, transparent 55%)`
        }}
      />

      {/* Banner-shaped hero — 1600×800 (2:1) proportions on desktop,
          compact on mobile. Content vertically centred inside the
          banner box regardless of exact height. Trust chip removed:
          the badge added visual clutter without adding trust that the
          headline + subhead don't already carry. */}
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-14 lg:max-h-[800px] lg:min-h-[600px] lg:max-w-3xl lg:py-16">
        <Reveal>
          <h1
            className={cn(
              "font-heading text-display-md font-extrabold sm:text-display-lg lg:text-display-xl"
            )}
            {...treeAttrs(instanceId, "heading", "Main headline", "text")}
          >
            {heading}
          </h1>
        </Reveal>

        {subheading && (
          <Reveal delay={0.08}>
            <p
              className="mt-4 max-w-lg text-body-md text-muted-foreground sm:mt-5 sm:text-body-lg"
              {...treeAttrs(
                instanceId,
                "subheading",
                "Supporting line",
                "text"
              )}
            >
              {subheading}
            </p>
          </Reveal>
        )}

        <Reveal delay={0.16}>
          <div className="mx-auto mt-7 flex max-w-[300px] flex-col gap-2.5 sm:mt-9 sm:max-w-md sm:flex-row sm:gap-3">
            {primaryLabel && (
              <Button
                asChild
                size="xl"
                className="group w-full flex-1"
                style={{
                  background: accent,
                  color: "#0A0A0A",
                  boxShadow: `0 8px 24px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.5)`
                }}
              >
                <Link
                  href={primaryHref || "#"}
                  {...treeAttrs(
                    instanceId,
                    "primaryCtaLabel",
                    "Primary CTA",
                    "button"
                  )}
                >
                  <span>{primaryLabel}</span>
                  <ArrowRight
                    strokeWidth={2.5}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            )}
            {secondaryLabel && (
              <Button
                asChild
                variant="accentGhost"
                size="xl"
                className="w-full flex-1"
                style={{
                  borderColor: accent,
                  color: isDark ? "#FFFFFF" : accent
                }}
              >
                <Link
                  href={secondaryHref || "#"}
                  {...treeAttrs(
                    instanceId,
                    "secondaryCtaLabel",
                    "Secondary CTA",
                    "button"
                  )}
                >
                  {secondaryLabel}
                </Link>
              </Button>
            )}
          </div>
        </Reveal>

        {responseCommitment && (
          <Reveal delay={0.24}>
            <div
              className="mt-5 inline-flex items-center gap-1.5 text-caption font-bold uppercase text-muted-foreground sm:mt-6"
              {...treeAttrs(
                instanceId,
                "responseCommitment",
                "Response commitment",
                "text"
              )}
            >
              <Clock size={11} strokeWidth={2.5} />
              {responseCommitment}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

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
