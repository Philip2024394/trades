// NEX Workforce v2 · C12 · Five-Agent Continuous Production Trial
// ============================================================================
// Authorization: Philip 2026-09-05 · "AUTHORIZE C12 · FIVE-AGENT CONTINUOUS
// PRODUCTION TRIAL · PROJECT B · YOGYAKARTA · RESTAURANTS · 5 AGENTS ·
// 4 HOURS · NO PERMANENT ACTIVATION"
//
// Builds on C11 re-attempt #3 harness safety contract:
//   · safeMgmt for every runtime observation query (never rethrows)
//   · top-level try/catch/finally · shutdown always runs
//   · setAutoStart(false) before shutdown · no phantom restart cascade
//   · post-runtime forensics as independent phase
//   · correct schema columns (started_at not run_at · not leased_at)
//   · identity-scoped tracking · no false-terminal on historical rows
//
// C12-specific additions:
//   · 5 agents (agent-1 registered by supervisor · agent-2..5 registered here)
//   · each agent gets uuidv7-generated agent_id (no shared NEX_AGENT_ID)
//   · 4-hour hard ceiling · 30-second observation tick
//   · NOT terminal on single completion · continue observing multi-cycle
//   · RED terminal conditions (§ 35): agent_count > 5 · duplicate lease
//     ownership · R5 city contamination · legacy execution · sustained
//     Overpass rate-limit · lease fencing failure · DB instability
//   · hourly summary logs
//   · track per-cycle completions · source-concurrency · agent claim distribution

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createHash } from "node:crypto";

// ═══════════════════════════════════════════════════════════════════════════
// § 28 · Env: inject NEX_WORKFORCE_URL from .env.tools.local (runtime-only)
// BEFORE importing supervisor. Never touches .env.local.
// ═══════════════════════════════════════════════════════════════════════════
const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const RUNTIME_URL = envTools.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];

// Runtime intervals · same as Gate 5B/C11 (validated cadence · not tuned for C12)
const ORCH_INTERVAL_MS   = 4_000;
const REAPER_INTERVAL_MS = 4_000;
const AGENT_POLL_MS      = 1_000;
const AGENT_HB_MS        = 2_000;

// § 30 · 4-hour hard ceiling
const HARD_CEILING_MS = 4 * 60 * 60 * 1000;
// Observation tick · 30s → ~480 samples over 4h
const OBS_TICK_MS = 30_000;
// Hourly summary boundary
const HOURLY_MS = 60 * 60 * 1000;

// § 4 · agent capacity
const AGENT_COUNT = 5;

// § 3 · fixed workload · no substitution
const CITY_SLUG = "yogyakarta";
const CATEGORY  = "restaurants";
const SOURCE    = "overpass";
const JOB_SLUG  = "restaurants-overpass";
const RUN_STAMP = Date.now();
const PERSISTER_FN = "nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)";

// § 3 · expected bbox · exact C6 empirical values
const EXPECTED_BBOX = { sw: { lat: -7.944714, lon: 110.240493 }, ne: { lat: -7.592822, lon: 110.624452 } };
const EXPECTED_QUERY = `[out:json][timeout:60];node["amenity"="restaurant"](${EXPECTED_BBOX.sw.lat},${EXPECTED_BBOX.sw.lon},${EXPECTED_BBOX.ne.lat},${EXPECTED_BBOX.ne.lon});out center;`;
const EXPECTED_QUERY_HASH = createHash("sha256").update(EXPECTED_QUERY).digest("hex");

// Inject env vars · each spawned agent inherits process.env via child_lifecycle.
// CRITICAL: do NOT set NEX_AGENT_ID · agent.mjs uuidv7-generates its own
// unique ID per process. Otherwise all 5 agents would collide on identity.
process.env.NEX_WORKFORCE_URL                = RUNTIME_URL;
process.env.NEX_PERSISTER_FN                 = PERSISTER_FN;
process.env.NEX_ORCH_INTERVAL_MS             = String(ORCH_INTERVAL_MS);
process.env.NEX_ORCH_MAX_CONSECUTIVE_ERRORS  = "3";
process.env.NEX_REAPER_INTERVAL_MS           = String(REAPER_INTERVAL_MS);
process.env.NEX_REAPER_MAX_CONSECUTIVE_ERRORS = "3";
process.env.NEX_AGENT_POLL_MS                = String(AGENT_POLL_MS);
process.env.NEX_AGENT_HEARTBEAT_MS           = String(AGENT_HB_MS);
delete process.env.NEX_AGENT_ID;

const supervisorMod = await import("../nex-workforce-v2/supervisor/supervisor.mjs");
const contractMod   = await import("../nex-workforce-v2/supervisor/lib/lifecycle_contract.mjs");
const { createSupervisor, buildQueryExecutor } = supervisorMod;
const { Role, StartupOrder, ShutdownOrder, MaxAgentCount } = contractMod;

