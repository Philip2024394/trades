// NEX Journey Engine · Trigger shared types
//
// Doctrine: docs/JOURNEY_ENGINE_CHARTER.md §11
// Charter §11.4 locks the JourneyTriggerEvent envelope · every
// evaluator produces this shape · never invents its own payload wrapper.

export type TriggerType =
  | "segment_join"
  | "analytics_event"
  | "compliance_transition"
  | "inactivity"
  | "custom_webhook"
  | "schedule";

export type TriggerStatus = "draft" | "active" | "paused" | "archived";

export type JourneyTrigger = {
  trigger_id: string;
  journey_id: string;
  trigger_key: string;
  version: number;
  status: TriggerStatus;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  dedup_window_sec: number;
  correlation_scope: "per_contact" | "per_event";
  last_fired_at: string | null;
  fire_count: number;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  paused_at: string | null;
  archived_at: string | null;
};

// ── Locked envelope · charter §11.4 ──────────────────────────────
export type JourneyTriggerEvent = {
  trigger_id: string;
  trigger_type: TriggerType;
  journey_id: string;
  contact_id: string;
  event_time: string;                        // ISO · when the underlying event OCCURRED
  payload: Record<string, unknown>;
  correlation_id: string;                    // groups related events (one webhook may fan out to N triggers)
  causation_id: string;                      // e.g. analytics_event_id · inbound_event_id · tick_id
};

// ── Evaluator contract ──────────────────────────────────────────
export type EvalContext = {
  trigger: JourneyTrigger;
  now: Date;                                 // injected · never Date.now() inside evaluate() · invariant #11
  tick_id: string;                           // per-tick correlation stem
};

export type Evaluator = (ctx: EvalContext) => Promise<JourneyTriggerEvent[]>;

// ── Inbound webhook debug record · charter §11.5 ─────────────────
export type InboundEvent = {
  inbound_event_id: string;
  trigger_key: string;
  received_at: string;
  payload: Record<string, unknown>;
  contact_id: string | null;
  source: "webhook" | "internal";
  verified_signature: boolean;
  signature_algorithm: string | null;
  request_headers: Record<string, string>;
  raw_body_hash: string | null;
  ip: string | null;
  processed_at: string | null;
  matched_triggers: number;
  matched_journey_ids: string[];
  processing_error: string | null;
};
