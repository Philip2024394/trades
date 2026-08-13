#!/usr/bin/env node
// six-worker-proveout.mjs · Wave 8 evidence-gathering runner · v2
//
// PURPOSE
// Per Philip 2026-08-09: "the production worker should be rebuilt
// against [the new stack] · then prove all six: Mason → Blake → Rowan
// → Avery/Harper → Iris in the actual production execution
// environment."
//
// This runner captures the EVIDENCE required for Wave 8 sign-off. It
// runs against WHATEVER worker topology is live (currently local dev
// on port 3008). When production topology is deployed, the same runner
// runs against that endpoint · same criteria · same evidence format.
//
// v2 CHANGES (Philip 2026-08-09 corrections):
//   1. Four-state result model: PASS · FAIL · BLOCKED · TEST-HARNESS-ERROR
//      · PASS   · criterion met with fresh evidence
//      · FAIL   · criterion measurable but not met
//      · BLOCKED · criterion cannot be measured (missing dependency,
//                  outside this environment · e.g. real provider
//                  failure requires a controlled fault injection)
//      · TEST-HARNESS-ERROR · runner itself broke measuring (bug or
//                  network error) · does NOT reflect on worker
//   2. Fresh-evidence rule: proof requires activity in the last N
//      minutes, not historical rows alone. Runner fires a fresh
//      end-to-end cycle FIRST · then measures heartbeats + audit +
//      results against a FRESH_WINDOW_MS window.
//   3. Iris criterion recognises Part-B llm-checked marker
//      (provider="llm-checked" with ms=null is a valid completion).
//   4. audit_log queries hit Supabase (where the brain still lives),
//      not our Postgres (empty until Wave 5 backfill).
//   5. Object-storage flag grep tolerates line-wrap in the source.
//
// USAGE:
//   node scripts/six-worker-proveout.mjs
//   NEX_APP_URL=https://your-prod-url node scripts/six-worker-proveout.mjs
//   NEX_PROVEOUT_FRESH_MINUTES=5 node scripts/six-worker-proveout.mjs
//
// EXIT CODES:
//   0 · every criterion PASS or BLOCKED (with reason) · sign-off ready
//   2 · at least one FAIL · gaps present · not ready
//   1 · TEST-HARNESS-ERROR count > 0 OR fatal · runner needs fix
//
// GUARDRAILS:
//   · READ-ONLY against production data (Supabase never modified)
//   · Only new writes are ONE disposable inbox item + resulting
//     knowledge_record (both tagged so they can be manually removed)
//   · No env-var mutations · no deployments · no fly commands

import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import pg from "pg";
const { Pool } = pg;

const ENV = readFileSync(".env.local", "utf8");
const APP_URL     = process.env.NEX_APP_URL || "http://localhost:3008";
const CRON_SECRET = (ENV.match(/^CRON_SECRET=(\S+)/m) || [])[1] || "";
const NEX_URL     = (ENV.match(/^NEXT_PUBLIC_NEX_SUPABASE_URL=(\S+)/m) || [])[1];
const NEX_KEY     = (ENV.match(/^NEX_SUPABASE_SERVICE_ROLE_KEY=(\S+)/m) || [])[1];
const PG_URL      = (ENV.match(/^NEX_POSTGRES_URL=(\S+)/m) || [])[1]
                  || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const FRESH_MIN   = Number(process.env.NEX_PROVEOUT_FRESH_MINUTES ?? 5);
const FRESH_MS    = FRESH_MIN * 60 * 1000;

const pool = new Pool({ connectionString: PG_URL, max: 2 });

const WORKERS = [
  { type: "knowledge-context",   persona: "Mason",  llm: "no-llm",       expectsInputRef: true },
  { type: "voice-context",       persona: "Blake",  llm: "no-llm",       expectsInputRef: true },
  { type: "learning-context",    persona: "Rowan",  llm: "no-llm",       expectsInputRef: true },
  { type: "knowledge-extractor", persona: "Avery",  llm: "real",         expectsInputRef: true },
  { type: "image-analyst",       persona: "Harper", llm: "real",         expectsInputRef: true },
  { type: "quality-checker",     persona: "Iris",   llm: "llm-checked",  expectsInputRef: true },
];

