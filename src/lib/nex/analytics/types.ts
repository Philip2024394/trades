// NEX Analytics · canonical event + rollup types
//
// Standardised event schema (Philip 2026-08-08 · locked · 10 types):
//   queued · delivered · deferred · opened · clicked · bounced ·
//   complaint · unsubscribed · failed · suppressed
//
// Everything downstream (Executive Dashboard · Campaign Analytics ·
// Segment Intelligence · Reports · A/B · Attribution) derives from
// this ONE stream.

export type EventType =
  | "queued" | "delivered" | "deferred" | "opened" | "clicked"
  | "bounced" | "complaint" | "unsubscribed" | "failed" | "suppressed";

export type AnalyticsEvent = {
  event_id?: string;                          // omit on insert
  event_type: EventType;
  event_timestamp?: string;                    // when the event OCCURRED · defaults to NOW
  campaign_id?: string | null;
  recipient_id?: string | null;
  segment_id?: string | null;
  provider?: string | null;
  country?: string | null;
  domain?: string | null;
  metadata?: Record<string, unknown>;
  provider_message_id?: string | null;
  user_agent?: string | null;
  ip?: string | null;
  link_url?: string | null;
  latency_ms?: number | null;
  // Reserved future fields (accepted at ingest · surfaced by later phases)
  conversion_value?: number | null;
  revenue?: number | null;
  attribution_window?: number | null;
  journey_id?: string | null;
  automation_id?: string | null;
  experiment_id?: string | null;
  variant_id?: string | null;
};

export type MetricSet = {
  sent: number; delivered: number;
  opens: number; unique_opens: number;
  clicks: number; unique_clicks: number;
  bounces: number; complaints: number; unsubscribes: number;
  failed: number; suppressed: number;
  delivery_rate: number | null;
  open_rate: number | null;
  click_rate: number | null;
  ctor: number | null;                          // click-to-open rate
};
