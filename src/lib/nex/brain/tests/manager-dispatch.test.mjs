#!/usr/bin/env node
// manager-dispatch.test.mjs · Wave 11 remediation · closes part of F26 (dispatchNewInboxItems coverage)
//
// dispatchNewInboxItems() is the entry point for every knowledge item
// into the pipeline. It reads the inbox index, checks the ACTIVE brain
// store's listRecentPipelineInputRefs() for dedup, and enqueues one
// worker job per new item. If it silently loses items, the pipeline
// stalls with no test signal.
//
// The existing `dispatch-dedup.test.mjs` covered the DEDUP invariant
// only (DD1-DD10). This test covers the FUNCTION SHAPE invariants:
//   MD1 · function exported with the documented return shape
//   MD2 · reads inbox via readInboxIndex (not fs.readFile shortcut)
//   MD3 · dedup uses brainStore().listRecentPipelineInputRefs · NOT filesystem
//   MD4 · only waiting items are candidates for enqueue
//   MD5 · unsupported kinds (voice/file) are counted in skipped_not_text_yet
//   MD6 · text/url/image are the ONLY dispatched kinds
//   MD7 · every enqueued item has objectBucket/objectKey propagation logic (Phase 3a)
//   MD8 · statusUpdates map is populated for both progression AND reconciliation
//   MD9 · reconciliation writeback wrapped in try/catch (surfaces F4 concern in-place)
//   MD10 · function returns the 5-field summary object

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const SRC       = readFileSync(join(REPO, "src/lib/nex/brain/manager.ts"), "utf8");

// Extract the FULL dispatchNewInboxItems body · from its declaration to
// the next top-level `export` declaration (or EOF). Uses lookahead to
// stop at the next export line-start.
const FROM_DISPATCH = SRC.slice(SRC.indexOf("export async function dispatchNewInboxItems"));
const NEXT_EXPORT_OFFSET = FROM_DISPATCH.slice(50).search(/^export /m);
const DISPATCH_BLOCK = NEXT_EXPORT_OFFSET === -1
  ? FROM_DISPATCH
  : FROM_DISPATCH.slice(0, 50 + NEXT_EXPORT_OFFSET);

test("MD1 · dispatchNewInboxItems exported with 5-field return type", () => {
  assert.notEqual(DISPATCH_BLOCK.length, 0, "dispatchNewInboxItems must be exported");
  const sig = SRC.match(/export async function dispatchNewInboxItems[\s\S]*?\}> \{/)?.[0] ?? "";
  assert.match(sig, /scanned:\s*number/);
  assert.match(sig, /enqueued:\s*number/);
  assert.match(sig, /skipped_already_queued:\s*number/);
  assert.match(sig, /skipped_not_text_yet:\s*number/);
  assert.match(sig, /reconciled_inbox_status:\s*number/);
});

test("MD2 · reads inbox via readInboxIndex helper (not fs.readFile shortcut)", () => {
  assert.match(DISPATCH_BLOCK, /await readInboxIndex\(\)/, "must go through readInboxIndex()");
});

test("MD3 · dedup uses brainStore().listRecentPipelineInputRefs · NOT filesystem", () => {
  assert.match(DISPATCH_BLOCK, /store\.listRecentPipelineInputRefs/);
  // Reference the Phase 11.0 doctrine that removed readFsJobsSnapshot ·
  // this comment MUST stay so future readers understand the trap.
  assert.match(DISPATCH_BLOCK, /Phase 11\.0/);
  // We do NOT assert absence of the string `readFsJobsSnapshot` because
  // the Phase 11.0 comment intentionally NAMES the removed helper so
  // future readers know what the fix replaced. What matters is that
  // there is no CALL to it. The regex below rejects only actual calls.
  assert.doesNotMatch(DISPATCH_BLOCK, /await\s+readFsJobsSnapshot\s*\(/, "readFsJobsSnapshot must not be called");
});

test("MD4 · only waiting items are candidates for enqueue", () => {
  assert.match(DISPATCH_BLOCK, /item\.status !== "waiting"/);
});

test("MD5 · unsupported kinds count into skipped_not_text_yet", () => {
  assert.match(DISPATCH_BLOCK, /skipped_not_text_yet \+= 1/);
});

test("MD6 · text/url/image are the ONLY dispatched kinds", () => {
  // The kind-gate: item.kind !== "text" && item.kind !== "url" && item.kind !== "image"
  assert.match(DISPATCH_BLOCK, /item\.kind !== "text"/);
  assert.match(DISPATCH_BLOCK, /item\.kind !== "url"/);
  assert.match(DISPATCH_BLOCK, /item\.kind !== "image"/);
  // Voice + file explicitly NOT in the enqueue path (yet)
  assert.doesNotMatch(DISPATCH_BLOCK, /item\.kind === "voice".*enqueueJob/);
  assert.doesNotMatch(DISPATCH_BLOCK, /item\.kind === "file".*enqueueJob/);
});

test("MD7 · Phase 3a objectBucket/objectKey propagation present for image items", () => {
  // Every enqueue payload for image kind must carry the object storage
  // reference so the image-analyst reads from NEX Object Storage · not
  // a filesystem path that isn't reachable across Vercel invocations.
  assert.match(DISPATCH_BLOCK, /objectBucket/);
  assert.match(DISPATCH_BLOCK, /objectKey/);
});

test("MD8 · statusUpdates map populated for both progression AND reconciliation", () => {
  const matches = DISPATCH_BLOCK.match(/statusUpdates\.set\(/g) ?? [];
  // At minimum: one set for reconciliation (already-queued but still waiting)
  //             one set for progression (successfully enqueued this cycle)
  assert.ok(matches.length >= 2, `expected ≥2 statusUpdates.set calls · got ${matches.length}`);
});

test("MD9 · reconciliation writeback consumes the F4 WritebackOutcome contract", () => {
  // Wave 11 F4 remediation landed: writeback returns { kind: success|partial|failed }
  // instead of a bare number. This test now asserts the caller matches
  // on the outcome kind rather than swallowing with try/catch.
  assert.match(DISPATCH_BLOCK, /await updateInboxItemStatuses/);
  assert.match(DISPATCH_BLOCK, /wb\.kind === "success"/);
  assert.match(DISPATCH_BLOCK, /wb\.kind === "partial"/);
});

test("MD10 · function returns the summary object including original 5 fields + F5-added inbox_source_health", () => {
  // Wave 11 F5 remediation extended the return with inbox_source_health so
  // callers can distinguish "queue empty" from "read failed." Original 5
  // fields preserved. Extension does not weaken the earlier contract.
  assert.match(DISPATCH_BLOCK, /scanned:\s*inboxItems\.length/);
  assert.match(DISPATCH_BLOCK, /enqueued/);
  assert.match(DISPATCH_BLOCK, /skipped_already_queued/);
  assert.match(DISPATCH_BLOCK, /skipped_not_text_yet/);
  assert.match(DISPATCH_BLOCK, /reconciled_inbox_status/);
  assert.match(DISPATCH_BLOCK, /inbox_source_health: inboxRead\.sourceHealth/);
});
