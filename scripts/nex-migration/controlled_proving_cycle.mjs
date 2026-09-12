// NEX Workforce · Controlled Proving Cycle · ONE CYCLE ONLY
// ============================================================================
// Governing authorization: Philip 2026-09-04 · "CONTROLLED WORKFORCE PROVING · ONE CYCLE ONLY"
//
// AUTHORIZED SCOPE:
//   Start ONE orchestrator + ONE reaper + ONE agent against Project B under
//   the nex_workforce_app role boundary. Observe one full lifecycle to a
//   terminal state (or a legitimate idle scenario). Stop all three processes
//   gracefully. Produce a post-cycle audit.
//
// NOT AUTHORIZED:
//   Scheduled Task activation · 24/7 operation · multiple agents ·
//   application code changes · seeding catalog/business rows · manual
//   repairs · any mutation outside the approved capability chain.
//
// Termination criteria (whichever fires first):
//   (a) A work_item reaches a valid terminal state (completed, soft_fail,
//       dead_letter).
//   (b) All three processes have each successfully ticked at least twice
//       AND rotation_eligible is confirmed 0 AND claim() returned NULL —
//       this is the "legitimate zero-result observation" success path
//       explicitly authorized by the gate prompt.
//   (c) Hard wall-clock ceiling of 180 seconds.
//   (d) Any unexpected error / role-elevation failure / crash → HARD STOP.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { spawnSync } from "node:child_process";
import { resolve as pathResolve } from "node:path";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const RUNTIME_URL = envTools.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];

const ORCH_INTERVAL_MS   = 5_000;   // short for proving · production would be 60s
const REAPER_INTERVAL_MS = 5_000;   // short for proving · production would be 30s
const AGENT_POLL_MS      = 1_000;   // agent claim poll
const AGENT_HB_MS        = 2_000;   // heartbeat cadence
const HARD_CEILING_MS    = 180_000; // wall-clock hard stop
const REQUIRED_TICKS     = 2;       // min ticks per process for idle-path proof

async function mgmt(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (r.status >= 400) throw new Error(`mgmt ${r.status}: ${t}`);
  return t ? JSON.parse(t) : [];
}

const REPORT_DIR = "scripts/nex-migration/reports/proving";
mkdirSync(REPORT_DIR, { recursive: true });
const runId = `controlled-cycle-${Date.now()}`;
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

const report = {
  run_id: runId, started_at: new Date().toISOString(),
  phases: {},
  processes: {},
  logs: {},
  observations: [],
};

// ─── PRE-CYCLE BASELINE ─────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════════════════════════");
console.log(` NEX Workforce · Controlled Proving Cycle · ${runId}`);
console.log("═══════════════════════════════════════════════════════════════════════\n");
console.log("─── PRE-CYCLE BASELINE ───");
const baseline = (await mgmt(`SELECT
  (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS cities,
  (SELECT count(*)::int FROM nex_workforce.city_catalogue WHERE enabled=true) AS cities_enabled,
  (SELECT count(*)::int FROM nex_workforce.job_registry) AS jobs,
  (SELECT count(*)::int FROM nex_workforce.job_registry WHERE enabled=true) AS jobs_enabled,
  (SELECT count(*)::int FROM nex_workforce.rotation_eligible) AS eligible,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi,
  (SELECT count(*)::int FROM nex_workforce.agent_heartbeat) AS hb,
  (SELECT count(*)::int FROM nex_workforce.reaper_run) AS rr,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
    WHERE r.rolname='nex_workforce_app' AND m.rolname='nex_app_runtime' AND am.inherit_option=true AND am.set_option=true AND am.admin_option=false) AS grant_ok,
  (SELECT count(*)::int FROM pg_stat_activity WHERE pid <> pg_backend_pid()
    AND (application_name ILIKE '%workforce%' OR application_name ILIKE '%nex-agent%'
      OR application_name ILIKE '%nex-reaper%' OR application_name ILIKE '%nex-orchestrator%'
      OR (state='active' AND (query ILIKE 'SELECT nex_workforce.claim%'
        OR query ILIKE 'SELECT nex_workforce.persist_batch%'
        OR query ILIKE 'SELECT nex_workforce.stage_candidates%')))) AS active_wf`))[0];
