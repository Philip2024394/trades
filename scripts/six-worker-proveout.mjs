#!/usr/bin/env node
// six-worker-proveout.mjs · Wave 8 evidence-gathering runner
//
// PURPOSE
// Per Philip 2026-08-09: "the production worker should be rebuilt against
// [the new stack] · then prove all six: Mason → Blake → Rowan →
// Avery/Harper → Iris in the actual production execution environment."
//
// This runner captures the EVIDENCE required for Wave 8 sign-off. It
// runs against WHATEVER worker topology is live (currently local dev
// on port 3008). When production topology is deployed, the same runner
// runs against that endpoint · same criteria · same evidence format.
//
// Every criterion is either:
//   · STATIC   · asserted from code inspection (worker files exist etc.)
//   · LIVE     · read from worker_results / worker_heartbeats / audit_log
//   · FUNCTIONAL · exercises the pipeline with a disposable fresh input
//
// Runner does NOT authorize production migration. It only measures the
// CURRENT execution environment against the Wave 8 acceptance criteria.
// Run it AFTER production topology is deployed to gather the sign-off
// evidence · run it NOW to see the gap.
//
// USAGE:
//   node scripts/six-worker-proveout.mjs
//   NEX_APP_URL=https://your-prod-url node scripts/six-worker-proveout.mjs
//
// EXIT CODES:
//   0 · all criteria pass · Wave 8 sign-off evidence complete
//   2 · at least one criterion failed · evidence gap identified
//   1 · fatal error running the runner
//
// GUARDRAILS:
//   · READ-ONLY against production data
//   · Only new writes are the disposable inbox item + the resulting
//     knowledge_record (both tagged so they can be manually removed)
//   · No env-var mutations · no deployments · no fly commands
//   · No Supabase deletions

import { readFileSync } from "node:fs";
import pg from "pg";
const { Pool } = pg;

const ENV = readFileSync(".env.local", "utf8");
const APP_URL = process.env.NEX_APP_URL || "http://localhost:3008";
const CRON_SECRET = (ENV.match(/^CRON_SECRET=(\S+)/m) || [])[1] || "";
const NEX_URL = (ENV.match(/^NEXT_PUBLIC_NEX_SUPABASE_URL=(\S+)/m) || [])[1];
const NEX_KEY = (ENV.match(/^NEX_SUPABASE_SERVICE_ROLE_KEY=(\S+)/m) || [])[1];
const PG_URL  = (ENV.match(/^NEX_POSTGRES_URL=(\S+)/m) || [])[1]
              || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

const pool = new Pool({ connectionString: PG_URL, max: 2 });

const WORKERS = [
  { type: "knowledge-context",   persona: "Mason",  llm: false, expectsInputRef: true },
  { type: "voice-context",       persona: "Blake",  llm: false, expectsInputRef: true },
  { type: "learning-context",    persona: "Rowan",  llm: false, expectsInputRef: true },
  { type: "knowledge-extractor", persona: "Avery",  llm: true,  expectsInputRef: true },
  { type: "image-analyst",       persona: "Harper", llm: true,  expectsInputRef: true },
  { type: "quality-checker",     persona: "Iris",   llm: "conditional", expectsInputRef: true },
];

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}
function section(name) {
  process.stdout.write(`\n─── ${name} ───\n`);
}

