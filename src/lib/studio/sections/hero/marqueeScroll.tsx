// hero.marquee_scroll_1 — Editorial Marquee Scroll Hero.
//
// High-fashion editorial hero. Three rows of massive typography scroll
// horizontally in alternating directions at different speeds, anchoring
// static copy in the middle. Balenciaga / Off-White / Loewe aesthetic
// re-tuned for trade businesses.
//
// Design principles applied:
//   • Big brutalist type running edge-to-edge — nothing plays it safe
//   • Row 1 scrolls right→left, row 2 left→right, row 3 right→left
//   • Different speeds per row so it feels alive rather than mechanical
//   • Middle band carries the static message + CTAs
//   • Pauses on hover (accessibility + intentionality)
//   • Respects prefers-reduced-motion (freezes on final state)

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
  row1Words: string;
  row2Words: string;
  row3Words: string;
  row1SpeedSec: number;
  row2SpeedSec: number;
  row3SpeedSec: number;
  surface: "onyx" | "cream" | "brand";
  rowStyle: "solid" | "outline" | "mixed";
};

function MarqueeScrollHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";

  const surfaceMap = {
    onyx: { bg: "#0A0A0A", ink: "#FFFFFF", muted: "rgba(255,255,255,0.72)" },
    cream: { bg: "#FBFAF6", ink: "#0A0A0A", muted: "rgba(10,10,10,0.6)" },
    brand: { bg: accent, ink: "#0A0A0A", muted: "rgba(10,10,10,0.72)" }
  }[config.surface];

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

  const uid = instanceId.replace(/[^a-zA-Z0-9]/g, "");

  // Parse pipe-separated words. Duplicate so the marquee loops seamlessly.
  const parseRow = (raw: string): string[] => {
    const words = (raw || "")
      .split("|")
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
    if (words.length === 0) return ["Trade"];
    return words;
  };

  const row1 = parseRow(config.row1Words);
  const row2 = parseRow(config.row2Words);
  const row3 = parseRow(config.row3Words);

  // Style per row — alternating solid / outline for visual rhythm
  const rowStyleFor = (i: 0 | 1 | 2): "solid" | "outline" => {
    if (config.rowStyle === "solid") return "solid";
    if (config.rowStyle === "outline") return "outline";
    // mixed: rows 0 + 2 solid, row 1 outline
    return i === 1 ? "outline" : "solid";
  };

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        background: surfaceMap.bg,
        color: surfaceMap.ink,
        fontFamily: bodyFont
      }}
      {...sectionRootAttrs(instanceId, "hero.marquee_scroll_1", "Marquee Scroll Hero")}
    >
      {/* Row 1 — top edge, scrolls right→left */}
      <MarqueeRow
        uid={uid}
        rowIndex={0}
        words={row1}
        durationSec={config.row1SpeedSec}
        direction="right-to-left"
        style={rowStyleFor(0)}
        accent={accent}
        ink={surfaceMap.ink}
      />

      {/* Middle band — copy + CTAs */}
      <div className="relative mx-auto max-w-4xl px-5 py-14 text-center sm:px-6 sm:py-20">
        {config.eyebrow && (
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: config.surface === "brand" ? "#0A0A0A" : accent }}
            {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
          >
            {config.eyebrow}
          </p>
        )}
        <h1
          className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl"
          style={{
            fontFamily: headingFont,
            letterSpacing: "-0.02em"
          }}
          {...treeAttrs(instanceId, "heading", "Headline", "text")}
        >
          {config.heading}
        </h1>
        {config.subheading && (
          <p
            className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed sm:text-[17px]"
            style={{ color: surfaceMap.muted }}
            {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
          >
            {config.subheading}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={primaryHref || "#"}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
            style={{
              background: config.surface === "brand" ? "#0A0A0A" : accent,
              color: config.surface === "brand" ? accent : "#0A0A0A",
              boxShadow: `0 8px 24px rgba(0,0,0,0.35)`
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
              className="inline-flex h-14 items-center justify-center rounded-xl border-2 px-6 text-[13px] font-extrabold uppercase tracking-widest transition"
              style={{
                borderColor: surfaceMap.ink,
                color: surfaceMap.ink,
                background: "transparent"
              }}
              {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
            >
              {config.secondaryCtaLabel}
            </Link>
          )}
        </div>
      </div>

      {/* Row 2 — mid-bottom, scrolls left→right */}
      <MarqueeRow
        uid={uid}
        rowIndex={1}
        words={row2}
        durationSec={config.row2SpeedSec}
        direction="left-to-right"
        style={rowStyleFor(1)}
        accent={accent}
        ink={surfaceMap.ink}
      />

      {/* Row 3 — bottom edge, scrolls right→left */}
      <MarqueeRow
        uid={uid}
        rowIndex={2}
        words={row3}
        durationSec={config.row3SpeedSec}
        direction="right-to-left"
        style={rowStyleFor(2)}
        accent={accent}
        ink={surfaceMap.ink}
      />

      <style>{`
        @keyframes marquee-r2l-${uid} {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes marquee-l2r-${uid} {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        .marquee-track-${uid}[data-dir="right-to-left"] {
          animation: marquee-r2l-${uid} var(--marquee-duration) linear infinite;
        }
        .marquee-track-${uid}[data-dir="left-to-right"] {
          animation: marquee-l2r-${uid} var(--marquee-duration) linear infinite;
        }
        .marquee-row-${uid}:hover .marquee-track-${uid} {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track-${uid} {
            animation: none !important;
            transform: translateX(0) !important;
          }
        }
      `}</style>
    </section>
  );
}

function MarqueeRow({
  uid,
  rowIndex,
  words,
  durationSec,
  direction,
  style,
  accent,
  ink
}: {
  uid: string;
  rowIndex: number;
  words: string[];
  durationSec: number;
  direction: "right-to-left" | "left-to-right";
  style: "solid" | "outline";
  accent: string;
  ink: string;
}) {
  // Duplicate the word sequence so the loop appears seamless when
  // translating by -50%.
  const doubled = [...words, ...words, ...words, ...words];

  return (
    <div
      className={`marquee-row-${uid} relative w-full overflow-hidden`}
      style={{
        borderTop: rowIndex === 0 ? "none" : "1px solid rgba(128,128,128,0.15)",
        borderBottom: rowIndex === 2 ? "none" : "1px solid rgba(128,128,128,0.15)"
      }}
    >
      <div
        className={`marquee-track-${uid} flex whitespace-nowrap py-4 sm:py-6`}
        data-dir={direction}
        style={
          {
            "--marquee-duration": `${durationSec}s`,
            width: "fit-content"
          } as React.CSSProperties
        }
      >
        {doubled.map((word, i) => (
          <span
            key={i}
            className="mx-8 inline-flex items-center gap-8 text-6xl font-extrabold leading-none sm:text-8xl md:text-9xl"
            style={{
              letterSpacing: "-0.03em",
              color: style === "solid" ? ink : "transparent",
              WebkitTextStroke:
                style === "outline" ? `2px ${ink}` : undefined
            }}
          >
            {word}
            <span
              aria-hidden="true"
              className="inline-block h-4 w-4 rounded-full"
              style={{ background: accent }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.marquee_scroll_1",
  name: "Marquee Scroll Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Editorial marquee. Three rows of massive typography scroll in alternating directions at independent speeds, with static copy anchored in the middle. Balenciaga aesthetic for trades.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Established · Insured · Reviewed", priority: "text", aiPromptable: true, group: "Middle band" },
    { key: "heading", label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Trade craft. Since 2011.", priority: "text", aiPromptable: true, group: "Middle band" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Real work. Real prices. Real results. Every job photographed, every quote written down, every customer treated like the last.", priority: "text", aiPromptable: true, group: "Middle band" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Get a quote", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "Portfolio", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", label: "Secondary CTA link", type: { kind: "link" }, default: "#projects", group: "CTAs" },
    { key: "row1Words", label: "Row 1 words (pipe-separated)", type: { kind: "text", maxLength: 300 }, default: "PLUMBING|HEATING|GAS|EMERGENCY|BOILER", priority: "text", group: "Row 1 (top)" },
    { key: "row1SpeedSec", label: "Row 1 speed (seconds per loop)", type: { kind: "number", min: 15, max: 90, step: 5 }, default: 45, group: "Row 1 (top)" },
    { key: "row2Words", label: "Row 2 words (pipe-separated)", type: { kind: "text", maxLength: 300 }, default: "TRUSTED|SINCE 2011|LEEDS|LOCAL|247", priority: "text", group: "Row 2 (middle)" },
    { key: "row2SpeedSec", label: "Row 2 speed (seconds per loop)", type: { kind: "number", min: 15, max: 90, step: 5 }, default: 65, group: "Row 2 (middle)" },
    { key: "row3Words", label: "Row 3 words (pipe-separated)", type: { kind: "text", maxLength: 300 }, default: "GAS SAFE|REGISTERED|INSURED|GUARANTEED|REVIEWED", priority: "text", group: "Row 3 (bottom)" },
    { key: "row3SpeedSec", label: "Row 3 speed (seconds per loop)", type: { kind: "number", min: 15, max: 90, step: 5 }, default: 55, group: "Row 3 (bottom)" },
    {
      key: "surface",
      label: "Surface",
      type: {
        kind: "select",
        options: [
          { value: "onyx", label: "Onyx (dark)" },
          { value: "cream", label: "Cream (light)" },
          { value: "brand", label: "Brand accent (bold)" }
        ]
      },
      default: "onyx",
      group: "Layout"
    },
    {
      key: "rowStyle",
      label: "Row style",
      type: {
        kind: "select",
        options: [
          { value: "solid", label: "All solid" },
          { value: "outline", label: "All outline" },
          { value: "mixed", label: "Mixed (solid, outline, solid)" }
        ]
      },
      default: "mixed",
      group: "Layout"
    }
  ],
  animations: ["marquee", "scroll-hover-pause"],
  aiPrompts: {
    explain: "Explain when the Marquee Scroll hero converts best.",
    improve: "Suggest which words to run in each row for this trade.",
    rewrite: "Rewrite the marquee rows in a fashion-editorial voice.",
    suggestAlternative: "Which hero would work for a merchant who wants a quieter aesthetic?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "marquee", "editorial", "type"],
  bestForVerticals: ["*"],
  defaultConfig: () => ({
    eyebrow: "Established · Insured · Reviewed",
    heading: "Trade craft. Since 2011.",
    subheading: "Real work. Real prices. Real results. Every job photographed, every quote written down, every customer treated like the last.",
    primaryCtaLabel: "Get a quote",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "Portfolio",
    secondaryCtaHref: "#projects",
    row1Words: "PLUMBING|HEATING|GAS|EMERGENCY|BOILER",
    row1SpeedSec: 45,
    row2Words: "TRUSTED|SINCE 2011|LEEDS|LOCAL|247",
    row2SpeedSec: 65,
    row3Words: "GAS SAFE|REGISTERED|INSURED|GUARANTEED|REVIEWED",
    row3SpeedSec: 55,
    surface: "onyx",
    rowStyle: "mixed"
  }),
  renderer: MarqueeScrollHero
};

sectionRegistry.register(registration);
