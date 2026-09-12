// src/lib/nex/master-ai/cost-intelligence.ts
//
// NEX Master AI Engineer · Cost / Quota / Storage Intelligence · §25 §44
// Philip 2026-09-07 · AUTHORIZE (Wave 2 · continuous mission)
//
// Tracks per-source quota policies and usage events. FAIL-CLOSED on
// quota exhaustion. Never silently exceeds an authorized limit.
//
// NEX Data Economy principle enforced here:
//   VALUE × QUALITY × FRESHNESS × COVERAGE
//   ─────────────────────────────────────
//   STORAGE + BANDWIDTH + COMPUTE + API COST + COMPLEXITY

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { quotaPoliciesPath, usageEventsPath } from "./paths";
import { getSource } from "./research-engine";
import type {
  SourceQuotaPolicy,
  UsageEvent,
  UsageMetric,
  QuotaCheckResult,
} from "./types";

export class QuotaExhaustedError extends Error {
  constructor(source_slug: string, metric: UsageMetric) { super(`quota_exhausted:${source_slug}:${metric}`); }
}

// ─── Quota policies ────────────────────────────────────────────────

export function setPolicy(input: Omit<SourceQuotaPolicy, "updated_at_iso">): SourceQuotaPolicy {
  const record: SourceQuotaPolicy = {
    ...input,
    updated_at_iso: new Date().toISOString(),
  };
  appendJsonLine(quotaPoliciesPath(), record);
  return record;
}

export function readAllPolicies(): SourceQuotaPolicy[] {
  return readJsonlAll<SourceQuotaPolicy>(quotaPoliciesPath());
}

/** Latest policy per (source_slug, metric). */
export function currentPolicy(source_slug: string, metric: UsageMetric): SourceQuotaPolicy | null {
  let latest: SourceQuotaPolicy | null = null;
  for (const p of readAllPolicies()) {
    if (p.source_slug === source_slug && p.metric === metric) latest = p;
  }
  return latest;
}

// ─── Usage recording ───────────────────────────────────────────────

export function recordUsage(input: Omit<UsageEvent, "event_id" | "observed_at_iso">): UsageEvent {
  const event: UsageEvent = {
    ...input,
    event_id: randomUUID(),
    observed_at_iso: new Date().toISOString(),
  };
  appendJsonLine(usageEventsPath(), event);
  return event;
}

export function readAllUsage(): UsageEvent[] {
  return readJsonlAll<UsageEvent>(usageEventsPath());
}

// ─── Quota check (fail-closed) ─────────────────────────────────────

function windowStartToday(nowMs: number): number {
  const d = new Date(nowMs);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/** Compute today's total OK usage per metric for a source. Rejected
 *  events are NOT counted (they didn't happen). */
export function usageTodaySoFar(source_slug: string, metric: UsageMetric, nowMs = Date.now()): number {
  const dayStart = windowStartToday(nowMs);
  let total = 0;
  for (const e of readAllUsage()) {
    if (e.source_slug !== source_slug) continue;
    if (e.metric !== metric) continue;
    if (e.status !== "OK") continue;
    const t = Date.parse(e.observed_at_iso);
    if (Number.isFinite(t) && t >= dayStart) total += e.units;
  }
  return total;
}

/** Check whether a proposed usage is allowed under current policy.
 *  If the source is not registered OR unauthorized, REJECT.
 *  If a hard_daily_limit exists, REJECT once it would be exceeded.
 *  Free allowance is exhausted first, then paid. */
export function checkQuota(input: {
  source_slug: string;
  metric: UsageMetric;
  units: number;
  now?: number;
}): QuotaCheckResult {
  const source = getSource(input.source_slug);
  if (!source) return { allowed: false, reason: "SOURCE_UNAUTHORIZED", details: `unregistered:${input.source_slug}` };
  if (source.authorization_state !== "AUTHORIZED") {
    return { allowed: false, reason: "SOURCE_UNAUTHORIZED", details: `state:${source.authorization_state}` };
  }
  const policy = currentPolicy(input.source_slug, input.metric);
  if (!policy) {
    // No policy = source is registered but no quota policy set. Allow
    // but return nulls · caller may still choose to reject.
    return { allowed: true, remaining_free: null, remaining_paid: null };
  }
  const usedToday = usageTodaySoFar(input.source_slug, input.metric, input.now);
  const projected = usedToday + input.units;

  if (policy.hard_daily_limit !== null && projected > policy.hard_daily_limit) {
    return {
      allowed: false,
      reason: "HARD_LIMIT_REACHED",
      details: `used=${usedToday} projected=${projected} hard_limit=${policy.hard_daily_limit}`,
    };
  }

  const freeCap = policy.free_allowance_per_day ?? 0;
  const paidCap = policy.paid_allowance_per_day ?? 0;
  const combinedCap = freeCap + paidCap;
  if (combinedCap > 0 && projected > combinedCap) {
    return {
      allowed: false,
      reason: "QUOTA_EXHAUSTED",
      details: `used=${usedToday} projected=${projected} free=${freeCap} paid=${paidCap}`,
    };
  }
  const remaining_free = policy.free_allowance_per_day === null
    ? null
    : Math.max(0, policy.free_allowance_per_day - usedToday);
  const remaining_paid = policy.paid_allowance_per_day === null
    ? null
    : Math.max(0, policy.paid_allowance_per_day - Math.max(0, usedToday - (policy.free_allowance_per_day ?? 0)));
  return { allowed: true, remaining_free, remaining_paid };
}

/** Convenience: request quota and record the resulting usage event.
 *  If the check fails, records a REJECTED_* event and returns null. */
export function tryConsume(input: {
  source_slug: string;
  metric: UsageMetric;
  units: number;
  invoker: string;
  now?: number;
}): UsageEvent {
  const check = checkQuota(input);
  if (!check.allowed) {
    const status = check.reason === "SOURCE_UNAUTHORIZED"
      ? "REJECTED_UNAUTHORIZED" as const
      : check.reason === "HARD_LIMIT_REACHED"
      ? "REJECTED_LIMIT" as const
      : "REJECTED_QUOTA" as const;
    return recordUsage({
      source_slug: input.source_slug,
      metric: input.metric,
      units: input.units,
      status,
      cost_estimate_idr: null,
      invoker: input.invoker,
    });
  }
  const policy = currentPolicy(input.source_slug, input.metric);
  const cost_estimate_idr = policy?.cost_per_unit_paid_idr && policy.free_allowance_per_day !== null
    ? Math.max(0, input.units - (check.remaining_free ?? 0)) * policy.cost_per_unit_paid_idr
    : null;
  return recordUsage({
    source_slug: input.source_slug,
    metric: input.metric,
    units: input.units,
    status: "OK",
    cost_estimate_idr,
    invoker: input.invoker,
  });
}

// ─── Test isolation ────────────────────────────────────────────────

export function _resetCostForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  for (const p of [quotaPoliciesPath(), usageEventsPath()]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
