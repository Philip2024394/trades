// navigation.top — desktop horizontal top bar.

"use client";

import Link from "next/link";
import { navigationRegistry } from "../registry";
import type { NavigationRendererProps } from "../types";
import { P } from "./_shared";

function TopNavRenderer({
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
      className="w-full border-b border-border bg-background"
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
                    "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-bold transition-colors " +
                    (active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                  }
                >
                  {item.label}
                  {item.badge !== undefined && (
                    <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs font-extrabold text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
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
  slug: "top-classic",
  name: "Top Navigation",
  description:
    "Horizontal top bar with brand on the left, primary links in the middle, optional CTA on the right. The default desktop nav.",
  version: "1.0.0",
  pattern: "top",
  devices: ["tablet", "desktop"],
  itemShape: {
    key: "top-item",
    labelKey: "label",
    supportsBadges: true,
    supportsSubmenus: false
  },
  compatibleLayouts: ["*"],
  behaviours: ["cta-anchored", "brand-left"],
  renderer: TopNavRenderer,
  publisher: P
});
