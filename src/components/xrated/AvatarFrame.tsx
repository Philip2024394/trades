// Xrated Trades — circular avatar with optional themed ring.
// Ring + image are layered absolutely so the image is inset slightly inside
// the ring border — visible orange ring surrounding the rounded image with a
// small gap, regardless of size.

import { type AvatarFrameStyle } from "@/lib/xratedTrades";

export function AvatarFrame({
  src,
  name,
  size = 88,
  style,
  themeColor
}: {
  src: string | null;
  name: string;
  size?: number;
  style: AvatarFrameStyle;
  themeColor: string;
}) {
  const hasRing = style !== "none";
  const ringWidth = Math.max(3, Math.round(size * 0.05));
  const innerInset = hasRing ? ringWidth + 2 : 0;
  const animId = `xaf-${style}`;

  const ringStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "9999px",
    border: `${ringWidth}px solid ${themeColor}`,
    boxSizing: "border-box",
    ...(style === "pulse"
      ? { animation: `${animId} 2s ease-in-out infinite`, transformOrigin: "center" }
      : {})
  };

  const innerStyle: React.CSSProperties = {
    position: "absolute",
    inset: innerInset,
    borderRadius: "9999px",
    overflow: "hidden",
    background: "rgb(var(--brand-bg) / 1)",
    ...(style === "dance"
      ? { animation: `${animId} 3s ease-in-out infinite`, transformOrigin: "center" }
      : {})
  };

  return (
    <span
      className="relative inline-block shadow-lg"
      style={{ width: size, height: size, borderRadius: "9999px" }}
    >
      {hasRing && <span aria-hidden="true" style={ringStyle} />}
      <span style={innerStyle}>
        {src ? (
          <img
            src={src}
            alt={`${name} profile photo`}
            className="block h-full w-full object-cover"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center"
            aria-hidden="true"
          >
            <svg
              width={Math.round(size * 0.55)}
              height={Math.round(size * 0.55)}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-brand-muted"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
        )}
      </span>
      <style>{`
        @keyframes xaf-pulse {
          0%   { transform: scale(1);    opacity: 1; }
          50%  { transform: scale(1.06); opacity: 0.65; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes xaf-dance {
          0%   { transform: rotate(-2deg); }
          50%  { transform: rotate(2deg); }
          100% { transform: rotate(-2deg); }
        }
      `}</style>
    </span>
  );
}

export default AvatarFrame;
