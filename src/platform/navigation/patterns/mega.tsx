// navigation.mega — top bar with multi-column dropdown.

"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { navigationRegistry } from "../registry";
import type { NavigationItem, NavigationRendererProps } from "../types";
import { P } from "./_shared";

function MegaNavRenderer({
  items,
  brandLabel,
  brandHref,
  brandLogoUrl,
  ctaLabel,
  ctaHref,
  currentPath
}: NavigationRendererProps) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  return (
    <nav
      aria-label="Primary"
      className="relative w-full border-b border-border bg-background"
      onMouseLeave={() => setOpenKey(null)}
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
            const hasChildren = (item.children?.length ?? 0) > 0;
            return (
              <li
                key={item.key}
                onMouseEnter={() => setOpenKey(hasChildren ? item.key : null)}
              >
                <Link
                  href={item.href}
                  className={
                    "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-bold " +
                    (active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                  }
                >
                  {item.label}
                  {hasChildren && <ChevronDown size={14} strokeWidth={2.5} />}
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

      {/* Mega menu panel */}
      {openKey && (
        <div className="absolute inset-x-0 top-full z-40 border-b border-border bg-background shadow-lg">
          {items
            .filter((it) => it.key === openKey)
            .map((it) => (
              <div
                key={it.key}
                className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 sm:grid-cols-3"
              >
                {(it.children ?? []).map((child: NavigationItem) => (
                  <Link
                    key={child.key}
                    href={child.href}
                    className="flex flex-col rounded-md p-3 hover:bg-secondary"
                  >
                    <span className="text-sm font-extrabold text-foreground">
                      {child.label}
                    </span>
                    {child.shortLabel && (
                      <span className="mt-0.5 text-xs text-muted-foreground">
                        {child.shortLabel}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ))}
        </div>
      )}
    </nav>
  );
}

navigationRegistry.register({
  manifestVersion: 1,
  slug: "mega-menu",
  name: "Mega Menu",
  description:
    "Top bar with multi-column dropdown panels on hover. Best for sites with 5+ product categories or many service groupings.",
  version: "1.0.0",
  pattern: "mega",
  devices: ["desktop"],
  itemShape: {
    key: "mega-item",
    labelKey: "label",
    supportsBadges: false,
    supportsSubmenus: true
  },
  compatibleLayouts: ["ecommerce", "marketplace", "directory"],
  behaviours: ["hover-panel", "multi-column"],
  renderer: MegaNavRenderer,
  publisher: P
});
