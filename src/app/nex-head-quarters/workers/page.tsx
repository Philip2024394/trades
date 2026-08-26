// NEX HQ · Workers · Reliability
//
// /nex-head-quarters/workers · the ONE canonical worker view (Task #72 Step 2).
// Consolidated from earlier dark-theme /admin/(authed)/nex/food-hq · translated
// to cream tokens per project_nex_product_architecture_4_roles_6_subsystems
// (NEX HQ = Subsystem 6 · single admin surface).
//
// Task #72 Step 3 (2026-08-22): added six-criteria GREEN definition per
// Philip's constitutional rule. A worker may display 🟢 GREEN only when
// ALL SIX are DB-verifiable: input · consumed · output · state advanced ·
// heartbeat current · DB-provable. Heartbeat freshness ALONE is never GREEN.
// The legacy `nex.worker_health_status` view (HEALTHY/WARNING/CRITICAL/
// MISSED_RUN/UNKNOWN) is DEPRECATED as a source of truth · retained only
// as a supplementary panel for the reliability layer's own health,
// clearly marked as "legacy · pre-Step-3".
//
// Reads from:
//   · nex.worker_heartbeat + nex.worker_cycle_run + nex.worker_schedule
//     (via evaluateWorker for the six-criteria table)
//   · nex.worker_health_status (legacy tile · deprecated · marked as such)
//   · nex.worker_24h_activity
//   · nex.worker_missed_runs_24h (Task #57 · pre-24/7 gate)

import { getFoodDbPool } from "@/lib/nex-food/db";
import { evaluateWorker, listAllWorkers } from "@/lib/nex/hq/evaluate-worker";
import type { WorkerEvaluation } from "@/lib/nex/hq/worker-criteria";
import SixCriteriaTable from "./SixCriteriaTable";
import "../../nex-app/nex-app.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface HealthRow {
  worker_id: string;
  worker_type: string;
  worker_config: string | null;
  health: string;
  seconds_since_heartbeat: number | null;
  last_cycle_status: string | null;
  last_cycle_records_new: number | null;
  recent_failures_24h: number;
  recent_missed_runs_24h: number;
}
interface ActivityRow {
  worker_id: string;
  worker_type: string;
  worker_config: string | null;
  cycles_run: number | string;
  cycles_completed: number | string;
  cycles_failed: number | string;
  total_records_new: number | string;
  total_errors: number | string;
}
interface MissedRow {
  worker_id: string;
  worker_type: string;
  expected_at: Date;
  missed_by_seconds: number;
  grace_window_sec: number;
}
interface ScheduleRow {
  worker_id: string;
  worker_type: string;
  worker_config: string | null;
  interval_seconds: number;
  grace_window_sec: number;
  enabled: boolean;
  schedule_started_at: Date;
}
// Phase 1 rejection telemetry (2026-08-25) · latest completed cycle per worker.
interface LatestCycleRow {
  worker_id: string;
  worker_config: string | null;
  records_processed: number | null;
  records_new: number | null;
  records_rejected: number | null;
  rejected_by_reason: Record<string, number> | null;
  cycle_outcome: string | null;
  finished_at: Date;
}

