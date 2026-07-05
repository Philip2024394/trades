// Public-facing storm banner.
//
// Renders at the very top of every public page when the merchant has
// enabled Storm Mode + the payload hasn't expired. Sticky at the top
// on mobile so it stays visible during scroll.

import type { StormModePayload } from "@/lib/studio/sectionTypes";

const RED = "#DC2626";

export function StormBanner({ storm }: { storm: StormModePayload }) {
  return (
    <div
      role="alert"
      className="sticky top-0 z-40 flex flex-wrap items-center gap-3 px-4 py-2 text-white shadow-md"
      style={{ background: RED }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13 2 3 14h7v8l10-12h-7V2z" />
      </svg>
      <p className="min-w-0 flex-1 text-[12px] font-bold leading-tight">
        {storm.message}
      </p>
      {storm.ctaLabel && (
        <a
          href={storm.ctaHref || "#"}
          className="rounded-full border border-white/40 bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white no-underline transition hover:bg-white/20"
        >
          {storm.ctaLabel}
        </a>
      )}
    </div>
  );
}
