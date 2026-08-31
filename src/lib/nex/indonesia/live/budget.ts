// Per-source rate-limit + budget accounting.
//
// Every live connector declares (or defaults to) a policy: max
// requests per minute, per day, and optional cost per request. The
// runtime consults the budget BEFORE polling · if any window is
// exhausted the connector is skipped for this tick (its eligibility
// returns automatically as the window rolls forward).
//
// State is persisted so budgets survive process restarts · no gaming
// via SIGKILL. In-memory operations · file-backed via the same tmp
// + rename pattern as the workforce registry.
//
// This is what prevents a runaway walker from hammering BMKG at 10
// Hz. Even a bug that ignores pollIntervalMs runs into the budget.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE_FILE = path.resolve(here, "../../../../../data/indonesia/live-budgets.json");

export type BudgetPolicy = {
  sourceId: string;
  /** Max requests in any 60-second window. Default: no limit. */
  maxPerMinute?: number;
  /** Max requests in any 24-hour window. Default: no limit. */
  maxPerDay?: number;
  /** Cost per request (USD, IDR, or unit-of-choice). Aggregated
   *  daily · exposed to HQ so ops can see the running spend. */
  costPerRequest?: number;
  /** Currency label · informational · defaults to "unit". */
  costUnit?: string;
};

export type BudgetSnapshot = {
  schemaVersion: number;
  updatedAt: string;
  /** Per-source ring-buffer of poll timestamps (ISO). Trimmed at
   *  read-time to only entries within the largest window (24h). */
  polls: Record<string, string[]>;
  /** Per-source per-day cumulative cost, keyed by ISO date (UTC). */
  costs: Record<string, Record<string, number>>;
  policies: Record<string, BudgetPolicy>;
};

const SCHEMA_VERSION = 1;

export type BudgetVerdict =
  | { ok: true }
  | { ok: false; reason: "per_minute_exhausted" | "per_day_exhausted"; nextEligibleAt: string };

export type BudgetRegistryOptions = {
  stateFile?: string;
  now?: () => Date;
  inMemoryOnly?: boolean;
};

export class BudgetRegistry {
  private snapshot: BudgetSnapshot;
  private readonly stateFile: string;
  private readonly now: () => Date;
  private readonly persist: boolean;

  constructor(opts: BudgetRegistryOptions = {}) {
    this.stateFile = opts.stateFile ?? DEFAULT_STATE_FILE;
    this.now = opts.now ?? (() => new Date());
    this.persist = !opts.inMemoryOnly;
    this.snapshot = this.load();
  }

  /** Register (or update) the policy for a source. */
  setPolicy(policy: BudgetPolicy): void {
    this.snapshot.policies[policy.sourceId] = policy;
    this.save();
  }

  getPolicy(sourceId: string): BudgetPolicy | undefined {
    return this.snapshot.policies[sourceId];
  }

  /** Decide whether the source may poll right now. Never throws. */
  check(sourceId: string): BudgetVerdict {
    const policy = this.snapshot.policies[sourceId];
    if (!policy) return { ok: true };
    const now = this.now();
    const nowMs = now.getTime();
    const polls = this.trimAndGetPolls(sourceId, now);

    if (typeof policy.maxPerMinute === "number") {
      const cutoff = nowMs - 60_000;
      const inMinute = polls.filter((iso) => new Date(iso).getTime() > cutoff).length;
      if (inMinute >= policy.maxPerMinute) {
        // Next-eligible = oldest-in-minute + 60s (or now+60s if the
        // policy is 0 with no history yet).
        const oldestInMinute = polls.find((iso) => new Date(iso).getTime() > cutoff);
        const anchorMs = oldestInMinute ? new Date(oldestInMinute).getTime() : nowMs;
        return { ok: false, reason: "per_minute_exhausted", nextEligibleAt: new Date(anchorMs + 60_000).toISOString() };
      }
    }

    if (typeof policy.maxPerDay === "number") {
      const cutoff = nowMs - 24 * 60 * 60_000;
      const inDay = polls.filter((iso) => new Date(iso).getTime() > cutoff).length;
      if (inDay >= policy.maxPerDay) {
        const oldestInDay = polls.find((iso) => new Date(iso).getTime() > cutoff);
        const anchorMs = oldestInDay ? new Date(oldestInDay).getTime() : nowMs;
        return { ok: false, reason: "per_day_exhausted", nextEligibleAt: new Date(anchorMs + 24 * 60 * 60_000).toISOString() };
      }
    }

    return { ok: true };
  }

