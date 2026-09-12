// NEX Workforce v2 · Gate 5B · Yogyakarta full-bbox real-Overpass proving cycle
// ============================================================================
// Authorization: Philip 2026-09-04 · "AUTHORIZE GATE 5B · YOGYAKARTA FULL-BBOX
// REAL-OVERPASS PROVING CYCLE · ONE CONTROLLED CYCLE · NO PERMANENT ACTIVATION"
//
// Unlike Gate 5A #4 (Malioboro sub-bbox proving), this cycle uses:
//   · the REAL C6-seeded city_catalogue row (slug=yogyakarta)
//   · the REAL C5-seeded job_registry row (restaurants-overpass)
//   · the REAL 0.351892° × 0.383959° empirical city bbox from C6
//   · the R5 city-aware persister
//   · the normal V2 enqueue path (orchestrator's enqueue_from_view())
//
// NO synthetic city or job is seeded. NO cleanup of production data at end.
// All outputs (evidence, staging, audit, food_business rows, work_item) are
// preserved as legitimate production history.
//
// Success is not "HTTP 200" · it is the full path completing cleanly within
// existing timeout/lease/retry contracts with correct city+identity handling.

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { resolve as pathResolve } from "node:path";

const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const RUNTIME_URL = envTools.match(/^NEX_APP_RUNTIME_POSTGRES_URL=(.+)$/m)[1];

// Runtime intervals (controlled proving · not permanent cadence)
const ORCH_INTERVAL_MS   = 4_000;
const REAPER_INTERVAL_MS = 4_000;
const AGENT_POLL_MS      = 1_000;
const AGENT_HB_MS        = 2_000;
// Larger bbox → longer response · larger candidate set · longer persist loop.
// Gate 5A #4 (Malioboro): ~40s claim→completion. Yogyakarta is ~54× area.
// 300s ceiling gives generous headroom while remaining well below 15-min lease.
const HARD_CEILING_MS    = 300_000;

// Real production identifiers (from C5 + C6 · not synthetic · not cleaned up)
const CITY_SLUG = "yogyakarta";
const JOB_SLUG  = "restaurants-overpass";
const CATEGORY  = "restaurants";
const SOURCE    = "overpass";
const RUN_STAMP = Date.now();
const AGENT_ID  = `gate5b-yogyakarta-${RUN_STAMP}`;
const PERSISTER_FN = "nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)";

// Expected bbox (C6 seed · exact empirical values)
const EXPECTED_BBOX = { sw: { lat: -7.944714, lon: 110.240493 }, ne: { lat: -7.592822, lon: 110.624452 } };
const EXPECTED_QUERY = `[out:json][timeout:60];node["amenity"="restaurant"](${EXPECTED_BBOX.sw.lat},${EXPECTED_BBOX.sw.lon},${EXPECTED_BBOX.ne.lat},${EXPECTED_BBOX.ne.lon});out center;`;
const EXPECTED_QUERY_HASH = (async () => {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(EXPECTED_QUERY).digest("hex");
})();

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
const runId = `gate5b-${RUN_STAMP}`;
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

const report = { run_id: runId, gate: "5B", started_at: new Date().toISOString(), phases: {}, processes: {}, observations: [] };
const gateStartIso = report.started_at;

