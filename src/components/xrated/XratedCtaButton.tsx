"use client";

// Xrated Trades — primary CTA button with optional attention effects.
// Pure CSS animations driven by inline-styled keyframes. Client component
// so the shake-on-idle can be paused on hover cleanly via :hover selectors.

import type { CSSProperties } from "react";
import type { CtaButtonEffect } from "@/lib/xratedTrades";

export function XratedCtaButton({
  href,
  label,
  icon,
  themeColor,
  textColor,
  effect
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  themeColor: string;
  textColor: string;
  effect: CtaButtonEffect;
}) {
  // Per-effect inline style. Hover effects baked in via the <style> block
  // below so they apply only to this button instance (unique class).
  const baseStyle: CSSProperties = {
    background: themeColor,
    color: textColor,
    minHeight: 56
  };

  const className = [
    "xrated-cta",
    `xrated-cta--${effect}`,
    "group inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-bold transition active:scale-[0.98]"
  ].join(" ");

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={baseStyle}
      >
        {icon}
        <span>{label}</span>
      </a>
      <style>{`
        .xrated-cta--pulse {
          animation: xcta-pulse 2s ease-in-out infinite;
        }
        .xrated-cta--glow {
          box-shadow: 0 0 0 0 ${themeColor}55;
          transition: box-shadow 220ms ease;
        }
        .xrated-cta--glow:hover {
          box-shadow: 0 0 24px 6px ${themeColor}99;
        }
        .xrated-cta--shake {
          animation: xcta-shake 8s ease-in-out infinite;
        }
        .xrated-cta--shake:hover {
          animation: none;
        }
        @keyframes xcta-pulse {
          0%   { box-shadow: 0 0 0 0 ${themeColor}40; }
          70%  { box-shadow: 0 0 0 14px ${themeColor}00; }
          100% { box-shadow: 0 0 0 0 ${themeColor}00; }
        }
        @keyframes xcta-shake {
          0%, 92%, 100% { transform: translateX(0); }
          93% { transform: translateX(-3px); }
          94% { transform: translateX(3px); }
          95% { transform: translateX(-2px); }
          96% { transform: translateX(2px); }
          97% { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

export default XratedCtaButton;
