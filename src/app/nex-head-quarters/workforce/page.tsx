// NEX HQ · Workforce (Phase 1 · Philip 2026-08-27)
//
// /nex-head-quarters/workforce · one row per category-job specialist.
//
// Rule enforced by this page (Philip):
//   "Do not equate '10 registered jobs' with '10 active'."
//
// Every slot shows its ACTUAL status:
//   🟢 running · walker cycle in-flight
//   🔵 queued · eligible surface waiting for a slot
//   🟡 cooling · all cities cooling (surface-level cooldown active)
//   🟠 needs-strategy · registered but no rotation state row exists yet
//   🔴 error · latest cycle failed
//   ⚪ no-legitimate-work · all surfaces exhausted, no cooldown pending
//
// Data comes exclusively from live DB queries (workforce-data.ts) · never
// from a hard-coded "100 active" list.

import {
  loadWorkforceSnapshot,
  loadWorkforceTally,
  type JobSlot,
  type WorkerTypeStats,
} from "@/lib/nex-hq/workforce-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_DOT: Record<JobSlot["status"], string> = {
  running:            "🟢",
  queued:             "🔵",
  cooling:            "🟡",
  "needs-strategy":   "🟠",
  error:              "🔴",
  "no-legitimate-work": "⚪",
};
const STATUS_LABEL: Record<JobSlot["status"], string> = {
  running:            "Running",
  queued:             "Queued",
  cooling:            "Cooling",
  "needs-strategy":   "Needs strategy",
  error:              "Error",
  "no-legitimate-work": "No legitimate work",
};

function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().replace("T", " ").slice(0, 19) + "Z";
}
function relTime(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000)     return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000)  return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

