// src/components/nex-app/founder-shell/FounderShell.tsx
//
// Founder 2026-09-10 · Shared shell for all founder-facing pages.
// Matches HQ theme (dark #0a0d10 background · green #22c55e accents).
// Left sidebar with links to every founder tool.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = { href: string; label: string; group?: string };

const NAV: NavItem[] = [
  { href: "/nexapp/hq",                          label: "HQ · Live" },
  { href: "/nexapp/founder-window",              label: "Founder Window" },
  { href: "/nexapp/lab",                         label: "Lab · Home", group: "Lab" },
  { href: "/nexapp/lab/promotions",              label: "Promotions", group: "Lab" },
  { href: "/nexapp/lab/brief",                   label: "Weekly brief", group: "Lab" },
  { href: "/nexapp/lab/marketing",               label: "Marketing · Home", group: "Marketing" },
  { href: "/nexapp/lab/marketing/policies",      label: "Policies", group: "Marketing" },
  { href: "/nexapp/lab/marketing/templates",     label: "Templates", group: "Marketing" },
  { href: "/nexapp/lab/marketing/campaigns",     label: "Campaigns", group: "Marketing" },
  { href: "/nexapp",                             label: "Chat · NEX", group: "Other" },
];

export function FounderShell({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  const pathname = usePathname();
  const groups = new Map<string, NavItem[]>();
  for (const item of NAV) {
    const key = item.group ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <div className="min-h-screen bg-[#0a0d10] text-neutral-100">
      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-0 h-screen w-56 shrink-0 border-r border-neutral-800/60 bg-[#0d1116]">
          <div className="border-b border-neutral-800/60 px-4 py-4">
            <Link href="/nexapp/hq" className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-emerald-500/30 ring-1 ring-emerald-500/50" />
              <span className="text-sm font-semibold tracking-tight text-neutral-100">NEX Founder</span>
            </Link>
          </div>
          <nav className="px-2 py-3">
            {[...groups.entries()].map(([groupName, items]) => (
              <div key={groupName} className="mb-3">
                {groupName && (
                  <div className="mb-1 px-2 text-[10px] uppercase tracking-wider text-neutral-500">{groupName}</div>
                )}
                {items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/nexapp" && pathname?.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href}
                      className={`block rounded-md px-3 py-1.5 text-xs transition-colors ${
                        active
                          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                          : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                      }`}>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="mt-4 border-t border-neutral-800/60 px-4 py-3 text-[10px] text-neutral-500">
            Every count on every page is a live Postgres query. No fake data.
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {(title || subtitle) && (
            <div className="border-b border-neutral-800/60 bg-[#0a0d10]/80 px-8 py-6 backdrop-blur">
              {title && <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">{title}</h1>}
              {subtitle && <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>}
            </div>
          )}
          <div className="px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