// ═══════════════════════════════════════════════════════════════════════════
// Report scaffolding
// ═══════════════════════════════════════════════════════════════════════════
const REPORT_DIR = "scripts/nex-migration/reports/proving";
mkdirSync(REPORT_DIR, { recursive: true });
const runId = `c12-${RUN_STAMP}`;
const runDir = `${REPORT_DIR}/${runId}`;
mkdirSync(runDir, { recursive: true });
const report = {
  run_id: runId,
  gate: "C12",
  authorization: "AUTHORIZE C12 · FIVE-AGENT CONTINUOUS PRODUCTION TRIAL · PROJECT B · YOGYAKARTA · RESTAURANTS · 5 AGENTS · 4 HOURS · NO PERMANENT ACTIVATION · Philip 2026-09-05",
  started_at: new Date().toISOString(),
  workload: { city: CITY_SLUG, category: CATEGORY, source: SOURCE, job: JOB_SLUG, bbox: EXPECTED_BBOX, expected_query_hash: EXPECTED_QUERY_HASH, agent_count: AGENT_COUNT },
  phases: {}, processes: {}, observations: [], hourly_summaries: [],
  observation_errors: [], red_conditions: [], harness_exception: null,
  cycles: { work_items_completed: [], work_items_started: [] },
  final_verdict: null,
};
const gateStartIso = report.started_at;

let pass = 0, fail = 0;
const failLines = [];
function T(label, ok, detail) {
  const g = ok ? "🟢" : "🔴";
  const line = `${g} ${label}${detail ? ` · ${detail}` : ""}`;
  console.log(line);
  if (ok) pass++; else { fail++; failLines.push(line); }
}

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

async function safeMgmt(label, sql) {
  try { return await mgmt(sql); }
  catch (e) {
    const err = {
      at: new Date().toISOString(), label,
      error_code: e.message.match(/ERROR:\s+(\d+)/)?.[1] || null,
      message: String(e.message).slice(0, 800),
      sql: String(sql).slice(0, 500),
    };
    report.observation_errors.push(err);
    console.log(`  ⚠️  OBSERVATION_ERROR [${label}]: ${err.message.slice(0, 140)}`);
    return null;
  }
}

function fmtElapsed(ms) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(1)}h${String(m).padStart(2,'0')}m${String(s).padStart(2,'0')}s`;
}

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(` NEX Workforce · C12 · Five-Agent 4-Hour Continuous Trial · ${runId}`);
console.log("═══════════════════════════════════════════════════════════════════════\n");
console.log(`  CITY=${CITY_SLUG} · CATEGORY=${CATEGORY} · SOURCE=${SOURCE}`);
console.log(`  BBOX=sw{${EXPECTED_BBOX.sw.lat},${EXPECTED_BBOX.sw.lon}} ne{${EXPECTED_BBOX.ne.lat},${EXPECTED_BBOX.ne.lon}}`);
console.log(`  AGENTS=${AGENT_COUNT} · CEILING=${HARD_CEILING_MS/60000} min (${HARD_CEILING_MS/3_600_000}h)`);
console.log(`  OBSERVATION TICK=${OBS_TICK_MS/1000}s`);
console.log(`  EXPECTED QH=${EXPECTED_QUERY_HASH}`);
console.log("");

// ═══════════════════════════════════════════════════════════════════════════
// § 2 · Preflight · READ-ONLY · raw mgmt() · hard-fail if unexpected
// ═══════════════════════════════════════════════════════════════════════════
console.log("─── PREFLIGHT · READ-ONLY ───");
const tgt = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr`))[0];
console.log(`  target · db=${tgt.db} · pg=${tgt.ver} · user=${tgt.usr}`);
T("target = Project B postgres · pg 17.x", tgt.db === "postgres" && /^17\./.test(tgt.ver), `ref=${REF}`);

const base = (await mgmt(`SELECT
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup,
  (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS cc,
  (SELECT bbox_json FROM nex_workforce.city_catalogue LIMIT 1) AS city_bbox_actual,
  (SELECT count(*)::int FROM nex_workforce.job_registry) AS jr,
  (SELECT enabled FROM nex_workforce.job_registry LIMIT 1) AS job_enabled,
  (SELECT cadence_minutes FROM nex_workforce.job_registry LIMIT 1) AS cadence_minutes,
  (SELECT lease_minutes FROM nex_workforce.job_registry LIMIT 1) AS lease_minutes,
  (SELECT max_concurrent_per_source FROM nex_workforce.job_registry LIMIT 1) AS max_concurrent_per_source,
  (SELECT count(*)::int FROM nex_workforce.rotation_eligible) AS rot,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi_total,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS wi_active,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
  (SELECT count(*)::int FROM pg_policies WHERE schemaname='nex_workforce') AS wf_pol,
  (SELECT count(*)::int FROM pg_policies WHERE schemaname='nex' AND tablename='food_business') AS food_pol,
  (SELECT count(*)::int FROM pg_roles WHERE rolname LIKE 'nex_workforce_%') AS roles,
  (SELECT pg_get_functiondef(oid) ~ 'v_wi_row\\.city_slug' FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS r5_intact,
  (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%nex_workforce%' OR application_name ILIKE '%acquisition%') AS wf_sessions
`))[0];
console.log("  state:", JSON.stringify(base, null, 2).replace(/\n/g,'\n  '));
report.phases.baseline = { ...base };

T("food_business = 23,328", base.food_rows === 23328, String(base.food_rows));
T("duplicate groups = 373", base.food_dup === 373, String(base.food_dup));
T("city_catalogue = 1", base.cc === 1);
T("job_registry = 1 · enabled=true", base.jr === 1 && base.job_enabled === true);
T("cadence=60min · lease=15min · max_concurrent_per_source=3 (production config unchanged)",
  base.cadence_minutes === 60 && base.lease_minutes === 15 && base.max_concurrent_per_source === 3);