export default async function WorkforcePage() {
  const [slots, tally] = await Promise.all([
    loadWorkforceSnapshot(),
    loadWorkforceTally(),
  ]);

  const counts: Record<JobSlot["status"], number> = {
    running: 0, queued: 0, cooling: 0,
    "needs-strategy": 0, error: 0, "no-legitimate-work": 0,
  };
  for (const s of slots) counts[s.status] += 1;
  const totalRecordsLastHour = slots.reduce((a, s) => a + s.recordsLastHour, 0);
  const totalRecords24h     = slots.reduce((a, s) => a + s.recordsLast24h, 0);
  const totalCycles24h      = slots.reduce((a, s) => a + s.cyclesLast24h, 0);

  // Philip 2026-08-27: "100% facts displayed" · no interpretive verdict, no
  // smiley icons, no green/amber/red judgement. Show raw numbers only. The
  // reader decides the story.
  const successRateLast5min = (tally.completedLast5min + tally.failedLast5min) > 0
    ? tally.completedLast5min / (tally.completedLast5min + tally.failedLast5min)
    : null;
  const successRatePct = successRateLast5min != null
    ? Math.round(successRateLast5min * 100) + "%"
    : "no cycles";

  return (
    <div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", background: "var(--nex-cream-50, #faf8f3)", minHeight: "100vh" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, color: "var(--nex-stone-500, #78716c)", textTransform: "uppercase" }}>
          NEX HQ · Workforce
        </div>
        <h1 style={{ fontSize: 28, margin: "4px 0 4px 0", color: "var(--nex-ink-900, #1c1917)" }}>
          Discovery Workforce · Phase 1 (10 category-jobs)
        </h1>
        <div style={{ fontSize: 13, color: "var(--nex-stone-600, #57534e)", maxWidth: 780 }}>
          One row per permanent category specialist. Worker identity = category · geography = Indonesia-wide.
          A surface-level cooldown on Jakarta does NOT idle the job · the specialist moves to the next
          eligible Indonesian city. Reads live DB · never assumes registered = active.
        </div>
      </div>

      {/* ── ALL WORKERS TALLY · Philip 2026-08-27 · "100% facts displayed" ── */}
      <div style={{
        background: "#fff",
        border: "1px solid var(--nex-stone-300, #d6d3d1)",
        borderRadius: 8,
        padding: "16px 20px",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--nex-stone-500, #78716c)", textTransform: "uppercase" }}>
              ALL WORKERS · live DB · no interpretation
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4, color: "var(--nex-ink-900, #1c1917)" }}>
              {tally.totalWorkerTypes} worker types · {tally.runningNow} running · {tally.completedLast5min}✓ / {tally.failedLast5min}✗ in last 5min ({successRatePct} success)
            </div>
            <div style={{ fontSize: 11, color: "var(--nex-stone-500, #78716c)", marginTop: 4 }}>
              measured {tally.measuredAt.toISOString().replace("T", " ").slice(0, 19)}Z · reader interprets · no green/amber/red judgement applied
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(120px, 1fr))", gap: 10 }}>
          <BigStat label="Worker types (24h)"  value={tally.totalWorkerTypes} color="var(--nex-ink-800, #292524)" />
          <BigStat label="Running right now"   value={tally.runningNow}         color="var(--nex-ink-800, #292524)" />
          <BigStat label="Completed last 5min" value={tally.completedLast5min}  color="var(--nex-ink-800, #292524)" />
          <BigStat label="Failed last 5min"    value={tally.failedLast5min}     color="var(--nex-ink-800, #292524)" />
          <BigStat label="Stopped >30min"      value={tally.stoppedTypes}       color="var(--nex-ink-800, #292524)" />
        </div>

        {/* Per-worker-type breakdown table */}
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--nex-stone-100, #f5f5f4)" }}>
                <th style={smallThStyle}>Worker type</th>
                <th style={smallThStyle}>Running</th>
                <th style={smallThStyle}>✓ Completed 5m</th>
                <th style={smallThStyle}>✗ Failed 5m</th>
                <th style={smallThStyle}>Cycles 24h</th>
                <th style={smallThStyle}>Records new 24h</th>
                <th style={smallThStyle}>Last finish</th>
                <th style={smallThStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tally.perType.map((t) => (
                <WorkerTypeRow key={t.worker_type} t={t} />
              ))}
              {tally.perType.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ ...smallTdStyle, textAlign: "center", color: "var(--nex-stone-500, #78716c)" }}>
                    No worker cycles in the last 24h. Scheduler may not be running.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Headline aggregates */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(120px, 1fr))", gap: 8, marginBottom: 16 }}>
        <StatChip label="Running"    value={counts.running}          dot="🟢" />
        <StatChip label="Queued"     value={counts.queued}           dot="🔵" />
        <StatChip label="Cooling"    value={counts.cooling}          dot="🟡" />
        <StatChip label="Needs strategy" value={counts["needs-strategy"]} dot="🟠" />
        <StatChip label="Error"      value={counts.error}            dot="🔴" />
        <StatChip label="No work"    value={counts["no-legitimate-work"]} dot="⚪" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
        <StatChip label="Records / last hour"   value={totalRecordsLastHour} dot="✓" />
        <StatChip label="Records / last 24h"    value={totalRecords24h}      dot="✓" />
        <StatChip label="Cycles / last 24h"     value={totalCycles24h}       dot="↻" />
      </div>

      {/* Per-job grid */}
      <div style={{ background: "#fff", border: "1px solid var(--nex-stone-200, #e7e5e4)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--nex-stone-100, #f5f5f4)", textAlign: "left" }}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Job</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>City</th>
              <th style={thStyle}>Provider</th>
              <th style={thStyle}>Last cycle</th>
              <th style={thStyle}>Records / h</th>
              <th style={thStyle}>Records / 24h</th>
              <th style={thStyle}>Cities eligible / cooling</th>
              <th style={thStyle}>Next eligible</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => {
              const eligible = s.cityStatesForJob.filter((c) => c.state === "build" || c.state === "reactivate").length;
              const cooling  = s.cityStatesForJob.filter((c) => c.state === "saturated").length;
              return (
                <tr key={s.job.id} style={{ borderTop: "1px solid var(--nex-stone-200, #e7e5e4)" }}>
                  <td style={tdStyle}>{s.job.id}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 16, marginRight: 6 }}>{s.job.emoji}</span>
                    <strong>{s.job.name}</strong>
                    <div style={{ fontSize: 11, color: "var(--nex-stone-500, #78716c)" }}>{s.job.category_slug} → {s.job.target_table}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 15 }}>{STATUS_DOT[s.status]}</span>{" "}
                    <span style={{ fontSize: 12 }}>{STATUS_LABEL[s.status]}</span>
                  </td>
                  <td style={tdStyle}>{s.currentCity ?? "—"}</td>
                  <td style={tdStyle}>{s.currentProvider ?? "—"}</td>
                  <td style={tdStyle}>
                    {s.lastCycleFinishedAt ? relTime(s.lastCycleFinishedAt) : "—"}
                    {s.lastCycleRecordsNew != null && (
                      <div style={{ fontSize: 11, color: s.lastCycleRecordsNew > 0 ? "var(--nex-emerald-700, #047857)" : "var(--nex-stone-500, #78716c)" }}>
                        {s.lastCycleRecordsNew} new
                      </div>
                    )}
                    {s.lastCycleOutcome && (
                      <div style={{ fontSize: 10, color: "var(--nex-stone-500, #78716c)" }}>{s.lastCycleOutcome}</div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>{s.recordsLastHour}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>{s.recordsLast24h}</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>
                    <span style={{ color: "var(--nex-emerald-700, #047857)" }}>{eligible} eligible</span>
                    {" · "}
                    <span style={{ color: "var(--nex-amber-700, #b45309)" }}>{cooling} cooling</span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>
                    {s.nextEligibleCity ?? (s.cooldownNext ? `next @ ${fmt(s.cooldownNext)}` : "—")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--nex-stone-500, #78716c)" }}>
        Phase 1 note: Restaurants / Cafés / Hotels / Guesthouses jobs run discovery (Overpass fetch)
        but persistence to their target tables is deferred to Phase 1.5. Service categories
        (Gyms / Salons / Dentists / Opticians / Pharmacies / Car Repair) write end-to-end to
        <code style={{ margin: "0 4px", padding: "1px 4px", background: "var(--nex-stone-100, #f5f5f4)", borderRadius: 3 }}>nex.service_business</code>.
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--nex-stone-600, #57534e)",
  fontWeight: 600,
};
const tdStyle: React.CSSProperties = {
  padding: "10px",
  verticalAlign: "top",
  color: "var(--nex-ink-800, #292524)",
};
const smallThStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 10,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--nex-stone-600, #57534e)",
  fontWeight: 600,
  borderBottom: "1px solid var(--nex-stone-200, #e7e5e4)",
};
const smallTdStyle: React.CSSProperties = {
  padding: "6px 8px",
  verticalAlign: "top",
  color: "var(--nex-ink-800, #292524)",
  fontSize: 12,
  borderBottom: "1px solid var(--nex-stone-100, #f5f5f4)",
};

function StatChip({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--nex-stone-200, #e7e5e4)",
      borderRadius: 6,
      padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, color: "var(--nex-stone-500, #78716c)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 20, color: "var(--nex-ink-900, #1c1917)" }}>
        <span style={{ marginRight: 6, fontSize: 16 }}>{dot}</span>
        <span style={{ fontFamily: "monospace" }}>{value}</span>
      </div>
    </div>
  );
}

function BigStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: "var(--nex-stone-50, #fafaf9)",
      border: "1px solid var(--nex-stone-200, #e7e5e4)",
      borderRadius: 6,
      padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, color: "var(--nex-stone-500, #78716c)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 26, fontWeight: 700, fontFamily: "monospace", color }}>{value}</div>
    </div>
  );
}

