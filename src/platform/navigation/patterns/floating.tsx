// navigation.floating — floating capsule nav.

"use client";

import Link from "next/link";
import { navigationRegistry } from "../registry";
import type { NavigationRendererProps } from "../types";
import { P } from "./_shared";

function FloatingNavRenderer({
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
      className="fixed left-1/2 top-4 z-40 -translate-x-1/2"
    >
      <div className="flex items-center gap-1 rounded-full border border-border bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Link
          href={brandHref ?? "/"}
          className="ml-1 flex items-center gap-2 rounded-full px-2 py-1 text-sm font-extrabold text-foreground"
        >
          {brandLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandLogoUrl} alt="" className="h-6 w-auto object-contain" />
          )}
          {brandLabel && <span>{brandLabel}</span>}
        </Link>
        <ul className="hidden items-center gap-0.5 sm:flex">
          {items.slice(0, 5).map((item) => {
            const active = item.isActive ?? currentPath === item.href;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={
                    "inline-flex items-center rounded-full px-2.5 py-1 text-sm font-bold " +
                    (active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                  }
                >
                  {item.shortLabel ?? item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="ml-1 inline-flex items-center rounded-full bg-primary px-3 py-1 text-sm font-extrabold text-primary-foreground"
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
  slug: "top-floating",
  name: "Floating Capsule",
  description:
    "Compact floating capsule nav pinned to the top-center. Modern SaaS / boutique aesthetic. Backdrop blur for translucency over content.",
  version: "1.0.0",
  pattern: "floating",
  devices: ["desktop"],
  itemShape: {
    key: "floating-item",
    labelKey: "shortLabel",
    supportsBadges: false,
    supportsSubmenus: false
  },
  compatibleLayouts: ["saas", "portfolio", "landing"],
  behaviours: ["capsule", "backdrop-blur", "top-center"],
  renderer: FloatingNavRenderer,
  publisher: P
});
