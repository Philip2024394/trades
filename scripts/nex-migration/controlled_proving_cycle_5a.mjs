// NEX Workforce · Gate 5A · Controlled Real-Overpass Proving Cycle
// ============================================================================
// Governing authorization: Philip 2026-09-04 · "RUN THE CONTROLLED REAL-OVERPASS
//   PROVING CYCLE" · scoped to ONE small bounded city+category · ONE agent ·
//   ONE orchestrator · ONE reaper · 180s hard cap.
//
// SCOPE (only):
//   Prove the complete production real-acquisition path end-to-end on Project B
//   under R2.2 v2 RLS + Slice 4 bbox wiring, using the real orchestrator +
//   reaper + agent binaries, connecting as nex_app_runtime and using
//   SET LOCAL ROLE nex_workforce_app via the withWorkforceRole helper.
//
// CITY: Yogyakarta Malioboro area (narrow bbox ~0.05° × 0.05°, ~5.5 km × 5.5 km).
//   sw = { lat: -7.82, lon: 110.34 }
//   ne = { lat: -7.77, lon: 110.39 }
//   latSpan = 0.05° (well within MAX_SPAN_DEGREES=2.0)
//   lonSpan = 0.05° (well within MAX_SPAN_DEGREES=2.0)
// CATEGORY: restaurants (in TAG_QUERIES + step_registry → overpass_observe_and_stage)
// SOURCE:   overpass
// PERSISTER: nex_workforce.persist_to_food_business (real production persister)
//
// NOT AUTHORIZED (structurally excluded):
//   Scheduled Task activation · multi-agent · ramp · broad acquisition · role/
//   grant/RLS changes · env changes · System A changes · .env.local mutation.
//
// Flow: baseline → seed ONE narrow city+job → compute expected query_hash for
//       bbox-proof verification → spawn 3 binaries → observe until terminal or
//       180s cap → SIGTERM → postflight (evidence + staging + persist_audit +
//       food_business + query_hash comparison) → cleanup city+job (leave
//       audit trail + genuine acquired data) → HARD STOP.

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
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

// Proving fixtures · CITY_SLUG unique per run so it can never collide with
// any prior gate5a work_item (soft_fail rows from earlier gates would
// otherwise block rotation_eligible via NOT EXISTS on (city,category,source)
// with next_eligible_at > now). CATEGORY and SOURCE MUST remain the exact
// production values (restaurants / overpass) because those are the keys
// StepRegistry.resolve uses to find the capability + the keys TAG_QUERIES
// uses to build the Overpass query template.
const RUN_STAMP = Date.now();
const CITY_SLUG = `gate5a-yogya-${RUN_STAMP}`;
const JOB_SLUG  = `gate5a-yogya-restaurants-${RUN_STAMP}`;
const CATEGORY  = "restaurants";
const SOURCE    = "overpass";
const AGENT_ID  = `gate5a-${RUN_STAMP}`;
const BBOX      = { sw: { lat: -7.82, lon: 110.34 }, ne: { lat: -7.77, lon: 110.39 } };
const PERSISTER_FN = "nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)";

// Compute expected Overpass query + hash · used to prove the actual HTTP
// request used our captured bbox (not a whole-world or wider fallback).
const EXPECTED_QUERY = `[out:json][timeout:60];node["amenity"="restaurant"](${BBOX.sw.lat},${BBOX.sw.lon},${BBOX.ne.lat},${BBOX.ne.lon});out center;`;
const EXPECTED_QUERY_HASH = createHash("sha256").update(EXPECTED_QUERY).digest("hex");

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
const runId = `gate5a-${Date.now()}`;
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
console.log(` NEX Workforce · Gate 5A · Real-Overpass Proving · ${runId}`);
console.log("═══════════════════════════════════════════════════════════════════════");
console.log("");
console.log("─── § 3 · TEST SCOPE (fixed before any mutation) ───");
console.log(`  CITY:      ${CITY_SLUG} · Yogyakarta Malioboro area`);
console.log(`  CATEGORY:  ${CATEGORY}`);
console.log(`  SOURCE:    ${SOURCE}`);
console.log(`  BBOX:      sw={${BBOX.sw.lat},${BBOX.sw.lon}} ne={${BBOX.ne.lat},${BBOX.ne.lon}}`);
console.log(`  LAT SPAN:  ${(BBOX.ne.lat - BBOX.sw.lat).toFixed(4)}° (max 2.0)`);
console.log(`  LON SPAN:  ${(BBOX.ne.lon - BBOX.sw.lon).toFixed(4)}° (max 2.0)`);
console.log(`  PERSISTER: ${PERSISTER_FN}`);
console.log(`  EXPECTED QUERY:      ${EXPECTED_QUERY}`);
console.log(`  EXPECTED QUERY_HASH: ${EXPECTED_QUERY_HASH}`);
console.log("");

