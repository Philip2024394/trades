// src/lib/nex-native/chat-render/theme-world.tsx
//
// Shared theme rendering primitive · Phase 0 of the Themes Gallery
// redesign (founder-approved 2026-10-05, baseline commit 7fd561b7).
//
// Byte-equivalent copies of the wallpaper zone + ambient overlays +
// bubble shape helper from src/app/nex-native/chat/_portrait-bloom-shell.tsx
// (lines 798-847, 1920-1952, 3450-3792). Copied, not shared, so the
// live chat shell can keep running untouched until Phase 3 proves
// parity via the shadow route (/nex-native/dev/theme-world-shadow).
//
// Phase 0 contract · byte-equivalent output when given identical props.
// Phase 1 (gallery tiles) and Phase 2 (expanded preview) will layer in:
//   · size variants (overlay density scaled for tile vs chat)
//   · reduced-motion handling
//   · IntersectionObserver-gated overlay activation
// None of those live here yet · adding them before Phase 3 would risk
// the shadow test diverging from the shell's current behaviour.

import * as React from "react";

// ─── Types ──────────────────────────────────────────────────────────

export type BubblePreset =
  | "classic"
  | "pill"
  | "square"
  | "outlined"
  | "gradient";

export interface ParticleDriftConfig {
  color: string;
  count?: number;
  direction?: "up";
  size?: number;
  speedSeconds?: number;
}

export interface SparkleConfig {
  color: string;
  count?: number;
  size?: number;
  twinkleSeconds?: number;
}

export interface MistDriftConfig {
  color?: string;
  count?: number;
  size?: number;
  blur?: number;
  speedSeconds?: number;
}

export interface WallpaperConfig {
  moonGlow?: { x: string; y: string; size: number; color?: string };
  particleDrift?: ParticleDriftConfig;
  sparkle?: SparkleConfig;
  mistDrift?: MistDriftConfig;
  bubbleStyle?: { preset: BubblePreset };
}

// ─── Color helpers · byte-equivalent to shell L1928-1952 ────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

