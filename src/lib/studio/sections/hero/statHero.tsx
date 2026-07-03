// hero.stat_hero_1 — Stat-Anchor Hero.
//
// Numbers-first hero for established trades with a track record.
// A single huge stat (jobs completed, years in trade, sq metres laid,
// tonnes delivered) becomes the visual anchor; copy sits below.
// A floating quote-of-a-customer pill hovers bottom-right on desktop.
//
// Design principles applied:
//   • The stat IS the hero (200px+ font weight)
//   • Editorial rhythm: tiny label, giant number, big headline, tight copy
//   • Optional testimonial pill = social proof without a full carousel
//   • Works with any trade that can honestly cite a number

"use client";

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  statValue: string;
  statUnit: string;
  statLabel: string;
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  testimonialQuote: string;
  testimonialAuthor: string;
  surface: "dark" | "cream";
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
};

function StatHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";
  const bg = isDark
    ? "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)"
    : "linear-gradient(180deg, #FBFAF7 0%, #F5F2EC 100%)";
  const ink = isDark ? "#FFFFFF" : "#0A0A0A";
  const muted = isDark ? "rgba(255,255,255,0.7)" : "rgba(10,10,10,0.65)";
  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.08)";
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

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "hero.stat_hero_1", "Stat-Anchor Hero")}
    >
      {config.backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover"
          style={{
            opacity: Math.max(0, Math.min(1, config.backgroundImageOpacity ?? 1))
          }}
          {...treeAttrs(instanceId, "backgroundImageUrl", "Background photo", "image")}
        />
      )}
      {config.backgroundImageUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: isDark
              ? "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.55) 100%)"
              : "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.4) 100%)"
          }}
        />
      )}

      <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
        {/* Stat label */}
        <p
          className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
          style={{ color: accent }}
          {...treeAttrs(instanceId, "statLabel", "Stat label", "text")}
        >
          {config.statLabel}
        </p>

        {/* The huge stat */}
        <div className="mt-3 flex items-start gap-2">
          <span
            className="block text-[96px] font-extrabold leading-[0.85] sm:text-[160px] md:text-[200px]"
            style={{
              fontFamily: headingFont,
              letterSpacing: "-0.05em",
              textShadow: isDark
                ? "0 4px 40px rgba(255,179,0,0.15)"
                : "none"
            }}
            {...treeAttrs(instanceId, "statValue", "Stat value", "text")}
          >
            {config.statValue}
          </span>
          {config.statUnit && (
            <span
              className="mt-6 text-2xl font-bold sm:mt-10 sm:text-4xl"
              style={{ color: accent, fontFamily: headingFont }}
              {...treeAttrs(instanceId, "statUnit", "Stat unit", "text")}
            >
              {config.statUnit}
            </span>
          )}
        </div>

        {/* Eyebrow + Headline + subhead — sits below the stat */}
        <div className="mt-8 max-w-3xl">
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-widest"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
            >
              {config.eyebrow}
            </p>
          )}
          <h1
            className="mt-3 text-3xl font-extrabold leading-tight sm:text-5xl"
            style={{ fontFamily: headingFont, letterSpacing: "-0.02em" }}
            {...treeAttrs(instanceId, "heading", "Headline", "text")}
          >
            {config.heading}
          </h1>
          {config.subheading && (
            <p
              className="mt-4 max-w-xl text-[15px] leading-relaxed sm:text-[17px]"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
            >
              {config.subheading}
            </p>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
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

        {/* Testimonial pill floating bottom-right on desktop, inline on mobile */}
        {config.testimonialQuote && (
          <blockquote
            className="mt-12 max-w-md rounded-2xl border p-5 sm:absolute sm:bottom-12 sm:right-6"
            style={{
              borderColor: border,
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(10,10,10,0.03)"
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={accent} aria-hidden="true">
              <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 0 1-3.5 3.5 3.858 3.858 0 0 1-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 0 1-3.5 3.5 3.858 3.858 0 0 1-2.748-1.179z" />
            </svg>
            <p
              className="mt-2 text-[14px] font-semibold leading-relaxed"
              style={{ color: ink }}
              {...treeAttrs(instanceId, "testimonialQuote", "Testimonial", "text")}
            >
              &ldquo;{config.testimonialQuote}&rdquo;
            </p>
            <p
              className="mt-2 text-[11px] font-bold uppercase tracking-widest"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "testimonialAuthor", "Testimonial author", "text")}
            >
              — {config.testimonialAuthor}
            </p>
          </blockquote>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.stat_hero_1",
  name: "Stat-Anchor Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Numbers-first hero. A giant honest stat becomes the visual anchor. Perfect for established trades with a track record.",
  editableFields: [
    { key: "statValue", role: "stat_value",label: "Stat value", type: { kind: "text", maxLength: 10 }, default: "847", priority: "text", aiPromptable: false, group: "The stat" },
    { key: "statUnit", role: "stat_unit",label: "Stat unit / suffix", type: { kind: "text", maxLength: 10 }, default: "+", priority: "text", group: "The stat" },
    { key: "statLabel", role: "stat_label",label: "Stat label", type: { kind: "text", maxLength: 60 }, default: "Jobs completed since 2011", priority: "text", aiPromptable: true, group: "The stat" },
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Established 2011", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 100 }, default: "The record speaks for itself.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "13 years, 4 counties, one team. If your neighbour's had a job done in the last decade, we probably did it.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label",label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Get a quote", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href",label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", role: "secondary_action_label",label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "Read reviews", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", role: "secondary_action_href",label: "Secondary CTA link", type: { kind: "link" }, default: "#reviews", group: "CTAs" },
    { key: "testimonialQuote", label: "Testimonial quote", type: { kind: "text", maxLength: 200, multiline: true }, default: "Turned up when he said he would. Finished when he said he would. Rare.", priority: "text", aiPromptable: true, group: "Testimonial" },
    { key: "testimonialAuthor", label: "Testimonial author", type: { kind: "text", maxLength: 60 }, default: "Sarah, Leeds", priority: "text", group: "Testimonial" },
    { key: "surface", role: "surface_mode",label: "Surface", type: { kind: "select", options: [{ value: "dark", label: "Dark" }, { value: "cream", label: "Cream" }] }, default: "dark", group: "Layout" },
    { key: "backgroundImageUrl", role: "background_media",label: "Background photo", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1920 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2003_23_15%20PM.png", group: "Background", description: "Full-bleed photo behind the giant stat + copy. Leave empty for the plain surface." },
    { key: "backgroundImageOpacity", role: "opacity",label: "Background photo opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 1, group: "Background" }
  ],
  animations: ["none", "count-up", "fade-in"],
  aiPrompts: {
    explain: "Explain when the Stat-Anchor hero converts best for trades.",
    improve: "Suggest a tweak to make this hero honest and effective.",
    rewrite: "Rewrite the headline to feel confident but not braggy.",
    suggestAlternative: "Which other hero would work for a newer trade without a big number yet?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "stat", "established", "social-proof"],
  bestForVerticals: ["builder", "plumber", "electrician", "roofer", "carpenter", "kitchen-fitter", "landscape-designer"],
  defaultConfig: () => ({
    statValue: "847",
    statUnit: "+",
    statLabel: "Jobs completed since 2011",
    eyebrow: "Established 2011",
    heading: "The record speaks for itself.",
    subheading: "13 years, 4 counties, one team. If your neighbour's had a job done in the last decade, we probably did it.",
    primaryCtaLabel: "Get a quote",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "Read reviews",
    secondaryCtaHref: "#reviews",
    testimonialQuote: "Turned up when he said he would. Finished when he said he would. Rare.",
    testimonialAuthor: "Sarah, Leeds",
    surface: "dark",
    backgroundImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2003_23_15%20PM.png",
    backgroundImageOpacity: 1
  }),
  renderer: StatHero
};

sectionRegistry.register(registration);
