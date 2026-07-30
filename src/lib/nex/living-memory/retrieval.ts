// NEX Living Memory Engine · Memory Retrieval (Ship 2b · Philip 2026-07-30)
//
// Philip's Ship 2b rule (retrieval as important as storage):
//
//   "The magic is not 'I remember.'
//    The magic is 'I remembered at exactly the right moment.'"
//
// Retrieval formula (Philip 2026-07-30):
//
//   current conversation meaning
//   + memory recall_when
//   + human impact
//   + confidence
//   + recency
//   + current goal
//   = relevant understanding
//
// NOT simply "find similar words." Timing creates intelligence.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MemoryUserSurface, NexMemoryRow } from "./types";

// ─── Retrieval input / output ────────────────────────────────────────────

export interface RetrieveInput {
  user_surface: MemoryUserSurface;
  user_key: string;
  /** Recent conversation window · used to compute contextual relevance. */
  conversation_window: string;
  /** Optional current goal detected by intent classifier · boosts matching memories. */
  current_goal?: string;
  /** Optional limit · default 5 · never more than 10. */
  top_n?: number;
}

export interface RetrievedMemory {
  memory: NexMemoryRow;
  relevance_score: number;      // 0-100 composite score
  score_breakdown: {
    context_match: number;      // does recall_when match current context?
    human_impact: number;       // life significance weight
    confidence: number;         // certainty weight
    recency: number;            // how recent (decays over time)
    goal_alignment: number;     // matches current_goal if provided
  };
  reason_surfaced: string;      // human-readable why NEX brought this up
}

// ─── Retrieval function ──────────────────────────────────────────────────

const DEFAULT_TOP_N = 5;
const MAX_TOP_N = 10;

/**
 * Retrieve the most contextually relevant memories for a conversation turn.
 *
 * Ship 2b rule: retrieval is as important as storage. Bad retrieval means
 * a great memory database that never surfaces at the right moment — useless.
 *
 * The composite score weights multiple signals · no single factor dominates:
 *   context_match  (40%) — recall_when hint matches current conversation
 *   human_impact   (25%) — life-significant memories surface more readily
 *   confidence     (15%) — surfacing an uncertain memory would break trust
 *   recency        (10%) — recent memories are more likely to be relevant
 *   goal_alignment (10%) — if a current_goal is detected, memories that
 *                          align with it get a boost
 *
 * Weights sum to 100.
 */
export async function retrieveRelevantMemories(
  input: RetrieveInput,
): Promise<RetrievedMemory[]> {
  const supabase = supabaseAdmin;
  const topN = Math.min(input.top_n ?? DEFAULT_TOP_N, MAX_TOP_N);

  // Pull all active (non-superseded · approved-or-silent) memories for the user
  const { data: rows, error } = await supabase
    .from("hammerex_nex_memories")
    .select("*")
    .eq("user_surface", input.user_surface)
    .eq("user_key", input.user_key)
    .is("superseded_by", null)
    .in("consent_status", ["silent_ok", "approved"]) // never surface needs_approval or rejected
    .order("human_impact_score", { ascending: false })
    .limit(50); // ceiling on candidate set to score

  if (error || !rows || rows.length === 0) {
    return [];
  }

  const now = Date.now();
  const context = input.conversation_window.toLowerCase();
  const goal = input.current_goal?.toLowerCase() ?? "";

  const scored: RetrievedMemory[] = (rows as NexMemoryRow[])
    .map((memory) => {
      const context_match = scoreContextMatch(memory.recall_when ?? "", context);
      const human_impact = memory.human_impact_score;
      const confidence = memory.confidence;
      const recency = scoreRecency(memory.created_at, now);
      const goal_alignment = goal ? scoreContextMatch(memory.recall_when ?? "", goal) : 0;

      const composite =
          context_match  * 0.40
        + human_impact   * 0.25
        + confidence     * 0.15
        + recency        * 0.10
        + goal_alignment * 0.10;

      return {
        memory,
        relevance_score: Math.round(composite),
        score_breakdown: {
          context_match: Math.round(context_match),
          human_impact,
          confidence,
          recency: Math.round(recency),
          goal_alignment: Math.round(goal_alignment),
        },
        reason_surfaced: buildReasonSurfaced(memory, context_match, human_impact),
      };
    })
    // Drop memories that don't clear the surface floor (avoids weak retrievals)
    .filter(r => r.relevance_score >= 45)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, topN);

  // Update last_surfaced_at for the memories we're about to use
  if (scored.length > 0) {
    const ids = scored.map(r => r.memory.id);
    const nowIso = new Date().toISOString();
    await supabase
      .from("hammerex_nex_memories")
      .update({ last_surfaced_at: nowIso })
      .in("id", ids);

    // Audit events
    await supabase.from("hammerex_nex_memory_events").insert(
      scored.map(r => ({
        memory_id: r.memory.id,
        event_type: "surfaced" as const,
        triggered_by: "system" as const,
        new_value: { relevance_score: r.relevance_score, reason: r.reason_surfaced },
      })),
    );
  }

  return scored;
}

