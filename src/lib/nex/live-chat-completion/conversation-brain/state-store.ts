// src/lib/nex/live-chat-completion/conversation-brain/state-store.ts
//
// Founder BEGIN Phase 3.1 · Conversation State Store.
//
// Durable per-conversation slots. Read at the START of every turn, written
// at the END. Backed by nex.conversation_state + nex.result_set. Small
// in-process cache so hot conversations don't hit Postgres twice per turn.
//
// Zero LLM. Zero fabrication.

import type { Pool } from "pg";
import type { Domain } from "../contract";

export type Goal = "NONE" | "search" | "refine" | "compare" | "decide";

export interface DialogueTurn {
  role: "user" | "nex";
  text: string;
  intent?: string | null;
  entity_ref?: string | null;
  at: string; // ISO
}

export interface ConversationState {
  conversation_id: string;
  active_domain: Domain | null;
  active_goal: Goal;
  active_entity_ref: string | null;
  candidate_entity_refs: string[];
  current_result_set_id: string | null;
  resolved_facts: Record<string, { entity_ref: string | null; verified: boolean; value?: unknown }>;
  user_constraints: Record<string, unknown>;
  previous_intents: string[];
  dialogue_turns: DialogueTurn[];
  first_seen_at: string;
  updated_at: string;
}

export interface ResultSet {
  result_set_id: string;
  conversation_id: string;
  domain: Domain;
  intent_slug: string;
  city: string | null;
  category: string | null;
  entity_refs: string[];
  render_summary: string | null;
  created_at: string;
}

export interface ConversationStateStore {
  /** Read the state row, returning an empty-shape row if it doesn't exist. */
  load(conversation_id: string): Promise<ConversationState>;
  /** Write the whole state row (UPSERT). */
  save(state: ConversationState): Promise<void>;
  /** Register a new result_set + return its id. */
  registerResultSet(input: Omit<ResultSet, "result_set_id" | "created_at">): Promise<ResultSet>;
  /** Fetch a result_set by id. */
  loadResultSet(result_set_id: string): Promise<ResultSet | null>;
  /** Append a dialogue turn, keeping the store bounded (last N). */
  appendTurn(state: ConversationState, turn: DialogueTurn, cap?: number): ConversationState;
}

const DEFAULT_DIALOGUE_CAP = 20;

function emptyState(conversation_id: string): ConversationState {
  const now = new Date().toISOString();
  return {
    conversation_id,
    active_domain: null,
    active_goal: "NONE",
    active_entity_ref: null,
    candidate_entity_refs: [],
    current_result_set_id: null,
    resolved_facts: {},
    user_constraints: {},
    previous_intents: [],
    dialogue_turns: [],
    first_seen_at: now,
    updated_at: now,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Hot cache keyed by conversation_id. Short TTL because Postgres is the
// source of truth. Cache exists ONLY so the same request doesn't hit
// Postgres twice within one turn (once at turn-start, once implicitly).
// ═══════════════════════════════════════════════════════════════════

const _cache = new Map<string, { at: number; state: ConversationState }>();
const HOT_CACHE_TTL_MS = 30_000;
const HOT_CACHE_MAX = 512;

function cachePut(state: ConversationState): void {
  if (_cache.size >= HOT_CACHE_MAX) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, v] of _cache.entries()) if (v.at < oldestAt) { oldestAt = v.at; oldestKey = k; }
    if (oldestKey) _cache.delete(oldestKey);
  }
  _cache.set(state.conversation_id, { at: Date.now(), state });
}

function cacheGet(conversation_id: string): ConversationState | null {
  const hit = _cache.get(conversation_id);
  if (!hit) return null;
  if (Date.now() - hit.at > HOT_CACHE_TTL_MS) { _cache.delete(conversation_id); return null; }
  return hit.state;
}

// ═══════════════════════════════════════════════════════════════════
// Postgres implementation
// ═══════════════════════════════════════════════════════════════════