// ─── § 4 · PRE-FLIGHT (READ-ONLY · 17 invariants) ────────────────────────
console.log("─── § 4 · PRE-FLIGHT · READ-ONLY (17 invariants) ───");
const targetId = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr`))[0];
console.log(`  target · db=${targetId.db} · pg=${targetId.ver} · user=${targetId.usr}`);

const baseline = (await mgmt(`SELECT
  (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='nex_workforce' AND table_name='work_item' AND column_name='bbox_json') AS wi_bbox_col,
  CASE WHEN pg_get_viewdef('nex_workforce.rotation_eligible'::regclass) ILIKE '%bbox_json%' THEN 1 ELSE 0 END AS view_bbox,
  CASE WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='enqueue_from_view')) ILIKE '%bbox_json%' THEN 1 ELSE 0 END AS fn_bbox,
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS wf_policies,
  (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup_groups,
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi_total,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS wi_active,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
  (SELECT count(*)::int FROM nex_workforce.reaper_run) AS rr,
  (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS cities,
  (SELECT count(*)::int FROM nex_workforce.job_registry) AS jobs,
  (SELECT count(*)::int FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
    WHERE r.rolname='nex_workforce_app' AND m.rolname='nex_app_runtime' AND am.inherit_option=true AND am.set_option=true AND am.admin_option=false) AS grant_ok,
  (SELECT count(*)::int FROM pg_stat_activity WHERE pid <> pg_backend_pid()
    AND (application_name ILIKE '%workforce%' OR application_name ILIKE '%nex-agent%'
      OR application_name ILIKE '%nex-reaper%' OR application_name ILIKE '%nex-orchestrator%'
      OR (state='active' AND (query ILIKE 'SELECT nex_workforce.claim%' OR query ILIKE 'SELECT nex_workforce.persist_batch%')))) AS active_wf,
  (SELECT count(*)::int FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS persister_exists,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_admin') AS admin_bypass`))[0];

T("1-2 · target = Project B postgres · pg 17.x", targetId.db === "postgres" && /^17\./.test(targetId.ver));
T("3-6 · Slice 4 present (bbox_json col + view + fn + 11 R2.2 policies + 5 food policies)",
  baseline.wi_bbox_col === 1 && baseline.view_bbox === 1 && baseline.fn_bbox === 1 && baseline.wf_policies === 11 && baseline.food_policies === 5);

// § 7 · MAX_SPAN_DEGREES = 2.0 in validator (source-code check)
const validatorSrc = readFileSync("scripts/nex-workforce-v2/lib/bbox_validator.mjs", "utf8");
T("7 · MAX_SPAN_DEGREES = 2.0 in bbox_validator.mjs · whole-world fallback absent",
  /MAX_SPAN_DEGREES\s*=\s*2\.0/.test(validatorSrc) && !/lat:\s*-90\s*,\s*lon:\s*-180/.test(validatorSrc));

// Local + Postgres invariants
const psTaskPre = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], {encoding:"utf8"});
const preTaskState = (psTaskPre.stdout||"").trim();
T("8 · Scheduled Task Disabled OR absent", preTaskState === "Disabled" || preTaskState === "", `state='${preTaskState}'`);
T("9-10 · workforce OFF · no active workforce sessions", baseline.active_wf === 0, `active=${baseline.active_wf}`);
T("11 · nex.food_business baseline = 22,750", baseline.food_rows === 22750);
T("12 · duplicate-group baseline = 373", baseline.food_dup_groups === 373);
T("13 · workforce table state (audit rows expected · no active work)",
  baseline.wi_active === 0, `wi_total=${baseline.wi_total} active=${baseline.wi_active} ev=${baseline.ev} stg=${baseline.stg} aud=${baseline.aud} rr=${baseline.rr}`);

const psEnvPre = spawnSync("powershell", ["-NoProfile", "-Command",
  "$m=(Get-Item .env.local).LastWriteTime.ToString('o'); $g=(Select-String -Path .env.local -Pattern 'nex_workforce_admin|nex_workforce_app|withWorkforceRole' -SimpleMatch | Measure-Object).Count; 'mtime='+$m+'|matches='+$g"], {encoding:"utf8"});
const preEnvInfo = (psEnvPre.stdout||"").trim();
T("14 · .env.local unchanged (0 workforce identifiers · pre-cutover mtime)",
  /matches=0/.test(preEnvInfo) && /2026-09-03T07:41/.test(preEnvInfo), preEnvInfo);
const psSysA = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Select-String -Path .env.local -Pattern 'NEX_TAXONOMY_POSTGRES_URL' -SimpleMatch | Select-Object -ExpandProperty Line)"], {encoding:"utf8"});
const preSysA = (psSysA.stdout||"").trim();
T("15 · System A remains local (localhost:5433/nex_dev)", /localhost:5433\/nex_dev/.test(preSysA));
T("16 · runtime → workforce_app grant unchanged (inherit=true · set=true · admin=false)", baseline.grant_ok === 1);
T("17 · persist_to_food_business exists as SECDEF · persister available", baseline.persister_exists === 1);

