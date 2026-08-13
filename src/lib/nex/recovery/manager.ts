// NEX Recovery Manager · assessment + action + attempt store
//
// DOCTRINE
// A blocked worker must never stay blocked indefinitely. NEX must always be
// attempting recovery, reassignment, or escalation.
// (`feedback_nex_worker_recovery_and_self_healing_2026_08_07.md` +
//  `feedback_nex_recovery_ladder_and_timeline_2026_08_07.md`)
//
// 5-LEVEL ESCALATION LADDER (locked)
//   L1 Retry same provider              (immediate)
//   L2 Switch provider                  (after 30s blocked)
//   L3 Restart worker                   (after 5m blocked)
//   L4 Reassign to standby worker       (after 10m blocked)
//   L5 Escalate to Philip / Director's  (after 15m if L1-4 exhausted)
//
// STORAGE
// Append-only JSONL at `data/nex-recovery/attempts.jsonl` — every attempt
// captured with timestamp + level + outcome. Latest-per-job wins for
// current state · full history preserved for Recovery Timeline.
//
// This module is PURE ASSESSMENT + ATTEMPT LOGGING. It does NOT actually
// restart workers or reassign jobs (those actions require the Dispatch API +
// worker control plane). Every recommended action becomes an Intelligence
// Event so admin sees NEX actively working the problem rather than passively
// waiting.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emitEventSafe } from "../events/fs-store";

// ── Paths ──────────────────────────────────────────────────────────

const ROOT = path.join(process.cwd(), "data", "nex-recovery");
const ATTEMPTS_FILE = path.join(ROOT, "attempts.jsonl");

async function ensureDir(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
}

// ── Types ─────────────────────────────────────────────────────────

export type LadderLevel = 1 | 2 | 3 | 4 | 5;

export type RecoveryAttemptOutcome = "attempted" | "succeeded" | "failed" | "skipped";

export type RecoveryAttempt = {
  attempt_id: string;
  job_id: string;
  level: LadderLevel;
  level_name: string;
  action: string;                  // human-readable · e.g. "Retry Claude" · "Switch to Gemini"
  at: string;                      // ISO
  outcome: RecoveryAttemptOutcome;
  detail: string | null;
  target_provider: string | null;  // for L1/L2
  target_worker: string | null;    // for L4
};

export type RecoveryLadderState = {
  job_id: string;
  blocked_since: string | null;
  minutes_blocked: number;
  levels: Array<{
    n: LadderLevel;
    name: string;
    status: "not_attempted" | "attempting" | "succeeded" | "failed" | "skipped";
    last_attempt: RecoveryAttempt | null;
  }>;
  recommended_next: LadderLevel | null;
  escalated: boolean;
};

// ── Input snapshots for assessment (never fetched here · caller supplies) ─

export type ProviderSnapshot = {
  provider: string;
  configured: boolean;
  status: "healthy" | "idle" | "degraded" | "circuit-open" | "unconfigured";
  circuit_open_ms_remaining?: number | null;
  consecutive_failures?: number;
};

export type WorkerSnapshot = {
  worker_type: string;
  state: "working" | "queued" | "sleeping" | "offline" | "waiting_llm";
  current_job_ref: string | null;
  last_activity_at: string | null;
  jobs_waiting: number;
  jobs_in_flight: number;
};

// ── Attempt store · append + list ─────────────────────────────────

/** Append a new attempt row. Fire-and-forget wrapper below. */
export async function logAttempt(input: Omit<RecoveryAttempt, "attempt_id" | "at">): Promise<RecoveryAttempt> {
  const attempt: RecoveryAttempt = {
    attempt_id: randomUUID(),
    at: new Date().toISOString(),
    ...input,
  };
  await ensureDir();
  await fs.appendFile(ATTEMPTS_FILE, JSON.stringify(attempt) + "\n", "utf8");

  // Every recovery attempt = Intelligence Event so timeline shows it
  emitEventSafe({
    event_type: "recovery_attempt",
    source: "system",
    actor_id: "recovery-manager",
    related_job: attempt.job_id,
    related_department: "operations",
    outcome:
      attempt.outcome === "succeeded" ? "success" :
      attempt.outcome === "failed"    ? "failure" :
                                        "informational",
    payload: {
      level: attempt.level,
      level_name: attempt.level_name,
      action: attempt.action,
      detail: attempt.detail,
      target_provider: attempt.target_provider,
      target_worker: attempt.target_worker,
    },
  });
  return attempt;
}

