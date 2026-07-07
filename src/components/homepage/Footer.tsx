// Footer — Construction Notebook signature close.
//
// Charcoal surface, 5-column grid on desktop, accordion on mobile.
// No motion, no promotional copy. Functional + brand-close.

import Link from "next/link";
import type { FooterContent } from "./types";

export function Footer({ content }: { content: FooterContent }) {
  return (
    <footer className="bg-neutral-950 text-white">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20 lg:px-20">
        <div className="grid gap-12 md:grid-cols-6 md:gap-8">
          <div className="md:col-span-2">
            <div className="text-[15px] font-bold">XRatedTrade</div>
            <div className="mt-1 text-[13px] uppercase tracking-wider text-amber-300">
              The Construction Notebook
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-[1.6] text-white/60">
              {content.brandLine}
            </p>
          </div>
          {content.columns.map((col) => (
            <div key={col.title}>
              <div className="text-[13px] font-semibold uppercase tracking-wider text-white/60">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[14px] text-white/80 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8 text-[13px] text-white/50">
          <div>{content.signature}</div>
          <div className="flex gap-4">
            <Link href="/legal/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/legal/cookies" className="hover:text-white">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
