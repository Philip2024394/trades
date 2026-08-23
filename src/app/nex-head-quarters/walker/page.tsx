// NEX HQ · Walker · Live Monitor (Task #86 · 2026-08-22).
//
// Subordinate HQ page — one and only one operational/admin dashboard is
// /nex-head-quarters (see project_nex_dashboard_singularity_constitutional_rule_2026_08_22).
// This page reads existing Walker state (no new worker · no new admin UI).
//
// Doctrine (Philip 2026-08-22):
//   · METRIC A · green tick means Walker processed the business into NEX's
//     DISCOVERY DIRECTORY (row in nex.food_business · provenance stamped
//     with cycle_run_id · no errors during insert). Walker doing its job = 100%.
//   · METRIC B · directory visibility is a SEPARATE pipeline:
//         discovered → promotion/claim → listed / claimed / paying → /food page
//     Shown separately as a Universe card. NEVER confused with Walker success.
//
//   Live indicator = REAL heartbeat age. Never fake. If Walker is stopped,
//   the page says so honestly.
//
// Reads only from:
//   · nex.worker_heartbeat / nex.worker_cycle_run          (Walker liveness · cycle history)
//   · nex.food_business / nex.food_business_field_provenance (pipeline verification)
//   · data/nex-scheduler/walker-session.json               (session start time)
//   · data/nex-scheduler/walker-geo-cursor.json            (current + next zone)
//
// Does NOT modify:
//   · Walker code · scheduler · gates · dedup · provenance
//   · CLE · RAG · knowledge_records
//   · /food directory reader · claim_status promotion gate
//   · Any other HQ page

import { existsSync, readFileSync } from "node:fs";
import Link from "next/link";
import { getFoodDbPool } from "@/lib/nex-food/db";
import WalkerLiveIndicator, { type WalkerLiveState } from "./WalkerLiveIndicator";
import WalkerAutoRefresh from "./WalkerAutoRefresh";
import "../../nex-app/nex-app.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ── Rotation zones · mirror scripts/nex-dev-scheduler.mjs bboxRotation ─
// Keep in sync manually · adding a zone here means editing the scheduler too.
const WALKER_ZONES = ["prambanan", "sleman-north", "bantul-south", "klaten-east", "gamping-west"];
const WALKER_CADENCE_S = 900;

// ── Types ─────────────────────────────────────────────────────────────

interface HeartbeatRow {
  worker_id: string;
  last_heartbeat_at: string | Date;
  last_status: string;
  worker_config: string | null;
  age_seconds: number | null;
}

interface CycleRow {
  id: string;
  worker_config: string;
  started_at: string | Date;
  finished_at: string | Date | null;
  status: string;
  records_processed: number | null;
  records_new: number | null;
  errors_count: number;
  duration_s: number | null;
  provenance_rows: number | null;
}

interface PrimaryCatRow      { category: string; count: number }
interface SecondaryTokenRow  { token: string; count: number }
interface ZoneAggRow         { zone: string; cycle_count: number; total_processed: number; total_new: number; last_run: string | null }
interface VisibilityRow      { total: number; visible: number; discovered: number }
interface SessionFileShape   { sessionStartedAt: string; pid: number }
interface CursorFileShape    { cursor: number; lastZone: string | null; lastAdvancedAt: string | null }

// ── File helpers ──────────────────────────────────────────────────────

function readJsonSafe<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch { return null; }
}

// ── Data load · one SQL round-trip fan-out ────────────────────────────

