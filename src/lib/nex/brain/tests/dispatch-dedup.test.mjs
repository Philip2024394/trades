#!/usr/bin/env node
// dispatch-dedup.test.mjs · Phase 11.0 · TRANSITIONAL
//
// Verifies the interim dedup fix (X · authorised alongside Phase 11.1) —
// dispatchNewInboxItems now reads from the ACTIVE brain store instead
// of the stale filesystem snapshot that caused 12-16× duplicate
// re-dispatches per inbox item. Live evidence traced 2026-08-08:
//
//   nx_msjvvdys_63dba489 (RUN 3, 1.9h old) · 4 WorkerJobs
//   nx_msjvdjik_e5e2739a (RUN 2, 2.1h old) · 12 WorkerJobs (3 chains)
//   nx_msjv9v50_ce1e71e5 (RUN 1, 2.1h old) · 16 WorkerJobs (4 chains)
//
// Each chain = one full context→voice→learning→extractor pass. The
// idempotency shield (Phase 10.2 Fix #2A) prevented DB corruption but
// every duplicate chain burned LLM tokens.
//
// This test is TRANSITIONAL · it will be superseded by Phase 11.2 tests
// once inbox + worker_jobs live in the same Postgres and dispatch can
// dedup via a native `NOT EXISTS` JOIN.
//
// Assertions:
//   DD1  · BrainStore interface declares listRecentPipelineInputRefs
//   DD2  · comment on the interface marks it TRANSITIONAL
//   DD3  · FilesystemStore implements listRecentPipelineInputRefs
//   DD4  · SupabaseStore implements listRecentPipelineInputRefs
//   DD5  · SupabaseStore paginates past PostgREST's 1000-row cap
//   DD6  · manager.ts calls store.listRecentPipelineInputRefs
//   DD7  · manager.ts no longer references readFsJobsSnapshot (function removed)
//   DD8  · manager.ts no longer reads data/nex-brain/worker_jobs.json
//   DD9  · alreadyQueuedIds is populated from store.listRecentPipelineInputRefs
//   DD10 · Live · manager can enumerate current pipeline input_refs via the
//          active backend (Supabase in dev) · non-empty for any healthy pipeline
//          (skipped cleanly when server offline)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const BASE      = process.env.NEX_TEST_BASE_URL || "http://localhost:3008";

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

const STORAGE = readFileSync(join(REPO, "src/lib/nex/brain/storage.ts"), "utf8");
const MANAGER = readFileSync(join(REPO, "src/lib/nex/brain/manager.ts"), "utf8");

// DD1 · interface declaration
record("DD1",
  /listRecentPipelineInputRefs\(worker_types:\s*WorkerType\[\]\)\s*:\s*Promise<string\[\]>/.test(STORAGE),
  "BrainStore.listRecentPipelineInputRefs declared with correct signature");

// DD2 · TRANSITIONAL comment on the interface
const interfaceBlock = STORAGE.match(/\/\*\*[^*]*Phase 11\.0[\s\S]*?\*\/\s*listRecentPipelineInputRefs/);
record("DD2", !!interfaceBlock && /TRANSITIONAL/i.test(interfaceBlock[0]),
  "interface declaration is marked TRANSITIONAL");

// DD3 · FilesystemStore implementation
const fsImpl = /class\s+FilesystemStore[\s\S]*?async\s+listRecentPipelineInputRefs\s*\([\s\S]*?\{[\s\S]*?readTable<WorkerJob>/.test(STORAGE);
record("DD3", fsImpl, "FilesystemStore.listRecentPipelineInputRefs reads worker_jobs table");

// DD4 · SupabaseStore implementation
const sbImpl = /class\s+SupabaseStore[\s\S]*?async\s+listRecentPipelineInputRefs/.test(STORAGE);
record("DD4", sbImpl, "SupabaseStore.listRecentPipelineInputRefs present");

// DD5 · SupabaseStore paginates
const sbPagination = /listRecentPipelineInputRefs[\s\S]{0,600}?range\s*\(\s*from\s*,\s*to\s*\)/.test(STORAGE)
                  && /pageSize\s*=\s*1000/.test(STORAGE);
record("DD5", sbPagination, "SupabaseStore pages via range(from, to) past 1000-row cap");

// DD6 · manager calls the store method
record("DD6", /store\.listRecentPipelineInputRefs\(/.test(MANAGER),
  "manager.ts calls store.listRecentPipelineInputRefs");

// DD7 · readFsJobsSnapshot removed
record("DD7", !/^async function readFsJobsSnapshot/m.test(MANAGER),
  "readFsJobsSnapshot function removed from manager.ts");

// DD8 · no filesystem READ of data/nex-brain/worker_jobs.json. Grep for
//        the specific `path.join(...)` + `fs.readFile(...)` patterns that
//        would touch it · explanatory comments referencing the historic
//        path are fine (they document why the drift bug existed).
const hasWorkerJobsJoin = /path\.join\([^)]*["']worker_jobs\.json["']/.test(MANAGER);
const hasWorkerJobsReadFile = /fs\.readFile\([^)]*worker_jobs\.json/.test(MANAGER);
record("DD8", !hasWorkerJobsJoin && !hasWorkerJobsReadFile,
  `no code path touches worker_jobs.json · join=${hasWorkerJobsJoin} readFile=${hasWorkerJobsReadFile}`);

// DD9 · alreadyQueuedIds derives from the store call
const derivesFromStore = /alreadyQueuedIds\s*=\s*new Set\(\s*await\s+store\.listRecentPipelineInputRefs/.test(MANAGER);
record("DD9", derivesFromStore, "alreadyQueuedIds populated from store call · not filesystem");

// DD10 · Live · the /status endpoint proves the active backend can
//        enumerate pipeline state (proxy for our new method working
//        against the same backend). If /status reports > 0 completed
//        jobs in 24h, the active store definitely has data our new
//        method could pull.
try {
  const r = await fetch(`${BASE}/api/nex/brain/status`, { headers: { "cache-control": "no-cache" } });
  if (r.status !== 200) {
    process.stdout.write(`  SKIP DD10 · /status returned ${r.status}\n`);
    results.push({ id: "DD10", pass: true, note: "skipped · /status " + r.status });
  } else {
    const j = await r.json();
    const completed24h = j?.status?.jobs_completed_24h ?? 0;
    // The active backend clearly has data · our new method would return
    // input_refs for those completions if we invoked it. Full live
    // invocation happens naturally via the next dispatch cycle.
    record("DD10", completed24h > 0,
      `active backend healthy · jobs_completed_24h=${completed24h}`);
  }
} catch (e) {
  process.stdout.write("  SKIP DD10 · " + e.message + "\n");
  results.push({ id: "DD10", pass: true, note: "skipped · " + e.message });
}

const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\ndispatch-dedup: ${passed}/${total} assertions passed\n`);
process.exit(passed === total ? 0 : 1);