// ─── Scoring helpers ─────────────────────────────────────────────────────

/**
 * Context match · V1 uses keyword overlap between recall_when hint and
 * conversation window. Future: swap in embedding cosine similarity.
 * Returns 0-100.
 */
function scoreContextMatch(recallWhen: string, context: string): number {
  if (!recallWhen || !context) return 0;

  const hintWords = recallWhen
    .toLowerCase()
    .split(/[^\w']+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  if (hintWords.length === 0) return 0;

  let hits = 0;
  for (const w of hintWords) {
    if (context.includes(w)) hits++;
  }

  // Ratio of hint words present in context, scaled to 0-100
  const ratio = hits / hintWords.length;
  return Math.min(100, Math.round(ratio * 120)); // slight boost so 80% match → 96 not 80
}

/**
 * Recency score · decays from 100 (today) to ~50 (1 year ago) to ~10 (5 years).
 * Log-based decay so old-but-significant memories still surface.
 */
function scoreRecency(createdAt: string, now: number): number {
  const ageDays = Math.max(0, (now - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  // e^(-ageDays / 500) gives ~100 at 0 days, ~50 at 350 days, ~14 at 1000 days
  return Math.round(100 * Math.exp(-ageDays / 500));
}

function buildReasonSurfaced(
  memory: NexMemoryRow,
  contextMatch: number,
  humanImpact: number,
): string {
  if (humanImpact >= 81) return `life-significant memory · ${memory.category}`;
  if (contextMatch >= 70) return `recall context strongly matches current conversation`;
  if (memory.category === "story") return `long-standing story memory`;
  if (memory.category === "aspiration") return `aspiration relevant to current topic`;
  return `contextual memory · ${memory.category}`;
}

// ─── Prompt-injection helper ─────────────────────────────────────────────
//
// Formats retrieved memories for injection into the composer system prompt.
// Returns "" when there's nothing worth surfacing. Follows the composer's
// "person is more important than the record" rule — never dumps raw fields,
// never reveals internal scoring.

export function livingMemoryToText(memories: RetrievedMemory[]): string {
  if (!memories.length) return "";

  const lines: string[] = [
    "LIVING MEMORY — understanding earned over prior conversations (compose FROM these, never RECITE them · current turn always outranks · per Composer 🎯 MEMORY USAGE rule):",
  ];

  for (const r of memories) {
    const m = r.memory;
    const parts = [
      `- [${m.category}] ${m.content}`,
    ];
    if (m.meaning_reason) parts.push(`  meaning: ${m.meaning_reason}`);
    if (m.emotional_context) parts.push(`  feeling: ${m.emotional_context}`);
    if (m.recall_when) parts.push(`  relevant when: ${m.recall_when}`);
    lines.push(parts.join("\n"));
  }

  lines.push("");
  lines.push("(Use these to compose warmth and continuity. Never quote them back to the user. If current turn contradicts, current turn wins.)");
  return lines.join("\n");
}

// Minimal stop-word set for the V1 keyword matcher
const STOP_WORDS = new Set([
  "when", "what", "where", "which", "with", "would", "could", "should",
  "the", "and", "for", "are", "was", "were", "been", "being",
  "this", "that", "these", "those", "have", "has", "had",
  "about", "into", "from", "your", "their", "them", "they",
  "just", "also", "than", "then", "some", "such", "very",
  "most", "more", "less", "many", "much", "there", "here",
  "will", "does", "doing", "done", "made", "makes", "make",
  "surface", "surfaces", "surfacing",
]);