export async function listAttempts(job_id?: string): Promise<RecoveryAttempt[]> {
  let raw: string;
  try {
    raw = await fs.readFile(ATTEMPTS_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const attempts: RecoveryAttempt[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const a = JSON.parse(line) as RecoveryAttempt;
      if (!job_id || a.job_id === job_id) attempts.push(a);
    } catch { /* skip malformed */ }
  }
  return attempts.sort((a, b) => (a.at < b.at ? -1 : 1));
}

// ── Ladder state derivation ───────────────────────────────────────

const LEVEL_NAMES: Record<LadderLevel, string> = {
  1: "Retry same provider",
  2: "Switch provider",
  3: "Restart worker",
  4: "Reassign to standby",
  5: "Escalate to Philip",
};

const LEVEL_TIMING_MS: Record<LadderLevel, number> = {
  1: 0,                    // immediate
  2: 30 * 1000,            // 30s
  3: 5 * 60 * 1000,        // 5m
  4: 10 * 60 * 1000,       // 10m
  5: 15 * 60 * 1000,       // 15m
};

/**
 * Compute the ladder state for one blocked worker.
 * `worker_last_activity_at` is used to derive `blocked_since` if job history
 * doesn't have anything earlier. Recommendation is the earliest un-attempted
 * level whose time threshold has passed.
 */
export function computeLadderState(
  job_id: string,
  worker: WorkerSnapshot,
  attempts: RecoveryAttempt[],
): RecoveryLadderState {
  const blocked_since = worker.last_activity_at;
  const minutes_blocked = blocked_since
    ? Math.max(0, Math.floor((Date.now() - new Date(blocked_since).getTime()) / 60000))
    : 0;
  const blockedMs = minutes_blocked * 60000;

  const levels: RecoveryLadderState["levels"] = ([1, 2, 3, 4, 5] as LadderLevel[]).map((n) => {
    const jobAttempts = attempts.filter((a) => a.job_id === job_id && a.level === n);
    const last = jobAttempts[jobAttempts.length - 1] ?? null;
    let status: RecoveryLadderState["levels"][number]["status"];
    if (!last) status = "not_attempted";
    else if (last.outcome === "succeeded") status = "succeeded";
    else if (last.outcome === "failed") status = "failed";
    else if (last.outcome === "skipped") status = "skipped";
    else status = "attempting";
    return { n, name: LEVEL_NAMES[n], status, last_attempt: last };
  });

  // Recommend the earliest level whose threshold has passed AND that
  // hasn't been attempted (or has failed and could be retried at a higher level).
  let recommended: LadderLevel | null = null;
  for (const l of levels) {
    if (l.status === "succeeded") continue;
    if (blockedMs >= LEVEL_TIMING_MS[l.n]) {
      if (l.status === "not_attempted" || l.status === "failed") {
        recommended = l.n;
        break;
      }
    }
  }

  const escalated = levels[4]?.last_attempt?.outcome !== undefined && levels[4].last_attempt?.outcome !== "skipped";

  return {
    job_id,
    blocked_since,
    minutes_blocked,
    levels,
    recommended_next: recommended,
    escalated,
  };
}

// ── Recovery scan · consumes worker + provider snapshots, logs actions ──

export type ScanInput = {
  workers: WorkerSnapshot[];
  providers: ProviderSnapshot[];
  dry_run?: boolean;               // default true · assessment only, no action
};

export type ScanResult = {
  scanned_at: string;
  blocked_count: number;
  actions_taken: number;
  ladder_states: RecoveryLadderState[];
  actions: RecoveryAttempt[];
};

/**
 * Scan blocked workers · compute ladder state per job · optionally take
 * the next recommended action (log the attempt · emit the event).
 *
 * WHAT THIS SCAN CAN DO TODAY (no worker control plane yet):
 *  · L1 · Retry — log attempt "will retry on next cycle"
 *  · L2 · Switch provider — log which provider NEX would prefer
 *  · L3 · Restart worker — log recommendation (no restart API yet)
 *  · L4 · Reassign — log target standby worker (no dispatch API yet)
 *  · L5 · Escalate — emit case event to Director's Office
 *
 * When Dispatch API + worker control plane arrive, actions become real
 * provider switches / restarts / reassignments. Every attempt is timestamped,
 * outcome-tagged, and consumable by the Recovery Timeline UI today.
 */
export async function scanForRecovery(input: ScanInput): Promise<ScanResult> {
  const dry_run = input.dry_run ?? true;
  const now = new Date().toISOString();

  const blocked = input.workers.filter((w) => w.state === "waiting_llm" && w.current_job_ref);
  const standby = input.workers.filter((w) => w.state === "sleeping");
  const healthyOther = input.providers.filter(
    (p) => p.configured && (p.status === "healthy" || p.status === "idle"),
  );

  // Load all prior attempts once · faster than per-job reads
  const allAttempts = await listAttempts();
  const ladder_states: RecoveryLadderState[] = [];
  const actions: RecoveryAttempt[] = [];

  for (const w of blocked) {
    const job_id = w.current_job_ref as string;
    const state = computeLadderState(job_id, w, allAttempts);
    ladder_states.push(state);

    if (!state.recommended_next) continue;

    const level = state.recommended_next;

    // Build the action description + skip-if-impossible check
    let action = "";
    let target_provider: string | null = null;
    let target_worker: string | null = null;
    let outcome: RecoveryAttemptOutcome = "attempted";
    let detail: string | null = null;

    if (level === 1) {
      action = "Retry same provider";
      detail = "Will retry on next worker cycle";
    } else if (level === 2) {
      if (healthyOther.length === 0) {
        action = "Switch provider · SKIPPED";
        detail = "No healthy alternate provider available · advancing to L3";
        outcome = "skipped";
      } else {
        target_provider = healthyOther[0].provider;
        action = `Switch to ${target_provider}`;
        detail = `${healthyOther.length} healthy provider(s) available · preferring ${target_provider}`;
      }
    } else if (level === 3) {
      action = "Restart worker";
      detail = "Worker restart recommendation logged · awaits Dispatch API to execute";
    } else if (level === 4) {
      if (standby.length === 0) {
        action = "Reassign · SKIPPED";
        detail = "No standby worker available · advancing to L5";
        outcome = "skipped";
      } else {
        target_worker = standby[0].worker_type;
        action = `Reassign to ${target_worker}`;
        detail = `${standby.length} standby worker(s) available · preferring ${target_worker}`;
      }
    } else if (level === 5) {
      action = "Escalate to Director's Office";
      detail = "L1-L4 exhausted · admin decision required";
      // Also emit a case_opened event to the Director's Office
      emitEventSafe({
        event_type: "case_opened",
        source: "system",
        actor_id: "recovery-manager",
        related_job: job_id,
        related_department: "director",
        outcome: "pending",
        payload: {
          title: `Recovery escalated · job ${job_id.slice(0, 12)}`,
          priority: "P1",
          reason: `Worker ${w.worker_type} blocked ${state.minutes_blocked}m · all 4 recovery attempts exhausted`,
          worker_type: w.worker_type,
          minutes_blocked: state.minutes_blocked,
        },
      });
    }

    // Log the attempt (dry-run still logs · attempts are the audit trail)
    const attempt = await logAttempt({
      job_id,
      level,
      level_name: LEVEL_NAMES[level],
      action,
      outcome,
      detail,
      target_provider,
      target_worker,
    });
    actions.push(attempt);

    if (dry_run) continue;
    // FUTURE: when Dispatch API exists, actually execute the action here.
  }

  return {
    scanned_at: now,
    blocked_count: blocked.length,
    actions_taken: actions.length,
    ladder_states,
    actions,
  };
}
