#!/usr/bin/env node
// reverse-shadow.test.mjs · Wave 7
//
// Proves the MirrorToSupabaseBrainStore decorator:
//   1. Passes reads straight through to the primary
//   2. Mirrors mutations to the secondary after primary succeeds
//   3. Never throws to the caller when secondary mirror fails
//   4. Only activates when NEX_BRAIN_SHADOW_SUPABASE=1 AND
//      NEX_BRAIN_BACKEND=postgres AND Supabase is configured
//
// Runs entirely against in-memory fake BrainStore instances · no live
// Supabase writes · no live pg writes. This is a UNIT proof of the
// decorator's semantics. Runtime activation is proven separately by
// exercising the storage.ts selector.
//
// Assertions (RS1-RS15):
//   RS1  · shadow file present · exports MirrorToSupabaseBrainStore
//   RS2  · shadow file present · exports isReverseShadowEnabled
//   RS3  · isReverseShadowEnabled is a strict AND of both flags
//   RS4  · every mutation method wraps primary + mirror
//   RS5  · reads pass through to primary only
//   RS6  · storage.ts selector activates shadow only when gates align
//   RS7  · storage.ts uses lazy-require to avoid circular imports
//   RS8-RS12 · in-memory decorator exercise · primary called first ·
//              mirror called after · reads only touch primary
//   RS13 · mirror failure does NOT propagate to caller
//   RS14 · insertRecordIdempotent · mirror only fires when created=true
//   RS15 · claimNextJob does NOT mirror (would cause double-lease)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const SHADOW  = readFileSync(join(REPO, "src/lib/nex/brain/pg-to-supabase-shadow.ts"), "utf8");
const STORAGE = readFileSync(join(REPO, "src/lib/nex/brain/storage.ts"), "utf8");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

// ── STATIC ASSERTIONS ────────────────────────────────────────────────

// RS1 · decorator class exported
record("RS1",
  /export class MirrorToSupabaseBrainStore implements BrainStore/.test(SHADOW),
  "MirrorToSupabaseBrainStore exported");

// RS2 · gate helper exported
record("RS2",
  /export function isReverseShadowEnabled\(\)/.test(SHADOW),
  "isReverseShadowEnabled exported");

// RS3 · gate is strict AND of (opt-in env flag) AND (postgres is the active backend).
// Wave 11 · Step 10 · F12 · AI7 · updated to track the refactor: the
// postgres-backend check now flows through storage.ts's `activeBackend()`
// (not a raw NEX_BRAIN_BACKEND read here) so backend-selection semantics
// live in ONE place. The strict-AND invariant is preserved · this test
// still fails if the gate loses either clause.
const gateBlock = SHADOW.match(/export function isReverseShadowEnabled[\s\S]*?^\}/m)?.[0] ?? "";
const strictAnd =
  /NEX_BRAIN_SHADOW_SUPABASE === "1"/.test(gateBlock)
  && /activeBackend\(\)\s*===\s*"postgres"/.test(gateBlock)
  && /&&/.test(gateBlock);
record("RS3", strictAnd, "isReverseShadowEnabled is strict AND of both flags (SHADOW env + activeBackend()==='postgres')");

