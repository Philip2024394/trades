// NEX Indonesia Knowledge Workforce · types.
//
// Persistent, self-healing acquisition infrastructure. Workers are
// treated as supervised processes with an explicit state machine.
// Failure is normal; the workforce absorbs it.
//
// State machine (Philip 2026-08-30):
//
//   STARTING ──▶ RUNNING ──▶ WAITING ──▶ RUNNING ──▶ ...
//                   │                        │
//                   ├──▶ RETRYING ──▶ BACKOFF ──▶ RUNNING
//                   │                        │
//                   ├──▶ STUCK ──▶ (supervisor restart) ──▶ STARTING
//                   │
//                   └──▶ DRAINING ──▶ COMPLETED
//
//   Any state can transition to DEAD (heartbeat expiry) — supervisor
//   restarts DEAD workers back to STARTING with checkpoint preserved.

export type WorkerState =
  | "STARTING"    // spawned, about to acquire()
  | "RUNNING"     // actively acquiring
  | "WAITING"     // between acquisitions on cadence
  | "RETRYING"    // last attempt failed, retrying now
  | "BACKOFF"     // waiting out an exponential backoff
  | "STUCK"       // supervisor decided this worker is not making progress
  | "DEAD"        // heartbeat expired, needs restart
  | "DRAINING"    // graceful shutdown in progress
  | "COMPLETED";  // done (permanent, e.g. one-shot walker finished)

/** Every job is one atomic unit of work a walker can process — the
 *  full acquire() for a walker in v1. When we fleet-plan, one walker
 *  spec becomes N region-sharded jobs. */
export type Job = {
  id: string;                    // "job:walker.culture.traditions:bali"
  walkerId: string;              // "walker.culture.traditions"
  /** Optional region shard · when set, the fleet planner has split
   *  this walker across regions. */
  region?: string;
  /** Deterministic priority · lower runs first when the queue is
   *  saturated. Set by the walker's spec (Tier A = 1, B = 2, C = 3). */
  priority: number;
  /** ISO date · when this job may next be attempted. */
  scheduledFor: string;
  /** Consecutive failure count · resets on success. */
  attempts: number;
  /** Cumulative attempts ever · never resets · used for dead-letter
   *  routing when a job has failed forever. */
  totalAttempts: number;
  /** Last successful checkpoint · walker-specific opaque payload. */
  checkpoint?: unknown;
  /** Which source-adapter is currently attached (for circuit-breaker
   *  attribution). */
  sourceKey?: string;
};

/** A lease is what claims a job for a specific worker for a bounded
 *  window. If the worker fails to renew (heartbeat missed), the lease
 *  expires and the job returns to the queue. */
export type Lease = {
  jobId: string;
  workerId: string;
  /** ISO date · when this lease was taken. */
  acquiredAt: string;
  /** ISO date · when this lease auto-expires unless renewed. */
  expiresAt: string;
  /** ISO date · last heartbeat from the worker. */
  lastHeartbeat: string;
};

export type WorkerRecord = {
  id: string;                    // "worker:culture.traditions"
  walkerId: string;
  region?: string;
  state: WorkerState;
  /** ISO date · when the worker was created. */
  spawnedAt: string;
  /** ISO date · last state transition. */
  stateChangedAt: string;
  /** ISO date · last time this worker successfully published anything. */
  lastPublishAt?: string;
  /** ISO date · last error timestamp. */
  lastErrorAt?: string;
  /** Short error string (last failure reason). */
  lastError?: string;
  /** Records this worker has published in its lifetime. */
  recordsPublished: number;
  /** Consecutive failed attempts. */
  consecutiveFailures: number;
  /** Currently-held job (null when idle). */
  currentJobId: string | null;
};

export type CircuitBreakerState = "closed" | "open" | "half_open";

export type CircuitBreaker = {
  sourceKey: string;             // "curated" | "walker-config:foo" | "http://api.example"
  state: CircuitBreakerState;
  /** Consecutive failures on this source. */
  failures: number;
  /** ISO date · when the breaker opened. */
  openedAt?: string;
  /** ISO date · when the breaker will attempt half-open probe. */
  nextProbeAt?: string;
};

export type DeadLetterEntry = {
  jobId: string;
  walkerId: string;
  region?: string;
  failedAt: string;
  attempts: number;
  reason: string;
  /** Full error context for post-mortem. */
  errorHistory: Array<{ at: string; reason: string }>;
};

export type WorkforceSnapshot = {
  /** Schema version · rejected as corrupt if unrecognised. */
  schemaVersion?: number;
  /** ISO date · when this snapshot was taken. */
  takenAt: string;
  workers: WorkerRecord[];
  jobs: Job[];
  leases: Lease[];
  breakers: CircuitBreaker[];
  deadLetter: DeadLetterEntry[];
  /** Rolling counters. */
  metrics: {
    /** Records published across the workforce today (UTC day boundary). */
    recordsToday: number;
    /** Successful acquisitions today. */
    acquisitionsToday: number;
    /** Failures today. */
    failuresToday: number;
    /** ISO date · last publish anywhere in the workforce. */
    lastPublishAt?: string;
  };
  /** Supervisor heartbeat — updated every tick. The OUTER watchdog
   *  reads this to detect "process alive but no progress" cases. */
  supervisorHeartbeat?: {
    lastTickAt: string;
    lastSuccessfulTickAt?: string;
    lastRestartAt?: string;
    processStartedAt: string;
    ticksTotal: number;
  };
};

/** Snapshot of the workforce grouped for the HQ view. */
export type WorkforceReport = {
  takenAt: string;
  totals: {
    workers: number;
    byState: Record<WorkerState, number>;
    recordsToday: number;
    lastPublishAt?: string;
  };
  /** Grouped by walker-taxonomy branch. */
  byBranch: Array<{
    branch: string;
    workers: number;
    healthy: number;
    degraded: number;
    dead: number;
  }>;
  recentIncidents: Array<{
    workerId: string;
    state: WorkerState;
    since: string;
    reason?: string;
  }>;
  openBreakers: CircuitBreaker[];
  deadLetterCount: number;
};