const results = [];
function record(id, state, note = "") {
  results.push({ id, state, note });
  const marker =
    state === "PASS"     ? "✅ PASS " :
    state === "FAIL"     ? "❌ FAIL " :
    state === "BLOCKED"  ? "⏸ BLOCK " :
                            "⚠ TEST-HARNESS-ERROR ";
  process.stdout.write(`  ${marker} ${id}${note ? " · " + note : ""}\n`);
}
function section(name) {
  process.stdout.write(`\n─── ${name} ───\n`);
}

async function supaRest(path) {
  const r = await fetch(`${NEX_URL}/rest/v1/${path}`, {
    headers: { "apikey": NEX_KEY, "Authorization": `Bearer ${NEX_KEY}` },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => "")}`);
  return r.json();
}

async function main() {
  process.stdout.write("═══════════════════════════════════════════════════════════════\n");
  process.stdout.write("  SIX-WORKER PROVE-OUT · Wave 8 · v2 · fresh-evidence rule\n");
  process.stdout.write(`  app:            ${APP_URL}\n`);
  process.stdout.write(`  supa (brain):   ${NEX_URL ? NEX_URL.replace(/https:\/\//, "").slice(0, 40) : "(unset)"}\n`);
  process.stdout.write(`  pg (nex.*):     ${PG_URL.replace(/:[^:@]+@/, ":****@")}\n`);
  process.stdout.write(`  fresh window:   ${FRESH_MIN} minute(s)\n`);
  process.stdout.write("═══════════════════════════════════════════════════════════════\n");

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 0 · Fire fresh end-to-end BEFORE measuring
  //             (heartbeats + audit + results all need fresh data)
  // ═══════════════════════════════════════════════════════════════════
  section("0 · Fire fresh end-to-end cycle FIRST (creates the evidence)");

  const stamp = Date.now();
  let e2eItemId = null;
  let e2eOk = false;
  let e2eImageItemId = null;
  let e2eImageOk = false;

  // --- 0a · Text E2E (exercises Mason/Blake/Rowan/Avery/Iris)
  try {
    const content = `six-worker-proveout v2 · text E2E · ${stamp} · Baluster spacing on staircases must not permit a 100mm sphere to pass through per BS 6180. Unique nonce: ${stamp}.`;
    const upload = await fetch(`${APP_URL}/api/nex/knowledge-inbox/dump`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "chatgpt-approved", title: `proveout-v2-${stamp}`, content }),
    }).then((r) => r.json());
    e2eItemId = upload.item?.id;
    if (!e2eItemId) {
      record("0.text-upload", "TEST-HARNESS-ERROR", `dump route returned no item: ${JSON.stringify(upload).slice(0, 200)}`);
    } else {
      record("0.text-upload", "PASS", `inbox item ${e2eItemId}`);
    }
  } catch (err) {
    record("0.text-upload", "TEST-HARNESS-ERROR", `text E2E upload failed: ${err.message}`);
  }

  // --- 0b · Image E2E (exercises Harper) via multipart upload
  //          Append a unique trailing marker (past PNG IEND · decoders
  //          ignore it) so the sha256 hash changes each run and the
  //          upload isn't rejected as duplicate.
  const testImage = "data/knowledge-inbox/files/nx_msktgg7n_1d2da8e3-badge-04.png";
  try {
    if (!existsSync(testImage)) {
      record("0.image-upload", "BLOCKED", `test image not present at ${testImage} · Harper freshness will be BLOCKED`);
    } else {
      const basePng = readFileSync(testImage);
      const uniqueTrailer = Buffer.from(`NEX-PROVEOUT-V2-STAMP-${stamp}`, "utf8");
      const bytes = Buffer.concat([basePng, uniqueTrailer]);
      const fd = new FormData();
      const blob = new Blob([bytes], { type: "image/png" });
      fd.append("source", "personal-ideas");
      fd.append("forcedKind", "image");
      fd.append("files", blob, `proveout-v2-${stamp}-${basename(testImage)}`);
      const uploadRes = await fetch(`${APP_URL}/api/nex/knowledge-inbox/upload`, { method: "POST", body: fd });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      const created = uploadJson?.created?.[0] || uploadJson?.item;
      const duplicated = uploadJson?.duplicates?.[0];
      if (created?.id) {
        e2eImageItemId = created.id;
        record("0.image-upload", "PASS", `image inbox item ${e2eImageItemId}`);
      } else if (duplicated?.id) {
        record("0.image-upload", "TEST-HARNESS-ERROR",
          `hash still deduplicated despite unique trailer · dup=${duplicated.id}`);
      } else {
        record("0.image-upload", "TEST-HARNESS-ERROR",
          `upload route returned no item · status=${uploadRes.status} body=${JSON.stringify(uploadJson).slice(0, 200)}`);
      }
    }
  } catch (err) {
    record("0.image-upload", "TEST-HARNESS-ERROR", `image E2E upload failed: ${err.message}`);
  }

  // --- 0c · Fire cron-tick ONCE to process both items
  //          (may need multiple ticks because pipeline stages are async)
  try {
    if (!e2eItemId && !e2eImageItemId) {
      record("0.cron", "BLOCKED", "no items uploaded · nothing to tick for");
    } else {
      const cronRuns = 3;  // three ticks to give staged pipeline time
      let lastDt = 0, lastDuration = 0;
      for (let i = 0; i < cronRuns; i++) {
        const t0 = Date.now();
        const tick = await fetch(`${APP_URL}/api/nex/brain/cron-tick`, {
          headers: { "Authorization": `Bearer ${CRON_SECRET}` },
        }).then((r) => r.json());
        lastDt = Date.now() - t0;
        lastDuration = tick.cycle?.duration_ms ?? 0;
        if (!tick.ok) {
          record(`0.cron[${i}]`, "FAIL", `cron-tick returned ok:false · ${JSON.stringify(tick).slice(0, 200)}`);
          break;
        }
      }
      record("0.cron", "PASS", `${cronRuns} ticks · last=${lastDt}ms · last-duration_ms=${lastDuration}`);
      e2eOk = !!e2eItemId;
      e2eImageOk = !!e2eImageItemId;
    }
  } catch (err) {
    record("0.cron", "TEST-HARNESS-ERROR", `cron-tick failed: ${err.message}`);
  }

  const freshCutoff = new Date(Date.now() - FRESH_MS).toISOString();

  // ═══════════════════════════════════════════════════════════════════
  // SECTION A · Per-worker recent-completion · MUST be within fresh window
  // ═══════════════════════════════════════════════════════════════════
  section(`A · Per-worker completion evidence · MUST be within last ${FRESH_MIN} minutes`);

  for (const w of WORKERS) {
    try {
      const rows = await supaRest(`worker_results?worker_type=eq.${w.type}&created_at=gte.${freshCutoff}&select=llm_provider,llm_model,llm_ms,llm_tokens_in,llm_tokens_out,created_at,output_kind,flags&order=created_at.desc&limit=1`);
      const latest = rows[0];
      if (!latest) {
        record(`A.${w.persona}`, "FAIL", `no worker_result within fresh window · pipeline did not exercise this worker`);
        continue;
      }
      // Per-worker LLM expectation
      let hasCorrectShape = false;
      let reason = "";
      if (w.llm === "no-llm") {
        hasCorrectShape = latest.llm_provider === "no-llm";
        reason = `provider=${latest.llm_provider}` + (hasCorrectShape ? "" : " (expected no-llm)");
      } else if (w.llm === "real") {
        hasCorrectShape = latest.llm_provider && latest.llm_provider !== "no-llm" && Number(latest.llm_ms) > 0;
        reason = `provider=${latest.llm_provider} · ms=${latest.llm_ms} · tokens=${latest.llm_tokens_in ?? 0}→${latest.llm_tokens_out ?? 0}`;
      } else if (w.llm === "llm-checked") {
        // Iris · Part-B marker · ms may be null · what matters is
        // provider="llm-checked" AND output_kind="quality_report"
        hasCorrectShape = latest.llm_provider === "llm-checked" && latest.output_kind === "quality_report";
        reason = `provider=${latest.llm_provider} · output=${latest.output_kind}` + (hasCorrectShape ? " (Part-B marker correct)" : "");
      }
      record(`A.${w.persona}`, hasCorrectShape ? "PASS" : "FAIL",
        `at=${latest.created_at.slice(11, 19)} · ${reason}`);
    } catch (err) {
      record(`A.${w.persona}`, "TEST-HARNESS-ERROR", `Supabase query failed: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION B · Heartbeat freshness · after H fired · must be fresh
  // ═══════════════════════════════════════════════════════════════════
  section(`B · Heartbeat freshness · MUST be within last ${FRESH_MIN} minutes`);

  try {
    const beats = await supaRest("worker_heartbeats?select=host_id,last_seen_at,cycles_total,last_cycle_summary&order=last_seen_at.desc&limit=50");
    const now = Date.now();
    for (const w of WORKERS) {
      const matching = beats.filter((b) =>
        b.host_id.startsWith(`${w.type}@`)
        || (b.last_cycle_summary && b.last_cycle_summary.worker_type === w.type)
      );
      if (matching.length === 0) {
        record(`B.${w.persona}`, "FAIL", "no heartbeat found · worker not observed");
        continue;
      }
      matching.sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at));
      const latest = matching[0];
      const ageMs = now - new Date(latest.last_seen_at).getTime();
      const ageSec = Math.round(ageMs / 1000);
      // Fresh window for heartbeats specifically · a healthy worker
      // heartbeats every cycle (~5s) so freshness threshold is TIGHT
      const state = ageMs < FRESH_MS ? "PASS" : "FAIL";
      record(`B.${w.persona}`, state,
        `host=${latest.host_id.slice(0, 30)} · age=${ageSec}s · cycles=${latest.cycles_total}`);
    }
  } catch (err) {
    for (const w of WORKERS) record(`B.${w.persona}`, "TEST-HARNESS-ERROR", `heartbeat query failed: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION C · Audit trail per worker · Supabase (brain still lives there)
  // ═══════════════════════════════════════════════════════════════════
  section(`C · Audit trail evidence · Supabase audit_log · last ${FRESH_MIN} minutes`);

  for (const w of WORKERS) {
    try {
      const rows = await supaRest(`audit_log?actor=like.${w.type}%25&created_at=gte.${freshCutoff}&select=action,created_at&order=created_at.desc&limit=1`);
      if (rows.length === 0) {
        record(`C.${w.persona}`, "FAIL", `0 audit events in fresh window`);
      } else {
        record(`C.${w.persona}`, "PASS", `latest: ${rows[0].action} at ${rows[0].created_at.slice(11, 19)}`);
      }
    } catch (err) {
      record(`C.${w.persona}`, "TEST-HARNESS-ERROR", `audit query failed: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION D · Duplicate prevention · static + live
  // ═══════════════════════════════════════════════════════════════════
  section("D · Duplicate prevention (STATIC grep + LIVE resubmit)");

  try {
    const store = readFileSync("src/lib/nex/knowledge-inbox/storage.ts", "utf8");
    const hasFind = /export async function findByHash/.test(store)
                 && /if \(existing\) return \{ item: existing, deduplicated: true \}/.test(store);
    record("D.static", hasFind ? "PASS" : "FAIL", "findByHash + deduplicated:true shape in storage.ts");
  } catch (err) { record("D.static", "TEST-HARNESS-ERROR", `read failed: ${err.message}`); }

  try {
    const uniqueContent = `six-worker-proveout · v2 dedup test · ${Date.now()}`;
    const r1 = await fetch(`${APP_URL}/api/nex/knowledge-inbox/dump`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "personal-ideas", title: "proveout-dup-v2", content: uniqueContent }),
    }).then((r) => r.json());
    const r2 = await fetch(`${APP_URL}/api/nex/knowledge-inbox/dump`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "personal-ideas", title: "proveout-dup-v2", content: uniqueContent }),
    }).then((r) => r.json());
    const deduped = r2.deduplicated === true && r1.item?.id === r2.item?.id;
    record("D.live", deduped ? "PASS" : "FAIL",
      deduped ? `dedup returns same id (${r1.item?.id})` : `dedup broken · r1=${r1.item?.id} r2=${r2.item?.id}`);
  } catch (err) { record("D.live", "TEST-HARNESS-ERROR", `dedup live test: ${err.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION E · Retry lifecycle · pg + supa
  // ═══════════════════════════════════════════════════════════════════
  section("E · Retry lifecycle (LIVE)");

  try {
    // Brain is on Supabase currently · retry queue lives there
    const supaRetries = await supaRest("llm_retry_queue?select=status");
    const byStatus = {};
    for (const r of supaRetries) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const succeeded = byStatus.succeeded ?? 0;
    record("E.supa-lifecycle", succeeded > 0 ? "PASS" : "BLOCKED",
      `Supabase llm_retry_queue: ${JSON.stringify(byStatus)}${succeeded > 0 ? "" : " (no succeeded rows yet)"}`);
  } catch (err) { record("E.supa-lifecycle", "TEST-HARNESS-ERROR", `supa query failed: ${err.message}`); }

  try {
    // Also check our pg (post-backfill this becomes primary)
    const r = await pool.query(`SELECT status, COUNT(*)::int AS n FROM nex.llm_retry_queue GROUP BY status`);
    const byStatus = Object.fromEntries(r.rows.map((x) => [x.status, x.n]));
    const succeeded = byStatus.succeeded ?? 0;
    record("E.pg-lifecycle", succeeded > 0 ? "PASS" : "BLOCKED",
      `pg nex.llm_retry_queue: ${JSON.stringify(byStatus)}${succeeded > 0 ? "" : " (empty · will populate at Wave 5 backfill)"}`);
  } catch (err) { record("E.pg-lifecycle", "TEST-HARNESS-ERROR", `pg query failed: ${err.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION F · Object storage retrieval
  // ═══════════════════════════════════════════════════════════════════
  section("F · Object storage retrieval (STATIC + LIVE)");

  try {
    const worker = readFileSync("src/lib/nex/brain/workers/image-analyst.ts", "utf8");
    // The runtime flag is built via template literal `bytes:${byteSource}`
    // where byteSource is assigned in two branches. Validate the SOURCE
    // shape, not the concatenated literal.
    const usesAdapter      = /getObjectStorage\(\)\.get\(objectBucket, objectKey\)/.test(worker);
    const assignsObjSource = /byteSource\s*=\s*["`]nex-object-storage["`]/.test(worker);
    const assignsFsSource  = /byteSource\s*=\s*["`]filesystem-legacy["`]/.test(worker);
    const emitsBytesFlag   = /`bytes:\$\{byteSource\}`/.test(worker);
    const allFour = usesAdapter && assignsObjSource && assignsFsSource && emitsBytesFlag;
    record("F.static", allFour ? "PASS" : "FAIL",
      `adapter=${usesAdapter} · obj-assign=${assignsObjSource} · fs-assign=${assignsFsSource} · flag-template=${emitsBytesFlag}`);
  } catch (err) { record("F.static", "TEST-HARNESS-ERROR", `read failed: ${err.message}`); }

  try {
    const rows = await supaRest(`worker_results?worker_type=eq.image-analyst&created_at=gte.${freshCutoff}&select=flags,created_at&order=created_at.desc&limit=5`);
    const objRun = rows.find((r) => (r.flags || []).some((f) => String(f).startsWith("bytes:nex-object-storage")));
    if (objRun) {
      record("F.live", "PASS", `fresh object-storage read at ${objRun.created_at.slice(11, 19)}`);
    } else if (rows.length === 0) {
      if (e2eImageOk) {
        record("F.live", "FAIL", `image E2E fired but no image-analyst worker_result appeared in fresh window · Harper pipeline broken`);
      } else {
        record("F.live", "BLOCKED", `image E2E fire did not queue · Harper freshness cannot be measured`);
      }
    } else {
      record("F.live", "FAIL", `image-analyst ran but bytes: flag not present · ${rows.length} rows checked · flags=${JSON.stringify(rows.map((r) => r.flags))}`);
    }
  } catch (err) { record("F.live", "TEST-HARNESS-ERROR", `object-storage evidence query failed: ${err.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION G · Concurrency + SKIP LOCKED + retry-recovery
  // ═══════════════════════════════════════════════════════════════════
  section("G · Concurrency + SKIP LOCKED + retry-recovery (STATIC + LIVE)");

  try {
    const migration = readFileSync("deploy/postgres/init/041_nex_brain_schema.sql", "utf8");
    record("G.skip-locked", /FOR UPDATE SKIP LOCKED/i.test(migration) ? "PASS" : "FAIL",
      "nex.claim_next_job uses FOR UPDATE SKIP LOCKED");
  } catch (err) { record("G.skip-locked", "TEST-HARNESS-ERROR", `read failed: ${err.message}`); }

  try {
    // Fresh evidence of retry-recovery is hard without inducing a fault.
    // Check whether any recovery has been observed EVER · flag as BLOCKED
    // if only historical (matches Philip's rule: don't mark proven from
    // historical rows alone).
    const rows = await supaRest(`worker_jobs?attempts=gt.1&status=eq.completed&created_at=gte.${freshCutoff}&select=id,worker_type,attempts&limit=5`);
    if (rows.length > 0) {
      record("G.retry-recovery", "PASS", `${rows.length} fresh jobs completed after attempts>1`);
    } else {
      // Fall back to historical evidence · BLOCKED (not FAIL) because
      // proving fresh retry-recovery requires a controlled fault
      const hist = await supaRest("worker_jobs?attempts=gt.1&status=eq.completed&select=id&limit=1");
      if (hist.length > 0) {
        record("G.retry-recovery", "BLOCKED",
          "historical retry-recovery exists but no fresh evidence · requires controlled provider-failure test");
      } else {
        record("G.retry-recovery", "BLOCKED",
          "no retry-recovery ever observed · requires provider-failure test to prove");
      }
    }
  } catch (err) { record("G.retry-recovery", "TEST-HARNESS-ERROR", `retry query failed: ${err.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION H · Full end-to-end fresh trace (evidence for A + B + C)
  // ═══════════════════════════════════════════════════════════════════
  section("H · Full end-to-end fresh trace (composite · reuses SECTION 0's fires)");

  // Text-item worker chain
  if (!e2eOk || !e2eItemId) {
    record("H.mason",  "BLOCKED", "text E2E fire failed · downstream cannot be scored");
    record("H.blake",  "BLOCKED", "text E2E fire failed · downstream cannot be scored");
    record("H.rowan",  "BLOCKED", "text E2E fire failed · downstream cannot be scored");
    record("H.avery",  "BLOCKED", "text E2E fire failed · downstream cannot be scored");
    record("H.iris",   "BLOCKED", "text E2E fire failed · downstream cannot be scored");
  } else {
    try {
      const rows = await supaRest(`worker_jobs?input_ref=eq.${e2eItemId}&select=worker_type,status,attempts,last_error&order=created_at.asc`);
      const byType = Object.fromEntries(rows.map((r) => [r.worker_type, r]));
      const check = (persona, type) => {
        const r = byType[type];
        if (!r) return record(`H.${persona}`, "FAIL", `no worker_job row for ${type} · pipeline did not queue this stage`);
        if (r.status !== "completed") return record(`H.${persona}`, "FAIL", `${type} status=${r.status}${r.last_error ? " err=" + r.last_error.slice(0, 60) : ""}`);
        return record(`H.${persona}`, "PASS", `${type} completed · attempts=${r.attempts}`);
      };
      check("mason", "knowledge-context");
      check("blake", "voice-context");
      check("rowan", "learning-context");
      check("avery", "knowledge-extractor");
      // Iris uses record_id as input_ref (not inbox item) · verify via audit
      const irisAudit = await supaRest(`audit_log?actor=like.quality-checker%25&created_at=gte.${freshCutoff}&select=action,created_at&order=created_at.desc&limit=1`);
      record("H.iris", irisAudit.length > 0 ? "PASS" : "FAIL",
        irisAudit.length > 0 ? `quality-checker fired: ${irisAudit[0].action} at ${irisAudit[0].created_at.slice(11, 19)}` : "no quality-checker audit in fresh window");
    } catch (err) {
      record("H.text-chain", "TEST-HARNESS-ERROR", `text-chain query failed: ${err.message}`);
    }
  }

  // Image-item worker chain (Harper)
  if (!e2eImageOk || !e2eImageItemId) {
    record("H.harper", "BLOCKED", "image E2E fire did not queue · Harper cannot be scored");
  } else {
    try {
      const rows = await supaRest(`worker_jobs?input_ref=eq.${e2eImageItemId}&select=worker_type,status,attempts,last_error&order=created_at.asc`);
      const harper = rows.find((r) => r.worker_type === "image-analyst");
      if (!harper) {
        record("H.harper", "FAIL", `no image-analyst worker_job for input_ref=${e2eImageItemId} · dispatch did not queue Harper`);
      } else if (harper.status !== "completed") {
        record("H.harper", "FAIL", `image-analyst status=${harper.status}${harper.last_error ? " err=" + harper.last_error.slice(0, 60) : ""}`);
      } else {
        record("H.harper", "PASS", `image-analyst completed · attempts=${harper.attempts}`);
      }
    } catch (err) {
      record("H.harper", "TEST-HARNESS-ERROR", `image-chain query failed: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  const pass = results.filter((r) => r.state === "PASS").length;
  const fail = results.filter((r) => r.state === "FAIL").length;
  const blocked = results.filter((r) => r.state === "BLOCKED").length;
  const harness = results.filter((r) => r.state === "TEST-HARNESS-ERROR").length;
  const total = results.length;

  process.stdout.write("\n═══════════════════════════════════════════════════════════════\n");
  process.stdout.write(`  Wave 8 · ${total} criteria total\n`);
  process.stdout.write(`    ✅ PASS:               ${pass}\n`);
  process.stdout.write(`    ❌ FAIL:               ${fail}\n`);
  process.stdout.write(`    ⏸  BLOCKED (reason):   ${blocked}\n`);
  process.stdout.write(`    ⚠  TEST-HARNESS-ERROR: ${harness}\n`);
  const verdict =
    harness > 0 ? "RUNNER-BROKEN · fix test-harness errors first" :
    fail > 0    ? "GAPS PRESENT · specific criteria failed" :
    blocked > 0 ? "PARTIAL · every measurable criterion passed · BLOCKED items need controlled tests to close" :
                  "SIX-WORKER PROVE-OUT PASSES on this topology";
  process.stdout.write(`  Verdict: ${verdict}\n`);
  process.stdout.write("═══════════════════════════════════════════════════════════════\n");
  process.stdout.write("\nSemantics:\n");
  process.stdout.write("  · PASS    = criterion met with fresh evidence in last " + FRESH_MIN + " min\n");
  process.stdout.write("  · FAIL    = criterion measurable but not met\n");
  process.stdout.write("  · BLOCKED = cannot be measured in this environment (needs controlled test)\n");
  process.stdout.write("  · TEST-HARNESS-ERROR = runner itself broke · not a worker failure\n");
  process.stdout.write("\n  A pass on local dev does NOT constitute a pass on production. Re-run\n");
  process.stdout.write("  against production URL once the new worker topology is deployed.\n");

  await pool.end();
  // Exit code: 0 only if all PASS or BLOCKED-with-reason · 1 if harness broke · 2 if FAIL
  if (harness > 0) process.exit(1);
  if (fail > 0) process.exit(2);
  process.exit(0);
}

main().catch(async (err) => {
  console.error("six-worker-proveout fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