// RS4 · every mutation method wraps primary + mirror
const mutationMethods = [
  "insertRecord", "insertRecordIdempotent", "updateRecordStatus",
  "insertVersion", "insertEdge", "enqueueJob", "completeJob", "failJob",
  "insertResult", "insertSource", "insertConfidence", "insertContradiction",
  "insertDeprecation", "insertFeedback", "markFeedbackApplied", "insertAudit",
  "enqueueLlmRetry", "markLlmRetrySucceeded", "markLlmRetryPending",
  "markLlmRetryExhausted", "upsertHeartbeat",
];
const missingMirror = mutationMethods.filter((m) => {
  const methodBlock = SHADOW.match(new RegExp(`async ${m}\\([\\s\\S]*?^  \\}`, "m"))?.[0] ?? "";
  return !(
    new RegExp(`this\\.primary\\.${m}\\(`).test(methodBlock)
    && (new RegExp(`this\\.secondary\\.${m}\\(`).test(methodBlock)
        || /mirror\(/.test(methodBlock))
  );
});
record("RS4", missingMirror.length === 0,
  missingMirror.length === 0
    ? `all ${mutationMethods.length} mutation methods mirror to secondary`
    : `missing mirror in: ${missingMirror.join(", ")}`);

// RS5 · reads pass through to primary only · never mirror
const readMethods = [
  "getRecord", "listRecords", "listEdges", "countJobs",
  "listRecentPipelineInputRefs", "listConfidence", "listOpenContradictions",
  "listFeedback", "listAudit", "listLlmRetries", "listHeartbeats", "status",
];
const readsWithMirror = readMethods.filter((m) => {
  const methodBlock = SHADOW.match(new RegExp(`async ${m}\\([\\s\\S]*?^  \\}`, "m"))?.[0] ?? "";
  return /this\.secondary\.|mirror\(/.test(methodBlock);
});
record("RS5", readsWithMirror.length === 0,
  readsWithMirror.length === 0
    ? `all ${readMethods.length} read methods pass through to primary only`
    : `reads unexpectedly mirroring: ${readsWithMirror.join(", ")}`);

// RS6 · storage.ts selector composes the decorator only when gates align
const selectorBlock = STORAGE.match(/export function brainStore\(\)[\s\S]*?^\}/m)?.[0] ?? "";
const composed =
  /NEX_BRAIN_SHADOW_SUPABASE === "1"/.test(selectorBlock)
  && /isSupabaseConfigured\(\)/.test(selectorBlock)
  && /MirrorToSupabaseBrainStore/.test(selectorBlock)
  && /new PostgresBrainStore\(\)/.test(selectorBlock);
record("RS6", composed,
  "brainStore() composes MirrorToSupabaseBrainStore when both gates + Supabase config present");

// RS7 · lazy-require avoids circular imports
const usesLazyRequire =
  /require\("\.\/pg-to-supabase-shadow"\)/.test(selectorBlock)
  && !/^import.*pg-to-supabase-shadow/m.test(STORAGE);
record("RS7", usesLazyRequire,
  "storage.ts uses lazy require for pg-to-supabase-shadow · no top-level import");

// ── RUNTIME ASSERTIONS · in-memory fake BrainStore exercise ─────────

// Transpile the shadow module inline so we can instantiate the class
// without pulling the whole Next.js path aliases. We only need the
// class · types are erased at build time.
const stripped = SHADOW
  .replace(/^import[\s\S]*?;$/gm, "")
  .replace(/^export\s+/gm, "");
const transformed = await esbuild.transform(stripped, {
  loader: "ts",
  format: "cjs",
  target: "node20",
});
const mod = { exports: {} };
const fn = new Function("module", "process", "exports", "require", transformed.code + `
module.exports = { MirrorToSupabaseBrainStore, isReverseShadowEnabled };
`);
// Wave 11 GROUP B · mirror() now calls into observability counters +
// signals via lazy require. Provide no-op stubs so this unit test
// exercises the class in isolation (the observability integration is
// tested separately in observability-core.test.mjs).
const requireShim = (id) => {
  if (id === "@/lib/nex/observability/counters") {
    return { incr: () => {} };
  }
  if (id === "@/lib/nex/observability/signals") {
    return { emitSignal: () => {} };
  }
  return {};
};
fn(mod, process, mod.exports, requireShim);
const { MirrorToSupabaseBrainStore } = mod.exports;

// Build a fake BrainStore that records every call.
function makeFake(name, opts = {}) {
  const calls = [];
  const record = (method) => async (...args) => {
    calls.push({ method, args });
    if (opts.throwOn?.includes(method)) throw new Error(`fake-${name}-throws-${method}`);
    if (method.startsWith("list") || method.startsWith("count") || method === "listRecentPipelineInputRefs") return [];
    if (method === "claimNextJob" || method === "claimNextLlmRetry" || method === "getRecord" || method === "updateRecordStatus") return null;
    if (method === "insertRecordIdempotent") return { record: {}, created: opts.iderCreated ?? true };
    if (method === "status") return {};
    if (method.startsWith("mark") || method === "completeJob" || method === "failJob" || method === "upsertHeartbeat" || method === "markFeedbackApplied") return undefined;
    return {};
  };
  const store = {
    calls,
    name,
    insertRecord: record("insertRecord"),
    insertRecordIdempotent: record("insertRecordIdempotent"),
    getRecord: record("getRecord"),
    listRecords: record("listRecords"),
    updateRecordStatus: record("updateRecordStatus"),
    insertVersion: record("insertVersion"),
    insertEdge: record("insertEdge"),
    listEdges: record("listEdges"),
    enqueueJob: record("enqueueJob"),
    claimNextJob: record("claimNextJob"),
    completeJob: record("completeJob"),
    failJob: record("failJob"),
    countJobs: record("countJobs"),
    listRecentPipelineInputRefs: record("listRecentPipelineInputRefs"),
    insertResult: record("insertResult"),
    insertSource: record("insertSource"),
    insertConfidence: record("insertConfidence"),
    listConfidence: record("listConfidence"),
    insertContradiction: record("insertContradiction"),
    listOpenContradictions: record("listOpenContradictions"),
    insertDeprecation: record("insertDeprecation"),
    insertFeedback: record("insertFeedback"),
    listFeedback: record("listFeedback"),
    markFeedbackApplied: record("markFeedbackApplied"),
    insertAudit: record("insertAudit"),
    listAudit: record("listAudit"),
    enqueueLlmRetry: record("enqueueLlmRetry"),
    claimNextLlmRetry: record("claimNextLlmRetry"),
    markLlmRetrySucceeded: record("markLlmRetrySucceeded"),
    markLlmRetryPending: record("markLlmRetryPending"),
    markLlmRetryExhausted: record("markLlmRetryExhausted"),
    listLlmRetries: record("listLlmRetries"),
    upsertHeartbeat: record("upsertHeartbeat"),
    listHeartbeats: record("listHeartbeats"),
    status: record("status"),
  };
  return store;
}

const primary = makeFake("primary");
const secondary = makeFake("secondary");
const shadow = new MirrorToSupabaseBrainStore(primary, secondary);

// RS8 · insertRecord · both stores called · primary first
await shadow.insertRecord({ record_id: "rs-test-1" });
await new Promise((r) => setTimeout(r, 10)); // let fire-and-forget settle
record("RS8",
  primary.calls[0]?.method === "insertRecord" && secondary.calls[0]?.method === "insertRecord",
  `primary.calls[0]=${primary.calls[0]?.method} · secondary.calls[0]=${secondary.calls[0]?.method}`);

// RS9 · read (getRecord) · only primary
const primBefore = primary.calls.length;
const secBefore = secondary.calls.length;
await shadow.getRecord("rs-test-1");
await new Promise((r) => setTimeout(r, 10));
record("RS9",
  primary.calls.length === primBefore + 1
  && secondary.calls.length === secBefore
  && primary.calls[primary.calls.length - 1].method === "getRecord",
  `read routed to primary only · primary+1 · secondary unchanged`);

// RS10 · updateRecordStatus mirrors
await shadow.updateRecordStatus("rs-test-1", "AUTHORITATIVE", "test");
await new Promise((r) => setTimeout(r, 10));
const primLast = primary.calls[primary.calls.length - 1];
const secLast = secondary.calls[secondary.calls.length - 1];
record("RS10",
  primLast?.method === "updateRecordStatus" && secLast?.method === "updateRecordStatus",
  `both mirrored on update`);

// RS11 · insertResult mirrors
await shadow.insertResult({ job_id: "j", worker_type: "knowledge-context", worker_id: "w", output_kind: "context_bundle", output_payload: {}, llm_provider: "no-llm", llm_model: null, llm_tokens_in: null, llm_tokens_out: null, llm_ms: null, flags: [] });
await new Promise((r) => setTimeout(r, 10));
record("RS11",
  primary.calls[primary.calls.length - 1].method === "insertResult"
  && secondary.calls[secondary.calls.length - 1].method === "insertResult",
  "insertResult mirrored");

// RS12 · upsertHeartbeat mirrors
await shadow.upsertHeartbeat({ host_id: "w@1", last_seen_at: "2026-08-09T00:00:00Z", uptime_ms: 0, cycles_total: 0, cycles_failed: 0, last_error: null, last_cycle_summary: null, metadata: null });
await new Promise((r) => setTimeout(r, 10));
record("RS12",
  primary.calls[primary.calls.length - 1].method === "upsertHeartbeat"
  && secondary.calls[secondary.calls.length - 1].method === "upsertHeartbeat",
  "upsertHeartbeat mirrored");

// RS13 · mirror throw does NOT propagate
const throwingSecondary = makeFake("throwing", { throwOn: ["insertRecord"] });
const shadow2 = new MirrorToSupabaseBrainStore(primary, throwingSecondary);
let threw = false;
try { await shadow2.insertRecord({ record_id: "rs-test-throw" }); }
catch { threw = true; }
await new Promise((r) => setTimeout(r, 10));
record("RS13", !threw, threw ? "mirror throw PROPAGATED · REGRESSION" : "mirror throw contained");

// RS14 · insertRecordIdempotent mirrors only when created=true
const primIder = makeFake("primIder", { iderCreated: true });
const secIder = makeFake("secIder");
const shadowIder = new MirrorToSupabaseBrainStore(primIder, secIder);
await shadowIder.insertRecordIdempotent({ record_id: "rs-test-ider-1" });
await new Promise((r) => setTimeout(r, 10));
const secIderMirroredWhenCreated = secIder.calls.some((c) => c.method === "insertRecordIdempotent");

const primIder2 = makeFake("primIder2", { iderCreated: false });
const secIder2 = makeFake("secIder2");
const shadowIder2 = new MirrorToSupabaseBrainStore(primIder2, secIder2);
await shadowIder2.insertRecordIdempotent({ record_id: "rs-test-ider-2" });
await new Promise((r) => setTimeout(r, 10));
const secIderSkippedWhenNotCreated = !secIder2.calls.some((c) => c.method === "insertRecordIdempotent");

record("RS14",
  secIderMirroredWhenCreated && secIderSkippedWhenNotCreated,
  `mirror-when-created=${secIderMirroredWhenCreated} · skip-when-not-created=${secIderSkippedWhenNotCreated}`);

// RS15 · claimNextJob does NOT mirror
const primClaim = makeFake("primClaim");
const secClaim = makeFake("secClaim");
const shadowClaim = new MirrorToSupabaseBrainStore(primClaim, secClaim);
await shadowClaim.claimNextJob("knowledge-context", "w", 60);
await new Promise((r) => setTimeout(r, 10));
record("RS15",
  primClaim.calls.some((c) => c.method === "claimNextJob")
  && !secClaim.calls.some((c) => c.method === "claimNextJob"),
  "claim routes to primary only · no double-lease risk");

const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\nreverse-shadow: ${passed}/${total} assertions passed\n`);
process.exit(passed === total ? 0 : 1);