async function loadData() {
  const pool = getFoodDbPool();
  const [health, activity, missed, schedules, workerRefs, latest] = await Promise.all([
    pool.query<HealthRow>(`SELECT * FROM nex.worker_health_status ORDER BY worker_type, worker_id`),
    pool.query<ActivityRow>(`SELECT * FROM nex.worker_24h_activity`),
    pool.query<MissedRow>(`SELECT * FROM nex.worker_missed_runs_24h LIMIT 100`),
    pool.query<ScheduleRow>(`SELECT * FROM nex.worker_schedule ORDER BY worker_id`),
    listAllWorkers(pool),
    // Phase 1 rejection telemetry (2026-08-25) · latest completed cycle per worker.
    // Reads summary.rejected_by_reason + summary.cycle_outcome written by each walker.
    pool.query<LatestCycleRow>(`
      SELECT DISTINCT ON (worker_id)
        worker_id,
        worker_config,
        records_processed,
        records_new,
        records_rejected,
        summary->'rejected_by_reason'         AS rejected_by_reason,
        summary->>'cycle_outcome'             AS cycle_outcome,
        finished_at
      FROM nex.worker_cycle_run
      WHERE finished_at IS NOT NULL
      ORDER BY worker_id, finished_at DESC
    `),
  ]);
  // Six-criteria evaluations (Task #72 Step 3) · run in parallel.
  const evaluations: WorkerEvaluation[] = await Promise.all(
    workerRefs.map((w) => evaluateWorker(pool, w))
  );
  const verdictCounts: Record<string, number> = {
    GREEN: 0, PARTIAL: 0, FAILED: 0, STUCK: 0, NOT_RUNNING: 0, BLOCKED: 0, UNKNOWN: 0,
  };
  for (const e of evaluations) verdictCounts[e.verdict] = (verdictCounts[e.verdict] ?? 0) + 1;
  const counts = { HEALTHY: 0, WARNING: 0, CRITICAL: 0, UNKNOWN: 0, MISSED_RUN: 0 };
  for (const h of health.rows) counts[h.health as keyof typeof counts] = (counts[h.health as keyof typeof counts] ?? 0) + 1;
  return {
    health: health.rows,
    activity: activity.rows,
    missed: missed.rows,
    schedules: schedules.rows,
    counts,
    evaluations,
    verdictCounts,
    latest: latest.rows,
  };
}

// Phase 1 rejection telemetry (2026-08-25) · style tokens for the histogram row.
const rejectionReasonPalette: Record<string, string> = {
  CONTACT_MISSING:  "#b45309", // amber-700
  INELIGIBLE:       "#7c2d12", // orange-900
  MALFORMED:        "#991b1b", // red-800
  GEO_MISS:         "#3730a3", // indigo-800
  CATEGORY_MISS:    "#6d28d9", // violet-700
  MATCHED_EXISTING: "#374151", // gray-700 (informational, not a rejection)
  OTHER:            "#0f766e", // teal-700
};
const cycleOutcomePalette: Record<string, string> = {
  PROVIDER_EMPTY:    "#4b5563",
  PROVIDER_ERROR:    "#b91c1c",
  ALL_DEDUPED:       "#6b7280",
  ALL_REJECTED:      "#b45309",
  PARTIAL:           "#0369a1",
  PRODUCTIVE:        "#15803d",
  NO_NEW_CANDIDATES: "#78716c",
};