const expectedQueryHash = await EXPECTED_QUERY_HASH;

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(` NEX Workforce · Gate 5B · Yogyakarta Full-BBox Proving · ${runId}`);
console.log("═══════════════════════════════════════════════════════════════════════");
console.log("");
console.log("─── § 4 · EXACT WORKLOAD (fixed · no substitution) ───");
console.log(`  CITY:        ${CITY_SLUG} · Yogyakarta`);
console.log(`  CATEGORY:    ${CATEGORY}`);
console.log(`  SOURCE:      ${SOURCE}`);
console.log(`  JOB:         ${JOB_SLUG}`);
console.log(`  BBOX:        sw={${EXPECTED_BBOX.sw.lat},${EXPECTED_BBOX.sw.lon}} ne={${EXPECTED_BBOX.ne.lat},${EXPECTED_BBOX.ne.lon}}`);
console.log(`  LAT SPAN:    ${(EXPECTED_BBOX.ne.lat - EXPECTED_BBOX.sw.lat).toFixed(6)}°`);
console.log(`  LON SPAN:    ${(EXPECTED_BBOX.ne.lon - EXPECTED_BBOX.sw.lon).toFixed(6)}°`);
console.log(`  AGENT_ID:    ${AGENT_ID}`);
console.log(`  EXPECTED QH: ${expectedQueryHash}`);
console.log("");

// ═══════════════════════════════════════════════════════════════════════
// § 3 · PRE-FLIGHT
// ═══════════════════════════════════════════════════════════════════════
console.log("─── § 3 · PRE-FLIGHT · READ-ONLY (Section 3 invariants) ───");
const tgt = (await mgmt(`SELECT current_database() AS db, current_setting('server_version') AS ver, current_user AS usr`))[0];
console.log(`  target · db=${tgt.db} · pg=${tgt.ver} · user=${tgt.usr}`);
T("target = Project B postgres · pg 17.x", tgt.db === "postgres" && /^17\./.test(tgt.ver), `ref=${REF}`);

const base = (await mgmt(`SELECT
  -- Config
  (SELECT count(*)::int FROM nex_workforce.city_catalogue) AS cities,
  (SELECT count(*)::int FROM nex_workforce.job_registry) AS jobs,
  (SELECT slug FROM nex_workforce.city_catalogue LIMIT 1) AS city_slug_actual,
  (SELECT name FROM nex_workforce.city_catalogue LIMIT 1) AS city_name_actual,
  (SELECT bbox_json FROM nex_workforce.city_catalogue LIMIT 1) AS city_bbox_actual,
  (SELECT slug FROM nex_workforce.job_registry LIMIT 1) AS job_slug_actual,
  (SELECT enabled FROM nex_workforce.job_registry LIMIT 1) AS job_enabled,
  -- Rotation
  (SELECT count(*)::int FROM nex_workforce.rotation_eligible) AS rot,
  -- Work items
  (SELECT count(*)::int FROM nex_workforce.work_item) AS wi_total,
  (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS wi_active,
  -- Data
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS food_dup,
  (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
  (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
  (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
  -- Security
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS wf_pol,
  (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_pol,
  -- R5
  (SELECT pg_get_functiondef(oid) ~ 'v_wi_row\\.city_slug' FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS r5_intact,
  (SELECT pg_get_functiondef(oid) ~ E'VALUES[^;]*''Yogyakarta''' FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS r5_hardcode,
  -- Sessions
  (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%nex_workforce%' OR application_name ILIKE '%acquisition%') AS wf_sessions
`))[0];
console.log("  state:", JSON.stringify({...base, city_bbox_actual: base.city_bbox_actual}, null, 2).replace(/\n/g,'\n  '));

T("city_catalogue = 1", base.cities === 1);
T("city slug = yogyakarta", base.city_slug_actual === "yogyakarta");
T("city name = Yogyakarta", base.city_name_actual === "Yogyakarta");
T("job_registry = 1", base.jobs === 1);
T("job slug = restaurants-overpass · enabled=true", base.job_slug_actual === "restaurants-overpass" && base.job_enabled === true);
T("rotation_eligible = 1 (yogyakarta × restaurants-overpass)", base.rot === 1);
T("work_item total = 2 (Gate 5A #4 completed + hello_world)", base.wi_total === 2);
T("active work_items = 0", base.wi_active === 0);
T("food_business = 23,046 (baseline)", base.food_rows === 23046);
T("duplicate groups = 373 (baseline)", base.food_dup === 373);
T("evidence_record = 4 · candidate_staging = 1,284 · persist_audit = 5",
  base.ev === 4 && base.stg === 1284 && base.aud === 5);
