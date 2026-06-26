// Xrated Trades — absolutely-positioned hero text for the cover image.
// Caller owns the cover container (`relative`); we just paint the text.
// CSS-only animations so this stays a server component.

import type { HeroTextEffect } from "@/lib/xratedTrades";

export function HeroTextOverlay({
  line1,
  line2,
  line2Color,
  tagline,
  effect
}: {
  line1: string | null;
  line2: string | null;
  line2Color: string | null;
  tagline: string | null;
  effect: HeroTextEffect;
}) {
  const hasAny = !!(line1 || line2 || tagline);
  if (!hasAny) return null;

  const colour = line2Color || "#FFFFFF";

  // Effect-specific styling for line2.
  let line2El: React.ReactNode = null;
  if (line2) {
    if (effect === "shimmer") {
      line2El = (
        <span
          className="relative inline-block bg-clip-text text-transparent"
          style={{
            backgroundImage: `linear-gradient(90deg, ${colour} 0%, #FFFFFF 50%, ${colour} 100%)`,
            backgroundSize: "200% 100%",
            animation: "xhero-shimmer 3s linear infinite"
          }}
        >
          {line2}
        </span>
      );
    } else if (effect === "dance") {
      line2El = (
        <span
          className="inline-block"
          style={{
            color: colour,
            animation: "xhero-dance 4s ease-in-out infinite",
            transformOrigin: "center"
          }}
        >
          {line2}
        </span>
      );
    } else if (effect === "underline") {
      line2El = (
        <span className="relative inline-block" style={{ color: colour }}>
          {line2}
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 block h-[3px]"
            style={{
              background: colour,
              animation: "xhero-underline 1.2s ease-out forwards",
              width: 0
            }}
          />
        </span>
      );
    } else {
      line2El = <span style={{ color: colour }}>{line2}</span>;
    }
  }

  return (
    <div className="absolute left-4 top-4 z-10 max-w-[70%] sm:left-6 sm:top-6 sm:max-w-[80%]">
      {line1 && (
        <p className="text-[13px] font-bold uppercase tracking-widest text-white/80 drop-shadow">
          {line1}
        </p>
      )}
      {line2 && (
        <h1 className="mt-1 text-2xl font-extrabold leading-[1.05] drop-shadow sm:text-5xl">
          {line2El}
        </h1>
      )}
      {tagline && (
        <p className="mt-2 text-[13px] text-white/85 drop-shadow sm:text-sm">
          {tagline}
        </p>
      )}
      <style>{`
        @keyframes xhero-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes xhero-dance {
          0%   { transform: rotate(-2deg); }
          50%  { transform: rotate(2deg); }
          100% { transform: rotate(-2deg); }
        }
        @keyframes xhero-underline {
          0%   { width: 0; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}

export default HeroTextOverlay;