export function makeConversationStateStore(deps: { kfPool: Pool }): ConversationStateStore {
  const kf = deps.kfPool;

  return {
    async load(conversation_id) {
      const cached = cacheGet(conversation_id);
      if (cached) return cached;
      const res = await kf.query(
        `SELECT conversation_id, active_domain, active_goal, active_entity_ref,
                candidate_entity_refs, current_result_set_id::text AS current_result_set_id,
                resolved_facts, user_constraints, previous_intents, dialogue_turns,
                first_seen_at, updated_at
           FROM nex.conversation_state WHERE conversation_id = $1`,
        [conversation_id],
      );
      if (res.rowCount === 0) {
        const s = emptyState(conversation_id);
        cachePut(s);
        return s;
      }
      const r = res.rows[0];
      const state: ConversationState = {
        conversation_id: String(r.conversation_id),
        active_domain: r.active_domain as Domain | null,
        active_goal: (r.active_goal as Goal) ?? "NONE",
        active_entity_ref: r.active_entity_ref ? String(r.active_entity_ref) : null,
        candidate_entity_refs: Array.isArray(r.candidate_entity_refs) ? r.candidate_entity_refs.map(String) : [],
        current_result_set_id: r.current_result_set_id ? String(r.current_result_set_id) : null,
        resolved_facts: (r.resolved_facts ?? {}) as ConversationState["resolved_facts"],
        user_constraints: (r.user_constraints ?? {}) as Record<string, unknown>,
        previous_intents: Array.isArray(r.previous_intents) ? r.previous_intents.map(String) : [],
        dialogue_turns: Array.isArray(r.dialogue_turns) ? r.dialogue_turns as DialogueTurn[] : [],
        first_seen_at: r.first_seen_at instanceof Date ? r.first_seen_at.toISOString() : String(r.first_seen_at),
        updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      };
      cachePut(state);
      return state;
    },

    async save(state) {
      state.updated_at = new Date().toISOString();
      await kf.query(
        `INSERT INTO nex.conversation_state
           (conversation_id, active_domain, active_goal, active_entity_ref,
            candidate_entity_refs, current_result_set_id,
            resolved_facts, user_constraints, previous_intents, dialogue_turns,
            first_seen_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::uuid, $7::jsonb, $8::jsonb, $9, $10::jsonb, $11, $12)
         ON CONFLICT (conversation_id) DO UPDATE SET
           active_domain = EXCLUDED.active_domain,
           active_goal = EXCLUDED.active_goal,
           active_entity_ref = EXCLUDED.active_entity_ref,
           candidate_entity_refs = EXCLUDED.candidate_entity_refs,
           current_result_set_id = EXCLUDED.current_result_set_id,
           resolved_facts = EXCLUDED.resolved_facts,
           user_constraints = EXCLUDED.user_constraints,
           previous_intents = EXCLUDED.previous_intents,
           dialogue_turns = EXCLUDED.dialogue_turns,
           updated_at = EXCLUDED.updated_at`,
        [
          state.conversation_id, state.active_domain, state.active_goal, state.active_entity_ref,
          state.candidate_entity_refs, state.current_result_set_id,
          JSON.stringify(state.resolved_facts), JSON.stringify(state.user_constraints),
          state.previous_intents, JSON.stringify(state.dialogue_turns),
          state.first_seen_at, state.updated_at,
        ],
      );
      cachePut(state);
    },

    async registerResultSet(input) {
      const res = await kf.query(
        `INSERT INTO nex.result_set (conversation_id, domain, intent_slug, city, category, entity_refs, render_summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING result_set_id::text AS result_set_id, created_at`,
        [input.conversation_id, input.domain, input.intent_slug, input.city, input.category, input.entity_refs, input.render_summary],
      );
      const row = res.rows[0];
      return {
        result_set_id: String(row.result_set_id),
        conversation_id: input.conversation_id,
        domain: input.domain,
        intent_slug: input.intent_slug,
        city: input.city,
        category: input.category,
        entity_refs: input.entity_refs,
        render_summary: input.render_summary,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      };
    },

    async loadResultSet(result_set_id) {
      const res = await kf.query(
        `SELECT result_set_id::text, conversation_id, domain, intent_slug, city, category, entity_refs, render_summary, created_at
           FROM nex.result_set WHERE result_set_id = $1::uuid`,
        [result_set_id],
      );
      if (res.rowCount === 0) return null;
      const r = res.rows[0];
      return {
        result_set_id: String(r.result_set_id),
        conversation_id: String(r.conversation_id),
        domain: r.domain as Domain,
        intent_slug: String(r.intent_slug),
        city: r.city ? String(r.city) : null,
        category: r.category ? String(r.category) : null,
        entity_refs: Array.isArray(r.entity_refs) ? r.entity_refs.map(String) : [],
        render_summary: r.render_summary ? String(r.render_summary) : null,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      };
    },

    appendTurn(state, turn, cap = DEFAULT_DIALOGUE_CAP) {
      const turns = [...state.dialogue_turns, turn];
      const bounded = turns.length > cap ? turns.slice(turns.length - cap) : turns;
      return { ...state, dialogue_turns: bounded };
    },
  };
}
