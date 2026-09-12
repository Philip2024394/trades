// NEX Workforce v2 · C11 RE-ATTEMPT · Harness safety fix + single-agent trial
// ============================================================================
// Authorization: Philip 2026-09-05 · "AUTHORIZE C11 RE-ATTEMPT · HARNESS
// SAFETY FIX + SINGLE-AGENT CONTROLLED TRIAL · PROJECT B · YOGYAKARTA ·
// RESTAURANTS · ONE BOUNDED TRIAL · NO PERMANENT ACTIVATION"
//
// Fixes from the 2026-09-04 PARTIAL attempt:
//   1. Correct column names discovered via READ-ONLY schema inspection:
//        reaper_run.started_at   (was: run_at — does not exist)
//        work_item.started_at    (was: leased_at — does not exist)
//   2. Every telemetry/observation query wrapped in safeMgmt · captures
//      OBSERVATION_ERROR and CONTINUES · never kills the parent · never kills
//      the workforce (per NEX doctrine "observation must never take down the
//      workforce it observes").
//   3. Top-level try/catch/finally · supervisor.shutdown() ALWAYS attempted
//      even on harness exception · child exit events captured while parent
//      alive.
//   4. Post-runtime forensics runs as an INDEPENDENT phase in the finally
//      block · after all children have exited · using safeMgmt so a
//      forensic-query bug cannot mask a legitimate result.
//   5. lifecycle.setAutoStart(false) called BEFORE shutdown so C9 restart
//      policy cannot schedule a phantom restart mid-shutdown (Windows
//      SIGTERM classifies as TRANSIENT_CRASH on Windows · known C9
//      limitation · this suppresses the restart cascade).
//
// Does NOT modify:
//   scripts/nex-workforce-v2/supervisor/* · agent.mjs · orchestrator.mjs ·
//   reaper.mjs · steps · lib · observability · tests · migrations.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { createHash } from "node:crypto";

// ═══════════════════════════════════════════════════════════════════════════
// § 13 · Environment: inject NEX_WORKFORCE_URL from .env.tools.local (runtime
// only) BEFORE importing supervisor. Never touches .env.local.
// ═══════════════════════════════════════════════════════════════════════════
const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const RUNTIME_URL = envTools.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];

const ORCH_INTERVAL_MS   = 4_000;
const REAPER_INTERVAL_MS = 4_000;
const AGENT_POLL_MS      = 1_000;
const AGENT_HB_MS        = 2_000;
const HARD_CEILING_MS    = 15 * 60 * 1000;

const CITY_SLUG = "yogyakarta";
const CATEGORY  = "restaurants";
const SOURCE    = "overpass";
const JOB_SLUG  = "restaurants-overpass";
const RUN_STAMP = Date.now();
const AGENT_ID  = `c11r-yogyakarta-${RUN_STAMP}`;
const PERSISTER_FN = "nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)";
const STALE_WI_ID = "dfd71abe-f8d6-4d66-9d55-44c3cc343a11";  // from previous C11 · to be naturally reaped

const EXPECTED_BBOX = { sw: { lat: -7.944714, lon: 110.240493 }, ne: { lat: -7.592822, lon: 110.624452 } };
const EXPECTED_QUERY = `[out:json][timeout:60];node["amenity"="restaurant"](${EXPECTED_BBOX.sw.lat},${EXPECTED_BBOX.sw.lon},${EXPECTED_BBOX.ne.lat},${EXPECTED_BBOX.ne.lon});out center;`;
const EXPECTED_QUERY_HASH = createHash("sha256").update(EXPECTED_QUERY).digest("hex");

process.env.NEX_WORKFORCE_URL              = RUNTIME_URL;
process.env.NEX_PERSISTER_FN               = PERSISTER_FN;
process.env.NEX_ORCH_INTERVAL_MS           = String(ORCH_INTERVAL_MS);
process.env.NEX_ORCH_MAX_CONSECUTIVE_ERRORS = "3";
process.env.NEX_REAPER_INTERVAL_MS         = String(REAPER_INTERVAL_MS);
process.env.NEX_REAPER_MAX_CONSECUTIVE_ERRORS = "3";
process.env.NEX_AGENT_POLL_MS              = String(AGENT_POLL_MS);
process.env.NEX_AGENT_HEARTBEAT_MS         = String(AGENT_HB_MS);
process.env.NEX_AGENT_ID                   = AGENT_ID;

const supervisorMod = await import("../nex-workforce-v2/supervisor/supervisor.mjs");
const contractMod   = await import("../nex-workforce-v2/supervisor/lib/lifecycle_contract.mjs");
const { createSupervisor, buildQueryExecutor } = supervisorMod;
const { Role, StartupOrder, ShutdownOrder, MaxAgentCount } = contractMod;

