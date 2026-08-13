// Learning Loop / Learning Brain · types.
//
// Every render becomes knowledge. Store: prompt · scene · objects · materials
// · output · user edits · final accepted · rating · learning signals. After
// thousands of jobs · Nex becomes better.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

export type LearningSignal =
  | "accepted"                           // user accepted without edits
  | "edited"                             // user made edits
  | "rejected"                           // user rejected + regenerated
  | "shared"                             // user shared the output
  | "downloaded"                         // user downloaded
  | "printed"                            // user sent to print
  | "high_critic_score"                  // Image Critic scored >= 85
  | "low_critic_score"                   // Image Critic scored < 60
  | "reality_impossible"                 // Reality Advisor flagged impossible
  | "grammar_violation";                 // Grammar validator flagged

export type LearningRecord = {
  record_id: string;
  captured_at: string;
  project_id?: string;
  memory_id?: string;                    // Design Memory entry this corresponds to
  render_id?: string;                    // Render Manifest id

  // Design context
  theme_pack?: string;
  layout_family?: string;
  camera_profile?: string;
  lighting_profile?: string;
  materials?: readonly string[];
  personality?: string;

  // Outcome
  signals: readonly LearningSignal[];
  critic_score?: number;
  reality_classification?: string;
  user_rating?: number;                  // 1..5

  // Notes
  free_text_feedback?: string;
};

export type LearningQuery = {
  project_id?: string;
  theme_pack?: string;
  personality?: string;
  min_critic_score?: number;
  signal_any?: readonly LearningSignal[];
  since?: string;
  limit?: number;
};

export type LearningInsight = {
  dimension: "theme_pack" | "layout_family" | "camera_profile" | "lighting_profile" | "personality" | "materials";
  key: string;
  sample_size: number;
  mean_critic_score: number;
  acceptance_rate: number;               // fraction of samples with 'accepted' signal
};
