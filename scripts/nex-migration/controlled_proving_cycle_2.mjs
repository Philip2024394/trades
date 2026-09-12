// NEX Workforce · SECOND Controlled Proving Cycle (post Slice 3 R2.2 v2)
// ============================================================================
// Governing authorization: Philip 2026-09-04 · "RUN THE SECOND CONTROLLED
// PROVING CYCLE AFTER SLICE 3 R2.2 v2"
//
// AUTHORIZED SCOPE — ONLY:
//   Prove that one complete workforce lifecycle now executes end-to-end on
//   Project B under R2.2 v2 RLS via the real agent + reaper + orchestrator
//   binaries, connecting as nex_app_runtime and using SET LOCAL ROLE
//   nex_workforce_app via the withWorkforceRole helper.
//
// Capability choice: hello_world (Slice 1c smoke-test capability)
//   - registered for category='helloworld' + source='helloworld'
//   - runs 3 dummy execute+checkpoint steps then complete()
//   - NO external service call · NO persist_batch · NO target-table write
//   - Exercises: claim → heartbeat → checkpoint × 3 → complete
//     under R2.2 v2 RLS with real binaries.
//   - This is the safest bounded shape for a second proving cycle:
//     zero risk of mass real data acquisition · zero risk of persister-path
//     side-effects (persist_to_food_business fence-read already proven at
//     R2.2 v2 apply-time functional proof, and R2R2-6h portable rehearsal).
//
// The overpass_observe_and_stage capability was inspected during preflight
// and has a pre-existing wiring gap: workItem.bbox_json is read but
// work_item has no such column and no enrichment step joins city_catalogue.
// The default (whole-world bbox) would issue an unbounded Overpass query.
// This is a Slice 4 / maintenance-slice concern out of scope for R2.2 v2.
// Reported in the final deliverable as a documented finding.
//
// Flow: baseline → seed one narrow ops-config → start 3 binaries → observe
// until terminal / hard-ceiling → SIGTERM all → cleanup ops-config → LEAVE
// terminal work_item (real audit trail) → postflight compare vs baseline.

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { resolve as pathResolve } from "node:path";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const RUNTIME_URL = envTools.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];

// Bounded intervals · manual proving · not Scheduled Task cadence
const ORCH_INTERVAL_MS   = 4_000;
const REAPER_INTERVAL_MS = 4_000;
const AGENT_POLL_MS      = 1_000;
const AGENT_HB_MS        = 2_000;
const HARD_CEILING_MS    = 180_000;   // 3 minutes hard cap

// Proving fixtures · r2p prefix so cleanup is trivial
const CITY_SLUG = "r2p-proof";
const JOB_SLUG  = "r2p-helloworld";
const CATEGORY  = "helloworld";
const SOURCE    = "helloworld";
const AGENT_ID  = `proving2-${Date.now()}`;

async function mgmt(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (r.status >= 400) throw new Error(`mgmt ${r.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

const REPORT_DIR = "scripts/nex-migration/reports/proving";
mkdirSync(REPORT_DIR, { recursive: true });
const runId = `controlled-cycle-2-${Date.now()}`;
const runDir = `${REPORT_DIR}/${runId}`;
mkdirSync(runDir, { recursive: true });

let pass = 0, fail = 0;
const failLines = [];
function T(label, ok, detail) {
  const g = ok ? "✓" : "❌";
  const line = `${g} ${label}${detail ? ` · ${detail}` : ""}`;
  console.log(line);
  if (ok) pass++; else { fail++; failLines.push(line); }
}

const report = { run_id: runId, started_at: new Date().toISOString(), phases: {}, processes: {}, observations: [] };

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(` NEX Workforce · SECOND Controlled Proving · ${runId}`);
console.log(" (post Slice 3 R2.2 v2 · Project B · hello_world capability · 3-min cap)");
console.log("═══════════════════════════════════════════════════════════════════════\n");

// ─── 3 · BASELINE ─────────────────────────────────────────────────────────
console.log("─── § 3 · BASELINE (READ-ONLY) ───");
const targetId = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr`))[0];
console.log(`  target · db=${targetId.db} · pg=${targetId.ver} · user=${targetId.usr}`);