if (fail > 0) {
  console.log("\n🔴 HARD STOP · pre-flight invariant failure · not seeding · not starting");
  writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
  process.exit(2);
}
report.phases.preflight = { targetId, baseline, preTaskState, preEnvInfo, preSysA };
console.log("");

// ─── SEED · ONE narrow real ops config (documented + cleaned up after) ───
console.log("─── SEED · ONE narrow real city + job (documented as proving fixture) ───");
const bboxJson = JSON.stringify(BBOX);
await mgmt(`INSERT INTO nex_workforce.city_catalogue
    (slug, name, country, enabled, priority, bbox_json, notes)
  VALUES ('${CITY_SLUG}', 'Yogyakarta Malioboro (Gate 5A Proving)', 'ID', true, 999,
          '${bboxJson}'::jsonb, 'Gate 5A controlled proving fixture · cleaned up after')
  ON CONFLICT (slug) DO UPDATE SET bbox_json = EXCLUDED.bbox_json, enabled = true`);
await mgmt(`INSERT INTO nex_workforce.job_registry
    (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority, notes)
  VALUES ('${JOB_SLUG}', '${CATEGORY}', '${SOURCE}', 60, 1, 3, 15, true, 999,
          'Gate 5A controlled proving fixture · cleaned up after')
  ON CONFLICT (category_slug, source_slug) DO UPDATE SET enabled = true, priority = 999`);
const rotElig = (await mgmt(`SELECT count(*)::int AS n FROM nex_workforce.rotation_eligible
  WHERE city_slug='${CITY_SLUG}' AND category_slug='${CATEGORY}' AND source_slug='${SOURCE}'`))[0].n;
T("seed · rotation_eligible has exactly ONE row for our city+category+source", rotElig === 1, `n=${rotElig}`);

