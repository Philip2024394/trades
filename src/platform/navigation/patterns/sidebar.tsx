// navigation.sidebar — vertical dashboard sidebar.

"use client";

import Link from "next/link";
import { navigationRegistry } from "../registry";
import type { NavigationRendererProps } from "../types";
import { iconFor, P } from "./_shared";

function SidebarNavRenderer({
  items,
  brandLabel,
  brandHref,
  brandLogoUrl,
  currentPath
}: NavigationRendererProps) {
  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-full flex-col border-r border-border bg-background p-3"
    >
      <Link
        href={brandHref ?? "/"}
        className="mb-4 flex items-center gap-2 px-2 py-2 text-sm font-extrabold text-foreground"
      >
        {brandLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brandLogoUrl} alt="" className="h-7 w-auto object-contain" />
        )}
        {brandLabel && <span>{brandLabel}</span>}
      </Link>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = iconFor(item.icon);
          const active = item.isActive ?? currentPath === item.href;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className={
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-bold " +
                  (active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                }
              >
                <Icon size={16} strokeWidth={2.25} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-extrabold text-primary-foreground">
                    {item.badge}
                  </span>
                )}
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
  slug: "sidebar-dashboard",
  name: "Sidebar Navigation",
  description:
    "Vertical dashboard sidebar with icon + label items. Use with `containers.dashboard-shell` for merchant admin surfaces.",
  version: "1.0.0",
  pattern: "sidebar",
  devices: ["tablet", "desktop"],
  itemShape: {
    key: "sidebar-item",
    labelKey: "label",
    supportsBadges: true,
    supportsSubmenus: false
  },
  compatibleLayouts: ["dashboard", "saas", "marketplace"],
  behaviours: ["icon-label", "vertical"],
  renderer: SidebarNavRenderer,
  publisher: P
});
