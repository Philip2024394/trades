// hero.animation_hero_1 — Animated Tool Hero.
//
// Trade-native "wow" hero. A giant animated tool illustration
// (hammer / hand saw / wrench / paintbrush / drill) performs its
// natural motion on the right side of the hero. Left side carries
// the copy + CTAs. The tool is the visual identity — nobody else in
// the trades UI space does this.
//
// Design principles applied:
//   • Pure SVG + CSS keyframes — zero JS, zero external deps
//   • Merchant picks their trade's tool via a select
//   • Each tool has a distinct motion natural to its use:
//       - Hammer: swing arc (rotate around grip)
//       - Hand saw: back-and-forth translate + subtle bob
//       - Wrench: 90° turning motion
//       - Paintbrush: sweep with paint trail
//       - Drill: constant bit spin, body still
//   • Animation speed configurable (slow / normal / fast)
//   • Respects prefers-reduced-motion (tool freezes in default pose)
//   • Optional spark/dust particles behind the working tool
//   • Sits on a bold industrial background with subtle grid + noise

"use client";

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type ToolKind = "hammer" | "saw" | "wrench" | "paintbrush" | "drill";
type Speed = "slow" | "normal" | "fast";

type Config = {
  eyebrow: string;
  heading: string;
  headingAccent: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  tool: ToolKind;
  animationSpeed: Speed;
  showParticles: boolean;
  surface: "dark" | "steel";
  chip1: string;
  chip2: string;
};

const SPEED_MS: Record<Speed, number> = {
  slow: 2400,
  normal: 1600,
  fast: 900
};

function AnimationHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";
  const bg = isDark
    ? "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)"
    : "linear-gradient(180deg, #1F1F1F 0%, #3D3D3D 100%)";
  const ink = "#FFFFFF";
  const muted = "rgba(255,255,255,0.72)";
  const border = "rgba(255,255,255,0.14)";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";
  const durationMs = SPEED_MS[config.animationSpeed] ?? SPEED_MS.normal;

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryHref =
    config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  // Split heading at accent word so the merchant can accent one word
  // in brand colour (mirrors the animated_gradient hero pattern).
  const accentWord = (config.headingAccent ?? "").trim();
  const heading = config.heading ?? "";
  const idx = accentWord
    ? heading.toLowerCase().indexOf(accentWord.toLowerCase())
    : -1;
  const before = idx >= 0 ? heading.slice(0, idx) : heading;
  const accentSlice = idx >= 0 ? heading.slice(idx, idx + accentWord.length) : "";
  const after = idx >= 0 ? heading.slice(idx + accentWord.length) : "";

  const uid = instanceId.replace(/[^a-zA-Z0-9]/g, "");

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "hero.animation_hero_1", "Animated Tool Hero")}
    >
      {/* Industrial grid backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }}
      />
      {/* Ambient accent glow behind the tool */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(50% 60% at 80% 50%, ${accent}22 0%, transparent 60%)`
        }}
      />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-12 lg:py-24">
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
            className="mt-4 text-4xl font-extrabold leading-[0.95] sm:text-5xl lg:text-7xl"
            style={{
              fontFamily: headingFont,
              letterSpacing: "-0.03em",
              textShadow: `0 4px 40px rgba(0,0,0,0.5)`
            }}
            {...treeAttrs(instanceId, "heading", "Headline", "text")}
          >
            {before}
            {accentSlice && (
              <span
                style={{
                  color: accent,
                  textShadow: `0 4px 40px ${accent}55`
                }}
              >
                {accentSlice}
              </span>
            )}
            {after}
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

          {(config.chip1 || config.chip2) && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {config.chip1 && (
                <li
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderColor: border,
                    color: ink
                  }}
                  {...treeAttrs(instanceId, "chip1", "Chip 1", "text")}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: accent }}
                    aria-hidden="true"
                  />
                  {config.chip1}
                </li>
              )}
              {config.chip2 && (
                <li
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderColor: border,
                    color: ink
                  }}
                  {...treeAttrs(instanceId, "chip2", "Chip 2", "text")}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: accent }}
                    aria-hidden="true"
                  />
                  {config.chip2}
                </li>
              )}
            </ul>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={primaryHref || "#"}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
              style={{
                background: accent,
                color: "#0A0A0A",
                boxShadow: `0 8px 24px ${accent}66`
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
                className="inline-flex h-14 items-center justify-center rounded-xl border px-6 text-[13px] font-extrabold uppercase tracking-widest transition hover:bg-white/5"
                style={{
                  borderColor: border,
                  color: ink,
                  background: "rgba(255,255,255,0.03)"
                }}
                {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
              >
                {config.secondaryCtaLabel}
              </Link>
            )}
          </div>
        </div>

        {/* RIGHT — the animated tool */}
        <div className="relative flex items-center justify-center">
          <div
            className="relative"
            style={{
              width: "min(90%, 420px)",
              aspectRatio: "1 / 1"
            }}
          >
            {/* Particle backdrop (dust / sparks) */}
            {config.showParticles && (
              <ParticleField uid={uid} accent={accent} tool={config.tool} durationMs={durationMs} />
            )}
            {/* The tool */}
            <ToolSvg
              tool={config.tool}
              accent={accent}
              uid={uid}
              durationMs={durationMs}
            />
          </div>
        </div>
      </div>

      <style>{buildKeyframes(uid, durationMs)}</style>
    </section>
  );
}

// ─── Tool SVGs ─────────────────────────────────────────────────────

function ToolSvg({
  tool,
  accent,
  uid,
  durationMs: _durationMs
}: {
  tool: ToolKind;
  accent: string;
  uid: string;
  durationMs: number;
}) {
  switch (tool) {
    case "hammer":
      return <HammerSvg accent={accent} uid={uid} />;
    case "saw":
      return <SawSvg accent={accent} uid={uid} />;
    case "wrench":
      return <WrenchSvg accent={accent} uid={uid} />;
    case "paintbrush":
      return <PaintbrushSvg accent={accent} uid={uid} />;
    case "drill":
      return <DrillSvg accent={accent} uid={uid} />;
    default:
      return <HammerSvg accent={accent} uid={uid} />;
  }
}

function HammerSvg({ accent, uid }: { accent: string; uid: string }) {
  // Hammer swings from a pivot at the grip end.
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-full w-full drop-shadow-2xl"
      aria-label="Hammer"
    >
      <g className={`hammer-${uid}`} style={{ transformOrigin: "290px 340px" }}>
        {/* Handle */}
        <rect
          x="230"
          y="200"
          width="18"
          height="150"
          rx="4"
          fill="url(#handle-grad)"
          transform="rotate(-25 239 275)"
        />
        {/* Grip */}
        <rect
          x="228"
          y="310"
          width="22"
          height="42"
          rx="3"
          fill="#0A0A0A"
          transform="rotate(-25 239 331)"
        />
        <rect
          x="228"
          y="312"
          width="22"
          height="2"
          fill={accent}
          opacity="0.7"
          transform="rotate(-25 239 313)"
        />
        <rect
          x="228"
          y="332"
          width="22"
          height="2"
          fill={accent}
          opacity="0.7"
          transform="rotate(-25 239 333)"
        />
        {/* Head */}
        <g transform="rotate(-25 155 175)">
          <path
            d="M 90 160 L 220 145 L 220 205 L 90 190 L 60 200 L 55 195 L 65 175 L 55 155 L 60 150 Z"
            fill="url(#steel-grad)"
            stroke="#0A0A0A"
            strokeWidth="2"
          />
          {/* Claw */}
          <path
            d="M 210 145 L 225 140 L 228 165 L 218 165 Z M 210 205 L 225 210 L 228 185 L 218 185 Z"
            fill="url(#steel-grad)"
            stroke="#0A0A0A"
            strokeWidth="2"
          />
          {/* Face highlight */}
          <ellipse cx="80" cy="175" rx="12" ry="18" fill="#0A0A0A" opacity="0.4" />
          <line x1="145" y1="150" x2="145" y2="200" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
        </g>
      </g>
      <defs>
        <linearGradient id="handle-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8B5A2B" />
          <stop offset="0.5" stopColor="#B87C4C" />
          <stop offset="1" stopColor="#6B4423" />
        </linearGradient>
        <linearGradient id="steel-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D4D4D4" />
          <stop offset="0.5" stopColor="#A3A3A3" />
          <stop offset="1" stopColor="#525252" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SawSvg({ accent, uid }: { accent: string; uid: string }) {
  // Hand saw slides back and forth horizontally.
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-full w-full drop-shadow-2xl"
      aria-label="Hand saw"
    >
      <g className={`saw-${uid}`}>
        {/* Blade */}
        <path
          d="M 40 200 L 260 200 L 260 240 L 40 240 Z"
          fill="url(#steel-grad-saw)"
          stroke="#0A0A0A"
          strokeWidth="2"
        />
        {/* Teeth */}
        <path
          d={teethPath(40, 240, 260, 8)}
          fill="url(#steel-grad-saw)"
          stroke="#0A0A0A"
          strokeWidth="1.5"
        />
        {/* Blade shine */}
        <line x1="60" y1="210" x2="240" y2="210" stroke="#FFFFFF" strokeWidth="1" opacity="0.35" />
        {/* Handle grip (right side) */}
        <path
          d="M 250 175 Q 340 175 340 220 Q 340 275 260 275 L 260 240 L 250 240 Z"
          fill="url(#wood-grad)"
          stroke="#0A0A0A"
          strokeWidth="2"
        />
        {/* Grip hole */}
        <ellipse cx="300" cy="220" rx="24" ry="30" fill="#0A0A0A" />
        <ellipse cx="300" cy="220" rx="20" ry="26" fill="url(#wood-shadow-grad)" />
        {/* Grip rivets */}
        <circle cx="278" cy="200" r="4" fill={accent} stroke="#0A0A0A" strokeWidth="1" />
        <circle cx="330" cy="245" r="4" fill={accent} stroke="#0A0A0A" strokeWidth="1" />
      </g>
      <defs>
        <linearGradient id="steel-grad-saw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E5E5E5" />
          <stop offset="0.5" stopColor="#B4B4B4" />
          <stop offset="1" stopColor="#6E6E6E" />
        </linearGradient>
        <linearGradient id="wood-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B87C4C" />
          <stop offset="1" stopColor="#6B4423" />
        </linearGradient>
        <linearGradient id="wood-shadow-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A2E15" />
          <stop offset="1" stopColor="#2A1808" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function WrenchSvg({ accent, uid }: { accent: string; uid: string }) {
  // Wrench rotates around its centre — like turning a bolt.
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-full w-full drop-shadow-2xl"
      aria-label="Wrench"
    >
      <g
        className={`wrench-${uid}`}
        style={{ transformOrigin: "200px 200px" }}
      >
        {/* Handle */}
        <rect
          x="70"
          y="185"
          width="220"
          height="30"
          rx="8"
          fill="url(#steel-grad-w)"
          stroke="#0A0A0A"
          strokeWidth="2"
        />
        {/* Handle shine */}
        <rect x="80" y="192" width="200" height="4" fill="#FFFFFF" opacity="0.35" rx="2" />
        {/* Head (jaw) — left end */}
        <g>
          <path
            d="M 40 180 Q 60 170 80 180 L 80 220 Q 60 230 40 220 Z"
            fill="url(#steel-grad-w)"
            stroke="#0A0A0A"
            strokeWidth="2"
          />
          {/* Jaw opening */}
          <path
            d="M 42 190 L 60 195 L 60 205 L 42 210 Z"
            fill="#0A0A0A"
          />
        </g>
        {/* Head (open end) — right end */}
        <g>
          <circle
            cx="315"
            cy="200"
            r="45"
            fill="url(#steel-grad-w)"
            stroke="#0A0A0A"
            strokeWidth="2"
          />
          <circle
            cx="315"
            cy="200"
            r="22"
            fill="#0A0A0A"
          />
          {/* 6-point socket inside */}
          <polygon
            points="315,182 331,192 331,208 315,218 299,208 299,192"
            fill="url(#steel-grad-w)"
          />
        </g>
        {/* Adjuster knob */}
        <rect
          x="70"
          y="175"
          width="15"
          height="50"
          rx="2"
          fill={accent}
          stroke="#0A0A0A"
          strokeWidth="1.5"
        />
      </g>
      <defs>
        <linearGradient id="steel-grad-w" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E5E5E5" />
          <stop offset="0.5" stopColor="#A3A3A3" />
          <stop offset="1" stopColor="#525252" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PaintbrushSvg({ accent, uid }: { accent: string; uid: string }) {
  // Brush sweeps down-right leaving a paint trail.
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-full w-full drop-shadow-2xl"
      aria-label="Paintbrush"
    >
      {/* Paint trail — appears BEHIND the brush */}
      <path
        className={`paint-trail-${uid}`}
        d="M 50 320 Q 200 260 350 320"
        fill="none"
        stroke={accent}
        strokeWidth="18"
        strokeLinecap="round"
        opacity="0.85"
      />
      <g className={`brush-${uid}`}>
        {/* Bristles */}
        <path
          d="M 190 210 L 290 210 L 275 260 L 205 260 Z"
          fill="url(#bristle-grad)"
          stroke="#0A0A0A"
          strokeWidth="2"
        />
        {/* Bristle strokes */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line
            key={i}
            x1={202 + i * 16}
            y1="215"
            x2={200 + i * 16}
            y2="257"
            stroke="#0A0A0A"
            strokeWidth="1.5"
            opacity="0.35"
          />
        ))}
        {/* Paint dab on tips */}
        <path
          d="M 200 258 Q 240 264 280 258 L 275 260 L 205 260 Z"
          fill={accent}
        />
        {/* Metal ferrule */}
        <rect
          x="185"
          y="170"
          width="110"
          height="45"
          fill="url(#metal-grad)"
          stroke="#0A0A0A"
          strokeWidth="2"
        />
        <rect x="188" y="173" width="104" height="4" fill="#FFFFFF" opacity="0.35" />
        <rect x="188" y="207" width="104" height="3" fill="#0A0A0A" opacity="0.4" />
        {/* Handle */}
        <path
          d="M 195 100 L 285 100 L 295 170 L 185 170 Z"
          fill="url(#handle-grad-brush)"
          stroke="#0A0A0A"
          strokeWidth="2"
        />
        {/* Handle end */}
        <ellipse cx="240" cy="100" rx="45" ry="12" fill="url(#handle-grad-brush)" stroke="#0A0A0A" strokeWidth="2" />
      </g>
      <defs>
        <linearGradient id="bristle-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F5D687" />
          <stop offset="1" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="metal-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D4D4D4" />
          <stop offset="0.5" stopColor="#A3A3A3" />
          <stop offset="1" stopColor="#737373" />
        </linearGradient>
        <linearGradient id="handle-grad-brush" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B87C4C" />
          <stop offset="1" stopColor="#6B4423" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function DrillSvg({ accent, uid }: { accent: string; uid: string }) {
  // Drill body stays static; only the drill bit spins.
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-full w-full drop-shadow-2xl"
      aria-label="Drill"
    >
      {/* Body */}
      <g>
        <rect
          x="70"
          y="150"
          width="180"
          height="100"
          rx="18"
          fill={accent}
          stroke="#0A0A0A"
          strokeWidth="2.5"
        />
        {/* Body detail lines */}
        <rect x="80" y="160" width="160" height="5" fill="#0A0A0A" opacity="0.2" />
        <rect x="80" y="230" width="160" height="5" fill="#0A0A0A" opacity="0.2" />
        {/* Trigger area */}
        <path
          d="M 135 250 L 175 250 L 175 320 Q 175 335 160 335 Q 150 335 148 325 L 145 260 Z"
          fill="#0A0A0A"
          stroke="#0A0A0A"
          strokeWidth="2"
        />
        {/* Battery pack at bottom */}
        <rect x="120" y="290" width="70" height="50" rx="6" fill="#1F1F1F" stroke="#0A0A0A" strokeWidth="2" />
        <rect x="128" y="298" width="54" height="8" rx="2" fill={accent} />
        {/* Chuck (bit holder) */}
        <rect x="245" y="170" width="55" height="60" rx="6" fill="url(#chuck-grad)" stroke="#0A0A0A" strokeWidth="2" />
        <line x1="245" y1="185" x2="300" y2="185" stroke="#0A0A0A" strokeWidth="1.5" opacity="0.5" />
        <line x1="245" y1="215" x2="300" y2="215" stroke="#0A0A0A" strokeWidth="1.5" opacity="0.5" />
        {/* Chuck jaws (small triangles at the tip) */}
        <polygon points="300,180 310,190 300,200" fill="url(#chuck-grad)" stroke="#0A0A0A" strokeWidth="1.5" />
        <polygon points="300,200 310,210 300,220" fill="url(#chuck-grad)" stroke="#0A0A0A" strokeWidth="1.5" />
        {/* Grip texture */}
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="145"
            y1={266 + i * 12}
            x2="175"
            y2={266 + i * 12}
            stroke={accent}
            strokeWidth="1.5"
            opacity="0.5"
          />
        ))}
      </g>
      {/* Drill bit — spins */}
      <g
        className={`drill-bit-${uid}`}
        style={{ transformOrigin: "355px 200px" }}
      >
        <rect x="308" y="196" width="94" height="8" fill="url(#chuck-grad)" stroke="#0A0A0A" strokeWidth="1.5" />
        {/* Spiral flutes */}
        <path
          d="M 310 200 Q 330 190 350 200 Q 370 210 390 200"
          fill="none"
          stroke="#0A0A0A"
          strokeWidth="2"
        />
        <path
          d="M 310 200 Q 330 210 350 200 Q 370 190 390 200"
          fill="none"
          stroke="#0A0A0A"
          strokeWidth="2"
        />
        {/* Tip */}
        <polygon points="390,196 402,200 390,204" fill="url(#chuck-grad)" stroke="#0A0A0A" strokeWidth="1.5" />
      </g>
      <defs>
        <linearGradient id="chuck-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D4D4D4" />
          <stop offset="0.5" stopColor="#A3A3A3" />
          <stop offset="1" stopColor="#525252" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Utilities ────────────────────────────────────────────────────

function teethPath(startX: number, y: number, endX: number, toothWidth: number): string {
  let d = `M ${startX} ${y} `;
  for (let x = startX; x < endX; x += toothWidth) {
    d += `L ${x + toothWidth / 2} ${y + 12} L ${x + toothWidth} ${y} `;
  }
  d += `L ${endX} ${y}`;
  return d;
}

function ParticleField({
  uid,
  accent,
  tool,
  durationMs
}: {
  uid: string;
  accent: string;
  tool: ToolKind;
  durationMs: number;
}) {
  // Small deterministic particle scatter, tinted per-tool
  // (sparks for metal, dust for wood, paint droplets for brush).
  const colour =
    tool === "paintbrush" ? accent : tool === "saw" ? "#B87C4C" : "#FFB300";
  const particles = Array.from({ length: 14 }, (_, i) => ({
    cx: 100 + ((i * 137) % 260),
    cy: 80 + ((i * 91) % 240),
    r: 2 + (i % 3),
    delay: (i * 90) % durationMs
  }));
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 400"
      aria-hidden="true"
    >
      {particles.map((p, i) => (
        <circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill={colour}
          className={`particle-${uid}`}
          style={{ animationDelay: `${p.delay}ms` }}
        />
      ))}
    </svg>
  );
}

function buildKeyframes(uid: string, ms: number): string {
  return `
    /* Hammer — swing arc down and back up */
    @keyframes hammer-swing-${uid} {
      0% { transform: rotate(0deg); }
      40% { transform: rotate(-45deg); }
      55% { transform: rotate(-42deg); }
      70% { transform: rotate(-5deg); }
      100% { transform: rotate(0deg); }
    }
    .hammer-${uid} { animation: hammer-swing-${uid} ${ms}ms cubic-bezier(0.4, 0, 0.6, 1) infinite; }

    /* Saw — back and forth */
    @keyframes saw-slide-${uid} {
      0%, 100% { transform: translateX(0) rotate(0deg); }
      50% { transform: translateX(-50px) rotate(-2deg); }
    }
    .saw-${uid} { animation: saw-slide-${uid} ${ms}ms ease-in-out infinite; }

    /* Wrench — 90° turn back to origin */
    @keyframes wrench-turn-${uid} {
      0% { transform: rotate(0deg); }
      50% { transform: rotate(60deg); }
      100% { transform: rotate(0deg); }
    }
    .wrench-${uid} { animation: wrench-turn-${uid} ${ms}ms cubic-bezier(0.7, 0, 0.3, 1) infinite; }

    /* Paintbrush — sweep down-right */
    @keyframes brush-sweep-${uid} {
      0%, 100% { transform: translate(0, 0) rotate(-6deg); }
      50% { transform: translate(60px, 40px) rotate(6deg); }
    }
    .brush-${uid} { animation: brush-sweep-${uid} ${ms}ms ease-in-out infinite; transform-origin: 240px 100px; }
    @keyframes paint-trail-${uid} {
      0%, 100% { stroke-dashoffset: 500; opacity: 0; }
      50% { stroke-dashoffset: 0; opacity: 0.85; }
    }
    .paint-trail-${uid} {
      stroke-dasharray: 500;
      animation: paint-trail-${uid} ${ms}ms ease-in-out infinite;
    }

    /* Drill bit — continuous fast spin */
    @keyframes drill-spin-${uid} {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .drill-bit-${uid} { animation: drill-spin-${uid} ${Math.max(300, Math.round(ms * 0.4))}ms linear infinite; }

    /* Particle fade */
    @keyframes particle-fade-${uid} {
      0%, 100% { opacity: 0; transform: translateY(0) scale(0.5); }
      30% { opacity: 0.9; transform: translateY(-8px) scale(1); }
      70% { opacity: 0.4; transform: translateY(-24px) scale(1.1); }
    }
    .particle-${uid} { animation: particle-fade-${uid} ${ms * 1.5}ms ease-out infinite; opacity: 0; }

    @media (prefers-reduced-motion: reduce) {
      .hammer-${uid},
      .saw-${uid},
      .wrench-${uid},
      .brush-${uid},
      .paint-trail-${uid},
      .drill-bit-${uid},
      .particle-${uid} { animation: none !important; }
    }
  `;
}

// ─── Registration ──────────────────────────────────────────────────

const registration: SectionRegistration<Config> = {
  id: "hero.animation_hero_1",
  name: "Animated Tool Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "The signature trade hero: a giant animated tool (hammer swings, saw slides, wrench turns, drill bit spins, paintbrush sweeps) on the right, headline + CTAs on the left. Pure SVG + CSS.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Real trade · Real tools · Real work", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", label: "Headline", type: { kind: "text", maxLength: 100 }, default: "The trade that gets it done.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "headingAccent", label: "Word in headline to accent", type: { kind: "text", maxLength: 40 }, default: "done", group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Tools in the van, plan in the head, boots on your driveway before the coffee's cold. That's the trade you booked.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Get a quote", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "See our work", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", label: "Secondary CTA link", type: { kind: "link" }, default: "#projects", group: "CTAs" },
    { key: "chip1", label: "Chip 1", type: { kind: "text", maxLength: 40 }, default: "12 years in trade", group: "Chips" },
    { key: "chip2", label: "Chip 2", type: { kind: "text", maxLength: 40 }, default: "£5m public liability", group: "Chips" },
    {
      key: "tool",
      label: "Tool animation",
      type: {
        kind: "select",
        options: [
          { value: "hammer", label: "Hammer (swing)" },
          { value: "saw", label: "Hand saw (back-and-forth)" },
          { value: "wrench", label: "Wrench (rotate)" },
          { value: "paintbrush", label: "Paintbrush (sweep)" },
          { value: "drill", label: "Drill (bit spin)" }
        ]
      },
      default: "hammer",
      group: "Animation"
    },
    {
      key: "animationSpeed",
      label: "Animation speed",
      type: {
        kind: "select",
        options: [
          { value: "slow", label: "Slow (2.4s)" },
          { value: "normal", label: "Normal (1.6s)" },
          { value: "fast", label: "Fast (0.9s)" }
        ]
      },
      default: "normal",
      group: "Animation"
    },
    { key: "showParticles", label: "Show particles / sparks", type: { kind: "boolean" }, default: true, group: "Animation" },
    { key: "surface", label: "Surface", type: { kind: "select", options: [{ value: "dark", label: "Onyx" }, { value: "steel", label: "Brushed steel" }] }, default: "dark", group: "Layout" }
  ],
  animations: ["swing", "slide", "rotate", "sweep", "spin"],
  aiPrompts: {
    explain: "Explain when the Animated Tool hero converts best.",
    improve: "Suggest which tool fits this merchant's trade.",
    rewrite: "Rewrite the headline in the trade's voice.",
    suggestAlternative: "Which hero would work for a merchant who wants a quieter aesthetic?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "animation", "trade-native", "signature"],
  bestForVerticals: ["carpenter", "joiner", "builder", "plumber", "electrician", "painter", "roofer", "landscape-designer", "handyman", "kitchen-fitter", "decorator"],
  defaultConfig: () => ({
    eyebrow: "Real trade · Real tools · Real work",
    heading: "The trade that gets it done.",
    headingAccent: "done",
    subheading: "Tools in the van, plan in the head, boots on your driveway before the coffee's cold. That's the trade you booked.",
    primaryCtaLabel: "Get a quote",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "See our work",
    secondaryCtaHref: "#projects",
    chip1: "12 years in trade",
    chip2: "£5m public liability",
    tool: "hammer",
    animationSpeed: "normal",
    showParticles: true,
    surface: "dark"
  }),
  renderer: AnimationHero
};

sectionRegistry.register(registration);