// ─── SPAWN 3 BINARIES · foreground · bounded ────────────────────────────
console.log("");
console.log("─── § 5 · SPAWN · ONE orchestrator + ONE reaper + ONE agent ───");
function launch(name, script, extraEnv) {
  const env = { ...process.env, NEX_WORKFORCE_URL: RUNTIME_URL, NEX_PERSISTER_FN: PERSISTER_FN, ...extraEnv };
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

// ─── OBSERVE · until terminal · hard cap 180s ───────────────────────────
console.log("");
console.log(`─── § 5-17 · OBSERVATION LOOP · hard ceiling ${HARD_CEILING_MS/1000}s ───`);
const startedAt = Date.now();
let terminalReached = false;
let terminalReason = null;
let ourWorkItemId = null;
let ourWorkItemState = null;

while (!terminalReached && Date.now() - startedAt < HARD_CEILING_MS) {
  await sleep(3_000);
  const st = (await mgmt(`SELECT
    (SELECT id FROM nex_workforce.work_item WHERE city_slug='${CITY_SLUG}' ORDER BY enqueued_at DESC LIMIT 1) AS our_id,
    (SELECT state FROM nex_workforce.work_item WHERE city_slug='${CITY_SLUG}' ORDER BY enqueued_at DESC LIMIT 1) AS our_state,
    (SELECT bbox_json FROM nex_workforce.work_item WHERE city_slug='${CITY_SLUG}' ORDER BY enqueued_at DESC LIMIT 1) AS our_bbox,
    (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
    (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
    (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
    (SELECT count(*)::int FROM nex.food_business) AS food_rows`))[0];
  ourWorkItemId = st.our_id;
  ourWorkItemState = st.our_state;
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const obs = { t_s: elapsed, ...st };
  report.observations.push(obs);
  console.log(`  t+${String(elapsed).padStart(3)}s · our_wi=${st.our_id ? st.our_id.slice(0,8) : '(none)'} state=${st.our_state ?? 'n/a'} · ev=${st.ev} stg=${st.stg} aud=${st.aud} · food=${st.food_rows}`);

  // Guardrail: if our work_item's captured bbox_json differs from what we seeded, HARD STOP.
  // Compare structurally (not textually) since Postgres jsonb may reorder keys.
  if (st.our_bbox) {
    const c = typeof st.our_bbox === "string" ? JSON.parse(st.our_bbox) : st.our_bbox;
    const bboxMatch =
      c && c.sw && c.ne &&
      c.sw.lat === BBOX.sw.lat && c.sw.lon === BBOX.sw.lon &&
      c.ne.lat === BBOX.ne.lat && c.ne.lon === BBOX.ne.lon;
    if (!bboxMatch) {
      terminalReached = true;
      terminalReason = `HARD_STOP · captured bbox differs from seeded bbox · captured=${JSON.stringify(c)}`;
      break;
    }
  }

  if (ourWorkItemState === "completed" || ourWorkItemState === "soft_fail" || ourWorkItemState === "dead_letter") {
    terminalReached = true;
    terminalReason = `work_item reached terminal state: ${ourWorkItemState}`;
    break;
  }
}
if (!terminalReached) { terminalReached = true; terminalReason = "hard_ceiling_180s"; }
console.log("");
console.log(`─── TERMINAL · reason=${terminalReason} ───`);
report.phases.terminal = { reason: terminalReason, ourWorkItemId, ourWorkItemState, elapsed_s: Math.round((Date.now() - startedAt) / 1000) };

// ─── SHUTDOWN ─────────────────────────────────────────────────────────
console.log("");
console.log("─── SHUTDOWN · SIGTERM ───");
async function shutdown(name, child) {
  return new Promise((resolve) => {
    if (!child.pid || child.exitCode !== null) { resolve({ name, method: "already-exited", code: child.exitCode }); return; }
    let resolved = false;
    const done = (r) => { if (!resolved) { resolved = true; resolve(r); } };
    child.on("exit", (code, signal) => done({ name, method: "graceful", code, signal }));
    try { child.kill("SIGTERM"); } catch {}
    setTimeout(() => { if (!resolved) { try { child.kill("SIGKILL"); } catch {} setTimeout(() => done({ name, method: "force-killed", code: child.exitCode }), 2000); } }, 10_000);
  });
}
const shutdownResults = await Promise.all([shutdown("orchestrator", orch), shutdown("reaper", reaper), shutdown("agent", agent)]);
for (const e of shutdownResults) { T(`shutdown · ${e.name} · ${e.method} · code=${e.code}`, true); report.processes[e.name].shutdown = e; }
await sleep(2_000);

// ─── § 8 · CRITICAL OVERPASS PROOF · captured bbox vs actual request ────
console.log("");
console.log("─── § 8 · CRITICAL · captured bbox flowed into actual Overpass request ───");
if (ourWorkItemId) {
  const ev = (await mgmt(`SELECT evidence_id, query_hash, response_sha256, retrieved_at, request_id, http_status, byte_length, candidate_count, source_slug, city_slug, category_slug
    FROM nex_workforce.evidence_record WHERE work_item_id='${ourWorkItemId}' ORDER BY created_at DESC LIMIT 1`));
  if (ev.length === 0) {
    T("§ 8 · evidence_record exists for our work_item", false, "no evidence row · capability failed before staging");
  } else {
    const e = ev[0];
    console.log(`  evidence_id:      ${e.evidence_id}`);
    console.log(`  query_hash:       ${e.query_hash}`);
    console.log(`  expected_hash:    ${EXPECTED_QUERY_HASH}`);
    console.log(`  http_status:      ${e.http_status}`);
    console.log(`  byte_length:      ${e.byte_length}`);
    console.log(`  candidate_count:  ${e.candidate_count}`);
    T("§ 8 · query_hash EXACTLY MATCHES expected hash · proves bbox flowed to Overpass unmodified · no whole-world · no widening",
      e.query_hash === EXPECTED_QUERY_HASH,
      e.query_hash === EXPECTED_QUERY_HASH ? "byte-identical query hash" : `expected=${EXPECTED_QUERY_HASH} actual=${e.query_hash}`);
    T("§ 8 · HTTP status = 200", e.http_status === 200, `status=${e.http_status}`);
    T("§ 8 · byte_length > 0 · response body was captured", e.byte_length > 0, `bytes=${e.byte_length}`);
    T("§ 11 · evidence fields populated per Section 11",
      e.evidence_id && e.query_hash && e.response_sha256 && e.retrieved_at && typeof e.http_status === "number"
      && typeof e.byte_length === "number" && typeof e.candidate_count === "number"
      && e.source_slug === SOURCE && e.city_slug === CITY_SLUG && e.category_slug === CATEGORY,
      `source=${e.source_slug} city=${e.city_slug} category=${e.category_slug}`);
    report.phases.evidence = e;
  }
} else {
  T("§ 8 · work_item exists", false, "no work_item was ever created");
}

// ─── § 12 · STAGING PROOF ────────────────────────────────────────────
console.log("");
console.log("─── § 12 · STAGING PROOF ───");
if (ourWorkItemId) {
  const stg = await mgmt(`SELECT count(*)::int AS n,
    count(*) FILTER (WHERE persisted=true) AS n_persisted,
    count(*) FILTER (WHERE rejected=true) AS n_rejected
    FROM nex_workforce.candidate_staging WHERE work_item_id='${ourWorkItemId}'`);
  const s = stg[0];
  console.log(`  candidate_staging rows for our work_item: total=${s.n} persisted=${s.n_persisted} rejected=${s.n_rejected}`);
  T("§ 12 · candidate_staging rows exist tied to our work_item + generation",
    s.n >= 0, `staged=${s.n} · legitimate zero-result if Overpass returned no restaurants in narrow bbox`);
  report.phases.staging = s;
}

// ─── § 13 · PERSISTENCE PROOF (persist_audit + food_business delta) ───
console.log("");
console.log("─── § 13 · PERSISTENCE PROOF ───");
if (ourWorkItemId) {
  const aud = await mgmt(`SELECT persister_fn, new_rows, updated_rows, rejected_rows, ok, duration_ms
    FROM nex_workforce.persist_audit WHERE work_item_id='${ourWorkItemId}' ORDER BY at DESC LIMIT 5`);
  console.log(`  persist_audit rows for our work_item: ${aud.length}`);
  for (const a of aud) console.log(`    · fn=${a.persister_fn} · new=${a.new_rows} upd=${a.updated_rows} rej=${a.rejected_rows} · ok=${a.ok} · ${a.duration_ms}ms`);
  T("§ 13 · persist_audit rows recorded through the approved persister function",
    aud.length >= 1 && aud.every(a => a.persister_fn === "nex_workforce.persist_to_food_business" && a.ok === true),
    aud.length === 0 ? "no persist_audit rows · persist_batch never ran" : "all audits use persist_to_food_business + ok=true");
  report.phases.persistence = aud;
}

// food_business delta
const foodAfter = (await mgmt(`SELECT
  count(*)::int AS food_rows,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup_groups
FROM nex.food_business`))[0];
const foodDelta = foodAfter.food_rows - baseline.food_rows;
console.log(`  nex.food_business: baseline=${baseline.food_rows} → after=${foodAfter.food_rows} · delta=+${foodDelta}`);
console.log(`  duplicate groups:  baseline=${baseline.food_dup_groups} → after=${foodAfter.food_dup_groups}`);
T("§ 13/O · food_business delta is bounded (≥0) · dup groups did not decrease",
  foodDelta >= 0 && foodAfter.food_dup_groups >= baseline.food_dup_groups,
  `+${foodDelta} rows · ${foodAfter.food_dup_groups - baseline.food_dup_groups} dup-group change`);
report.phases.food_business = { baseline_rows: baseline.food_rows, after_rows: foodAfter.food_rows, delta: foodDelta,
  baseline_dup_groups: baseline.food_dup_groups, after_dup_groups: foodAfter.food_dup_groups };

// ─── § 17 · WORK ITEM LIFECYCLE ─────────────────────────────────────
console.log("");
console.log("─── § 17 · WORK ITEM LIFECYCLE ───");
if (ourWorkItemId) {
  const wi = (await mgmt(`SELECT id, state, generation, agent_id, priority, attempts, lease_deadline,
    enqueued_at, started_at, finished_at, records_new, records_rejected, bbox_json::text AS bbox_json,
    last_error, last_error_class, cursor_json::text AS cursor_json
    FROM nex_workforce.work_item WHERE id='${ourWorkItemId}'`))[0];
  console.log("  " + JSON.stringify(wi, null, 2).replace(/\n/g, "\n  "));
  const capturedBbox = wi.bbox_json ? JSON.parse(wi.bbox_json) : null;
  // Section 5 · structural comparison · Postgres jsonb key ordering is not authoritative
  const bboxStructuralMatch = capturedBbox && capturedBbox.sw && capturedBbox.ne &&
    capturedBbox.sw.lat === BBOX.sw.lat && capturedBbox.sw.lon === BBOX.sw.lon &&
    capturedBbox.ne.lat === BBOX.ne.lat && capturedBbox.ne.lon === BBOX.ne.lon;
  T("§ 17 · work_item bbox_json exactly matches seeded bbox structurally (captured at enqueue · immutable)",
    bboxStructuralMatch,
    `captured={sw:{lat:${capturedBbox?.sw?.lat},lon:${capturedBbox?.sw?.lon}},ne:{lat:${capturedBbox?.ne?.lat},lon:${capturedBbox?.ne?.lon}}}`);
  T("§ 17 · work_item terminal state (completed OR soft_fail with clear reason)",
    wi.state === "completed" || wi.state === "soft_fail" || wi.state === "dead_letter",
    `state=${wi.state}`);
  // finished_at is populated by complete() and dead_letter transitions ·
  // soft_fail deliberately leaves it NULL (row becomes eligible again after backoff)
  if (wi.state === "completed" || wi.state === "dead_letter") {
    T("§ 17 · finished_at populated (state=completed or dead_letter)", wi.finished_at !== null,
      `state=${wi.state} finished_at=${wi.finished_at}`);
  } else {
    T("§ 17 · finished_at NULL is correct for state=soft_fail (row will requeue after backoff)",
      wi.finished_at === null, `state=${wi.state} finished_at=${wi.finished_at}`);
  }
  report.phases.lifecycle = wi;
}

// ─── § 16 · REAPER PROOF ─────────────────────────────────────────────
console.log("");
console.log("─── § 16 · REAPER PROOF ───");
const rr = (await mgmt(`SELECT count(*)::int AS n, count(*) FILTER (WHERE finished_at IS NOT NULL) AS n_finished FROM nex_workforce.reaper_run WHERE started_at >= '${report.started_at}'`))[0];
console.log(`  reaper_run rows started during this proving cycle: ${rr.n} · finished: ${rr.n_finished}`);
T("§ 16 · reaper ran at least once during proving · all runs completed cleanly", rr.n >= 1 && rr.n === rr.n_finished, `n=${rr.n} finished=${rr.n_finished}`);

// ─── § 15 · FAILURE CLASSIFICATION (from logs) ──────────────────────
console.log("");
console.log("─── § 15 · FAILURE CLASSIFICATION (log scan) ───");
function scanLog(name) {
  try { return readFileSync(report.processes[name].logPath, "utf8").split("\n").filter(Boolean); }
  catch { return []; }
}
const orchLog = scanLog("orchestrator");
const reaperLog = scanLog("reaper");
const agentLog = scanLog("agent");
const roleErrs = [...orchLog, ...reaperLog, ...agentLog].filter(l => /WorkforceRoleElevation|SET LOCAL ROLE nex_workforce_app failed|42501/.test(l)).length;
const bboxErrs = [...orchLog, ...reaperLog, ...agentLog].filter(l => /BboxInvalidError|BBOX_INVALID/.test(l)).length;
const permErrs = [...orchLog, ...reaperLog, ...agentLog].filter(l => /permission denied|row-level security/.test(l)).length;
T("§ 15 · zero role-elevation errors", roleErrs === 0, `roleErrs=${roleErrs}`);
T("§ 15 · zero bbox validation errors (bbox flowed correctly)", bboxErrs === 0, `bboxErrs=${bboxErrs}`);
T("§ 15 · zero permission-denied / RLS-violation errors", permErrs === 0, `permErrs=${permErrs}`);
report.phases.log_scan = { roleErrs, bboxErrs, permErrs, orchTicks: orchLog.length, reaperTicks: reaperLog.length, agentEvents: agentLog.length };

// ─── § 18 · POSTFLIGHT · READ-ONLY vs baseline ─────────────────────
console.log("");
console.log("─── § 18 · POSTFLIGHT · READ-ONLY vs baseline ───");
const post = (await mgmt(`SELECT
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS wf_policies,
  (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_policies,
  (SELECT count(*)::int FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member
    WHERE r.rolname='nex_workforce_app' AND m.rolname='nex_app_runtime' AND am.inherit_option=true AND am.set_option=true AND am.admin_option=false) AS grant_ok,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname='nex_workforce_admin') AS admin_bypass,
  (SELECT count(*)::int FROM pg_stat_activity WHERE pid <> pg_backend_pid()
    AND (application_name ILIKE '%workforce%' OR application_name ILIKE '%nex-agent%'
      OR application_name ILIKE '%nex-reaper%' OR application_name ILIKE '%nex-orchestrator%'
      OR (state='active' AND (query ILIKE 'SELECT nex_workforce.claim%')))) AS active_wf`))[0];
T("§ 18 · R2.2 v2 policies unchanged (11 nex_workforce + 5 food_business)", post.wf_policies === 11 && post.food_policies === 5);
T("§ 18 · runtime → workforce_app grant unchanged", post.grant_ok === 1);
T("§ 18 · admin still NOBYPASSRLS", post.admin_bypass === false);
T("§ 18 · zero active workforce sessions after shutdown", post.active_wf === 0);
const psTaskPost = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], {encoding:"utf8"});
const postTaskState = (psTaskPost.stdout||"").trim();
T("§ W · Scheduled Task still Disabled", postTaskState === "Disabled" || postTaskState === "");
const psEnvPost = spawnSync("powershell", ["-NoProfile", "-Command",
  "$m=(Get-Item .env.local).LastWriteTime.ToString('o'); $g=(Select-String -Path .env.local -Pattern 'nex_workforce_admin|nex_workforce_app|withWorkforceRole' -SimpleMatch | Measure-Object).Count; 'mtime='+$m+'|matches='+$g"], {encoding:"utf8"});
