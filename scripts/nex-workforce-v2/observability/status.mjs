#!/usr/bin/env node
// NEX Workforce v2 · Observability · CLI status report
// ─────────────────────────────────────────────────────────────────────────────
// Prints a structured operator status report against Project B (default) or a
// portable/test target. Zero mutations. Uses only READ-ONLY SELECT queries.
//
// Usage:
//   node scripts/nex-workforce-v2/observability/status.mjs [--json] [--window=24] [--target=production|portable]
//
// Env:
//   NEX_SUPABASE_ACCESS_TOKEN, NEX_SUPABASE_PROJECT_REF (from .env.tools.local)
//
// Exit codes:
//   0 = report generated
//   1 = query failure
//   2 = unauthorized (no token or ref)

import { readFileSync } from "node:fs";
import { collectAllMetrics } from "./lib/metrics.mjs";
import { classifyHealth, HealthState } from "./lib/health.mjs";
import { evaluateAlerts, alertCatalogue } from "./lib/alerts.mjs";

const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");
const windowMatch = process.argv.find(a => a.startsWith("--window="));
const windowHours = windowMatch ? Number(windowMatch.split("=")[1]) : 24;
const targetMatch = process.argv.find(a => a.startsWith("--target="));
const target = targetMatch ? targetMatch.split("=")[1] : "production";

async function makeMgmtQuery() {
  const envTools = readFileSync(".env.tools.local", "utf8");
  const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
  const REF = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)?.[1];
  if (!TOKEN || !REF) throw new Error("NEX_SUPABASE_ACCESS_TOKEN or NEX_SUPABASE_PROJECT_REF missing");
  return async function query(sql) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    const text = await r.text();
    if (r.status >= 400) throw new Error(`mgmt ${r.status}: ${text}`);
    return text ? JSON.parse(text) : [];
  };
}

