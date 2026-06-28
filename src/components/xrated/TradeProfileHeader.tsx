// Xrated Trades — lean tradie-profile header.
//
// Visual bookend partner to TradeProfileFooter. Sticky top, black surface
// (#0A0A0A), so the back-chevron + WhatsApp pill stay reachable through
// long PDP scrolls. Replaces the rich marketing XratedHeader on every
// tradie-public route (/<slug>, /<slug>/contact, /<slug>/shop, …).
// Marketing surfaces under /trade-off/* keep the original XratedHeader.
//
// Server component. Renders:
//   – LEFT: optional back chevron (only when backHref is set)
//   – Avatar (listing.avatar_url) OR yellow initials fallback
//   – Name + sub-line "{appName} · {city}"
//   – RIGHT: yellow WhatsApp "Chat" pill (quick-question prefilled)
//
// House rules: 13px floor on body copy, 11px allowed only on the secondary
// "{appName} · {city}" meta line, yellow #FFB300, black surface #0A0A0A.

import Link from "next/link";
import type { HammerexTradeOffListing } from "@/lib/supabase";
import { HeaderCartButton } from "./HeaderCartButton";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((s) => s.length > 0)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function TradeProfileHeader({
  listing,
  appName,
  backHref
}: {
  listing: HammerexTradeOffListing;
  appName: string;
  backHref?: string;
}) {
  const avatarUrl =
    typeof listing.avatar_url === "string" && listing.avatar_url.trim().length > 0
      ? listing.avatar_url
      : null;
  const cartHref = `/${listing.slug}/cart`;

  return (
    <header
      className="sticky top-0 z-30 border-b border-white/10"
      style={{ background: "#0A0A0A" }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-3 py-2 sm:px-6 sm:py-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
        )}

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${listing.display_name} avatar`}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-neutral-900"
            style={{ background: "#FFB300" }}
            aria-hidden="true"
          >
            {initials(listing.display_name)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[13px] font-extrabold text-white">
            {listing.display_name}
          </p>
          <p className="line-clamp-1 text-[11px] text-white/60">
            {appName} · {listing.city}
          </p>
        </div>

        <HeaderCartButton slug={listing.slug} cartHref={cartHref} />
      </div>
    </header>
  );
}