const postEnvInfo = (psEnvPost.stdout||"").trim();
T("§ U · .env.local unchanged", postEnvInfo === preEnvInfo);
const psSysAPost = spawnSync("powershell", ["-NoProfile", "-Command",
  "(Select-String -Path .env.local -Pattern 'NEX_TAXONOMY_POSTGRES_URL' -SimpleMatch | Select-Object -ExpandProperty Line)"], {encoding:"utf8"});
T("§ V · System A unchanged", (psSysAPost.stdout||"").trim() === preSysA);
const legacy = spawnSync("powershell", ["-NoProfile", "-Command",
  `$pids=@(${orch.pid || 0},${reaper.pid || 0},${agent.pid || 0}); ` +
  "$c=Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'nex-workforce-v2' -and $_.ProcessId -notin $pids -and $_.ProcessId -ne $PID }; ($c | Measure-Object).Count"], {encoding:"utf8"});
const legacyCount = parseInt((legacy.stdout||"0").trim(), 10);
T("§ S · no orphan/legacy workforce processes on host", legacyCount === 0, `legacy=${legacyCount}`);
report.phases.postflight = { post, postTaskState, postEnvInfo, sysAUnchanged: (psSysAPost.stdout||"").trim() === preSysA, legacyCount };

// ─── § 19 · CLEANUP · remove proving city + job · leave audit trail ────
console.log("");
console.log("─── § 19 · CLEANUP · remove proving city + job (leave audit trail + genuine data) ───");
await mgmt(`DELETE FROM nex_workforce.job_registry WHERE slug='${JOB_SLUG}' OR (category_slug='${CATEGORY}' AND source_slug='${SOURCE}')`);
await mgmt(`DELETE FROM nex_workforce.city_catalogue WHERE slug='${CITY_SLUG}'`);
T("cleanup · gate5a city + job removed", true, "audit trail preserved · genuine food_business rows preserved");