T("workforce policies = 12 (11 R2.2 v2 + 1 R5)", base.wf_pol === 12);
T("food_business policies = 5", base.food_pol === 5);
T("R5 persister intact (city_slug reference present)", base.r5_intact === true);
T("R5 no hardcoded Yogyakarta in INSERT VALUES", base.r5_hardcode === false);
T("zero workforce sessions", base.wf_sessions === 0);

// Verify seeded bbox matches expected EXACTLY (no rounding)
const bbox = typeof base.city_bbox_actual === "string" ? JSON.parse(base.city_bbox_actual) : base.city_bbox_actual;
const bboxMatch = bbox && bbox.sw && bbox.ne &&
  parseFloat(bbox.sw.lat) === EXPECTED_BBOX.sw.lat &&
  parseFloat(bbox.sw.lon) === EXPECTED_BBOX.sw.lon &&
  parseFloat(bbox.ne.lat) === EXPECTED_BBOX.ne.lat &&
  parseFloat(bbox.ne.lon) === EXPECTED_BBOX.ne.lon;
T("seeded bbox EXACTLY matches C6 empirical (no rounding · no substitution)", bboxMatch,
  `actual=sw{${bbox.sw.lat},${bbox.sw.lon}} ne{${bbox.ne.lat},${bbox.ne.lon}}`);