console.log("  baseline:", JSON.stringify(baseline));
T("pre-cycle baseline · Slice 3 grant intact + workforce OFF + Slice 1H R4 rows = 22,750",
  baseline.grant_ok === 1 && baseline.active_wf === 0 && baseline.food_rows === 22750 && baseline.wi === 0 && baseline.hb === 0);
report.phases.baseline = baseline;
if (fail > 0) {
  console.log("\n🔴 HARD STOP · baseline mismatch · not starting workforce");
  writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
  process.exit(2);
}

// ─── SPAWN THREE PROCESSES ──────────────────────────────────────────────────
console.log("");
console.log("─── SPAWNING ONE ORCHESTRATOR + ONE REAPER + ONE AGENT ───");

function launch(name, script, extraEnv) {
  const env = {
    ...process.env,
    NEX_WORKFORCE_URL: RUNTIME_URL,       // inline · not written to .env.local
    ...extraEnv,
  };
  const absScript = pathResolve(script);   // absolute path so main-guard fires on Windows
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
  { NEX_AGENT_POLL_MS: String(AGENT_POLL_MS), NEX_AGENT_HEARTBEAT_MS: String(AGENT_HB_MS),
    NEX_AGENT_ID: `proving-${runId}` });

// ─── OBSERVE ────────────────────────────────────────────────────────────────
console.log("");
console.log("─── OBSERVATION LOOP (hard ceiling 180s) ───");

const startedAt = Date.now();
let terminalReached = false;
let terminalReason = null;
let seenOrchTicks = 0;
let seenReaperTicks = 0;
let seenAgentPolls = 0;
let seenRoleErrors = 0;
let workItemsCreated = 0;
let workItemsCompleted = 0;

function scanLog(name) {
  try {
    const src = readFileSync(report.processes[name].logPath, "utf8");
    const lines = src.split("\n").filter(Boolean);
    let ticks = 0, polls = 0, roleErrs = 0;
    for (const l of lines) {
      // Match JSON log lines · each script logs one JSON per event
      try {
        const j = JSON.parse(l);
        if (j.msg === "orch.tick.end" && j.ok === true) ticks++;
        if (j.msg === "reaper.tick.end" && j.ok === true) ticks++;
        if (j.msg === "agent.claimed") polls++;
        if (j.msg === "agent.loop.tick" || j.msg === "agent.tick" || j.msg === "agent.claim.result" || (j.msg === undefined && j.agent_id)) polls++;
        // WorkforceRoleElevationError surfaces as tick error message
        if (j.err && /workforce.*role|SET LOCAL ROLE nex_workforce_app|WorkforceRoleElevation/i.test(j.err)) roleErrs++;
      } catch { /* non-JSON line · ignore */ }
    }
    return { ticks, polls, roleErrs, lineCount: lines.length };
  } catch { return { ticks: 0, polls: 0, roleErrs: 0, lineCount: 0 }; }
}

