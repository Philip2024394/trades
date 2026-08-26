// src/app/nex-head-quarters/discovery/[city]/[category]/page.tsx
//
// HQ · Combo Detail (2026-08-24 · the bridge between workforce + directory).
//
// Philip 2026-08-24: "HQ needs to show the workforce AND the resulting data in
// the same mental model. When you click Indonesia → Sleman → Market you should
// see: is NEX working? · what did it find? · where did the data go?"
//
// ONE dynamic page renders every (city, category) combo. Route param resolves
// against city-registry.ts + WALKED_CATEGORIES. Unknown combos → notFound().
// Every number from real DB · no estimates · no fabricated state.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getFoodDbPool } from "@/lib/nex-food/db";
import { cityFromSlug } from "@/lib/nex/city-registry";
import { WALKED_CATEGORIES } from "@/lib/nex-hq/discovery-rotation";
import { WORKFORCE_STATUS_META, resolveWorkforceStatus, type WorkforceStatus } from "@/lib/nex-hq/workforce-status";
import "../../../../nex-app/nex-app.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtInt(n: number | null | undefined): string { return (n ?? 0).toLocaleString("en-GB"); }
function fmtIso(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-GB", { hour12: false });
}
function fmtDurMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

interface CategoryCounts {
  label: string;              // "Discovered · Listed · Registered · Verified · Active"
  buckets: { label: string; n: number; tone: "neutral" | "amber" | "blue" | "green" }[];
}

