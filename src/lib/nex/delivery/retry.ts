// NEX Delivery Engine · exponential backoff schedule
//
// attempt 1 failure → wait ~30 s
// attempt 2 failure → wait ~2 min
// attempt 3 failure → wait ~8 min
// attempt 4 failure → wait ~30 min
// attempt 5 failure → move to dead_letter (max_attempts default 5)
//
// Add ±20% jitter to avoid thundering herds when many jobs failed at
// the same time (e.g. provider outage that resolves).

const SCHEDULE_MS = [30_000, 120_000, 480_000, 1_800_000, 7_200_000];

export function backoffFor(attemptNo: number): number {
  const idx = Math.max(0, Math.min(SCHEDULE_MS.length - 1, attemptNo - 1));
  const base = SCHEDULE_MS[idx];
  const jitter = (Math.random() - 0.5) * 0.4;             // ±20%
  return Math.round(base * (1 + jitter));
}
