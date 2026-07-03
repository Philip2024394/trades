// hero.cursor_spotlight_1 — Cursor Spotlight Hero.
//
// The cursor becomes a torch: a radial gradient follows the mouse and
// reveals the copy underneath a nearly-black overlay. Text stays legible
// even outside the beam thanks to a subtle base opacity — the spotlight
// intensifies rather than hides.
//
// Design principles applied:
//   • Interactive delight: hover moves the beam, the merchant's headline
//     lights up under the cursor
//   • Works on touch: no cursor → the spotlight settles at the centre so
//     the effect still reads
//   • Respects prefers-reduced-motion: static full-brightness fallback
//   • Beam colour reads from brand accent tokens
//   • Every merchant edit stays live-editable in the toolbar

"use client";

import { useEffect, useRef, useState } from "react";
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
  beamRadius: number;
  beamIntensity: number;
  darknessLevel: number;
  backgroundImageUrl: string;
  imageOpacity: number;
  showGuidance: boolean;
  guidanceCopy: string;
  chip1: string;
  chip2: string;
  chip3: string;
};

function CursorSpotlightHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
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

  const sectionRef = useRef<HTMLElement | null>(null);
  const [beam, setBeam] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false
  });

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    function handle(e: MouseEvent) {
      const rect = section!.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setBeam({ x, y, active: true });
    }
    function handleLeave() {
      setBeam((b) => ({ ...b, active: false }));
    }
    section.addEventListener("mousemove", handle);
    section.addEventListener("mouseleave", handleLeave);
    return () => {
      section.removeEventListener("mousemove", handle);
      section.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  const radius = Math.max(15, Math.min(80, config.beamRadius));
  const intensity = Math.max(0.3, Math.min(1, config.beamIntensity));
  const darkness = Math.max(0, Math.min(0.95, config.darknessLevel));
  const uid = instanceId.replace(/[^a-zA-Z0-9]/g, "");

  const chips = [config.chip1, config.chip2, config.chip3].filter(
    (c) => c && c.trim().length > 0
  );

  return (
    <section
      ref={sectionRef}
      className="relative isolate w-full overflow-hidden"
      style={{
        background: "#000000",
        color: "#FFFFFF",
        fontFamily: bodyFont,
        cursor: "none"
      }}
      {...sectionRootAttrs(instanceId, "hero.cursor_spotlight_1", "Cursor Spotlight Hero")}
    >
      {/* Background image — revealed by the cursor spotlight.
          The image sits at z-index: 0 so the spotlight overlay (z:5)
          poke-a-hole gradient reveals it under the beam. */}
      {config.backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{
            opacity: Math.max(0.3, Math.min(1, config.imageOpacity ?? 1)),
            zIndex: 0
          }}
          {...treeAttrs(instanceId, "backgroundImageUrl", "Background image", "image")}
        />
      )}

      {/* Ambient grid — barely visible, adds texture over the image.
          Sits between image (z:0) and spotlight overlay (z:5). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          zIndex: 1
        }}
      />

      {/* The spotlight overlay — darkens everything except the beam area */}
      <div
        aria-hidden="true"
        className={`spotlight-${uid} pointer-events-none absolute inset-0`}
        style={{
          background: `radial-gradient(${radius}% ${radius * 1.2}% at ${beam.x}% ${beam.y}%,
            transparent 0%,
            rgba(0,0,0,${darkness * 0.4}) 30%,
            rgba(0,0,0,${darkness * 0.8}) 60%,
            rgba(0,0,0,${darkness}) 100%)`,
          transition: beam.active
            ? "background 60ms linear"
            : "background 500ms cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 5
        }}
      />

      {/* Beam accent glow (soft brand-coloured aura at the centre) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: `${beam.x}%`,
          top: `${beam.y}%`,
          width: `${radius * 3}px`,
          height: `${radius * 3}px`,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(closest-side, ${accent}${Math.round(intensity * 30).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
          transition: beam.active
            ? "left 60ms linear, top 60ms linear"
            : "left 500ms cubic-bezier(0.4, 0, 0.2, 1), top 500ms cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 6,
          mixBlendMode: "screen"
        }}
      />

      {/* Custom cursor dot */}
      <div
        aria-hidden="true"
        className={`cursor-dot-${uid} pointer-events-none absolute`}
        style={{
          left: `${beam.x}%`,
          top: `${beam.y}%`,
          width: 44,
          height: 44,
          transform: "translate(-50%, -50%)",
          border: `2px solid ${accent}`,
          borderRadius: "50%",
          zIndex: 10,
          transition: beam.active
            ? "left 60ms linear, top 60ms linear, opacity 200ms ease"
            : "opacity 200ms ease",
          opacity: beam.active ? 1 : 0
        }}
      />

      {/* Main content — always visible but pops under the beam */}
      <div
        className="relative mx-auto max-w-4xl px-5 py-24 text-center sm:px-6 sm:py-32"
        style={{ zIndex: 4 }}
      >
        {config.eyebrow && (
          <p
            className="mb-6 text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: accent }}
            {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
          >
            {config.eyebrow}
          </p>
        )}

        <h1
          className="text-5xl font-extrabold leading-[0.95] sm:text-7xl md:text-8xl"
          style={{
            fontFamily: headingFont,
            letterSpacing: "-0.03em",
            color: "#FFFFFF",
            textShadow: config.backgroundImageUrl
              ? `0 4px 24px rgba(0,0,0,0.85), 0 0 60px ${accent}55`
              : `0 0 40px ${accent}44`
          }}
          {...treeAttrs(instanceId, "heading", "Headline", "text")}
        >
          {config.heading}
        </h1>

        {config.subheading && (
          <p
            className="mx-auto mt-8 max-w-2xl text-[15px] leading-relaxed text-white/85 sm:text-[18px]"
            {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
          >
            {config.subheading}
          </p>
        )}

        {chips.length > 0 && (
          <ul className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-2">
            {chips.map((c, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-sm"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  borderColor: "rgba(255,255,255,0.16)",
                  color: "#FFFFFF"
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

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={primaryHref || "#"}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
            style={{
              background: accent,
              color: "#0A0A0A",
              boxShadow: `0 8px 24px ${accent}66`,
              cursor: "none"
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
              className="inline-flex h-14 items-center justify-center rounded-xl border px-6 text-[13px] font-extrabold uppercase tracking-widest backdrop-blur-md transition"
              style={{
                borderColor: "rgba(255,255,255,0.3)",
                color: "#FFFFFF",
                background: "rgba(255,255,255,0.05)",
                cursor: "none"
              }}
              {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
            >
              {config.secondaryCtaLabel}
            </Link>
          )}
        </div>

        {config.showGuidance && (
          <p
            className="mt-16 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-white/50 sm:text-[11px]"
            {...treeAttrs(instanceId, "guidanceCopy", "Guidance", "text")}
          >
            <MouseIcon />
            <span>{config.guidanceCopy}</span>
          </p>
        )}
      </div>

      {/* Reduced-motion fallback: kill the spotlight, show everything */}
      <style>{`
        @media (prefers-reduced-motion: reduce), (pointer: coarse) {
          .spotlight-${uid} {
            background: transparent !important;
          }
          .cursor-dot-${uid} {
            display: none !important;
          }
        }
      `}</style>
    </section>
  );
}

function MouseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="6" />
      <line x1="12" y1="6" x2="12" y2="10" />
    </svg>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.cursor_spotlight_1",
  name: "Cursor Spotlight Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Interactive spotlight follows the cursor and lights up the copy underneath a nearly-black overlay. Custom cursor ring. Falls back to fully-lit on touch devices.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Move your cursor to explore", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Trust in the dark.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 240, multiline: true }, default: "24-hour emergency callouts, real engineers on the phone, and a written guarantee on every job. The kind of trade you can count on when the lights go out.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label",label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Get a quote", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href",label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", role: "secondary_action_label",label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "See our work", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", role: "secondary_action_href",label: "Secondary CTA link", type: { kind: "link" }, default: "#projects", group: "CTAs" },
    { key: "beamRadius", label: "Spotlight size (%)", type: { kind: "number", min: 15, max: 80, step: 5 }, default: 40, group: "Spotlight" },
    { key: "beamIntensity", label: "Beam glow intensity", type: { kind: "number", min: 0.3, max: 1, step: 0.1 }, default: 0.7, group: "Spotlight" },
    { key: "darknessLevel", label: "Overlay darkness", type: { kind: "number", min: 0, max: 0.95, step: 0.05 }, default: 0, group: "Spotlight", description: "0 = image fully visible (recommended when using a background image). Turn up for the classic torch-in-the-dark effect." },
    { key: "backgroundImageUrl", role: "background_media",label: "Background image URL", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1920 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2009_14_47%20AM.png", group: "Background image", description: "Revealed by the cursor spotlight. Recommended 1920x1080, under 500KB. Leave empty for pure black background." },
    { key: "imageOpacity", label: "Image base brightness", type: { kind: "number", min: 0.3, max: 1, step: 0.05 }, default: 1, group: "Background image", description: "1 = full brightness (dramatic reveal). Lower = image feels more embedded in the darkness." },
    { key: "showGuidance", label: "Show 'move your cursor' hint", type: { kind: "boolean" }, default: true, group: "Guidance" },
    { key: "guidanceCopy", label: "Guidance copy", type: { kind: "text", maxLength: 60 }, default: "Move your cursor across the screen", group: "Guidance" },
    { key: "chip1", role: "feature_line",label: "Chip 1", type: { kind: "text", maxLength: 40 }, default: "24/7 emergency", group: "Chips" },
    { key: "chip2", role: "feature_line",label: "Chip 2", type: { kind: "text", maxLength: 40 }, default: "£5m insured", group: "Chips" },
    { key: "chip3", role: "feature_line",label: "Chip 3", type: { kind: "text", maxLength: 40 }, default: "12-month guarantee", group: "Chips" }
  ],
  animations: ["spotlight", "cursor-follow"],
  aiPrompts: {
    explain: "Explain when the Cursor Spotlight hero converts best.",
    improve: "Suggest headline that hints at the spotlight metaphor.",
    rewrite: "Rewrite for a trade whose value proposition includes emergency callouts.",
    suggestAlternative: "Which hero would work for a merchant on a mostly-mobile audience?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "interactive", "spotlight", "cursor"],
  bestForVerticals: ["electrician", "boiler-engineer", "locksmith", "gas-engineer", "roofer", "security-installer"],
  defaultConfig: () => ({
    eyebrow: "Move your cursor to explore",
    heading: "Trust in the dark.",
    subheading: "24-hour emergency callouts, real engineers on the phone, and a written guarantee on every job. The kind of trade you can count on when the lights go out.",
    primaryCtaLabel: "Get a quote",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "See our work",
    secondaryCtaHref: "#projects",
    beamRadius: 40,
    beamIntensity: 0.7,
    darknessLevel: 0,
    backgroundImageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2009_14_47%20AM.png",
    imageOpacity: 1,
    showGuidance: true,
    guidanceCopy: "Move your cursor across the screen",
    chip1: "24/7 emergency",
    chip2: "£5m insured",
    chip3: "12-month guarantee"
  }),
  renderer: CursorSpotlightHero
};

sectionRegistry.register(registration);