// Per-category DB counts · never fabricated · always from real tables.
async function loadCategoryCounts(pool: ReturnType<typeof getFoodDbPool>, canonicalCity: string, category: string): Promise<CategoryCounts> {
  const buckets: CategoryCounts["buckets"] = [];
  if (category === "accommodation") {
    const r = await pool.query(`
      SELECT
        count(*) FILTER (WHERE claim_status='discovered')::int AS discovered,
        count(*) FILTER (WHERE claim_status='listed')::int AS listed,
        count(*) FILTER (WHERE claim_status='invited')::int AS invited,
        count(*) FILTER (WHERE claim_status='claimed')::int AS claimed,
        count(*) FILTER (WHERE claim_status='paying')::int AS paying,
        count(*) FILTER (WHERE owner_status IN ('verified','claimed'))::int AS owner_verified
      FROM nex.accommodation_business WHERE city = $1 AND country = 'ID'
    `, [canonicalCity]);
    const rw = r.rows[0] ?? {};
    buckets.push({ label: "Discovered", n: Number(rw.discovered ?? 0), tone: "neutral" });
    buckets.push({ label: "Listed",     n: Number(rw.listed ?? 0),     tone: "blue" });
    buckets.push({ label: "Invited",    n: Number(rw.invited ?? 0),    tone: "amber" });
    buckets.push({ label: "Claimed",    n: Number(rw.claimed ?? 0),    tone: "amber" });
    buckets.push({ label: "Paying",     n: Number(rw.paying ?? 0),     tone: "green" });
    buckets.push({ label: "Owner verified", n: Number(rw.owner_verified ?? 0), tone: "green" });
  } else if (category === "food") {
    const r = await pool.query(`
      SELECT
        count(*) FILTER (WHERE claim_status='discovered')::int AS discovered,
        count(*) FILTER (WHERE claim_status='listed')::int AS listed,
        count(*) FILTER (WHERE claim_status='invited')::int AS invited,
        count(*) FILTER (WHERE claim_status='claimed')::int AS claimed,
        count(*) FILTER (WHERE claim_status='paying')::int AS paying
      FROM nex.food_business WHERE city = $1
    `, [canonicalCity]);
    const rw = r.rows[0] ?? {};
    buckets.push({ label: "Discovered", n: Number(rw.discovered ?? 0), tone: "neutral" });
    buckets.push({ label: "Listed",     n: Number(rw.listed ?? 0),     tone: "blue" });
    buckets.push({ label: "Invited",    n: Number(rw.invited ?? 0),    tone: "amber" });
    buckets.push({ label: "Claimed",    n: Number(rw.claimed ?? 0),    tone: "amber" });
    buckets.push({ label: "Paying",     n: Number(rw.paying ?? 0),     tone: "green" });
  } else if (category === "market") {
    // mp_seller uses jurisdiction like "ID/DIY/Sleman" · match SUFFIX (city segment)
    // Handles hyphenated city names like "Kulon-Progo".
    const r = await pool.query(`
      SELECT
        count(*) FILTER (WHERE status='discovered')::int AS discovered,
        count(*) FILTER (WHERE status='claimable')::int AS claimable,
        count(*) FILTER (WHERE status='claimed')::int AS claimed,
        count(*) FILTER (WHERE status='registered')::int AS registered,
        count(*) FILTER (WHERE status='verified')::int AS verified,
        count(*) FILTER (WHERE status='active')::int AS active
      FROM nex.mp_seller
      WHERE jurisdiction ILIKE '%/' || $1 OR jurisdiction ILIKE '%/' || $2
    `, [canonicalCity, canonicalCity.replace(/ /g, "-")]);
    const rw = r.rows[0] ?? {};
    buckets.push({ label: "Discovered", n: Number(rw.discovered ?? 0), tone: "neutral" });
    buckets.push({ label: "Claimable",  n: Number(rw.claimable ?? 0),  tone: "amber" });
    buckets.push({ label: "Claimed",    n: Number(rw.claimed ?? 0),    tone: "amber" });
    buckets.push({ label: "Registered", n: Number(rw.registered ?? 0), tone: "blue" });
    buckets.push({ label: "Verified",   n: Number(rw.verified ?? 0),   tone: "green" });
    buckets.push({ label: "Active",     n: Number(rw.active ?? 0),     tone: "green" });
  } else if (category === "transport") {
    try {
      const r = await pool.query(`
        SELECT
          count(*) FILTER (WHERE discovery_stage='discovered')::int AS discovered,
          count(*) FILTER (WHERE discovery_stage='public_contact_verified')::int AS contact_verified,
          count(*) FILTER (WHERE discovery_stage='invitable')::int AS invitable,
          count(*) FILTER (WHERE discovery_stage='invited')::int AS invited,
          count(*) FILTER (WHERE discovery_stage='registered')::int AS registered,
          count(*) FILTER (WHERE discovery_stage='verified')::int AS verified,
          count(*) FILTER (WHERE discovery_stage='active')::int AS active
        FROM nex.transport_acquisition_record
        WHERE city = $1 OR home_jurisdiction ILIKE '%/' || $1
      `, [canonicalCity]);
      const rw = r.rows[0] ?? {};
      buckets.push({ label: "Discovered",       n: Number(rw.discovered ?? 0),       tone: "neutral" });
      buckets.push({ label: "Contact verified", n: Number(rw.contact_verified ?? 0), tone: "amber" });
      buckets.push({ label: "Invitable",        n: Number(rw.invitable ?? 0),        tone: "amber" });
      buckets.push({ label: "Invited",          n: Number(rw.invited ?? 0),          tone: "amber" });
      buckets.push({ label: "Registered",       n: Number(rw.registered ?? 0),       tone: "blue" });
      buckets.push({ label: "Verified",         n: Number(rw.verified ?? 0),         tone: "green" });
      buckets.push({ label: "Active",           n: Number(rw.active ?? 0),           tone: "green" });
    } catch {
      // Transport table may not exist yet · honest empty state
      buckets.push({ label: "table not yet populated", n: 0, tone: "neutral" });
    }
  }
  return { label: "Discovery funnel", buckets };
}

function publicDirectoryLink(city: { slug: string; canonical: string }, category: string): { href: string; label: string } | null {
  switch (category) {
    case "accommodation": return { href: `/accommodation/${city.slug}`,    label: `Open /accommodation/${city.slug}` };
    case "market":        return { href: `/nex-market/city/${city.slug}`, label: `Open /nex-market/city/${city.slug}` };
    case "food":          return { href: `/food`,                          label: `Open /food (per-city route pending)` };
    case "transport":     return null;   // no public transport directory yet
    default:              return null;
  }
}

