// navigation.transparent — nav overlaid on hero (transparent bg).

"use client";

import Link from "next/link";
import { navigationRegistry } from "../registry";
import type { NavigationRendererProps } from "../types";
import { P } from "./_shared";

function TransparentNavRenderer({
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
      className="absolute inset-x-0 top-0 z-20 w-full"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href={brandHref ?? "/"}
          className="flex items-center gap-2 text-base font-extrabold text-white drop-shadow"
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
                    "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-bold text-white drop-shadow transition-colors " +
                    (active ? "bg-white/20" : "hover:bg-white/15")
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
            className="hidden rounded-md bg-white/95 px-3 py-1.5 text-sm font-extrabold text-neutral-900 shadow md:inline-flex"
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
  slug: "top-transparent",
  name: "Transparent Hero Nav",
  description:
    "Navigation overlaid on a hero background photo — transparent surface, white ink, drop shadow for readability. Use with photo-first hero layouts.",
  version: "1.0.0",
  pattern: "transparent",
  devices: ["tablet", "desktop"],
  itemShape: {
    key: "trans-item",
    labelKey: "label",
    supportsBadges: false,
    supportsSubmenus: false
  },
  compatibleLayouts: ["landing", "trades", "restaurant", "portfolio"],
  behaviours: ["hero-overlay", "photo-first"],
  renderer: TransparentNavRenderer,
  publisher: P
});
