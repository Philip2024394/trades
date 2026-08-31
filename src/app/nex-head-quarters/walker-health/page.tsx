// src/app/nex-head-quarters/walker-health/page.tsx · Philip 2026-08-29
//
// HQ · Walker fleet health dashboard.
//
// The problem this pane solves: on 2026-08-28 the walker fleet died at 23:28
// and stayed dead for 5+ hours before anyone noticed. NEX had no surface
// that said "the fleet is offline." This pane is that surface.
//
// One-question pane: "Is the walker fleet alive right now?"
//
// Traffic-light rule (based on max heartbeat age across the fleet):
//   🟢 LIVE     · newest heartbeat is < 120s old  (fleet cycling normally)
//   🟡 STALE    · newest heartbeat is 120s - 600s (some workers slow, watch)
//   🔴 OFFLINE  · newest heartbeat is > 600s      (fleet is DOWN · restart required)
//
// Auto-refreshes every 15 seconds so the operator sees live state.
// Read-only. No fleet-control actions (yet) — just visibility.
//
// Doctrine anchor: Philip 2026-08-29 · "NEX knows its workers are dead only
// after somebody asks · that's not good enough for a production acquisition
// machine · you want HQ to say something like 🔴 WALKER FLEET OFFLINE …"

import pg from "pg";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const { Pool } = pg;
let pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.NEX_POSTGRES_URL ??
        "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
      max: 3,
    });
  }
  return pool;
}

type FleetHealth = "live" | "stale" | "offline";

interface WorkerRow {
  worker_id: string;
  age_sec: number;
  last_heartbeat_at: Date;
}

interface CycleActivity {
  worker_type: string;
  cycles_15m: number;
  new_records_15m: number;
  last_started_at: Date;
}

async function loadHealth() {
  const client = await getPool().connect();
  try {
    const { rows: allHeartbeats } = await client.query(
      `SELECT worker_id,
              EXTRACT(EPOCH FROM now() - last_heartbeat_at)::int AS age_sec,
              last_heartbeat_at
       FROM nex.worker_heartbeat
       ORDER BY last_heartbeat_at DESC NULLS LAST
       LIMIT 100`,
    );
    const workers: WorkerRow[] = allHeartbeats.map((r) => ({
      worker_id: r.worker_id,
      age_sec: Number(r.age_sec ?? 0),
      last_heartbeat_at: r.last_heartbeat_at,
    }));

    const totalWorkers = workers.length;
    const freshestAgeSec = workers.length ? workers[0].age_sec : Infinity;
    const oldestAgeSec = workers.length ? workers[workers.length - 1].age_sec : Infinity;
    const staleWorkers = workers.filter((w) => w.age_sec > 120).length;
    const offlineWorkers = workers.filter((w) => w.age_sec > 600).length;

    let health: FleetHealth = "live";
    if (freshestAgeSec > 600) health = "offline";
    else if (freshestAgeSec > 120) health = "stale";

    const { rows: cycles } = await client.query(
      `SELECT worker_type,
              COUNT(*)::int                       AS cycles_15m,
              SUM(COALESCE(records_new, 0))::int  AS new_records_15m,
              MAX(started_at)                     AS last_started_at
       FROM nex.worker_cycle_run
       WHERE started_at > now() - interval '15 minutes'
       GROUP BY worker_type
       ORDER BY cycles_15m DESC
       LIMIT 30`,
    );
    const cycleActivity: CycleActivity[] = cycles.map((r) => ({
      worker_type: r.worker_type,
      cycles_15m: Number(r.cycles_15m),
      new_records_15m: Number(r.new_records_15m ?? 0),
      last_started_at: r.last_started_at,
    }));

    return {
      health, totalWorkers, freshestAgeSec, oldestAgeSec,
      staleWorkers, offlineWorkers, workers, cycleActivity,
    };
  } finally {
    client.release();
  }
}

function fmtAge(sec: number): string {
  if (!Number.isFinite(sec)) return "never";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s ago`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m ago`;
}

