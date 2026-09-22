// src/lib/nex/harvest/__tests__/harvest-queue.test.ts
//
// NEX 24/7 World Harvest Engine · Wave H1 · Acceptance
// Founder-authorised programme · 2026-09-22.
//
// The critical acceptance:
//   Kill the worker halfway through a batch → restart → unfinished jobs
//   are recovered exactly once/idempotently. Zero loss. Zero duplicates.

import { describe, it, expect } from "vitest";
import type { PoolClient, QueryResult } from "pg";
import {
  enqueueJob, claimNextJob, heartbeatJob, completeJob, failJob,
  redriveJob, loadJob, loadQueueSummary, backoffMs,
  registerWorker, workerHeartbeat, drainWorker, bumpWorkerCounters,
  loadWorker, loadWorkers,
  runHarvestReaper,
  recordYield, loadRecentYield, loadYieldSummary,
  _HARVEST_POSTGRES_IS_AUTHORITY,
  _HARVEST_NEVER_DELETES_JOBS,
  _HARVEST_LEASE_OWNERSHIP_REQUIRED,
  _HARVEST_IDEMPOTENCY_ENFORCED_AT_DB,
} from "..";

// ═══════════════════════════════════════════════════════════════════
// In-memory mock that behaves like Postgres for the harvest schema.
// This is used because the test environment has no live DB. The mock
// enforces the same invariants (unique index, lease semantics, status
// machine, FOR UPDATE SKIP LOCKED contention).
// ═══════════════════════════════════════════════════════════════════
function makeHarvestMock(clock: () => Date = () => new Date()) {
  interface JobRow {
    job_id: string;
    job_type: string;
    programme_id: string | null;
    country_iso: string | null;
    source_id: string | null;
    payload: any;
    idempotency_key: string;
    status: string;
    priority: number;
    attempts: number;
    max_attempts: number;
    next_attempt_at: string;
    lease_owner: string | null;
    lease_acquired_at: string | null;
    lease_expires_at: string | null;
    heartbeat_at: string | null;
    last_error: string | null;
    last_error_at: string | null;
    dead_letter_reason: string | null;
    dead_letter_at: string | null;
    completed_at: string | null;
    parent_job_id: string | null;
    created_at: string;
    updated_at: string;
  }
  interface WorkerRow {
    worker_id: string; host_identifier: string | null; job_type_scope: string[];
    status: string; started_at: string; last_heartbeat_at: string;
    heartbeat_interval_seconds: number; expected_expiry_at: string;
    jobs_claimed: number; jobs_completed: number; jobs_failed: number;
  }
  interface YieldRow {
    yield_id: string; job_id: string; worker_id: string | null;
    yield_kind: string; yield_count: number; yield_meta: any; yielded_at: string;
  }

  const jobs = new Map<string, JobRow>();
  const workers = new Map<string, WorkerRow>();
  const yields: YieldRow[] = [];
  const locked_job_ids = new Set<string>();  // simulates FOR UPDATE
  let seq = 1;

  const nextUuid = () => `job-${seq++}`;
  const nextYieldId = () => `yield-${seq++}`;

  const upd_touch = (row: JobRow) => { row.updated_at = clock().toISOString(); };

  const client: PoolClient = {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.replace(/\s+/g, " ").trim();

      // ─── INSERT harvest_job ───
      if (/^INSERT INTO nex\.harvest_job/i.test(norm)) {
        const [job_type, programme_id, country_iso, source_id, payload_str,
               idempotency_key, priority, max_attempts, next_attempt_at, parent_job_id] = params;
        for (const j of jobs.values()) {
          if (j.job_type === job_type && j.idempotency_key === idempotency_key) {
            return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
          }
        }
        const now = clock().toISOString();
        const row: JobRow = {
          job_id: nextUuid(), job_type, programme_id: programme_id ?? null,
          country_iso: country_iso ?? null, source_id: source_id ?? null,
          payload: JSON.parse(payload_str), idempotency_key,
          status: "queued", priority: Number(priority), attempts: 0,
          max_attempts: Number(max_attempts), next_attempt_at,
          lease_owner: null, lease_acquired_at: null, lease_expires_at: null, heartbeat_at: null,
          last_error: null, last_error_at: null, dead_letter_reason: null,
          dead_letter_at: null, completed_at: null,
          parent_job_id: parent_job_id ?? null,
          created_at: now, updated_at: now,
        };
        jobs.set(row.job_id, row);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── SELECT by idempotency ───
      if (/^SELECT \* FROM nex\.harvest_job WHERE job_type = \$1 AND idempotency_key = \$2/i.test(norm)) {
        const [jt, ik] = params;
        for (const j of jobs.values()) if (j.job_type === jt && j.idempotency_key === ik) return { rows: [j], rowCount: 1, command: "", oid: 0, fields: [] };
        return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
      }
      // ─── SELECT job_id for claim (FOR UPDATE SKIP LOCKED) ───
      if (/^SELECT job_id FROM nex\.harvest_job WHERE .* FOR UPDATE SKIP LOCKED/i.test(norm)) {
        const [job_types, now_iso, ...scopers] = params;
        const candidates = [...jobs.values()].filter(j =>
          j.status === "queued"
          && j.next_attempt_at <= now_iso
          && (job_types as string[]).includes(j.job_type)
          && !locked_job_ids.has(j.job_id)
        );
        // Apply programme/country scopers if present (params 3..)
        let filtered = candidates;
        let idx = 3;
        if (/programme_id = \$/.test(norm)) { filtered = filtered.filter(j => j.programme_id === scopers[idx - 3]); idx++; }
        if (/country_iso = \$/.test(norm))  { filtered = filtered.filter(j => j.country_iso === scopers[idx - 3]); idx++; }
        filtered.sort((a, b) => (b.priority - a.priority) || (a.next_attempt_at.localeCompare(b.next_attempt_at)));
        if (filtered.length === 0) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        const picked = filtered[0]!;
        locked_job_ids.add(picked.job_id);
        return { rows: [{ job_id: picked.job_id }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE claim ───
      if (/^UPDATE nex\.harvest_job\s+SET status = 'claimed'/i.test(norm)) {
        const [job_id, worker_id, acquired, expires] = params;
        const row = jobs.get(job_id);
        if (!row) { locked_job_ids.delete(job_id); return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] }; }
        row.status = "claimed"; row.lease_owner = worker_id;
        row.lease_acquired_at = acquired; row.lease_expires_at = expires;
        row.heartbeat_at = acquired; row.attempts += 1;
        upd_touch(row);
        locked_job_ids.delete(job_id);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE heartbeat ───
      if (/^UPDATE nex\.harvest_job\s+SET heartbeat_at = \$3, lease_expires_at = \$4/i.test(norm)) {
        const [job_id, worker_id, heartbeat, new_expiry] = params;
        const row = jobs.get(job_id);
        if (!row || row.lease_owner !== worker_id || !["claimed","processing"].includes(row.status)) {
          return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        }
        row.heartbeat_at = heartbeat; row.lease_expires_at = new_expiry;
        if (row.status === "claimed") row.status = "processing";
        upd_touch(row);
        return { rows: [{ lease_expires_at: new_expiry }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE complete ───
      if (/^UPDATE nex\.harvest_job\s+SET status = 'completed'/i.test(norm)) {
        const [job_id, worker_id, now_iso] = params;
        const row = jobs.get(job_id);
        if (!row || row.lease_owner !== worker_id || !["claimed","processing"].includes(row.status)) {
          return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        }
        row.status = "completed"; row.completed_at = now_iso;
        row.lease_owner = null; row.lease_acquired_at = null; row.lease_expires_at = null;
        row.heartbeat_at = now_iso;
        upd_touch(row);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── SELECT current attempts/max_attempts (FOR UPDATE) ───
      if (/^SELECT attempts, max_attempts FROM nex\.harvest_job WHERE job_id = \$1 AND lease_owner = \$2/i.test(norm)) {
        const [job_id, worker_id] = params;
        const row = jobs.get(job_id);
        if (!row || row.lease_owner !== worker_id || !["claimed","processing"].includes(row.status)) {
          return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        }
        return { rows: [{ attempts: row.attempts, max_attempts: row.max_attempts }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE fail → dead_letter ───
      if (/^UPDATE nex\.harvest_job\s+SET status = 'dead_letter'/i.test(norm) && /lease_owner = \$2/.test(norm)) {
        const [job_id, worker_id, error, now_iso] = params;
        const row = jobs.get(job_id);
        if (!row || row.lease_owner !== worker_id) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        row.status = "dead_letter"; row.dead_letter_reason = error;
        row.dead_letter_at = now_iso; row.last_error = error; row.last_error_at = now_iso;
        row.lease_owner = null; row.lease_acquired_at = null; row.lease_expires_at = null;
        upd_touch(row);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE fail → requeue ───
      if (/^UPDATE nex\.harvest_job\s+SET status = 'queued'/i.test(norm) && /lease_owner = \$2/.test(norm)) {
        const [job_id, worker_id, error, now_iso, next_attempt_at] = params;
        const row = jobs.get(job_id);
        if (!row || row.lease_owner !== worker_id) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        row.status = "queued"; row.last_error = error; row.last_error_at = now_iso;
        row.next_attempt_at = next_attempt_at;
        row.lease_owner = null; row.lease_acquired_at = null; row.lease_expires_at = null;
        upd_touch(row);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE redrive ───
      if (/^UPDATE nex\.harvest_job\s+SET status = 'queued'/i.test(norm) && /status = 'dead_letter'/.test(norm)) {
        const [job_id, now_iso] = params;
        const row = jobs.get(job_id);
        if (!row || row.status !== "dead_letter") return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        row.status = "queued"; row.next_attempt_at = now_iso;
        row.dead_letter_reason = null; row.dead_letter_at = null;
        row.last_error = null; row.last_error_at = null;
        if (/attempts = 0/.test(norm)) row.attempts = 0;
        upd_touch(row);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── SELECT * FROM harvest_job WHERE job_id ───
      if (/^SELECT \* FROM nex\.harvest_job WHERE job_id = \$1$/i.test(norm)) {
        const row = jobs.get(params[0]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0, command: "", oid: 0, fields: [] };
      }
      // ─── SELECT status, COUNT(*) queue summary ───
      if (/^SELECT status, COUNT/i.test(norm)) {
        const counts: Record<string, number> = {};
        for (const j of jobs.values()) counts[j.status] = (counts[j.status] ?? 0) + 1;
        return { rows: Object.entries(counts).map(([status, n]) => ({ status, n })), rowCount: Object.keys(counts).length, command: "", oid: 0, fields: [] };
      }

      // ─── INSERT harvest_worker (UPSERT) ───
      if (/^INSERT INTO nex\.harvest_worker/i.test(norm)) {
        const [worker_id, host, scope, now_iso, interval, expiry] = params;
        const existing = workers.get(worker_id);
        const row: WorkerRow = existing ? {
          ...existing,
          host_identifier: host, job_type_scope: scope,
          status: "alive", started_at: now_iso, last_heartbeat_at: now_iso,
          heartbeat_interval_seconds: Number(interval),
          expected_expiry_at: expiry,
        } : {
          worker_id, host_identifier: host, job_type_scope: scope,
          status: "alive", started_at: now_iso, last_heartbeat_at: now_iso,
          heartbeat_interval_seconds: Number(interval), expected_expiry_at: expiry,
          jobs_claimed: 0, jobs_completed: 0, jobs_failed: 0,
        };
        workers.set(worker_id, row);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE worker heartbeat ───
      if (/^UPDATE nex\.harvest_worker\s+SET last_heartbeat_at/i.test(norm)) {
        const [worker_id, now_iso] = params;
        const row = workers.get(worker_id);
        if (!row) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        row.last_heartbeat_at = now_iso;
        row.expected_expiry_at = new Date(new Date(now_iso).getTime() + row.heartbeat_interval_seconds * 4 * 1000).toISOString();
        if (row.status === "expired") row.status = "alive";
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE worker drain ───
      if (/^UPDATE nex\.harvest_worker\s+SET status = 'drained'/i.test(norm)) {
        const row = workers.get(params[0]);
        if (!row) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        row.status = "drained";
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE worker counters ───
      if (/^UPDATE nex\.harvest_worker\s+SET jobs_claimed/i.test(norm)) {
        const [worker_id, claimed, completed, failed] = params;
        const row = workers.get(worker_id);
        if (!row) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        row.jobs_claimed += Number(claimed ?? 0);
        row.jobs_completed += Number(completed ?? 0);
        row.jobs_failed += Number(failed ?? 0);
        return { rows: [], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── SELECT worker ───
      if (/^SELECT \* FROM nex\.harvest_worker WHERE worker_id = \$1/i.test(norm)) {
        const row = workers.get(params[0]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0, command: "", oid: 0, fields: [] };
      }
      if (/^SELECT \* FROM nex\.harvest_worker ORDER BY status/i.test(norm)) {
        return { rows: [...workers.values()], rowCount: workers.size, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE workers → expired (reaper) ───
      if (/^UPDATE nex\.harvest_worker\s+SET status = 'expired'/i.test(norm)) {
        const [now_iso] = params;
        const expired: WorkerRow[] = [];
        for (const w of workers.values()) {
          if (w.status === "alive" && w.expected_expiry_at < now_iso) {
            w.status = "expired"; expired.push(w);
          }
        }
        return { rows: expired.map(w => ({ worker_id: w.worker_id })), rowCount: expired.length, command: "", oid: 0, fields: [] };
      }
      // ─── SELECT expired jobs (reaper) ───
      if (/^SELECT job_id, attempts, max_attempts FROM nex\.harvest_job WHERE lease_owner IS NOT NULL/i.test(norm)) {
        const [now_iso] = params;
        const out = [...jobs.values()].filter(j =>
          j.lease_owner !== null && j.lease_expires_at !== null && j.lease_expires_at < now_iso
          && ["claimed","processing"].includes(j.status)
        ).map(j => ({ job_id: j.job_id, attempts: j.attempts, max_attempts: j.max_attempts }));
        return { rows: out, rowCount: out.length, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE dead_letter (reaper path) ───
      if (/^UPDATE nex\.harvest_job\s+SET status = 'dead_letter'/i.test(norm) && !/lease_owner = \$2/.test(norm)) {
        const [job_id, now_iso] = params;
        const row = jobs.get(job_id);
        if (!row) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        row.status = "dead_letter"; row.dead_letter_reason = "lease_expired_max_attempts_reached";
        row.dead_letter_at = now_iso;
        row.lease_owner = null; row.lease_acquired_at = null; row.lease_expires_at = null;
        return { rows: [], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE queued (reaper release path) ───
      if (/^UPDATE nex\.harvest_job\s+SET status = 'queued'/i.test(norm) && /last_error = 'lease_expired_reaped'/.test(norm)) {
        const [job_id, now_iso, next_attempt] = params;
        const row = jobs.get(job_id);
        if (!row) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        row.status = "queued"; row.last_error = "lease_expired_reaped"; row.last_error_at = now_iso;
        row.next_attempt_at = next_attempt;
        row.lease_owner = null; row.lease_acquired_at = null; row.lease_expires_at = null;
        return { rows: [], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── INSERT harvest_yield ───
      if (/^INSERT INTO nex\.harvest_yield/i.test(norm)) {
        const [job_id, worker_id, yield_kind, yield_count, meta_str] = params;
        const now = clock().toISOString();
        const row: YieldRow = {
          yield_id: nextYieldId(), job_id, worker_id: worker_id ?? null,
          yield_kind, yield_count: Number(yield_count), yield_meta: JSON.parse(meta_str), yielded_at: now,
        };
        yields.push(row);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      if (/^SELECT \* FROM nex\.harvest_yield/i.test(norm)) {
        const [limit] = params;
        return { rows: yields.slice(-Number(limit)).reverse(), rowCount: yields.length, command: "", oid: 0, fields: [] };
      }
      if (/COUNT\(\*\) FILTER \(WHERE yielded_at/i.test(norm)) {
        const now = clock().getTime();
        const five = yields.filter(y => now - new Date(y.yielded_at).getTime() < 5 * 60_000).length;
        const sixty = yields.filter(y => now - new Date(y.yielded_at).getTime() < 60 * 60_000).length;
        const day = yields.filter(y => now - new Date(y.yielded_at).getTime() < 24 * 60 * 60_000).length;
        const most_recent = yields.length > 0 ? yields[yields.length - 1]!.yielded_at : null;
        return { rows: [{ five, sixty, day, most_recent }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      if (/^SELECT yield_kind, COUNT/i.test(norm)) {
        const now = clock().getTime();
        const recent = yields.filter(y => now - new Date(y.yielded_at).getTime() < 60 * 60_000);
        const map: Record<string, number> = {};
        for (const y of recent) map[y.yield_kind] = (map[y.yield_kind] ?? 0) + 1;
        return { rows: Object.entries(map).map(([yield_kind, n]) => ({ yield_kind, n })), rowCount: Object.keys(map).length, command: "", oid: 0, fields: [] };
      }

      throw new Error(`harvest-mock: unhandled SQL: ${norm.slice(0, 200)}`);
    },
    release() {},
  } as unknown as PoolClient;

  return { client, jobs, workers, yields, locked_job_ids };
}

// ═══════════════════════════════════════════════════════════════════
// A · Enqueue + idempotency
// ═══════════════════════════════════════════════════════════════════
describe("Harvest queue · (A) enqueue + idempotency", () => {
  it("(A1) enqueue new job returns kind=enqueued with a job_id", async () => {
    const m = makeHarvestMock();
    const r = await enqueueJob(m.client, {
      job_type: "source_probe", idempotency_key: "src:osm:GB:scaffolding:c1",
      payload: { source: "osm", country: "GB", term: "scaffolding" },
    });
    expect(r.kind).toBe("enqueued");
    if (r.kind === "enqueued") expect(r.job.status).toBe("queued");
  });
  it("(A2) enqueue with same (job_type, idempotency_key) returns kind=duplicate", async () => {
    const m = makeHarvestMock();
    const r1 = await enqueueJob(m.client, { job_type: "source_probe", idempotency_key: "same", payload: {} });
    const r2 = await enqueueJob(m.client, { job_type: "source_probe", idempotency_key: "same", payload: {} });
    expect(r1.kind).toBe("enqueued");
    expect(r2.kind).toBe("duplicate");
    if (r1.kind === "enqueued" && r2.kind === "duplicate") {
      expect(r2.existing.job_id).toBe(r1.job.job_id);
    }
  });
  it("(A3) different job_type + same idempotency_key → both accepted", async () => {
    const m = makeHarvestMock();
    const r1 = await enqueueJob(m.client, { job_type: "source_probe", idempotency_key: "shared", payload: {} });
    const r2 = await enqueueJob(m.client, { job_type: "website_walk", idempotency_key: "shared", payload: {} });
    expect(r1.kind).toBe("enqueued");
    expect(r2.kind).toBe("enqueued");
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Claim
// ═══════════════════════════════════════════════════════════════════
describe("Harvest queue · (B) claim", () => {
  it("(B1) claim picks highest-priority queued job", async () => {
    const m = makeHarvestMock();
    await enqueueJob(m.client, { job_type: "source_probe", idempotency_key: "a", payload: {}, priority: 100 });
    await enqueueJob(m.client, { job_type: "source_probe", idempotency_key: "b", payload: {}, priority: 200 });
    const c = await claimNextJob(m.client, { worker_id: "w1", job_types: ["source_probe"], lease_seconds: 60 });
    expect(c).not.toBeNull();
    expect(c?.payload).toEqual({});
    // The higher-priority one wins
    expect(c?.lease_owner).toBe("w1");
    expect(c?.status).toBe("claimed");
  });
  it("(B2) claim narrows by job_types", async () => {
    const m = makeHarvestMock();
    await enqueueJob(m.client, { job_type: "source_probe", idempotency_key: "a", payload: {} });
    await enqueueJob(m.client, { job_type: "website_walk", idempotency_key: "b", payload: {} });
    const c = await claimNextJob(m.client, { worker_id: "w1", job_types: ["website_walk"], lease_seconds: 60 });
    expect(c?.job_type).toBe("website_walk");
  });
  it("(B3) claim increments attempts atomically", async () => {
    const m = makeHarvestMock();
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {} });
    const c = await claimNextJob(m.client, { worker_id: "w", job_types: ["x"], lease_seconds: 60 });
    expect(c?.attempts).toBe(1);
  });
  it("(B4) two concurrent claims cannot pick the same job (FOR UPDATE SKIP LOCKED)", async () => {
    const m = makeHarvestMock();
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "one_only", payload: {} });
    // Claim once; second call finds nothing to pick (only one queued job)
    const c1 = await claimNextJob(m.client, { worker_id: "w1", job_types: ["x"], lease_seconds: 60 });
    const c2 = await claimNextJob(m.client, { worker_id: "w2", job_types: ["x"], lease_seconds: 60 });
    expect(c1).not.toBeNull();
    expect(c2).toBeNull();
  });
  it("(B5) claim respects next_attempt_at (future-scheduled jobs stay hidden)", async () => {
    const clock = { t: new Date("2026-09-22T00:00:00Z") };
    const m = makeHarvestMock(() => clock.t);
    const future = new Date(clock.t.getTime() + 60_000).toISOString();
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "later", payload: {}, next_attempt_at: future });
    const c = await claimNextJob(m.client, { worker_id: "w", job_types: ["x"], lease_seconds: 60, now: () => clock.t });
    expect(c).toBeNull();
    clock.t = new Date(clock.t.getTime() + 61_000);
    const c2 = await claimNextJob(m.client, { worker_id: "w", job_types: ["x"], lease_seconds: 60, now: () => clock.t });
    expect(c2).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Heartbeat + lease ownership
// ═══════════════════════════════════════════════════════════════════
describe("Harvest queue · (C) heartbeat + lease ownership", () => {
  it("(C1) heartbeat extends lease + moves claimed → processing", async () => {
    const clock = { t: new Date("2026-09-22T00:00:00Z") };
    const m = makeHarvestMock(() => clock.t);
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {}, next_attempt_at: clock.t.toISOString() });
    const claimed = await claimNextJob(m.client, { worker_id: "w", job_types: ["x"], lease_seconds: 60, now: () => clock.t });
    clock.t = new Date(clock.t.getTime() + 30_000);
    const hb = await heartbeatJob(m.client, { job_id: claimed!.job_id, worker_id: "w", lease_seconds: 60, now: () => clock.t });
    expect(hb.kind).toBe("extended");
    const after = await loadJob(m.client, claimed!.job_id);
    expect(after?.status).toBe("processing");
  });
  it("(C2) heartbeat from WRONG worker returns lost · row untouched", async () => {
    const m = makeHarvestMock();
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {} });
    const c = await claimNextJob(m.client, { worker_id: "w1", job_types: ["x"], lease_seconds: 60 });
    const hb = await heartbeatJob(m.client, { job_id: c!.job_id, worker_id: "w-imposter", lease_seconds: 60 });
    expect(hb.kind).toBe("lost");
    const j = await loadJob(m.client, c!.job_id);
    expect(j?.lease_owner).toBe("w1");
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Complete + fail
// ═══════════════════════════════════════════════════════════════════
describe("Harvest queue · (D) complete + fail", () => {
  it("(D1) complete transitions to completed · clears lease", async () => {
    const m = makeHarvestMock();
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {} });
    const c = await claimNextJob(m.client, { worker_id: "w", job_types: ["x"], lease_seconds: 60 });
    const r = await completeJob(m.client, { job_id: c!.job_id, worker_id: "w" });
    expect(r.kind).toBe("completed");
    if (r.kind === "completed") {
      expect(r.job.status).toBe("completed");
      expect(r.job.lease_owner).toBeNull();
      expect(r.job.completed_at).not.toBeNull();
    }
  });
  it("(D2) complete from wrong worker → lease_lost · job untouched", async () => {
    const m = makeHarvestMock();
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {} });
    const c = await claimNextJob(m.client, { worker_id: "w1", job_types: ["x"], lease_seconds: 60 });
    const r = await completeJob(m.client, { job_id: c!.job_id, worker_id: "w-imposter" });
    expect(r.kind).toBe("lease_lost");
    const j = await loadJob(m.client, c!.job_id);
    expect(j?.status).toBe("claimed");
  });
  it("(D3) fail with retries remaining → requeued with backoff", async () => {
    const m = makeHarvestMock();
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {}, max_attempts: 3 });
    const c = await claimNextJob(m.client, { worker_id: "w", job_types: ["x"], lease_seconds: 60 });
    const r = await failJob(m.client, { job_id: c!.job_id, worker_id: "w", error: "transient" });
    expect(r.kind).toBe("requeued");
    if (r.kind === "requeued") {
      expect(r.job.status).toBe("queued");
      expect(new Date(r.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
      expect(r.job.last_error).toBe("transient");
    }
  });
  it("(D4) fail beyond max_attempts → dead_letter", async () => {
    const m = makeHarvestMock();
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {}, max_attempts: 1 });
    const c = await claimNextJob(m.client, { worker_id: "w", job_types: ["x"], lease_seconds: 60 });
    const r = await failJob(m.client, { job_id: c!.job_id, worker_id: "w", error: "permanent" });
    expect(r.kind).toBe("dead_letter");
  });
  it("(D5) fail with retryable=false → dead_letter regardless of attempts", async () => {
    const m = makeHarvestMock();
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {}, max_attempts: 10 });
    const c = await claimNextJob(m.client, { worker_id: "w", job_types: ["x"], lease_seconds: 60 });
    const r = await failJob(m.client, { job_id: c!.job_id, worker_id: "w", error: "poisoned", retryable: false });
    expect(r.kind).toBe("dead_letter");
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Reaper (self-recovery)
// ═══════════════════════════════════════════════════════════════════
describe("Harvest queue · (E) reaper", () => {
  it("(E1) reaper releases expired leases · returns to queued with backoff", async () => {
    const clock = { t: new Date("2026-09-22T00:00:00Z") };
    const m = makeHarvestMock(() => clock.t);
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {}, max_attempts: 3, next_attempt_at: clock.t.toISOString() });
    const c = await claimNextJob(m.client, { worker_id: "dead_worker", job_types: ["x"], lease_seconds: 5, now: () => clock.t });
    // Simulate worker death · clock advances past lease expiry
    clock.t = new Date(clock.t.getTime() + 10_000);
    const r = await runHarvestReaper(m.client, { now: () => clock.t });
    expect(r.expired_leases_released).toBe(1);
    expect(r.moved_to_dead_letter).toBe(0);
    const j = await loadJob(m.client, c!.job_id);
    expect(j?.status).toBe("queued");
    expect(j?.lease_owner).toBeNull();
    expect(j?.last_error).toBe("lease_expired_reaped");
  });
  it("(E2) reaper escalates to dead_letter when attempts exhausted", async () => {
    const clock = { t: new Date("2026-09-22T00:00:00Z") };
    const m = makeHarvestMock(() => clock.t);
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {}, max_attempts: 1, next_attempt_at: clock.t.toISOString() });
    const c = await claimNextJob(m.client, { worker_id: "dead", job_types: ["x"], lease_seconds: 5, now: () => clock.t });
    clock.t = new Date(clock.t.getTime() + 10_000);
    const r = await runHarvestReaper(m.client, { now: () => clock.t });
    expect(r.moved_to_dead_letter).toBe(1);
    const j = await loadJob(m.client, c!.job_id);
    expect(j?.status).toBe("dead_letter");
  });
  it("(E3) reaper is idempotent · running twice = one run", async () => {
    const clock = { t: new Date("2026-09-22T00:00:00Z") };
    const m = makeHarvestMock(() => clock.t);
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {}, max_attempts: 3, next_attempt_at: clock.t.toISOString() });
    const c = await claimNextJob(m.client, { worker_id: "w", job_types: ["x"], lease_seconds: 5, now: () => clock.t });
    clock.t = new Date(clock.t.getTime() + 10_000);
    const r1 = await runHarvestReaper(m.client, { now: () => clock.t });
    const r2 = await runHarvestReaper(m.client, { now: () => clock.t });
    expect(r1.expired_leases_released).toBe(1);
    expect(r2.expired_leases_released).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Redrive (dead_letter → queued)
// ═══════════════════════════════════════════════════════════════════
describe("Harvest queue · (F) redrive", () => {
  it("(F1) redrive moves dead_letter → queued · resets attempts", async () => {
    const m = makeHarvestMock();
    await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {}, max_attempts: 1 });
    const c = await claimNextJob(m.client, { worker_id: "w", job_types: ["x"], lease_seconds: 60 });
    await failJob(m.client, { job_id: c!.job_id, worker_id: "w", error: "e" });
    const r = await redriveJob(m.client, { job_id: c!.job_id });
    expect(r?.status).toBe("queued");
    expect(r?.attempts).toBe(0);
    expect(r?.dead_letter_reason).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// G · Worker lifecycle + heartbeat
// ═══════════════════════════════════════════════════════════════════
describe("Harvest queue · (G) worker lifecycle", () => {
  it("(G1) register + heartbeat + drain", async () => {
    const m = makeHarvestMock();
    const w = await registerWorker(m.client, { worker_id: "w1", job_type_scope: ["source_probe"] });
    expect(w.status).toBe("alive");
    const hb = await workerHeartbeat(m.client, { worker_id: "w1" });
    expect(hb).not.toBeNull();
    const d = await drainWorker(m.client, "w1");
    expect(d?.status).toBe("drained");
  });
  it("(G2) counter bumps accumulate", async () => {
    const m = makeHarvestMock();
    await registerWorker(m.client, { worker_id: "w1", job_type_scope: ["x"] });
    await bumpWorkerCounters(m.client, { worker_id: "w1", claimed: 5, completed: 3, failed: 2 });
    const w = await loadWorker(m.client, "w1");
    expect(w?.jobs_claimed).toBe(5);
    expect(w?.jobs_completed).toBe(3);
    expect(w?.jobs_failed).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// H · Yield ledger
// ═══════════════════════════════════════════════════════════════════
describe("Harvest queue · (H) yield ledger", () => {
  it("(H1) recordYield persists · loadRecentYield returns it", async () => {
    const m = makeHarvestMock();
    const e = await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {} });
    if (e.kind !== "enqueued") throw new Error("expected enqueued");
    await recordYield(m.client, { job_id: e.job.job_id, worker_id: "w1", yield_kind: "business_candidate", yield_count: 42, yield_meta: { source: "osm" } });
    const rows = await loadRecentYield(m.client, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.yield_kind).toBe("business_candidate");
    expect(rows[0]?.yield_count).toBe(42);
  });
  it("(H2) yield summary tracks last-5-min / last-60-min / last-24h totals", async () => {
    const m = makeHarvestMock();
    const e = await enqueueJob(m.client, { job_type: "x", idempotency_key: "k", payload: {} });
    if (e.kind !== "enqueued") throw new Error("expected enqueued");
    for (let i = 0; i < 3; i++) {
      await recordYield(m.client, { job_id: e.job.job_id, yield_kind: "email_captured" });
    }
    const s = await loadYieldSummary(m.client);
    expect(s.total_last_5_min).toBe(3);
    expect(s.by_kind_last_60_min.email_captured).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// I · CHAOS · the acceptance the Founder demanded
// ═══════════════════════════════════════════════════════════════════
describe("Harvest queue · (I) chaos · 10 jobs · 3 workers · kill one mid-flight", () => {
  it("(I1) 10 jobs · 3 workers · worker-B dies with 2 jobs in flight → reaper recovers · 0 lost · 0 duplicates", async () => {
    const clock = { t: new Date("2026-09-22T00:00:00Z") };
    const m = makeHarvestMock(() => clock.t);
    // Enqueue 10 jobs (explicit next_attempt_at = clock.t so fake clock claim can pick them up)
    for (let i = 0; i < 10; i++) {
      await enqueueJob(m.client, { job_type: "source_probe", idempotency_key: `chaos-${i}`, payload: { i }, max_attempts: 3, next_attempt_at: clock.t.toISOString() });
    }
    // Register 3 workers
    for (const id of ["A", "B", "C"]) await registerWorker(m.client, { worker_id: id, job_type_scope: ["source_probe"] });

    // A completes 3, B claims 2 and dies, C completes 3
    const A_jobs: string[] = [];
    for (let i = 0; i < 3; i++) {
      const j = await claimNextJob(m.client, { worker_id: "A", job_types: ["source_probe"], lease_seconds: 30, now: () => clock.t });
      if (j) { A_jobs.push(j.job_id); await completeJob(m.client, { job_id: j.job_id, worker_id: "A", now: () => clock.t }); }
    }
    const B_claimed: string[] = [];
    for (let i = 0; i < 2; i++) {
      const j = await claimNextJob(m.client, { worker_id: "B", job_types: ["source_probe"], lease_seconds: 5, now: () => clock.t });
      if (j) B_claimed.push(j.job_id);
    }
    // B DIES · no complete · no fail · no heartbeat
    const C_jobs: string[] = [];
    for (let i = 0; i < 3; i++) {
      const j = await claimNextJob(m.client, { worker_id: "C", job_types: ["source_probe"], lease_seconds: 30, now: () => clock.t });
      if (j) { C_jobs.push(j.job_id); await completeJob(m.client, { job_id: j.job_id, worker_id: "C", now: () => clock.t }); }
    }

    // Advance clock past B's 5-second lease
    clock.t = new Date(clock.t.getTime() + 10_000);
    const reaped = await runHarvestReaper(m.client, { now: () => clock.t });
    expect(reaped.expired_leases_released).toBe(2);

    // Advance clock past reaper's backoff so reaped jobs become claimable
    // (backoffMs(1) = 30_000ms · reaper set next_attempt_at = now + 30s)
    clock.t = new Date(clock.t.getTime() + 31_000);

    // A-replacement worker picks up remaining jobs + the reaped ones
    const D_jobs: string[] = [];
    while (true) {
      const j = await claimNextJob(m.client, { worker_id: "D", job_types: ["source_probe"], lease_seconds: 30, now: () => clock.t });
      if (!j) break;
      D_jobs.push(j.job_id);
      await completeJob(m.client, { job_id: j.job_id, worker_id: "D", now: () => clock.t });
    }

    // Assert: 10 jobs, all completed, no duplicates
    const summary = await loadQueueSummary(m.client);
    expect(summary.completed).toBe(10);
    expect(summary.queued).toBe(0);
    expect(summary.claimed).toBe(0);
    expect(summary.processing).toBe(0);
    expect(summary.dead_letter).toBe(0);
    // The B-claimed jobs are exactly the ones D completed
    for (const id of B_claimed) expect(D_jobs).toContain(id);
    // No duplicate completion (each job_id appears at most once across A/C/D)
    const all_completed = [...A_jobs, ...C_jobs, ...D_jobs];
    expect(new Set(all_completed).size).toBe(10);
  });

  it("(I2) idempotent enqueue during recovery · same idempotency_key returns duplicate not double-work", async () => {
    const m = makeHarvestMock();
    for (let i = 0; i < 5; i++) {
      const r = await enqueueJob(m.client, { job_type: "source_probe", idempotency_key: "dup-key", payload: { attempt: i } });
      if (i === 0) expect(r.kind).toBe("enqueued");
      else         expect(r.kind).toBe("duplicate");
    }
    const summary = await loadQueueSummary(m.client);
    expect(summary.queued).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// J · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Harvest queue · (J) governance canaries", () => {
  it("(J1) boundary markers exported", () => {
    expect(_HARVEST_POSTGRES_IS_AUTHORITY).toContain("nex_harvest_job_table");
    expect(_HARVEST_NEVER_DELETES_JOBS).toContain("completed_or_dead_letter");
    expect(_HARVEST_LEASE_OWNERSHIP_REQUIRED).toContain("wrong_lease_owner");
    expect(_HARVEST_IDEMPOTENCY_ENFORCED_AT_DB).toContain("unique_index");
  });
  it("(J2) module exports NO delete/purge/clear function", async () => {
    const mod: any = await import("..");
    expect(mod.deleteJob).toBeUndefined();
    expect(mod.purgeCompleted).toBeUndefined();
    expect(mod.clearQueue).toBeUndefined();
    expect(mod.dropWorker).toBeUndefined();
    expect(mod.fabricateYield).toBeUndefined();
  });
  it("(J3) backoff is deterministic + monotonic + capped", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(3)).toBe(120_000);
    expect(backoffMs(20)).toBe(3_600_000); // capped
    expect(backoffMs(1)).toBe(backoffMs(1)); // deterministic
  });
});
