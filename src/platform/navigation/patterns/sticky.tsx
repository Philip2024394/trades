// navigation.sticky — top bar that stays pinned as the page scrolls.

"use client";

import Link from "next/link";
import { navigationRegistry } from "../registry";
import type { NavigationRendererProps } from "../types";
import { P } from "./_shared";

function StickyNavRenderer({
  items,
  brandLabel,
  brandHref,
  brandLogoUrl,
  ctaLabel,
  ctaHref,
  currentPath
}: NavigationRendererProps) {
  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-30 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href={brandHref ?? "/"}
          className="flex items-center gap-2 text-base font-extrabold text-foreground"
        >
          {brandLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandLogoUrl} alt="" className="h-8 w-auto object-contain" />
          )}
          {brandLabel && <span>{brandLabel}</span>}
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {items.map((item) => {
            const active = item.isActive ?? currentPath === item.href;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={
                    "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-bold " +
                    (active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                  }
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="hidden rounded-md bg-primary px-3 py-1.5 text-sm font-extrabold text-primary-foreground md:inline-flex"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </nav>
  );
}

navigationRegistry.register({
  manifestVersion: 1,
  slug: "top-sticky",
  name: "Sticky Top",
  description:
    "Top navigation that stays pinned as the page scrolls. Backdrop blur when translucent surface allows. Default for content-heavy landing pages.",
  version: "1.0.0",
  pattern: "sticky",
  devices: ["tablet", "desktop"],
  itemShape: {
    key: "sticky-item",
    labelKey: "label",
    supportsBadges: false,
    supportsSubmenus: false
  },
  compatibleLayouts: ["landing", "trades", "saas", "portfolio", "magazine"],
  behaviours: ["backdrop-blur", "scroll-persistent"],
  renderer: StickyNavRenderer,
  publisher: P
});