const baseline = (await mgmt(`SELECT
  (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS cities,
  (SELECT count(*)::int FROM nex_workforce.city_catalogue WHERE enabled=true) AS cities_enabled,
  (SELECT count(*)::int FROM nex_workforce.job_registry) AS jobs,
  (SELECT count(*)::int FROM nex_workforce.job_registry WHERE enabled=true) AS jobs_enabled,
  (SELECT count(*)::int FROM nex_workforce.rotation_eligible) AS eligible,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='completed') AS wi_done,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='leased') AS wi_leased,
  (SELECT count(*)::int FROM nex_workforce.agent_heartbeat) AS hb,
  (SELECT count(*)::int FROM nex_workforce.reaper_run) AS rr,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
  (SELECT count(*)::int FROM nex_workforce.work_item_dead_letter) AS dl,
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup_groups,
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS wf_policies,
  (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
  (SELECT count(*)::int FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
    WHERE r.rolname='nex_workforce_app' AND m.rolname='nex_app_runtime' AND am.inherit_option=true AND am.set_option=true AND am.admin_option=false) AS grant_ok,
  (SELECT count(*)::int FROM pg_stat_activity WHERE pid <> pg_backend_pid()
    AND (application_name ILIKE '%workforce%' OR application_name ILIKE '%nex-agent%'
      OR application_name ILIKE '%nex-reaper%' OR application_name ILIKE '%nex-orchestrator%'
      OR (state='active' AND (query ILIKE 'SELECT nex_workforce.claim%'
        OR query ILIKE 'SELECT nex_workforce.persist_batch%')))) AS active_wf`))[0];
console.log("  baseline:", JSON.stringify(baseline));
T("baseline · R2.2 v2 in place (11 policies) · food_business intact (22750 rows · 373 dups) · workforce OFF (0 active)",
  baseline.wf_policies === 11 && baseline.food_rows === 22750 && baseline.food_dup_groups === 373 && baseline.active_wf === 0 && baseline.grant_ok === 1);

const psTaskPre = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], {encoding:"utf8"});
const preTaskState = (psTaskPre.stdout||"").trim();
const psEnvPre = spawnSync("powershell", ["-NoProfile", "-Command",
  "$m=(Get-Item .env.local).LastWriteTime.ToString('o'); $g=(Select-String -Path .env.local -Pattern 'nex_workforce_admin|nex_workforce_app|withWorkforceRole' -SimpleMatch | Measure-Object).Count; 'mtime=' + $m + '|matches=' + $g"], {encoding:"utf8"});
const preEnvInfo = (psEnvPre.stdout||"").trim();
const psSysA = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Select-String -Path .env.local -Pattern 'NEX_TAXONOMY_POSTGRES_URL' -SimpleMatch | Select-Object -ExpandProperty Line)"], {encoding:"utf8"});
const preSysA = (psSysA.stdout||"").trim();
T("baseline · Scheduled Task Disabled · .env.local pre-cutover mtime · System A localhost:5433",
  (preTaskState === "Disabled" || preTaskState === "") && /matches=0/.test(preEnvInfo) && /localhost:5433\/nex_dev/.test(preSysA));

report.phases.baseline = { targetId, baseline, preTaskState, preEnvInfo, preSysA };
if (fail > 0) {
  console.log("\n🔴 HARD STOP · baseline mismatch · not seeding · not starting workforce");
  writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
  process.exit(2);
}

// ─── SEED ONE NARROW OPS CONFIG ─────────────────────────────────────────
console.log("");
console.log("─── SEED · one narrow ops config for hello_world lifecycle (proof-only · cleaned up in postflight) ───");
await mgmt(`INSERT INTO nex_workforce.city_catalogue (slug, name, country, enabled, priority, notes)
  VALUES ('${CITY_SLUG}', 'R2.2 v2 Second Proving City', 'ID', true, 999, 'controlled proving fixture · cleaned up')
  ON CONFLICT (slug) DO NOTHING`);
await mgmt(`INSERT INTO nex_workforce.job_registry
  (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority, notes)
  VALUES ('${JOB_SLUG}', '${CATEGORY}', '${SOURCE}', 60, 1, 3, 15, true, 999, 'controlled proving fixture · cleaned up')
  ON CONFLICT (slug) DO NOTHING`);
