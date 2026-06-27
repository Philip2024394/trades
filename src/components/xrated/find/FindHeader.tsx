// Minimal header for xratedtrades.com / /find.
//
// This is the customer-facing portal — no burger menu, no alerts bell,
// no signup nudge. The customer is here to find a tradesperson and
// leave; we don't compete with their attention. The only path off the
// header is back to the home of the portal itself.

import { XRATED_BRAND } from "@/lib/xratedTrades";

export function FindHeader() {
  return (
    <header className="sticky top-0 z-30 bg-black/95 backdrop-blur">
      <div className="mx-auto flex h-[64px] max-w-6xl items-center justify-end gap-3 px-4 sm:h-[72px]">
        <a
          href="/find"
          aria-label="xratedtrades home"
          className="block shrink-0 p-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={XRATED_BRAND.logoUrl}
            alt="xratedtrades"
            className="block h-10 w-auto object-contain sm:h-12"
            style={{ background: "transparent" }}
          />
        </a>
      </div>
    </header>
  );
}

export default FindHeader;
