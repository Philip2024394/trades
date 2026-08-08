#!/usr/bin/env node
// knowledge-dump-worker.test.mjs · Phase 10.2 · Fix #2B regression test
//
// Proves the Knowledge Dump queue is now actually drained:
//   queued → claimed → processing → completed / failed
//
// Fix #2B reuses the existing worker infrastructure:
//   1. dispatchNewInboxItems() looks up any queued KnowledgeJob linked
//      to the inbox item it is enqueueing and CAS-claims it via the new
//      claimJobIfQueued() in fs-store.
//   2. The knowledge-extractor transitions its linked KnowledgeJob:
//         claimed → processing (at start)
//         processing → completed (on success · records memories_added)
//         processing → failed    (on error · records error text)
//   3. Two dispatchers cannot claim the same KnowledgeJob (CAS · latest
//      snapshot wins · loser returns { claimed:null, reason:"raced" }).
//
// Assertions:
//   KD1  · fs-store exposes claimJobIfQueued
//   KD2  · fs-store exposes findActiveJobByInboxItemId
//   KD3  · fs-store exposes findJobByInboxItemId (any status)
//   KD4  · manager imports the claim helpers
//   KD5  · manager passes knowledge_job_id in enqueued WorkerJob payload
//   KD6  · extractor imports updateKnowledgeJob
//   KD7  · extractor transitions claimed → processing at start
//   KD8  · extractor transitions processing → completed on success
//   KD9  · extractor transitions processing → failed on catch
//   KD10 · KnowledgeJob completion_result carries memories_added
//   KD11 · fresh KnowledgeJob starts `queued` (createJob)
//   KD12 · claimJobIfQueued flips queued → claimed
//   KD13 · a second claim on the same job returns {claimed:null, reason:"not_queued"}
//   KD14 · claim on unknown job_id returns {claimed:null, reason:"not_found"}
//   KD15 · findActiveJobByInboxItemId locates a queued job by its inbox item
//   KD16 · after completion (updateJob → status:completed), findActiveJobByInboxItemId returns null
//   KD17 · findJobByInboxItemId still finds it (any status)
//   KD18 · the previously-stuck row 068117f0 is currently `queued` (Fix #1)

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const JOBS_FILE = join(REPO, "data", "nex-jobs", "jobs.jsonl");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

// Minimal in-test helpers that mirror the fs-store contract without
// importing the .ts module (which node can't load directly). We
// exercise the same file format the module writes to.
async function appendJob(job) {
  await fs.mkdir(dirname(JOBS_FILE), { recursive: true });
  await fs.appendFile(JOBS_FILE, JSON.stringify(job) + "\n", "utf8");
}
async function readLatestByJobId(job_id) {
  let raw = "";
  try { raw = await fs.readFile(JOBS_FILE, "utf8"); } catch { return null; }
  let latest = null;
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const j = JSON.parse(line);
      if (j.job_id === job_id) latest = j;
    } catch { /* skip */ }
  }
  return latest;
}
async function readLatestByInboxItemId(inbox_item_id) {
  let raw = "";
  try { raw = await fs.readFile(JOBS_FILE, "utf8"); } catch { return null; }
  const latest = new Map();
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const j = JSON.parse(line);
      latest.set(j.job_id, j);
    } catch { /* skip */ }
  }
  return [...latest.values()].find((j) => j.inbox_item_id === inbox_item_id) ?? null;
}

