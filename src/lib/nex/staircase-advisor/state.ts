// Staircase Advisor · in-memory conversation state
//
// Keyed by conversation_id · 1-hour TTL · cleared on server restart.
// Smallest working storage per Philip 2026-08-01 "Lock truth → build
// smallest capability → observe → improve." Persistence store choice
// (Open Q1) deferred until real customer data shows in-memory is
// insufficient.

import "server-only";

export type ProjectType =
  | "new-build"
  | "renovation"
  | "replacement"
  | "loft-conversion"
  | "extension"
  | "unknown";

export type RecommendationStage =
  | "none"
  | "collecting"
  | "stage_1_direction"
  | "stage_2_detailed"
  | "handoff";

export type AdvisorState = {
  conversation_id: string;
  advisor_active:  boolean;

  // Pass 3 core fields
  project_type?: ProjectType;
  style?:        string;
  timber?:       string;
  layout?:       string;
  balustrade?:   string;

  // Pass 3 site-evidence fields (branch-specific)
  floor_to_floor_height?: string;
  available_space?:       string;
  opening_size?:          string;
  drawings_available?:    boolean;
  location?:              string;

  // Philip 2026-08-01 · Conversation-continuation fields
  // Address the "hallway restarts the conversation" bug: a design-enquiry
  // ("have you got straight stairs?") should ask about physical location
  // next, not restart with the mandatory project_type gate. install_location
  // satisfies the same gating purpose as project_type for design-enquiry
  // entries · design_enquiry_context remembers Turn 1's design signals so
  // downstream retrieval can filter with them even after the message has
  // scrolled off.
  install_location?:        string;      // hallway · loft · extension · new-build · renovation · entrance · foyer · porch · reception · corridor · vestibule · landing
  design_enquiry_context?:  {
    staircase_type?: string;             // "straight" · "quarter-turn" · "spiral" · "helical" · "curved" · "floating"
    design_style?:   string;             // "modern" · "contemporary" · "traditional" · "industrial" · "luxury"
    materials?:      string[];           // ["oak"] · ["walnut"] · ["glass"] · etc.
  };

  // Philip 2026-08-01 · Topic memory for short follow-ups.
  // After every content-serving turn we record the user's original message here
  // so a subsequent short reply ("ok show me" · "images please") can inherit the
  // topic instead of resetting the conversation. Cleared only when the user
  // starts a new full-sentence topic.
  last_user_query?:       string;

  // Philip 2026-08-02 · Regional Language Layer (Priority 1 intelligence layer).
  // Detected from user message ("I'm in Ireland" · "based in California" etc.).
  // When present, the composer adopts regional vocabulary and framing per
  // src/lib/nex/staircase-advisor/regional-terminology.ts. Sticky for the
  // conversation once detected · re-detected on every turn so the customer
  // can correct it ("actually I'm in Australia").
  user_country?:          "UK" | "IE" | "US" | "CA" | "AU" | "NZ";

  // Traversal metadata
  answered_order:         string[];
  questions_asked_count:  number;
  branch_context:         Record<string, unknown>;
  handoff_reason?:        string;
  recommendation_stage:   RecommendationStage;
  next_decision_required?: string;  // key of the field just asked, so bare-word answers on next turn extract correctly

  created_at: number;
  updated_at: number;
};

const STATE_STORE = new Map<string, AdvisorState>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

function gcExpired(): void {
  const now = Date.now();
  for (const [id, s] of STATE_STORE) {
    if (now - s.updated_at > TTL_MS) STATE_STORE.delete(id);
  }
}

export function getOrCreateState(conversationId: string): AdvisorState {
  gcExpired();
  const existing = STATE_STORE.get(conversationId);
  if (existing) {
    existing.updated_at = Date.now();
    return existing;
  }
  const state: AdvisorState = {
    conversation_id:       conversationId,
    advisor_active:        false,
    answered_order:        [],
    questions_asked_count: 0,
    branch_context:        {},
    recommendation_stage:  "none",
    created_at:            Date.now(),
    updated_at:            Date.now(),
  };
  STATE_STORE.set(conversationId, state);
  return state;
}

export function persistState(state: AdvisorState): void {
  state.updated_at = Date.now();
  STATE_STORE.set(state.conversation_id, state);
}

export function clearState(conversationId: string): void {
  STATE_STORE.delete(conversationId);
}

/** Test-only helper · exposes the store for assertions. Do not use in prod paths. */
export function _debugAllStates(): Map<string, AdvisorState> {
  return STATE_STORE;
}
