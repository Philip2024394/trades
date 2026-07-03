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
import type { ReactNode } from "react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import { iframeEmit } from "@/lib/studio/bus";
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
  backgroundImageUrl: string;
  locationLabel: string;
  pingXPercent: number;
  pingYPercent: number;
  chip1: string;
  chip2: string;
  chip3: string;
};

function MapHero({
  instanceId,
  config,
  tokens,
  data,
  mode
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

  const chips = [config.chip1, config.chip2, config.chip3].filter(
    (c) => c && c.trim().length > 0
  );

  // Clamp merchant-controlled ping coordinates to the visible area so a
  // typo can't push the beacon off-canvas. The Studio bus stores field
  // values as strings, so coerce to Number defensively before clamping.
  const rawX = Number(config.pingXPercent);
  const rawY = Number(config.pingYPercent);
  const pingX = Math.max(0, Math.min(100, Number.isFinite(rawX) ? rawX : 82));
  const pingY = Math.max(0, Math.min(100, Number.isFinite(rawY) ? rawY : 62));
  const PING_RED = "#EF4444";
  const isEditing = mode === "edit";

  // Emit a text-edit patch through the Studio postMessage bus so parent
  // Studio persists the new coordinate. Same commit path the toolbar
  // number-stepper uses — merchant hits an arrow, the value moves, live
  // preview + autosave both update.
  function nudge(axis: "x" | "y", direction: -1 | 1) {
    const current = axis === "x" ? pingX : pingY;
    const next = Math.max(0, Math.min(100, current + direction));
    iframeEmit.textEdit(
      instanceId,
      axis === "x" ? "pingXPercent" : "pingYPercent",
      String(next)
    );
  }

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        background: config.backgroundImageUrl ? "#000000" : bg,
        color: ink,
        fontFamily: bodyFont,
        minHeight: 520
      }}
      {...sectionRootAttrs(instanceId, "hero.map_hero_1", "Coverage Map Hero")}
    >
      {config.backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
          {...treeAttrs(instanceId, "backgroundImageUrl", "Background map", "image")}
        />
      )}
      {config.backgroundImageUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)"
          }}
        />
      )}

      {/* Red satellite ping — merchant nudges pingXPercent /
          pingYPercent from the Studio toolbar to move it up / down /
          left / right over the map. */}
      <div
        className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
        style={{ left: `${pingX}%`, top: `${pingY}%` }}
        {...treeAttrs(instanceId, "pingXPercent", "Ping position", "container")}
      >
        <span className="relative grid h-6 w-6 place-items-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{
              background: PING_RED,
              opacity: 0.35,
              animation: `map-ping-${instanceId} 2.4s ease-out infinite`
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-1 rounded-full"
            style={{
              background: PING_RED,
              opacity: 0.55,
              animation: `map-ping-${instanceId} 2.4s ease-out infinite`,
              animationDelay: "0.6s"
            }}
          />
          <span
            className="relative h-2.5 w-2.5 rounded-full"
            style={{
              background: PING_RED,
              boxShadow: `0 0 0 3px rgba(0,0,0,0.6), 0 0 18px ${PING_RED}`
            }}
          />
        </span>
        {config.locationLabel && (
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white"
            style={{
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)"
            }}
            {...treeAttrs(instanceId, "locationLabel", "Location label", "text")}
          >
            {config.locationLabel}
          </span>
        )}
        {isEditing && (
          <div
            className="pointer-events-auto mt-1 grid grid-cols-3 gap-0.5 rounded-lg border p-1"
            style={{
              background: "rgba(0,0,0,0.78)",
              borderColor: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)"
            }}
            aria-label="Nudge ping position"
          >
            <span />
            <NudgeButton label="Up" onClick={() => nudge("y", -1)}>
              <path d="m6 15 6-6 6 6" />
            </NudgeButton>
            <span />
            <NudgeButton label="Left" onClick={() => nudge("x", -1)}>
              <path d="m15 18-6-6 6-6" />
            </NudgeButton>
            <span
              className="grid h-6 w-6 place-items-center rounded-md text-[9px] font-extrabold text-white/70"
              aria-hidden="true"
            >
              {Math.round(pingX)},{Math.round(pingY)}
            </span>
            <NudgeButton label="Right" onClick={() => nudge("x", 1)}>
              <path d="m9 18 6-6-6-6" />
            </NudgeButton>
            <span />
            <NudgeButton label="Down" onClick={() => nudge("y", 1)}>
              <path d="m6 9 6 6 6-6" />
            </NudgeButton>
            <span />
          </div>
        )}
      </div>

      {/* Left-anchored copy column sitting over the map */}
      <div className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="max-w-xl">
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
                    background: "rgba(0,0,0,0.4)",
                    borderColor: "rgba(255,255,255,0.14)",
                    color: ink,
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)"
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: PING_RED }}
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
      </div>

      <style>{`
        @keyframes map-ping-${instanceId} {
          0%   { transform: scale(1);   opacity: 0.55; }
          70%  { transform: scale(3.6); opacity: 0;    }
          100% { transform: scale(3.6); opacity: 0;    }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes map-ping-${instanceId} {
            from { transform: none; opacity: 0.4; }
            to   { transform: none; opacity: 0.4; }
          }
        }
      `}</style>
    </section>
  );
}

// Small SVG arrow button used inside the in-editor nudge pad. Emits its
// click to the parent from within a pointer-events:auto container so
// the pad accepts clicks even though its wrapper is pointer-events:none.
function NudgeButton({
  label,
  onClick,
  children
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-6 w-6 place-items-center rounded-md text-white/90 transition hover:bg-white/10"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
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
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Local, not national", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 100 }, default: "We're on your patch.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "One yard, one crew, one radius. If you're inside our zone you get a quote back in minutes and a van at your door the same week.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label",label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Am I in your zone?", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href",label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "backgroundImageUrl", role: "background_media",label: "Map background photo", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1920 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_43_45%20PM.png", group: "Map", description: "The map image behind the hero. Any country / region map works." },
    { key: "locationLabel", role: "location_label",label: "Ping location label", type: { kind: "text", maxLength: 40 }, default: "London, UK", priority: "text", group: "Map", description: "The city or country the ping represents — free text, any country." },
    { key: "pingXPercent", label: "Ping X (left-right)", type: { kind: "number", min: 0, max: 100, step: 1, unit: "%" }, default: 82, group: "Map", description: "0 = far left · 100 = far right. Use the on-canvas arrow pad or the stepper arrows to nudge the ping." },
    { key: "pingYPercent", label: "Ping Y (up-down)", type: { kind: "number", min: 0, max: 100, step: 1, unit: "%" }, default: 62, group: "Map", description: "0 = top · 100 = bottom. Use the on-canvas arrow pad or the stepper arrows to nudge the ping." },
    { key: "chip1", role: "feature_line",label: "Chip 1", type: { kind: "text", maxLength: 40 }, default: "6 towns covered", group: "Chips" },
    { key: "chip2", role: "feature_line",label: "Chip 2", type: { kind: "text", maxLength: 40 }, default: "45 mins max", group: "Chips" },
    { key: "chip3", role: "feature_line",label: "Chip 3", type: { kind: "text", maxLength: 40 }, default: "No callout fee", group: "Chips" }
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
    backgroundImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_43_45%20PM.png",
    locationLabel: "London, UK",
    pingXPercent: 82,
    pingYPercent: 62,
    chip1: "6 towns covered",
    chip2: "45 mins max",
    chip3: "No callout fee"
  }),
  renderer: MapHero
};

sectionRegistry.register(registration);
