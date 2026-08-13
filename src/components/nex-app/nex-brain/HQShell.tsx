"use client";

// NEX Headquarters shared shell.
//
// Every route under /nex-app/nex-brain/* renders inside this component
// (see src/app/nex-app/nex-brain/layout.tsx). Provides the persistent
// sidebar + header that makes Headquarters feel like ONE application.
//
// Styling uses the canonical NEX design tokens declared in
// src/app/nex-app/nex-app.css (--nex-cream / --nex-neutral / --nex-accent).
// The shell root carries `.nex-app-root` so those tokens resolve.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Home,
  BookOpen,
  Factory,
  HardDrive,
  Database,
  CheckSquare,
  FileClock,
  ScrollText,
  Radio,
  Hammer,
} from "lucide-react";

type SectionDef = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  group: "core" | "workforce" | "review" | "external";
  /** Key into notification counts (server-fed) · when > 0 shows a red badge. */
  notificationKey?: "collector_claims";
};

const SECTIONS: SectionDef[] = [
  // Reception IS the operations-centre · /nex-app/nex-brain aliases it.
  // No separate "Operations" link — it would be a duplicate URL.
  { href: "/nex-app/nex-brain",                          label: "Reception",            icon: Home,        group: "core" },
  { href: "/nex-app/nex-brain/knowledge-control-centre", label: "Knowledge",            icon: BookOpen,    group: "core" },
  { href: "/nex-app/nex-brain/collector/staircase_refacing", label: "Collector",         icon: Hammer,      group: "core", notificationKey: "collector_claims" },
  { href: "/nex-app/nex-brain/collector/queue",              label: "URL Queue",         icon: Radio,       group: "core" },
  { href: "/nex-app/nex-brain/factory",                  label: "Workforce · Factory",  icon: Factory,     group: "workforce" },
  { href: "/nex-app/nex-brain/nex-storage",              label: "Storage",              icon: HardDrive,   group: "workforce" },
  { href: "/nex-app/nex-brain/data-platform-centre",     label: "Data Platform",        icon: Database,    group: "workforce" },
  { href: "/nex-app/nex-brain/review",                   label: "Review",               icon: CheckSquare, group: "review" },
  { href: "/nex-app/nex-brain/journal",                  label: "Journal",              icon: FileClock,   group: "review" },
  { href: "/nex-app/nex-brain/audit",                    label: "Audit",                icon: ScrollText,  group: "review" },
  { href: "/nex-app/nex-brain/comms-social-hq",          label: "Comms Social · HQ",    icon: Radio,       group: "external" },
];

export type HQNotificationCounts = {
  /** Number of directory_seeds rows in claim_requested / claim_pending — surfaces
   *  a red badge next to the Collector nav so admins never miss a claim. */
  collector_claims?: number;
};

const GROUP_LABEL: Record<SectionDef["group"], string> = {
  core:      "Command",
  workforce: "Workforce · Storage",
  review:    "Review · Audit",
  external:  "Cross-Tenant",
};

