"use client";

// NEX Headquarters shared shell.
//
// Every route under /nex-head-quarters/* renders inside this component
// (see src/app/nex-head-quarters/layout.tsx). Provides the persistent
// sidebar + header that makes Headquarters feel like ONE application.
//
// Styling uses the canonical NEX design tokens declared in
// src/app/nex-app/nex-app.css (--nex-cream / --nex-neutral / --nex-accent).
// The shell root carries `.nex-app-root` so those tokens resolve.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CITY_REGISTRY } from "@/lib/nex/city-registry";
import { WORKFORCE_STATUS_META, type WorkforceStatus } from "@/lib/nex-hq/workforce-status";
import type { CityWorkforceDetail } from "@/lib/nex-hq/city-workforce-status";
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
  UtensilsCrossed,
  Activity,
  ImagePlus,
  Footprints,
  ClipboardList,
} from "lucide-react";
import { WALKER_VERTICALS, type WalkerLiveTier, type WalkerSidebarStatus } from "@/lib/nex-hq/walker-verticals";

type SectionDef = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  group: "core" | "verticals" | "workforce" | "review" | "external";
  /** Key into notification counts (server-fed) · when > 0 shows a red badge. */
  notificationKey?: "collector_claims";
  /** Key into walker statuses (server-fed) · when set renders a live green-light dot. */
  walkerStatusKey?: string;
};

const SECTIONS: SectionDef[] = [
  // Reception IS the operations-centre · /nex-head-quarters aliases it.
  // No separate "Operations" link — it would be a duplicate URL.
  { href: "/nex-head-quarters",                          label: "Reception",            icon: Home,        group: "core" },
  // Discovery workforce matrix (2026-08-24) · cities × categories LIVE state
  // Reuses existing subordinate walker/commerce/transport-data pages · no new dashboard.
  { href: "/nex-head-quarters/discovery",                label: "Discovery · Workforce Matrix", icon: Radio,      group: "core" },
  { href: "/nex-head-quarters/knowledge-control-centre", label: "Knowledge",            icon: BookOpen,    group: "core" },
  { href: "/nex-head-quarters/collector/staircase_refacing", label: "Collector",         icon: Hammer,      group: "core", notificationKey: "collector_claims" },
  { href: "/nex-head-quarters/collector/queue",              label: "URL Queue",         icon: Radio,       group: "core" },
  // Verticals · Yogyakarta Food Ops (Walker · Directory · Universe · Freshness · Layer 3 claims)
  { href: "/nex-head-quarters/food-ops",                 label: "Food Ops · Yogyakarta", icon: UtensilsCrossed, group: "verticals" },
  // Task #88 Phase 3 (2026-08-22) · Promotion queue · admin adjudication of enrichment evidence
  // + business-level Promote-to-Directory via existing primitive. Consolidates the PromoteButton
  // primitive into a full adjudication workflow (Philip 2026-08-22 explicit).
  { href: "/nex-head-quarters/food-ops/promotion-queue", label: "Food Ops · Promotion Queue", icon: CheckSquare, group: "verticals" },
  // Task #86 + 2026-08-23 per-vertical redesign · one sidebar entry per Walker
  // registered in src/lib/nex-hq/walker-verticals.ts · each carries a live
  // green-light dot fed by nex.worker_heartbeat (see layout.tsx). Order matches
  // the registry so adding a new vertical there automatically threads through
  // to the sidebar with no extra edit here.
  ...WALKER_VERTICALS.map<SectionDef>((v) => ({
    href: `/nex-head-quarters/walker/${v.id}`,
    label: `Walker · ${v.label}`,
    icon: Footprints,
    group: "workforce" as const,
    walkerStatusKey: v.workerId,
  })),
  // Transport Discovery · subordinate operational view for Transport Walker
  // (Philip 2026-08-23 · "one HQ, subordinate operational pages" rule).
  { href: "/nex-head-quarters/transport-data",           label: "Transport Discovery · Yogyakarta", icon: Footprints, group: "verticals" },
  // NEX Market · vertical-slice ops view (2026-08-23 · renamed from Commerce).
  { href: "/nex-head-quarters/commerce",                 label: "NEX Market · Yogyakarta", icon: Radio, group: "verticals" },
  { href: "/nex-head-quarters/factory",                  label: "Workforce · Factory",  icon: Factory,     group: "workforce" },
  // Workers · reliability layer (heartbeat · cycle_run · missed runs · health)
  { href: "/nex-head-quarters/workers",                  label: "Workers · Reliability",icon: Activity,    group: "workforce" },
  { href: "/nex-head-quarters/nex-storage",              label: "Storage",              icon: HardDrive,   group: "workforce" },
  { href: "/nex-head-quarters/data-platform-centre",     label: "Data Platform",        icon: Database,    group: "workforce" },
  // Image intake · dump URLs / files · pluggable vision behind NEX-owned interface
  { href: "/nex-head-quarters/image-intake",             label: "Image Intake",         icon: ImagePlus,   group: "workforce" },
  { href: "/nex-head-quarters/review",                   label: "Review",               icon: CheckSquare, group: "review" },
  // Directory Factory · Phase 2 (2026-08-23) · human review of Walker
  // CATEGORY_CANDIDATE proposals. Subordinate HQ page · never a new
  // dashboard (project_nex_dashboard_singularity_constitutional_rule).
  // Decisions here persist to nex.category_candidate only · Registry
  // activation is Phase 3 (Factory activation engine, not yet built).
  { href: "/nex-head-quarters/directory-factory",        label: "Directory Factory · Candidates", icon: ClipboardList, group: "review" },
  { href: "/nex-head-quarters/journal",                  label: "Journal",              icon: FileClock,   group: "review" },
  { href: "/nex-head-quarters/audit",                    label: "Audit",                icon: ScrollText,  group: "review" },
  { href: "/nex-head-quarters/comms-social-hq",          label: "Comms Social · HQ",    icon: Radio,       group: "external" },
];