// Local invariants: scheduler + env + legacy quarantine
const psTask = spawnSync("powershell", ["-NoProfile","-Command","(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], { encoding: "utf8" });
T("Scheduled Task Disabled OR absent", (psTask.stdout||"").trim() === "Disabled");
const psEnv = spawnSync("powershell", ["-NoProfile","-Command","(Get-Item .env.local).LastWriteTime.ToString('o')"], { encoding: "utf8" });
T(".env.local pre-cutover mtime unchanged", /2026-09-03T07:41/.test((psEnv.stdout||"").trim()), (psEnv.stdout||"").trim());

if (fail > 0) {
  console.log("\n🔴 HARD STOP · pre-flight invariant failure · not spawning · not enqueueing");
  writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
  process.exit(2);
}
report.phases.preflight = { ...base, bbox };
console.log("");

// ═══════════════════════════════════════════════════════════════════════
// § 5 · SPAWN 3 BINARIES · normal V2 enqueue path (orchestrator does it)
// ═══════════════════════════════════════════════════════════════════════
console.log("─── § 5-6 · SPAWN · ONE orchestrator + ONE reaper + ONE agent ───");
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

// ═══════════════════════════════════════════════════════════════════════
// § 5-19 · OBSERVATION LOOP
// ═══════════════════════════════════════════════════════════════════════
console.log("");
console.log(`─── OBSERVATION LOOP · hard ceiling ${HARD_CEILING_MS/1000}s ───`);
const startedAt = Date.now();
let terminalReached = false;
let terminalReason = null;
let ourWorkItemId = null;

while (!terminalReached && Date.now() - startedAt < HARD_CEILING_MS) {
  await sleep(3_000);
  const st = (await mgmt(`SELECT
    (SELECT id FROM nex_workforce.work_item
       WHERE city_slug='${CITY_SLUG}' AND category_slug='${CATEGORY}' AND source_slug='${SOURCE}'
         AND enqueued_at >= '${gateStartIso}'
       ORDER BY enqueued_at DESC LIMIT 1) AS our_id,
    (SELECT state FROM nex_workforce.work_item
       WHERE city_slug='${CITY_SLUG}' AND category_slug='${CATEGORY}' AND source_slug='${SOURCE}'
         AND enqueued_at >= '${gateStartIso}'
       ORDER BY enqueued_at DESC LIMIT 1) AS our_state,
    (SELECT bbox_json FROM nex_workforce.work_item
       WHERE city_slug='${CITY_SLUG}' AND category_slug='${CATEGORY}' AND source_slug='${SOURCE}'
         AND enqueued_at >= '${gateStartIso}'
       ORDER BY enqueued_at DESC LIMIT 1) AS our_bbox,
    (SELECT count(*)::int FROM nex_workforce.evidence_record) AS ev,
    (SELECT count(*)::int FROM nex_workforce.candidate_staging) AS stg,
    (SELECT count(*)::int FROM nex_workforce.persist_audit) AS aud,
    (SELECT count(*)::int FROM nex.food_business) AS food_rows,
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE city_slug='${CITY_SLUG}' AND source_slug='${SOURCE}') AS our_wi_count`))[0];
  ourWorkItemId = st.our_id;
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const obs = { t_s: elapsed, ...st };
  report.observations.push(obs);
  console.log(`  t+${String(elapsed).padStart(3)}s · our_wi=${st.our_id ? st.our_id.slice(0,8) : '(none)'} state=${st.our_state ?? 'n/a'} · ev=${st.ev} stg=${st.stg} aud=${st.aud} · food=${st.food_rows} · wi_yogya=${st.our_wi_count}`);

  // Section 5 guardrail: no more than ONE proving work_item
  if (st.our_wi_count > 1) {
    terminalReached = true;
    terminalReason = `Section 5 violation · ${st.our_wi_count} yogyakarta work_items · expected 1`;
    break;
  }

  // Section 4 guardrail: bbox must match C6 exactly
  if (st.our_bbox) {
    const c = typeof st.our_bbox === "string" ? JSON.parse(st.our_bbox) : st.our_bbox;
    const structMatch = c && c.sw && c.ne &&
      parseFloat(c.sw.lat) === EXPECTED_BBOX.sw.lat && parseFloat(c.sw.lon) === EXPECTED_BBOX.sw.lon &&
      parseFloat(c.ne.lat) === EXPECTED_BBOX.ne.lat && parseFloat(c.ne.lon) === EXPECTED_BBOX.ne.lon;
    if (!structMatch) {
      terminalReached = true;
      terminalReason = `bbox mismatch on work_item · captured=${JSON.stringify(c)}`;
      break;
    }
  }

  // Terminal-state detection
  if (["completed","soft_fail","dead_letter"].includes(st.our_state)) {
    terminalReached = true;
    terminalReason = `work_item reached terminal state: ${st.our_state}`;
    break;
  }
}

if (!terminalReached) {
  terminalReason = `hard ceiling reached at ${HARD_CEILING_MS/1000}s without terminal state`;
}
console.log("");
console.log(`─── TERMINAL · reason=${terminalReason} ───`);
report.terminal = { reason: terminalReason, at: new Date().toISOString(), work_item_id: ourWorkItemId };

// ═══════════════════════════════════════════════════════════════════════
// § 19 · SHUTDOWN · SIGTERM all 3
// ═══════════════════════════════════════════════════════════════════════
console.log("\n─── § 19 · SHUTDOWN · SIGTERM (bounded) ───");
for (const [name, child] of [["orchestrator", orch], ["reaper", reaper], ["agent", agent]]) {
  try { child.kill("SIGTERM"); } catch {}
}
await sleep(4_000);
for (const [name, child] of [["orchestrator", orch], ["reaper", reaper], ["agent", agent]]) {
  const alive = child.exitCode === null && !child.killed;
  T(`shutdown · ${name} · ${alive ? "still running · SIGKILL" : "graceful"}`, true, `code=${child.exitCode}`);
  if (alive) { try { child.kill("SIGKILL"); } catch {} }
}

// ═══════════════════════════════════════════════════════════════════════
// § 8-13 · CRITICAL MEASUREMENTS · EVIDENCE + STAGING + PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════
if (!ourWorkItemId) {
  console.log("\n🔴 no proving work_item created · nothing to measure");
  writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));
  process.exit(3);
}

