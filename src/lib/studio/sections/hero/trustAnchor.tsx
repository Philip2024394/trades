// hero.trust_anchor_1 — Trust-First Editorial Hero.
//
// Editorial two-column layout designed for trades that live and die by
// reputation (electricians, plumbers, roofers, gas engineers). The
// LEFT column carries the headline + subhead + dual CTAs; the RIGHT
// column carries a floating "reviews card" showing star rating and
// review count, plus a rotating verified-badges strip at the bottom
// (Gas Safe / NICEIC / CSCS / TrustMark / FMB — configurable).
//
// Design principles applied:
//   • Big type, tight tracking, editorial rhythm (Nike-ad / Stripe-hero era)
//   • Trust is baked in at 3 levels (rating, review count, badge strip)
//   • Dual CTA hierarchy: WhatsApp (primary yellow) + Get a quote (secondary outline)
//   • Mobile-first: 44px+ tap targets, card stacks below headline on <sm
//   • Motion: subtle fade-in on scroll (respects prefers-reduced-motion)

"use client";

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  ratingValue: number;
  ratingReviewCount: number;
  ratingLabel: string;
  badge1: string;
  badge2: string;
  badge3: string;
  badge4: string;
  surface: "dark" | "light";
};

function TrustAnchorHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";
  const bg = isDark
    ? "#0A0A0A"
    : ((tokens["color.surface"] as string) ?? "#FFFFFF");
  const ink = isDark ? "#FFFFFF" : "#0A0A0A";
  const muted = isDark ? "rgba(255,255,255,0.72)" : "#525252";
  const border = isDark ? "rgba(255,255,255,0.12)" : "#E5E5E5";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryHref =
    config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  const badges = [config.badge1, config.badge2, config.badge3, config.badge4]
    .map((b) => b?.trim())
    .filter((b): b is string => !!b && b.length > 0);

  const rating = Math.min(5, Math.max(0, Number(config.ratingValue) || 0));
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "hero.trust_anchor_1", "Trust-Anchor Hero")}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 py-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-12 lg:py-24">
        {/* LEFT — copy column */}
        <div>
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.24em]"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
            >
              {config.eyebrow}
            </p>
          )}
          <h1
            className="mt-3 text-4xl font-extrabold leading-[0.95] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: headingFont, letterSpacing: "-0.02em" }}
            {...treeAttrs(instanceId, "heading", "Headline", "text")}
          >
            {config.heading}
          </h1>
          {config.subheading && (
            <p
              className="mt-5 max-w-xl text-[15px] leading-relaxed sm:text-[17px]"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
            >
              {config.subheading}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={primaryHref || "#"}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
              style={{
                background: accent,
                color: "#0A0A0A",
                boxShadow: `0 8px 24px ${accent}55`
              }}
              {...treeAttrs(instanceId, "primaryCtaLabel", "Primary CTA", "button")}
            >
              <span>{config.primaryCtaLabel}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
            {config.secondaryCtaLabel && (
              <Link
                href={secondaryHref || "#"}
                className="inline-flex h-14 items-center justify-center rounded-xl border px-6 text-[13px] font-extrabold uppercase tracking-widest transition hover:brightness-110"
                style={{
                  borderColor: border,
                  color: ink,
                  background: "transparent"
                }}
                {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
              >
                {config.secondaryCtaLabel}
              </Link>
            )}
          </div>
        </div>

        {/* RIGHT — trust card */}
        <div className="flex justify-center lg:justify-end">
          <div
            className="w-full max-w-sm rounded-3xl border p-6 shadow-2xl backdrop-blur-sm"
            style={{
              borderColor: border,
              background: cardBg,
              boxShadow: isDark
                ? "0 20px 50px rgba(0,0,0,0.5)"
                : "0 20px 50px rgba(0,0,0,0.10)"
            }}
          >
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: accent }}
            >
              {config.ratingLabel}
            </p>
            <div className="mt-3 flex items-end gap-3">
              <span
                className="text-6xl font-extrabold leading-none"
                style={{ fontFamily: headingFont, letterSpacing: "-0.03em" }}
                {...treeAttrs(instanceId, "ratingValue", "Rating value", "text")}
              >
                {rating.toFixed(1)}
              </span>
              <div className="pb-1">
                {/* Star row */}
                <div className="flex items-center gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      fill={
                        i < fullStars
                          ? accent
                          : i === fullStars && hasHalfStar
                            ? accent
                            : "transparent"
                      }
                      stroke={accent}
                      half={i === fullStars && hasHalfStar}
                    />
                  ))}
                </div>
                <p
                  className="mt-1 text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: muted }}
                  {...treeAttrs(instanceId, "ratingReviewCount", "Review count", "text")}
                >
                  {config.ratingReviewCount.toLocaleString()} reviews
                </p>
              </div>
            </div>

            {badges.length > 0 && (
              <>
                <div
                  className="my-5 h-px"
                  style={{ background: border }}
                />
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                  style={{ color: muted }}
                >
                  Verified
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {badges.map((b, i) => (
                    <li
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider"
                      style={{
                        borderColor: border,
                        color: ink,
                        background: isDark ? "rgba(255,255,255,0.04)" : "#F5F5F5"
                      }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: accent }}
                        aria-hidden="true"
                      />
                      {b}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Star({ fill, stroke, half }: { fill: string; stroke: string; half?: boolean }) {
  if (half) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="halfstar" x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor={fill} />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path
          d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"
          fill="url(#halfstar)"
          stroke={stroke}
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
      />
    </svg>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.trust_anchor_1",
  name: "Trust Anchor Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Editorial two-column hero anchored by a floating rating card and a strip of verified badges. Built for trades whose sale is trust.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Verified & insured", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 120 }, default: "The trade your neighbours already trust.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 240, multiline: true }, default: "127 five-star reviews, fully insured, Gas Safe registered. Same-day quotes over WhatsApp.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label",label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "WhatsApp quote", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href",label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", role: "secondary_action_label",label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "See our work", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", role: "secondary_action_href",label: "Secondary CTA link", type: { kind: "link" }, default: "#projects", group: "CTAs" },
    { key: "ratingValue", role: "rating_value",label: "Star rating", type: { kind: "number", min: 0, max: 5, step: 0.1 }, default: 4.9, group: "Trust card" },
    { key: "ratingReviewCount", label: "Review count", type: { kind: "number", min: 0, max: 999999, step: 1 }, default: 127, group: "Trust card" },
    { key: "ratingLabel", label: "Rating eyebrow", type: { kind: "text", maxLength: 40 }, default: "Google + Xrated rating", group: "Trust card" },
    { key: "badge1", label: "Badge 1", type: { kind: "text", maxLength: 30 }, default: "Gas Safe", group: "Badges" },
    { key: "badge2", label: "Badge 2", type: { kind: "text", maxLength: 30 }, default: "NICEIC", group: "Badges" },
    { key: "badge3", label: "Badge 3", type: { kind: "text", maxLength: 30 }, default: "£5m insured", group: "Badges" },
    { key: "badge4", label: "Badge 4", type: { kind: "text", maxLength: 30 }, default: "TrustMark", group: "Badges" },
    { key: "surface", role: "surface_mode",label: "Surface", type: { kind: "select", options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }] }, default: "dark", group: "Layout" }
  ],
  animations: ["none", "fade-in", "slide-up"],
  aiPrompts: {
    explain: "Explain when the Trust Anchor hero pattern converts best for a trade.",
    improve: "Suggest a small tweak to make this hero fit the merchant's specific trade.",
    rewrite: "Rewrite the headline in the merchant's voice, keeping trust-forward.",
    suggestAlternative: "Which other hero in this library would work better for a trade without many reviews yet?",
    score: "Score this hero for a trade merchant on loading, a11y, sales, SEO, mobile, brand."
  },
  thumbnail: "",
  telemetryTags: ["hero", "trust", "reviews"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "roofer", "boiler-installer", "kitchen-fitter"],
  defaultConfig: () => ({
    eyebrow: "Verified & insured",
    heading: "The trade your neighbours already trust.",
    subheading: "127 five-star reviews, fully insured, Gas Safe registered. Same-day quotes over WhatsApp.",
    primaryCtaLabel: "WhatsApp quote",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "See our work",
    secondaryCtaHref: "#projects",
    ratingValue: 4.9,
    ratingReviewCount: 127,
    ratingLabel: "Google + Xrated rating",
    badge1: "Gas Safe",
    badge2: "NICEIC",
    badge3: "£5m insured",
    badge4: "TrustMark",
    surface: "dark"
  }),
  renderer: TrustAnchorHero
};

sectionRegistry.register(registration);
