"use client";

// src/app/nex-native/_cover/theme-skin.tsx
//
// CoverThemeSkin · the ONE NEX IDENTITY doctrine primitive.
// -------------------------------------------------------------------
// Founder-sealed 2026-09-30. Every cover layout wraps in this. It:
//
//   · Pulls the account's chat_theme visual DNA (wallpaper, accent,
//     bubble preset, animation config, charm glyph identifier)
//   · Exposes CSS custom properties every downstream primitive reads
//   · Paints the wallpaper as page composition (not just background)
//     with a low-opacity fixed layer + scrim + theme-accent glow
//   · Fires the theme's animation overlay (moonGlow / particleDrift /
//     sparkle) so the cover feels alive · same code path as chat
//
// The result: a Pink Dream cover and a Pink Dream chat share the same
// wallpaper, accent, motion, and charm. Visitor lands on the cover,
// taps a product, enters the chat — zero visual context switch.
//
// Never introduce a page-specific palette or wallpaper inside a
// layout that wraps this skin. Everything flows down through CSS
// vars: --nex-accent, --nex-accent-soft, --nex-bg, --nex-panel,
// --nex-text, --nex-text-dim, --nex-card-radius, --nex-card-border,
// --nex-glow, --nex-font-display, --nex-font-body.

import * as React from "react";

export interface CoverThemeSkinProps {
  /** Theme accent hex from nex_chat_theme.accent_hex. */
  accentHex: string;
  /** Bubble-rim override (falls back to accent). */
  bubbleRimHex?: string | null;
  /** Composer-rim override (falls back to accent). */
  composerRimHex?: string | null;
  /** Wallpaper URL from nex_chat_theme.hero_image_url · null renders
   *  an accent-gradient fallback so the page never looks empty. */
  wallpaperUrl: string | null;
  /** Theme's wallpaper_config JSONB · drives motion overlays +
   *  bubbleStyle preset for downstream card shapes. */
  wallpaperConfig:
    | {
        moonGlow?: { x: string; y: string; size: number; color?: string };
        particleDrift?: {
          color: string;
          count?: number;
          direction?: "up";
          size?: number;
          speedSeconds?: number;
        };
        sparkle?: {
          color: string;
          count?: number;
          size?: number;
          twinkleSeconds?: number;
        };
        mistDrift?: {
          /** Fog colour · rgba recommended so blob edges bleed to
           *  transparent. Defaults to a cool white when omitted. */
          color?: string;
          /** Number of concurrent fog blobs · 4-14 · default 8. */
          count?: number;
          /** Average blob diameter (px) · 80-260 · default 160. */
          size?: number;
          /** Blur radius (px) so each blob reads as fog not a disc ·
           *  default 44. */
          blur?: number;
          /** Seconds a single blob takes to rise from below the
           *  footer to above the header · default 22. */
          speedSeconds?: number;
        };
        bubbleStyle?: {
          preset: "classic" | "pill" | "square" | "outlined" | "gradient";
        };
      }
    | null;
  /** Theme id · used to pick a charm glyph (heart · camera · </> ·
   *  palette · bunny · etc.) that decorates the identity badge in
   *  every layout. */
  themeId: string;
  /** The rendered layout id · so the wrapper can data-attribute the
   *  root for telemetry ("cover_layout=cafe theme=pink-dream"). */
  layoutId: string | null;
  children: React.ReactNode;
}

/** Derive an rgba string at a specific alpha from a hex. Handles
 *  #rgb and #rrggbb. Returns the input untouched for CSS strings
 *  that already carry alpha (rgba / hsla). */
function hexAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith("#")) return hex;
  const s = hex.slice(1);
  const full =
    s.length === 3
      ? s.split("").map((c) => c + c).join("")
      : s.padEnd(6, "0").slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Bubble-preset → card CSS the primitives read via --nex-card-radius
 *  and --nex-card-border. Kept in one place so every primitive
 *  respects the theme's card personality without importing shell code. */
