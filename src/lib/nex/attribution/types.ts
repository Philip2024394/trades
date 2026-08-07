// NEX Attribution · shared types
//
// Doctrine: docs/JOURNEY_ENGINE_CHARTER.md §13
// Invariant #14 (v1.0.4 amendment): Attribution is Observational.

export type AttributionModel = "first_touch" | "last_touch" | "linear";

export type ConversionEvent = {
  conversion_id: string;
  contact_id: string;
  event_type: string;                                    // 'quote_requested' · 'deposit_paid' · 'installation_completed' · etc
  conversion_value: number;
  currency: string;
  occurred_at: string;
  window_days: number;
  source: "webhook" | "internal" | "manual" | "import";
  correlation_id: string | null;
  external_ref: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ConversionInput = {
  contact_id: string;
  event_type: string;
  conversion_value?: number;
  currency?: string;
  occurred_at?: string;
  window_days?: number;
  source?: ConversionEvent["source"];
  correlation_id?: string;
  external_ref?: string;
  payload?: Record<string, unknown>;
};

export type Attribution = {
  attribution_id: string;
  conversion_id: string;
  contact_id: string;
  model: AttributionModel;
  window_days: number;
  credit_pct: number;
  attributed_value: number;
  currency: string;
  source_event_id: string | null;
  source_event_type: string | null;
  source_event_timestamp: string | null;
  campaign_id: string | null;
  journey_id: string | null;
  journey_version: number | null;
  experiment_id: string | null;
  variant_id: string | null;
  provider: string | null;
  country: string | null;
  domain: string | null;
  attribution_run_id: string | null;
  computed_at: string;
};

// ── Report shapes ────────────────────────────────────────────────
export type ReportRow = {
  key: string;                                           // grouping key (campaign_id · journey_id · variant_id · provider · country · domain)
  label: string | null;                                  // human-readable when known
  conversions: number;                                    // # distinct conversion events touched
  contacts: number;                                       // # distinct contacts
  attributed_value: number;                               // sum of attributed_value
  currency: string;
};

export type ReportSummary = {
  window_days: number;
  model: AttributionModel;
  totals: { conversions: number; contacts: number; attributed_value: number; currency: string };
  by_source_type: Record<"campaign" | "journey" | "experiment" | "variant" | "provider" | "country" | "domain", ReportRow[]>;
  computed_at: string;
};
