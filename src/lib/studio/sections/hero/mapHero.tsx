// hero.map_hero_1 — Coverage Map Hero.
//
// Location-first hero for local trades. Renders an SVG-based abstract
// map showing the merchant's coverage area with concentric service
// rings, drop pins at named towns, and a "you are here" beacon.
// Zero external map API — no keys, no rate limits, no vendor lock-in.
//
// Design principles applied:
//   • Instantly answers "do you cover me?"
//   • Named town pins let customers see themselves on the map
//   • Coverage rings hint at zone-based pricing/response times
//   • Pulsing "you are here" beacon draws the eye to the centre
//   • SVG only — retina-crisp at any size, ~2KB payload

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
  yardCity: string;
  ring1Label: string;
  ring2Label: string;
  ring3Label: string;
  pin1: string;
  pin2: string;
  pin3: string;
  pin4: string;
  pin5: string;
  pin6: string;
  chip1: string;
  chip2: string;
  chip3: string;
};

function MapHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const bg = "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)";
  const ink = "#FFFFFF";
  const muted = "rgba(255,255,255,0.72)";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;

  // Pin positions — spread evenly around the ring. Keep 6 slots so
  // merchants can name up to 6 towns; empty slots are just skipped.
  const pinPositions = [
    { x: 250, y: 85, label: config.pin1 },
    { x: 415, y: 155, label: config.pin2 },
    { x: 440, y: 305, label: config.pin3 },
    { x: 260, y: 385, label: config.pin4 },
    { x: 90, y: 300, label: config.pin5 },
    { x: 75, y: 155, label: config.pin6 }
  ].filter((p) => p.label?.trim().length > 0);

  const chips = [config.chip1, config.chip2, config.chip3].filter(
    (c) => c && c.trim().length > 0
  );

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "hero.map_hero_1", "Coverage Map Hero")}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-14 lg:py-24">
        {/* LEFT — copy */}
        <div>
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
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
              className="mt-5 max-w-md text-[15px] leading-relaxed sm:text-[17px]"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
            >
              {config.subheading}
            </p>
          )}

          {chips.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {chips.map((c, i) => (
                <li
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderColor: "rgba(255,255,255,0.14)",
                    color: ink
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: accent }}
                    aria-hidden="true"
                  />
                  {c}
                </li>
              ))}
            </ul>
          )}

          <Link
            href={primaryHref || "#"}
            className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
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
        </div>

        {/* RIGHT — abstract SVG map */}
        <div className="relative">
          <div
            className="relative overflow-hidden rounded-2xl border"
            style={{
              borderColor: "rgba(255,255,255,0.1)",
              background: "radial-gradient(circle at 50% 50%, #1a1a1a 0%, #0A0A0A 80%)"
            }}
          >
            <svg
              viewBox="0 0 500 460"
              className="block h-auto w-full"
              aria-hidden="true"
            >
              {/* Ambient grid */}
              <defs>
                <pattern id={`grid-${instanceId}`} width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                </pattern>
                <radialGradient id={`ring-glow-${instanceId}`} cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="500" height="460" fill={`url(#grid-${instanceId})`} />

              {/* Rings — outer to inner */}
              <circle cx="250" cy="230" r="220" fill="none" stroke={accent} strokeWidth="1" strokeDasharray="4 4" opacity="0.25" />
              <circle cx="250" cy="230" r="150" fill="none" stroke={accent} strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
              <circle cx="250" cy="230" r="80" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.65" />

              {/* Ring labels */}
              <text x="250" y="35" fill={muted} fontSize="11" fontWeight="800" textAnchor="middle" letterSpacing="2">
                {config.ring3Label.toUpperCase()}
              </text>
              <text x="250" y="90" fill={muted} fontSize="10" fontWeight="700" textAnchor="middle" letterSpacing="2">
                {config.ring2Label.toUpperCase()}
              </text>
              <text x="250" y="150" fill={accent} fontSize="10" fontWeight="800" textAnchor="middle" letterSpacing="2">
                {config.ring1Label.toUpperCase()}
              </text>

              {/* Central beacon glow */}
              <circle cx="250" cy="230" r="60" fill={`url(#ring-glow-${instanceId})`} />
              <circle cx="250" cy="230" r="10" fill={accent}>
                <animate attributeName="r" values="10;16;10" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.5;1" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle cx="250" cy="230" r="5" fill="#FFFFFF" />

              {/* Central label */}
              <text
                x="250"
                y="260"
                fill="#FFFFFF"
                fontSize="12"
                fontWeight="800"
                textAnchor="middle"
                letterSpacing="1.5"
              >
                {(config.yardCity ?? "").toUpperCase()}
              </text>

              {/* Pins */}
              {pinPositions.map((p, i) => (
                <g key={i}>
                  <path
                    d={`M ${p.x} ${p.y - 12} l -6 8 a 6 6 0 1 0 12 0 z`}
                    fill={accent}
                    stroke="#0A0A0A"
                    strokeWidth="1.5"
                  />
                  <circle cx={p.x} cy={p.y - 6} r="2.5" fill="#0A0A0A" />
                  <text
                    x={p.x}
                    y={p.y + 14}
                    fill="#FFFFFF"
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.map_hero_1",
  name: "Coverage Map Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Location-first hero with a pure-SVG coverage map (rings + pins + pulsing beacon). Answers 'do you cover me?' instantly. Zero external map API.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Local, not national", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", label: "Headline", type: { kind: "text", maxLength: 100 }, default: "We're on your patch.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "One yard, one crew, one radius. If you're inside our zone you get a quote back in minutes and a van at your door the same week.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Am I in your zone?", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "yardCity", label: "Your yard / base city", type: { kind: "text", maxLength: 30 }, default: "LEEDS", priority: "text", group: "Map" },
    { key: "ring1Label", label: "Ring 1 label (innermost)", type: { kind: "text", maxLength: 30 }, default: "15 min · same-day", group: "Map" },
    { key: "ring2Label", label: "Ring 2 label (middle)", type: { kind: "text", maxLength: 30 }, default: "30 min · next-day", group: "Map" },
    { key: "ring3Label", label: "Ring 3 label (outer)", type: { kind: "text", maxLength: 30 }, default: "45 min · scheduled", group: "Map" },
    { key: "pin1", label: "Pin 1 (top)", type: { kind: "text", maxLength: 20 }, default: "Harrogate", group: "Pins" },
    { key: "pin2", label: "Pin 2 (top-right)", type: { kind: "text", maxLength: 20 }, default: "York", group: "Pins" },
    { key: "pin3", label: "Pin 3 (bottom-right)", type: { kind: "text", maxLength: 20 }, default: "Selby", group: "Pins" },
    { key: "pin4", label: "Pin 4 (bottom)", type: { kind: "text", maxLength: 20 }, default: "Wakefield", group: "Pins" },
    { key: "pin5", label: "Pin 5 (bottom-left)", type: { kind: "text", maxLength: 20 }, default: "Huddersfield", group: "Pins" },
    { key: "pin6", label: "Pin 6 (top-left)", type: { kind: "text", maxLength: 20 }, default: "Bradford", group: "Pins" },
    { key: "chip1", label: "Chip 1", type: { kind: "text", maxLength: 40 }, default: "6 towns covered", group: "Chips" },
    { key: "chip2", label: "Chip 2", type: { kind: "text", maxLength: 40 }, default: "45 mins max", group: "Chips" },
    { key: "chip3", label: "Chip 3", type: { kind: "text", maxLength: 40 }, default: "No callout fee", group: "Chips" }
  ],
  animations: ["none", "pulse", "fade-in"],
  aiPrompts: {
    explain: "Explain when the Coverage Map hero works best.",
    improve: "Suggest which towns to pin.",
    rewrite: "Rewrite the headline for a local-first trade.",
    suggestAlternative: "Which hero would work for a national trade?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "map", "local", "coverage"],
  bestForVerticals: ["plumber", "electrician", "boiler-engineer", "mobile-mechanic", "locksmith", "building-merchant", "plant-hire", "landscaper"],
  defaultConfig: () => ({
    eyebrow: "Local, not national",
    heading: "We're on your patch.",
    subheading: "One yard, one crew, one radius. If you're inside our zone you get a quote back in minutes and a van at your door the same week.",
    primaryCtaLabel: "Am I in your zone?",
    primaryCtaHref: "#whatsapp",
    yardCity: "LEEDS",
    ring1Label: "15 min · same-day",
    ring2Label: "30 min · next-day",
    ring3Label: "45 min · scheduled",
    pin1: "Harrogate",
    pin2: "York",
    pin3: "Selby",
    pin4: "Wakefield",
    pin5: "Huddersfield",
    pin6: "Bradford",
    chip1: "6 towns covered",
    chip2: "45 mins max",
    chip3: "No callout fee"
  }),
  renderer: MapHero
};

sectionRegistry.register(registration);