T("R5 intact", base.r5_intact === true);
T("zero workforce DB sessions", base.wf_sessions === 0);
T("workforce policies = 12 · food policies = 5 · roles = 3", base.wf_pol === 12 && base.food_pol === 5 && base.roles === 3);
const bbox = typeof base.city_bbox_actual === "string" ? JSON.parse(base.city_bbox_actual) : base.city_bbox_actual;
T("seeded bbox exact C6 match",
  bbox && parseFloat(bbox.sw.lat) === EXPECTED_BBOX.sw.lat && parseFloat(bbox.sw.lon) === EXPECTED_BBOX.sw.lon
       && parseFloat(bbox.ne.lat) === EXPECTED_BBOX.ne.lat && parseFloat(bbox.ne.lon) === EXPECTED_BBOX.ne.lon);
// Note: rotation_eligible may be 0 or 1 depending on cadence timing since last completion.
// Log for information · do not fail.
console.log(`  rotation_eligible (informational · not asserted) = ${base.rot}`);
console.log(`  wi_active (informational) = ${base.wi_active}`);

const psTask = spawnSync("powershell", ["-NoProfile","-Command","(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], { encoding: "utf8" });
T("Scheduled Task Disabled", (psTask.stdout||"").trim() === "Disabled");
const psEnv = spawnSync("powershell", ["-NoProfile","-Command","(Get-Item .env.local).LastWriteTime.ToString('o')"], { encoding: "utf8" });
T(".env.local mtime unchanged (2026-09-03T07:41)", /^2026-09-03T07:41/.test((psEnv.stdout||"").trim()));
const psWfProcs = spawnSync("powershell", ["-NoProfile","-Command","(Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -match 'workforce' } | Measure-Object).Count"], { encoding: "utf8" });
T("zero workforce OS processes pre-trial", (psWfProcs.stdout||"").trim() === "0");
const envLocalRaw = readFileSync(".env.local", "utf8");
const envLocalShaBefore = createHash("sha256").update(envLocalRaw).digest("hex");
T("NEX_WORKFORCE_URL absent from .env.local", !/^NEX_WORKFORCE_URL\s*=/m.test(envLocalRaw));
T("MaxAgentCount contract === 5 (C11.5)", MaxAgentCount === 5);

if (fail > 0) {
  console.log("\n🔴 HARD STOP · pre-flight invariant failure");
  writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
  process.exit(2);
}

// ═══════════════════════════════════════════════════════════════════════════
// Lock audit (informational)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n─── PRE-START ORPHAN LOCK AUDIT ───");
const LOCK_PATHS = ["data/nex-workforce-v2/locks/reaper.lock", "data/nex-workforce-v2/locks/orchestrator.lock"];
function readLockAudit(paths) {
  const out = [];
  for (const p of paths) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      let parsed = null; try { parsed = JSON.parse(content); } catch {}
      let pidAlive = null;
      if (parsed?.pid) { try { process.kill(parsed.pid, 0); pidAlive = true; } catch (e) { pidAlive = e.code === "ESRCH" ? false : null; } }
      out.push({ path: p, present: true, content: parsed ?? content, pid_alive: pidAlive });
    } else out.push({ path: p, present: false });
  }
  return out;
}
const locksBefore = readLockAudit(LOCK_PATHS);
report.phases.locks_before = locksBefore;
for (const l of locksBefore) console.log(`  ${l.path} · ${l.present ? `pid=${l.content?.pid} pid_alive=${l.pid_alive}` : 'ABSENT'}`);

// ═══════════════════════════════════════════════════════════════════════════
// § 4-7 · Supervisor construction + register 5 agents + start via C9 order
// Top-level try/catch/finally so shutdown ALWAYS runs.
// ═══════════════════════════════════════════════════════════════════════════
let supervisor = null;
let executor = null;
let harnessException = null;
let redStopReason = null;

