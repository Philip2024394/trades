// Minimal footer for xratedtrades.com / /find.
//
// This is the customer-facing portal — no add-on columns, no
// "Features / Resources / Examples" nav, no sub-page links. Customer
// trust signals only: copyright, contact + the one outbound link
// tradies need ("List your trade") which doubles as the conversion
// path. The page is the search and the search is the page.

import { XRATED_BRAND } from "@/lib/xratedTrades";

export function FindFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-8 text-center sm:px-6">
        <p className="text-[13px] font-extrabold text-neutral-900">
          xratedtrades<span style={{ color: XRATED_BRAND.accent }}>.com</span>
        </p>
        <p className="text-[11px] text-neutral-500">
          © {year} · UK trades, found direct. No middleman.
        </p>
      </div>
    </footer>
  );
}

export default FindFooter;