function cardTokensForPreset(
  preset: "classic" | "pill" | "square" | "outlined" | "gradient" | undefined,
  accent: string,
): { radius: string; border: string; background: string } {
  switch (preset) {
    case "pill":
      return {
        radius: "22px",
        border: `1px solid ${hexAlpha(accent, 0.35)}`,
        background: `linear-gradient(180deg, ${hexAlpha(accent, 0.08)}, rgba(6,10,20,0.55))`,
      };
    case "square":
      return {
        radius: "4px",
        border: `1px solid ${hexAlpha(accent, 0.35)}`,
        background: `linear-gradient(180deg, ${hexAlpha(accent, 0.06)}, rgba(6,10,20,0.6))`,
      };
    case "outlined":
      return {
        radius: "12px",
        border: `1.5px solid ${hexAlpha(accent, 0.75)}`,
        background: "rgba(6,10,20,0.35)",
      };
    case "gradient":
      return {
        radius: "16px",
        border: `1px solid ${hexAlpha(accent, 0.4)}`,
        background: `linear-gradient(135deg, ${hexAlpha(accent, 0.28)} 0%, rgba(10,14,26,0.72) 60%)`,
      };
    case "classic":
    default:
      return {
        radius: "14px",
        border: `1px solid ${hexAlpha(accent, 0.42)}`,
        background: "rgba(10,14,26,0.6)",
      };
  }
}

export function CoverThemeSkin(props: CoverThemeSkinProps): React.JSX.Element {
  const {
    accentHex,
    bubbleRimHex,
    composerRimHex,
    wallpaperUrl,
    wallpaperConfig,
    themeId,
    layoutId,
    children,
  } = props;

  const bubbleRim = bubbleRimHex ?? accentHex;
  const composerRim = composerRimHex ?? accentHex;
  const cardTokens = cardTokensForPreset(
    wallpaperConfig?.bubbleStyle?.preset,
    accentHex,
  );

  // CSS custom properties every cover primitive reads. Themed as
  // "the doctrine substrate" · downstream components ONLY reference
  // these, never hardcode palette values.
  const styleVars = {
    "--nex-accent": accentHex,
    "--nex-accent-soft": hexAlpha(accentHex, 0.45),
    "--nex-accent-faint": hexAlpha(accentHex, 0.12),
    "--nex-accent-glow": hexAlpha(accentHex, 0.25),
    "--nex-bubble-rim": bubbleRim,
    "--nex-composer-rim": composerRim,
    "--nex-bg": "#050b18",
    "--nex-panel": "#0a1120",
    "--nex-text": "#F2F5F8",
    "--nex-text-dim": "#8CA5C7",
    "--nex-card-radius": cardTokens.radius,
    "--nex-card-border": cardTokens.border,
    "--nex-card-bg": cardTokens.background,
    "--nex-font-display":
      "'Manrope', 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
    "--nex-font-body":
      "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  } as React.CSSProperties;

  const bgLayer: React.CSSProperties = wallpaperUrl
    ? {
        backgroundImage: `url(${wallpaperUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : {
        background: `radial-gradient(120% 80% at 50% 0%, ${hexAlpha(accentHex, 0.32)} 0%, rgba(6,10,20,0.85) 55%, #030812 100%)`,
      };

  return (
    <>
      <style>{`
        [data-nex-cover-skin] {
          font-family: var(--nex-font-body);
          color: var(--nex-text);
          background: var(--nex-bg);
        }
        [data-nex-cover-skin] * { box-sizing: border-box; }
        [data-nex-cover-skin] a { color: inherit; }
        @keyframes nex-cover-kenburns {
          0%   { transform: scale(1.06) translate3d(0, 0, 0); }
          100% { transform: scale(1.14) translate3d(-2%, -1%, 0); }
        }
        @keyframes nex-cover-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.03); }
        }
        @keyframes nex-cover-rise-in {
          0%   { opacity: 0; transform: translate3d(0, 12px, 0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        [data-nex-cover-rise] {
          animation: nex-cover-rise-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        /* Founder direction 2026-09-30 · hide every scrollbar inside
           any cover surface (main scroll + all nested containers).
           Keeps the visual language calm and clean · scrolling still
           works via touch, wheel, keyboard. Firefox/IE via scrollbar-
           width + -ms-overflow-style · WebKit via ::-webkit-scrollbar. */
        [data-nex-cover-skin], [data-nex-cover-skin] * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        [data-nex-cover-skin]::-webkit-scrollbar,
        [data-nex-cover-skin] *::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
        /* CoverInfoTray body opts in via data-nex-cover-scroll="thin".
           Compact accent-tinted vertical thumb only · no track fill ·
           natural browser behaviour keeps the thumb short when there
           is little overflow. */
        [data-nex-cover-scroll="thin"] {
          scrollbar-width: thin;
          scrollbar-color: var(--nex-accent-soft, rgba(148,163,184,0.35))
                           transparent;
        }
        [data-nex-cover-scroll="thin"]::-webkit-scrollbar {
          width: 4px;
          height: 4px;
          display: block;
        }
        [data-nex-cover-scroll="thin"]::-webkit-scrollbar-track {
          background: transparent;
        }
        [data-nex-cover-scroll="thin"]::-webkit-scrollbar-thumb {
          background: var(--nex-accent-soft, rgba(148,163,184,0.35));
          border-radius: 4px;
        }
      `}</style>

      <div
        data-nex-cover-skin
        data-nex-cover-layout={layoutId ?? undefined}
        data-nex-cover-theme={themeId}
        style={{
          ...styleVars,
          position: "relative",
          minHeight: "100dvh",
          overflow: "hidden",
        }}
      >
        {/* Wallpaper composition · fixed to the phone-screen containing
            block (phone-device applies transform:translateZ(0) in preview
            so fixed descendants scope to it; in production fixed pins to
            the browser viewport = the full phone screen). Low opacity so
            copy stays legible but the image is part of the visual
            language, not a stock backdrop. Ken Burns slow drift adds
            life without stealing attention. */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            opacity: wallpaperUrl ? 0.35 : 1,
            animation: wallpaperUrl
              ? "nex-cover-kenburns 26s ease-in-out infinite alternate"
              : undefined,
            filter: "saturate(1.05) contrast(1.02)",
            ...bgLayer,
          }}
        />

        {/* Legibility scrim · deeper at top and bottom so header and
            sticky bar always read cleanly regardless of wallpaper. */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            background:
              "linear-gradient(180deg, rgba(3,8,20,0.72) 0%, rgba(3,8,20,0.32) 22%, rgba(3,8,20,0.32) 78%, rgba(3,8,20,0.82) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Accent glow · a subtle radial tint anchored top-centre so
            the hero identity block always feels lit by the theme
            colour. Uses --nex-accent-glow so a theme change repaints
            the whole page's atmosphere. */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            background:
              "radial-gradient(60% 40% at 50% 8%, var(--nex-accent-glow), transparent 65%)",
            pointerEvents: "none",
          }}
        />

        {/* Motion overlays · same code path as PortraitBloomShell so
            wallpaper animation is identical across chat + cover. Only
            renders when the theme has opted in. */}
        {wallpaperConfig?.particleDrift && (
          <ParticleDrift config={wallpaperConfig.particleDrift} />
        )}
        {wallpaperConfig?.sparkle && (
          <SparkleField config={wallpaperConfig.sparkle} />
        )}
        {wallpaperConfig?.moonGlow && (
          <MoonGlow config={wallpaperConfig.moonGlow} />
        )}
        {wallpaperConfig?.mistDrift && (
          <MistDrift config={wallpaperConfig.mistDrift} />
        )}

        {/* Content · z-index 1 so it sits above the atmosphere layers.
            Every layout composes its own hierarchy here. */}
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    </>
  );
}

