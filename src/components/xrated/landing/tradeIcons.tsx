// Shared trade-icon SVG map used by TradeIconChips (round chip row) and
// TradesOnStandby (square card icon button). Single source of truth so a
// new trade only needs an icon added in one place.

import type React from "react";

type IconProps = { className?: string };

export const TRADE_ICONS: Record<string, (p: IconProps) => React.ReactNode> = {
  all: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  drywaller: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M3 12h18" />
    </svg>
  ),
  plasterer: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 12h14l4-4-4-4H9l-6 8Z" />
      <path d="m9 16-3 5" />
    </svg>
  ),
  electrician: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m13 2-9 13h7l-1 7 9-13h-7l1-7Z" />
    </svg>
  ),
  scaffolder: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 3v18" />
      <path d="M21 3v18" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
    </svg>
  ),
  tiler: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  ),
  plumber: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </svg>
  ),
  carpenter: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 12 6 21l-3-3 9-9" />
      <path d="m15 12 5 5-2 2-5-5" />
      <path d="m12 9 6-6 3 3-6 6" />
    </svg>
  ),
  joiner: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 12 6 21l-3-3 9-9" />
      <path d="m15 12 5 5-2 2-5-5" />
      <path d="m12 9 6-6 3 3-6 6" />
    </svg>
  ),
  painter: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 11V7a2 2 0 0 0-2-2H7L3 9v6l4 4h9a2 2 0 0 0 2-2v-4" />
      <path d="M18 11h3v6h-3" />
    </svg>
  ),
  roofer: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 12 12 4l9 8" />
      <path d="M5 11v9h14v-9" />
    </svg>
  ),
  bricklayer: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <rect x="3" y="10" width="8" height="5" rx="1" />
      <rect x="13" y="10" width="8" height="5" rx="1" />
      <rect x="3" y="16" width="18" height="5" rx="1" />
    </svg>
  ),
  stonemason: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m4 9 8-6 8 6v12H4z" />
      <path d="M8 12h8" />
      <path d="M8 16h8" />
    </svg>
  ),
  groundworker: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 22h20" />
      <path d="m7 18 5-12 5 12" />
      <path d="M9 12h6" />
    </svg>
  ),
  "general-builder": ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 18a10 10 0 0 1 20 0" />
      <path d="M2 18h20" />
      <path d="M12 4v4" />
    </svg>
  ),
  "concrete-specialist": ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m21 16-9 5-9-5" />
      <path d="M3 8 12 3l9 5-9 5z" />
      <path d="M3 12 12 17l9-5" />
    </svg>
  ),
  renderer: ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 12h14l4-4-4-4H9l-6 8Z" />
      <path d="m9 16-3 5" />
    </svg>
  ),
  "taper-and-finisher": ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M3 12h18" />
    </svg>
  )
};

export function tradeIconFor(slug: string) {
  return TRADE_ICONS[slug] ?? TRADE_ICONS["general-builder"];
}
