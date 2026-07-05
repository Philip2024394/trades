// StickyTopNav — page-level sticky nav with brand + desktop links +
// mobile hamburger. Reusable across the platform.

"use client";

import { Menu } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import { MobileNavDrawer } from "./MobileNavDrawer";
import type { MobileNavLink } from "./MobileNavDrawer";

export type StickyTopNavProps = {
  brandLabel: string;
  brandIcon?: ComponentType<{ className?: string }>;
  brandHref?: string;
  links: readonly MobileNavLink[];
  /** Optional desktop-visible CTA on the right. */
  desktopCta?: ReactNode;
  /** Optional footer for the mobile drawer — usually CTA buttons. */
  drawerFooter?: ReactNode;
};

export function StickyTopNav({
  brandLabel,
  brandIcon: BrandIcon,
  brandHref = "#top",
  links,
  desktopCta,
  drawerFooter
}: StickyTopNavProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a
            href={brandHref}
            className="flex items-center gap-2 text-neutral-900"
          >
            {BrandIcon ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
                <BrandIcon className="h-4 w-4" />
              </div>
            ) : null}
            <span className="text-[15px] font-bold">{brandLabel}</span>
          </a>
          <div className="hidden items-center gap-6 text-[13px] text-neutral-700 md:flex">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-neutral-900">
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {desktopCta ? (
              <div className="hidden md:inline-flex">{desktopCta}</div>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 text-neutral-900 hover:bg-neutral-50 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>
      <MobileNavDrawer
        open={open}
        onClose={() => setOpen(false)}
        brandLabel={brandLabel}
        links={links}
        footer={drawerFooter}
      />
    </>
  );
}
