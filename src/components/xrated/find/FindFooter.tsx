// Footer for xratedtrades.com / /find.
//
// One decisive black panel: tradesperson-acquisition CTA at the top,
// brand mark + copyright pinned at the bottom. No add-on columns, no
// 'Features / Resources / Examples' nav, no sub-page links. The page
// is the search and the search is the page.

import { XRATED_BRAND } from "@/lib/xratedTrades";

export function FindFooter() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: "#0A0A0A" }}>
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-12 sm:px-6 sm:pb-10 sm:pt-16">
        <div className="text-center">
          <p
            className="text-[13px] font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Tradesperson? Get listed here.
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Join xratedtrades today.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[13px] text-white/80 sm:text-sm">
            £14.99/mo. 14-day free trial, no card. Your premium profile
            goes live the moment you save &mdash; and you&rsquo;re
            auto-listed on xratedtrades.com so customers find you.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/trade-off/signup"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.97] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              Start 14-day trial
            </a>
            <a
              href="/trade-off/pricing"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-[13px] font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See pricing
            </a>
          </div>
        </div>

        {/* Brand mark + copyright at the bottom of the panel */}
        <div className="mt-10 border-t border-white/10 pt-6 text-center">
          <p className="text-[13px] font-extrabold text-white">
            xratedtrades<span style={{ color: XRATED_BRAND.accent }}>.com</span>
          </p>
          <p className="mt-1 text-[11px] text-white/50">
            © {year} · UK trades, found direct. No middleman.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default FindFooter;
