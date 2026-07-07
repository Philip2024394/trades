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

export type AssemblyNavPill = {
  id: string;
  label: string;
  href: string;
  icon: string | null;
};

export function TradeProfileHeader({
  listing,
  appName,
  backHref,
  assemblyNavPills
}: {
  listing: HammerexTradeOffListing;
  appName: string;
  backHref?: string;
  /** Assembly-runtime nav entries the merchant accepted at install time
   *  (from studio_assembly_nav_entries where target_slot='nav.header').
   *  Rendered as a horizontal pill strip below the sticky top row. Empty
   *  or omitted → no strip renders, existing merchants see no change. */
  assemblyNavPills?: AssemblyNavPill[];
}) {
  const avatarUrl =
    typeof listing.avatar_url === "string" && listing.avatar_url.trim().length > 0
      ? listing.avatar_url
      : null;
  const cartHref = `/${listing.slug}/cart`;
  const pills = assemblyNavPills ?? [];

  return (
    <header
      className="sticky top-0 z-30 border-b border-white/10"
      style={{ background: "#0A0A0A" }}
    >
      {/* Construction Notebook brand ribbon — signals that this
          merchant page is part of the wider network across every
          sticky-header scroll frame. Thin, non-intrusive, always
          reads "On the Notebook". */}

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

      </div>

      {pills.length > 0 && (
        <nav
          aria-label="Actions"
          className="border-t border-white/10"
          style={{ background: "#0A0A0A" }}
        >
          <ul className="mx-auto flex w-full max-w-6xl items-center gap-2 overflow-x-auto px-3 py-2 sm:px-6">
            {pills.map((p) => (
              <li key={p.id} className="shrink-0">
                <Link
                  href={p.href}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:bg-white/10"
                >
                  {p.icon && (
                    <span aria-hidden="true" className="text-[14px]">
                      {p.icon}
                    </span>
                  )}
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
