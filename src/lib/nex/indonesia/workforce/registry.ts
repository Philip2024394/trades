// NEX Workforce Registry.
//
// In-process, file-backed store of workers, jobs, leases, circuit
// breakers, and the dead-letter queue. Every mutation is atomic +
// persisted so a process restart resumes from the same state.
//
// The registry is deliberately a plain object + a save() method — no
// external DB, no worker threads. Perfect for the single-machine
// dev/prod scenario NEX runs in today. If we later scale to multi-
// process, swap this out for a Postgres-backed registry with the
// same interface.
//
// All time-sensitive operations accept a `now()` function so tests
// can drive the clock deterministically.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Job, Lease, WorkerRecord, WorkerState,
  CircuitBreaker, DeadLetterEntry, WorkforceSnapshot,
} from "./types";

/** Schema version stamped in every save · bumped when the snapshot
 *  shape changes incompatibly. Load rejects unknown versions and
 *  falls back to an empty snapshot rather than partial-load garbage. */
const SCHEMA_VERSION = 1;

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE_FILE = path.resolve(here, "../../../../../data/indonesia/workforce-state.json");

export type NowFn = () => Date;
const defaultNow: NowFn = () => new Date();

export type RegistryOptions = {
  stateFile?: string;
  now?: NowFn;
  /** Skip file persistence — for tests. */
  inMemoryOnly?: boolean;
};

export class WorkforceRegistry {
  private snapshot: WorkforceSnapshot;
  private readonly stateFile: string;
  private readonly now: NowFn;
  private readonly persist: boolean;

  constructor(opts: RegistryOptions = {}) {
    this.stateFile = opts.stateFile ?? DEFAULT_STATE_FILE;
    this.now = opts.now ?? defaultNow;
    this.persist = !opts.inMemoryOnly;
    this.snapshot = this.load();
    // Startup sweep · a crash mid-lease leaves stale leases that
    // block new claims. Sweep them so recovery is instant.
    this.sweepStaleOnStartup();
  }

  /** Called once on construction. Any lease whose expiresAt is in the
   *  past is removed and its worker is marked DEAD (the supervisor
   *  will restart it on the next tick with the checkpoint preserved). */
  private sweepStaleOnStartup(): void {
    if (this.snapshot.leases.length === 0) return;
    const now = this.now();
    const stale = this.snapshot.leases.filter((l) => new Date(l.expiresAt) < now);
    if (stale.length === 0) return;
    for (const l of stale) {
      const w = this.snapshot.workers.find((x) => x.id === l.workerId);
      if (w) {
        w.state = "DEAD";
        w.currentJobId = null;
        w.lastError = "startup_sweep_stale_lease";
        w.stateChangedAt = now.toISOString();
      }
    }
    this.snapshot.leases = this.snapshot.leases.filter((l) => new Date(l.expiresAt) >= now);
    this.save();
  }

  // ─── Snapshot access ─────────────────────────────────────────────

  getSnapshot(): WorkforceSnapshot {
    return this.snapshot;
  }

  // ─── Worker lifecycle ────────────────────────────────────────────

  registerWorker(input: { id: string; walkerId: string; region?: string }): WorkerRecord {
    const existing = this.snapshot.workers.find((w) => w.id === input.id);
    if (existing) return existing;
    const nowIso = this.now().toISOString();
    const worker: WorkerRecord = {
      id: input.id,
      walkerId: input.walkerId,
      region: input.region,
      state: "STARTING",
      spawnedAt: nowIso,
      stateChangedAt: nowIso,
      recordsPublished: 0,
      consecutiveFailures: 0,
      currentJobId: null,
    };
    this.snapshot.workers.push(worker);
    this.save();
    return worker;
  }

  setWorkerState(workerId: string, state: WorkerState, extra: Partial<WorkerRecord> = {}): void {
    const w = this.snapshot.workers.find((x) => x.id === workerId);
    if (!w) return;
    w.state = state;
    w.stateChangedAt = this.now().toISOString();
    Object.assign(w, extra);
    this.save();
  }