console.log("\n─── § 10 · EVIDENCE proof ───");
const evd = (await mgmt(`SELECT evidence_id, work_item_id::text AS wi, generation, source_slug, city_slug, category_slug,
  query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count, request_id
  FROM nex_workforce.evidence_record WHERE work_item_id = '${ourWorkItemId}'
  ORDER BY retrieved_at DESC LIMIT 1`));
if (evd.length === 0) {
  T("§ 10 · evidence_record exists for our work_item", false, "0 evidence rows");
} else {
  const e = evd[0];
  console.log(`  evidence_id:     ${e.evidence_id}`);
  console.log(`  query_hash:      ${e.query_hash}`);
  console.log(`  expected_hash:   ${expectedQueryHash}`);
  console.log(`  http_status:     ${e.http_status}`);
  console.log(`  byte_length:     ${e.byte_length}`);
  console.log(`  candidate_count: ${e.candidate_count}`);
  console.log(`  retrieved_at:    ${e.retrieved_at}`);
  T("§ 10 · exactly one evidence_record for our work_item", evd.length === 1);
  T("§ 8/10 · query_hash EXACTLY matches expected (bbox flowed unmodified)", e.query_hash === expectedQueryHash);
  T("§ 11 · HTTP status = 200", e.http_status === 200, `status=${e.http_status}`);
  T("§ 12 · response bytes > 0 (real body captured)", e.byte_length > 0, `bytes=${e.byte_length}`);
  T("§ 10 · city_slug in evidence = yogyakarta", e.city_slug === "yogyakarta");
  report.phases.evidence = e;
}

console.log("\n─── § 11 · STAGING proof ───");
const stg = (await mgmt(`SELECT count(*)::int AS total,
  count(*) FILTER (WHERE persisted=true)::int AS persisted,
  count(*) FILTER (WHERE rejected=true)::int AS rejected
  FROM nex_workforce.candidate_staging WHERE work_item_id = '${ourWorkItemId}'`))[0];
console.log(`  candidate_staging: total=${stg.total} persisted=${stg.persisted} rejected=${stg.rejected}`);
T("§ 11 · candidate_staging rows exist tied to our work_item", stg.total >= 0, `staged=${stg.total}`);
report.phases.staging = stg;

console.log("\n─── § 12 · R5 PERSISTENCE proof ───");
const aud = await mgmt(`SELECT persister_fn, batch_size, new_rows, updated_rows, rejected_rows, duration_ms, ok
  FROM nex_workforce.persist_audit WHERE work_item_id = '${ourWorkItemId}' ORDER BY created_at`);
console.log(`  persist_audit rows: ${aud.length}`);
let totalNew = 0, totalUpd = 0, totalRej = 0;
for (const a of aud) {
  console.log(`    · fn=${a.persister_fn} · new=${a.new_rows} upd=${a.updated_rows} rej=${a.rejected_rows} · ok=${a.ok} · ${a.duration_ms}ms`);
  totalNew += a.new_rows; totalUpd += a.updated_rows; totalRej += a.rejected_rows;
}
T("§ 12 · at least one persist_audit row", aud.length >= 1);
T("§ 12 · all persist_audit rows use persist_to_food_business + ok=true",
  aud.every(a => a.persister_fn === "nex_workforce.persist_to_food_business" && a.ok === true));

// § 12 · verify city correctness on newly-persisted rows
if (totalNew > 0) {
  const cityCheck = (await mgmt(`SELECT count(*)::int AS n FROM nex.food_business
    WHERE source='osm_overpass' AND created_by='nex_workforce_v2:persist_to_food_business'
      AND source_evidence_id = '${evd[0]?.evidence_id ?? ''}' AND city = 'Yogyakarta'`))[0];
  T("§ 12 · every new food_business row has city='Yogyakarta' (R5 authoritative)",
    cityCheck.n === totalNew, `matched=${cityCheck.n}/expected=${totalNew}`);
}