function fmtWhen(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const TRAFFIC: Record<FleetHealth, { bg: string; border: string; ink: string; label: string; glyph: string; message: string }> = {
  live: {
    bg: "#f0fdf4", border: "#86efac", ink: "#166534",
    label: "WALKER FLEET LIVE",
    glyph: "🟢",
    message: "Fleet is cycling normally. Newest heartbeat well inside the 2-minute window.",
  },
  stale: {
    bg: "#fffbeb", border: "#fbbf24", ink: "#92400e",
    label: "WALKER FLEET STALE",
    glyph: "🟡",
    message: "Some workers have not reported in over 2 minutes. Not down, but worth watching. Check that HTTP-tick workers (brain / social) are receiving 200s from the dev server.",
  },
  offline: {
    bg: "#fef2f2", border: "#fca5a5", ink: "#991b1b",
    label: "WALKER FLEET OFFLINE",
    glyph: "🔴",
    message: "Fleet has been silent for 10+ minutes. Restart required. Run: NEX_DEV_WORKERS=1 npm run dev:workers (or wake the machine hosting the scheduler).",
  },
};

export default async function WalkerHealthPage() {
  const h = await loadHealth();
  const t = TRAFFIC[h.health];
  return (
    <>
      {/* Auto-refresh every 15 seconds so an operator watching this pane sees
          the fleet come back up (or go down) without manual reload. Cheap. */}
      <meta httpEquiv="refresh" content="15" />

      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{
          fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase",
          color: "#dc2626", fontWeight: 800, marginBottom: 4,
        }}>HQ · Walker fleet health</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.3, color: "#111827" }}>
          Is the walker fleet alive right now?
        </h1>
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6, marginBottom: 20 }}>
          Auto-refreshes every 15s · read-only · Philip 2026-08-29
        </p>

        {/* Traffic light banner · the single answer this pane exists for */}
        <div style={{
          padding: "20px 24px", borderRadius: 14,
          background: t.bg, border: `1px solid ${t.border}`,
          color: t.ink, marginBottom: 24,
        }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.6, marginBottom: 4 }}>
            {t.glyph} {t.label}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.9 }}>{t.message}</div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <MiniStat label="Freshest heartbeat" value={fmtAge(h.freshestAgeSec)} tone={t.ink} />
            <MiniStat label="Total workers tracked" value={h.totalWorkers.toString()} tone={t.ink} />
            <MiniStat label="Stale (>2m)" value={h.staleWorkers.toString()} tone={t.ink} />
            <MiniStat label="Offline (>10m)" value={h.offlineWorkers.toString()} tone={t.ink} />
          </div>
        </div>

        {/* Per-worker heartbeat table */}
        <SectionTitle>Heartbeats (newest 20)</SectionTitle>
        <TableCard>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <Th>Worker ID</Th>
                <Th align="right">Age</Th>
                <Th>Last heartbeat</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {h.workers.slice(0, 20).map((w) => {
                const tone =
                  w.age_sec > 600 ? { bg: "#fef2f2", ink: "#991b1b", label: "OFFLINE" } :
                  w.age_sec > 120 ? { bg: "#fffbeb", ink: "#92400e", label: "STALE" } :
                                    { bg: "#f0fdf4", ink: "#166534", label: "LIVE" };
                return (
                  <tr key={w.worker_id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <Td>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#111827" }}>
                        {w.worker_id}
                      </span>
                    </Td>
                    <Td align="right">
                      <span style={{ fontVariantNumeric: "tabular-nums", color: tone.ink, fontWeight: 700 }}>
                        {fmtAge(w.age_sec)}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ color: "#6b7280", fontSize: 12 }}>
                        {fmtWhen(w.last_heartbeat_at)}
                      </span>
                    </Td>
                    <Td>
                      <span style={{
                        padding: "3px 8px", borderRadius: 999,
                        background: tone.bg, color: tone.ink,
                        fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                      }}>{tone.label}</span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableCard>

        {/* Cycle productivity in the last 15 min */}
        <SectionTitle>Cycles in the last 15 minutes</SectionTitle>
        {h.cycleActivity.length === 0 ? (
          <TableCard>
            <div style={{ padding: "16px 20px", fontSize: 13, color: "#6b7280", textAlign: "center" }}>
              No cycles in the last 15 minutes. Either the fleet just restarted (wait a few ticks) or it&apos;s offline.
            </div>
          </TableCard>
        ) : (
          <TableCard>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <Th>Worker type</Th>
                  <Th align="right">Cycles</Th>
                  <Th align="right">New records</Th>
                  <Th>Last started</Th>
                </tr>
              </thead>
              <tbody>
                {h.cycleActivity.map((c) => (
                  <tr key={c.worker_type} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <Td><span style={{ color: "#111827", fontWeight: 500 }}>{c.worker_type}</span></Td>
                    <Td align="right"><Tabular>{c.cycles_15m}</Tabular></Td>
                    <Td align="right">
                      <Tabular color={c.new_records_15m > 0 ? "#166534" : "#6b7280"} weight={c.new_records_15m > 0 ? 700 : 400}>
                        {c.new_records_15m > 0 ? `+${c.new_records_15m}` : "0"}
                      </Tabular>
                    </Td>
                    <Td><span style={{ color: "#6b7280", fontSize: 12 }}>{fmtWhen(c.last_started_at)}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        )}

        {/* Operator quick-reference */}
        <SectionTitle>Restart command</SectionTitle>
        <TableCard>
          <div style={{ padding: "14px 18px" }}>
            <code style={{
              display: "block", padding: "10px 14px",
              background: "#0a0e18", color: "#f9fafb", borderRadius: 8,
              fontSize: 12, fontFamily: "monospace",
            }}>
              cd /path/to/trades && NEX_DEV_WORKERS=1 npm run dev:workers
            </code>
            <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
              Requires <code>NEX_DEV_WORKERS=1</code> and <code>NEX_ORCHESTRATOR_ENABLED=true</code> in <code>.env.local</code>.
              Dev server on :3008 must also be running (HTTP-tick workers hit it for brain / social ticks).
            </div>
          </div>
        </TableCard>

        <div style={{ marginTop: 24, fontSize: 10, color: "#9ca3af", textAlign: "center" }}>
          Data queried live from nex.worker_heartbeat and nex.worker_cycle_run.
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.7, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: tone, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase",
      color: "#6b7280", fontWeight: 800, marginTop: 24, marginBottom: 10,
    }}>{children}</div>
  );
}
function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e5e7eb",
      borderRadius: 12, overflow: "hidden",
    }}>{children}</div>
  );
}
function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      padding: "10px 14px", textAlign: align,
      fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase",
      fontWeight: 700, color: "#6b7280",
    }}>{children}</th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td style={{ padding: "10px 14px", verticalAlign: "top", textAlign: align, color: "#111827" }}>
      {children}
    </td>
  );
}
function Tabular({ children, color, weight }: { children: React.ReactNode; color?: string; weight?: number }) {
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", color, fontWeight: weight }}>
      {children}
    </span>
  );
}