  recordPublish(workerId: string, records: number): void {
    const w = this.snapshot.workers.find((x) => x.id === workerId);
    if (!w) return;
    const nowIso = this.now().toISOString();
    w.recordsPublished += records;
    w.lastPublishAt = nowIso;
    w.consecutiveFailures = 0;
    this.snapshot.metrics.recordsToday += records;
    this.snapshot.metrics.acquisitionsToday += 1;
    this.snapshot.metrics.lastPublishAt = nowIso;
    this.save();
  }

  recordFailure(workerId: string, reason: string): void {
    const w = this.snapshot.workers.find((x) => x.id === workerId);
    if (!w) return;
    const nowIso = this.now().toISOString();
    w.consecutiveFailures += 1;
    w.lastErrorAt = nowIso;
    w.lastError = reason.slice(0, 200);
    this.snapshot.metrics.failuresToday += 1;
    this.save();
  }

  // ─── Job queue ───────────────────────────────────────────────────

  enqueueJob(job: Omit<Job, "attempts" | "totalAttempts">): Job {
    const existing = this.snapshot.jobs.find((j) => j.id === job.id);
    if (existing) return existing;
    const full: Job = { ...job, attempts: 0, totalAttempts: 0 };
    this.snapshot.jobs.push(full);
    this.save();
    return full;
  }

  updateJob(jobId: string, patch: Partial<Job>): void {
    const j = this.snapshot.jobs.find((x) => x.id === jobId);
    if (!j) return;
    Object.assign(j, patch);
    this.save();
  }

  removeJob(jobId: string): void {
    this.snapshot.jobs = this.snapshot.jobs.filter((j) => j.id !== jobId);
    this.snapshot.leases = this.snapshot.leases.filter((l) => l.jobId !== jobId);
    this.save();
  }

  /** Pick the next eligible job for a worker · returns undefined if
   *  the queue is empty or all jobs are leased / scheduled for later. */
  claimNextJob(workerId: string, opts: { leaseTtlMs: number }): { job: Job; lease: Lease } | undefined {
    const now = this.now();
    const nowIso = now.toISOString();
    // Filter: not currently leased, scheduled_for <= now, priority ordered
    const activeJobIds = new Set(this.snapshot.leases.filter((l) => new Date(l.expiresAt) > now).map((l) => l.jobId));
    const eligible = this.snapshot.jobs
      .filter((j) => !activeJobIds.has(j.id))
      .filter((j) => new Date(j.scheduledFor) <= now)
      .sort((a, b) => a.priority - b.priority || a.scheduledFor.localeCompare(b.scheduledFor));
    const job = eligible[0];
    if (!job) return undefined;

    // Drop any stale lease for this job
    this.snapshot.leases = this.snapshot.leases.filter((l) => l.jobId !== job.id);
    const lease: Lease = {
      jobId: job.id,
      workerId,
      acquiredAt: nowIso,
      expiresAt: new Date(now.getTime() + opts.leaseTtlMs).toISOString(),
      lastHeartbeat: nowIso,
    };
    this.snapshot.leases.push(lease);
    const worker = this.snapshot.workers.find((w) => w.id === workerId);
    if (worker) worker.currentJobId = job.id;
    this.save();
    return { job, lease };
  }

  /** Refresh the lease deadline for a running job. Returns true if
   *  renewed, false if the lease has already expired (worker should
   *  stop and re-claim). */
  heartbeat(workerId: string, jobId: string, opts: { leaseTtlMs: number }): boolean {
    const now = this.now();
    const lease = this.snapshot.leases.find((l) => l.jobId === jobId && l.workerId === workerId);
    if (!lease) return false;
    if (new Date(lease.expiresAt) < now) return false;
    lease.lastHeartbeat = now.toISOString();
    lease.expiresAt = new Date(now.getTime() + opts.leaseTtlMs).toISOString();
    this.save();
    return true;
  }