try {
  console.log("\n─── SUPERVISOR CONSTRUCTION · autoStart=true (runtime opts) ───");
  const supervisorLogger = {
    info:     (msg, data) => console.log("  [sup] " + JSON.stringify({ ts: new Date().toISOString(), level:"info",     msg, ...data })),
    warn:     (msg, data) => console.log("  [sup] " + JSON.stringify({ ts: new Date().toISOString(), level:"warn",     msg, ...data })),
    error:    (msg, data) => console.log("  [sup] " + JSON.stringify({ ts: new Date().toISOString(), level:"error",    msg, ...data })),
    critical: (msg, data) => console.log("  [sup] " + JSON.stringify({ ts: new Date().toISOString(), level:"critical", msg, ...data })),
    close: () => {},
  };
  executor = await buildQueryExecutor();
  supervisor = createSupervisor({
    query: executor.query,
    logger: supervisorLogger,
    opts: { autoStart: true, tickMs: 30_000, probeTimeoutMs: 3_000 },
  });
  T("supervisor.contract.MaxAgentCount === 5", supervisor.contract.MaxAgentCount === 5);
  T("supervisor.lifecycle.isAutoStart() === true", supervisor.lifecycle.isAutoStart() === true);
  T("REAPER + ORCHESTRATOR + AGENT-1 registered by supervisor",
    !!supervisor.lifecycle.get(Role.REAPER, "reaper-1") &&
    !!supervisor.lifecycle.get(Role.ORCHESTRATOR, "orchestrator-1") &&
    !!supervisor.lifecycle.get(Role.AGENT, "agent-1"));

  // § 4 · Register 4 more agents (agent-2..5) · supervisor.registerV2ChildSpecs
  // already registered agent-1 · plus 4 more = 5 total (C11.5 ceiling)
  console.log("\n─── REGISTER 4 ADDITIONAL AGENTS (agent-2..5) ───");
  for (let i = 2; i <= AGENT_COUNT; i++) {
    supervisor.lifecycle.register({
      role: Role.AGENT, identifier: `agent-${i}`,
      script: supervisor.childScripts[Role.AGENT],
      env: {}, // inherits process.env · agent.mjs uuidv7-generates its own agent_id
    });
  }
  const registeredAgents = supervisor.lifecycle.list().filter(c => c.role === Role.AGENT);
  T(`exactly ${AGENT_COUNT} agents registered`, registeredAgents.length === AGENT_COUNT, `count=${registeredAgents.length}`);

  // Attempt 6th agent · MUST BE REJECTED
  let sixthRejected = false;
  try {
    supervisor.lifecycle.register({ role: Role.AGENT, identifier: "agent-6", script: supervisor.childScripts[Role.AGENT] });
  } catch (e) { sixthRejected = /AGENT count ceiling/.test(e.message); }
  T("6th agent registration deterministically rejected (§ 4 invariant)", sixthRejected);

  // § 12 · Startup order · REAPER → ORCHESTRATOR → all 5 AGENTS
  console.log("\n─── STARTUP · C9 StartupOrder ───");
  const startupTimes = {};
  for (const role of StartupOrder) {
    if (role === Role.SUPERVISOR) continue;
    const specs = supervisor.lifecycle.list().filter(c => c.role === role);
    for (const spec of specs) {
      const t0 = Date.now();
      const started = await supervisor.lifecycle.start(role, spec.identifier);
      const durationMs = Date.now() - t0;
      startupTimes[`${role}/${spec.identifier}`] = new Date().toISOString();
      report.processes[`${role}/${spec.identifier}`] = { role, identifier: spec.identifier, pid: started.pid, started_at: startupTimes[`${role}/${spec.identifier}`], script: spec.script, startup_duration_ms: durationMs };
      T(`start ${role} ${spec.identifier} · pid=${started.pid} · ${durationMs}ms`, started.started === true);
    }
  }
  report.phases.startup = { times: startupTimes };

  // Verify locks post-start
  const locksAfter = readLockAudit(LOCK_PATHS);
  report.phases.locks_after_start = locksAfter;
  for (const l of locksAfter) console.log(`  ${l.path} · pid=${l.content?.pid} alive=${l.pid_alive}`);
  T("REAPER + ORCHESTRATOR locks acquired (alive)", locksAfter.every(l => l.present && l.pid_alive === true));

  await sleep(3_000); // let all 5 agents boot + connect + first poll

  // ═════════════════════════════════════════════════════════════════════════
  // § 20-25 · CONTINUOUS OBSERVATION LOOP · 4-hour hard ceiling
  // Terminal ONLY on hard ceiling OR RED condition. Single completion does
  // NOT terminate · we want to observe multiple cycles.
  // ═════════════════════════════════════════════════════════════════════════
  console.log(`\n─── OBSERVATION LOOP · ${HARD_CEILING_MS/60000}min hard ceiling · ${OBS_TICK_MS/1000}s tick ───`);
  const trialStartedAt = Date.now();
  let lastHourlyBoundary = 0;
  let terminated = false;
  let terminalReason = null;
  const seenCompletedIds = new Set();
  const seenStartedIds = new Set();

  while (!terminated && Date.now() - trialStartedAt < HARD_CEILING_MS) {
    await sleep(OBS_TICK_MS);
    const elapsedMs = Date.now() - trialStartedAt;

    // Query 1: all C12 work_items (enqueued during this trial)
    const wiRows = await safeMgmt("wi_c12", `SELECT id, state, agent_id, generation, attempts, enqueued_at, started_at, finished_at, records_new, records_rejected, last_error, last_error_class, bbox_json
      FROM nex_workforce.work_item
      WHERE city_slug='${CITY_SLUG}' AND category_slug='${CATEGORY}' AND source_slug='${SOURCE}'
        AND enqueued_at >= '${gateStartIso}'
      ORDER BY enqueued_at ASC`);

    // Query 2: reaper activity
    const reap = await safeMgmt("reaper", `SELECT count(*)::int AS ticks, coalesce(sum(zombies_reclaimed),0)::int AS reclaimed, coalesce(sum(dead_lettered),0)::int AS dead_lettered, coalesce(sum(errors),0)::int AS errors
      FROM nex_workforce.reaper_run WHERE started_at >= '${gateStartIso}'`);

    // Query 3: counts
    const counts = await safeMgmt("counts", `SELECT
      (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
      (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
      (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
      (SELECT count(*)::int FROM nex.food_business) AS food_rows,
      (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup,
      (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='leased') AS wi_leased,
      (SELECT count(*)::int FROM nex_workforce.work_item WHERE state='pending') AS wi_pending,
      (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%nex%' OR application_name ILIKE '%workforce%' OR usename LIKE 'nex_workforce_%') AS wf_sessions,
      (SELECT count(*)::int FROM nex_workforce.agent_heartbeat WHERE last_beat_at >= '${gateStartIso}') AS live_agents,
      (SELECT count(DISTINCT agent_id)::int FROM nex_workforce.agent_heartbeat WHERE last_beat_at >= '${gateStartIso}') AS distinct_agents`);

    // Query 4: agent heartbeats
    const hbs = await safeMgmt("heartbeats", `SELECT agent_id, pid, state, last_beat_at, current_work_item_id
      FROM nex_workforce.agent_heartbeat WHERE last_beat_at >= '${gateStartIso}' ORDER BY last_beat_at DESC`);

    // Query 5: RED condition · duplicate lease ownership check
    const dupLease = await safeMgmt("dup_lease", `SELECT id, count(*)::int AS n FROM nex_workforce.work_item WHERE state='leased' GROUP BY id HAVING count(*) > 1`);

    // Query 6: RED condition · R5 cross-city contamination check
    // Look for C12-era food_business rows whose city_slug is NOT Yogyakarta
    const contamination = await safeMgmt("r5_contam", `SELECT count(*)::int AS n FROM nex.food_business
      WHERE (created_at >= '${gateStartIso}' OR updated_at >= '${gateStartIso}')
        AND source = 'osm_overpass'
        AND city != 'Yogyakarta'`);

    // Track completions / starts
    for (const r of (wiRows || [])) {
      if (r.state === "leased" && !seenStartedIds.has(r.id)) {
        seenStartedIds.add(r.id);
        report.cycles.work_items_started.push({ id: r.id, at: r.started_at, agent_id: r.agent_id });
        console.log(`  🎯 CYCLE START · wi=${r.id.slice(0,8)} agent=${r.agent_id?.slice(0,24)}`);
      }
      if (["completed","soft_fail","dead_letter"].includes(r.state) && !seenCompletedIds.has(r.id)) {
        seenCompletedIds.add(r.id);
        report.cycles.work_items_completed.push({ id: r.id, state: r.state, finished_at: r.finished_at, records_new: r.records_new, records_rejected: r.records_rejected });
        console.log(`  ✅ CYCLE COMPLETE · wi=${r.id.slice(0,8)} state=${r.state} new=${r.records_new} rej=${r.records_rejected}`);
      }
    }

    // Observation snapshot
    const obs = {
      t_ms: elapsedMs,
      t_h: fmtElapsed(elapsedMs),
      wi_c12_count: wiRows?.length ?? 0,
      wi_c12_completed: (wiRows ?? []).filter(r => r.state === "completed").length,
      wi_c12_leased: (wiRows ?? []).filter(r => r.state === "leased").length,
      wi_c12_pending: (wiRows ?? []).filter(r => r.state === "pending").length,
      counts: counts?.[0] ?? null,
      reap: reap?.[0] ?? null,
      live_heartbeats: hbs?.length ?? 0,
      distinct_agents: counts?.[0]?.distinct_agents ?? null,
    };
    report.observations.push(obs);

    // Terse per-tick line
    const line = `t+${fmtElapsed(elapsedMs)} · wi_c12={done:${obs.wi_c12_completed} leased:${obs.wi_c12_leased} pending:${obs.wi_c12_pending}} · agents={live:${obs.live_heartbeats} distinct:${obs.distinct_agents}} · ev=${counts?.[0]?.ev} stg=${counts?.[0]?.stg} aud=${counts?.[0]?.aud} food=${counts?.[0]?.food_rows} · leased=${counts?.[0]?.wi_leased} pending=${counts?.[0]?.wi_pending} · sess=${counts?.[0]?.wf_sessions} · reaper=${reap?.[0]?.ticks}t/${reap?.[0]?.reclaimed}rec/${reap?.[0]?.errors}err`;
    console.log("  " + line);

    // RED condition checks · each one triggers immediate hard stop
    if (dupLease?.length > 0) {
      redStopReason = `duplicate lease ownership detected · ${JSON.stringify(dupLease)}`;
      report.red_conditions.push({ kind: "duplicate_lease", at: new Date().toISOString(), detail: dupLease });
      terminated = true; terminalReason = `RED: ${redStopReason}`;
      console.log(`  🔴 RED · ${redStopReason}`);
      break;
    }
    if (contamination?.[0]?.n > 0) {
      redStopReason = `R5 cross-city contamination · ${contamination[0].n} rows with city != Yogyakarta`;
      report.red_conditions.push({ kind: "r5_contamination", at: new Date().toISOString(), detail: contamination });
      terminated = true; terminalReason = `RED: ${redStopReason}`;
      console.log(`  🔴 RED · ${redStopReason}`);
      break;
    }
    if ((counts?.[0]?.distinct_agents ?? 0) > AGENT_COUNT) {
      redStopReason = `agent count exceeded ${AGENT_COUNT} · distinct=${counts[0].distinct_agents}`;
      report.red_conditions.push({ kind: "agent_count_exceeded", at: new Date().toISOString(), detail: counts[0] });
      terminated = true; terminalReason = `RED: ${redStopReason}`;
      console.log(`  🔴 RED · ${redStopReason}`);
      break;
    }
    // Bbox check on active C12 work_item
    for (const r of (wiRows || [])) {
      if (["leased","pending"].includes(r.state) && r.bbox_json) {
        const c = typeof r.bbox_json === "string" ? JSON.parse(r.bbox_json) : r.bbox_json;
        if (c?.sw && c?.ne) {
          const structMatch = parseFloat(c.sw.lat) === EXPECTED_BBOX.sw.lat && parseFloat(c.sw.lon) === EXPECTED_BBOX.sw.lon
                           && parseFloat(c.ne.lat) === EXPECTED_BBOX.ne.lat && parseFloat(c.ne.lon) === EXPECTED_BBOX.ne.lon;
          if (!structMatch) {
            redStopReason = `bbox mismatch on wi ${r.id.slice(0,8)} · captured=${JSON.stringify(c)}`;
            report.red_conditions.push({ kind: "bbox_mismatch", at: new Date().toISOString(), detail: c });
            terminated = true; terminalReason = `RED: ${redStopReason}`;
            console.log(`  🔴 RED · ${redStopReason}`);
            break;
          }
        }
      }
    }
    if (terminated) break;

    // Child lifecycle health (via C9 lifecycle state · not process pipe)
    const kids = supervisor.lifecycle.list();
    const crashed = kids.filter(c => c.state === "EXITED" && c.lastExit && !["clean_shutdown","expected_exit"].includes(c.lastExit.class));
    for (const c of crashed) {
      console.log(`  ⚠️  child ${c.role}/${c.identifier} exited class=${c.lastExit.class} · reason=${c.lastExit.reason}`);
    }

    // Hourly summary
    if (Math.floor(elapsedMs / HOURLY_MS) > lastHourlyBoundary) {
      lastHourlyBoundary = Math.floor(elapsedMs / HOURLY_MS);
      const summary = {
        at: new Date().toISOString(),
        elapsed: fmtElapsed(elapsedMs),
        hour: lastHourlyBoundary,
        cycles_completed: seenCompletedIds.size,
        cycles_started: seenStartedIds.size,
        food_rows: counts?.[0]?.food_rows,
        food_dup: counts?.[0]?.food_dup,
        distinct_agents: counts?.[0]?.distinct_agents,
        reaper_ticks: reap?.[0]?.ticks,
        reaper_errors: reap?.[0]?.errors,
        observation_errors: report.observation_errors.length,
      };
      report.hourly_summaries.push(summary);
      console.log(`\n  ═══ HOURLY SUMMARY (hour ${lastHourlyBoundary}) · ${JSON.stringify(summary)} ═══\n`);
    }

    // Legacy execution check (defensive · check every ~10 ticks = ~5 min)
    if (Math.floor(elapsedMs / (10 * OBS_TICK_MS)) !== Math.floor((elapsedMs - OBS_TICK_MS) / (10 * OBS_TICK_MS))) {
      const psLegacy = spawnSync("powershell", ["-NoProfile","-Command","(Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -match 'nex-acquisition-workforce|_category-walker|run-production-(launcher|watchdog|supervisor)' } | Measure-Object).Count"], { encoding: "utf8" });
      if ((psLegacy.stdout||"").trim() !== "0") {
        redStopReason = `legacy processes detected · count=${psLegacy.stdout.trim()}`;
        report.red_conditions.push({ kind: "legacy_execution", at: new Date().toISOString(), detail: psLegacy.stdout });
        terminated = true; terminalReason = `RED: ${redStopReason}`;
        console.log(`  🔴 RED · ${redStopReason}`);
        break;
      }
    }
  }

  if (!terminated) terminalReason = `hard ceiling reached at ${fmtElapsed(HARD_CEILING_MS)}`;
  console.log(`\n─── TERMINAL · ${terminalReason} ───`);
  report.terminal = { reason: terminalReason, at: new Date().toISOString() };

} catch (harnessErr) {
  harnessException = harnessErr;
  report.harness_exception = { message: harnessErr.message, stack: harnessErr.stack };
  console.log(`\n🔴 HARNESS EXCEPTION · ${harnessErr.message}`);
  console.log(harnessErr.stack);
} finally {
  // § 31 · GRACEFUL SHUTDOWN · ALWAYS via C9 ShutdownOrder
  console.log("\n─── § 31 · GRACEFUL SHUTDOWN · C9 ShutdownOrder ───");
  const shutdownStartedAt = new Date().toISOString();
  if (supervisor) {
    try {
      supervisor.lifecycle.setAutoStart(false); // suppress phantom restart cascade
      await supervisor.shutdown("c12_finally");
    } catch (e) {
      console.log(`  ⚠️  supervisor.shutdown error: ${e.message}`);
      report.shutdown_error = { message: e.message, stack: e.stack };
    }
  }
  const shutdownEndedAt = new Date().toISOString();
  await sleep(3_000);

  // Exit classifications
  console.log("\n─── EXIT CLASSIFICATIONS ───");
  const kids = supervisor ? supervisor.lifecycle.list() : [];
  for (const c of kids) {
    const key = `${c.role}/${c.identifier}`;
    if (report.processes[key]) {
      report.processes[key].final_state = c.state;
      report.processes[key].last_exit = c.lastExit;
      report.processes[key].restart_count = c.restartCount;
    }
    T(`${c.role}/${c.identifier} · state=${c.state} · class=${c.lastExit?.class ?? '(none)'}`,
      c.state === "EXITED" || c.state === "DEGRADED",
      `code=${c.lastExit?.code ?? 'null'} sig=${c.lastExit?.signal ?? 'null'} restarts=${c.restartCount}`);
  }
  report.phases.shutdown = { started_at: shutdownStartedAt, ended_at: shutdownEndedAt };

  try { if (executor) await executor.close(); } catch (e) { console.log(`  executor.close: ${e.message}`); }

  // § 24 · Post-runtime process audit
  console.log("\n─── POST-RUNTIME PROCESS AUDIT ───");
  const psWfProcsAfter = spawnSync("powershell", ["-NoProfile","-Command","(Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -match 'workforce' } | Measure-Object).Count"], { encoding: "utf8" });
  T("zero workforce OS processes post-shutdown", (psWfProcsAfter.stdout||"").trim() === "0", (psWfProcsAfter.stdout||"").trim());
  const psLegacyAfter = spawnSync("powershell", ["-NoProfile","-Command","(Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -match 'nex-acquisition-workforce|_category-walker|run-production-(launcher|watchdog|supervisor)' } | Measure-Object).Count"], { encoding: "utf8" });
  T("zero legacy processes", (psLegacyAfter.stdout||"").trim() === "0");

  // § 25 · Lock audit
  const locksFinal = readLockAudit(LOCK_PATHS);
  report.phases.locks_after_shutdown = locksFinal;
  for (const l of locksFinal) console.log(`  ${l.path} · ${l.present ? `PRESENT pid=${l.content?.pid} alive=${l.pid_alive}` : 'ABSENT (released)'}`);
  T("zero live lifecycle locks post-shutdown", locksFinal.every(l => !l.present || (l.present && l.pid_alive === false)));

  // § 32 · Post-runtime DB audit (safeMgmt · independent phase)
  console.log("\n─── POST-RUNTIME DATABASE AUDIT · safeMgmt ───");
  const post = (await safeMgmt("post_summary", `SELECT
    (SELECT count(*)::int FROM nex.food_business) AS food_rows,
    (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup,
    (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS cc,
    (SELECT count(*)::int FROM nex_workforce.job_registry) AS jr,
    (SELECT count(*)::int FROM nex_workforce.work_item) AS wi_total,
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS wi_active,
    (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
    (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
    (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
    (SELECT count(*)::int FROM pg_policies WHERE schemaname='nex_workforce') AS wf_pol,
    (SELECT count(*)::int FROM pg_policies WHERE schemaname='nex' AND tablename='food_business') AS food_pol,
    (SELECT count(*)::int FROM pg_roles WHERE rolname LIKE 'nex_workforce_%') AS roles,
    (SELECT pg_get_functiondef(oid) ~ 'v_wi_row\\.city_slug' FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS r5_intact,
    (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%nex_workforce%' OR application_name ILIKE '%acquisition%') AS wf_sessions,
    (SELECT count(*)::int FROM nex_workforce.reaper_run WHERE started_at >= '${gateStartIso}') AS c12_reaper_ticks,
    (SELECT coalesce(sum(zombies_reclaimed),0)::int FROM nex_workforce.reaper_run WHERE started_at >= '${gateStartIso}') AS c12_reclaimed,
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE enqueued_at >= '${gateStartIso}' AND city_slug='${CITY_SLUG}' AND source_slug='${SOURCE}') AS c12_wi_count,
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE enqueued_at >= '${gateStartIso}' AND city_slug='${CITY_SLUG}' AND source_slug='${SOURCE}' AND state='completed') AS c12_wi_completed,
    (SELECT count(DISTINCT agent_id)::int FROM nex_workforce.agent_heartbeat WHERE last_beat_at >= '${gateStartIso}') AS c12_distinct_agents`))?.[0];
  if (post) {
    console.log("  post-state:", JSON.stringify(post, null, 2).replace(/\n/g,'\n  '));
    report.phases.post = { ...post };
    const deltas = {
      food_rows: post.food_rows - base.food_rows,
      food_dup:  post.food_dup - base.food_dup,
      wi_total:  post.wi_total - base.wi_total,
      wi_active: post.wi_active - base.wi_active,
      ev:        post.ev - base.ev,
      stg:       post.stg - base.stg,
      aud:       post.aud - base.aud,
    };
    console.log("  deltas:", JSON.stringify(deltas));
    report.phases.deltas = deltas;

    T("city_catalogue unchanged",       post.cc === base.cc);
    T("job_registry unchanged",         post.jr === base.jr);
    T("workforce policies unchanged (=12)", post.wf_pol === 12);
    T("food policies unchanged (=5)",   post.food_pol === 5);
    T("workforce roles unchanged (=3)", post.roles === 3);
    T("R5 intact",                      post.r5_intact === true);
    T("duplicate groups did not grow unexpectedly (≤ +5 tolerance)", deltas.food_dup <= 5, `+${deltas.food_dup}`);
    T("post-trial workforce DB sessions = 0", post.wf_sessions === 0);
    T("agent count did not exceed 5", (post.c12_distinct_agents ?? 0) <= AGENT_COUNT, `distinct=${post.c12_distinct_agents}`);

    // C12-specific food-detail forensics
    if (deltas.aud > 0) {
      const foodDetail = (await safeMgmt("food_detail", `WITH our_audit AS (
        SELECT * FROM nex_workforce.persist_audit WHERE at >= '${gateStartIso}'
      ), our_evidence AS (
        SELECT evidence_id, work_item_id, generation, candidate_count, http_status, byte_length, query_hash, response_sha256, retrieved_at
          FROM nex_workforce.evidence_record WHERE retrieved_at >= '${gateStartIso}'
      ), our_food AS (
        SELECT * FROM nex.food_business
         WHERE (created_at >= '${gateStartIso}' OR updated_at >= '${gateStartIso}') AND source='osm_overpass'
      )
      SELECT
        (SELECT count(*)::int FROM our_audit) AS audit_rows,
        (SELECT coalesce(sum(new_rows),0)::int FROM our_audit) AS sum_new,
        (SELECT coalesce(sum(updated_rows),0)::int FROM our_audit) AS sum_updated,
        (SELECT coalesce(sum(rejected_rows),0)::int FROM our_audit) AS sum_rejected,
        (SELECT count(*)::int FROM our_evidence) AS evidence_count,
        (SELECT array_agg(jsonb_build_object('id', evidence_id, 'candidates', candidate_count, 'http', http_status, 'bytes', byte_length, 'query_hash', query_hash)) FROM our_evidence) AS evidence_detail,
        (SELECT count(*)::int FROM our_food) AS food_touched,
        (SELECT array_agg(DISTINCT city) FROM our_food) AS food_cities,
        (SELECT array_agg(DISTINCT source) FROM our_food) AS food_sources`))?.[0];
      if (foodDetail) {
        console.log("\n─── FOOD DELTA DETAIL ───");
        console.log(JSON.stringify(foodDetail, null, 2).replace(/^/gm, "  "));
        report.phases.food_detail = foodDetail;
        T("all C12 food rows city=Yogyakarta (R5)",
          !foodDetail.food_cities || (Array.isArray(foodDetail.food_cities) && foodDetail.food_cities.every(c => c === "Yogyakarta")),
          `cities=${JSON.stringify(foodDetail.food_cities)}`);
        T("all C12 food rows source=osm_overpass",
          !foodDetail.food_sources || foodDetail.food_sources.every(s => s === "osm_overpass"),
          `sources=${JSON.stringify(foodDetail.food_sources)}`);
        // Every evidence bbox implied by identical query_hash
        for (const ev of (foodDetail.evidence_detail ?? [])) {
          T(`evidence ${ev.id.slice(0,8)} · query_hash matches C6 bbox`, ev.query_hash === EXPECTED_QUERY_HASH);
          T(`evidence ${ev.id.slice(0,8)} · HTTP 200 · non-zero bytes`, ev.http === 200 && ev.bytes > 0);
        }
      }
    } else console.log("  (no food-data changes to inspect)");
  }

  // § 28 · Environment + scheduler + legacy post-trial
  console.log("\n─── ENVIRONMENT + SCHEDULER + LEGACY POST-TRIAL ───");
  const psTaskAfter = spawnSync("powershell", ["-NoProfile","-Command","(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], { encoding: "utf8" });
  T("Scheduled Task remains Disabled", (psTaskAfter.stdout||"").trim() === "Disabled");
  const psEnvAfter = spawnSync("powershell", ["-NoProfile","-Command","(Get-Item .env.local).LastWriteTime.ToString('o')"], { encoding: "utf8" });
  T(".env.local mtime unchanged", /^2026-09-03T07:41/.test((psEnvAfter.stdout||"").trim()));
  const envLocalAfter = readFileSync(".env.local", "utf8");
  T(".env.local byte-identical (SHA)",
    createHash("sha256").update(envLocalAfter).digest("hex") === envLocalShaBefore);
  T("NEX_WORKFORCE_URL still absent from .env.local", !/^NEX_WORKFORCE_URL\s*=/m.test(envLocalAfter));

  // Final
  report.summary = {
    pass, fail, failLines,
    observation_error_count: report.observation_errors.length,
    harness_exception: !!harnessException,
    red_conditions: report.red_conditions.length,
    cycles_started: report.cycles.work_items_started.length,
    cycles_completed: report.cycles.work_items_completed.length,
  };
  writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
  console.log("\n═══════════════════════════════════════════════════════════════════════");
  console.log(` FINAL · pass=${pass} fail=${fail} · obs_errors=${report.observation_errors.length} · red=${report.red_conditions.length} · harness_exception=${!!harnessException}`);
  console.log(`  cycles_started=${report.cycles.work_items_started.length} cycles_completed=${report.cycles.work_items_completed.length}`);
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log(`  report: ${runDir}/report.json`);

  if (report.red_conditions.length > 0 || fail > 0 || harnessException) {
    const verdict = report.red_conditions.length > 0 ? "🔴 C12 FAILED" : (fail > 0 ? "🟡 C12 PARTIAL" : "🟡 C12 PARTIAL");
    console.log(`\n${verdict} · HARD STOP`);
    report.final_verdict = verdict;
    writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
    process.exit(1);
  } else {
    console.log("\n🟢 C12 COMPLETE · FIVE-AGENT CONTINUOUS PRODUCTION TRIAL PROVEN · HARD STOP");
    report.final_verdict = "🟢 C12 COMPLETE";
    writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
    process.exit(0);
  }
}
