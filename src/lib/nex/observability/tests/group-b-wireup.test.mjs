#!/usr/bin/env node
// group-b-wireup.test.mjs · Wave 11 · GROUP B · per-finding wire-up
//
// STATIC contract tests that assert each remediated site (F4, F5, F6,
// F7, F8, F10) references the shared observability primitives at the
// EXPECTED source location. These tests catch drift: if a future edit
// removes the counter/signal call from a remediated site, the test
// fails and the finding must be re-evaluated.
//
// These are not runtime tests — they are structural assertions that
// prevent the observability wire-up from silently regressing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const MANAGER  = readFileSync(join(REPO, "src/lib/nex/brain/manager.ts"), "utf8");
const ROUTER   = readFileSync(join(REPO, "src/lib/nex/brain/router.ts"), "utf8");
const INBOX    = readFileSync(join(REPO, "src/lib/nex/knowledge-inbox/storage.ts"), "utf8");
const FSSTORE  = readFileSync(join(REPO, "src/lib/nex/jobs/fs-store.ts"), "utf8");
const AUDIT    = readFileSync(join(REPO, "src/lib/nex/brain/audit-log.ts"), "utf8");

// ── F4 · manager writeback outcome shape ──────────────────────────

test("F4-W1 · updateInboxItemStatuses returns WritebackOutcome (not bare number)", () => {
  assert.match(MANAGER, /Promise<WritebackOutcome>/);
  assert.match(MANAGER, /type WritebackOutcome =/);
  assert.match(MANAGER, /kind: "success"/);
  assert.match(MANAGER, /kind: "partial"/);
  assert.match(MANAGER, /kind: "failed"/);
});

test("F4-W2 · caller surfaces writeback status in dispatch return", () => {
  assert.match(MANAGER, /inbox_writeback_status/);
  assert.match(MANAGER, /inbox\.inbox_writeback_failed|"manager\.inbox_writeback_failed"/);
});

// ── F5 · readInboxIndex sourceHealth ──────────────────────────────

test("F5-W1 · readInboxIndex returns ReadInboxResult (sourceHealth: ok|degraded)", () => {
  assert.match(MANAGER, /type ReadInboxResult =/);
  assert.match(MANAGER, /sourceHealth: "ok"/);
  assert.match(MANAGER, /sourceHealth: "degraded"/);
});

test("F5-W2 · dispatchNewInboxItems surfaces inbox_source_health in return", () => {
  assert.match(MANAGER, /inbox_source_health: "ok" \| "degraded"/);
  assert.match(MANAGER, /inbox_source_health: inboxRead\.sourceHealth/);
});

test("F5-W3 · degraded path fires counter + signal", () => {
  assert.match(MANAGER, /incr\("manager\.inbox_read_degraded"\)/);
  assert.match(MANAGER, /kind: "inbox-read-degraded"/);
});

// ── F6 · routeJobSafe signal + counter ────────────────────────────

test("F6-W1 · routeJobSafe catch fires counter + route-failed signal", () => {
  assert.match(ROUTER, /routeJobSafe/);
  assert.match(ROUTER, /incr\("router\.route_failed"\)/);
  assert.match(ROUTER, /kind: "route-failed"/);
});

// ── F7 · enqueue-loop partial failure ─────────────────────────────

test("F7-W1 · runProcessInbox tracks enqueueFailed per-item", () => {
  assert.match(INBOX, /enqueueFailed:\s*Array<\{\s*id: string;\s*reason: string\s*\}>/);
  assert.match(INBOX, /enqueueFailed\.push/);
});

test("F7-W2 · enqueue failure fires counter + enqueue-failed signal", () => {
  assert.match(INBOX, /incr\("inbox\.enqueue_failed"\)/);
  assert.match(INBOX, /kind: "enqueue-failed"/);
});

test("F7-W3 · ProcessingReport includes enqueueFailed field", () => {
  const TYPES = readFileSync(join(REPO, "src/lib/nex/knowledge-inbox/types.ts"), "utf8");
  assert.match(TYPES, /enqueueFailed\?:\s*Array<\{\s*id: string;\s*reason: string\s*\}>/);
});

test("F7-W4 · report populates enqueueFailed when failures occur", () => {
  assert.match(INBOX, /enqueueFailed:\s*enqueueFailed\.length > 0 \? enqueueFailed : undefined/);
});

// ── F8 · createJobSafe signal + counter ───────────────────────────

test("F8-W1 · createJobSafe catch fires counter + create-job-failed signal", () => {
  assert.match(FSSTORE, /export async function createJobSafe/);
  assert.match(FSSTORE, /incr\("jobs\.create_failed"\)/);
  assert.match(FSSTORE, /kind: "create-job-failed"/);
});

// ── F10 · PG-read fallback signal + counter ───────────────────────

test("F10-W1 · inbox readIndex fallback fires pg-read-fallback signal", () => {
  assert.match(INBOX, /incr\("inbox\.pg_read_fallback"\)/);
  assert.match(INBOX, /kind: "pg-read-fallback"/);
});

test("F10-W2 · inbox readStats fallback also fires signal (both entrypoints)", () => {
  // Both readIndex + readStats paths must emit
  const matches = INBOX.match(/emitSignal\(\{\s*subsystem: "inbox",\s*kind: "pg-read-fallback"/g) ?? [];
  assert.ok(matches.length >= 2, `expected ≥2 pg-read-fallback emissions (readIndex + readStats) · got ${matches.length}`);
});

test("F10-W3 · jobs pg reads share a fallback helper", () => {
  assert.match(FSSTORE, /function emitJobsPgFallback/);
  assert.match(FSSTORE, /incr\("jobs\.pg_read_fallback"\)/);
  // All three read entrypoints call the helper (getJob / listJobs / jobStats)
  const calls = FSSTORE.match(/emitJobsPgFallback\("(getJob|listJobs|jobStats)"\)/g) ?? [];
  assert.equal(calls.length, 3, `expected 3 jobs-pg-fallback callsites · got ${calls.length}`);
});

// ── F9 · audit retry buffer wired at both callsites ───────────────

test("F9-W1 · emitAuditEvent catch enqueues to retry buffer", () => {
  assert.match(AUDIT, /enqueueForRetry\(input\)/);
});

test("F9-W2 · emitAuditEvents batch enqueues each event individually on failure", () => {
  assert.match(AUDIT, /for \(const e of events\) enqueueForRetry\(e\)/);
});

test("F9-W3 · drainAuditRetryBuffer is exported and returns 4-field summary", () => {
  assert.match(AUDIT, /export async function drainAuditRetryBuffer/);
  assert.match(AUDIT, /attempted: number/);
  assert.match(AUDIT, /succeeded: number/);
  assert.match(AUDIT, /requeued: number/);
  assert.match(AUDIT, /dropped: number/);
});

test("F9-W4 · drainAuditRetryBuffer emits audit-emit-retried + audit-emit-dropped signals", () => {
  assert.match(AUDIT, /kind: "audit-emit-retried"/);
  assert.match(AUDIT, /kind: "audit-emit-dropped"/);
  assert.match(AUDIT, /MAX_RETRY_ATTEMPTS/);
});