  releaseJob(jobId: string): void {
    this.snapshot.leases = this.snapshot.leases.filter((l) => l.jobId !== jobId);
    const w = this.snapshot.workers.find((x) => x.currentJobId === jobId);
    if (w) w.currentJobId = null;
    this.save();
  }

  /** Sweep expired leases · returns the job ids that were released. */
  reapExpiredLeases(): string[] {
    const now = this.now();
    const expired = this.snapshot.leases.filter((l) => new Date(l.expiresAt) < now);
    if (expired.length === 0) return [];
    const expiredIds = expired.map((l) => l.jobId);
    this.snapshot.leases = this.snapshot.leases.filter((l) => !expiredIds.includes(l.jobId));
    // Mark any workers who held those leases as DEAD (they missed
    // heartbeats).
    for (const l of expired) {
      const w = this.snapshot.workers.find((x) => x.id === l.workerId);
      if (w) {
        w.state = "DEAD";
        w.stateChangedAt = now.toISOString();
        w.currentJobId = null;
        w.lastError = `lease_expired_after_${(new Date(l.expiresAt).getTime() - new Date(l.acquiredAt).getTime())}ms`;
      }
    }
    this.save();
    return expiredIds;
  }

  // ─── Circuit breakers ────────────────────────────────────────────

  getBreaker(sourceKey: string): CircuitBreaker {
    let b = this.snapshot.breakers.find((x) => x.sourceKey === sourceKey);
    if (!b) {
      b = { sourceKey, state: "closed", failures: 0 };
      this.snapshot.breakers.push(b);
      this.save();
    }
    return b;
  }

  recordBreakerFailure(sourceKey: string, opts: { openAfter: number; openForMs: number }): CircuitBreaker {
    const b = this.getBreaker(sourceKey);
    b.failures += 1;
    if (b.failures >= opts.openAfter && b.state === "closed") {
      const now = this.now();
      b.state = "open";
      b.openedAt = now.toISOString();
      b.nextProbeAt = new Date(now.getTime() + opts.openForMs).toISOString();
    }
    this.save();
    return b;
  }

  recordBreakerSuccess(sourceKey: string): CircuitBreaker {
    const b = this.getBreaker(sourceKey);
    b.failures = 0;
    b.state = "closed";
    b.openedAt = undefined;
    b.nextProbeAt = undefined;
    this.save();
    return b;
  }

  tryHalfOpen(sourceKey: string): CircuitBreaker {
    const b = this.getBreaker(sourceKey);
    if (b.state !== "open" || !b.nextProbeAt) return b;
    const now = this.now();
    if (new Date(b.nextProbeAt) <= now) {
      b.state = "half_open";
      this.save();
    }
    return b;
  }

  // ─── Dead-letter queue ───────────────────────────────────────────

  moveToDeadLetter(entry: DeadLetterEntry): void {
    // Deterministic replace if already present.
    this.snapshot.deadLetter = this.snapshot.deadLetter.filter((d) => d.jobId !== entry.jobId);
    this.snapshot.deadLetter.push(entry);
    this.snapshot.jobs = this.snapshot.jobs.filter((j) => j.id !== entry.jobId);
    this.snapshot.leases = this.snapshot.leases.filter((l) => l.jobId !== entry.jobId);
    this.save();
  }

  requeueFromDeadLetter(jobId: string, scheduledFor: string): boolean {
    const entry = this.snapshot.deadLetter.find((d) => d.jobId === jobId);
    if (!entry) return false;
    this.snapshot.deadLetter = this.snapshot.deadLetter.filter((d) => d.jobId !== jobId);
    this.enqueueJob({
      id: entry.jobId,
      walkerId: entry.walkerId,
      region: entry.region,
      priority: 3,
      scheduledFor,
    });
    return true;
  }

  // ─── Metrics rollover ────────────────────────────────────────────