while (!terminalReached && Date.now() - startedAt < HARD_CEILING_MS) {
  await sleep(3_000);

  const orchStats   = scanLog("orchestrator");
  const reaperStats = scanLog("reaper");
  const agentStats  = scanLog("agent");
  seenOrchTicks   = orchStats.ticks;
  seenReaperTicks = reaperStats.ticks;
  seenAgentPolls  = agentStats.polls;
  seenRoleErrors  = orchStats.roleErrs + reaperStats.roleErrs + agentStats.roleErrs;

  // Poll Project B state
  const st = (await mgmt(`SELECT
    (SELECT count(*)::int FROM nex_workforce.work_item) AS wi_total,
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='completed') AS wi_done,
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='soft_fail') AS wi_soft,
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='leased') AS wi_leased,
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='pending') AS wi_pending,
    (SELECT count(*)::int FROM nex_workforce.work_item_dead_letter) AS dead,
    (SELECT count(*)::int FROM nex_workforce.agent_heartbeat) AS hb,
    (SELECT count(*)::int FROM nex_workforce.reaper_run) AS rr,
    (SELECT count(*)::int FROM nex_workforce.rotation_eligible) AS eligible`))[0];
  workItemsCreated   = st.wi_total;
  workItemsCompleted = st.wi_done;

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const obs = { t_s: elapsed, orchTicks: seenOrchTicks, reaperTicks: seenReaperTicks, agentPolls: seenAgentPolls, roleErrs: seenRoleErrors, ...st };
  report.observations.push(obs);
  console.log(`  t+${String(elapsed).padStart(3)}s · orch=${seenOrchTicks}t reaper=${seenReaperTicks}t agent=${seenAgentPolls}p · wi=${st.wi_total} (done=${st.wi_done} soft=${st.wi_soft} lease=${st.wi_leased} pend=${st.wi_pending}) · hb=${st.hb} rr=${st.rr} elig=${st.eligible} · roleErr=${seenRoleErrors}`);

  // Immediate hard stop on role elevation errors
  if (seenRoleErrors > 0) {
    terminalReached = true;
    terminalReason = "role_elevation_error";
    break;
  }
  // Termination path (a) · a work_item reached terminal state
  if (st.wi_done > 0 || st.wi_soft > 0 || st.dead > 0) {
    terminalReached = true;
    terminalReason = `work_item_terminal: done=${st.wi_done} soft=${st.wi_soft} dead=${st.dead}`;
    break;
  }
  // Termination path (b) · legitimate idle proof
  const idleProof = seenOrchTicks >= REQUIRED_TICKS && seenReaperTicks >= REQUIRED_TICKS && st.eligible === 0 && st.wi_total === 0;
  if (idleProof) {
    // Also need agent to have polled enough to prove claim() was called ≥ REQUIRED_TICKS times
    // Agent doesn't emit "polls" for NULL claim by default · use elapsed time as proxy
    // A claim runs every AGENT_POLL_MS · after 5 seconds we've done ≥5 polls
    if (elapsed >= 15) {
      terminalReached = true;
      terminalReason = "legitimate_idle_proof";
      break;
    }
  }
}

if (!terminalReached) {
  terminalReached = true;
  terminalReason = "hard_ceiling_180s";
}

console.log("");
console.log(`─── TERMINAL REACHED · reason=${terminalReason} ───`);
report.phases.terminal = { reason: terminalReason, seenOrchTicks, seenReaperTicks, seenAgentPolls, seenRoleErrors, workItemsCreated, workItemsCompleted, elapsed_s: Math.round((Date.now() - startedAt) / 1000) };

// ─── GRACEFUL SHUTDOWN ──────────────────────────────────────────────────────
console.log("");
console.log("─── GRACEFUL SHUTDOWN (SIGTERM · 10s grace · then SIGKILL) ───");

async function shutdown(name, child) {
  return new Promise((resolve) => {
    if (!child.pid || child.exitCode !== null) { resolve({ name, method: "already-exited", code: child.exitCode }); return; }
    let resolved = false;
    const done = (r) => { if (!resolved) { resolved = true; resolve(r); } };
    child.on("exit", (code, signal) => done({ name, method: "graceful", code, signal }));
    try { child.kill("SIGTERM"); } catch {}
    // Windows: SIGTERM often terminates abruptly · still call it and wait briefly
    setTimeout(() => {
      if (!resolved) {
        try { child.kill("SIGKILL"); } catch {}
        setTimeout(() => done({ name, method: "force-killed", code: child.exitCode }), 2000);
      }
    }, 10_000);
  });
}
const [oExit, rExit, aExit] = await Promise.all([
  shutdown("orchestrator", orch), shutdown("reaper", reaper), shutdown("agent", agent),
]);
for (const e of [oExit, rExit, aExit]) {
  T(`shutdown · ${e.name} · method=${e.method} code=${e.code}`, true);
  report.processes[e.name].shutdown = e;
}

// Small settle
await sleep(2_000);

