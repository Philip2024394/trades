// NEX Operational Alerts · types
//
// Architecture (Philip 2026-08-08 · locked):
//   Monitoring → Alert Rules → Canonical system.health_alert event
//     → Alert Dispatcher → { email · webhook · slack · future }
//
// Dispatchers deliver already-evaluated alerts · never contain
// evaluation logic.

export type Severity = "info" | "warning" | "critical";
export type AlertState = "open" | "acknowledged" | "resolved";
export type DispatchChannel = "email" | "webhook" | "slack";
export type DispatchStatus = "sent" | "failed" | "skipped";

export type AlertRule = {
  rule_id: string;
  name: string;
  category: string;
  severity: Severity;
  description: string | null;
  params: Record<string, number | string | boolean>;
  enabled: boolean;
  dedup_window_sec: number;
  notify_channels: DispatchChannel[];
  root_cause_of: string[];
  created_at: string;
  updated_at: string;
};

export type Alert = {
  alert_id: string;
  rule_id: string;
  incident_id: string | null;
  severity: Severity;
  state: AlertState;
  title: string;
  detail: string | null;
  snapshot: Record<string, unknown>;
  first_detected_at: string;
  last_triggered_at: string;
  trigger_count: number;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_reason: string | null;
  resolved_by: string | null;
};

export type AlertDispatch = {
  dispatch_id: string;
  alert_id: string;
  channel: DispatchChannel;
  destination: string | null;
  status: DispatchStatus;
  error: string | null;
  latency_ms: number | null;
  attempt_no: number;
  dispatched_at: string;
  metadata: Record<string, unknown>;
};

// ── Snapshot fed to every rule (one query per platform tick) ──────
export type PlatformSnapshot = {
  timestamp: string;
  database_reachable: boolean;
  queue: {
    pending: number; running: number; dead_letter: number;
    oldest_pending_age_seconds: number;
  };
  workers: {
    registered: number; alive: number;
    last_heartbeat: string | null;
    seconds_since_last_heartbeat: number | null;
  };
  providers: Array<{ id: string; configured: boolean; health_ok: boolean | null; health_detail: string | null }>;
  rates: {
    complaint_rate_pct_24h: number | null;
    bounce_rate_pct_24h:    number | null;
    retry_rate_pct_1h:      number | null;
  };
  webhook: {
    verify_failures_last_hour: number;
  };
  limiter: {
    max_saturation_pct: number;         // 100 = a bucket hit zero at least once in the last window
    saturated_buckets: string[];
  };
};

// ── Rule evaluator contract ───────────────────────────────────────
export type RuleTrigger = {
  fires: boolean;
  detail: string;                        // human-readable · shown in alert list
  snapshot: Record<string, unknown>;    // key subset saved with the alert for forensics
};

export type RuleEvaluator = (snapshot: PlatformSnapshot, params: Record<string, number | string | boolean>) => RuleTrigger;
