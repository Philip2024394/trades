// Xrated Trades — full-width right-to-left scrolling marquee.
// CSS-only animation; server component. Renders nothing for empty text.

import { inkForTheme } from "@/lib/xratedTrades";

export function RunningMarquee({
  text,
  themeColor
}: {
  text: string;
  themeColor: string;
}) {
  if (!text || text.trim().length === 0) return null;
  const ink = inkForTheme(themeColor);
  // Repeat content so the loop is seamless on wide viewports.
  const content = `${text}  •  ${text}  •  ${text}  •  ${text}`;

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: `${themeColor}1A` }}
      aria-label="Tradie running announcement"
    >
      <div
        className="xrated-marquee whitespace-nowrap py-2 text-sm font-semibold"
        style={{ color: ink }}
      >
        <span className="inline-block px-4">{content}</span>
        <span className="inline-block px-4" aria-hidden="true">{content}</span>
      </div>
      <style>{`
        .xrated-marquee {
          display: inline-flex;
          animation: xrated-marquee 30s linear infinite;
        }
        @keyframes xrated-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

export default RunningMarquee;
