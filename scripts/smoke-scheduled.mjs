#!/usr/bin/env node
// scripts/smoke-scheduled.mjs
//
// Founder Phase 18 · P18-4 · Scheduled agents regression.
//
// Verifies:
//   A · list registered handlers includes "heartbeat" + "observatory-refresh"
//   B · register a job with heartbeat handler at 60s cadence · idempotent upsert
//   C · unknown handler rejected (400)
//   D · run-now executes it · returns ok=true + run_id + result_summary.pong
//   E · after run-now, cadence pushes next_due_at into the future
//   F · tick within cadence does NOT re-run (skipped)
//   G · tick after cadence elapses DOES re-run (use 1s cadence job)
//   H · runs list shows most recent runs sorted DESC
//   I · observatory-refresh returns counts snapshot
//   J · run-now on unknown job → 404

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

async function j(pth, opts = {}) {
  const res = await fetch(`${HOST}${pth}`, opts);
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body };
}

async function post(pth, body) {
  return j(pth, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const jobName = `smoke-heartbeat-${randomUUID().slice(0, 6)}`;
const fastJobName = `smoke-fast-${randomUUID().slice(0, 6)}`;
let jobId, fastJobId;

// ══ A · registered handlers
console.log("\n══ A · list includes heartbeat + observatory-refresh");
{
  const r = await j("/api/nex/scheduled");
  const rh = r.body?.registered_handlers ?? [];
  console.log(`  registered=${rh.join(",")}`);
  if (!rh.includes("heartbeat")) failures.push({ case: "A", reason: "no_heartbeat" });
  if (!rh.includes("observatory-refresh")) failures.push({ case: "A", reason: "no_observatory_refresh" });
}

// ══ B · register a job
console.log("\n══ B · register heartbeat job");
{
  const r = await post("/api/nex/scheduled", {
    name: jobName, handler: "heartbeat", cadence: "60s",
  });
  jobId = r.body?.job?.job_id;
  console.log(`  status=${r.status} id=${jobId?.slice(0, 8)} cadence=${r.body?.job?.cadence}`);
  if (r.status !== 200) failures.push({ case: "B", reason: `status_${r.status}` });
  if (!jobId) failures.push({ case: "B", reason: "no_job_id" });
  // Register a fast job for tick tests.
  const rf = await post("/api/nex/scheduled", {
    name: fastJobName, handler: "heartbeat", cadence: "1s",
  });
  fastJobId = rf.body?.job?.job_id;
  if (!fastJobId) failures.push({ case: "B", reason: "no_fast_job_id" });
  // Idempotent upsert
  const again = await post("/api/nex/scheduled", {
    name: jobName, handler: "heartbeat", cadence: "60s",
  });
  if (again.body?.job?.job_id !== jobId) failures.push({ case: "B", reason: "upsert_replaced_id" });
}

// ══ C · unknown handler
console.log("\n══ C · unknown handler rejected");
{
  const r = await post("/api/nex/scheduled", {
    name: `bad-${randomUUID().slice(0, 6)}`, handler: "definitely-not-real", cadence: "60s",
  });
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 400) failures.push({ case: "C", reason: `status_${r.status}` });
  if (r.body?.error !== "unknown_handler") failures.push({ case: "C", reason: "wrong_error" });
}

// ══ D · run-now executes
console.log("\n══ D · run-now executes handler");
let firstRunId;
{
  const r = await post(`/api/nex/scheduled/${jobId}/run-now`);
  console.log(`  status=${r.status} ran=${r.body?.ran} ok=${r.body?.ok} pong=${!!r.body?.result_summary?.pong}`);
  if (r.status !== 200) failures.push({ case: "D", reason: `status_${r.status}` });
  if (!r.body?.ran) failures.push({ case: "D", reason: "did_not_run" });
  if (r.body?.ok !== true) failures.push({ case: "D", reason: "not_ok" });
  if (!r.body?.result_summary?.pong) failures.push({ case: "D", reason: "no_pong" });
  firstRunId = r.body?.run_id;
}

// ══ E · next_due_at pushed forward
console.log("\n══ E · next_due_at pushed into future after run");
{
  const r = await j("/api/nex/scheduled");
  const job = (r.body?.jobs ?? []).find((x) => x.job_id === jobId);
  const nextDue = new Date(job?.next_due_at).getTime();
  const now = Date.now();
  console.log(`  next_due_at in ${Math.round((nextDue - now) / 1000)}s`);
  if (nextDue <= now) failures.push({ case: "E", reason: "next_due_at_not_pushed" });
  if (Number(job?.run_count ?? 0) < 1) failures.push({ case: "E", reason: `run_count_${job?.run_count}` });
}

// ══ F · tick within cadence is a no-op for the 60s job
console.log("\n══ F · tick within cadence skips 60s job");
{
  const r = await post("/api/nex/scheduled/tick");
  const ranNames = (r.body?.runs ?? []).map((x) => x.name);
  const ourNameRan = ranNames.includes(jobName);
  console.log(`  ran=${r.body?.ran_count} runs=${ranNames.join(",")}`);
  if (ourNameRan) failures.push({ case: "F", reason: "60s_job_ran_within_cadence" });
}

// ══ G · fast (1s) job runs on next tick after ~1.2s
console.log("\n══ G · fast job runs when cadence has elapsed");
{
  // Ensure it hasn't already been consumed by any earlier tick.
  // First check current state.
  const beforeR = await j("/api/nex/scheduled");
  const before = (beforeR.body?.jobs ?? []).find((x) => x.job_id === fastJobId);
  const beforeRunCount = Number(before?.run_count ?? 0);
  await new Promise((res) => setTimeout(res, 1300));
  const t = await post("/api/nex/scheduled/tick");
  const ranNames = (t.body?.runs ?? []).map((x) => x.name);
  const afterR = await j("/api/nex/scheduled");
  const after = (afterR.body?.jobs ?? []).find((x) => x.job_id === fastJobId);
  const afterRunCount = Number(after?.run_count ?? 0);
  console.log(`  before_runs=${beforeRunCount} after_runs=${afterRunCount} tick_runs=${ranNames.join(",")}`);
  if (afterRunCount <= beforeRunCount && !ranNames.includes(fastJobName)) {
    failures.push({ case: "G", reason: "fast_job_did_not_run" });
  }
}

// ══ H · runs list DESC
console.log("\n══ H · runs list shows most recent first");
{
  // Force another run.
  await post(`/api/nex/scheduled/${jobId}/run-now`);
  const r = await j(`/api/nex/scheduled/${jobId}/runs?limit=5`);
  const runs = r.body?.runs ?? [];
  console.log(`  runs=${runs.length} first_started=${runs[0]?.started_at?.slice(11, 19)}`);
  if (runs.length < 2) failures.push({ case: "H", reason: `only_${runs.length}_runs` });
  if (runs.length >= 2) {
    const t0 = new Date(runs[0].started_at).getTime();
    const t1 = new Date(runs[1].started_at).getTime();
    if (t0 < t1) failures.push({ case: "H", reason: "not_desc_order" });
  }
}

// ══ I · observatory-refresh returns counts snapshot
console.log("\n══ I · observatory-refresh handler returns counts");
{
  const obsJobName = `smoke-obs-${randomUUID().slice(0, 6)}`;
  const create = await post("/api/nex/scheduled", {
    name: obsJobName, handler: "observatory-refresh", cadence: "60s",
  });
  const obsId = create.body?.job?.job_id;
  const r = await post(`/api/nex/scheduled/${obsId}/run-now`);
  const counts = r.body?.result_summary?.counts;
  console.log(`  ok=${r.body?.ok} counts.messages=${counts?.messages} counts.teams=${counts?.teams}`);
  if (r.body?.ok !== true) failures.push({ case: "I", reason: "not_ok" });
  if (!counts || typeof counts.messages === "undefined") failures.push({ case: "I", reason: "no_counts" });
}

// ══ J · run-now on unknown job → 404
console.log("\n══ J · run-now on unknown job → 404");
{
  const r = await post(`/api/nex/scheduled/${"0".repeat(8)}-0000-0000-0000-000000000000/run-now`);
  console.log(`  status=${r.status}`);
  if (r.status !== 404) failures.push({ case: "J", reason: `status_${r.status}` });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · scheduled agents live · cron + handlers + audit trail.");
  process.exit(0);
}
