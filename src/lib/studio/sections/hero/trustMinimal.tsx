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
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type { SectionRendererProps } from "@/lib/studio/sectionTypes";
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

export function TrustMinimalHero({
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