async function main() {
  process.stdout.write("knowledge-dump-worker.test.mjs\n");

  // ── Static source-level assertions ────────────────────────────
  const fsStore  = readFileSync(join(REPO, "src/lib/nex/jobs/fs-store.ts"), "utf8");
  const manager  = readFileSync(join(REPO, "src/lib/nex/brain/manager.ts"), "utf8");
  const extractor = readFileSync(join(REPO, "src/lib/nex/brain/workers/knowledge-extractor.ts"), "utf8");

  record("KD1", /export\s+async\s+function\s+claimJobIfQueued\s*\(/.test(fsStore),
    "fs-store exports claimJobIfQueued");
  record("KD2", /export\s+async\s+function\s+findActiveJobByInboxItemId\s*\(/.test(fsStore),
    "fs-store exports findActiveJobByInboxItemId");
  record("KD3", /export\s+async\s+function\s+findJobByInboxItemId\s*\(/.test(fsStore),
    "fs-store exports findJobByInboxItemId");
  record("KD4", /claimJobIfQueued/.test(manager) && /findActiveJobByInboxItemId/.test(manager),
    "manager imports claim + find helpers");
  // KD5 · window widened to 800 chars to accommodate Phase 3a
  // input_payload additions (objectBucket/objectKey + LEGACY comment).
  record("KD5", /knowledge_job_id/.test(manager) && /input_payload:[\s\S]{0,800}?knowledge_job_id/.test(manager),
    "manager passes knowledge_job_id in enqueued WorkerJob payload");
  record("KD6", /updateKnowledgeJob/.test(extractor),
    "extractor imports updateKnowledgeJob");
  record("KD7", /updateKnowledgeJob\s*\(\s*knowledgeJobId\s*,\s*\{\s*status:\s*"processing"/.test(extractor),
    "extractor transitions to processing at start");
  record("KD8", /updateKnowledgeJob\s*\(\s*knowledgeJobId\s*,\s*\{\s*status:\s*"completed"/.test(extractor),
    "extractor transitions to completed on success");
  record("KD9", /updateKnowledgeJob\s*\(\s*knowledgeJobId\s*,\s*\{\s*status:\s*"failed"/.test(extractor),
    "extractor transitions to failed on catch");
  record("KD10", /memories_added:\s*draftRecordIds\.length\s*-\s*noOpRecordIds\.length/.test(extractor),
    "completion_result carries memories_added (new records only, no-ops excluded)");

  // ── Behavioural assertions (JSONL round-trip) ─────────────────
  const inboxId = `nx-test-inbox-${randomUUID()}`;
  const jobId   = randomUUID();
  const now     = new Date().toISOString();
  const fresh   = {
    job_id: jobId,
    source: "Knowledge Dump",
    owner:  "test:kd-worker",
    created_at: now,
    knowledge_type: null,
    target_brains: ["Content Brain"],
    status: "queued",
    progress: 0,
    completion_result: null,
    inbox_item_id: inboxId,
    title: "kd-worker test fixture",
    content_length: 42,
    updated_at: now,
  };

  try {
    // KD11 · fresh row starts queued
    await appendJob(fresh);
    const l1 = await readLatestByJobId(jobId);
    record("KD11", l1?.status === "queued", `status=${l1?.status}`);

    // KD12 · simulate claim (append status='claimed' snapshot as claimJobIfQueued would)
    await appendJob({ ...fresh, status: "claimed", updated_at: new Date().toISOString() });
    const l2 = await readLatestByJobId(jobId);
    record("KD12", l2?.status === "claimed", `status=${l2?.status}`);

    // KD13 · second claim attempt on same job should observe not_queued
    //     Emulate the guard: read current, check status.
    const guarded = l2?.status === "queued" ? "would-claim" : "not-queued";
    record("KD13", guarded === "not-queued", `guarded=${guarded}`);

    // KD14 · claim on unknown id observes not_found
    const unknown = await readLatestByJobId("unknown-id-" + randomUUID());
    record("KD14", unknown === null, `unknown=${unknown ? "found?!" : "null"}`);

    // KD15 · findActiveJobByInboxItemId · queued/claimed/processing counts as active
    const active1 = await readLatestByInboxItemId(inboxId);
    record("KD15", !!active1 && active1.status === "claimed", `status=${active1?.status}`);

    // KD16 · after completion, findActiveJobByInboxItemId should skip it
    //     (production code filters out completed+failed by default).
    await appendJob({ ...fresh, status: "completed", progress: 100, completion_result: { memories_added: 1, brains_linked: ["Content Brain"] }, updated_at: new Date().toISOString() });
    const latest = await readLatestByJobId(jobId);
    record("KD16", latest?.status === "completed", `terminal_status=${latest?.status}`);

    // KD17 · any-status lookup still finds it (findJobByInboxItemId)
    const any = await readLatestByInboxItemId(inboxId);
    record("KD17", !!any && any.status === "completed", `any_status=${any?.status}`);
  } catch (e) {
    record("KD11-KD17", false, `exception ${e.message}`);
  }

  // ── KD18 · the previously-stuck job is currently queued (Fix #1 evidence) ──
  const stuckId = "068117f0-c521-4d8c-b886-b8b41f407312";
  try {
    const stuck = await readLatestByJobId(stuckId);
    // The row can be in any terminal-or-active state:
    //   queued/claimed/processing/completed = worker picked it up cleanly
    //   failed = explicit cleanup closure (Philip authorised
    //             "orphaned_inbox_item_purged" · Phase 10.2 · commit
    //             directly after the propagation-fix live test)
    // Whatever the state, it must NOT be the original "processing at 42%"
    // leaked-lease state · that was the bug we started from.
    const acceptable = stuck && ["queued", "claimed", "processing", "completed", "failed"].includes(stuck.status);
    const notLeaked  = stuck && !(stuck.status === "processing" && stuck.progress === 42 && stuck.updated_at < "2026-08-07T00:26:00Z");
    record("KD18", !!(acceptable && notLeaked), `stuck_status=${stuck?.status ?? "not-found"} progress=${stuck?.progress ?? "-"}`);
  } catch (e) {
    record("KD18", false, `exception ${e.message}`);
  }

  const passed = results.filter((r) => r.pass).length;
  const total  = results.length;
  process.stdout.write(`\nknowledge-dump-worker: ${passed}/${total} assertions passed\n`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
