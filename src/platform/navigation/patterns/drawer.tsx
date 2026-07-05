// navigation.drawer — mobile hamburger drawer.

"use client";

import Link from "next/link";
import * as React from "react";
import { Menu, X } from "lucide-react";
import { navigationRegistry } from "../registry";
import type { NavigationRendererProps } from "../types";
import { iconFor, P } from "./_shared";

function DrawerNavRenderer({
  items,
  brandLabel,
  brandHref,
  brandLogoUrl,
  ctaLabel,
  ctaHref,
  currentPath
}: NavigationRendererProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <nav
        aria-label="Primary"
        className="flex h-14 w-full items-center justify-between border-b border-border bg-background px-4"
      >
        <Link
          href={brandHref ?? "/"}
          className="flex items-center gap-2 text-base font-extrabold text-foreground"
        >
          {brandLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandLogoUrl} alt="" className="h-7 w-auto object-contain" />
          )}
          {brandLabel && <span>{brandLabel}</span>}
        </Link>
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-secondary"
        >
          <Menu size={22} strokeWidth={2.25} aria-hidden />
        </button>
      </nav>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60"
          onClick={() => setOpen(false)}
          aria-hidden
        >
          <aside
            className="ml-auto flex h-full w-[85%] max-w-sm flex-col bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Menu"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
                Menu
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-secondary"
              >
                <X size={22} strokeWidth={2.25} aria-hidden />
              </button>
            </div>
            <ul className="mt-4 flex flex-col gap-0.5">
              {items.map((item) => {
                const Icon = iconFor(item.icon);
                const active = item.isActive ?? currentPath === item.href;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={
                        "flex items-center gap-3 rounded-md px-3 py-3 text-base font-bold " +
                        (active
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                      }
                    >
                      {item.icon && (
                        <Icon size={18} strokeWidth={2.25} aria-hidden />
                      )}
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
            {ctaLabel && ctaHref && (
              <Link
                href={ctaHref}
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground"
              >
                {ctaLabel}
              </Link>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

navigationRegistry.register({
  manifestVersion: 1,
  slug: "drawer-hamburger",
  name: "Mobile Drawer",
  description:
    "Mobile hamburger menu — slides in from the right. Use for mobile pages that don't fit a bottom-tab pattern (marketing sites, complex nav trees).",
  version: "1.0.0",
  pattern: "drawer",
  devices: ["mobile"],
  itemShape: {
    key: "drawer-item",
    labelKey: "label",
    supportsBadges: true,
    supportsSubmenus: false
  },
  compatibleLayouts: ["*"],
  behaviours: ["off-canvas", "hamburger-toggle"],
  renderer: DrawerNavRenderer,
  publisher: P
});