export function themeRimStrong(hex: string): string {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},0.85)`;
}

export function themeRimSoft(hex: string): string {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
}

// ─── ParticleDrift · byte-equivalent to shell L3458-3527 ────────────

export function ParticleDrift({
  config,
}: {
  config: ParticleDriftConfig;
}): React.JSX.Element {
  const count = Math.max(4, Math.min(48, config.count ?? 16));
  const size = Math.max(2, Math.min(10, config.size ?? 4));
  const speed = Math.max(6, Math.min(30, config.speedSeconds ?? 14));
  const color = config.color;
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

  const anim = `nex-drift-${Math.round(speed)}`;

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
          position: "absolute",
          inset: 0,
          zIndex: 2,
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
                background: color,
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

// ─── SparkleField · byte-equivalent to shell L3622-3680 ─────────────

export function SparkleField({
  config,
}: {
  config: SparkleConfig;
}): React.JSX.Element {
  const count = Math.max(6, Math.min(60, config.count ?? 24));
  const size = Math.max(2, Math.min(8, config.size ?? 3));
  const twinkle = Math.max(1.5, Math.min(8, config.twinkleSeconds ?? 3));
  const color = config.color;
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
        @keyframes nex-sparkle {
          0%, 100% { opacity: 0.15; transform: scale(0.9); }
          50%      { opacity: 1;    transform: scale(1.15); }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
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
              background: color,
              boxShadow: `0 0 ${size * 2}px ${color}`,
              transform: `scale(${s.scale})`,
              animation: `nex-sparkle ${twinkle}s ease-in-out infinite`,
              animationDelay: `-${s.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// ─── MistDrift · byte-equivalent to shell L3696-3793 ────────────────

export function MistDrift({
  config,
}: {
  config: MistDriftConfig;
}): React.JSX.Element {
  const color = config.color ?? "rgba(220,235,225,0.45)";
  const count = Math.max(4, Math.min(14, config.count ?? 8));
  const baseSize = Math.max(80, Math.min(260, config.size ?? 160));
  const blur = Math.max(16, Math.min(80, config.blur ?? 44));
  const speed = Math.max(10, Math.min(60, config.speedSeconds ?? 22));

  const blobs = React.useMemo(() => {
    let seed = 733333;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      scale: 0.7 + rand() * 0.7,
      xShift: (rand() - 0.5) * 16,
      delay: rand() * speed,
      dur: speed * (0.8 + rand() * 0.5),
      opacity: 0.35 + rand() * 0.5,
      tilt: (rand() - 0.5) * 8,
    }));
  }, [count, speed]);

  const anim = `nex-chat-mist-${Math.round(speed)}`;
  const haze = `nex-chat-mist-haze-${Math.round(speed)}`;
  return (
    <>
      <style>{`
        @keyframes ${anim} {
          0%   { transform: translate3d(0, 0, 0) scale(0.7) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          60%  { opacity: 0.5; }
          85%  { opacity: 0; }
          100% { transform: translate3d(var(--nx-x, 0px), -110vh, 0) scale(1.6) rotate(var(--nx-r, 0deg)); opacity: 0; }
        }
        @keyframes ${haze} {
          0%, 100% { opacity: 0.5; transform: scaleY(1); }
          50%      { opacity: 0.9; transform: scaleY(1.15); }
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
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 140,
            background: `linear-gradient(to top, ${color} 0%, transparent 100%)`,
            filter: `blur(${Math.round(blur * 0.6)}px)`,
            transformOrigin: "bottom center",
            animation: `${haze} ${Math.round(speed * 1.5)}s ease-in-out infinite`,
          }}
        />
        {blobs.map((b, i) => {
          const wW = baseSize * 0.55 * b.scale;
          const wH = baseSize * 1.4 * b.scale;
          return (
            <span
              key={i}
              style={
                {
                  position: "absolute",
                  left: `${b.left}%`,
                  bottom: 0,
                  width: wW,
                  height: wH,
                  borderRadius: "50%",
                  transformOrigin: "bottom center",
                  background: `radial-gradient(ellipse at center 90%, ${color} 0%, transparent 75%)`,
                  filter: `blur(${blur}px)`,
                  opacity: b.opacity,
                  animation: `${anim} ${b.dur}s linear infinite`,
                  animationDelay: `-${b.delay}s`,
                  willChange: "transform, opacity",
                  "--nx-x": `${b.xShift}vw`,
                  "--nx-r": `${b.tilt}deg`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>
    </>
  );
}

// ─── resolveBubbleShape · byte-equivalent to shell L3541-3620 ───────

export interface BubbleShapeInput {
  preset: BubblePreset;
  mine: boolean;
  deleted: boolean;
  bubbleRim: string;
  accentGlassMine: string;
  accentGlassPeer: string;
}

export interface BubbleShapeStyle {
  borderRadius: string;
  background: string;
  border: string;
  boxShadow: string;
}

export function resolveBubbleShape(
  input: BubbleShapeInput,
): BubbleShapeStyle {
  const { preset, mine, deleted, bubbleRim, accentGlassMine, accentGlassPeer } =
    input;

  if (deleted) {
    return {
      borderRadius:
        preset === "square" ? "4px" : preset === "pill" ? "20px" : "14px",
      background: "rgba(20,26,38,0.48)",
      border: "1px dashed rgba(139,169,209,0.35)",
      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
    };
  }

  const strongRim = themeRimStrong(bubbleRim);
  const softRim = "1px solid rgba(150,160,180,0.55)";
  const mineShadow =
    "0 0 14px rgba(0,159,239,0.25), 0 6px 20px rgba(0,0,0,0.45)";
  const peerShadow = "0 6px 22px rgba(0,0,0,0.55)";

  switch (preset) {
    case "pill":
      return {
        borderRadius: "24px",
        background: mine ? accentGlassMine : accentGlassPeer,
        border: mine ? `1px solid ${strongRim}` : softRim,
        boxShadow: mine ? mineShadow : peerShadow,
      };
    case "square":
      return {
        borderRadius: "4px",
        background: mine ? accentGlassMine : accentGlassPeer,
        border: mine ? `1px solid ${strongRim}` : softRim,
        boxShadow: mine ? mineShadow : peerShadow,
      };
    case "outlined":
      return {
        borderRadius: "12px",
        background: "rgba(2,9,20,0.30)",
        border: mine
          ? `1.5px solid ${strongRim}`
          : `1.5px solid rgba(150,160,180,0.7)`,
        boxShadow: mine
          ? "0 0 10px rgba(0,159,239,0.18)"
          : "0 4px 14px rgba(0,0,0,0.35)",
      };
    case "gradient":
      return {
        borderRadius: mine ? "16px 16px 6px 16px" : "16px 16px 16px 6px",
        background: mine
          ? `linear-gradient(135deg, ${themeRimStrong(bubbleRim)}55 0%, rgba(12,32,58,0.75) 60%)`
          : `linear-gradient(135deg, rgba(150,160,180,0.32) 0%, rgba(30,44,66,0.62) 60%)`,
        border: mine ? `1px solid ${strongRim}` : softRim,
        boxShadow: mine ? mineShadow : peerShadow,
      };
    case "classic":
    default:
      return {
        borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        background: mine ? accentGlassMine : accentGlassPeer,
        border: mine ? `1px solid ${strongRim}` : softRim,
        boxShadow: mine ? mineShadow : peerShadow,
      };
  }
}

// ─── ThemeWorld · wallpaper + scrim + overlays wrapper ──────────────
//
// Byte-equivalent to the wallpaper zone in shell L798-847. Children
// stack above the overlays. Caller controls the containing box · this
// primitive fills it via position:absolute inset:0 slabs.

export interface ThemeWorldProps {
  wallpaperUrl?: string | null;
  wallpaperConfig?: WallpaperConfig | null;
  /** When true, the wallpaper layer gets a grayscale(0.6) filter · used
   *  by the shell when the viewer is offline. Gallery/preview callers
   *  leave this false. */
  isOffline?: boolean;
  /** Phase 1 will use this to tune overlay density per surface size.
   *  Phase 0 ignores it so output matches the shell exactly. */
  size?: "tile" | "preview" | "chat";
  children?: React.ReactNode;
}

export function ThemeWorld({
  wallpaperUrl,
  wallpaperConfig,
  isOffline = false,
  children,
}: ThemeWorldProps): React.JSX.Element {
  return (
    <>
      {wallpaperUrl && (
        <>
          <div
            aria-hidden
            data-nex-theme-world="wallpaper"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${wallpaperUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              filter: `saturate(1.05)${isOffline ? " grayscale(0.6)" : ""}`,
              zIndex: 0,
            }}
          />
          <div
            aria-hidden
            data-nex-theme-world="scrim"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(2,9,20,0.08) 0%, rgba(2,9,20,0.14) 40%, rgba(2,9,20,0.32) 70%, rgba(2,9,20,0.6) 95%, rgba(2,9,20,0.78) 100%)",
              zIndex: 0,
            }}
          />
          {wallpaperConfig?.particleDrift && (
            <ParticleDrift config={wallpaperConfig.particleDrift} />
          )}
          {wallpaperConfig?.sparkle && (
            <SparkleField config={wallpaperConfig.sparkle} />
          )}
          {wallpaperConfig?.mistDrift && (
            <MistDrift config={wallpaperConfig.mistDrift} />
          )}
        </>
      )}
      {children}
    </>
  );
}

// ─── ThemeBubble · bubble primitive used at tile / preview / chat ───

export interface ThemeBubbleProps {
  preset: BubblePreset;
  mine: boolean;
  deleted?: boolean;
  bubbleRim: string;
  accentGlassMine: string;
  accentGlassPeer: string;
  /** Visual density · "tile" uses a smaller padding + font. Phase 0
   *  defaults to "chat" so output matches the shell when callers omit. */
  size?: "tile" | "preview" | "chat";
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function ThemeBubble({
  preset,
  mine,
  deleted = false,
  bubbleRim,
  accentGlassMine,
  accentGlassPeer,
  size = "chat",
  style,
  children,
}: ThemeBubbleProps): React.JSX.Element {
  const shape = resolveBubbleShape({
    preset,
    mine,
    deleted,
    bubbleRim,
    accentGlassMine,
    accentGlassPeer,
  });
  const sizing: React.CSSProperties =
    size === "tile"
      ? { padding: "4px 8px", fontSize: 9, maxWidth: "80%" }
      : size === "preview"
        ? { padding: "8px 12px", fontSize: 13, maxWidth: "72%" }
        : { padding: "9px 14px", fontSize: 14, maxWidth: "70%" };
  return (
    <div
      data-nex-theme-bubble={mine ? "mine" : "peer"}
      style={{
        ...shape,
        ...sizing,
        color: "#F4F7FC",
        alignSelf: mine ? "flex-end" : "flex-start",
        textShadow: "0 1px 4px rgba(0,0,0,0.55)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