function WorkerTypeRow({ t }: { t: WorkerTypeStats }) {
  const stalenessText = t.minutes_since_last_finish == null
    ? "never"
    : t.minutes_since_last_finish < 1
      ? `${Math.round(t.minutes_since_last_finish * 60)}s ago`
      : t.minutes_since_last_finish < 60
        ? `${Math.round(t.minutes_since_last_finish)}m ago`
        : `${(t.minutes_since_last_finish / 60).toFixed(1)}h ago`;
  const statusText = t.is_stopped
    ? `STOPPED (${stalenessText})`
    : t.running_now > 0
      ? "IN-FLIGHT"
      : t.latest_status ?? "—";
  return (
    <tr>
      <td style={{ ...smallTdStyle, fontFamily: "monospace" }}>{t.worker_type}</td>
      <td style={{ ...smallTdStyle, fontFamily: "monospace" }}>{t.running_now}</td>
      <td style={{ ...smallTdStyle, fontFamily: "monospace" }}>{t.completed_last_5min}</td>
      <td style={{ ...smallTdStyle, fontFamily: "monospace", color: t.failed_last_5min > 0 ? "#b91c1c" : undefined }}>{t.failed_last_5min}</td>
      <td style={{ ...smallTdStyle, fontFamily: "monospace" }}>{t.cycles_last_24h}</td>
      <td style={{ ...smallTdStyle, fontFamily: "monospace" }}>{t.records_new_last_24h}</td>
      <td style={smallTdStyle}>{stalenessText}</td>
      <td style={{ ...smallTdStyle, color: t.is_stopped ? "#b91c1c" : undefined }}>{statusText}</td>
    </tr>
  );
}