function activeFor(pathname: string): SectionDef | undefined {
  const exact = SECTIONS.find((s) => s.href === pathname);
  if (exact) return exact;
  return SECTIONS
    .filter((s) => s.href !== "/nex-app/nex-brain" && pathname.startsWith(s.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]
    ?? SECTIONS[0];
}

export function HQShell({ children, notificationCounts }: { children: ReactNode; notificationCounts?: HQNotificationCounts }) {
  const pathname = usePathname() || "/nex-app/nex-brain";
  const active = activeFor(pathname);
  const counts = notificationCounts ?? {};

  return (
    <div
      className="nex-app-root"
      style={{
        display: "grid",
        gridTemplateColumns: "248px 1fr",
        minHeight: "100vh",
        background: "var(--nex-cream)",
        color: "var(--nex-neutral-900)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <aside
        aria-label="NEX Headquarters navigation"
        style={{
          background: "var(--nex-cream-elev)",
          borderRight: "1px solid var(--nex-neutral-200)",
          padding: "20px 12px 24px",
          position: "sticky",
          top: 0,
          alignSelf: "start",
          height: "100vh",
          overflowY: "auto",
          boxShadow: "var(--nex-shadow-sm)",
        }}
      >
        <Link
          href="/nex-app/nex-brain"
          style={{
            display: "block",
            padding: "4px 12px 16px",
            borderBottom: "1px solid var(--nex-neutral-200)",
            marginBottom: 12,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "var(--nex-accent-600)",
            }}
          >
            NEX
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "var(--nex-neutral-900)",
              marginTop: 2,
              letterSpacing: "-0.01em",
            }}
          >
            Headquarters
          </div>
        </Link>

        {(Object.keys(GROUP_LABEL) as SectionDef["group"][]).map((group) => (
          <div key={group} style={{ marginTop: group === "core" ? 4 : 18 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--nex-neutral-400)",
                padding: "6px 12px",
                fontWeight: 600,
              }}
            >
              {GROUP_LABEL[group]}
            </div>
            {SECTIONS.filter((s) => s.group === group).map((s) => {
              const isActive = active?.href === s.href;
              const Icon = s.icon;
              const notifCount = s.notificationKey ? counts[s.notificationKey] ?? 0 : 0;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "var(--nex-accent-700)" : "var(--nex-neutral-700)",
                    background: isActive ? "var(--nex-accent-50)" : "transparent",
                    textDecoration: "none",
                    marginTop: 2,
                    borderLeft: isActive ? "3px solid var(--nex-accent-500)" : "3px solid transparent",
                    transition: "background var(--nex-motion-fast, 150ms) ease",
                  }}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.4 : 2} />
                  <span style={{ flex: 1 }}>{s.label}</span>
                  {notifCount > 0 && (
                    <span
                      aria-label={`${notifCount} pending`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 20,
                        height: 20,
                        padding: "0 6px",
                        borderRadius: 999,
                        background: "#EF4444", // red-500 · sits well against the accent scheme
                        color: "#FFFFFF",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.02em",
                        boxShadow: "0 0 0 2px var(--nex-cream-elev), 0 2px 6px rgba(239,68,68,0.4)",
                        animation: "hqBadgePulse 2s ease-in-out infinite",
                      }}
                    >
                      {notifCount > 99 ? "99+" : notifCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>

      <main
        style={{
          minWidth: 0,
          minHeight: "100vh",
          background: "var(--nex-cream)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 24px",
            borderBottom: "1px solid var(--nex-neutral-200)",
            background: "var(--nex-cream-elev)",
            position: "sticky",
            top: 0,
            zIndex: 20,
            boxShadow: "var(--nex-shadow-sm)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                color: "var(--nex-neutral-500)",
                fontWeight: 600,
              }}
            >
              NEX HEADQUARTERS
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "var(--nex-neutral-900)",
                marginTop: 2,
                letterSpacing: "-0.01em",
              }}
            >
              {active?.label ?? "Headquarters"}
            </div>
          </div>
          <Link
            href="/nex-app"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--nex-neutral-500)",
              textDecoration: "none",
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid var(--nex-neutral-200)",
              background: "var(--nex-neutral-0)",
            }}
          >
            Exit → nex-app
          </Link>
        </header>

        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </main>
      {/* Sidebar-badge pulse — subtle, not obnoxious. Draws the eye without
          being a distraction if the admin has other work open. */}
      <style>{`
        @keyframes hqBadgePulse {
          0%   { transform: scale(1);    box-shadow: 0 0 0 2px var(--nex-cream-elev), 0 2px 6px rgba(239,68,68,0.4); }
          50%  { transform: scale(1.08); box-shadow: 0 0 0 2px var(--nex-cream-elev), 0 4px 12px rgba(239,68,68,0.6); }
          100% { transform: scale(1);    box-shadow: 0 0 0 2px var(--nex-cream-elev), 0 2px 6px rgba(239,68,68,0.4); }
        }
      `}</style>
    </div>
  );
}