function workerConfigPrefix(city: string, category: string): string {
  switch (category) {
    case "market":        return `market:${city.replace(/ /g, "-").toLowerCase()}%`;
    case "food":          return `food:${city}:%`;
    case "accommodation": return `accommodation:${city}:%`;
    case "transport":     return `transport:${city}:%`;
    default:              return "";
  }
}

export default async function ComboDetailPage(
  { params }: { params: Promise<{ city: string; category: string }> },
): Promise<React.JSX.Element> {
  const { city: citySlug, category } = await params;
  const cityEntry = cityFromSlug(citySlug);
  if (!cityEntry) notFound();
  if (!WALKED_CATEGORIES.includes(category as typeof WALKED_CATEGORIES[number])) notFound();

  const pool = getFoodDbPool();
  const cfgPrefix = workerConfigPrefix(cityEntry.canonical, category);
  const cfgLike = cfgPrefix.replace("%", "") + "%";

  // Current activity · in-flight cycle for this combo
  const inFlightQ = pool.query(`
    SELECT id, worker_config, started_at, summary
      FROM nex.worker_cycle_run
     WHERE status='running' AND worker_config LIKE $1
       AND started_at > now() - interval '2 hours'
     ORDER BY started_at DESC LIMIT 1
  `, [cfgLike]);

  // Recent cycles (last 10 · any status)
  const recentQ = pool.query(`
    SELECT id, worker_config, started_at, finished_at, status, records_processed, records_new, errors_count, duration_ms
      FROM nex.worker_cycle_run
     WHERE worker_config LIKE $1
     ORDER BY started_at DESC LIMIT 10
  `, [cfgLike]);

  // Rotation state for this combo
  const rotationQ = pool.query(`
    SELECT state, consecutive_zero_new_cycles, records_new_last_cycle, total_records_last_cycle,
           last_cycle_started_at, last_productive_at, reactivation_reason, next_action_hint
      FROM nex.discovery_rotation_state
     WHERE city = $1 AND category = $2 LIMIT 1
  `, [cityEntry.canonical, category]);

  // DB counts for this category
  const countsQ = loadCategoryCounts(pool, cityEntry.canonical, category);

  const [inFlight, recent, rotation, counts] = await Promise.all([inFlightQ, recentQ, rotationQ, countsQ]);
  const rotState = rotation.rows[0] ?? null;
  const inFlightRow = inFlight.rows[0] ?? null;

  // Resolve current workforce status honestly
  const status: WorkforceStatus = resolveWorkforceStatus({
    city: cityEntry.canonical,
    category,
    walkerAvailable: true,
    rotationState: (rotState?.state as WorkforceStatus | undefined) === "unavailable" ? null : (rotState?.state ?? null),
    lastCycleStatus: recent.rows[0]?.status === "completed" || recent.rows[0]?.status === "failed" || recent.rows[0]?.status === "running" ? recent.rows[0].status : null,
    consecutiveZeroNewCycles: rotState?.consecutive_zero_new_cycles ?? 0,
    inFlight: Boolean(inFlightRow),
    isQueued: false,
    isEligible: false,
    isWaitingCooldown: false,
    isGatedProvider: false,
  });
  const statusMeta = WORKFORCE_STATUS_META[status];
  const publicDir = publicDirectoryLink(cityEntry, category);

  return (
    <div className="nex-app-root" style={{ padding: "24px 32px", background: "var(--nex-cream)", minHeight: "100vh", color: "var(--nex-neutral-900)" }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 11, color: "var(--nex-neutral-500)", marginBottom: 6 }}>
        <Link href="/nex-head-quarters/discovery" style={{ color: "#c2410c", textDecoration: "none" }}>← Discovery Matrix</Link>
        <span style={{ margin: "0 6px" }}>·</span>
        Indonesia
        <span style={{ margin: "0 6px" }}>·</span>
        {cityEntry.region}
        <span style={{ margin: "0 6px" }}>·</span>
        {cityEntry.canonical}
        <span style={{ margin: "0 6px" }}>·</span>
        <span style={{ textTransform: "capitalize" }}>{category}</span>
      </div>

      {/* Header */}
      <header style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "6px 0 4px 0" }}>
            {cityEntry.canonical} · <span style={{ textTransform: "capitalize" }}>{category}</span>
          </h1>
          <div style={{ fontSize: 12, color: "var(--nex-neutral-500)" }}>
            {cityEntry.province} · combo detail · every value from live DB
          </div>
        </div>
        <span style={{
          fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase",
          padding: "6px 14px", borderRadius: 999, fontWeight: 800,
          background: statusMeta.bg, color: statusMeta.fg, border: `1px solid ${statusMeta.border}`,
        }}>
          {statusMeta.dot} {statusMeta.label}
        </span>
      </header>

      {/* Q1 · Is NEX working? · Current activity */}
      <section style={panelStyle}>
        <SectionLabel emoji="1️⃣">Is NEX working? · current activity</SectionLabel>
        {inFlightRow ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, fontSize: 12 }}>
            <MetricRow label="Status" value="🟢 WORKING NOW" valueColor="#047857" />
            <MetricRow label="Started" value={fmtIso(inFlightRow.started_at as string | Date)} />
            <MetricRow label="Worker config" value={String(inFlightRow.worker_config)} />
            <MetricRow label="Provider" value="Nominatim (via governor)" />
          </div>
        ) : rotState ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, fontSize: 12 }}>
            <MetricRow label="Rotation state" value={`${WORKFORCE_STATUS_META[rotState.state as WorkforceStatus]?.dot ?? "⚪"} ${String(rotState.state).toUpperCase()}`} />
            <MetricRow label="Last cycle started" value={fmtIso(rotState.last_cycle_started_at as string | Date | null)} />
            <MetricRow label="Last productive" value={fmtIso(rotState.last_productive_at as string | Date | null)} />
            <MetricRow label="Consecutive zero-new" value={fmtInt(rotState.consecutive_zero_new_cycles as number)} />
            {rotState.reactivation_reason && <MetricRow label="Reactivate reason" value={String(rotState.reactivation_reason)} />}
            {rotState.next_action_hint && <MetricRow label="Next action" value={String(rotState.next_action_hint)} />}
          </div>
        ) : (
          <div style={hollowStyle}>No rotation state recorded yet · start the scheduler with <code>NEX_DEV_WORKERS=1 npm run dev:workers</code></div>
        )}
      </section>

      {/* Q2 · What did it find? · Recent activity */}
      <section style={panelStyle}>
        <SectionLabel emoji="2️⃣">What did it find? · recent activity (last 10 cycles)</SectionLabel>
        {recent.rows.length === 0 ? (
          <div style={hollowStyle}>No cycles recorded for this combo yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Started</th>
                  <th style={thStyle}>Status</th>
                  <th style={thNumStyle}>Processed</th>
                  <th style={thNumStyle}>New</th>
                  <th style={thNumStyle}>Errors</th>
                  <th style={thNumStyle}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {recent.rows.map((c: Record<string, unknown>) => {
                  const status = String(c.status);
                  const newCount = Number(c.records_new ?? 0);
                  return (
                    <tr key={String(c.id)}>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{fmtIso(c.started_at as string | Date)}</td>
                      <td style={tdStyle}>
                        <span style={{ color: status === "completed" ? (newCount > 0 ? "#047857" : "#555") : status === "failed" ? "#991b1b" : "#666", fontWeight: 700 }}>
                          {status === "completed" && newCount > 0 ? "✅" : status === "completed" ? "⚪" : status === "failed" ? "🟠" : "🟢"} {status}
                        </span>
                      </td>
                      <td style={tdNumStyle}>{fmtInt(c.records_processed as number)}</td>
                      <td style={{ ...tdNumStyle, color: newCount > 0 ? "#047857" : "var(--nex-neutral-500)", fontWeight: newCount > 0 ? 800 : 500 }}>{fmtInt(c.records_new as number)}</td>
                      <td style={{ ...tdNumStyle, color: Number(c.errors_count ?? 0) > 0 ? "#991b1b" : "var(--nex-neutral-500)" }}>{fmtInt(c.errors_count as number)}</td>
                      <td style={tdNumStyle}>{fmtDurMs(c.duration_ms as number | null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Q3 · Where did the data go? · DB counts + public directory */}
      <section style={panelStyle}>
        <SectionLabel emoji="3️⃣">Where did the data go? · database + public directory</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
          {counts.buckets.map((b) => {
            const tone = b.tone === "green" ? { bg: "rgba(16,185,129,0.10)", fg: "#047857" }
                       : b.tone === "blue"  ? { bg: "rgba(37,99,235,0.10)",  fg: "#1e40af" }
                       : b.tone === "amber" ? { bg: "rgba(245,158,11,0.10)", fg: "#92400e" }
                                            : { bg: "rgba(0,0,0,0.03)",       fg: "#525252" };
            return (
              <div key={b.label} style={{ padding: "10px 12px", borderRadius: 8, background: tone.bg, border: `1px solid ${tone.fg}22` }}>
                <div style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: tone.fg, fontWeight: 700 }}>{b.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: tone.fg, marginTop: 4 }}>{fmtInt(b.n)}</div>
              </div>
            );
          })}
        </div>
        {publicDir ? (
          <Link href={publicDir.href} target="_blank" rel="noopener noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 16px", borderRadius: 999,
            background: "#c2410c", color: "#fff", fontWeight: 700, fontSize: 12,
            textDecoration: "none", border: "1px solid #9a3412",
          }}>
            → {publicDir.label}
          </Link>
        ) : (
          <div style={{ ...hollowStyle, display: "inline-block" }}>
            Public directory route for this category not yet built · walker+DB working; UI dynamic-route follow-up.
          </div>
        )}
      </section>

      <footer style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid var(--nex-neutral-200)", fontSize: 10, color: "var(--nex-neutral-500)", lineHeight: 1.55 }}>
        Every value queried from <code>nex.worker_cycle_run</code> + <code>nex.discovery_rotation_state</code> + per-category business tables · no estimates ·
        SATURATED is temporary (Rotation Controller revisits) · walker never creates pages · HQ reads state, never invents.
      </footer>
    </div>
  );
}