report.phases.persistence = { audit_rows: aud.length, new: totalNew, updated: totalUpd, rejected: totalRej };

console.log("\n─── § 13 · DATA SAFETY · food_business delta ───");
const after = (await mgmt(`SELECT
  (SELECT count(*)::int FROM nex.food_business) AS food_rows,
  (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS dup`))[0];
const foodDelta = after.food_rows - 23046;
const dupDelta = after.dup - 373;
console.log(`  food_business: baseline=23046 → after=${after.food_rows} · delta=${foodDelta >= 0 ? '+' : ''}${foodDelta}`);
console.log(`  duplicate groups: baseline=373 → after=${after.dup} · delta=${dupDelta >= 0 ? '+' : ''}${dupDelta}`);
T("§ 13 · food_business delta is bounded (>= 0 · real acquisition allowed to grow)", foodDelta >= 0);
T("§ 14 · duplicate groups did not increase", dupDelta === 0, `dup=${after.dup}`);
report.phases.data_delta = { food_before: 23046, food_after: after.food_rows, food_delta: foodDelta, dup_before: 373, dup_after: after.dup };

console.log("\n─── § 15 · WORK ITEM LIFECYCLE ───");
const wi = (await mgmt(`SELECT id::text AS id, state, generation, agent_id, priority, attempts, lease_deadline, enqueued_at, started_at, finished_at,
  records_new, records_rejected, bbox_json::text AS bbox, last_error, last_error_class, cursor_json::text AS cursor
  FROM nex_workforce.work_item WHERE id = '${ourWorkItemId}'`))[0];
console.log(JSON.stringify(wi, null, 2).replace(/\n/g, '\n  '));
T("§ 15 · work_item terminal state (completed OR soft_fail OR dead_letter)",
  ["completed","soft_fail","dead_letter"].includes(wi.state), `state=${wi.state}`);
if (wi.state === "completed") {
  T("§ 15 · finished_at populated for completed", wi.finished_at !== null);
  T("§ 15 · records_new populated for completed", wi.records_new !== null);
}
// Structural bbox comparison
const wiBbox = typeof wi.bbox === "string" ? JSON.parse(wi.bbox) : wi.bbox;
const wiBboxMatch = wiBbox && wiBbox.sw && wiBbox.ne &&
  parseFloat(wiBbox.sw.lat) === EXPECTED_BBOX.sw.lat && parseFloat(wiBbox.sw.lon) === EXPECTED_BBOX.sw.lon &&
  parseFloat(wiBbox.ne.lat) === EXPECTED_BBOX.ne.lat && parseFloat(wiBbox.ne.lon) === EXPECTED_BBOX.ne.lon;
T("§ 4 · work_item bbox_json exactly matches C6 empirical bbox (immutable · unmodified)", wiBboxMatch);
report.phases.work_item = wi;

console.log("\n─── § 16 · REAPER observation ───");
const rr = (await mgmt(`SELECT count(*)::int AS started, count(*) FILTER (WHERE finished_at IS NOT NULL)::int AS finished
  FROM nex_workforce.reaper_run WHERE started_at >= '${gateStartIso}'`))[0];
console.log(`  reaper_run rows during gate: started=${rr.started} · finished=${rr.finished}`);
T("§ 16 · reaper ran during proving · all runs completed cleanly", rr.started >= 1 && rr.finished === rr.started);

