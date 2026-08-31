// src/lib/nex/brain/learning.ts
//
// Stage 3.13 · Phase 6 · Learning (Philip 2026-08-31).
//
// CONSTITUTIONAL · completes the honesty five (Truth · Reflection ·
// Confidence · Meta-Cognition · Learning). Learning is a rolling
// ledger of signals NEX observes that it should get better from:
//
//   insight_gap_detected     — Insight recorded a learning_gap (price/amenity/etc)
//   slot_correction_observed — user corrected earlier ask ("actually a guesthouse")
//   reflection_failure       — Reflection caught a fabrication / contradiction
//   goal_completed           — user accepted a result (future · Verification)
//   goal_abandoned           — session drifted away from a goal (future)
//
// v1 is IN-MEMORY (globalThis-bound, HMR-safe, rolling window of 200
// entries · same pattern as session store). Meta-Cognition reads the
// most recent entries scoped to the current conversation to answer
// "What did I learn?". Persistence to Postgres / feedback ingestion
// loop lands with the workforce integration phase.
//
// Anti-pattern this replaces: claiming NEX "learns" while the code
// silently forgets every signal. Now every signal is captured, timed,
// scoped, and readable.

export type LearningKind =
  | "insight_gap_detected"
  | "slot_correction_observed"
  | "reflection_failure"
  | "goal_completed"
  | "goal_abandoned"
  | "confidence_low";

export type LearningEntry = {
  id: string;
  kind: LearningKind;
  conversationId?: string;
  atMs: number;
  scope?: string;      // e.g. "accommodation.pricing"
  summary: string;
  detail?: Record<string, unknown>;
};

const GLOBAL_KEY = "__nexBrainLearning__" as const;
const CAP = 200; // rolling window

function bag(): LearningEntry[] {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!(GLOBAL_KEY in g)) g[GLOBAL_KEY] = [] as LearningEntry[];
  return g[GLOBAL_KEY] as LearningEntry[];
}

function nextId(): string {
  return "learn:" + Date.now().toString(36) + ":" + Math.random().toString(36).slice(2, 8);
}

export function recordLearning(entry: Omit<LearningEntry, "id" | "atMs"> & { atMs?: number }): LearningEntry {
  const full: LearningEntry = {
    id: nextId(),
    atMs: entry.atMs ?? Date.now(),
    kind: entry.kind,
    conversationId: entry.conversationId,
    scope: entry.scope,
    summary: entry.summary,
    detail: entry.detail,
  };
  const b = bag();
  b.push(full);
  if (b.length > CAP) b.splice(0, b.length - CAP);
  return full;
}

export function listLearning(): readonly LearningEntry[] {
  return bag();
}

export function recentLearningForConversation(conversationId: string | undefined, limit = 10): LearningEntry[] {
  if (!conversationId) return [];
  return bag().filter((e) => e.conversationId === conversationId).slice(-limit).reverse();
}

export function recentLearningGlobal(limit = 20): LearningEntry[] {
  return bag().slice(-limit).reverse();
}

export function learningSummary(): { total: number; byKind: Record<string, number> } {
  const b = bag();
  const byKind: Record<string, number> = {};
  for (const e of b) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  return { total: b.length, byKind };
}

export function _resetLearningForTests(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  g[GLOBAL_KEY] = [] as LearningEntry[];
}
