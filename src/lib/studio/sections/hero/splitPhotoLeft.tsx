// hero.split_photo_left_1 — Phase 3 rebuild on shadcn foundation.
//
// Full-bleed 50/50 desktop split: photo left edge-to-edge, editorial
// copy column right. Mobile: photo banner on top, tight content card
// below with sticky-feel bottom CTA stack. Uses shadcn Button + Badge
// + Reveal + Card. Typography scale. Defensive fallbacks. Banner
// proportions on desktop (1600×800 target).

"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, BadgeCheck, Star, Clock } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { GridPattern } from "@/components/magicui/grid-pattern";
import { AuroraBackground } from "@/components/magicui/aurora-background";
import { cn } from "@/lib/utils";

/** Optional Magic UI background layer for the copy column. Grid is
 *  the default — subtle Linear/Stripe-tier depth. */
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

function SplitPhotoLeftHero({
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

  // Defensive fallbacks.
  const eyebrow = typeof config.eyebrow === "string" ? config.eyebrow : "";
  const heading = (typeof config.heading === "string" && config.heading) || "Your headline here.";
  const subheading = typeof config.subheading === "string" ? config.subheading : "";
  const imageUrl = typeof config.imageUrl === "string" ? config.imageUrl : "";
  const imageAlt = typeof config.imageAlt === "string" ? config.imageAlt : "";
  const ratingText = typeof config.ratingText === "string" ? config.ratingText : "";
  const showRating = config.showRating !== false;
  const responseCommitment = typeof config.responseCommitment === "string" ? config.responseCommitment : "";

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

  // Verified credential chips.
  const heldCredentials = data.credentials ?? [];
  const heldBySlug = new Map(heldCredentials.map((c) => [c.scheme, c]));
  const rawSchemes = (config as { verifiedSchemes?: unknown }).verifiedSchemes;
  const requestedSchemes: string[] = Array.isArray(rawSchemes)
    ? (rawSchemes as unknown[]).filter((v): v is string => typeof v === "string")
    : typeof rawSchemes === "string"
      ? rawSchemes.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const badges = requestedSchemes
    .map((slug) => {
      const held = heldBySlug.get(slug);
      return {
        scheme: slug,
        label: SCHEME_LABELS[slug] ?? slug,
        auto: held?.status === "verified"
      };
    })
    .filter((b) => b.label);

  return (
    <section
      className={cn(
        "relative isolate w-full overflow-x-clip",
        isDark ? "bg-foreground text-background" : "bg-background text-foreground"
      )}
      {...sectionRootAttrs(instanceId, "hero.split_photo_left_1", "Split-photo hero")}
    >
      {/* Magic UI premium background layer — sits behind the copy
          column so the photo half stays clean. */}
      {visualEffect === "grid" && (
        <GridPattern
          size={48}
          strokeWidth={1}
          className={cn(
            "-z-10",
            isDark ? "text-white/[0.06]" : "text-neutral-900/[0.06]"
          )}
        />
      )}
      {visualEffect === "aurora" && (
        <AuroraBackground accent={accent} className="-z-10" />
      )}

      {/* ═══════ MOBILE (<lg) — photo banner + tight content card ═══════ */}
      <div className="flex flex-col lg:hidden">
        {/* Photo banner */}
        <div className="relative h-[42vh] w-full overflow-hidden">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={imageAlt}
              className="absolute inset-0 h-full w-full object-cover"
              {...treeAttrs(instanceId, "imageUrl", "Photo", "image")}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-muted text-caption font-bold uppercase text-muted-foreground">
              Add a job photo →
            </div>
          )}
          {/* Gradient overlay for chip legibility */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.65) 100%)"
            }}
          />
          {/* Top overlay chips */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
            {eyebrow && (
              <Reveal>
                <Badge
                  variant="accent"
                  size="default"
                  className="border-white/25 bg-black/45 text-white backdrop-blur-md [&_svg]:text-primary"
                  {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
                >
                  <ShieldCheck strokeWidth={2.5} />
                  {eyebrow}
                </Badge>
              </Reveal>
            )}
            {showRating && ratingText && (
              <Reveal delay={0.05}>
                <Badge
                  variant="accent"
                  size="default"
                  className="border-white/25 bg-black/45 text-white backdrop-blur-md"
                  {...treeAttrs(instanceId, "ratingText", "Rating", "text")}
                >
                  <Star strokeWidth={0} fill={accent} />
                  {ratingText}
                </Badge>
              </Reveal>
            )}
          </div>
        </div>

        {/* Content card */}
        <div className="flex flex-col px-4 pb-6 pt-6">
          <Reveal delay={0.1}>
            <h1
              className="text-display-sm font-extrabold sm:text-display-md"
              {...treeAttrs(instanceId, "heading", "Main headline", "text")}
            >
              {heading}
            </h1>
          </Reveal>
          {subheading && (
            <Reveal delay={0.16}>
              <p
                className="mt-3 text-body-md text-muted-foreground"
                {...treeAttrs(instanceId, "subheading", "Supporting line", "text")}
              >
                {subheading}
              </p>
            </Reveal>
          )}

          {badges.length > 0 && (
            <Reveal delay={0.22}>
              <div
                className="-mx-4 mt-5 overflow-x-auto px-4"
                style={{ scrollbarWidth: "none" }}
              >
                <ul className="flex gap-2 pb-1">
                  {badges.map((b, i) => (
                    <li key={i} className="shrink-0">
                      <Badge
                        variant="outline"
                        size="default"
                        className="whitespace-nowrap"
                      >
                        {b.auto ? (
                          <BadgeCheck strokeWidth={2.25} className="text-emerald-500" />
                        ) : (
                          <ShieldCheck strokeWidth={2.25} className="text-blue-500" />
                        )}
                        {b.label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )}

          <Reveal delay={0.28}>
            <div className="mx-auto mt-6 flex max-w-[300px] flex-col gap-2.5 sm:max-w-md sm:flex-row sm:gap-3">
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
            <Reveal delay={0.34}>
              <div
                className="mx-auto mt-4 inline-flex items-center gap-1.5 text-caption font-bold uppercase text-muted-foreground"
                {...treeAttrs(instanceId, "responseCommitment", "Response commitment", "text")}
              >
                <Clock size={11} strokeWidth={2.5} />
                {responseCommitment}
              </div>
            </Reveal>
          )}
        </div>
      </div>

      {/* ═══════ DESKTOP (lg+) — full-bleed 50/50 editorial split, 1600×800 banner ═══════ */}
      <div className="relative hidden lg:grid lg:min-h-[600px] lg:max-h-[800px] lg:grid-cols-2">
        {/* Left — full-bleed photo */}
        <div className="relative overflow-hidden">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={imageAlt}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-muted text-caption font-bold uppercase text-muted-foreground">
              Add a job photo →
            </div>
          )}
          {/* Right-edge fade into copy column */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-24"
            style={{
              background: isDark
                ? "linear-gradient(90deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.9) 100%)"
                : "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 100%)"
            }}
          />
        </div>

        {/* Right — editorial copy */}
        <div className="flex items-center px-12 py-16 xl:px-20">
          <div className="w-full max-w-xl">
            {eyebrow && (
              <Reveal>
                <Badge
                  variant="accent"
                  size="default"
                  style={{
                    background: `${accent}12`,
                    borderColor: `${accent}55`,
                    color: accent
                  }}
                >
                  <ShieldCheck strokeWidth={2.5} />
                  {eyebrow}
                </Badge>
              </Reveal>
            )}
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-display-lg font-extrabold lg:text-display-xl">
                {heading}
              </h1>
            </Reveal>
            {subheading && (
              <Reveal delay={0.16}>
                <p className="mt-5 text-body-lg text-muted-foreground">
                  {subheading}
                </p>
              </Reveal>
            )}
            {badges.length > 0 && (
              <Reveal delay={0.22}>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {badges.map((b, i) => (
                    <li key={i}>
                      <Badge variant="outline" size="default">
                        {b.auto ? (
                          <BadgeCheck strokeWidth={2.25} className="text-emerald-500" />
                        ) : (
                          <ShieldCheck strokeWidth={2.25} className="text-blue-500" />
                        )}
                        {b.label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}
            <Reveal delay={0.28}>
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
                    variant="accentGhost"
                    size="xl"
                    style={{ borderColor: accent, color: isDark ? "#FFFFFF" : accent }}
                  >
                    <Link href={secondaryHref || "#"}>{secondaryLabel}</Link>
                  </Button>
                )}
              </div>
            </Reveal>
            {showRating && ratingText && (
              <Reveal delay={0.34}>
                <div className="mt-6 inline-flex items-center gap-2 text-body-sm font-bold text-muted-foreground">
                  <div className="flex items-center gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} size={14} strokeWidth={0} fill={accent} aria-hidden="true" />
                    ))}
                  </div>
                  <span>{ratingText}</span>
                </div>
              </Reveal>
            )}
            {responseCommitment && (
              <Reveal delay={0.4}>
                <div className="mt-3 inline-flex items-center gap-1.5 text-caption font-bold uppercase text-muted-foreground">
                  <Clock size={12} strokeWidth={2.5} />
                  {responseCommitment}
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

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

  // ─── Slice D extended manifest ──────────────────────────────────
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