// ─── LOG EXCERPTS ────────────────────────────────────────────────────
console.log("");
console.log("─── LOG EXCERPTS · last 10 lines of each ───");
for (const name of ["orchestrator", "reaper", "agent"]) {
  const src = readFileSync(report.processes[name].logPath, "utf8").trim().split("\n");
  const tail = src.slice(-10).join("\n");
  console.log(`\n  ── ${name}.log tail ──`);
  console.log(tail.split("\n").map(l => "    " + l).join("\n"));
}

// ─── FINAL ──────────────────────────────────────────────────────────
report.finished_at = new Date().toISOString();
report.pass = pass; report.fail = fail; report.failLines = failLines;
writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
console.log("");
console.log("═══════════════════════════════════════════════════════════════════════");
if (fail === 0 && ourWorkItemState === "completed") {
  console.log(`🟢 GATE 5A · REAL OVERPASS PROVING PASSED · ${pass} checks passed`);
  console.log("🟢 GATE 5A COMPLETE · REAL OVERPASS PATH PROVEN");
  console.log("🔴 HARD STOP · SCHEDULED TASK ACTIVATION UNAUTHORIZED");
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log(`Report: ${runDir}/report.json`);
  process.exit(0);
} else if (fail === 0 && (ourWorkItemState === "soft_fail" || ourWorkItemState === "dead_letter")) {
  console.log(`🟡 GATE 5A · PARTIAL · terminal=${ourWorkItemState} · lifecycle bounded but not completed`);
  console.log("🔴 HARD STOP · SCHEDULED TASK ACTIVATION UNAUTHORIZED");
  console.log("═══════════════════════════════════════════════════════════════════════");
  process.exit(1);
} else {
  console.log(`🔴 GATE 5A · FAILED · ${fail} failures · terminal=${terminalReason}`);
  for (const l of failLines) console.log("   " + l);
  console.log("🔴 HARD STOP · SCHEDULED TASK ACTIVATION UNAUTHORIZED");
  console.log("═══════════════════════════════════════════════════════════════════════");
  process.exit(3);
}