// ═══════════════════════════════════════════════════════════════════════════
// Report scaffolding
// ═══════════════════════════════════════════════════════════════════════════
const REPORT_DIR = "scripts/nex-migration/reports/proving";
mkdirSync(REPORT_DIR, { recursive: true });
const runId = `c11r-${RUN_STAMP}`;
const runDir = `${REPORT_DIR}/${runId}`;
mkdirSync(runDir, { recursive: true });
const report = {
  run_id: runId,
  gate: "C11 RE-ATTEMPT",
  authorization: "AUTHORIZE C11 RE-ATTEMPT · HARNESS SAFETY FIX + SINGLE-AGENT CONTROLLED TRIAL · PROJECT B · YOGYAKARTA · RESTAURANTS · ONE BOUNDED TRIAL · NO PERMANENT ACTIVATION",
  started_at: new Date().toISOString(),
  workload: { city: CITY_SLUG, category: CATEGORY, source: SOURCE, job: JOB_SLUG, bbox: EXPECTED_BBOX, agent_id: AGENT_ID, expected_query_hash: EXPECTED_QUERY_HASH, stale_wi_id: STALE_WI_ID },
  phases: {}, processes: {}, observations: [],
  observation_errors: [],
  harness_exception: null,
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

// ═══════════════════════════════════════════════════════════════════════════
// mgmt() · raw · used only for preflight (where hard-fail is correct)
// safeMgmt() · used for every runtime observation query · records
// OBSERVATION_ERROR and returns null on failure · NEVER throws
// ═══════════════════════════════════════════════════════════════════════════
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
  try {
    return await mgmt(sql);
  } catch (e) {
    const err = {
      at: new Date().toISOString(),
      label,
      error_code: e.message.match(/ERROR:\s+(\d+)/)?.[1] || null,
      message: String(e.message).slice(0, 800),
      sql: String(sql).slice(0, 500),
    };
    report.observation_errors.push(err);
    console.log(`  ⚠️  OBSERVATION_ERROR [${label}]: ${err.message.slice(0, 140)}`);
    return null;
  }
}

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(` NEX Workforce · C11 RE-ATTEMPT · Supervised Trial · ${runId}`);
console.log("═══════════════════════════════════════════════════════════════════════\n");
console.log(`  CITY=${CITY_SLUG} · CATEGORY=${CATEGORY} · SOURCE=${SOURCE} · JOB=${JOB_SLUG}`);
console.log(`  BBOX=sw{${EXPECTED_BBOX.sw.lat},${EXPECTED_BBOX.sw.lon}} ne{${EXPECTED_BBOX.ne.lat},${EXPECTED_BBOX.ne.lon}}`);
console.log(`  AGENT_ID=${AGENT_ID}`);
console.log(`  EXPECTED_QUERY_HASH=${EXPECTED_QUERY_HASH}`);
console.log(`  CEILING=${HARD_CEILING_MS/60000} min`);
console.log(`  STALE_WI_ID=${STALE_WI_ID} (expected reap target)`);
console.log("");

