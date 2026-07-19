// hero.plant_hire_bold_1 — Phase 3 rebuild on shadcn foundation.
//
// Bold industrial hero for plant hire + heavy-equipment merchants.
// Full-bleed background photo, dark surface, big trust badge line.
// Banner proportions (1600×800). shadcn Button + Badge + Reveal.
// Typography scale. Defensive fallbacks.

"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, MessageCircle } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { GridPattern } from "@/components/magicui/grid-pattern";
import { cn } from "@/lib/utils";

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
  overlayOpacity: number;
  showTrustBadge: boolean;
  trustBadgeText: string;
  visualEffect: VisualEffect;
};

function PlantHireBoldHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const overlay = Math.max(0, Math.min(1, Number(config.overlayOpacity) || 0.6));
  const visualEffect: VisualEffect =
    config.visualEffect === "none" ? "none" : "grid";

  // Defensive fallbacks.
  const eyebrow = typeof config.eyebrow === "string" ? config.eyebrow : "";
  const heading = (typeof config.heading === "string" && config.heading) || "Every machine you need. On site.";
  const subheading = typeof config.subheading === "string" ? config.subheading : "";
  const backgroundImageUrl = typeof config.backgroundImageUrl === "string" ? config.backgroundImageUrl : "";
  const showTrustBadge = config.showTrustBadge !== false;
  const trustBadgeText = typeof config.trustBadgeText === "string" ? config.trustBadgeText : "";

  const assemblyPrimary = data.assemblyCtaBySlot?.["home.primary-cta"] ?? null;
  const assemblySecondary = data.assemblyCtaBySlot?.["home.secondary-cta"] ?? null;
  const primaryLabel = assemblyPrimary?.label ?? config.primaryCtaLabel;
  const primaryHref = assemblyPrimary
    ? assemblyPrimary.href
    : config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryLabel = assemblySecondary?.label ?? config.secondaryCtaLabel;
  const secondaryHref = assemblySecondary
    ? assemblySecondary.href
    : config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  return (
    <section
      className="relative isolate w-full overflow-x-clip bg-neutral-950 text-white"
      {...sectionRootAttrs(instanceId, "hero.plant_hire_bold_1", "Bold trade hero")}
    >
      {backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          {...treeAttrs(instanceId, "backgroundImageUrl", "Background photo", "image")}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,${overlay * 0.6}) 0%, rgba(0,0,0,${overlay}) 100%)`
        }}
      />
      {/* Magic UI grid — engineering-precision layer sits over the
          overlay gradient. Barely visible; contributes depth not noise. */}
      {visualEffect === "grid" && (
        <GridPattern
          size={52}
          strokeWidth={1}
          className="-z-10 text-white/[0.05]"
        />
      )}

      <div className="mx-auto flex w-full max-w-5xl flex-col justify-center px-4 py-14 sm:px-6 sm:py-20 lg:min-h-[600px] lg:max-h-[800px] lg:py-24">
        {eyebrow && (
          <Reveal>
            <p
              className="text-eyebrow font-extrabold uppercase"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
            >
              {eyebrow}
            </p>
          </Reveal>
        )}

        <Reveal delay={0.08}>
          <h1
            className="mt-4 max-w-3xl text-display-md font-extrabold leading-[1.02] sm:mt-6 sm:text-display-lg lg:text-display-xl"
            {...treeAttrs(instanceId, "heading", "Main headline", "text")}
          >
            {heading}
          </h1>
        </Reveal>

        {subheading && (
          <Reveal delay={0.16}>
            <p
              className="mt-4 max-w-2xl text-body-md text-white/70 sm:mt-5 sm:text-body-lg"
              {...treeAttrs(instanceId, "subheading", "Supporting line", "text")}
            >
              {subheading}
            </p>
          </Reveal>
        )}

        <Reveal delay={0.24}>
          <div className="mt-8 flex max-w-md flex-col gap-2.5 sm:flex-row sm:gap-3">
            {primaryLabel && (
              <Button
                asChild
                size="xl"
                className="group w-full"
                style={{
                  background: accent,
                  color: "#0A0A0A",
                  boxShadow: `0 12px 32px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.5)`
                }}
              >
                <Link href={primaryHref || "#"} {...treeAttrs(instanceId, "primaryCtaLabel", "Primary CTA", "button")}>
                  <span>{primaryLabel}</span>
                  <ArrowRight strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </Button>
            )}
            {secondaryLabel && (
              <Button
                asChild
                variant="outline"
                size="xl"
                className="w-full border-white/25 bg-white/5 text-white backdrop-blur-md hover:bg-white/10"
              >
                <Link href={secondaryHref || "#"} {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}>
                  <MessageCircle strokeWidth={2.5} style={{ color: "#166534" }} aria-hidden="true" />
                  {secondaryLabel}
                </Link>
              </Button>
            )}
          </div>
        </Reveal>

        {showTrustBadge && trustBadgeText && (
          <Reveal delay={0.32}>
            <div
              className="mt-6 inline-flex items-center gap-2 text-caption font-bold uppercase text-white/60"
              {...treeAttrs(instanceId, "trustBadgeText", "Trust badge", "text")}
            >
              <ShieldCheck size={12} strokeWidth={2.5} style={{ color: accent }} />
              {trustBadgeText}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.plant_hire_bold_1",
  name: "Bold trade hero",
  version: "3.0.0",
  library: "hero",
  description:
    "Bold industrial hero for plant hire + heavy-equipment merchants. Full-bleed background photo, dark surface, big display headline, dual CTA. Banner proportions on desktop. shadcn Button + Framer Motion.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Plant hire", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120, multiline: true }, default: "Every Machine You Need. On Your Site.", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Supporting line", type: { kind: "text", maxLength: 240, multiline: true }, default: "0.8T micro digger to 14T excavator. CPA-standard machines, 24/7 breakdown line, delivered same day locally.", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 24 }, default: "See the fleet", priority: "button", role: "primary_action_label", group: "CTAs" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "/plant-hire/machines", role: "primary_action_href", group: "CTAs" },
    { key: "secondaryCtaLabel", label: "Secondary CTA label", type: { kind: "text", maxLength: 24 }, default: "WhatsApp quote", priority: "button", role: "secondary_action_label", group: "CTAs" },
    { key: "secondaryCtaHref", label: "Secondary CTA link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "#whatsapp", role: "secondary_action_href", group: "CTAs" },
    { key: "backgroundImageUrl", role: "background_media", label: "Background photo", type: { kind: "image" }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2001_57_56%20PM.png", priority: "image", group: "Media" },
    { key: "overlayOpacity", label: "Overlay opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 0.6, group: "Media" },
    { key: "showTrustBadge", label: "Show trust badge", type: { kind: "boolean" }, default: true, group: "Trust" },
    { key: "trustBadgeText", label: "Trust badge text", type: { kind: "text", maxLength: 100 }, default: "CPA-standard · 24/7 breakdown · Insured", priority: "text", role: "trust_line", aiPromptable: true, group: "Trust" },
    { key: "visualEffect", label: "Background effect", type: { kind: "select", options: [{ value: "grid", label: "Grid pattern (default)" }, { value: "none", label: "None" }] }, default: "grid", description: "Subtle Magic UI grid layered over the photo overlay for engineered depth.", group: "Media" }
  ],
  animations: ["none", "fade-in", "slide-up"],
  aiPrompts: {
    explain: "A bold industrial hero. Explain when it beats trust_anchor.",
    improve: "Tighten headline. Return patched fields only.",
    rewrite: "Rewrite headline + subhead in a {tone} voice.",
    suggestAlternative: "Suggest an alternative for merchants without strong industrial photography.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 480 }, accessibility: { contrastMin: 4.5, requiredAlt: ["backgroundImageUrl"] }, sales: { primaryActionRequired: true, ctaAboveFold: true }, seo: { headingLevel: 1 }, mobile: { minTapTargetPx: 48 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["hero", "bold", "photo", "industrial", "shadcn", "framer_motion"],
  bestForVerticals: ["plant-hire", "tool-hire", "aggregate-supplier", "concrete-supplier", "skip-hire", "building-merchant", "commercial-vehicle-hire"],
  defaultConfig: () => ({
    eyebrow: "Plant hire",
    heading: "Every Machine You Need. On Your Site.",
    subheading: "0.8T micro digger to 14T excavator. CPA-standard machines, 24/7 breakdown line, delivered same day locally.",
    primaryCtaLabel: "See the fleet",
    primaryCtaHref: "/plant-hire/machines",
    secondaryCtaLabel: "WhatsApp quote",
    secondaryCtaHref: "#whatsapp",
    backgroundImageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2001_57_56%20PM.png",
    overlayOpacity: 0.6,
    showTrustBadge: true,
    trustBadgeText: "CPA-standard · 24/7 breakdown · Insured",
    visualEffect: "grid"
  }),
  renderer: PlantHireBoldHero
};

sectionRegistry.register(registration);
