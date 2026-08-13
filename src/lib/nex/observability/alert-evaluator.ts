// src/lib/nex/observability/alert-evaluator.ts
//
// F5 phase 2 · Alert evaluator (in-process, dispatch deferred).
//
// Reads enabled rules from nex.alert_rules, cross-checks against the
// current counter snapshot, and returns the subset that are firing NOW.
// This is deliberately dispatch-free: no email, no Slack, no PagerDuty
// (F3 log-drain vendor pick is a prerequisite for real dispatch).
// The evaluated list is exposed on the /brain-health endpoint so
// operators see live firing state today; a dispatcher plugs in later
// by consuming the same evaluator.
//
// Semantics
//   For counter rules that carry a `last_at` timestamp, we treat the
//   "window" as a freshness filter: a rule with counter=cron_tick.failed
//   comparison=gt threshold=3 window_seconds=300 fires when the counter
//   value >= 3 AND last_at falls within the last 300 s. This mirrors the
//   intent of the starter rules — "N failures in the last window" — with
//   the constraint that in-process counters are cumulative-since-boot
//   rather than windowed. When the counter has never been touched
//   (last_at = null), no rule fires.
//
// This is a first-cut evaluator. A future revision may add proper
// rolling-window arithmetic via the audit-log or a time-series backing
// store; the interface here (fires: RuleFiring[]) stays stable.

import { listAlertRules, type AlertRule } from "./alert-rules";
import { snapshot as countersSnapshot, type CounterName, type CounterSnapshot } from "./counters";

export type RuleFiring = {
  rule_id:        string;
  counter_name:   string;
  comparison:     AlertRule["comparison"];
  threshold:      number;
  window_seconds: number;
  severity:       AlertRule["severity"];
  description:    string | null;
  counter_value:  number;
  counter_last_at: string | null;
  age_ms:         number | null;
  fired_at:       string;
  reason:         string;
};

export type EvaluatorResult = {
  evaluated_at:   string;
  rules_total:    number;
  rules_enabled:  number;
  fires:          RuleFiring[];
};

function compare(value: number, cmp: AlertRule["comparison"], threshold: number): boolean {
  switch (cmp) {
    case "gt":  return value >  threshold;
    case "gte": return value >= threshold;
    case "lt":  return value <  threshold;
    case "lte": return value <= threshold;
    case "eq":  return value === threshold;
  }
}

function isWithinWindow(last_at: string | null, window_seconds: number): boolean {
  if (!last_at) return false;
  const age = Date.now() - new Date(last_at).getTime();
  return age <= window_seconds * 1000;
}

/** Evaluate every enabled rule against the current counter snapshot. */
export async function evaluateAlertRules(): Promise<EvaluatorResult> {
  const [rules, snap] = await Promise.all([
    listAlertRules(),
    Promise.resolve(countersSnapshot()),
  ]);
  const enabled = rules.filter((r) => r.enabled);
  const now = new Date().toISOString();
  const fires: RuleFiring[] = [];

  for (const rule of enabled) {
    const counter = (snap as Record<string, CounterSnapshot | undefined>)[rule.counter_name] ?? { count: 0, last_at: null };
    const value = Number(counter.count ?? 0);
    const inWindow = isWithinWindow(counter.last_at, rule.window_seconds);
    const passes = compare(value, rule.comparison, Number(rule.threshold));

    // "lt" rules fire when the counter is silent (no activity) — those
    // don't require a last_at within window; the ABSENCE of activity IS
    // the signal.
    const shouldFire = rule.comparison === "lt" || rule.comparison === "lte"
      ? passes
      : passes && inWindow;

    if (!shouldFire) continue;

    fires.push({
      rule_id:         rule.rule_id,
      counter_name:    rule.counter_name,
      comparison:      rule.comparison,
      threshold:       Number(rule.threshold),
      window_seconds:  rule.window_seconds,
      severity:        rule.severity,
      description:     rule.description,
      counter_value:   value,
      counter_last_at: counter.last_at,
      age_ms:          counter.last_at ? Date.now() - new Date(counter.last_at).getTime() : null,
      fired_at:        now,
      reason:          `${rule.counter_name} ${rule.comparison} ${rule.threshold} (observed ${value}${counter.last_at ? ` · last_at ${counter.last_at}` : " · no activity"})`,
    });
  }

  return {
    evaluated_at:  now,
    rules_total:   rules.length,
    rules_enabled: enabled.length,
    fires,
  };
}

// Type re-exports used by the LLM-health route.
export type { CounterName };
