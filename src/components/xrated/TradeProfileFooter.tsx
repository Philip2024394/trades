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
import { isFaqPageOn, isNewsletterOn } from "@/lib/xratedAddons";
import { isMerchantGradeTrade } from "@/lib/tradeOff";
import { NewsletterSignup } from "@/components/xrated/profile/merchant/NewsletterSignup";

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
  // (Trade Circle footer link removed at the tradesperson's request —
  //  ecosystem entry point still lives on the profile home page.)
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
  // Merchant-only newsletter signup. Mounted INSIDE the dark footer
  // and styled for dark surface (white text, dark input, yellow accent).
  const showNewsletter =
    isMerchantGradeTrade(listing.primary_trade) && isNewsletterOn(listing);

  return (
    <footer
      className="mt-0 border-t border-white/10"
      style={{ background: "#0A0A0A" }}
    >
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-3 sm:px-6 sm:pb-20 sm:pt-4">
        {/* Compact 2-col on desktop: brand + links. Stacks single-column on mobile. */}
        <div
          className={`grid grid-cols-1 gap-4 sm:gap-6 ${
            showNewsletter ? "md:grid-cols-3" : "md:grid-cols-2"
          }`}
        >
          <section className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p
                className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
                style={{ color: "#FFB300" }}
              >
                Trade
              </p>
              <h3 className="mt-1 text-[15px] font-extrabold text-white sm:text-base">
                {appName}
              </h3>
              <p className="mt-0.5 text-[12px] text-white/60">
                {listing.display_name} · {listing.city}
              </p>
            </div>
            <FooterSocialIcons listing={listing} />
          </section>

          {showNewsletter && <NewsletterSignup listing={listing} />}

          {links.length > 0 && (
            <section>
              <ul className="flex flex-col gap-0.5">
                {links.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <a
                      href={link.href}
                      {...(link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="group flex h-8 items-center gap-2 text-[12px] leading-8 text-white/70 transition hover:text-white"
                    >
                      <span>{link.label}</span>
                      <span
                        aria-hidden="true"
                        className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-neutral-900 transition group-hover:translate-x-0.5"
                        style={{ background: "#FFB300" }}
                      >
                        <svg
                          width="8"
                          height="8"
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

        {/* Bottom — copyright + powered-by, stacked on two lines */}
        <div className="mt-2 border-t border-white/10 pt-2">
          <p className="text-[11px] text-white/55">
            © {year} {listing.display_name}
          </p>
          <p className="mt-0.5 text-[11px] text-white/45">
            Powered by{" "}
            <a
              href="/trade-off"
              className="text-white/70 underline-offset-4 hover:text-white hover:underline"
            >
              xratedtrade.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterSocialIcons({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  function ensureUrl(input: string | null | undefined, base: string): string | null {
    const raw = (input ?? "").trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${base}${raw.replace(/^@/, "")}`;
  }
  const insta = ensureUrl(listing.instagram, "https://instagram.com/");
  const tiktok = ensureUrl(listing.tiktok, "https://tiktok.com/@");
  const fb = ensureUrl(listing.facebook, "https://facebook.com/");
  type Item = { href: string; label: string; bg: string; icon: React.ReactNode };
  const items: Item[] = [
    insta ? {
      href: insta,
      label: "Instagram",
      bg: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.849.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.849.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      )
    } : null,
    tiktok ? {
      href: tiktok,
      label: "TikTok",
      bg: "#000",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      )
    } : null,
    fb ? {
      href: fb,
      label: "Facebook",
      bg: "#1877F2",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      )
    } : null
  ].filter((x): x is Item => x !== null);
  if (items.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-2">
      {items.map((i) => (
        <a
          key={i.label}
          href={i.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={i.label}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:-translate-y-0.5"
          style={{ background: i.bg }}
        >
          {i.icon}
        </a>
      ))}
    </div>
  );
}
