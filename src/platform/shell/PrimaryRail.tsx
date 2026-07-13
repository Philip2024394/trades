// Platform Primary Rail — sidebar rendered from appRegistry.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  The primary rail is the workspace shell's
//    identity anchor. It renders every registered App. If a rail
//    lived per App, it would be a header, not identity.
//
// 2. Which future Apps benefit?  Every App gets a slot the moment it
//    registers. Fleet, Insurance, Finance appear automatically when
//    installed. Zero shell code change.
//
// 3. Which doc authorises?  ADR-047 + TRADE_CENTER_PLATFORM_DELTA
//    §4.3 row "Command Palette (⌘K)" (workspace navigation pattern).
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Server-safe read from `appRegistry.list()` — the registry is
// hydrated at boot from the App manifests. This component is a thin
// projection. State (active-app, badges, unread counts) plugs in
// later via `sidebarState()` on each App's manifest (extend surface,
// wave 2).

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appRegistry } from "@/platform/registry";
import type { FrozenAppManifest } from "@/platform/registry";

export type PrimaryRailProps = {
  /** Route prefix under which the workspace shell renders. Every
   *  App's rail entry links to `${basePath}/${app.slug}`. */
  basePath?: string;
  /** Optional filter — only render Apps whose `category` matches the
   *  allowlist. When omitted, every registered App renders. */
  categories?: readonly string[];
};

export function PrimaryRail({
  basePath = "/tc",
  categories
}: PrimaryRailProps) {
  const pathname = usePathname();
  const apps = categories
    ? appRegistry.list().filter((a) => categories.includes(a.category))
    : appRegistry.list();

  return (
    <nav
      className="flex h-full w-16 flex-col items-center gap-1 border-r border-neutral-200 bg-white py-3"
      aria-label="Workspace primary navigation"
    >
      {apps.map((app) => (
        <PrimaryRailItem
          key={app.slug}
          app={app}
          basePath={basePath}
          active={pathname?.startsWith(`${basePath}/${app.slug}`) ?? false}
        />
      ))}
    </nav>
  );
}

function PrimaryRailItem({
  app,
  basePath,
  active
}: {
  app: FrozenAppManifest;
  basePath: string;
  active: boolean;
}) {
  return (
    <Link
      href={`${basePath}/${app.slug}`}
      className="group relative flex h-10 w-10 items-center justify-center rounded-lg transition"
      style={{
        backgroundColor: active ? "#FEF3C7" : "transparent"
      }}
      title={app.name}
    >
      {/* Icon: manifest.icon is a free-text string — could be emoji or
          asset URL. For Week 1 we render the raw value; Week 2 wave
          resolves to lucide when the string matches an icon name. */}
      <span className="text-[16px]" aria-hidden="true">
        {app.icon.length <= 4 ? app.icon : app.slug.charAt(0).toUpperCase()}
      </span>
      <span
        className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-md transition group-hover:opacity-100"
        aria-hidden="true"
      >
        {app.name}
      </span>
    </Link>
  );
}