// ── Indonesia sidebar tree (2026-08-24) ────────────────────────────────
// Registry-driven region → city hierarchy · collapsible · scales to 100+.
// Every dot from real cityDetails · never fake activity.
function IndonesiaTree({ cityDetails }: { cityDetails: CityWorkforceDetail[] }) {
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(() => new Set(["DIY"])); // DIY expanded by default
  const [expandedCities,  setExpandedCities]  = useState<Set<string>>(() => new Set());
  const [search,          setSearch]          = useState("");

  const detailByCity = new Map(cityDetails.map((d) => [d.city, d]));

  // Group cities by region (from registry · single source of truth).
  const regions = new Map<string, typeof CITY_REGISTRY>();
  const q = search.trim().toLowerCase();
  for (const c of CITY_REGISTRY) {
    if (q && !c.canonical.toLowerCase().includes(q) && !c.province.toLowerCase().includes(q)) continue;
    const arr = regions.get(c.region) ?? [];
    arr.push(c);
    regions.set(c.region, arr as typeof CITY_REGISTRY);
  }

  return (
    <div style={{ marginTop: 20, borderTop: "1px solid var(--nex-neutral-200)", paddingTop: 12 }}>
      <div style={{
        fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
        color: "var(--nex-neutral-400)", padding: "6px 12px", fontWeight: 600,
      }}>
        Indonesia · live workforce
      </div>
      {/* Search box · essential at 50+ cities */}
      <div style={{ padding: "2px 8px 8px 8px" }}>
        <input
          type="text"
          placeholder="Search city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "5px 8px",
            border: "1px solid var(--nex-neutral-200)", borderRadius: 6,
            fontSize: 11, background: "var(--nex-neutral-0)",
          }}
        />
      </div>
      {[...regions.entries()].map(([region, cities]) => {
        const isExpanded = expandedRegions.has(region) || q.length > 0;   // any search auto-expands
        return (
          <div key={region} style={{ marginBottom: 2 }}>
            <button
              type="button"
              onClick={() => setExpandedRegions((prev) => {
                const next = new Set(prev);
                if (next.has(region)) next.delete(region); else next.add(region);
                return next;
              })}
              style={{
                width: "100%", padding: "5px 12px",
                display: "flex", alignItems: "center", gap: 6,
                background: "transparent", border: "none",
                fontSize: 11, fontWeight: 700, color: "var(--nex-neutral-700)",
                cursor: "pointer", textAlign: "left",
                letterSpacing: 0.5,
              }}
            >
              <span style={{ fontSize: 9, color: "var(--nex-neutral-500)" }}>{isExpanded ? "▾" : "▸"}</span>
              <span>{region.toUpperCase()}</span>
              <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--nex-neutral-500)", fontWeight: 500 }}>
                {cities.length} {cities.length === 1 ? "city" : "cities"}
              </span>
            </button>
            {isExpanded && cities.map((cityEntry) => {
              const detail = detailByCity.get(cityEntry.canonical);
              const aggregate: WorkforceStatus = detail?.aggregate ?? "unavailable";
              const meta = WORKFORCE_STATUS_META[aggregate];
              const isCityExpanded = expandedCities.has(cityEntry.slug);
              const perCat = detail?.perCategory ?? [];
              return (
                <div key={cityEntry.slug} style={{ marginBottom: 1 }}>
                  <div style={{ display: "flex", alignItems: "stretch" }}>
                    <button
                      type="button"
                      onClick={() => setExpandedCities((prev) => {
                        const next = new Set(prev);
                        if (next.has(cityEntry.slug)) next.delete(cityEntry.slug); else next.add(cityEntry.slug);
                        return next;
                      })}
                      style={{
                        padding: "4px 6px 4px 22px",
                        background: "transparent", border: "none",
                        cursor: "pointer", fontSize: 10, color: "var(--nex-neutral-500)",
                      }}
                      aria-label={isCityExpanded ? "collapse" : "expand"}
                    >
                      {isCityExpanded ? "▾" : "▸"}
                    </button>
                    <Link
                      href={`/nex-head-quarters/discovery?city=${cityEntry.slug}`}
                      style={{
                        flex: 1,
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "4px 10px 4px 0",
                        fontSize: 12, color: "var(--nex-neutral-700)",
                        textDecoration: "none",
                      }}
                      title={`${cityEntry.canonical} · ${meta.label}`}
                    >
                      <span style={{ fontSize: 9 }} aria-hidden="true">{meta.dot}</span>
                      <span>{cityEntry.canonical}</span>
                    </Link>
                  </div>
                  {isCityExpanded && (
                    <div style={{ paddingLeft: 34, paddingBottom: 4, display: "flex", flexDirection: "column", gap: 1 }}>
                      {perCat.map((pc) => {
                        const catMeta = WORKFORCE_STATUS_META[pc.status];
                        const href = catHref(pc.category);
                        return (
                          <Link
                            key={pc.category}
                            href={href}
                            style={{
                              display: "flex", alignItems: "center", gap: 6,
                              padding: "2px 8px", fontSize: 10.5,
                              color: "var(--nex-neutral-700)", textDecoration: "none",
                            }}
                            title={`${cityEntry.canonical} · ${pc.category} · ${catMeta.label}`}
                          >
                            <span style={{ fontSize: 12 }}>{catEmoji(pc.category)}</span>
                            <span style={{ flex: 1, textTransform: "capitalize" }}>{pc.category}</span>
                            <span style={{ fontSize: 8 }} aria-hidden="true">{catMeta.dot}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ padding: "10px 12px", fontSize: 9, color: "var(--nex-neutral-400)", lineHeight: 1.5 }}>
        Every dot from live rotation + orchestrator state · <strong style={{ color: "#991b1b" }}>SATURATED is temporary</strong> · new cities added via city-registry.ts appear here automatically · no per-city UI.
      </div>
    </div>
  );
}

function catHref(cat: string): string {
  switch (cat) {
    case "food":          return "/nex-head-quarters/walker/food";
    case "accommodation": return "/nex-head-quarters/walker/accommodation";
    case "market":        return "/nex-head-quarters/commerce";
    case "transport":     return "/nex-head-quarters/transport-data";
    default:              return "/nex-head-quarters/discovery";
  }
}

function catEmoji(cat: string): string {
  switch (cat) {
    case "food":          return "🍜";
    case "accommodation": return "🏨";
    case "market":        return "🏪";
    case "transport":     return "🚕";
    default:              return "📍";
  }
}

export type HQNotificationCounts = {
  /** Number of directory_seeds rows in claim_requested / claim_pending — surfaces
   *  a red badge next to the Collector nav so admins never miss a claim. */
  collector_claims?: number;
};

const GROUP_LABEL: Record<SectionDef["group"], string> = {
  core:      "Command",
  verticals: "Verticals",
  workforce: "Workforce · Storage",
  review:    "Review · Audit",
  external:  "Cross-Tenant",
};

function activeFor(pathname: string): SectionDef | undefined {
  const exact = SECTIONS.find((s) => s.href === pathname);
  if (exact) return exact;
  return SECTIONS
    .filter((s) => s.href !== "/nex-head-quarters" && pathname.startsWith(s.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]
    ?? SECTIONS[0];
}

export function HQShell({
  children,
  notificationCounts,
  walkerStatuses,
  cityWorkforceDetails,
}: {
  children: ReactNode;
  notificationCounts?: HQNotificationCounts;
  /** Map of worker_id → live heartbeat status · fed by the layout server component.
   *  Sidebar entries whose walkerStatusKey matches a key here render a live dot. */
  walkerStatuses?: Record<string, WalkerSidebarStatus>;
  /** Per-city workforce aggregate for the Indonesia sidebar tree · fed by layout.
   *  When absent (or empty), the Indonesia tree still renders with UNAVAILABLE dots
   *  · never fake activity. */
  cityWorkforceDetails?: CityWorkforceDetail[];
}) {
  const pathname = usePathname() || "/nex-head-quarters";
  const active = activeFor(pathname);
  const counts = notificationCounts ?? {};
  const walkers = walkerStatuses ?? {};
  const cityDetails = cityWorkforceDetails ?? [];

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
        // 2026-08-24: browser extensions (Grammarly / Dark Reader / password managers)
        // routinely inject attributes into anchor + interactive elements inside the
        // HQ sidebar, producing the hydration warning Philip saw on 2026-08-24.
        // Sidebar has no user-input · suppressing here is safe · does NOT mask
        // real hydration bugs in the app content (children).
        suppressHydrationWarning
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
          href="/nex-head-quarters"
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
              const walkerStatus = s.walkerStatusKey ? walkers[s.walkerStatusKey] : undefined;
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
                  {walkerStatus && <WalkerStatusDot status={walkerStatus} />}
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

        {/* Indonesia region-collapsible tree · 2026-08-24 · Philip lock:
             "HQ needs a scalable Indonesia → region → city hierarchy · MUST
             stay tidy at 50, 100+ cities · workforce dots must be REAL DB." */}
        <IndonesiaTree cityDetails={cityDetails} />
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
          being a distraction if the admin has other work open. Walker running
          pulse uses accent orange to mirror WalkerLiveIndicator's semantics. */}
      <style>{`
        @keyframes hqBadgePulse {
          0%   { transform: scale(1);    box-shadow: 0 0 0 2px var(--nex-cream-elev), 0 2px 6px rgba(239,68,68,0.4); }
          50%  { transform: scale(1.08); box-shadow: 0 0 0 2px var(--nex-cream-elev), 0 4px 12px rgba(239,68,68,0.6); }
          100% { transform: scale(1);    box-shadow: 0 0 0 2px var(--nex-cream-elev), 0 2px 6px rgba(239,68,68,0.4); }
        }
        @keyframes hqWalkerRunningPulse {
          0%   { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.55); }
          70%  { box-shadow: 0 0 0 6px rgba(249, 115, 22, 0); }
          100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
        }
      `}</style>
    </div>
  );
}

// ── Walker status dot · sidebar indicator ────────────────────────────
//
// Small live dot rendered inside a Walker sidebar entry. Colour + animation
// come from the server-fed heartbeat status (never made up client-side).
//
//   running  · orange · animated pulse    · cycle in progress right now
//   idle     · green  · static            · normal between-tick state
//   overdue  · amber  · static            · missed its 15-min slot
//   stopped  · red    · static            · Victus off / scheduler down
//
// Kept intentionally tiny (8px) so it reads as a status light beside the
// label, not as a badge competing for attention with the red notification
// pill used elsewhere.
function WalkerStatusDot({ status }: { status: WalkerSidebarStatus }) {
  const style = tierStyles[status.tier];
  const label = tierLabel(status.tier, status.ageSeconds);
  return (
    <span
      aria-label={`Walker ${status.tier}: ${label}`}
      title={label}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: style.color,
        marginLeft: 2,
        flexShrink: 0,
        animation: style.animate ? "hqWalkerRunningPulse 1.4s ease-in-out infinite" : "none",
      }}
    />
  );
}

const tierStyles: Record<WalkerLiveTier, { color: string; animate: boolean }> = {
  running: { color: "#f97316", animate: true  },   // orange · currently ticking
  idle:    { color: "#10b981", animate: false },   // green  · healthy between ticks
  overdue: { color: "#eab308", animate: false },   // amber  · missed cadence
  stopped: { color: "#ef4444", animate: false },   // red    · Walker is off
};

function tierLabel(tier: WalkerLiveTier, ageSeconds: number | null): string {
  const age = ageSeconds == null
    ? "no heartbeat"
    : ageSeconds < 60   ? `${ageSeconds}s ago`
    : ageSeconds < 3600 ? `${Math.round(ageSeconds / 60)}m ago`
                        : `${Math.round(ageSeconds / 3600)}h ago`;
  const word =
    tier === "running" ? "currently running" :
    tier === "idle"    ? "idle · healthy"    :
    tier === "overdue" ? "overdue · missed a tick" :
                         "stopped";
  return `${word} · heartbeat ${age}`;
}