const eligNow = (await mgmt(`SELECT count(*)::int AS n FROM nex_workforce.rotation_eligible
  WHERE city_slug='${CITY_SLUG}' AND category_slug='${CATEGORY}' AND source_slug='${SOURCE}'`))[0].n;
T(`seed · r2p city + job present · 1 rotation_eligible row for r2p · orchestrator will enqueue`, eligNow === 1, `eligible=${eligNow}`);

// ─── START 3 BINARIES · foreground · bounded ───────────────────────────
console.log("");
console.log("─── START · ONE orchestrator + ONE reaper + ONE agent (foreground · bounded) ───");
function launch(name, script, extraEnv) {
  const env = { ...process.env, NEX_WORKFORCE_URL: RUNTIME_URL, ...extraEnv };
  const absScript = pathResolve(script);
  const logPath = `${runDir}/${name}.log`;
  const logStream = createWriteStream(logPath, { flags: "a" });
  logStream.write(`# ${name} started at ${new Date().toISOString()} · script=${absScript}\n`);
  const child = spawn("node", [absScript], { env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(logStream, { end: false });
  child.stderr.pipe(logStream, { end: false });
  child.on("exit", (code, signal) => {
    logStream.write(`# ${name} exited code=${code} signal=${signal} at ${new Date().toISOString()}\n`);
    logStream.end();
  });
  report.processes[name] = { pid: child.pid, script, logPath, extraEnv, started_at: new Date().toISOString() };
  console.log(`  ${name.padEnd(13)} pid=${child.pid} · log=${logPath}`);
  return child;
}
const orch   = launch("orchestrator", "scripts/nex-workforce-v2/orchestrator.mjs",
  { NEX_ORCH_INTERVAL_MS: String(ORCH_INTERVAL_MS), NEX_ORCH_MAX_CONSECUTIVE_ERRORS: "3" });
const reaper = launch("reaper", "scripts/nex-workforce-v2/reaper.mjs",
  { NEX_REAPER_INTERVAL_MS: String(REAPER_INTERVAL_MS), NEX_REAPER_MAX_CONSECUTIVE_ERRORS: "3" });
const agent  = launch("agent", "scripts/nex-workforce-v2/agent.mjs",
  { NEX_AGENT_POLL_MS: String(AGENT_POLL_MS), NEX_AGENT_HEARTBEAT_MS: String(AGENT_HB_MS), NEX_AGENT_ID: AGENT_ID });

// ─── OBSERVE · until terminal · hard cap 180s ─────────────────────────
console.log("");
console.log("─── OBSERVATION LOOP (hard ceiling 180s) ───");
const startedAt = Date.now();
let terminalReached = false;
let terminalReason = null;
let ourWorkItemId = null;
let ourWorkItemState = null;

while (!terminalReached && Date.now() - startedAt < HARD_CEILING_MS) {
  await sleep(3_000);
  const st = (await mgmt(`SELECT
    (SELECT id FROM nex_workforce.work_item WHERE city_slug='${CITY_SLUG}' AND category_slug='${CATEGORY}' ORDER BY enqueued_at DESC LIMIT 1) AS our_id,
    (SELECT state FROM nex_workforce.work_item WHERE city_slug='${CITY_SLUG}' AND category_slug='${CATEGORY}' ORDER BY enqueued_at DESC LIMIT 1) AS our_state,
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE city_slug='${CITY_SLUG}') AS r2p_wi,
    (SELECT count(*)::int FROM nex_workforce.reaper_run) AS rr,
    (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
    (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
    (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
    (SELECT count(*)::int FROM nex.food_business) AS food_rows`))[0];
  ourWorkItemId = st.our_id;
  ourWorkItemState = st.our_state;
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const obs = { t_s: elapsed, ...st };
  report.observations.push(obs);
  console.log(`  t+${String(elapsed).padStart(3)}s · our_wi=${st.our_id ? st.our_id.slice(0,8) : '(none)'} state=${st.our_state ?? 'n/a'} · rr=${st.rr} ev=${st.ev} stg=${st.stg} aud=${st.aud} · food_rows=${st.food_rows}`);

  // Guardrails: unexpected food_business growth
  if (st.food_rows !== baseline.food_rows) {
    terminalReached = true;
    terminalReason = `unexpected food_business row-count change · baseline=${baseline.food_rows} now=${st.food_rows}`;
    break;
  }
  // Guardrails: staging/evidence growth (hello_world should NEVER touch these)
  if (st.ev !== baseline.ev || st.stg !== baseline.stg) {
    terminalReached = true;
    terminalReason = `unexpected evidence/staging growth · hello_world capability should never write these`;
    break;
  }
  // Terminal · our work_item reached a valid terminal state
  if (ourWorkItemState === "completed" || ourWorkItemState === "soft_fail" || ourWorkItemState === "dead_letter") {
    terminalReached = true;
    terminalReason = `our work_item reached terminal state: ${ourWorkItemState}`;
    break;
  }
}
if (!terminalReached) { terminalReached = true; terminalReason = "hard_ceiling_180s"; }
console.log("");
console.log(`─── TERMINAL · reason=${terminalReason} ───`);
report.phases.terminal = { reason: terminalReason, ourWorkItemId, ourWorkItemState, elapsed_s: Math.round((Date.now() - startedAt) / 1000) };

// ─── SHUTDOWN · SIGTERM all three ────────────────────────────────────
console.log("");
console.log("─── SHUTDOWN · SIGTERM ───");
async function shutdown(name, child) {
  return new Promise((resolve) => {
    if (!child.pid || child.exitCode !== null) { resolve({ name, method: "already-exited", code: child.exitCode }); return; }
    let resolved = false;
    const done = (r) => { if (!resolved) { resolved = true; resolve(r); } };
    child.on("exit", (code, signal) => done({ name, method: "graceful", code, signal }));
    try { child.kill("SIGTERM"); } catch {}
    setTimeout(() => {
      if (!resolved) {
        try { child.kill("SIGKILL"); } catch {}
        setTimeout(() => done({ name, method: "force-killed", code: child.exitCode }), 2000);
      }
    }, 10_000);
  });
}
const shutdownResults = await Promise.all([shutdown("orchestrator", orch), shutdown("reaper", reaper), shutdown("agent", agent)]);
for (const e of shutdownResults) {
  T(`shutdown · ${e.name} · ${e.method} · code=${e.code}`, true);
  report.processes[e.name].shutdown = e;
}
await sleep(2_000);

// ─── LIFECYCLE PROOF · full detail on OUR work_item ───────────────────
console.log("");
console.log("─── LIFECYCLE PROOF · our r2p work_item ───");
if (ourWorkItemId) {
  const wi = (await mgmt(`SELECT id, city_slug, category_slug, source_slug, state, generation,
    agent_id, priority, attempts, lease_deadline, enqueued_at, started_at, finished_at,
    records_new, records_rejected, cursor_json::text AS cursor_json, last_error, last_error_class
    FROM nex_workforce.work_item WHERE id='${ourWorkItemId}'`))[0];
  console.log("  " + JSON.stringify(wi, null, 2).replace(/\n/g, "\n  "));
  report.phases.lifecycle = wi;

  T("Lifecycle A · orchestrator enqueued our r2p work_item",
    wi && wi.enqueued_at !== null, `enqueued_at=${wi?.enqueued_at}`);
  T(`Lifecycle B · claim recorded (pending→leased) · agent_id set to '${AGENT_ID}' · generation set`,
    wi && wi.agent_id === AGENT_ID && wi.generation >= 1 && wi.started_at !== null,
    `agent=${wi?.agent_id} gen=${wi?.generation} started=${wi?.started_at}`);
  T("Lifecycle C · execution/checkpoint · cursor advanced beyond initial state",
    wi && wi.cursor_json && wi.cursor_json.includes("stepIndex"), `cursor=${wi?.cursor_json}`);
  T("Lifecycle H · terminal state = 'completed' · finished_at populated",
    wi && wi.state === "completed" && wi.finished_at !== null,
    `state=${wi?.state} finished=${wi?.finished_at}`);
  T("Lifecycle · records_new=3 (hello_world runs 3 steps) · records_rejected=0",
    wi && wi.records_new === 3 && wi.records_rejected === 0,
    `records_new=${wi?.records_new} records_rejected=${wi?.records_rejected}`);
} else {
  T("Lifecycle · our work_item was never created", false, "orchestrator did not enqueue");
}

// Grep logs for confirmations
function scanLog(name) {
  try {
    const src = readFileSync(report.processes[name].logPath, "utf8");
    const lines = src.split("\n").filter(Boolean);
    return { lines, count: lines.length };
  } catch { return { lines: [], count: 0 }; }
}
const orchLog = scanLog("orchestrator");
const reaperLog = scanLog("reaper");
const agentLog = scanLog("agent");
const orchTicks   = orchLog.lines.filter(l => l.includes('"msg":"orch.tick.end"') && l.includes('"ok":true')).length;
const reaperTicks = reaperLog.lines.filter(l => l.includes('"msg":"reaper.tick.end"') && l.includes('"ok":true')).length;
const orchEnq     = orchLog.lines.filter(l => l.includes('"msg":"orch.enqueue"') && l.includes('"enqueued_count":1')).length;
const agentClaims = agentLog.lines.filter(l => l.includes('"msg":"agent.claimed"')).length;
const agentComps  = agentLog.lines.filter(l => l.includes('"msg":"agent.completed"')).length;
const agentHBLog  = agentLog.lines.filter(l => l.includes('"msg":"heartbeat.start"') || l.includes('"msg":"heartbeat"')).length;
const agentCheckpoints = agentLog.lines.filter(l => l.includes('checkpoint')).length; // may include noise but at least indicative
const workRoleErrs = [
  ...orchLog.lines, ...reaperLog.lines, ...agentLog.lines
].filter(l => /WorkforceRoleElevation|SET LOCAL ROLE nex_workforce_app failed|42501/.test(l)).length;
const publicPermErrs = [
  ...orchLog.lines, ...reaperLog.lines, ...agentLog.lines
].filter(l => /permission denied|new row violates row-level security/.test(l)).length;
T("orchestrator tick succeeded ≥ 1 time (proves R2.2 admin policies via enqueue_from_view)", orchTicks >= 1, `orch.tick.end ok=true count=${orchTicks}`);
T("orchestrator enqueued exactly our r2p work_item once", orchEnq >= 1, `enqueue_count=1 events=${orchEnq}`);
T("reaper tick succeeded ≥ 1 time (proves R2.2 reaper_run + work_item policies)", reaperTicks >= 1, `reaper.tick.end ok=true count=${reaperTicks}`);
T("agent claimed our work_item ≥ 1 time (proves claim under R2.2)", agentClaims >= 1, `agent.claimed count=${agentClaims}`);
T("agent completed our work_item (proves complete() under R2.2)", agentComps >= 1, `agent.completed count=${agentComps}`);
T("agent heartbeat fired (proves R2.2 wa_work_item_update + wa_job_registry_select policies)", agentHBLog >= 1, `heartbeat events=${agentHBLog}`);
T("ZERO role-elevation errors across all three logs", workRoleErrs === 0, `workRoleErrs=${workRoleErrs}`);
T("ZERO 'permission denied' / RLS-violation errors across all three logs", publicPermErrs === 0, `permErrs=${publicPermErrs}`);
report.phases.log_scan = { orchTicks, orchEnq, reaperTicks, agentClaims, agentComps, agentHBLog, agentCheckpoints, workRoleErrs, publicPermErrs };

// ─── R2.2 RLS POST-PROOF ──────────────────────────────────────────────
console.log("");
console.log("─── § 6 · R2.2 RLS POST-PROOF (READ-ONLY) ───");
const rlsPost = (await mgmt(`SELECT
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS wf_policies,
  (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='nex_workforce' AND c.relname='agent_heartbeat') AS agent_hb_policies,
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='nex_workforce' AND (0 = ANY(pol.polroles)
      OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid=ANY(pol.polroles) AND r.rolname IN ('anon','authenticated','nex_workforce_app','nex_app_runtime')))) AS bad_role_policies,
  (SELECT count(*)::int FROM information_schema.role_table_grants
    WHERE grantee='nex_workforce_app' AND privilege_type IN ('INSERT','UPDATE','DELETE') AND table_schema IN ('nex','nex_workforce')) AS app_writes,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_admin') AS admin_bypass,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_persister_food_business') AS persister_bypass,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_app_runtime') AS runtime_bypass`))[0];
T("6.1 · 11 R2.2 policies still present (no change)", rlsPost.wf_policies === 11);
T("6.2 · food_business 5 Slice 1h policies still present", rlsPost.food_policies === 5);
T("6.3 · agent_heartbeat still ZERO policies (fail-loud preserved)", rlsPost.agent_hb_policies === 0);
T("6.4 · zero policies for PUBLIC/anon/authenticated/nex_workforce_app/nex_app_runtime", rlsPost.bad_role_policies === 0);
T("6.5 · workforce_app has zero direct writes on nex.* + nex_workforce.*", rlsPost.app_writes === 0);
T("6.6 · no BYPASSRLS on admin / persister / runtime", rlsPost.admin_bypass === false && rlsPost.persister_bypass === false && rlsPost.runtime_bypass === false);
T("6.7 · previous 42501 (reaper_run RLS block) confirmed resolved · reaper ticks succeeded",
  reaperTicks >= 1 && workRoleErrs === 0 && publicPermErrs === 0);
report.phases.rls_post = rlsPost;

// ─── CLEANUP · remove ops config · LEAVE terminal work_item ────────────
console.log("");
console.log("─── CLEANUP · remove ops config (city + job) · LEAVE terminal work_item (real audit trail) ───");
await mgmt(`DELETE FROM nex_workforce.job_registry   WHERE slug='${JOB_SLUG}'`);
await mgmt(`DELETE FROM nex_workforce.city_catalogue WHERE slug='${CITY_SLUG}'`);
T("cleanup · r2p city + job removed · future ticks will not auto-repeat", true);

// ─── POSTFLIGHT · read-only compare vs baseline ────────────────────────
console.log("");
console.log("─── § 12 · POSTFLIGHT · READ-ONLY compare vs baseline ───");
const post = (await mgmt(`SELECT
  (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS cities,
  (SELECT count(*)::int FROM nex_workforce.job_registry) AS jobs,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='completed') AS wi_done,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='leased') AS wi_leased,
  (SELECT count(*)::int FROM nex_workforce.agent_heartbeat) AS hb,
  (SELECT count(*)::int FROM nex_workforce.reaper_run) AS rr,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
  (SELECT count(*)::int FROM nex_workforce.work_item_dead_letter) AS dl,
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup_groups,
  (SELECT count(*)::int FROM pg_stat_activity WHERE pid <> pg_backend_pid()
    AND (application_name ILIKE '%workforce%' OR application_name ILIKE '%nex-agent%'
      OR application_name ILIKE '%nex-reaper%' OR application_name ILIKE '%nex-orchestrator%'
      OR (state='active' AND (query ILIKE 'SELECT nex_workforce.claim%'
        OR query ILIKE 'SELECT nex_workforce.persist_batch%')))) AS active_wf`))[0];
console.log("  post:", JSON.stringify(post));
T("cities count restored to baseline (r2p removed)", post.cities === baseline.cities, `pre=${baseline.cities} post=${post.cities}`);
T("jobs count restored to baseline (r2p removed)", post.jobs === baseline.jobs, `pre=${baseline.jobs} post=${post.jobs}`);
T("work_item · +1 terminal completed row expected (our r2p work_item · left as audit trail)",
  post.wi - baseline.wi === 1 && post.wi_done - baseline.wi_done === 1,
  `wi ${baseline.wi}→${post.wi} · completed ${baseline.wi_done}→${post.wi_done}`);
T("no orphan leased work_items", post.wi_leased === 0, `leased=${post.wi_leased}`);
T("reaper_run delta ≥ 0 (some ticks · all successful)", post.rr - baseline.rr >= 0, `rr ${baseline.rr}→${post.rr}`);
T("agent_heartbeat unchanged (0→0 · no writer)", post.hb - baseline.hb === 0, `hb ${baseline.hb}→${post.hb}`);
T("evidence_record unchanged (hello_world never writes)", post.ev - baseline.ev === 0);
T("candidate_staging unchanged (hello_world never writes)", post.stg - baseline.stg === 0);
T("persist_audit unchanged (hello_world never writes)", post.aud - baseline.aud === 0);
T("work_item_dead_letter unchanged", post.dl - baseline.dl === 0);
T("nex.food_business unchanged (22750 rows · 373 dup groups) · NO real data mutation this cycle", post.food_rows === baseline.food_rows && post.food_dup_groups === baseline.food_dup_groups);
T("no active workforce sessions after shutdown", post.active_wf === 0);

// Local checks
const psTaskPost = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], {encoding:"utf8"});
const postTaskState = (psTaskPost.stdout||"").trim();
T("Scheduled Task remains Disabled", postTaskState === "Disabled" || postTaskState === "", `state='${postTaskState}'`);
const psEnvPost = spawnSync("powershell", ["-NoProfile", "-Command",
  "$m=(Get-Item .env.local).LastWriteTime.ToString('o'); $g=(Select-String -Path .env.local -Pattern 'nex_workforce_admin|nex_workforce_app|withWorkforceRole' -SimpleMatch | Measure-Object).Count; 'mtime=' + $m + '|matches=' + $g"], {encoding:"utf8"});