// ═══════════════════════════════════════════════════════════════════════════
// § 12 · Pre-flight · READ-ONLY · hard-fail if unexpected
// ═══════════════════════════════════════════════════════════════════════════
console.log("─── § 12 · PRE-FLIGHT · READ-ONLY ───");
const tgt = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr`))[0];
console.log(`  target · db=${tgt.db} · pg=${tgt.ver} · user=${tgt.usr}`);
T("target = Project B postgres · pg 17.x", tgt.db === "postgres" && /^17\./.test(tgt.ver), `ref=${REF}`);

const base = (await mgmt(`SELECT
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup,
  (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS cc,
  (SELECT slug FROM nex_workforce.city_catalogue LIMIT 1) AS city_slug_actual,
  (SELECT bbox_json FROM nex_workforce.city_catalogue LIMIT 1) AS city_bbox_actual,
  (SELECT count(*)::int FROM nex_workforce.job_registry) AS jr,
  (SELECT count(*)::int FROM nex_workforce.rotation_eligible) AS rot,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi_total,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS wi_active,
  (SELECT state FROM nex_workforce.work_item WHERE id='${STALE_WI_ID}') AS stale_state,
  (SELECT lease_deadline FROM nex_workforce.work_item WHERE id='${STALE_WI_ID}') AS stale_deadline,
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
T("city slug = yogyakarta", base.city_slug_actual === "yogyakarta");
T("job_registry = 1", base.jr === 1);
// C11 re-attempt #3 · § 4: the previous attempt naturally reclaimed the
// stale lease · stale_state is now `pending` (was `leased`). The pending
// row still occupies the tuple slot, so rotation_eligible=0 is expected.
// The Agent will claim the pending row directly · no new enqueue needed.
const staleActive = ["leased", "pending"].includes(base.stale_state) && base.wi_active === 1;
report.known_stale_lease_blocks_rotation = staleActive && base.rot === 0;
console.log(`  KNOWN_STALE_LEASE_BLOCKS_ROTATION = ${report.known_stale_lease_blocks_rotation}`);
T("rotation_eligible = 0 (blocked by pending stale row · expected recovery state)",
  staleActive ? base.rot === 0 : base.rot === 1,
  `actual=${base.rot} · staleActive=${staleActive}`);
T("work_item = 4 (baseline includes stale C11)", base.wi_total === 4, String(base.wi_total));
T("active work_item = 1 (stale C11 · now pending)", base.wi_active === 1, String(base.wi_active));
T("stale C11 work_item is `pending` (reclaimed by previous reap)",
  base.stale_state === "pending", `state=${base.stale_state}`);
T("evidence_record = 5", base.ev === 5);
T("candidate_staging = 2,525", base.stg === 2525);
T("persist_audit = 18", base.aud === 18);
T("workforce policies = 12", base.wf_pol === 12);
T("food policies = 5", base.food_pol === 5);
T("workforce roles = 3", base.roles === 3);
T("R5 intact", base.r5_intact === true);
T("zero workforce DB sessions", base.wf_sessions === 0);

const bbox = typeof base.city_bbox_actual === "string" ? JSON.parse(base.city_bbox_actual) : base.city_bbox_actual;
const bboxMatch = bbox && bbox.sw && bbox.ne &&
  parseFloat(bbox.sw.lat) === EXPECTED_BBOX.sw.lat && parseFloat(bbox.sw.lon) === EXPECTED_BBOX.sw.lon &&
  parseFloat(bbox.ne.lat) === EXPECTED_BBOX.ne.lat && parseFloat(bbox.ne.lon) === EXPECTED_BBOX.ne.lon;
T("seeded bbox EXACTLY matches C6 empirical", bboxMatch);

const psTask = spawnSync("powershell", ["-NoProfile","-Command","(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], { encoding: "utf8" });
T("Scheduled Task Disabled", (psTask.stdout||"").trim() === "Disabled");
const psEnv = spawnSync("powershell", ["-NoProfile","-Command","(Get-Item .env.local).LastWriteTime.ToString('o')"], { encoding: "utf8" });
T(".env.local mtime unchanged (2026-09-03T07:41)", /^2026-09-03T07:41/.test((psEnv.stdout||"").trim()), (psEnv.stdout||"").trim());
const psWfProcs = spawnSync("powershell", ["-NoProfile","-Command","(Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -match 'workforce' } | Measure-Object).Count"], { encoding: "utf8" });
T("zero workforce OS processes pre-trial", (psWfProcs.stdout||"").trim() === "0", (psWfProcs.stdout||"").trim());
const envLocalRaw = readFileSync(".env.local", "utf8");
const envLocalShaBefore = createHash("sha256").update(envLocalRaw).digest("hex");
T("NEX_WORKFORCE_URL absent from .env.local", !/^NEX_WORKFORCE_URL\s*=/m.test(envLocalRaw));

if (fail > 0) {
  console.log("\n🔴 HARD STOP · pre-flight invariant failure");
  writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
  process.exit(2);
}

// ═══════════════════════════════════════════════════════════════════════════
// § 6 · TOP-LEVEL TRY/CATCH/FINALLY · supervisor.shutdown() ALWAYS runs
// ═══════════════════════════════════════════════════════════════════════════
let supervisor = null;
let executor = null;
let harnessException = null;

// ═══════════════════════════════════════════════════════════════════════════
// § 6 · Pre-start orphan lock audit (proof of C9 stale-PID reclaim)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n─── § 6 · PRE-START ORPHAN LOCK AUDIT ───");
function readLockAudit(paths) {
  const out = [];
  for (const p of paths) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      let parsed = null; try { parsed = JSON.parse(content); } catch {}
      let pidAlive = null;
      if (parsed?.pid) {
        try { process.kill(parsed.pid, 0); pidAlive = true; }
        catch (e) { pidAlive = e.code === "ESRCH" ? false : null; }
      }
      out.push({ path: p, present: true, content: parsed ?? content, pid_alive: pidAlive });
    } else {
      out.push({ path: p, present: false });
    }
  }
  return out;
}
const LOCK_PATHS = ["data/nex-workforce-v2/locks/reaper.lock", "data/nex-workforce-v2/locks/orchestrator.lock"];
const locksBefore = readLockAudit(LOCK_PATHS);
report.phases.locks_before = locksBefore;
for (const l of locksBefore) {
  if (l.present) {
    console.log(`  ${l.path} · PRESENT · pid=${l.content?.pid} · pid_alive=${l.pid_alive}`);
  } else {
    console.log(`  ${l.path} · ABSENT`);
  }
}
const staleLocksPresent = locksBefore.some(l => l.present && l.pid_alive === false);
report.stale_locks_present_pre_start = staleLocksPresent;
console.log(`  STALE_LOCKS_PRESENT_PRE_START = ${staleLocksPresent} (expected true · will self-heal via C9 stale-PID reclaim)`);

try {
  console.log("\n─── § 11 · SUPERVISOR CONSTRUCTION · autoStart=true (runtime opts) ───");
  const supervisorLogger = {
    info:  (msg, data) => console.log("  [sup] " + JSON.stringify({ ts: new Date().toISOString(), level:"info", msg, ...data })),
    warn:  (msg, data) => console.log("  [sup] " + JSON.stringify({ ts: new Date().toISOString(), level:"warn", msg, ...data })),
    error: (msg, data) => console.log("  [sup] " + JSON.stringify({ ts: new Date().toISOString(), level:"error", msg, ...data })),
    critical: (msg, data) => console.log("  [sup] " + JSON.stringify({ ts: new Date().toISOString(), level:"critical", msg, ...data })),
    close: () => {},
  };
  executor = await buildQueryExecutor();
  supervisor = createSupervisor({
    query: executor.query,
    logger: supervisorLogger,
    opts: { autoStart: true, tickMs: 5_000, probeTimeoutMs: 3_000 },
  });
  T("supervisor.contract.MaxAgentCount === 1", supervisor.contract.MaxAgentCount === 1);
  T("supervisor.lifecycle.isAutoStart() === true (this invocation only)", supervisor.lifecycle.isAutoStart() === true);
  T("REAPER spec registered",       !!supervisor.lifecycle.get(Role.REAPER, "reaper-1"));
  T("ORCHESTRATOR spec registered", !!supervisor.lifecycle.get(Role.ORCHESTRATOR, "orchestrator-1"));
  T("AGENT spec registered",        !!supervisor.lifecycle.get(Role.AGENT, "agent-1"));

  // Startup order per StartupOrder (excluding SUPERVISOR)
  console.log("\n─── § 12 · STARTUP · C9 StartupOrder + stale-lock reclaim ───");
  const startupTimes = {};
  for (const role of StartupOrder) {
    if (role === Role.SUPERVISOR) continue;
    const spec = supervisor.lifecycle.list().find(c => c.role === role);
    const t0 = Date.now();
    const started = await supervisor.lifecycle.start(role, spec.identifier);
    const durationMs = Date.now() - t0;
    startupTimes[role] = new Date().toISOString();
    report.processes[role] = { pid: started.pid, started_at: startupTimes[role], script: spec.script, startup_duration_ms: durationMs };
    T(`start ${role} · pid=${started.pid} · ${durationMs}ms`, started.started === true);
  }
  report.phases.startup = { order: StartupOrder.filter(r => r !== Role.SUPERVISOR), times: startupTimes };

  // Post-start lock audit · verify stale locks were reclaimed and now hold live PIDs
  console.log("\n─── § 6 · POST-START LOCK AUDIT (C9 stale-PID reclaim proof) ───");
  const locksAfter = readLockAudit(LOCK_PATHS);
  report.phases.locks_after_start = locksAfter;
  for (const l of locksAfter) {
    if (l.present) console.log(`  ${l.path} · pid=${l.content?.pid} · pid_alive=${l.pid_alive}`);
  }
  const allReclaimed = locksAfter.every(l => l.present && l.pid_alive === true);
  T("orphan locks reclaimed by C9 stale-PID recovery (new pid alive)", allReclaimed);
  const reclaimEvidence = locksBefore.map((b, i) => ({
    path: b.path, before_pid: b.content?.pid ?? null, after_pid: locksAfter[i].content?.pid ?? null,
    reclaimed: (b.present && b.pid_alive === false && locksAfter[i].present && locksAfter[i].pid_alive === true && b.content?.pid !== locksAfter[i].content?.pid),
  }));
  report.phases.lock_reclaim_evidence = reclaimEvidence;
  for (const r of reclaimEvidence) console.log(`  ${r.path} · before_pid=${r.before_pid} → after_pid=${r.after_pid} · reclaimed=${r.reclaimed}`);

  await sleep(2_000); // let children boot + connect

  // ═════════════════════════════════════════════════════════════════════════
  // § 17-26 · OBSERVATION LOOP · all queries via safeMgmt
  // Observation errors are recorded and the loop CONTINUES.
  //
  // C11 #3 CRITICAL FIX · § 2, § 11:
  //   Terminal detection MUST be scoped to a single tracked work_item ID.
  //   Never `find(r => terminal)` across recent rows · never LIMIT+find.
  //   The tracked ID starts as the pending stale row (dfd71abe-…). If a
  //   fresh work_item is enqueued while stale is still pending, we adopt
  //   the fresh one · but this should not happen (pending still blocks
  //   the tuple's rotation slot).
  //   The historical Gate 5B row (49735216-…) MUST NEVER cause terminal.
  // ═════════════════════════════════════════════════════════════════════════
  console.log(`\n─── OBSERVATION LOOP · ${HARD_CEILING_MS/60000}-min hard ceiling · identity-scoped terminal ───`);
  const startedAt = Date.now();
  let terminalReached = false;
  let terminalReason = null;
  let trackedWorkItemId = STALE_WI_ID; // Initial · reclaimed pending row
  const HISTORICAL_FORBIDDEN_IDS = new Set(["49735216-d1a8-41a1-a157-85115fde6788"]);
  console.log(`  TRACKED_WORK_ITEM_ID (initial) = ${trackedWorkItemId}`);
  console.log(`  HISTORICAL_FORBIDDEN_IDS = ${JSON.stringify([...HISTORICAL_FORBIDDEN_IDS])}`);

  while (!terminalReached && Date.now() - startedAt < HARD_CEILING_MS) {
    await sleep(3_000);

    // Query 1: TRACKED work_item (identity-scoped · never a recency-based .find)
    const trackedRows = await safeMgmt("tracked_wi", `SELECT id, state, agent_id, generation, attempts, started_at, finished_at, lease_deadline, records_new, records_rejected, last_error, last_error_class, bbox_json
      FROM nex_workforce.work_item WHERE id='${trackedWorkItemId}'`);
    const tracked = trackedRows?.[0] ?? null;

    // Query 2: any FRESH work_item enqueued into the same tuple since gateStart
    // (adopts as tracked ONLY if the current tracked row has reached terminal
    // OR if none was originally tracked · never overwrites a non-terminal tracked)
    const freshRows = await safeMgmt("fresh_wi", `SELECT id, state, enqueued_at
      FROM nex_workforce.work_item
      WHERE city_slug='${CITY_SLUG}' AND category_slug='${CATEGORY}' AND source_slug='${SOURCE}'
        AND enqueued_at >= '${gateStartIso}'
        AND id != '${STALE_WI_ID}'
      ORDER BY enqueued_at ASC LIMIT 1`);
    const fresh = freshRows?.[0] ?? null;
    if (fresh && fresh.id !== trackedWorkItemId && HISTORICAL_FORBIDDEN_IDS.has(fresh.id) === false) {
      // Only re-track if the current tracked row is already terminal (should never happen mid-loop)
      // otherwise this is unexpected · log but do NOT change tracked
      if (tracked && ["completed","soft_fail","dead_letter"].includes(tracked.state)) {
        console.log(`  🔀 tracked (${trackedWorkItemId.slice(0,8)}) already terminal · adopting fresh (${fresh.id.slice(0,8)})`);
        trackedWorkItemId = fresh.id;
      } else if (!tracked) {
        console.log(`  🔀 no tracked row · adopting fresh (${fresh.id.slice(0,8)})`);
        trackedWorkItemId = fresh.id;
      } else {
        console.log(`  ⚠️  UNEXPECTED fresh work_item ${fresh.id.slice(0,8)} while tracked=${trackedWorkItemId.slice(0,8)} state=${tracked.state} · NOT adopting`);
      }
    }

    // Query 3: reaper activity since gate start (started_at · correct schema)
    const reap = await safeMgmt("reaper_runs", `SELECT count(*)::int AS ticks, coalesce(sum(zombies_reclaimed),0)::int AS reclaimed, coalesce(sum(dead_lettered),0)::int AS dead_lettered, coalesce(sum(errors),0)::int AS errors
      FROM nex_workforce.reaper_run WHERE started_at >= '${gateStartIso}'`);

    // Query 4: workforce data counts
    const counts = await safeMgmt("counts", `SELECT
      (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
      (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
      (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
      (SELECT count(*)::int FROM nex.food_business) AS food_rows,
      (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS wi_active,
      (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%nex_workforce%' OR application_name ILIKE '%acquisition%') AS wf_sessions`);

    // Query 5: agent heartbeat (last_beat_at · correct schema)
    const hb = await safeMgmt("heartbeat", `SELECT agent_id, pid, state, last_beat_at, current_work_item_id
      FROM nex_workforce.agent_heartbeat WHERE agent_id='${AGENT_ID}' LIMIT 1`);

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const trackedState = tracked?.state ?? "(missing)";
    const trackedAgent = tracked?.agent_id ?? null;

    const obs = {
      t_s: elapsed,
      tracked_wi_id: trackedWorkItemId,
      tracked: tracked ? { id: tracked.id, state: tracked.state, agent_id: tracked.agent_id, gen: tracked.generation, attempts: tracked.attempts, records_new: tracked.records_new, records_rejected: tracked.records_rejected, last_error: tracked.last_error } : null,
      fresh_enqueue: fresh,
      counts: counts?.[0] ?? null,
      reap: reap?.[0] ?? null,
      hb: hb?.[0] ?? null,
    };
    report.observations.push(obs);

    // Terse console line · always shows TRACKED identity + state
    const lineParts = [`t+${String(elapsed).padStart(4)}s`, `tracked=${trackedWorkItemId.slice(0,8)} state=${trackedState}${trackedAgent ? ' agent='+trackedAgent.slice(0,22) : ''}`];
    if (tracked?.records_new != null) lineParts.push(`new=${tracked.records_new}`);
    if (tracked?.records_rejected != null) lineParts.push(`rej=${tracked.records_rejected}`);
    if (tracked?.last_error) lineParts.push(`err=${tracked.last_error.slice(0,60)}`);
    if (counts?.[0]) lineParts.push(`ev=${counts[0].ev} stg=${counts[0].stg} aud=${counts[0].aud} food=${counts[0].food_rows} sess=${counts[0].wf_sessions}`);
    if (reap?.[0]) lineParts.push(`reaper=${reap[0].ticks}t/${reap[0].reclaimed}rec`);
    if (hb?.[0]) lineParts.push(`hb=${hb[0].state}`);
    console.log("  " + lineParts.join(" · "));

    // Bbox check on tracked work_item
    if (tracked?.bbox_json) {
      const c = typeof tracked.bbox_json === "string" ? JSON.parse(tracked.bbox_json) : tracked.bbox_json;
      if (c?.sw && c?.ne) {
        const structMatch = parseFloat(c.sw.lat) === EXPECTED_BBOX.sw.lat && parseFloat(c.sw.lon) === EXPECTED_BBOX.sw.lon &&
          parseFloat(c.ne.lat) === EXPECTED_BBOX.ne.lat && parseFloat(c.ne.lon) === EXPECTED_BBOX.ne.lon;
        if (!structMatch) {
          terminalReached = true;
          terminalReason = `bbox mismatch on tracked work_item ${tracked.id} · captured=${JSON.stringify(c)}`;
          break;
        }
      }
    }

    // TERMINAL DETECTION · ONLY the tracked work_item (§ 2, § 11)
    if (tracked && ["completed","soft_fail","dead_letter"].includes(tracked.state)) {
      // Explicit log per § 11
      console.log(`  ─── TERMINAL DETECTED ─── TRACKED_WORK_ITEM_ID=${tracked.id} · TRACKED_WORK_ITEM_STATE=${tracked.state}`);
      terminalReached = true;
      terminalReason = `TRACKED work_item ${tracked.id} reached terminal state: ${tracked.state}`;
      break;
    }

    // Watch for child crashes (via C9 lifecycle state · not process pipe)
    const kids = supervisor.lifecycle.list();
    const crashed = kids.find(c => c.state === "EXITED" && c.lastExit && !["clean_shutdown","expected_exit"].includes(c.lastExit.class));
    if (crashed) {
      console.log(`  ⚠️  child ${crashed.role} exited unexpectedly · class=${crashed.lastExit.class} · reason=${crashed.lastExit.reason}`);
    }
  }
  if (!terminalReached) terminalReason = `hard ceiling reached at ${HARD_CEILING_MS/60000} min without terminal state`;
  console.log(`\n─── TERMINAL · reason=${terminalReason} ───`);
  report.terminal = { reason: terminalReason, at: new Date().toISOString(), tracked_work_item_id: trackedWorkItemId };

} catch (harnessErr) {
  harnessException = harnessErr;
  report.harness_exception = { message: harnessErr.message, stack: harnessErr.stack };
  console.log(`\n🔴 HARNESS EXCEPTION · ${harnessErr.message}`);
  console.log(harnessErr.stack);
} finally {
  // ═════════════════════════════════════════════════════════════════════════
  // § 29 · GRACEFUL SHUTDOWN · ALWAYS runs · via C9 ShutdownOrder
  // Disable autoStart so C9 restart_policy cannot schedule phantom restarts
  // on Windows SIGTERM (which classifies as TRANSIENT_CRASH on Windows).
  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n─── § 29 · GRACEFUL SHUTDOWN · ALWAYS via top-level finally ───");
  const shutdownStartedAt = new Date().toISOString();
  if (supervisor) {
    try {
      supervisor.lifecycle.setAutoStart(false); // suppress restart cascade
      await supervisor.shutdown("c11r_finally");
    } catch (e) {
      console.log(`  ⚠️  supervisor.shutdown error: ${e.message}`);
      report.shutdown_error = { message: e.message, stack: e.stack };
    }
  } else {
    console.log("  (no supervisor to shut down)");
  }
  const shutdownEndedAt = new Date().toISOString();

  // § 8 · Wait for child exit events to be processed by child_lifecycle handlers
  await sleep(3_000);

  // § 22 · Exit classifications
  console.log("\n─── § 22 · CHILD EXIT CLASSIFICATIONS ───");
  const kids = supervisor ? supervisor.lifecycle.list() : [];
  for (const c of kids) {
    if (report.processes[c.role]) {
      report.processes[c.role].final_state = c.state;
      report.processes[c.role].last_exit = c.lastExit;
      report.processes[c.role].restart_count = c.restartCount;
    }
    T(`${c.role} · final_state=${c.state} · exit_class=${c.lastExit?.class ?? '(none)'}`,
      c.state === "EXITED" || c.state === "DEGRADED",
      `code=${c.lastExit?.code ?? 'null'} signal=${c.lastExit?.signal ?? 'null'} restart_count=${c.restartCount}`);
  }
  report.phases.shutdown = { started_at: shutdownStartedAt, ended_at: shutdownEndedAt };

  try { if (executor) await executor.close(); } catch (e) { console.log(`  executor.close: ${e.message}`); }

  // ═════════════════════════════════════════════════════════════════════════
  // § 30-31 · POST-RUNTIME FORENSICS · INDEPENDENT PHASE via safeMgmt
  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n─── § 30 · POST-RUNTIME PROCESS AUDIT ───");
  const psWfProcsAfter = spawnSync("powershell", ["-NoProfile","-Command","(Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -match 'workforce' } | Measure-Object).Count"], { encoding: "utf8" });
  T("post-shutdown · zero workforce OS processes", (psWfProcsAfter.stdout||"").trim() === "0", (psWfProcsAfter.stdout||"").trim());
  const psLegacyProcs = spawnSync("powershell", ["-NoProfile","-Command","(Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -match 'nex-acquisition-workforce|_category-walker|run-production-(launcher|watchdog|supervisor)' } | Measure-Object).Count"], { encoding: "utf8" });
  T("zero legacy processes running", (psLegacyProcs.stdout||"").trim() === "0", (psLegacyProcs.stdout||"").trim());

  // Lock file audit
  const lockDir = "data/nex-workforce-v2/locks";
  const lockPaths = ["reaper.lock", "orchestrator.lock"];
  const lockStatus = [];
  for (const l of lockPaths) {
    const p = `${lockDir}/${l}`;
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      lockStatus.push({ path: p, present: true, content });
    } else {
      lockStatus.push({ path: p, present: false });
    }
  }
  report.phases.lock_audit = lockStatus;
  for (const l of lockStatus) console.log(`  lock ${l.path} · ${l.present ? 'PRESENT · '+l.content : 'ABSENT (released)'}`);

  console.log("\n─── § 31 · POST-RUNTIME DATABASE AUDIT · safeMgmt ───");
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
    (SELECT count(*)::int FROM nex_workforce.reaper_run WHERE started_at >= '${gateStartIso}') AS c11r_reaper_ticks,
    (SELECT coalesce(sum(zombies_reclaimed),0)::int FROM nex_workforce.reaper_run WHERE started_at >= '${gateStartIso}') AS c11r_reclaimed,
    (SELECT state FROM nex_workforce.work_item WHERE id='${STALE_WI_ID}') AS stale_final_state`))?.[0];
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
    T("stale C11 work_item no longer leased",
      post.stale_final_state !== "leased",
      `stale_final=${post.stale_final_state}`);
    T("evidence_record grew or stayed",  deltas.ev >= 0);
    T("candidate_staging grew or stayed", deltas.stg >= 0);
    T("persist_audit grew or stayed",    deltas.aud >= 0);
    T("duplicate groups did not increase unexpectedly (≤ +5 tolerance)", deltas.food_dup <= 5, `+${deltas.food_dup}`);
    T("post-trial workforce DB sessions = 0", post.wf_sessions === 0);
    T("reaper ticked at least once during trial (${post.c11r_reaper_ticks})", post.c11r_reaper_ticks >= 1);

    // Food-detail forensics only if there were changes
    if (deltas.food_rows > 0 || deltas.aud > 0) {
      const foodDetail = (await safeMgmt("food_detail", `WITH our_audit AS (
        SELECT * FROM nex_workforce.persist_audit WHERE at >= '${gateStartIso}'
      ), our_evidence AS (
        SELECT evidence_id, work_item_id, generation, candidate_count, http_status, byte_length, query_hash, response_sha256
          FROM nex_workforce.evidence_record WHERE retrieved_at >= '${gateStartIso}'
      ), our_food AS (
        SELECT * FROM nex.food_business WHERE created_at >= '${gateStartIso}' OR updated_at >= '${gateStartIso}'
      )
      SELECT
        (SELECT count(*)::int FROM our_audit) AS audit_rows,
        (SELECT coalesce(sum(new_rows),0)::int FROM our_audit) AS sum_new,
        (SELECT coalesce(sum(updated_rows),0)::int FROM our_audit) AS sum_updated,
        (SELECT coalesce(sum(rejected_rows),0)::int FROM our_audit) AS sum_rejected,
        (SELECT count(*)::int FROM our_evidence) AS our_evidence_count,
        (SELECT array_agg(jsonb_build_object('evidence_id', evidence_id, 'candidate_count', candidate_count, 'http_status', http_status, 'byte_length', byte_length, 'query_hash', query_hash, 'response_sha256', response_sha256)) FROM our_evidence) AS evidence_detail,
        (SELECT count(*)::int FROM our_food) AS our_food_rows,
        (SELECT array_agg(DISTINCT city) FROM our_food) AS food_cities,
        (SELECT array_agg(DISTINCT source) FROM our_food) AS food_sources`))?.[0];
      if (foodDetail) {
        console.log("\n─── § 25 · FOOD DELTA DETAIL ───");
        console.log(JSON.stringify(foodDetail, null, 2).replace(/^/gm, "  "));
        report.phases.food_detail = foodDetail;
        T("all C11 food rows city=Yogyakarta (R5 correctness)",
          !foodDetail.food_cities || (Array.isArray(foodDetail.food_cities) && foodDetail.food_cities.every(c => c === "Yogyakarta")),
          `cities=${JSON.stringify(foodDetail.food_cities)}`);
        T("all C11 food rows source=osm_overpass",
          !foodDetail.food_sources || (Array.isArray(foodDetail.food_sources) && foodDetail.food_sources.every(s => s === "osm_overpass")),
          `sources=${JSON.stringify(foodDetail.food_sources)}`);
      }
    } else {
      console.log("  (no food-data changes to inspect)");
    }
  }

  console.log("\n─── § 33-35 · ENVIRONMENT + SCHEDULER + LEGACY ───");
  const psTaskAfter = spawnSync("powershell", ["-NoProfile","-Command","(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], { encoding: "utf8" });
  T("Scheduled Task remains Disabled", (psTaskAfter.stdout||"").trim() === "Disabled");
  const psEnvAfter = spawnSync("powershell", ["-NoProfile","-Command","(Get-Item .env.local).LastWriteTime.ToString('o')"], { encoding: "utf8" });
  T(".env.local mtime unchanged", /^2026-09-03T07:41/.test((psEnvAfter.stdout||"").trim()));
  const envLocalAfter = readFileSync(".env.local", "utf8");
  const envLocalShaAfter = createHash("sha256").update(envLocalAfter).digest("hex");
  T(".env.local byte-identical (SHA)", envLocalShaAfter === envLocalShaBefore, `${envLocalShaAfter.slice(0,16)}…`);
  T("NEX_WORKFORCE_URL still absent from .env.local", !/^NEX_WORKFORCE_URL\s*=/m.test(envLocalAfter));

  // ═════════════════════════════════════════════════════════════════════════
  // Final
  // ═════════════════════════════════════════════════════════════════════════
  report.summary = { pass, fail, failLines, observation_error_count: report.observation_errors.length, harness_exception: !!harnessException };
  writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
  console.log("\n═══════════════════════════════════════════════════════════════════════");
  console.log(` FINAL · pass=${pass} · fail=${fail} · observation_errors=${report.observation_errors.length} · harness_exception=${!!harnessException}`);
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log(`  report: ${runDir}/report.json`);

  if (fail > 0 || harnessException) {
    console.log(`\n${fail > 0 ? '🔴 C11 RE-ATTEMPT FAILED' : '🟡 C11 RE-ATTEMPT PARTIAL'} · HARD STOP`);
    for (const l of failLines) console.log("  " + l);
    process.exit(1);
  } else {
    console.log("\n🟢 C11 RE-ATTEMPT PASSED · HARD STOP");
    process.exit(0);
  }
}
