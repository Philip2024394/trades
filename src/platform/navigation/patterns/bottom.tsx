// navigation.bottom — mobile bottom tab bar.

"use client";

import Link from "next/link";
import { navigationRegistry } from "../registry";
import type { NavigationRendererProps } from "../types";
import { iconFor, P } from "./_shared";

function BottomNavRenderer({ items, currentPath }: NavigationRendererProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom,0)] shadow-lg"
    >
      <ul className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
        {items.slice(0, 5).map((item) => {
          const Icon = iconFor(item.icon);
          const active = item.isActive ?? currentPath === item.href;
          return (
            <li key={item.key} className="min-w-0 flex-1">
              <Link
                href={item.href}
                className={
                  "flex flex-col items-center gap-0.5 rounded-md px-2 py-1 " +
                  (active ? "text-primary" : "text-muted-foreground")
                }
              >
                <div className="relative">
                  <Icon size={22} strokeWidth={2.25} aria-hidden />
                  {item.badge !== undefined && (
                    <span className="absolute -right-2 -top-1 rounded-full bg-primary px-1 py-0.5 text-[10px] font-extrabold text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wide">
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

navigationRegistry.register({
  manifestVersion: 1,
  slug: "bottom-tabs",
  name: "Bottom Tabs",
  description:
    "Mobile bottom tab bar — icon + short label per entry. Native-app feel; use for mobile-first storefronts and PWAs.",
  version: "1.0.0",
  pattern: "bottom",
  devices: ["mobile"],
  itemShape: {
    key: "bottom-item",
    labelKey: "shortLabel",
    supportsBadges: true,
    supportsSubmenus: false
  },
  compatibleLayouts: ["mobile-app", "ecommerce", "booking"],
  behaviours: ["thumb-zone", "icon-primary"],
  renderer: BottomNavRenderer,
  publisher: P
});