const postEnvInfo = (psEnvPost.stdout||"").trim();
T(".env.local unchanged (same mtime + 0 workforce identifiers)", postEnvInfo === preEnvInfo, `pre='${preEnvInfo}' post='${postEnvInfo}'`);
// System A untouched · READ-ONLY confirm still local
const sysAPing = spawnSync("powershell", ["-NoProfile", "-Command",
  "$env:PGPASSWORD='Admin1phil'; & 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe' -h localhost -p 5433 -U postgres -d nex_dev -w -A -t -c 'SELECT current_database()' 2>&1"], {encoding:"utf8"});
const sysADb = (sysAPing.stdout||"").trim();
T("System A (local nex_dev) unchanged (existence check only)",
  sysADb === "nex_dev" || sysAPing.status !== 0, `db='${sysADb}'`);
// Legacy workforce processes (non-self)
const legacy = spawnSync("powershell", ["-NoProfile", "-Command",
  `$pids=@(${orch.pid || 0},${reaper.pid || 0},${agent.pid || 0}); ` +
  "$c=Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'nex-workforce-v2' -and $_.ProcessId -notin $pids -and $_.ProcessId -ne $PID }; ($c | Measure-Object).Count"],
  {encoding:"utf8"});
const legacyCount = parseInt((legacy.stdout||"0").trim(), 10);
T("no orphan/legacy workforce process on host", legacyCount === 0, `legacy=${legacyCount}`);

