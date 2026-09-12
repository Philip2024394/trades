// src/lib/nex/brain/session.ts
//
// Stage 3.7 · NEX Conversational Brain · per-conversation session
// store (Philip 2026-08-31). In-memory Map keyed by conversation_id,
// with a 1-hour idle TTL and an LRU cap.
//
// This is v1 · deliberately dependency-free. Session state does NOT
// survive server restart and does NOT sync across multiple Node
// processes. When the phone-shell is deployed behind a load balancer
// with multiple workers, this becomes Postgres-backed (schema:
// nex_conv.brain_slots). Until then this covers the dev + single-node
// production case for accommodation memory.
//
// Persistence across Next.js HMR reloads is handled by binding the
// Map to `globalThis` — a common pattern for Next dev servers where
// module state would otherwise reset on every file change.

import type { AccommodationSlots } from "./accommodation-slots";
import type { Goal } from "./goal-tracking";
import type { RecognisedEntity } from "./entities";
import type { ConversationalFrame } from "./conversational-frame";

export type SessionState = {
  conversationId: string;
  createdAt: number;
  updatedAt: number;
  accommodation?: AccommodationSlots;
  /** P0 · Live Conversational Frame (Philip 2026-09-05 · P0 doctrine §4).
   *  A semantic snapshot of "what we are talking about right now":
   *  running_topic, running_subject, active_market, commercial_context,
   *  resolved_references, open_questions. Derived each turn from
   *  existing session state + latest BrainReply. Consumed by the
   *  Response Composition Layer + conversation-aware retrieval so
   *  turn N+1 knows what turn N was about. Never authoritative for
   *  facts — always subordinate to the deterministic Brain state. */
  frame?: ConversationalFrame;
  /** Stage 3.9 Phase 2 · explicit Goal (Goal Tracking capability). */
  goal?: Goal;
  /** Stage 3.14 Phase 7 · rolling entity window (Entity Intelligence).
   *  Last ~30 unique entities the user mentioned or NEX presented ·
   *  consumed by future Reference Resolution / Comparison /
   *  Recommendation. */
  entities?: RecognisedEntity[];
  /** Stage 3.15 Phase 8 · most-recent resolved reference (Reference
   *  Resolution). Set when the user said "the second one" / "book it"
   *  and we mapped it to a specific presented business. Reset by the
   *  next turn's resolution attempt. Bounded serialisable snapshot. */
  currentReference?: {
    resolved: boolean;
    refKind?: "ordinal" | "pronoun";
    offset?: number;
    business?: { canonical: string; raw: string; refId?: string };
    reason?: string;
  };
  /** Stage 3.24 Phase 17 · counter of proactive suggestions volunteered
   *  by Initiative this conversation. Rate-limited to a cap (default 3). */
  initiativeCount?: number;
  /** Stage 3.37 · Action authorization dance · monotonic counter of
   *  turns processed for this session. Used to expire stale proposals. */
  turnCount?: number;
  /** Stage 3.37 · Action authorization dance · pending mutation
   *  proposal awaiting explicit user confirmation. Every mutation-
   *  capable action must live here (status=AWAITING) before it can be
   *  executed. Once executed, status is set to CONSUMED so a replayed
   *  "yes" cannot re-fire the same action. */
  pendingProposal?: import("./action-authorization").PendingProposal;
  /** Stage 3.42 · Conversation Layer (Philip 2026-09-01) · rolling
   *  dialogue turns for the missing conversation-router. Capped at
   *  DIALOGUE_TURN_WINDOW (12) entries. Used by conversation-router
   *  to distinguish context-continuations from cold vague queries. */
  dialogueTurns?: Array<{
    role: "user" | "nex";
    text: string;
    atIso: string;
  }>;
  /** Stage 3.42 · The most recent question NEX asked the user (if
   *  any). Set when NEX's last reply ended with `?` OR was voice-
   *  intent `clarify_ambiguous` / a follow-up prompt. Consumed by
   *  conversation-router to interpret bare-word user replies as
   *  answers to that question (context continuation). */
  lastNexQuestion?: string;
  /** Universal Entity Intelligence · memoized attribute state per card
   *  from the last result-emitting turn. Consumed by the attribute-
   *  query gate so "does the first one have a pool?" can answer
   *  deterministically from evidence. Overwritten on every new result
   *  set. Bounded (≤ 3 entries per policy). */
  entityCardMemo?: import("./entity-result-cards").EntityCardMemo[];
  /** World-Class Result Card Interaction & Entity Detail Slice
   *  (Philip 2026-09-06 · CEREMONIAL AUTHORIZE) · when the user opens
   *  the /nex-app/entity/[refId] detail page for an entity, the client
   *  posts a beacon that populates this field. Consumed by the
   *  attribute-query + reference-resolution gates so a follow-up like
   *  "does it have a pool?" after returning from the detail page
   *  resolves against the ENTITY THE USER WAS JUST VIEWING (rather
   *  than the first ordinal on the memoized card set).
   *
   *  Freshness: `viewedInTurn` marks the session turn when the beacon
   *  fired. Consumers should check that this turn is recent (within a
   *  small window like current turn or current-1) before using it as
   *  an anchor · older viewed entities decay to memo[0] fallback.
   *
   *  Never fabricates · always mirrors a real client navigation. */
  viewedEntity?: import("./universal-discovery/viewed-entity").ViewedEntitySnapshot;
};

