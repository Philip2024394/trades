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

export type SessionState = {
  conversationId: string;
  createdAt: number;
  updatedAt: number;
  accommodation?: AccommodationSlots;
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
};

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
