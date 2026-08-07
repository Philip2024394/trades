// NEX A/B Testing · shared types
//
// Doctrine: docs/JOURNEY_ENGINE_CHARTER.md §12
// Invariant #13 (v1.0.3 amendment): experiment assignment is sticky
// and deterministic. Never recompute an existing assignment.

export type ExperimentStatus = "draft" | "active" | "paused" | "ended";
export type ExperimentScope  = "journey_node" | "campaign";

export type Experiment = {
  experiment_id: string;
  slug: string;
  name: string;
  description: string | null;
  version: number;
  status: ExperimentStatus;
  scope_type: ExperimentScope;
  scope_ref: string | null;
  goal_event_type: string;
  goal_within_seconds: number;
  seed: number;                                       // immutable · drives deterministic hash
  start_at: string | null;
  end_at:   string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  paused_at:    string | null;
  ended_at:     string | null;
};

export type ExperimentVariant = {
  experiment_id: string;
  variant_id: string;                                 // 'A' · 'B' · 'C' · etc
  name: string | null;
  allocation_pct: number;                             // must sum to 100 across variants
  target_node_id: string | null;                       // for scope=journey_node
  target_campaign_id: string | null;                   // for scope=campaign
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ExperimentAssignment = {
  assignment_id: string;
  experiment_id: string;
  contact_id: string;
  variant_id: string;
  assigned_at: string;
  computed_hash: number;
};

// ── Snapshot slot journey-states can carry ──────────────────────
export type ActiveExperiment = {
  experiment_id: string;
  variant_id: string;
  assigned_at: string;                                 // when this journey_state got assigned
};

// ── Stats shape ──────────────────────────────────────────────────
export type VariantStats = {
  variant_id: string;
  name: string | null;
  allocation_pct: number;
  assigned_contacts: number;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  goal_hits: number;
  conversion_rate: number | null;                     // goal_hits / assigned_contacts
  delivery_rate: number | null;
  open_rate: number | null;
  click_rate: number | null;
};
export type ExperimentStats = {
  experiment_id: string;
  goal_event_type: string;
  window_seconds: number;
  computed_at: string;
  variants: VariantStats[];
};