  /** Record a poll · charges the cost against today's budget. Call
   *  AFTER the runtime has actually issued the request (successful
   *  or not · rate limits protect the source, not just successes). */
  recordPoll(sourceId: string): void {
    const now = this.now();
    const nowIso = now.toISOString();
    const arr = this.snapshot.polls[sourceId] ?? (this.snapshot.polls[sourceId] = []);
    arr.push(nowIso);
    // Trim to prevent unbounded growth · keep last 24h + a safety margin.
    const cutoff = now.getTime() - 25 * 60 * 60_000;
    while (arr.length > 0 && new Date(arr[0]).getTime() < cutoff) arr.shift();

    const policy = this.snapshot.policies[sourceId];
    if (policy?.costPerRequest) {
      const day = nowIso.slice(0, 10);
      const bySource = this.snapshot.costs[sourceId] ?? (this.snapshot.costs[sourceId] = {});
      bySource[day] = (bySource[day] ?? 0) + policy.costPerRequest;
    }
    this.save();
  }

  /** Rolled-up view for HQ. */
  summary(): Array<{ sourceId: string; policy: BudgetPolicy | null; last60s: number; last24h: number; todayCost: number; costUnit: string; nextEligibleAt?: string }> {
    const now = this.now();
    const nowMs = now.getTime();
    const today = now.toISOString().slice(0, 10);
    const allSources = new Set<string>([...Object.keys(this.snapshot.polls), ...Object.keys(this.snapshot.policies)]);
    const out: ReturnType<BudgetRegistry["summary"]> = [];
    for (const sourceId of allSources) {
      const polls = this.trimAndGetPolls(sourceId, now);
      const last60s = polls.filter((iso) => new Date(iso).getTime() > nowMs - 60_000).length;
      const last24h = polls.filter((iso) => new Date(iso).getTime() > nowMs - 24 * 60 * 60_000).length;
      const policy = this.snapshot.policies[sourceId] ?? null;
      const todayCost = this.snapshot.costs[sourceId]?.[today] ?? 0;
      const verdict = this.check(sourceId);
      out.push({
        sourceId, policy, last60s, last24h, todayCost,
        costUnit: policy?.costUnit ?? "unit",
        nextEligibleAt: verdict.ok ? undefined : verdict.nextEligibleAt,
      });
    }
    return out.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  }

  // ─── internals ───────────────────────────────────────────────────

  private trimAndGetPolls(sourceId: string, now: Date): string[] {
    const arr = this.snapshot.polls[sourceId];
    if (!arr) return [];
    const cutoff = now.getTime() - 25 * 60 * 60_000;
    while (arr.length > 0 && new Date(arr[0]).getTime() < cutoff) arr.shift();
    return arr;
  }

  private load(): BudgetSnapshot {
    if (!this.persist) return this.empty();
    this.cleanupTmp();
    try {
      if (!existsSync(this.stateFile)) return this.empty();
      const parsed = JSON.parse(readFileSync(this.stateFile, "utf8")) as BudgetSnapshot;
      if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return this.empty();
      if (!parsed.polls || !parsed.policies) return this.empty();
      return parsed;
    } catch { return this.empty(); }
  }

  private save(): void {
    if (!this.persist) return;
    try {
      mkdirSync(path.dirname(this.stateFile), { recursive: true });
      this.snapshot.schemaVersion = SCHEMA_VERSION;
      this.snapshot.updatedAt = this.now().toISOString();
      const tmp = this.stateFile + ".tmp";
      writeFileSync(tmp, JSON.stringify(this.snapshot, null, 2) + "\n");
      renameSync(tmp, this.stateFile);
    } catch { /* never crash */ }
  }

  private cleanupTmp(): void {
    const tmp = this.stateFile + ".tmp";
    if (existsSync(tmp)) { try { unlinkSync(tmp); } catch { /* */ } }
  }

  private empty(): BudgetSnapshot {
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: this.now().toISOString(),
      polls: {},
      costs: {},
      policies: {},
    };
  }
}

/** Default policies · conservative starting values that ops can
 *  tighten in production. */
export const DEFAULT_BUDGETS: Record<string, BudgetPolicy> = {
  "live.bmkg.earthquake": { sourceId: "live.bmkg.earthquake", maxPerMinute: 2, maxPerDay: 1440 },
  "live.bmkg.tsunami":    { sourceId: "live.bmkg.tsunami",    maxPerMinute: 2, maxPerDay: 1440 },
  "live.bmkg.weather":    { sourceId: "live.bmkg.weather",    maxPerMinute: 4, maxPerDay: 500 },
  "live.magma.volcano":   { sourceId: "live.magma.volcano",   maxPerMinute: 1, maxPerDay: 200 },
};