  /** Reset today's counters if the UTC day has rolled. Call from the
   *  supervisor tick. Idempotent. */
  rolloverMetricsIfNeeded(): void {
    const nowDay = this.now().toISOString().slice(0, 10);
    const lastPub = this.snapshot.metrics.lastPublishAt;
    const lastDay = lastPub ? lastPub.slice(0, 10) : nowDay;
    if (lastPub && lastDay !== nowDay) {
      this.snapshot.metrics.recordsToday = 0;
      this.snapshot.metrics.acquisitionsToday = 0;
      this.snapshot.metrics.failuresToday = 0;
      this.save();
    }
  }

  // ─── Persistence ─────────────────────────────────────────────────

  private load(): WorkforceSnapshot {
    if (!this.persist) return this.emptySnapshot();
    // Always cleanup any leftover tmp file · signals a prior
    // interrupted write. Run BEFORE reading so we never observe our
    // own half-written state.
    this.cleanupTmp();
    try {
      if (!existsSync(this.stateFile)) return this.emptySnapshot();
      const raw = readFileSync(this.stateFile, "utf8");
      const parsed = JSON.parse(raw) as WorkforceSnapshot;
      // Corruption / unknown-schema guards · reject rather than
      // partial-load.
      if (!parsed || typeof parsed !== "object") return this.emptySnapshot();
      if (parsed.schemaVersion !== undefined && parsed.schemaVersion !== SCHEMA_VERSION) return this.emptySnapshot();
      if (!Array.isArray(parsed.workers) || !Array.isArray(parsed.jobs) || !Array.isArray(parsed.leases)) return this.emptySnapshot();
      return parsed;
    } catch {
      // JSON parse failure = corruption · never crash the supervisor.
      return this.emptySnapshot();
    }
  }

  private save(): void {
    if (!this.persist) return;
    try {
      mkdirSync(path.dirname(this.stateFile), { recursive: true });
      const nowIso = this.now().toISOString();
      this.snapshot.takenAt = nowIso;
      this.snapshot.schemaVersion = SCHEMA_VERSION;
      // Atomic write: write to tmp, fsync-ish via close, then rename.
      // On POSIX + NTFS, rename is atomic — either the old file or
      // the new file exists, never a half-written state.
      const tmpFile = this.stateFile + ".tmp";
      writeFileSync(tmpFile, JSON.stringify(this.snapshot, null, 2) + "\n");
      renameSync(tmpFile, this.stateFile);
    } catch {
      // Persistence failures never crash the supervisor · they are
      // observed via the metrics gap only.
    }
  }

  private cleanupTmp(): void {
    const tmpFile = this.stateFile + ".tmp";
    if (existsSync(tmpFile)) {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }

  private emptySnapshot(): WorkforceSnapshot {
    return {
      schemaVersion: SCHEMA_VERSION,
      takenAt: this.now().toISOString(),
      workers: [],
      jobs: [],
      leases: [],
      breakers: [],
      deadLetter: [],
      metrics: { recordsToday: 0, acquisitionsToday: 0, failuresToday: 0 },
    };
  }

  // ─── Supervisor heartbeat (for OUTER watchdog) ───────────────────

  updateSupervisorHeartbeat(patch: {
    successful?: boolean;
    processStartedAt?: string;
    restarted?: boolean;
  } = {}): void {
    const nowIso = this.now().toISOString();
    const existing = this.snapshot.supervisorHeartbeat;
    const hb = {
      lastTickAt: nowIso,
      lastSuccessfulTickAt: patch.successful ? nowIso : existing?.lastSuccessfulTickAt,
      lastRestartAt: patch.restarted ? nowIso : existing?.lastRestartAt,
      processStartedAt: patch.processStartedAt ?? existing?.processStartedAt ?? nowIso,
      ticksTotal: (existing?.ticksTotal ?? 0) + 1,
    };
    this.snapshot.supervisorHeartbeat = hb;
    this.save();
  }
}