// ─── Motion overlays (mirror of PortraitBloomShell keys) ─────────────

interface ParticleDriftConfig {
  color: string;
  count?: number;
  direction?: "up";
  size?: number;
  speedSeconds?: number;
}

function ParticleDrift({ config }: { config: ParticleDriftConfig }): React.JSX.Element {
  const count = Math.max(4, Math.min(48, config.count ?? 16));
  const size = Math.max(2, Math.min(10, config.size ?? 4));
  const speed = Math.max(6, Math.min(30, config.speedSeconds ?? 14));
  const particles = React.useMemo(() => {
    let seed = 424242;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      delay: rand() * speed,
      xShift: (rand() - 0.5) * 40,
      opacity: 0.35 + rand() * 0.45,
      scale: 0.7 + rand() * 0.7,
    }));
  }, [count, speed]);
  const anim = `nex-cover-drift-${Math.round(speed)}`;
  return (
    <>
      <style>{`
        @keyframes ${anim} {
          0%   { transform: translate3d(0, 40px, 0); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 0.6; }
          100% { transform: translate3d(var(--nx-x, 0px), -110%, 0); opacity: 0; }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {particles.map((p, i) => (
          <span
            key={i}
            style={
              {
                position: "absolute",
                left: `${p.left}%`,
                bottom: -12,
                width: size,
                height: size,
                borderRadius: "50%",
                background: config.color,
                filter: `blur(${size / 4}px)`,
                opacity: p.opacity,
                transform: `scale(${p.scale})`,
                animation: `${anim} ${speed}s linear infinite`,
                animationDelay: `-${p.delay}s`,
                "--nx-x": `${p.xShift}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </>
  );
}

interface SparkleConfig {
  color: string;
  count?: number;
  size?: number;
  twinkleSeconds?: number;
}