async function loadData() {
  const pool = getFoodDbPool();

  const session = readJsonSafe<SessionFileShape>("data/nex-scheduler/walker-session.json");
  const cursor  = readJsonSafe<CursorFileShape>("data/nex-scheduler/walker-geo-cursor.json");
  const sessionStartedAt = session?.sessionStartedAt ?? null;

  const [heartbeat, sinceSession, recent, universe, primaryCats, secondaryTokens, zoneAgg, latestCycle] = await Promise.all([
    pool.query<HeartbeatRow>(`
      SELECT worker_id, last_heartbeat_at, last_status, worker_config,
             EXTRACT(EPOCH FROM (now() - last_heartbeat_at))::int AS age_seconds
      FROM nex.worker_heartbeat
      WHERE worker_type = 'acquisition'
      ORDER BY last_heartbeat_at DESC
      LIMIT 1
    `),
    sessionStartedAt
      ? pool.query<{ cycles: number; processed: number; new_count: number; errors: number }>(
          `SELECT COUNT(*)::int AS cycles,
                  COALESCE(SUM(records_processed),0)::int AS processed,
                  COALESCE(SUM(records_new),0)::int AS new_count,
                  COALESCE(SUM(errors_count),0)::int AS errors
             FROM nex.worker_cycle_run
            WHERE worker_type='acquisition' AND started_at >= $1::timestamptz`,
          [sessionStartedAt],
        )
      : Promise.resolve({ rows: [{ cycles: 0, processed: 0, new_count: 0, errors: 0 }] } as { rows: Array<{ cycles: number; processed: number; new_count: number; errors: number }> }),
    pool.query<CycleRow>(`
      SELECT cr.id, cr.worker_config, cr.started_at, cr.finished_at, cr.status,
             cr.records_processed, cr.records_new, cr.errors_count,
             EXTRACT(EPOCH FROM (cr.finished_at - cr.started_at))::int AS duration_s,
             (SELECT COUNT(*)::int FROM nex.food_business_field_provenance p WHERE p.cycle_run_id = cr.id) AS provenance_rows
        FROM nex.worker_cycle_run cr
       WHERE cr.worker_type='acquisition'
       ORDER BY cr.started_at DESC
       LIMIT 20
    `),
    pool.query<VisibilityRow>(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE claim_status IN ('listed','invited','claimed','paying'))::int AS visible,
             COUNT(*) FILTER (WHERE claim_status='discovered')::int AS discovered
        FROM nex.food_business
    `),
    pool.query<PrimaryCatRow>(`
      SELECT category, COUNT(*)::int AS count
        FROM nex.food_business
       GROUP BY category
       ORDER BY 2 DESC
    `),
    pool.query<SecondaryTokenRow>(`
      SELECT unnest(categories) AS token, COUNT(*)::int AS count
        FROM nex.food_business
       WHERE array_length(categories,1) > 0
       GROUP BY 1
       ORDER BY 2 DESC
       LIMIT 25
    `),
    pool.query<ZoneAggRow>(`
      SELECT worker_config AS zone,
             COUNT(*)::int AS cycle_count,
             COALESCE(SUM(records_processed),0)::int AS total_processed,
             COALESCE(SUM(records_new),0)::int AS total_new,
             MAX(started_at)::text AS last_run
        FROM nex.worker_cycle_run
       WHERE worker_type='acquisition' AND worker_config LIKE 'food:Yogyakarta:%'
       GROUP BY worker_config
       ORDER BY MAX(started_at) DESC NULLS LAST
    `),
    pool.query<{ started_at: string | Date; worker_config: string }>(`
      SELECT started_at, worker_config
        FROM nex.worker_cycle_run
       WHERE worker_type='acquisition'
       ORDER BY started_at DESC
       LIMIT 1
    `),
  ]);

  return {
    session: sessionStartedAt,
    cursor,
    heartbeat: heartbeat.rows[0] ?? null,
    sinceSession: sinceSession.rows[0],
    recent: recent.rows,
    universe: universe.rows[0],
    primaryCats: primaryCats.rows,
    secondaryTokens: secondaryTokens.rows,
    zoneAgg: zoneAgg.rows,
    latestCycle: latestCycle.rows[0] ?? null,
  };
}

// ── Formatters ────────────────────────────────────────────────────────

function fmtInt(n: number): string { return n.toLocaleString("en-GB"); }
function fmtIso(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-GB", { hour12: false });
}
function fmtDuration(s: number | null): string {
  if (s == null || Number.isNaN(s)) return "—";
  if (s < 60)     return `${s}s`;
  if (s < 3600)   return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}
function shortZone(worker_config: string | null | undefined): string {
  if (!worker_config) return "—";
  const parts = worker_config.split(":");
  return parts[parts.length - 1] ?? worker_config;
}
function nextZone(currentCursor: number | undefined): string {
  const idx = ((currentCursor ?? 0) % WALKER_ZONES.length + WALKER_ZONES.length) % WALKER_ZONES.length;
  return WALKER_ZONES[idx] ?? "?";
}

// ── Page ──────────────────────────────────────────────────────────────

export default async function WalkerMonitorPage() {
  const d = await loadData();

  const walkerAge = d.heartbeat?.age_seconds ?? null;
  const liveState: WalkerLiveState = {
    ageSeconds: walkerAge,
    lastHeartbeatAt: d.heartbeat?.last_heartbeat_at
      ? (typeof d.heartbeat.last_heartbeat_at === "string" ? d.heartbeat.last_heartbeat_at : d.heartbeat.last_heartbeat_at.toISOString())
      : null,
    lastStatus: d.heartbeat?.last_status ?? null,
    currentZone: shortZone(d.latestCycle?.worker_config),
  };

  const sessionAgeSec = d.session ? Math.max(0, Math.round((Date.now() - new Date(d.session).getTime()) / 1000)) : null;
  const lastCycleStartMs = d.latestCycle ? new Date(d.latestCycle.started_at).getTime() : null;
  const nextRunMs = lastCycleStartMs ? lastCycleStartMs + WALKER_CADENCE_S * 1000 : null;
  const secondsUntilNextRun = nextRunMs ? Math.max(0, Math.round((nextRunMs - Date.now()) / 1000)) : null;
  const nextRunEta = nextRunMs ? new Date(nextRunMs).toLocaleString("en-GB", { hour12: false }) : "—";
  const nextZoneName = nextZone(d.cursor?.cursor);

  const pipelineErrors = d.sinceSession?.errors ?? 0;
  const pipelineTotal = d.sinceSession?.processed ?? 0;
  const pipelineSuccessPct = pipelineTotal > 0
    ? Math.max(0, Math.min(100, Math.round(((pipelineTotal - pipelineErrors) / pipelineTotal) * 100)))
    : 100;

  return (
    <div className="nex-app-root" style={rootStyle}>
      <WalkerAutoRefresh />

      {/* ── Header ── */}
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={eyebrowStyle}>NEX HQ · WALKER · LIVE MONITOR</div>
            <h1 style={h1Style}>Walker · Yogyakarta Food Discovery</h1>
            <div style={subEyebrowStyle}>
              Discovery pipeline verification · every status derived from live database evidence ·
              green tick means Walker processed the business into the discovery directory · never conflated with public promotion.
            </div>
          </div>
          <WalkerLiveIndicator state={liveState} />
        </div>
      </header>

      {/* ── Session cards ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Session · this Victus power-on</div>
        <div style={cardsGridStyle}>
          <Card label="Session started" value={d.session ? fmtIso(d.session) : "—"} sub={sessionAgeSec != null ? `uptime ${fmtDuration(sessionAgeSec)}` : "no session file · start the scheduler"} />
          <Card label="Cycles this session"        value={fmtInt(d.sinceSession.cycles)}    sub="acquisition cycles since session start" />
          <Card label="Processed this session"     value={fmtInt(d.sinceSession.processed)} sub="records examined this session" />
          <Card label="New this session"           value={fmtInt(d.sinceSession.new_count)} sub="genuinely new discoveries" tone={d.sinceSession.new_count > 0 ? "success" : "neutral"} />
          <Card label="Errors this session"        value={fmtInt(d.sinceSession.errors)}    sub="cycle-level errors" tone={d.sinceSession.errors > 0 ? "warning" : "success"} />
          <Card label="Current zone"               value={liveState.currentZone ?? "—"}    sub={d.latestCycle ? `cycle ended ${fmtIso(d.latestCycle?.started_at)}` : "no cycle recorded"} />
          <Card label="Next zone"                  value={nextZoneName}                    sub={secondsUntilNextRun != null ? `ETA in ${fmtDuration(secondsUntilNextRun)} (${nextRunEta})` : "—"} />
          <Card label="Rotation cursor"            value={String(d.cursor?.cursor ?? 0)}   sub={`of ${WALKER_ZONES.length} zones · deterministic`} />
        </div>
      </section>

      {/* ── Pipeline verification · Metric A vs Metric B ── */}
      {/* Copy revised Philip 2026-08-22: 100% must describe the successful   */}
      {/* processing rate, and session errors must be surfaced separately so  */}
      {/* the 100% never visually implies zero errors.                        */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Pipeline verification · discovery vs public promotion</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...bigCardStyle, border: `1px solid rgba(16,185,129,0.35)`, background: "rgba(16,185,129,0.06)" }}>
            <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#047857", fontWeight: 700 }}>🟢 Walker discovery pipeline</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "#047857", marginTop: 6 }}>{pipelineSuccessPct}%</div>
            <div style={{ fontSize: 12, color: "var(--nex-neutral-700)", marginTop: 6, lineHeight: 1.5 }}>
              {pipelineSuccessPct}% of successfully processed records completed the discovery pipeline
              (Collected → Processed → <code>nex.food_business</code> → Provenance stamped with <code>cycle_run_id</code>).
              <br /><strong>{fmtInt(d.universe?.discovered ?? 0)}</strong> businesses currently in the discovery directory.
            </div>
            {pipelineErrors > 0 && (
              <div style={sessionErrorCalloutStyle}>
                <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 800, color: "#b45309" }}>
                  ⚠️ Session errors: {fmtInt(pipelineErrors)}
                </div>
                <div style={{ fontSize: 12, color: "var(--nex-neutral-700)", marginTop: 4 }}>
                  {fmtInt(pipelineTotal)} processed · <strong>{fmtInt(d.sinceSession.new_count)} new</strong> ·{" "}
                  <strong>{fmtInt(pipelineErrors)} failed cycle{pipelineErrors === 1 ? "" : "s"}</strong>
                  <br />See the Cycle history table for the specific row · investigate the zone before the next rotation.
                </div>
              </div>
            )}
          </div>
          <div style={{ ...bigCardStyle, border: `1px solid rgba(245,158,11,0.45)`, background: "rgba(245,158,11,0.06)" }}>
            <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#a16207", fontWeight: 700 }}>🟡 Public directory promotion</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "#a16207", marginTop: 6 }}>
              {fmtInt(d.universe?.visible ?? 0)} <span style={{ fontSize: 18, fontWeight: 500 }}>/ {fmtInt(d.universe?.total ?? 0)}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--nex-neutral-700)", marginTop: 6, lineHeight: 1.5 }}>
              <strong>{fmtInt(d.universe?.discovered ?? 0)}</strong> discovered · awaiting owner claim or admin promotion to <code>listed / invited / claimed / paying</code>.
              <br />Promotion is a <strong>separate pipeline</strong> · Walker cannot promote · admin/owner gate never bypassed.
              <br />Walker looks perfectly healthy even when this is zero — that is the correct architecture.
            </div>
          </div>
        </div>
      </section>

      {/* ── Recent cycles table ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Cycle history · last 20 · every one a real cycle_run row</div>
        <div style={panelStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Time (started)</th>
                <th style={thStyle}>Zone</th>
                <th style={thNumStyle}>Processed</th>
                <th style={thNumStyle}>New</th>
                <th style={thNumStyle}>Provenance</th>
                <th style={thNumStyle}>Duration</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.recent.length === 0 ? (
                <tr><td style={{ ...tdStyle, textAlign: "center", color: "var(--nex-neutral-500)", padding: 24 }} colSpan={7}>No cycles yet · start the scheduler with NEX_DEV_WORKERS=1 npm run dev:workers</td></tr>
              ) : d.recent.map((c) => {
                const isError = c.errors_count > 0 || c.status === "failed";
                return (
                  <tr key={c.id}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{fmtIso(c.started_at)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{shortZone(c.worker_config)}</td>
                    <td style={tdNumStyle}>{fmtInt(c.records_processed ?? 0)}</td>
                    <td style={{ ...tdNumStyle, color: (c.records_new ?? 0) > 0 ? "#047857" : "var(--nex-neutral-500)", fontWeight: 700 }}>
                      {fmtInt(c.records_new ?? 0)}
                    </td>
                    <td style={tdNumStyle}>{fmtInt(c.provenance_rows ?? 0)}</td>
                    <td style={tdNumStyle}>{fmtDuration(c.duration_s)}</td>
                    <td style={tdStyle}>
                      {isError
                        ? <span style={{ color: "#b91c1c", fontWeight: 700 }}>✕ {c.status}{c.errors_count > 0 ? ` · ${c.errors_count} err` : ""}</span>
                        : <span style={{ color: "#047857", fontWeight: 700 }}>✓ {c.status}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Geographic breakdown ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Geographic coverage · per zone · lifetime</div>
        <div style={panelStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Zone</th>
                <th style={thNumStyle}>Cycles</th>
                <th style={thNumStyle}>Total processed</th>
                <th style={thNumStyle}>Total new</th>
                <th style={thStyle}>Last run</th>
              </tr>
            </thead>
            <tbody>
              {d.zoneAgg.map((z) => (
                <tr key={z.zone}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{shortZone(z.zone)}</td>
                  <td style={tdNumStyle}>{fmtInt(z.cycle_count)}</td>
                  <td style={tdNumStyle}>{fmtInt(z.total_processed)}</td>
                  <td style={{ ...tdNumStyle, color: z.total_new > 0 ? "#047857" : "var(--nex-neutral-500)", fontWeight: 700 }}>{fmtInt(z.total_new)}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{fmtIso(z.last_run)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Category totals · primary + secondary ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Category coverage · what Walker has discovered</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={panelStyle}>
            <div style={miniHeaderStyle}>Primary category · 4-value enum (existing CHECK)</div>
            <table style={tableStyle}>
              <tbody>
                {d.primaryCats.map((r) => (
                  <tr key={r.category}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.category}</td>
                    <td style={tdNumStyle}>{fmtInt(r.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={panelStyle}>
            <div style={miniHeaderStyle}>Secondary tokens · NEX-approved ontology · Task #85 widened</div>
            {d.secondaryTokens.length === 0
              ? <div style={{ padding: 12, color: "var(--nex-neutral-500)", fontSize: 12 }}>No secondary tokens yet · appears when Walker runs cycles under Task #85 code.</div>
              : (
                <table style={tableStyle}>
                  <tbody>
                    {d.secondaryTokens.map((r) => (
                      <tr key={r.token}>
                        <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{r.token}</td>
                        <td style={tdNumStyle}>{fmtInt(r.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      </section>

      {/* ── Footer · doctrine anchors ── */}
      <footer style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--nex-neutral-200)", fontSize: 10, color: "var(--nex-neutral-500)", lineHeight: 1.6 }}>
        <div>Every row above derived from live nex.worker_heartbeat / nex.worker_cycle_run / nex.food_business queries · zero LLM · zero fabrication.</div>
        <div>Walker doctrine: <Link href="/nex-head-quarters" style={{ color: "#c2410c" }}>Reception</Link> · Workers is the six-criteria drill-down · this page is Walker-specific discovery-pipeline verification · not a competing dashboard.</div>
        <div>Runs local while Victus is powered on · when the machine sleeps Walker stops and this page shows OFFLINE honestly · cloud 24/7 migration deferred to a separate future task.</div>
      </footer>
    </div>
  );
}

// ── Small Card component (server-safe · no state) ─────────────────────

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "neutral" }) {
  const toneColor =
    tone === "success" ? "#047857" :
    tone === "warning" ? "#a16207" :
                          "var(--nex-neutral-900)";
  return (
    <div style={miniCardStyle}>
      <div style={miniCardLabelStyle}>{label}</div>
      <div style={{ ...miniCardValueStyle, color: toneColor }}>{value}</div>
      {sub && <div style={miniCardSubStyle}>{sub}</div>}
    </div>
  );
}

// ── Styles · cream theme · matches Workers / Reception ─────────────────

const rootStyle: React.CSSProperties = { padding: "24px 32px", background: "var(--nex-cream)", minHeight: "100vh", color: "var(--nex-neutral-900)" };
const headerStyle: React.CSSProperties = { marginBottom: 24 };
const eyebrowStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700 };
const subEyebrowStyle: React.CSSProperties = { fontSize: 12, color: "var(--nex-neutral-500)", marginTop: 6, lineHeight: 1.55 };
const h1Style: React.CSSProperties = { fontSize: 26, fontWeight: 800, margin: "6px 0 4px 0" };
const sectionStyle: React.CSSProperties = { marginTop: 22 };
const sectionLabelStyle: React.CSSProperties = { fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700, marginBottom: 8 };
const cardsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 };
const miniCardStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 10, padding: "12px 14px" };
const miniCardLabelStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700 };
const miniCardValueStyle: React.CSSProperties = { fontSize: 22, fontWeight: 800, marginTop: 4 };
const miniCardSubStyle: React.CSSProperties = { fontSize: 11, color: "var(--nex-neutral-500)", marginTop: 4, lineHeight: 1.35 };
const bigCardStyle: React.CSSProperties = { borderRadius: 12, padding: "18px 20px" };
const sessionErrorCalloutStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  border: "1px solid rgba(245,158,11,0.55)",
  background: "rgba(245,158,11,0.10)",
  borderRadius: 8,
};
const panelStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 12, padding: "12px 16px", overflowX: "auto" };
const miniHeaderStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--nex-neutral-700)", padding: "4px 4px 10px 4px", borderBottom: "1px solid var(--nex-neutral-200)", marginBottom: 4 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle: React.CSSProperties = { color: "var(--nex-neutral-500)", padding: "8px 8px 8px 0", textAlign: "left", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid var(--nex-neutral-200)" };
const thNumStyle: React.CSSProperties = { ...thStyle, textAlign: "right" };
const tdStyle: React.CSSProperties = { color: "var(--nex-neutral-900)", padding: "8px 8px 8px 0", verticalAlign: "top", borderTop: "1px solid var(--nex-neutral-100)" };
const tdNumStyle: React.CSSProperties = { ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" };
