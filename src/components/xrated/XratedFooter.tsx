// The Network — public marketing footer. Rebranded 2026-07-10 from the
// old dark XratedFooter. Cream backdrop matching the platform, yellow-
// dot brand mark, condensed 4-column link directory (was 6 — dropped
// dead columns: "Examples", "Verified waitlist", "Xrated demo").
// Kept as `XratedFooter` export so existing imports don't break.
//
// Rule: this footer renders ONLY on marketing/SEO surfaces. See
// feedback_no_footer_on_app_surfaces.md — app surfaces (Yard, Warehouse,
// Studio, dashboards) skip the footer entirely.

import { XRATED_BRAND } from "@/lib/xratedTrades";
import { TrustBadges } from "./TrustBadges";
import { BRAND_YELLOW, BRAND_BLACK } from "@/lib/brand/tokens";

const CREAM = "#FBF6EC";
const INK = "#0F1419";
const MUTED = "#525A66";
const HAIRLINE = "rgba(139,69,19,0.15)";

export function XratedFooter() {
  const brand = XRATED_BRAND.name;
  return (
    <footer
      id="network-footer"
      className="mt-16"
      style={{ backgroundColor: CREAM, borderTop: `1px solid ${HAIRLINE}` }}
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
        {/* Brand row + join CTA */}
        <div
          className="grid grid-cols-1 gap-6 pb-8 sm:grid-cols-[1.4fr_1fr] sm:gap-10"
          style={{ borderBottom: `1px solid ${HAIRLINE}` }}
        >
          <section>
            <div className="flex items-center gap-2">
              <span
                className="block h-3 w-3 rounded-full"
                style={{ backgroundColor: BRAND_YELLOW }}
                aria-hidden="true"
              />
              <span
                className="text-[18px] font-black tracking-tight"
                style={{ color: BRAND_BLACK }}
              >
                {brand}
              </span>
            </div>
            <p
              className="mt-3 max-w-md text-[13px] leading-relaxed"
              style={{ color: INK }}
            >
              The network of the construction trades. Design your business app in Studio, install what fits from the App Warehouse, and land in front of customers with a profile built to convert.
            </p>
            <p
              className="mt-2 max-w-md text-[11px] leading-relaxed"
              style={{ color: MUTED }}
            >
              Always shipping. Paid members receive every update and new app free — you stay on the tools, we keep the platform sharp.
            </p>
          </section>
          <section className="flex flex-col items-start gap-2 sm:items-end">
            <a
              href="/trade-off/signup"
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97]"
              style={{ background: BRAND_YELLOW }}
            >
              Join The Network
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <p className="text-[11px]" style={{ color: MUTED }}>
              14-day free trial · no card up front
            </p>
          </section>
        </div>

        {/* 4-column link directory — pruned. Dropped:
              - "Examples" column (verified-waitlist + success stories buried in burger)
              - Duplicated feature links now living in burger's "More" section
            Kept every page required by Stripe's live-subscription checklist:
            terms, privacy, refunds, aup, contact, status. */}
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-10">
          <FooterColumn
            title="Platform"
            links={[
              { href: "/trade-off/what",     label: "What is The Network?" },
              { href: "/trade-off/how",      label: "How it works" },
              { href: "/trade-off/pricing",  label: "Pricing" },
              { href: "/apps",               label: "App Warehouse" },
              { href: "/trade-off/yard",     label: "The Yard" }
            ]}
          />
          <FooterColumn
            title="For Trades"
            links={[
              { href: "/trade-off/verified", label: "Verified Business" },
              { href: "/trade-off/trust",    label: "Trust Score" },
              { href: "/trade-off/services", label: "Service cards" },
              { href: "/showcase",           label: "Showcase" },
              { href: "/trade-off/tips",     label: "Tips for trades" }
            ]}
          />
          <FooterColumn
            title="Company"
            links={[
              { href: "/about",              label: "About" },
              { href: "/contact",            label: "Contact" },
              { href: "/status",             label: "Service status" },
              { href: "/trade-off/faq",      label: "FAQ" },
              { href: "/trade-off/help",     label: "Help centre" }
            ]}
          />
          <FooterColumn
            title="Legal"
            links={[
              { href: "/legal/terms",        label: "Terms" },
              { href: "/legal/privacy",      label: "Privacy" },
              { href: "/legal/refunds",      label: "Refunds" },
              { href: "/legal/aup",          label: "Acceptable Use" }
            ]}
          />
        </div>

        {/* Trust strip — Stripe + accepted payment methods */}
        <div className="mt-10 pt-6" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <TrustBadges variant="compact" />
        </div>

        <div
          className="mt-8 flex flex-col items-center justify-between gap-2 pt-5 text-[11px] sm:flex-row"
          style={{ borderTop: `1px solid ${HAIRLINE}`, color: MUTED }}
        >
          <p>
            © {new Date().getFullYear()} {brand} — Of The Construction Trades.
          </p>
          <p>
            Made in the UK · Stripe-secured checkout
          </p>
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
        className="text-[10px] font-black uppercase tracking-[0.22em]"
        style={{ color: BRAND_BLACK }}
      >
        {title}
      </h3>
      <ul className="mt-3 flex flex-col gap-2 text-[13px]" style={{ color: INK }}>
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="transition hover:underline"
              style={{ textUnderlineOffset: "3px" }}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
