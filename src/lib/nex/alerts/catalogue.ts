// NEX Operational Alerts · rule catalogue
//
// 13 rules (Philip 2026-08-08 · locked scope). Each rule:
//   · declares its default severity + dedup window + channels
//   · has a pure `evaluate(snapshot, params)` function
//   · returns { fires, detail, snapshot } — no I/O
//
// Root-cause hints (root_cause_of) let a top-level failure (e.g.
// database_unavailable) group downstream symptoms under one incident.

import type { RuleEvaluator, Severity } from "./types";

export type RuleDefinition = {
  rule_id: string;
  name: string;
  category: "queue" | "workers" | "providers" | "compliance" | "rates" | "webhook" | "limiter" | "infra";
  severity: Severity;
  description: string;
  default_params: Record<string, number | string | boolean>;
  default_dedup_window_sec: number;
  default_channels: Array<"email" | "webhook" | "slack">;
  root_cause_of: string[];
  evaluate: RuleEvaluator;
};

const num = (params: Record<string, number | string | boolean>, key: string, fallback: number): number => {
  const v = params[key]; return typeof v === "number" ? v : fallback;
};

export const CATALOGUE: RuleDefinition[] = [
  // ── Infra roots ──────────────────────────────────────────────
  {
    rule_id: "database_unavailable", name: "Database unavailable", category: "infra", severity: "critical",
    description: "Storage layer unreachable · nothing downstream can function", default_params: {},
    default_dedup_window_sec: 300, default_channels: ["email", "webhook", "slack"],
    root_cause_of: ["queue_depth_high", "queue_oldest_high", "no_workers_with_pending", "worker_heartbeat_timeout"],
    evaluate: (s) => ({ fires: s.database_reachable === false, detail: "nex.contacts + nex.delivery_jobs unreachable", snapshot: { database_reachable: s.database_reachable } }),
  },
  {
    rule_id: "storage_unavailable", name: "Storage adapter unhealthy", category: "infra", severity: "warning",
    description: "The active storage adapter reports unhealthy · reads may still work via cache",
    default_params: {}, default_dedup_window_sec: 300, default_channels: ["email", "webhook", "slack"],
    root_cause_of: [],
    evaluate: (s) => ({ fires: s.database_reachable === false, detail: "storage health probe failing", snapshot: { database_reachable: s.database_reachable } }),
  },

  // ── Queue ────────────────────────────────────────────────────
  {
    rule_id: "queue_oldest_high", name: "Oldest pending job age above threshold", category: "queue", severity: "warning",
    description: "A job whose scheduled_for is past has waited longer than the threshold · suggests worker starvation",
    default_params: { threshold_sec: 300 }, default_dedup_window_sec: 300,
    default_channels: ["email", "webhook", "slack"], root_cause_of: [],
    evaluate: (s, p) => {
      const t = num(p, "threshold_sec", 300);
      const age = s.queue.oldest_pending_age_seconds;
      return { fires: age > t, detail: `oldest pending job ${Math.round(age / 60)}m old (threshold ${Math.round(t / 60)}m)`, snapshot: { oldest_pending_age_seconds: age, threshold_sec: t } };
    },
  },
  {
    rule_id: "queue_depth_high", name: "Queue depth above threshold", category: "queue", severity: "warning",
    description: "Pending + running jobs exceed the configured limit",
    default_params: { threshold: 500 }, default_dedup_window_sec: 300,
    default_channels: ["email", "webhook", "slack"], root_cause_of: [],
    evaluate: (s, p) => {
      const t = num(p, "threshold", 500);
      const depth = s.queue.pending + s.queue.running;
      return { fires: depth > t, detail: `queue depth ${depth} (threshold ${t})`, snapshot: { queue_depth: depth, pending: s.queue.pending, running: s.queue.running, threshold: t } };
    },
  },
  {
    rule_id: "dead_letter_present", name: "Dead-letter jobs present", category: "queue", severity: "critical",
    description: "One or more jobs exceeded max_attempts and moved to dead_letter · human review required",
    default_params: {}, default_dedup_window_sec: 900, default_channels: ["email", "webhook", "slack"],
    root_cause_of: [],
    evaluate: (s) => ({ fires: s.queue.dead_letter > 0, detail: `${s.queue.dead_letter} dead-letter job${s.queue.dead_letter === 1 ? "" : "s"}`, snapshot: { dead_letter: s.queue.dead_letter } }),
  },

  // ── Workers ──────────────────────────────────────────────────
  {
    rule_id: "no_workers_with_pending", name: "Pending jobs but zero live workers", category: "workers", severity: "critical",
    description: "Nothing will drain the queue until a worker comes back",
    default_params: {}, default_dedup_window_sec: 180, default_channels: ["email", "webhook", "slack"],
    root_cause_of: [],
    evaluate: (s) => ({ fires: s.queue.pending > 0 && s.workers.alive === 0, detail: `${s.queue.pending} pending · 0 alive workers (${s.workers.registered} registered)`, snapshot: { pending: s.queue.pending, alive: s.workers.alive, registered: s.workers.registered } }),
  },
  {
    rule_id: "worker_heartbeat_timeout", name: "No worker heartbeat within threshold", category: "workers", severity: "warning",
    description: "No worker has ticked recently · either idle or all dead",
    default_params: { threshold_sec: 300 }, default_dedup_window_sec: 600,
    default_channels: ["email", "webhook", "slack"], root_cause_of: [],
    evaluate: (s, p) => {
      const t = num(p, "threshold_sec", 300);
      const gap = s.workers.seconds_since_last_heartbeat ?? Number.POSITIVE_INFINITY;
      return { fires: gap > t, detail: `last heartbeat ${gap === Number.POSITIVE_INFINITY ? "never" : `${Math.round(gap / 60)}m ago`} (threshold ${Math.round(t / 60)}m)`, snapshot: { seconds_since_last_heartbeat: s.workers.seconds_since_last_heartbeat, threshold_sec: t } };
    },
  },

  // ── Providers ────────────────────────────────────────────────
  {
    rule_id: "provider_health_failure", name: "Configured provider health probe failing", category: "providers", severity: "critical",
    description: "A configured (non-simulator) provider's health() returned not ok",
    default_params: {}, default_dedup_window_sec: 300, default_channels: ["email", "webhook", "slack"],
    root_cause_of: [],
    evaluate: (s) => {
      const failing = s.providers.filter((p) => p.id !== "simulator" && p.configured && p.health_ok === false);
      return { fires: failing.length > 0, detail: failing.length === 0 ? "" : `unhealthy: ${failing.map((p) => `${p.id} (${p.health_detail ?? "no detail"})`).join(" · ")}`, snapshot: { unhealthy_providers: failing } };
    },
  },

  // ── Compliance / Rates ───────────────────────────────────────
  {
    rule_id: "complaint_rate_high", name: "Complaint rate above 0.1%", category: "compliance", severity: "critical",
    description: "ISP complaint rate crossed the industry suspension threshold · pause marketing sends immediately",
    default_params: { threshold_pct: 0.1 }, default_dedup_window_sec: 1800,
    default_channels: ["email", "webhook", "slack"], root_cause_of: [],
    evaluate: (s, p) => {
      const t = num(p, "threshold_pct", 0.1);
      const v = s.rates.complaint_rate_pct_24h;
      return { fires: v !== null && v > t, detail: v === null ? "" : `24h complaint rate ${v.toFixed(3)}% (threshold ${t}%)`, snapshot: { complaint_rate_pct_24h: v, threshold_pct: t } };
    },
  },
  {
    rule_id: "bounce_rate_spike", name: "Bounce rate spike", category: "rates", severity: "warning",
    description: "24h bounce rate exceeds the configured red line",
    default_params: { threshold_pct: 5.0 }, default_dedup_window_sec: 1800,
    default_channels: ["email", "webhook", "slack"], root_cause_of: [],
    evaluate: (s, p) => {
      const t = num(p, "threshold_pct", 5.0);
      const v = s.rates.bounce_rate_pct_24h;
      return { fires: v !== null && v > t, detail: v === null ? "" : `24h bounce rate ${v.toFixed(2)}% (threshold ${t}%)`, snapshot: { bounce_rate_pct_24h: v, threshold_pct: t } };
    },
  },
  {
    rule_id: "high_retry_rate", name: "High retry rate", category: "rates", severity: "warning",
    description: "1h transient-failure rate is elevated · usually provider throttling",
    default_params: { threshold_pct: 20.0 }, default_dedup_window_sec: 900,
    default_channels: ["email", "webhook", "slack"], root_cause_of: [],
    evaluate: (s, p) => {
      const t = num(p, "threshold_pct", 20.0);
      const v = s.rates.retry_rate_pct_1h;
      return { fires: v !== null && v > t, detail: v === null ? "" : `1h retry rate ${v.toFixed(1)}% (threshold ${t}%)`, snapshot: { retry_rate_pct_1h: v, threshold_pct: t } };
    },
  },

  // ── Webhook ──────────────────────────────────────────────────
  {
    rule_id: "webhook_verify_failures", name: "Webhook signature failures", category: "webhook", severity: "warning",
    description: "One or more provider webhooks failed signature verification in the last hour · possible misconfig OR forgery attempts",
    default_params: { threshold: 5 }, default_dedup_window_sec: 900,
    default_channels: ["email", "webhook", "slack"], root_cause_of: [],
    evaluate: (s, p) => {
      const t = num(p, "threshold", 5);
      const v = s.webhook.verify_failures_last_hour;
      return { fires: v > t, detail: `${v} verify failures in last hour (threshold ${t})`, snapshot: { verify_failures_last_hour: v, threshold: t } };
    },
  },

  // ── Rate limiter ─────────────────────────────────────────────
  {
    rule_id: "rate_limiter_saturated", name: "Rate limiter saturated", category: "limiter", severity: "warning",
    description: "A limiter bucket has hit zero tokens · sends are being throttled",
    default_params: {}, default_dedup_window_sec: 600, default_channels: ["email", "webhook", "slack"],
    root_cause_of: [],
    evaluate: (s) => ({ fires: s.limiter.max_saturation_pct >= 100 && s.limiter.saturated_buckets.length > 0, detail: `saturated buckets: ${s.limiter.saturated_buckets.join(" · ")}`, snapshot: s.limiter }),
  },
];

export function findRule(id: string): RuleDefinition | undefined {
  return CATALOGUE.find((r) => r.rule_id === id);
}
