// Xrated Trades — standalone footer for /trade-off* and /trade/* routes.
// Only one link back to Hammerex (the "Hammerex shop →" bottom-row link),
// so tradies and customers who want the parent shop can find it, but the
// focus stays on Xrated. Uses Hammerex yellow accent (#FFB300) for headings.

import { XRATED_BRAND } from "@/lib/xratedTrades";

export function XratedFooter() {
  return (
    <footer id="xrated-footer" className="mt-12 border-t border-white/10 bg-black">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Brand row + top CTA */}
        <div className="grid grid-cols-1 gap-6 border-b border-white/10 pb-8 sm:grid-cols-[1.4fr_1fr] sm:gap-10">
          <section>
            <img
              src={XRATED_BRAND.logoUrl}
              alt={XRATED_BRAND.name}
              className="block h-9 w-auto object-contain"
              style={{ background: "transparent" }}
            />
            <p className="mt-3 max-w-md text-xs leading-relaxed text-white/70">
              The shareable trade profile for tradies anywhere — replaces your
              website, quote form and business card with one link.
            </p>
            <p className="mt-2 max-w-md text-[11px] leading-relaxed text-white/55">
              <span className="font-bold" style={{ color: XRATED_BRAND.accent }}>
                Always shipping.
              </span>{" "}
              Paid members get every update and new feature free, automatically.
              You stay on the tools — we make sure customers connect.
            </p>
          </section>
          <section className="flex flex-col items-start gap-2 sm:items-end">
            <a
              href="/trade-off/signup"
              className="inline-flex h-11 items-center gap-1.5 rounded-lg px-4 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98]"
              style={{ background: XRATED_BRAND.accent }}
            >
              Join XratedTrade
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <p className="text-[11px] text-white/60">No card on signup · Cancel any time</p>
          </section>
        </div>

        {/* 4-column link directory — every content page reachable from here */}
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          <FooterColumn
            title="Product"
            links={[
              { href: "/trade-off/what", label: "What is XRatedTrade?" },
              { href: "/trade-off/why", label: "Why do I need one?" },
              { href: "/trade-off/how", label: "How it works" },
              { href: "/trade-off/pricing", label: "Pricing" },
              { href: "/trade-off/add-ons", label: "Add-ons" },
              { href: "/trade-off/compare", label: "Why choose us" }
            ]}
          />
          <FooterColumn
            title="Features"
            links={[
              { href: "/trade-off/services", label: "Service cards" },
              { href: "/trade-off/reviews", label: "Customer reviews" },
              { href: "/trade-off/yard", label: "The Yard — trades-only" },
              { href: "/trade-off/share", label: "Share anywhere" },
              { href: "/trade-off/trust", label: "Trust Score" },
              { href: "/trade-off/verified", label: "Verified Business" }
            ]}
          />
          <FooterColumn
            title="Examples"
            links={[
              { href: "/trade-off/trades", label: "Trade examples" },
              { href: "/trade-off/success", label: "Success stories" },
              { href: "/trade-off/verified-waitlist", label: "Verified waitlist" }
            ]}
          />
          <FooterColumn
            title="Resources"
            links={[
              { href: "/trade-off/faq", label: "FAQ" },
              { href: "/trade-off/help", label: "Help centre" },
              { href: "/trade-off/tips", label: "Tips for trades" }
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/60 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {XRATED_BRAND.name} — powered by{" "}
            <a href="/trade-off" className="text-white/80 hover:text-white">
              {XRATED_BRAND.domain}
            </a>
          </p>
          <a
            href="/"
            className="text-white/70 transition hover:text-white"
          >
            Hammerex shop →
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <section>
      <h3
        className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: XRATED_BRAND.accent }}
      >
        {title}
      </h3>
      <ul className="mt-3 flex flex-col gap-2 text-xs text-white/75 sm:text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="transition hover:text-white">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
