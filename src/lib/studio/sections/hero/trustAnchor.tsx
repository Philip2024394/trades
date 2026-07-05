// hero.trust_anchor_1 — Phase 3 rebuild on shadcn foundation.
//
// Editorial full-bleed photography hero with sophisticated overlay
// gradient. Desktop: 2-column grid (headline + floating glass trust
// card). Mobile: content stack over photo banner with content card
// below. Banner proportions (1600×800). shadcn Button + Badge + Card
// + Reveal. Typography scale. Defensive fallbacks.

"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ShieldCheck,
  Star as StarIcon,
  Clock
} from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { GridPattern } from "@/components/magicui/grid-pattern";
import { cn } from "@/lib/utils";

/** Trust-anchor already carries a full-bleed photo + overlay gradient
 *  + grain layer. The Magic UI addition is a subtle grid over the
 *  overlay for a "designed" feel — grid is default, off is opt-out. */
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

const SCHEME_LABELS: Record<string, string> = {
  "gas-safe": "Gas Safe",
  niceic: "NICEIC",
  napit: "NAPIT",
  trustmark: "TrustMark",
  fmb: "FMB",
  mcs: "MCS",
  hetas: "HETAS",
  fensa: "FENSA",
  chas: "CHAS",
  ipaf: "IPAF",
  pasma: "PASMA",
  "waste-carrier": "Waste Carrier",
  "companies-house": "Companies House",
  cscs: "CSCS"
};

function TrustAnchorHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";
  const visualEffect: VisualEffect =
    config.visualEffect === "none" ? "none" : "grid";

  // Defensive fallbacks.
  const eyebrow = typeof config.eyebrow === "string" ? config.eyebrow : "";
  const heading = (typeof config.heading === "string" && config.heading) || "Your headline here.";
  const subheading = typeof config.subheading === "string" ? config.subheading : "";
  const responseCommitment = typeof config.responseCommitment === "string" ? config.responseCommitment : "";
  const ratingReviewCount = Number(config.ratingReviewCount) || 0;
  const ratingLabel = (typeof config.ratingLabel === "string" && config.ratingLabel) || "Rating";
  const backgroundImageUrl = typeof config.backgroundImageUrl === "string" ? config.backgroundImageUrl : "";

  // Assembly-runtime overrides.
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

  // Merged badge list.
  const heldCredentials = data.credentials ?? [];
  const heldBySlug = new Map(heldCredentials.map((c) => [c.scheme, c]));
  const rawSchemes = (config as { verifiedSchemes?: unknown }).verifiedSchemes;
  const requestedSchemes: string[] = Array.isArray(rawSchemes)
    ? (rawSchemes as unknown[]).filter((v): v is string => typeof v === "string")
    : typeof rawSchemes === "string"
      ? rawSchemes.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const verifiedBadges = requestedSchemes.map((slug) => {
    const held = heldBySlug.get(slug);
    return {
      kind: "verified" as const,
      scheme: slug,
      label: SCHEME_LABELS[slug] ?? slug,
      auto: held?.status === "verified"
    };
  });
  const textBadges = [config.badge1, config.badge2, config.badge3, config.badge4]
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter((b) => b.length > 0)
    .map((label) => ({ kind: "text" as const, label }));
  const badges = [...verifiedBadges, ...textBadges];

  const rating = Math.min(5, Math.max(0, Number(config.ratingValue) || 0));
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;

  const overlayGradient = isDark
    ? "linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.75) 45%, rgba(10,10,10,0.9) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.5) 45%, rgba(255,255,255,0.9) 100%)";

  return (
    <section
      className={cn(
        "relative isolate w-full overflow-x-clip",
        isDark ? "bg-neutral-950 text-white" : "bg-neutral-50 text-neutral-950"
      )}
      {...sectionRootAttrs(instanceId, "hero.trust_anchor_1", "Trust-Anchor Hero")}
    >
      {/* Full-bleed background photo */}
      {backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          {...treeAttrs(instanceId, "backgroundImageUrl", "Hero photo", "image")}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: overlayGradient }}
      />
      {/* Subtle grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.5'/></svg>\")"
        }}
      />
      {/* Magic UI grid — sits above the overlay so it reads over the
          photo without competing. Very low opacity because the photo
          is the star. */}
      {visualEffect === "grid" && (
        <GridPattern
          size={56}
          strokeWidth={1}
          className="-z-10 text-white/[0.05]"
        />
      )}

      {/* ═══════ MOBILE (<lg) — banner-shaped stack ═══════ */}
      <div className="relative flex min-h-[85vh] flex-col px-4 pb-6 pt-6 lg:hidden">
        <div className="flex flex-1 flex-col justify-center">
          <div className="flex items-center justify-between gap-3">
            {eyebrow && (
              <Reveal>
                <Badge
                  variant="outline"
                  size="default"
                  className={cn(
                    "backdrop-blur-md",
                    isDark ? "border-white/20 bg-white/10 text-white" : "border-black/15 bg-white/85 text-black"
                  )}
                  {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
                >
                  <ShieldCheck strokeWidth={2.5} style={{ color: accent }} />
                  {eyebrow}
                </Badge>
              </Reveal>
            )}
            <Reveal delay={0.05}>
              <Badge
                variant="outline"
                size="default"
                className={cn(
                  "backdrop-blur-md",
                  isDark ? "border-white/20 bg-white/10 text-white" : "border-black/15 bg-white/85 text-black"
                )}
              >
                <StarIcon strokeWidth={0} fill={accent} />
                <span className="tabular-nums">
                  {rating.toFixed(1)}
                </span>
                <span className="opacity-70">({ratingReviewCount.toLocaleString()})</span>
              </Badge>
            </Reveal>
          </div>

          <Reveal delay={0.12}>
            <h1
              className="mt-8 text-display-md font-extrabold sm:text-display-lg"
              {...treeAttrs(instanceId, "heading", "Headline", "text")}
            >
              {heading}
            </h1>
          </Reveal>
          {subheading && (
            <Reveal delay={0.2}>
              <p
                className={cn(
                  "mt-4 text-body-md",
                  isDark ? "text-white/70" : "text-neutral-700"
                )}
                {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
              >
                {subheading}
              </p>
            </Reveal>
          )}

          {badges.length > 0 && (
            <Reveal delay={0.28}>
              <div
                className="-mx-4 mt-6 overflow-x-auto px-4"
                style={{ scrollbarWidth: "none" }}
              >
                <ul className="flex gap-2 pb-1">
                  {badges.map((b, i) => (
                    <li key={i} className="shrink-0">
                      <Badge
                        variant="outline"
                        size="default"
                        className={cn(
                          "whitespace-nowrap backdrop-blur-md",
                          isDark ? "border-white/20 bg-white/8 text-white" : "border-black/10 bg-white/85 text-black"
                        )}
                      >
                        {b.kind === "verified" ? (
                          b.auto ? (
                            <BadgeCheck strokeWidth={2.25} className="text-emerald-500" />
                          ) : (
                            <ShieldCheck strokeWidth={2.25} className="text-blue-500" />
                          )
                        ) : (
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: accent }}
                            aria-hidden="true"
                          />
                        )}
                        {b.label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )}
        </div>

        <Reveal delay={0.34}>
          <div className="mx-auto mt-6 flex max-w-[300px] flex-col gap-2.5">
            {primaryLabel && (
              <Button
                asChild
                size="xl"
                className="group w-full"
                style={{
                  background: accent,
                  color: "#0A0A0A",
                  boxShadow: `0 8px 24px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.5)`
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
                className={cn(
                  "w-full backdrop-blur-md",
                  isDark ? "border-white/25 bg-white/10 text-white hover:bg-white/20" : "border-black/20 bg-white/70 text-black hover:bg-white/90"
                )}
              >
                <Link href={secondaryHref || "#"} {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}>
                  {secondaryLabel}
                </Link>
              </Button>
            )}
            {responseCommitment && (
              <div
                className={cn(
                  "mt-1 flex items-center justify-center gap-1.5 text-caption font-bold uppercase",
                  isDark ? "text-white/60" : "text-neutral-600"
                )}
                {...treeAttrs(instanceId, "responseCommitment", "Response commitment", "text")}
              >
                <Clock size={11} strokeWidth={2.5} />
                {responseCommitment}
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* ═══════ DESKTOP (lg+) — editorial 2-col with floating trust card ═══════ */}
      <div className="relative hidden lg:flex lg:min-h-[600px] lg:max-h-[800px] lg:items-center">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[1.15fr_1fr] items-center gap-14 px-6 py-16">
          {/* LEFT — copy */}
          <div>
            {eyebrow && (
              <Reveal>
                <Badge
                  variant="outline"
                  size="lg"
                  className={cn(
                    "backdrop-blur-md",
                    isDark ? "border-white/20 bg-white/10 text-white" : "border-black/15 bg-white/85 text-black"
                  )}
                >
                  <ShieldCheck strokeWidth={2.5} style={{ color: accent }} />
                  {eyebrow}
                </Badge>
              </Reveal>
            )}
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-display-xl font-extrabold lg:text-display-2xl">
                {heading}
              </h1>
            </Reveal>
            {subheading && (
              <Reveal delay={0.16}>
                <p className={cn("mt-6 max-w-xl text-body-lg", isDark ? "text-white/70" : "text-neutral-700")}>
                  {subheading}
                </p>
              </Reveal>
            )}
            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {primaryLabel && (
                  <Button
                    asChild
                    size="xl"
                    className="group"
                    style={{
                      background: accent,
                      color: "#0A0A0A",
                      boxShadow: `0 12px 32px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.5)`
                    }}
                  >
                    <Link href={primaryHref || "#"}>
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
                    className={cn(
                      "backdrop-blur-md",
                      isDark ? "border-white/25 bg-white/10 text-white hover:bg-white/20" : "border-black/20 bg-white/70 text-black hover:bg-white/90"
                    )}
                  >
                    <Link href={secondaryHref || "#"}>{secondaryLabel}</Link>
                  </Button>
                )}
              </div>
            </Reveal>
            {responseCommitment && (
              <Reveal delay={0.3}>
                <div className={cn("mt-6 inline-flex items-center gap-1.5 text-caption font-bold uppercase", isDark ? "text-white/60" : "text-neutral-600")}>
                  <Clock size={12} strokeWidth={2.5} />
                  {responseCommitment}
                </div>
              </Reveal>
            )}
          </div>

          {/* RIGHT — floating glass trust card */}
          <Reveal delay={0.16}>
            <Card
              className={cn(
                "backdrop-blur-2xl shadow-2xl",
                isDark ? "border-white/12 bg-neutral-950/60" : "border-black/10 bg-white/85"
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <BadgeCheck size={14} strokeWidth={2.5} style={{ color: accent }} />
                  <span className="text-eyebrow font-extrabold uppercase" style={{ color: accent }}>
                    {ratingLabel}
                  </span>
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-display-lg font-extrabold leading-none tabular-nums">
                    {rating.toFixed(1)}
                  </span>
                  <div className="pb-1">
                    <div className="flex items-center gap-0.5">
                      {[0, 1, 2, 3, 4].map((i) => {
                        const filled = i < fullStars || (i === fullStars && hasHalfStar);
                        return (
                          <StarIcon
                            key={i}
                            size={16}
                            strokeWidth={0}
                            fill={filled ? accent : "transparent"}
                            stroke={accent}
                            aria-hidden="true"
                          />
                        );
                      })}
                    </div>
                    <p className={cn("mt-1 text-caption font-bold uppercase", isDark ? "text-white/60" : "text-neutral-600")}>
                      {ratingReviewCount.toLocaleString()} reviews
                    </p>
                  </div>
                </div>
                {badges.length > 0 && (
                  <>
                    <div className={cn("my-5 h-px", isDark ? "bg-white/12" : "bg-black/10")} />
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={12} strokeWidth={2.5} className={isDark ? "text-white/60" : "text-neutral-600"} />
                      <p className={cn("text-eyebrow font-extrabold uppercase", isDark ? "text-white/60" : "text-neutral-600")}>
                        Verified
                      </p>
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {badges.map((b, i) => (
                        <li key={i}>
                          <Badge
                            variant="outline"
                            size="default"
                            className={cn(
                              isDark ? "border-white/15 bg-white/5 text-white" : "border-black/10 bg-black/5 text-black"
                            )}
                          >
                            {b.kind === "verified" ? (
                              b.auto ? (
                                <BadgeCheck strokeWidth={2.25} className="text-emerald-500" />
                              ) : (
                                <ShieldCheck strokeWidth={2.25} className="text-blue-500" />
                              )
                            ) : (
                              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: accent }} aria-hidden="true" />
                            )}
                            {b.label}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

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