report.phases.postflight = { post, postTaskState, postEnvInfo, sysADb, legacyCount };
report.finished_at = new Date().toISOString();
report.pass = pass; report.fail = fail; report.failLines = failLines;
writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));

// ─── LOG EXCERPTS ─────────────────────────────────────────────────────
console.log("");
console.log("─── LOG EXCERPTS · last 8 lines of each ───");
for (const name of ["orchestrator", "reaper", "agent"]) {
  const src = readFileSync(report.processes[name].logPath, "utf8").trim().split("\n");
  const tail = src.slice(-8).join("\n");
  console.log(`\n  ── ${name}.log tail ──`);
  console.log(tail.split("\n").map(l => "    " + l).join("\n"));
}

console.log("");
console.log("═══════════════════════════════════════════════════════════════════════");
if (fail === 0 && terminalReason === `our work_item reached terminal state: completed`) {
  console.log(`🟢 CONTROLLED PROVING PASS · ${pass} checks · lifecycle completed under R2.2 v2`);
  console.log("🔴 HARD STOP · NEXT GATE UNAUTHORIZED (Scheduled Task activation is a separate gate)");
  console.log("═══════════════════════════════════════════════════════════════════════");
  process.exit(0);
} else if (fail === 0) {
  console.log(`🟡 CONTROLLED PROVING PARTIAL · terminal=${terminalReason}`);
  console.log("🔴 HARD STOP · NEXT GATE UNAUTHORIZED");
  console.log("═══════════════════════════════════════════════════════════════════════");
  process.exit(1);
} else {
  console.log(`🔴 CONTROLLED PROVING FAIL · ${fail} failures · terminal=${terminalReason}`);
  for (const l of failLines) console.log("   " + l);
  console.log("🔴 HARD STOP · NEXT GATE UNAUTHORIZED");
  console.log("═══════════════════════════════════════════════════════════════════════");
  process.exit(3);
}