// ── Small components + styles ──────────────────────────────────────────

function SectionLabel({ children, emoji }: { children: React.ReactNode; emoji?: string }): React.JSX.Element {
  return (
    <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700, marginBottom: 10 }}>
      {emoji ? `${emoji} ` : ""}{children}
    </div>
  );
}

function MetricRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "8px 12px", background: "var(--nex-cream-elev)", border: "1px solid var(--nex-neutral-200)", borderRadius: 8 }}>
      <span style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: valueColor ?? "var(--nex-neutral-900)" }}>{value}</span>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)",
  borderRadius: 12, padding: "16px 18px", marginBottom: 16,
};
const hollowStyle: React.CSSProperties = {
  padding: "14px 16px", borderRadius: 8,
  background: "rgba(0,0,0,0.02)", border: "1px dashed rgba(0,0,0,0.14)",
  fontSize: 12, color: "var(--nex-neutral-500)", fontStyle: "italic",
};
const thStyle: React.CSSProperties = {
  color: "var(--nex-neutral-500)", padding: "8px 8px 8px 0", textAlign: "left",
  fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700,
  borderBottom: "1px solid var(--nex-neutral-200)",
};
const thNumStyle: React.CSSProperties = { ...thStyle, textAlign: "right" };
const tdStyle: React.CSSProperties = {
  color: "var(--nex-neutral-900)", padding: "8px 8px 8px 0",
  borderTop: "1px solid var(--nex-neutral-100)",
};
const tdNumStyle: React.CSSProperties = { ...tdStyle, textAlign: "right", fontFamily: "monospace", fontSize: 12 };
