// hero.stat_hero_1 — Phase 3 rebuild on shadcn foundation.
//
// Data-forward hero for merchants whose story is scale + experience.
// Big stat row anchors the top ("500+ jobs · 4.9★ · 12yr"), display
// headline below, subhead + dual CTAs. Numbers reveal with Framer
// Motion. Banner proportions on desktop. shadcn Button + Reveal.

"use client";

import Link from "next/link";
import { ArrowRight, Clock, TrendingUp } from "lucide-react";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type { SectionRendererProps } from "@/lib/studio/sectionTypes";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Separator } from "@/components/ui/separator";
import { GridPattern } from "@/components/magicui/grid-pattern";
import { AuroraBackground } from "@/components/magicui/aurora-background";
import { cn } from "@/lib/utils";

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

export function StatHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";
  const visualEffect: VisualEffect =
    config.visualEffect === "aurora" || config.visualEffect === "none"
      ? config.visualEffect
      : "grid";

  const eyebrow = typeof config.eyebrow === "string" ? config.eyebrow : "";
  const heading = (typeof config.heading === "string" && config.heading) || "Your headline here.";
  const subheading = typeof config.subheading === "string" ? config.subheading : "";
  const responseCommitment = typeof config.responseCommitment === "string" ? config.responseCommitment : "";

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

  const stats = [
    { value: config.stat1Value, label: config.stat1Label },
    { value: config.stat2Value, label: config.stat2Label },
    { value: config.stat3Value, label: config.stat3Label }
  ]
    .map((s, i) => ({
      i: i + 1,
      value: typeof s.value === "string" ? s.value : "",
      label: typeof s.label === "string" ? s.label : ""
    }))
    .filter((s) => s.value.length > 0);

  return (
    <section
      className={cn(
        "relative isolate w-full overflow-x-clip",
        isDark ? "bg-foreground text-background" : "bg-background text-foreground"
      )}
      {...sectionRootAttrs(instanceId, "hero.stat_hero_1", "Stat-anchor hero")}
    >
      {/* Magic UI premium background layer */}
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

      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(circle at 50% 20%, ${accent}18 0%, transparent 60%)`
        }}
      />

      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center px-4 py-14 text-center sm:px-6 sm:py-20 lg:min-h-[600px] lg:max-h-[800px] lg:py-24">
        {eyebrow && (
          <Reveal>
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5"
              style={{
                borderColor: `${accent}55`,
                background: `${accent}12`,
                color: accent
              }}
              {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
            >
              <TrendingUp size={12} strokeWidth={2.75} />
              <span className="text-eyebrow font-extrabold uppercase">
                {eyebrow}
              </span>
            </div>
          </Reveal>
        )}

        <Reveal delay={0.08}>
          <h1
            className="mt-6 text-display-md font-extrabold sm:mt-8 sm:text-display-lg lg:text-display-xl"
            {...treeAttrs(instanceId, "heading", "Main headline", "text")}
          >
            {heading}
          </h1>
        </Reveal>

        {subheading && (
          <Reveal delay={0.16}>
            <p
              className="mt-4 max-w-xl text-body-md text-muted-foreground sm:mt-5 sm:text-body-lg"
              {...treeAttrs(instanceId, "subheading", "Supporting line", "text")}
            >
              {subheading}
            </p>
          </Reveal>
        )}

        {/* Big stat row — the signature of this hero */}
        {stats.length > 0 && (
          <Reveal delay={0.24}>
            <div className="mt-8 flex items-center gap-4 sm:mt-10 sm:gap-6">
              {stats.map((s, i) => (
                <div key={s.i} className="contents">
                  {i > 0 && (
                    <Separator
                      orientation="vertical"
                      className="hidden h-14 sm:block"
                    />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="text-display-sm font-extrabold tabular-nums sm:text-display-md lg:text-display-lg"
                      style={{ color: accent }}
                      {...treeAttrs(instanceId, `stat${s.i}Value`, `Stat ${s.i} value`, "text")}
                    >
                      {s.value}
                    </span>
                    <span
                      className="text-caption font-extrabold uppercase text-muted-foreground"
                      {...treeAttrs(instanceId, `stat${s.i}Label`, `Stat ${s.i} label`, "text")}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        <Reveal delay={0.32}>
          <div className="mx-auto mt-8 flex max-w-[300px] flex-col gap-2.5 sm:mt-10 sm:max-w-md sm:flex-row sm:gap-3">
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
                  {...treeAttrs(instanceId, "primaryCtaLabel", "Primary CTA", "button")}
                >
                  <span>{primaryLabel}</span>
                  <ArrowRight strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </Button>
            )}
            {secondaryLabel && (
              <Button
                asChild
                variant="accentGhost"
                size="xl"
                className="w-full flex-1"
                style={{ borderColor: accent, color: isDark ? "#FFFFFF" : accent }}
              >
                <Link
                  href={secondaryHref || "#"}
                  {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
                >
                  {secondaryLabel}
                </Link>
              </Button>
            )}
          </div>
        </Reveal>

        {responseCommitment && (
          <Reveal delay={0.4}>
            <div
              className="mt-5 inline-flex items-center gap-1.5 text-caption font-bold uppercase text-muted-foreground"
              {...treeAttrs(instanceId, "responseCommitment", "Response commitment", "text")}
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