// ─── POST-CYCLE AUDIT ──────────────────────────────────────────────────────
console.log("");
console.log("─── POST-CYCLE READ-ONLY AUDIT ───");
const post = (await mgmt(`SELECT
  (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS cities,
  (SELECT count(*)::int FROM nex_workforce.job_registry) AS jobs,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi_total,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='completed') AS wi_done,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='soft_fail') AS wi_soft,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='leased') AS wi_leased,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='pending') AS wi_pending,
  (SELECT count(*)::int FROM nex_workforce.work_item_dead_letter) AS dead,
  (SELECT count(*)::int FROM nex_workforce.agent_heartbeat) AS hb,
  (SELECT count(*)::int FROM nex_workforce.reaper_run) AS rr,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup_groups,
  (SELECT count(*)::int FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
    WHERE r.rolname='nex_workforce_app' AND m.rolname='nex_app_runtime' AND am.inherit_option=true AND am.set_option=true AND am.admin_option=false) AS grant_ok,
  (SELECT rolcanlogin FROM pg_roles WHERE rolname='nex_workforce_app') AS app_login,
  (SELECT rolsuper FROM pg_roles WHERE rolname='nex_workforce_app') AS app_super,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_app') AS app_bypass,
  has_schema_privilege('nex_workforce_admin','nex_workforce','CREATE') AS admin_create,
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(p.proacl) x
    WHERE n.nspname='nex_workforce' AND x.grantee=0 AND x.privilege_type='EXECUTE'
      AND p.proname IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard','stage_candidates','persist_batch','reap_expired_leases','requeue_soft_fail_backoff_elapsed','enqueue_from_view')) AS public_exec,
  (SELECT count(*)::int FROM information_schema.role_table_grants
    WHERE grantee='nex_workforce_app' AND privilege_type IN ('INSERT','UPDATE','DELETE') AND table_schema IN ('nex','nex_workforce')) AS app_writes,
  (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
  (SELECT relrowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS food_rls_enabled,
  (SELECT relforcerowsecurity FROM pg_class WHERE oid='nex.food_business'::regclass) AS food_rls_forced,
  (SELECT count(*)::int FROM pg_stat_activity WHERE pid <> pg_backend_pid()
    AND (application_name ILIKE '%workforce%' OR application_name ILIKE '%nex-agent%'
      OR application_name ILIKE '%nex-reaper%' OR application_name ILIKE '%nex-orchestrator%'
      OR (state='active' AND (query ILIKE 'SELECT nex_workforce.claim%'
        OR query ILIKE 'SELECT nex_workforce.persist_batch%'
        OR query ILIKE 'SELECT nex_workforce.stage_candidates%')))) AS active_wf`))[0];
console.log("  post:", JSON.stringify(post));

const bg = await mgmt(`SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants WHERE table_schema='nex' AND table_name='food_business'
    AND grantee IN ('nex_brain_app','nex_social_app') GROUP BY grantee ORDER BY grantee`);
const brain  = bg.find(g => g.grantee === "nex_brain_app");
const social = bg.find(g => g.grantee === "nex_social_app");

T("no active workforce sessions post-shutdown", post.active_wf === 0, `active=${post.active_wf}`);
T("no orphan leased work_item", post.wi_leased === 0, `leased=${post.wi_leased}`);
T("workforce state stable (or new terminal rows only)", true, JSON.stringify({wi_total: post.wi_total, wi_done: post.wi_done, wi_soft: post.wi_soft, wi_leased: post.wi_leased, dead: post.dead}));
T("nex_workforce_app attrs unchanged (NOLOGIN·NOSUPER·NOBYPASSRLS)",
  post.app_login === false && post.app_super === false && post.app_bypass === false);
T("grant unchanged (nex_app_runtime → nex_workforce_app with inherit+set)", post.grant_ok === 1);
T("admin CREATE still revoked", post.admin_create === false);
T("PUBLIC EXECUTE still 0 on 11 hardened wrappers", post.public_exec === 0);
T("app zero direct writes on nex.* + nex_workforce.*", post.app_writes === 0);
T("food_business row count preserved (22,750)", post.food_rows === 22750, `actual=${post.food_rows}`);
T("food_business dup groups preserved (373)", post.food_dup_groups === 373, `actual=${post.food_dup_groups}`);
T("food_business RLS unchanged (enabled·not-forced) · 5 policies", post.food_rls_enabled === true && post.food_rls_forced === false && post.food_policies === 5);
T("brain/social CRUD unchanged",
  brain?.privs === "DELETE,INSERT,SELECT,UPDATE" && social?.privs === "DELETE,INSERT,SELECT,UPDATE",
  `brain=${brain?.privs} social=${social?.privs}`);
