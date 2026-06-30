// Lightweight header for /trade-off/edit/** dashboard pages. Replaces
// the public XratedHeader which carries marketing nav (Showcase, News,
// and — crucially — a "Log in" button that's nonsensical for a
// tradesperson already inside their dashboard via magic link / session.
//
// Two elements only: brand wordmark logo (links back to public Trade Off
// landing) and a small "← View live site" link the merchant can use to
// hop to the public marketing pages without losing their session.

import { XRATED_BRAND } from "@/lib/xratedTrades";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 bg-black/95 backdrop-blur">
      <div className="mx-auto flex h-[64px] max-w-6xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:gap-4">
        <a
          href="/trade-off"
          aria-label={`${XRATED_BRAND.name} home`}
          className="block shrink-0 p-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={XRATED_BRAND.logoUrl}
            alt={XRATED_BRAND.name}
            className="block h-10 w-auto object-contain sm:h-12"
            style={{ background: "transparent" }}
          />
        </a>

        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
          Dashboard
        </p>
      </div>
    </header>
  );
}
