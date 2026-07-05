// hero.stat_hero_1 — Phase 3 rebuild on shadcn foundation.
//
// Data-forward hero for merchants whose story is scale + experience.
// Big stat row anchors the top ("500+ jobs · 4.9★ · 12yr"), display
// headline below, subhead + dual CTAs. Numbers reveal with Framer
// Motion. Banner proportions on desktop. shadcn Button + Reveal.

"use client";

import Link from "next/link";
import { ArrowRight, Clock, TrendingUp } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
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

function StatHero({
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