function SparkleField({ config }: { config: SparkleConfig }): React.JSX.Element {
  const count = Math.max(6, Math.min(60, config.count ?? 24));
  const size = Math.max(2, Math.min(8, config.size ?? 3));
  const twinkle = Math.max(1.5, Math.min(8, config.twinkleSeconds ?? 3));
  const stars = React.useMemo(() => {
    let seed = 91827;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      top: rand() * 100,
      delay: rand() * twinkle * 2,
      scale: 0.6 + rand() * 0.8,
    }));
  }, [count, twinkle]);
  return (
    <>
      <style>{`
        @keyframes nex-cover-sparkle {
          0%, 100% { opacity: 0.15; transform: scale(0.9); }
          50%      { opacity: 1;    transform: scale(1.15); }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {stars.map((s, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: config.color,
              boxShadow: `0 0 ${size * 2}px ${config.color}`,
              transform: `scale(${s.scale})`,
              animation: `nex-cover-sparkle ${twinkle}s ease-in-out infinite`,
              animationDelay: `-${s.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

function MoonGlow({
  config,
}: {
  config: { x: string; y: string; size: number; color?: string };
}): React.JSX.Element {
  return (
    <>
      <style>{`
        @keyframes nex-cover-moon {
          0%, 100% { opacity: 0.45; transform: translate(-50%, -50%) scale(1); }
          50%      { opacity: 0.85; transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: config.x,
          top: config.y,
          width: config.size,
          height: config.size,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${config.color ?? "rgba(255,255,255,0.55)"} 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          animation: "nex-cover-moon 6s ease-in-out infinite",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </>
  );
}

// ─── MistDrift · Founder-sealed 2026-09-30 · Theme 0 ─────────────────
// Randomised fog blobs rise from below the composer up past the top of
// the phone screen, drift lightly sideways as they climb, fade in
// during the first 20% of their travel and fade out during the last
// 25%. Reads as ambient smoke / mist / vapour on a dark cover ·
// especially fitting for Theme 0 (Joker alley · toxic-green smoke).

interface MistDriftConfig {
  color?: string;
  count?: number;
  size?: number;
  blur?: number;
  speedSeconds?: number;
}

function MistDrift({ config }: { config: MistDriftConfig }): React.JSX.Element {
  const color = config.color ?? "rgba(220,235,225,0.45)";
  const count = Math.max(4, Math.min(14, config.count ?? 8));
  const baseSize = Math.max(80, Math.min(260, config.size ?? 160));
  const blur = Math.max(16, Math.min(80, config.blur ?? 44));
  const speed = Math.max(10, Math.min(60, config.speedSeconds ?? 22));

  // Deterministic pseudo-random so SSR + hydration match. Same seed
  // pattern as the ParticleDrift / SparkleField overlays.
  const blobs = React.useMemo(() => {
    let seed = 733333;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      // Blob size varies 70%-140% of base so the wall doesn't read
      // like a repeating pattern.
      scale: 0.7 + rand() * 0.7,
      // Lateral drift · -10% to +10% of viewport width across the
      // whole rise so blobs don't move in a rigid column.
      xShift: (rand() - 0.5) * 20,
      // Stagger blob start times across the whole cycle.
      delay: rand() * speed,
      // Each blob picks a slightly different speed so they don't
      // rise in lockstep.
      dur: speed * (0.75 + rand() * 0.5),
      // Vary the peak opacity per blob so some read as denser fog
      // than others.
      opacity: 0.35 + rand() * 0.45,
    }));
  }, [count, speed]);

  const anim = `nex-cover-mist-${Math.round(speed)}`;
  return (
    <>
      <style>{`
        @keyframes ${anim} {
          0%   { transform: translate3d(0, 30%, 0) scale(0.9);  opacity: 0; }
          20%  { opacity: 1; }
          75%  { opacity: 0.6; }
          100% { transform: translate3d(var(--nx-x, 0px), -140%, 0) scale(1.25); opacity: 0; }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {blobs.map((b, i) => {
          const w = baseSize * b.scale;
          return (
            <span
              key={i}
              style={
                {
                  position: "absolute",
                  left: `${b.left}%`,
                  // Start below the visible cover so first frame is
                  // already off-screen (no pop-in on load).
                  bottom: -w * 0.4,
                  width: w,
                  height: w,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                  filter: `blur(${blur}px)`,
                  opacity: b.opacity,
                  animation: `${anim} ${b.dur}s linear infinite`,
                  animationDelay: `-${b.delay}s`,
                  willChange: "transform, opacity",
                  "--nx-x": `${b.xShift}vw`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>
    </>
  );
}
