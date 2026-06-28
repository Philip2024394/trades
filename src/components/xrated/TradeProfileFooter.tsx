// Xrated Trades — lean tradie-profile footer.
//
// Replaces the rich marketing XratedFooter on every tradie-public route
// (/<slug>, /<slug>/contact, /<slug>/shop, /<slug>/cart, /<slug>/faq …).
// Marketing surfaces under /trade-off/* keep the original XratedFooter.
//
// Server component. Renders:
//   – Top: brand line ({appName} · {display_name} · {city}) + a vertical
//     link list mixing tradie-set legal/company URLs (Terms, Privacy,
//     Returns, About) with auto-surfaced internal links (FAQ when the
//     FAQ Page add-on is on, Trusted Trades when recommendations exist).
//   – Bottom: tiny copyright + "Get your own profile →" acquisition line.
//
// House rules: 13px floor on body copy, 11px allowed only on the two
// bottom meta lines, yellow #FFB300, black surface #0A0A0A.

import type { HammerexTradeOffListing } from "@/lib/supabase";
import { isFaqPageOn } from "@/lib/xratedAddons";

type Link = { href: string; label: string; external: boolean };

function buildLinks(listing: HammerexTradeOffListing): Link[] {
  const links: Link[] = [];
  const push = (href: string | null | undefined, label: string, external: boolean) => {
    const trimmed = typeof href === "string" ? href.trim() : "";
    if (trimmed.length === 0) return;
    links.push({ href: trimmed, label, external });
  };
  // Tradie-set legal links — external URLs the tradesperson owns.
  push(listing.terms_url, "Terms & Conditions", true);
  push(listing.privacy_url, "Privacy Policy", true);
  push(listing.returns_url, "Returns & Refunds", true);
  push(listing.about_url, "About", true);
  // Auto-surfaced internal links — only when the underlying surface
  // actually has content (no dead links).
  if (isFaqPageOn(listing)) {
    links.push({ href: `/${listing.slug}/faq`, label: "FAQ", external: false });
  }
  if (Array.isArray(listing.recommendations) && listing.recommendations.length > 0) {
    links.push({
      href: `/${listing.slug}/trusted-trades`,
      label: "Trusted Trades",
      external: false
    });
  }
  return links;
}

export function TradeProfileFooter({
  listing,
  appName
}: {
  listing: HammerexTradeOffListing;
  appName: string;
}) {
  const year = new Date().getFullYear();
  const links = buildLinks(listing);

  return (
    <footer
      className="mt-12 border-t border-white/10"
      style={{ background: "#0A0A0A" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Top — brand block + link list */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10">
          <section>
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: "#FFB300" }}
            >
              Trade
            </p>
            <h3 className="mt-2 text-lg font-extrabold text-white sm:text-xl">
              {appName}
            </h3>
            <p className="mt-1 text-[13px] text-white/70">
              {listing.display_name} · {listing.city}
            </p>
          </section>

          {links.length > 0 && (
            <section>
              <ul className="flex flex-col gap-1">
                {links.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <a
                      href={link.href}
                      {...(link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="group flex h-9 items-center gap-2 text-[13px] leading-9 text-white/75 transition hover:text-white"
                    >
                      <span>{link.label}</span>
                      <span
                        aria-hidden="true"
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-neutral-900 transition group-hover:translate-x-0.5"
                        style={{ background: "#FFB300" }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Bottom — copyright + acquisition line */}
        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-white/60">
            © {year} {listing.display_name} · Powered by{" "}
            <a
              href="/trade-off"
              className="text-white/80 underline-offset-4 hover:text-white hover:underline"
            >
              xratedtrade.com
            </a>
          </p>
          <a
            href="/trade-off"
            className="text-[11px] text-white/50 transition hover:text-white/80"
          >
            Are you a tradesperson? Get your own profile →
          </a>
        </div>
      </div>
    </footer>
  );
}