export default async function WorkersPage() {
  const d = await loadData();
  const activityById = new Map(d.activity.map(a => [a.worker_id, a]));

  return (
    <div style={pageStyle}>
      <div style={titleBlockStyle}>
        <div style={eyebrowStyle}>NEX HQ · WORKFORCE · RELIABILITY</div>
        <h1 style={h1Style}>Workers</h1>
        <div style={subtitleStyle}>
          Heartbeat · cycle history · missed-run detection · deterministic health
          derived from DB evidence · never LLM inference (per reliability doctrine).
        </div>
      </div>

      {/* Missed runs alert · leads if > 0 · per Task #57 constitutional gate */}
      {d.missed.length > 0 && (
        <div style={alertBannerStyle}>
          <strong style={{ color: "var(--nex-danger-600, #dc2626)" }}>⚠ {d.missed.length} MISSED RUN{d.missed.length === 1 ? "" : "S"} in last 24h.</strong>
          {" "}A scheduled worker did not complete a cycle within its grace window.
          Investigate below before turning acquisition scheduler on 24/7.
        </div>
      )}

      {/* Six-criteria verdict tiles · Task #72 Step 3 (2026-08-22) */}
      <div style={sectionLabelStyle}>Six-Criteria Verdict · GREEN requires all six DB-provable</div>
      <div style={verdictTilesRowStyle}>
        {(["GREEN","PARTIAL","FAILED","STUCK","NOT_RUNNING","BLOCKED","UNKNOWN"] as const).map((v) => (
          <div key={v} style={verdictTileStyle(v)}>
            <div style={tileCountStyle}>{d.verdictCounts[v] ?? 0}</div>
            <div style={tileLabelStyle}>{v.replace("_", " ").toLowerCase()}</div>
          </div>
        ))}
      </div>
      <div style={verdictHintStyle}>
        Heartbeat freshness alone is NEVER GREEN. A worker must have real input, consume it, produce output, advance the source state,
        maintain a fresh heartbeat, and every criterion must be backed by real SQL. Click any worker row below to see the evidence for each criterion.
      </div>

      {/* Six-criteria per-worker evidence table · Task #72 Step 3 */}
      <div style={sectionLabelStyle}>Workers · six-criteria evidence · click a row to expand</div>
      <SixCriteriaTable workers={d.evaluations} />

      {/* Phase 1 · Rejection Telemetry · per-reason histogram from the latest
          completed cycle. Reads summary.rejected_by_reason + summary.cycle_outcome
          written by every walker (food · accommodation · market · transport).
          Policy unchanged — this is instrumentation only, evidence before loosening. */}
      <div style={sectionLabelStyle}>Rejection reasons · latest cycle per worker · Phase 1 telemetry (2026-08-25)</div>
      {d.latest.length === 0 ? (
        <div style={mutedCardStyle}>
          No completed cycles with rejection telemetry yet. Trigger a walker cycle to populate.
        </div>
      ) : (
        <div style={panelStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Worker · Config</th>
                <th style={thStyle}>Cycle Outcome</th>
                <th style={tdNumStyle}>Processed</th>
                <th style={tdNumStyle}>New</th>
                <th style={tdNumStyle}>Rejected</th>
                <th style={thStyle}>Reason breakdown (latest cycle)</th>
              </tr>
            </thead>
            <tbody>
              {d.latest.map((row) => {
                const reasons = row.rejected_by_reason ?? {};
                const reasonKeys = Object.keys(reasons).sort();
                return (
                  <tr key={row.worker_id + (row.worker_config ?? "")}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>
                      {row.worker_id}{row.worker_config ? ` · ${row.worker_config}` : ""}
                    </td>
                    <td style={tdStyle}>
                      {row.cycle_outcome ? (
                        <span style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#fff",
                          background: cycleOutcomePalette[row.cycle_outcome] ?? "#4b5563",
                        }}>{row.cycle_outcome.replace(/_/g, " ").toLowerCase()}</span>
                      ) : <span style={{ opacity: 0.5 }}>—</span>}
                    </td>
                    <td style={tdNumStyle}>{row.records_processed ?? 0}</td>
                    <td style={tdNumStyle}>{row.records_new ?? 0}</td>
                    <td style={tdNumStyle}>{row.records_rejected ?? 0}</td>
                    <td style={tdStyle}>
                      {reasonKeys.length === 0 ? (
                        <span style={{ opacity: 0.5 }}>none</span>
                      ) : (
                        <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {reasonKeys.map((k) => (
                            <span key={k} style={{
                              display: "inline-block",
                              padding: "1px 6px",
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#fff",
                              background: rejectionReasonPalette[k] ?? "#6b7280",
                            }}>{k.toLowerCase()} {reasons[k]}</span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legacy health tiles · DEPRECATED as source of truth · retained
          only as reliability-layer self-report per Step 3 doctrine. */}
      <div style={sectionLabelStyle}>Legacy health status · pre-Step-3 · deprecated · reference only</div>
      <div style={legacyNoticeStyle}>
        The HEALTHY/WARNING/CRITICAL/MISSED_RUN/UNKNOWN labels below come from
        <code style={inlineCodeStyle}>nex.worker_health_status</code> which is heartbeat-freshness-plus-failure-count only ·
        <strong> NOT the six-criteria verdict</strong>. Kept during migration for reference. Do not use for operational decisions.
      </div>
      <div style={tilesRowStyle}>
        {(["HEALTHY","WARNING","CRITICAL","MISSED_RUN","UNKNOWN"] as const).map((state) => (
          <div key={state} style={healthTileStyle(state)}>
            <div style={tileCountStyle}>{d.counts[state] ?? 0}</div>
            <div style={tileLabelStyle}>{state.replace("_", " ").toLowerCase()}</div>
          </div>
        ))}
      </div>

      {/* Legacy per-worker table · pre-Step-3 · retained for reference */}
      <div style={sectionLabelStyle}>Legacy per-worker · pre-Step-3 · retained for reference</div>
      {d.health.length === 0 ? (
        <div style={mutedCardStyle}>
          No workers monitored yet. Workers register in this table after their first heartbeat.
          Run one worker cycle to populate.
        </div>
      ) : (
        <div style={panelStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Worker</th>
                <th style={thStyle}>Type / Config</th>
                <th style={thStyle}>Health</th>
                <th style={thStyle}>Heartbeat</th>
                <th style={thStyle}>Last Cycle</th>
                <th style={thStyle}>24h Cycles</th>
                <th style={thStyle}>24h New</th>
                <th style={thStyle}>Fail 24h</th>
                <th style={thStyle}>Missed 24h</th>
              </tr>
            </thead>
            <tbody>
              {d.health.map((w) => {
                const act = activityById.get(w.worker_id);
                const hbAge = w.seconds_since_heartbeat != null ? formatDuration(w.seconds_since_heartbeat) : "never";
                return (
                  <tr key={w.worker_id}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{w.worker_id}</td>
                    <td style={tdStyle}>{w.worker_type}{w.worker_config ? ` · ${w.worker_config}` : ""}</td>
                    <td><span style={healthBadgeStyle(w.health)}>{w.health.replace("_", " ")}</span></td>
                    <td style={tdStyle}>{hbAge}</td>
                    <td style={tdStyle}>{w.last_cycle_status ?? "—"}</td>
                    <td style={tdNumStyle}>{act ? Number(act.cycles_run) : 0}</td>
                    <td style={tdNumStyle}>{act ? Number(act.total_records_new) : 0}</td>
                    <td style={tdNumStyle}>{w.recent_failures_24h}</td>
                    <td style={tdNumStyle}>{w.recent_missed_runs_24h}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Missed runs detail (only if > 0) */}
      {d.missed.length > 0 && (
        <>
          <div style={sectionLabelStyle}>Missed runs · last 24h</div>
          <div style={panelStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Worker</th>
                  <th style={thStyle}>Expected at</th>
                  <th style={thStyle}>Missed by</th>
                  <th style={thStyle}>Grace window</th>
                </tr>
              </thead>
              <tbody>
                {d.missed.map((m, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{m.worker_id}</td>
                    <td style={tdStyle}>{new Date(m.expected_at).toLocaleString("en-GB")}</td>
                    <td style={tdStyle}>{formatDuration(m.missed_by_seconds)}</td>
                    <td style={tdStyle}>{formatDuration(m.grace_window_sec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Schedules · what NEX expects */}
      <div style={sectionLabelStyle}>Schedule · what NEX expects</div>
      {d.schedules.length === 0 ? (
        <div style={mutedCardStyle}>
          No schedules registered yet. Missed-run detection cannot escalate for
          unscheduled workers. Register a schedule via SQL:
          <pre style={codeStyle}>
{`INSERT INTO nex.worker_schedule
  (worker_id, worker_type, worker_config, interval_seconds, grace_window_sec, notes)
VALUES
  ('acquisition:food:Yogyakarta', 'acquisition', 'food:Yogyakarta',
   3600, 300, 'Walker hourly · 5min grace');`}
          </pre>
        </div>
      ) : (
        <div style={panelStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Worker</th>
                <th style={thStyle}>Interval</th>
                <th style={thStyle}>Grace</th>
                <th style={thStyle}>Enabled</th>
                <th style={thStyle}>Started</th>
              </tr>
            </thead>
            <tbody>
              {d.schedules.map((s) => (
                <tr key={s.worker_id}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{s.worker_id}</td>
                  <td style={tdStyle}>{formatDuration(s.interval_seconds)}</td>
                  <td style={tdStyle}>{formatDuration(s.grace_window_sec)}</td>
                  <td style={tdStyle}>{s.enabled ? "yes" : "no"}</td>
                  <td style={tdStyle}>{new Date(s.schedule_started_at).toLocaleString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds/60)}m`;
  if (seconds < 86400) return `${Math.round(seconds/3600)}h`;
  return `${Math.round(seconds/86400)}d`;
}

// ── Styles · cream theme · NEX HQ tokens ──────────────────────────────────

const pageStyle: React.CSSProperties = { padding: "24px 32px 60px" };
const titleBlockStyle: React.CSSProperties = { marginBottom: 24 };
const eyebrowStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 3, color: "var(--nex-accent-600)", fontWeight: 700, marginBottom: 8 };
const h1Style: React.CSSProperties = { fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.4, color: "var(--nex-neutral-900)" };
const subtitleStyle: React.CSSProperties = { fontSize: 13, color: "var(--nex-neutral-700)", marginTop: 6, maxWidth: 720 };
const sectionLabelStyle: React.CSSProperties = { fontSize: 11, letterSpacing: 2, color: "var(--nex-accent-600)", fontWeight: 700, textTransform: "uppercase", marginTop: 24, marginBottom: 12 };
const alertBannerStyle: React.CSSProperties = { padding: "14px 16px", borderRadius: 10, background: "rgba(220, 38, 38, 0.06)", border: "1px solid rgba(220, 38, 38, 0.30)", color: "var(--nex-neutral-900)", fontSize: 13, marginBottom: 16 };
const tilesRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 };
const verdictTilesRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, marginBottom: 10 };
const verdictHintStyle: React.CSSProperties = { fontSize: 12, color: "var(--nex-neutral-700)", lineHeight: 1.5, padding: "8px 12px", background: "var(--nex-neutral-100)", borderLeft: "3px solid var(--nex-accent-500)", borderRadius: 4, marginBottom: 20 };
const legacyNoticeStyle: React.CSSProperties = { fontSize: 12, color: "var(--nex-neutral-700)", lineHeight: 1.5, padding: "8px 12px", background: "rgba(250, 204, 21, 0.06)", borderLeft: "3px solid rgba(250, 204, 21, 0.7)", borderRadius: 4, marginBottom: 12 };
const inlineCodeStyle: React.CSSProperties = { padding: "1px 5px", background: "var(--nex-neutral-100)", borderRadius: 3, fontSize: 11, fontFamily: "monospace", margin: "0 3px" };
function verdictTileStyle(state: string): React.CSSProperties {
  const accents: Record<string, { border: string; bg: string; text: string }> = {
    GREEN:       { border: "rgba(16, 185, 129, 0.55)", bg: "rgba(16, 185, 129, 0.08)", text: "#047857" },
    PARTIAL:     { border: "rgba(250, 204, 21, 0.55)", bg: "rgba(250, 204, 21, 0.06)", text: "#a16207" },
    FAILED:      { border: "rgba(239, 68, 68, 0.55)",  bg: "rgba(239, 68, 68, 0.06)",  text: "#b91c1c" },
    STUCK:       { border: "rgba(59, 130, 246, 0.55)", bg: "rgba(59, 130, 246, 0.06)", text: "#1e40af" },
    NOT_RUNNING: { border: "var(--nex-neutral-300)",   bg: "var(--nex-neutral-100)",   text: "var(--nex-neutral-600)" },
    BLOCKED:     { border: "var(--nex-neutral-400)",   bg: "var(--nex-neutral-100)",   text: "var(--nex-neutral-800)" },
    UNKNOWN:     { border: "var(--nex-neutral-200)",   bg: "var(--nex-neutral-0)",     text: "var(--nex-neutral-500)" },
  };
  const a = accents[state] ?? accents.UNKNOWN;
  return { background: a.bg, border: `1px solid ${a.border}`, borderRadius: 12, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 4, color: a.text };
}
function healthTileStyle(state: string): React.CSSProperties {
  const accents: Record<string, { border: string; bg: string; text: string }> = {
    HEALTHY:    { border: "rgba(16, 185, 129, 0.45)", bg: "rgba(16, 185, 129, 0.06)", text: "#047857" },
    WARNING:    { border: "rgba(250, 204, 21, 0.45)", bg: "rgba(250, 204, 21, 0.06)", text: "#a16207" },
    CRITICAL:   { border: "rgba(239, 68, 68, 0.55)",  bg: "rgba(239, 68, 68, 0.06)",  text: "#b91c1c" },
    MISSED_RUN: { border: "rgba(220, 38, 38, 0.55)",  bg: "rgba(220, 38, 38, 0.08)",  text: "#991b1b" },
    UNKNOWN:    { border: "var(--nex-neutral-200)",   bg: "var(--nex-neutral-0)",     text: "var(--nex-neutral-500)" },
  };
  const a = accents[state] ?? accents.UNKNOWN;
  return { background: a.bg, border: `1px solid ${a.border}`, borderRadius: 12, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 4, color: a.text };
}
function healthBadgeStyle(state: string): React.CSSProperties {
  const map: Record<string, { bg: string; text: string }> = {
    HEALTHY:    { bg: "rgba(16, 185, 129, 0.12)", text: "#047857" },
    WARNING:    { bg: "rgba(250, 204, 21, 0.15)", text: "#a16207" },
    CRITICAL:   { bg: "rgba(239, 68, 68, 0.12)",  text: "#b91c1c" },
    MISSED_RUN: { bg: "rgba(220, 38, 38, 0.15)",  text: "#991b1b" },
    UNKNOWN:    { bg: "var(--nex-neutral-100)",   text: "var(--nex-neutral-500)" },
  };
  const s = map[state] ?? map.UNKNOWN;
  return { display: "inline-block", padding: "3px 10px", borderRadius: 999, background: s.bg, color: s.text, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" };
}
const tileCountStyle: React.CSSProperties = { fontSize: 28, fontWeight: 800, lineHeight: 1 };
const tileLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: "capitalize" };
const panelStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 12, padding: "12px 16px", overflowX: "auto" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle: React.CSSProperties = { color: "var(--nex-neutral-500)", padding: "8px 8px 8px 0", textAlign: "left", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid var(--nex-neutral-200)" };
const tdStyle: React.CSSProperties = { color: "var(--nex-neutral-900)", padding: "10px 8px 10px 0", verticalAlign: "top", borderTop: "1px solid var(--nex-neutral-100)" };
const tdNumStyle: React.CSSProperties = { ...tdStyle, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" };
const mutedCardStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px dashed var(--nex-neutral-200)", borderRadius: 12, padding: "16px 18px", fontSize: 13, color: "var(--nex-neutral-700)", lineHeight: 1.55 };
const codeStyle: React.CSSProperties = { marginTop: 10, padding: "12px 14px", background: "var(--nex-neutral-100)", borderRadius: 8, fontSize: 11, fontFamily: "monospace", overflow: "auto", color: "var(--nex-neutral-700)" };