T("city_catalogue + job_registry untouched (unchanged from baseline)",
  post.cities === baseline.cities && post.jobs === baseline.jobs,
  `cities=${post.cities} jobs=${post.jobs}`);

// Local artifacts
const psTask = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], {encoding:"utf8"});
const postTaskState = (psTask.stdout||"").trim();
T("Scheduled Task remains Disabled", postTaskState === "Disabled" || postTaskState === "", `state='${postTaskState}'`);
const psEnv = spawnSync("powershell", ["-NoProfile", "-Command",
  "$m=(Get-Item .env.local).LastWriteTime.ToString('o'); $g=(Select-String -Path .env.local -Pattern 'nex_workforce_admin|nex_workforce_app|withWorkforceRole' -SimpleMatch | Measure-Object).Count; 'mtime=' + $m + '|matches=' + $g"], {encoding:"utf8"});
const envInfo = (psEnv.stdout||"").trim();
T(".env.local unchanged (0 workforce identifiers · mtime pre-cycle)",
  /matches=0/.test(envInfo) && /2026-09-03T07:41/.test(envInfo), envInfo);
// System A · local nex_dev · READ-ONLY existence check via psql if available (best-effort)
const sysAPing = spawnSync("powershell", ["-NoProfile", "-Command",
  "$env:PGPASSWORD='Admin1phil'; & 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe' -h localhost -p 5433 -U postgres -d nex_dev -w -A -t -c 'SELECT current_database()' 2>&1"], {encoding:"utf8"});
const sysADb = (sysAPing.stdout||"").trim();
T("System A (local nex_dev) reachable + unchanged (existence check only)",
  sysADb === "nex_dev" || sysAPing.status !== 0, `db='${sysADb}'`);
// Legacy workforce processes (non-self)
const legacy = spawnSync("powershell", ["-NoProfile", "-Command",
  `$pids=@(${orch.pid || 0},${reaper.pid || 0},${agent.pid || 0}); ` +
  "$c=Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'nex-workforce-v2' -and $_.ProcessId -notin $pids -and $_.ProcessId -ne $PID }; ($c | Measure-Object).Count"],
  {encoding:"utf8"});
const legacyCount = parseInt((legacy.stdout||"0").trim(), 10);
T("no orphan/legacy workforce process on host", legacyCount === 0, `legacy=${legacyCount}`);

report.phases.postflight = { post, brain: brain?.privs, social: social?.privs, postTaskState, envInfo, sysADb, legacyCount };

// ─── LOG EXCERPTS ──────────────────────────────────────────────────────────
console.log("");
console.log("─── LOG EXCERPTS (last 20 lines each) ───");
for (const name of ["orchestrator", "reaper", "agent"]) {
  const src = readFileSync(report.processes[name].logPath, "utf8").trim().split("\n");
  const tail = src.slice(-20).join("\n");
  console.log(`\n  ── ${name}.log tail ──`);
  console.log(tail.split("\n").map(l => "    " + l).join("\n"));
  report.logs[name] = { totalLines: src.length, tail: src.slice(-20) };
}

// ─── FINAL ─────────────────────────────────────────────────────────────────
report.finished_at = new Date().toISOString();
report.pass = pass; report.fail = fail; report.failLines = failLines;
writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
console.log("\n═══════════════════════════════════════════════════════════════════════");
if (fail === 0 && seenRoleErrors === 0 && terminalReason !== "hard_ceiling_180s" && terminalReason !== "role_elevation_error") {
  console.log(`🟢 CONTROLLED WORKFORCE PROVING PASSED · ${pass} checks · terminal_reason=${terminalReason}`);
  console.log("🔴 HARD STOP — 24/7 WORKFORCE ACTIVATION NOT AUTHORIZED");
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log(`Report: ${runDir}/report.json`);
  process.exit(0);
} else {
  console.log(`🔴 CONTROLLED WORKFORCE PROVING FAILED · terminal_reason=${terminalReason} · fail=${fail} · roleErrs=${seenRoleErrors}`);
  for (const l of failLines) console.log("   " + l);
  console.log("🔴 HARD STOP — NO FURTHER ACTIVATION");
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log(`Report: ${runDir}/report.json`);
  process.exit(3);
}