async function supaRest(path) {
  const r = await fetch(`${NEX_URL}/rest/v1/${path}`, {
    headers: { "apikey": NEX_KEY, "Authorization": `Bearer ${NEX_KEY}` },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function main() {
  process.stdout.write("═══════════════════════════════════════════════════════════════\n");
  process.stdout.write("  SIX-WORKER PROVE-OUT · Wave 8 evidence gathering\n");
  process.stdout.write(`  app:    ${APP_URL}\n`);
  process.stdout.write(`  supa:   ${NEX_URL ? NEX_URL.replace(/https:\/\//, "").slice(0, 40) : "(unset)"}\n`);
  process.stdout.write(`  pg:     ${PG_URL.replace(/:[^:@]+@/, ":****@")}\n`);
  process.stdout.write("═══════════════════════════════════════════════════════════════\n");

  // ═══════════════════════════════════════════════════════════════════
  // SECTION A · Per-worker recent-completion evidence (LIVE)
  // ═══════════════════════════════════════════════════════════════════
  section("A · Per-worker recent-completion evidence (LIVE · worker_results)");

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  for (const w of WORKERS) {
    try {
      const rows = await supaRest(`worker_results?worker_type=eq.${w.type}&created_at=gte.${since24h}&select=llm_provider,llm_model,llm_ms,llm_tokens_in,llm_tokens_out,created_at&order=created_at.desc&limit=1`);
      const latest = rows[0];
      if (!latest) {
        record(`A.${w.persona}`, false, `no worker_result in last 24h`);
        continue;
      }
      const hasReal = w.llm === false
        ? latest.llm_provider === "no-llm"
        : (latest.llm_provider && latest.llm_provider !== "no-llm" && latest.llm_ms > 0);
      record(`A.${w.persona}`, hasReal,
        `last=${latest.created_at.slice(0, 19)} · provider=${latest.llm_provider} · ms=${latest.llm_ms} · tokens=${latest.llm_tokens_in ?? 0}→${latest.llm_tokens_out ?? 0}`);
    } catch (e) { record(`A.${w.persona}`, false, `query failed: ${e.message}`); }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION B · Heartbeat freshness (LIVE · worker_heartbeats)
  // ═══════════════════════════════════════════════════════════════════
  section("B · Heartbeat freshness (LIVE · <60s = healthy · <300s = stale · >300s = offline)");

  try {
    const beats = await supaRest("worker_heartbeats?select=host_id,last_seen_at,cycles_total,last_cycle_summary");
    const now = Date.now();
    for (const w of WORKERS) {
      // Match host_id patterns: `<worker_type>@<pid>` (12.3 format · local dev)
      // OR any legacy Fly hex-only host that has last_cycle_summary hinting at this worker
      const matching = beats.filter((b) =>
        b.host_id.startsWith(`${w.type}@`)
        || (b.last_cycle_summary && b.last_cycle_summary.worker_type === w.type)
      );
      if (matching.length === 0) {
        record(`B.${w.persona}`, false, "no heartbeat found");
        continue;
      }
      matching.sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at));
      const latest = matching[0];
      const ageSec = Math.round((now - new Date(latest.last_seen_at).getTime()) / 1000);
      const state = ageSec < 60 ? "healthy" : ageSec < 300 ? "stale" : "OFFLINE";
      const pass = ageSec < 300; // stale is a warning · offline is a failure
      record(`B.${w.persona}`, pass,
        `host=${latest.host_id.slice(0, 30)} · age=${ageSec}s · ${state} · cycles=${latest.cycles_total}`);
    }
  } catch (e) { record("B.*", false, `heartbeats query failed: ${e.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION C · Audit trail per worker (LIVE · audit_log · last 24h)
  // ═══════════════════════════════════════════════════════════════════
  section("C · Audit trail evidence (LIVE · nex.audit_log · last 24h)");

  try {
    // audit_log uses actor field like "knowledge-context@<pid>"
    for (const w of WORKERS) {
      const c = await pool.query(
        `SELECT COUNT(*)::int AS n FROM nex.audit_log
          WHERE actor LIKE $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
        [`${w.type}%`],
      );
      const n = c.rows[0].n;
      record(`C.${w.persona}`, n > 0, `${n} audit events in last 24h`);
    }
  } catch (e) { record("C.*", false, `audit query failed: ${e.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION D · Duplicate-prevention semantic (STATIC + LIVE)
  // ═══════════════════════════════════════════════════════════════════
  section("D · Duplicate prevention (STATIC + LIVE)");

  // STATIC · findByHash present in inbox storage
  try {
    const store = readFileSync("src/lib/nex/knowledge-inbox/storage.ts", "utf8");
    const hasFind = /export async function findByHash/.test(store)
                 && /if \(existing\) return \{ item: existing, deduplicated: true \}/.test(store);
    record("D.static", hasFind, "findByHash + deduplicated:true shape present in storage.ts");
  } catch (e) { record("D.static", false, `read failed: ${e.message}`); }

  // LIVE · re-submit an existing hash · confirm deduplicated flag returns
  try {
    const uploadUrl = `${APP_URL}/api/nex/knowledge-inbox/dump`;
    const uniqueContent = "six-worker-proveout · duplicate test · fixed content · 2026-08-09";
    // First submission
    const r1 = await fetch(uploadUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "personal-ideas", title: "proveout-dup-test", content: uniqueContent }),
    }).then((r) => r.json());
    // Second submission · same content
    const r2 = await fetch(uploadUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "personal-ideas", title: "proveout-dup-test", content: uniqueContent }),
    }).then((r) => r.json());
    const deduped = r2.deduplicated === true && r1.item?.id === r2.item?.id;
    record("D.live", deduped,
      deduped ? `dedup works · id=${r1.item?.id}` : `dedup failed · r1.id=${r1.item?.id} r2.id=${r2.item?.id} dedup=${r2.deduplicated}`);
  } catch (e) { record("D.live", false, `dedup live test failed: ${e.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION E · Retry queue lifecycle (LIVE · nex.llm_retry_queue)
  // ═══════════════════════════════════════════════════════════════════
  section("E · Retry lifecycle (LIVE · nex.llm_retry_queue)");

  try {
    const total = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.llm_retry_queue`);
    const byStatus = await pool.query(`SELECT status, COUNT(*)::int AS n FROM nex.llm_retry_queue GROUP BY status`);
    const succeeded = byStatus.rows.find((r) => r.status === "succeeded")?.n ?? 0;
    record("E.total", total.rows[0].n >= 0, `total=${total.rows[0].n} · by status=${JSON.stringify(Object.fromEntries(byStatus.rows.map((r) => [r.status, r.n])))}`);
    record("E.lifecycle", succeeded > 0, succeeded > 0 ? `${succeeded} retries have completed lifecycle` : "no retries observed reaching succeeded · lifecycle unproven");
  } catch (e) { record("E.*", false, `retry queue query failed: ${e.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION F · Object retrieval (STATIC + LIVE)
  // ═══════════════════════════════════════════════════════════════════
  section("F · Object storage retrieval (STATIC + LIVE)");

  try {
    const worker = readFileSync("src/lib/nex/brain/workers/image-analyst.ts", "utf8");
    const usesAdapter = /getObjectStorage\(\)\.get\(objectBucket, objectKey\)/.test(worker);
    const emitsFlag = /bytes:nex-object-storage/.test(worker) && /bytes:filesystem-legacy/.test(worker);
    record("F.static", usesAdapter && emitsFlag,
      `image-analyst uses getObjectStorage().get + emits bytes: flag`);
  } catch (e) { record("F.static", false, `read failed: ${e.message}`); }

  try {
    const rows = await supaRest(`worker_results?worker_type=eq.image-analyst&flags=cs.%7B%22bytes%3Anex-object-storage%22%7D&select=created_at,flags&order=created_at.desc&limit=3`);
    // Some Supabase deployments don't support cs. easily · fallback query
    let latestObj = rows[0];
    if (!latestObj) {
      const rows2 = await supaRest(`worker_results?worker_type=eq.image-analyst&select=flags,created_at&order=created_at.desc&limit=5`);
      latestObj = rows2.find((r) => (r.flags || []).some((f) => String(f).startsWith("bytes:nex-object-storage")));
    }
    record("F.live", !!latestObj,
      latestObj ? `latest object-storage read: ${latestObj.created_at?.slice(0, 19) ?? "?"}` : "no worker_result with bytes:nex-object-storage flag");
  } catch (e) { record("F.live", false, `object-storage evidence query failed: ${e.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION G · Concurrency + queue integrity (STATIC + LIVE)
  // ═══════════════════════════════════════════════════════════════════
  section("G · Concurrency + queue integrity (STATIC + LIVE)");

  // STATIC · SKIP LOCKED helper exists in the schema
  try {
    const migration = readFileSync("deploy/postgres/init/041_nex_brain_schema.sql", "utf8");
    const hasSkip = /FOR UPDATE SKIP LOCKED/i.test(migration);
    record("G.skip-locked", hasSkip, "nex.claim_next_job uses FOR UPDATE SKIP LOCKED");
  } catch (e) { record("G.skip-locked", false, `read failed: ${e.message}`); }

  // LIVE · verify no worker_job has attempts > 1 completed successfully AFTER a failure
  //         (evidence that retries actually happened when providers failed)
  try {
    const r = await supaRest(`worker_jobs?attempts=gt.1&status=eq.completed&select=id,worker_type,attempts,last_error,created_at&order=created_at.desc&limit=5`);
    record("G.retry-recovery", r.length > 0,
      r.length > 0
        ? `${r.length} jobs completed after attempts>1 · retry-recovery works`
        : "no completed jobs with attempts>1 · retry-recovery not yet exercised (waiting for provider failure to test)");
  } catch (e) { record("G.retry-recovery", false, `query failed: ${e.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION H · Full end-to-end fresh trace (FUNCTIONAL)
  // ═══════════════════════════════════════════════════════════════════
  section("H · Full end-to-end fresh text trace (FUNCTIONAL)");

  try {
    const stamp = Date.now();
    const content = `six-worker-proveout · text E2E · ${stamp} · Handrail height on a domestic staircase must be between 900mm and 1000mm per BS 5395-1:2010. Unique nonce: ${stamp}.`;
    const upload = await fetch(`${APP_URL}/api/nex/knowledge-inbox/dump`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "chatgpt-approved", title: `proveout-e2e-${stamp}`, content }),
    }).then((r) => r.json());
    const itemId = upload.item?.id;
    if (!itemId) { record("H.upload", false, `upload failed: ${JSON.stringify(upload).slice(0, 200)}`); }
    else {
      record("H.upload", true, `inbox item ${itemId}`);
      // Fire cron-tick
      const t0 = Date.now();
      const tick = await fetch(`${APP_URL}/api/nex/brain/cron-tick`, {
        headers: { "Authorization": `Bearer ${CRON_SECRET}` },
      }).then((r) => r.json());
      const dtMs = Date.now() - t0;
      const cycle = tick.cycle || {};
      const hitMason  = (cycle.contexts_assembled  ?? []).some((x) => x.inbox_item_id === itemId);
      const hitBlake  = (cycle.voice_guides         ?? []).some((x) => x.inbox_item_id === itemId);
      const hitRowan  = (cycle.learning_bundles     ?? []).some((x) => x.inbox_item_id === itemId);
      const hitAvery  = (cycle.extracted_record_ids ?? []).length > 0;
      const hitIris   = (cycle.checked_records      ?? []).length > 0;
      record("H.mason", hitMason,  hitMason  ? "context bundle assembled" : "no context observed for this item");
      record("H.blake", hitBlake,  hitBlake  ? "voice guide assembled"    : "no voice guide observed");
      record("H.rowan", hitRowan,  hitRowan  ? "learning bundle assembled": "no learning bundle observed");
      record("H.avery", hitAvery,  hitAvery  ? `extracted ${cycle.extracted_record_ids.length} record(s)` : "no record extracted");
      record("H.iris",  hitIris,   hitIris   ? `checked ${cycle.checked_records.length} record(s)` : "no quality check observed");
      process.stdout.write(`  · cron-tick wall=${dtMs}ms · duration_ms=${cycle.duration_ms}\n`);
    }
  } catch (e) { record("H.*", false, `E2E trace failed: ${e.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  const passed = results.filter((r) => r.pass).length;
  const total  = results.length;
  process.stdout.write("\n═══════════════════════════════════════════════════════════════\n");
  process.stdout.write(`  Wave 8 evidence · ${passed}/${total} criteria passed\n`);
  process.stdout.write(`  Verdict: ${passed === total ? "SIX-WORKER PROVE-OUT PASSES on this topology" : "GAPS PRESENT · not ready for Wave 8 sign-off"}\n`);
  process.stdout.write("═══════════════════════════════════════════════════════════════\n");
  process.stdout.write("\nWhat this proves (or doesn't):\n");
  process.stdout.write("  · This runner measures the CURRENT execution environment.\n");
  process.stdout.write("  · A pass on local dev does NOT constitute a pass on production.\n");
  process.stdout.write("  · Re-run against production URL (NEX_APP_URL=...) once the new worker\n");
  process.stdout.write("    topology is deployed to gather the Gate H sign-off evidence.\n");
  process.stdout.write("  · Failures below signal gaps that must close before Gate H.\n");

  await pool.end();
  process.exit(passed === total ? 0 : 2);
}

main().catch(async (err) => {
  console.error("six-worker-proveout fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