export const DIALOGUE_TURN_WINDOW = 12;

/**
 * Stage 3.42 · append a turn to the rolling dialogue window.
 * Pure · returns a new SessionState. Truncates FIFO to keep window.
 */
export function appendDialogueTurn(
  prior: SessionState,
  turn: { role: "user" | "nex"; text: string; atIso?: string },
): SessionState {
  const t = turn.text.trim();
  if (!t) return prior;
  const atIso = turn.atIso ?? new Date().toISOString();
  const existing = prior.dialogueTurns ?? [];
  const next = [...existing, { role: turn.role, text: t, atIso }];
  const trimmed = next.length > DIALOGUE_TURN_WINDOW
    ? next.slice(next.length - DIALOGUE_TURN_WINDOW)
    : next;
  return { ...prior, dialogueTurns: trimmed };
}

const GLOBAL_KEY = "__nexBrainSessions__" as const;
const TTL_MS = 60 * 60 * 1000; // 1 hour idle
const CAP = 1000;              // LRU cap

function bag(): Map<string, SessionState> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!(GLOBAL_KEY in g)) g[GLOBAL_KEY] = new Map<string, SessionState>();
  return g[GLOBAL_KEY] as Map<string, SessionState>;
}

function pruneExpiredAndCap(): void {
  const m = bag();
  const now = Date.now();
  for (const [k, v] of m) {
    if (now - v.updatedAt > TTL_MS) m.delete(k);
  }
  if (m.size > CAP) {
    const sorted = [...m.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    const drop = m.size - CAP;
    for (let i = 0; i < drop; i++) m.delete(sorted[i][0]);
  }
}

export function getSession(id: string | undefined): SessionState | null {
  if (!id) return null;
  pruneExpiredAndCap();
  const m = bag();
  const s = m.get(id);
  if (!s) return null;
  if (Date.now() - s.updatedAt > TTL_MS) { m.delete(id); return null; }
  return s;
}

export function upsertSession(next: SessionState): void {
  next.updatedAt = Date.now();
  bag().set(next.conversationId, next);
  pruneExpiredAndCap();
}

export function clearSession(id: string): void {
  bag().delete(id);
}

export function _resetSessionsForTests(): void {
  bag().clear();
}

export function sessionCountForTests(): number {
  return bag().size;
}

/**
 * Stage 3.41.h · Compute whether a vertical switch is happening this
 * turn. Returns true when there was a prior active/resumed goal AND
 * the newly-created goal has a different kind. Pure · no side effects.
 */
export function isVerticalSwitch(
  priorGoalKind: string | undefined,
  newGoalKind: string | undefined,
): boolean {
  if (!priorGoalKind || !newGoalKind) return false;
  return priorGoalKind !== newGoalKind;
}

/**
 * Stage 3.41.h · Apply the vertical-switch cleanup discipline.
 *
 * When the user's vertical changes (food → commerce · commerce →
 * accommodation · etc.), the reference from the prior vertical MUST
 * NOT leak into the new one. This helper:
 *
 *   · clears session.currentReference (fail-closed · no guessed pick
 *     in the new vertical)
 *   · drops business_name entities from the prior conversation from
 *     the entity window (so `resolveReference` can't accidentally
 *     match against a stale food entity while we're in commerce)
 *   · preserves everything else on the session (turnCount, goal,
 *     pendingProposal, non-business_name entities like dates, etc.)
 *
 * The caller merges in the new vertical's just-captured entities
 * AFTER this reset · so the resulting window has only fresh entries.
 * Pure · returns a NEW SessionState · never mutates in place.
 */
export function applyVerticalSwitchReset(prior: SessionState): SessionState {
  const filteredEntities = (prior.entities ?? []).filter((e) => e.kind !== "business_name");
  return {
    ...prior,
    entities: filteredEntities,
    currentReference: undefined,
  };
}

/**
 * Stage 3.41.k landing #1 · Apply the abandonment reset discipline.
 *
 * When the user explicitly walks away from the current vertical
 * ("forget dinner" · "lupakan" · "gak jadi" · "cancel that"), the
 * sticky-vertical + currentReference MUST NOT survive into the same
 * turn's routing · otherwise vertical keywords like "dinner" would
 * still trigger food discovery.
 *
 * Compared to `applyVerticalSwitchReset` this helper also flips the
 * active goal to `abandoned` so the next-turn sticky-vertical
 * inheritance sees a non-active goal and skips.
 *
 * Preserves everything else on the session (turnCount, non-business
 * entities, pendingProposal — the confirmation gate handles those).
 * Pure · returns a NEW SessionState · never mutates in place.
 */
export function applyAbandonmentReset(prior: SessionState): SessionState {
  const filteredEntities = (prior.entities ?? []).filter((e) => e.kind !== "business_name");
  const nextGoal = prior.goal
    ? { ...prior.goal, status: "abandoned" as const, updatedAt: Date.now() }
    : undefined;
  return {
    ...prior,
    entities: filteredEntities,
    currentReference: undefined,
    goal: nextGoal,
  };
}