async function makePortableQuery() {
  const pg = (await import("pg")).default;
  const pool = new pg.Pool({ host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test", max: 4 });
  return async function query(sql) {
    const r = await pool.query(sql);
    return r.rows;
  };
}

const query = target === "portable" ? await makePortableQuery() : await makeMgmtQuery();

const metrics = await collectAllMetrics(query, { windowHours });
const health = classifyHealth(metrics);
const alerts = evaluateAlerts(metrics);

const report = {
  target,
  ...metrics,
  health,
  alerts: {
    definitions_available: alertCatalogue().length,
    delivery_implemented: false,
    delivery_note: "Alert conditions defined and evaluated; automated delivery (email/Slack/etc.) is NOT implemented per C7 Section 12. Operator must poll this report or wire delivery in a separate authorized slice.",
    active: alerts,
    total_active: alerts.length,
    by_severity: {
      CRITICAL: alerts.filter(a => a.severity === "CRITICAL").length,
      WARNING:  alerts.filter(a => a.severity === "WARNING").length,
      INFO:     alerts.filter(a => a.severity === "INFO").length,
    },
  },
};

if (jsonMode) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(0);
}

// ─── Human-readable print ───────────────────────────────────────────────────
const w = (label, value) => process.stdout.write(`  ${label.padEnd(28)} ${value}\n`);
const hr = () => process.stdout.write("─".repeat(75) + "\n");

console.log("═".repeat(75));
console.log(` NEX Workforce v2 · Observability Report · ${target} · window=${windowHours}h`);
console.log(` collected_at: ${report.collected_at}`);
console.log("═".repeat(75));

// 1. WORKFORCE STATUS
console.log("\n── 1 · WORKFORCE STATUS ──");
w("Health state", report.health.state);
w("Evidence", JSON.stringify(report.health.evidence));
w("Total work_items", report.workforce.total);
w("  pending", report.workforce.pending);
w("  leased", report.workforce.leased);
w("  soft_fail", report.workforce.soft_fail);
w("  completed", report.workforce.completed);
w("  dead_letter", report.workforce.dead_letter);
if (report.workforce.oldest_pending_secs != null) w("Oldest pending age (s)", report.workforce.oldest_pending_secs);
if (report.workforce.oldest_leased_secs != null) w("Oldest leased age (s)", report.workforce.oldest_leased_secs);

// 2. ACTIVE AGENTS
console.log("\n── 2 · ACTIVE AGENTS ──");
w("Active agents", report.agents.active_count);
for (const a of report.agents.agents) {
  console.log(`    ${a.agent_id} · state=${a.state} · pid=${a.pid} · host=${a.host} · hb_age=${a.heartbeat_age_secs}s · wi=${a.current_work_item_id ?? '(none)'} · lease_left=${a.lease_remaining_secs ?? 'n/a'}s`);
}

// 3. STUCK / AT-RISK WORK
console.log("\n── 3 · STUCK / AT-RISK WORK ──");
w("Stuck items", report.stuck_work.length);
for (const s of report.stuck_work) {
  console.log(`    ${s.work_item_id} · reason=${s.stuck_reason} · agent=${s.agent_id} · hb_age=${s.heartbeat_age_secs}s · lease_left=${s.lease_remaining_secs}s · city=${s.city_slug}`);
}

// 4. RECENT CYCLES
console.log("\n── 4 · RECENT CYCLES (last 20) ──");
for (const c of report.recent_cycles.slice(0, 10)) {
  console.log(`    ${c.finished_at ?? c.started_at} · ${c.state.padEnd(11)} · ${c.city_slug}/${c.category_slug}/${c.source_slug} · new=${c.records_new ?? '-'} rej=${c.records_rejected ?? '-'} · ${c.duration_secs ?? '-'}s`);
}
if (report.recent_cycles.length > 10) console.log(`    ...+${report.recent_cycles.length - 10} more`);

// 5. FAILURE CLASSES
console.log("\n── 5 · FAILURE CLASSES ──");
w("Total failures (window)", report.failures.total);
for (const [cls, n] of Object.entries(report.failures.by_class)) w(`  ${cls}`, n);

// 6. THROUGHPUT
console.log("\n── 6 · THROUGHPUT (window) ──");
if (report.throughput.available) {
  w("Cycles completed", report.throughput.cycles_completed);
  w("Cycles soft_fail", report.throughput.cycles_soft_fail);
  w("Cycles dead_letter", report.throughput.cycles_dead_letter);
  w("Records new (Σ)", report.throughput.records_new_total);
  w("Records rejected (Σ)", report.throughput.records_rejected_total);
  w("Avg cycle duration (s)", report.throughput.avg_duration_secs);
  w("p50 cycle duration (s)", report.throughput.p50_duration_secs);
  w("p95 cycle duration (s)", report.throughput.p95_duration_secs);
} else {
  w("Availability", "NOT AVAILABLE");
}

// 7. CITY × CATEGORY × SOURCE MATRIX
console.log("\n── 7 · CITY × CATEGORY × SOURCE MATRIX ──");
for (const m of report.source_matrix) {
  console.log(`    ${m.city_slug}/${m.category_slug}/${m.source_slug} · P=${m.pending} L=${m.leased} C=${m.completed} SF=${m.soft_fail} DL=${m.dead_letter} · new=${m.records_new} rej=${m.records_rejected} · last=${m.last_activity ?? '(none)'}`);
}
console.log(`    ROTATION_ELIGIBLE (${report.rotation_eligible.length}):`);
for (const r of report.rotation_eligible) {
  console.log(`      · ${r.city_slug} × ${r.category_slug} × ${r.source_slug} (job=${r.job_slug} · prio=${r.priority} · cad=${r.cadence_minutes}m)`);
}

// 8. PERSISTENCE
console.log("\n── 8 · PERSISTENCE (window) ──");
if (report.persistence.available) {
  w("Audit rows", report.persistence.n_audits);
  w("  ok", report.persistence.ok_count);
  w("  failed", report.persistence.fail_count);
  w("Total new (Σ)", report.persistence.total_new);
  w("Total updated (Σ)", report.persistence.total_updated);
  w("Total rejected (Σ)", report.persistence.total_rejected);
  w("Avg batch duration (ms)", report.persistence.avg_ms);
  console.log("    Rejection reasons:");
  for (const r of report.persistence.rejections) console.log(`      · ${r.reason}: ${r.n}`);
} else {
  w("Availability", "NOT AVAILABLE");
}

// 9. INFRASTRUCTURE / SESSIONS / REAPER
console.log("\n── 9 · INFRASTRUCTURE ──");
if (report.reaper.available) {
  w("Reaper runs (window)", report.reaper.n_runs);
  w("  unfinished", report.reaper.unfinished);
  w("  zombies reclaimed", report.reaper.zombies_reclaimed);
  w("  dead-lettered", report.reaper.dead_lettered);
  w("  errors", report.reaper.errors);
  w("  last run age (s)", report.reaper.last_run_age_secs);
}
if (report.sessions.available) {
  w("Workforce DB sessions", report.sessions.wf_sessions);
  w("Legacy DB sessions", report.sessions.legacy_sessions);
  w("Active persist calls", report.sessions.active_persist);
  w("Active claim calls", report.sessions.active_claim);
  w("Active heartbeat calls", report.sessions.active_heartbeat);
}

// 10. ALERTS
console.log("\n── 10 · ALERTS ──");
w("Delivery implemented", report.alerts.delivery_implemented);
w("Definitions available", report.alerts.definitions_available);
w("Currently active", `${report.alerts.total_active} (CRITICAL=${report.alerts.by_severity.CRITICAL} WARNING=${report.alerts.by_severity.WARNING})`);
if (report.alerts.active.length === 0) {
  console.log("    (no active alert conditions)");
} else {
  for (const a of report.alerts.active) {
    console.log(`    [${a.severity}] ${a.id} · ${a.condition} · ${JSON.stringify({ ...a, id: undefined, severity: undefined, condition: undefined, last_seen: undefined })}`);
  }
}

hr();
console.log(`Health: ${report.health.state} · ${report.alerts.total_active} active alerts · report generated in read-only mode`);
