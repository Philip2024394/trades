// Xrated Trades wordmark renderer. Use anywhere we want the orange
// Xrated logo to appear instead of (or alongside) the Hammerex wordmark
// — landing hero, header on /trade-off + /trade routes, etc.
//
// Server component (no client state). Pure image render.

import { XRATED_BRAND } from "@/lib/xratedTrades";

const SIZE_CLASS = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14"
} as const;

export type XratedBrandMarkSize = keyof typeof SIZE_CLASS;

export function XratedBrandMark({
  size = "md",
  withWordmark = false,
  className = ""
}: {
  size?: XratedBrandMarkSize;
  // When true, render the brand name as visible text after the logo.
  // Default false — the logo art already contains the wordmark.
  withWordmark?: boolean;
  className?: string;
}) {
  const heightClass = SIZE_CLASS[size];
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <img
        src={XRATED_BRAND.logoUrl}
        alt={XRATED_BRAND.name}
        className={`${heightClass} w-auto object-contain`}
        style={{ background: "transparent" }}
      />
      {withWordmark && (
        <span
          className="text-sm font-bold tracking-tight"
          style={{ color: XRATED_BRAND.accent }}
        >
          {XRATED_BRAND.name}
        </span>
      )}
    </span>
  );
}

export default XratedBrandMark;