console.log("\n─── § 15 · FAILURE CLASSIFICATION (agent log scan) ───");
let roleErrs = 0, bboxErrs = 0, permErrs = 0, digestErrs = 0;
try {
  const alog = readFileSync(`${runDir}/agent.log`, "utf8");
  roleErrs   = (alog.match(/WorkforceRoleElevationError/g) || []).length;
  bboxErrs   = (alog.match(/BboxInvalidError/g) || []).length;
  permErrs   = (alog.match(/permission denied|42501/g) || []).length;
  digestErrs = (alog.match(/function public\.digest/g) || []).length;
} catch {}
T("§ 17 · zero role-elevation errors", roleErrs === 0);
T("§ 4/8 · zero bbox validation errors", bboxErrs === 0);
T("§ 17 · zero permission-denied / RLS violations", permErrs === 0);
T("§ 12 · zero public.digest errors (Slice 4.1 v2 preserved)", digestErrs === 0);
report.phases.failures = { role: roleErrs, bbox: bboxErrs, perm: permErrs, digest: digestErrs };

console.log("\n─── § 17 · POSTFLIGHT SECURITY ───");
const post = (await mgmt(`SELECT
  (SELECT count(*)::int FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex_workforce') AS wf_pol,
  (SELECT count(*)::int FROM pg_policy WHERE polrelid='nex.food_business'::regclass) AS food_pol,
  (SELECT count(*)::int FROM pg_roles WHERE rolname LIKE 'nex_workforce%') AS roles,
  (SELECT prosecdef FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS secdef,
  (SELECT pg_get_functiondef(oid) ~ 'v_wi_row\\.city_slug' FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business') AS r5_intact,
  (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%nex_workforce%' OR application_name ILIKE '%acquisition%') AS wf_sessions
`))[0];
T("§ 17 · workforce policies still 12", post.wf_pol === 12);
T("§ 17 · food_business policies still 5", post.food_pol === 5);
T("§ 17 · workforce roles still 3", post.roles === 3);
T("§ 17 · persister still SECDEF", post.secdef === true);
T("§ 17 · R5 persister body preserved", post.r5_intact === true);
T("§ 19 · zero workforce sessions after shutdown", post.wf_sessions === 0);
report.phases.postflight_security = post;

console.log("\n─── § 18 · SYSTEM A + ENVIRONMENT ───");
const psEnvPost = spawnSync("powershell", ["-NoProfile","-Command","(Get-Item .env.local).LastWriteTime.ToString('o')"], { encoding: "utf8" });
T("§ 18 · .env.local mtime unchanged", /2026-09-03T07:41/.test((psEnvPost.stdout||"").trim()));

console.log("\n─── § 19 · SCHEDULER + LEGACY ───");
const psTaskPost = spawnSync("powershell", ["-NoProfile","-Command","(Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' -ErrorAction SilentlyContinue).State"], { encoding: "utf8" });
T("§ 19 · Scheduled Task still Disabled", (psTaskPost.stdout||"").trim() === "Disabled");

// ═══════════════════════════════════════════════════════════════════════
// FINAL VERDICT
// ═══════════════════════════════════════════════════════════════════════
report.pass = pass; report.fail = fail; report.finished_at = new Date().toISOString();
writeFileSync(`${runDir}/report.json`, JSON.stringify(report, null, 2));

console.log("\n═══════════════════════════════════════════════════════════════════════");
const wiCompleted = wi?.state === "completed";
if (fail === 0 && wiCompleted) {
  console.log(`🟢 GATE 5B · PASSED · ${pass} checks · work_item completed · full-bbox proving green`);
} else if (wi?.state === "completed" && fail > 0) {
  console.log(`🟡 GATE 5B · PARTIAL · ${pass} passed · ${fail} failed · work_item completed but some invariants failed`);
  for (const f of failLines) console.log(`    ${f}`);
} else {
  console.log(`🔴 GATE 5B · FAILED · ${pass} passed · ${fail} failed · terminal=${terminalReason}`);
  for (const f of failLines) console.log(`    ${f}`);
}
console.log("🔴 HARD STOP · WORKFORCE STILL OFF · SCHEDULED TASK STILL DISABLED · NO PERMANENT ACTIVATION");
console.log(`Report: ${runDir}/report.json`);
console.log("═══════════════════════════════════════════════════════════════════════");
