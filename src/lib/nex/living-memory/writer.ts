// NEX Living Memory Engine · Memory Writer (Ship 2b · Philip 2026-07-30)
//
// Persists MemoryCandidates to hammerex_nex_memories after all extraction
// gates have passed (six-month test · confidence floor · memory humility).
//
// Sets consent_status = "needs_approval" for high-impact candidates so the
// composer can surface the approval prompt on the next natural moment.
//
// Consent-prompt wording (LOCKED · Philip 2026-07-30):
//   "I noticed this may be useful for future conversations.
//    Would you like me to remember it?"

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  MemoryCandidate,
  MemoryUserSurface,
  NexMemoryRow,
  ConsentStatus,
} from "./types";
import { needsConsent, shouldCommit } from "./types";

// ─── Locked consent-prompt wording ───────────────────────────────────────
//
// Do NOT change this without an ADR. The wording was locked 2026-07-30
// specifically because "NEX wants to store this memory" (technical) breaks
// the Soul, and this phrasing (human · respectful · optional) doesn't.
export const CONSENT_PROMPT_WORDING =
  "I noticed this may be useful for future conversations. Would you like me to remember it?";

// ─── Writer input / output ───────────────────────────────────────────────

export interface WriteInput {
  user_surface: MemoryUserSurface;
  user_key: string;
  candidate: MemoryCandidate;
  source_conversation_id?: string;
  source_message_id?: string;
}

export interface WriteResult {
  written: NexMemoryRow | null;
  skipped_reason?: string;
  consent_prompt?: string;
}

/**
 * Write a single memory candidate to hammerex_nex_memories.
 *
 * Applies all gates one final time (defensive · the extractor should have
 * already applied them, but never trust upstream fully):
 *   - shouldCommit() must return true (six-month + confidence + humility)
 *   - consent_status set per needsConsent()
 *
 * When consent is needed, returns the locked consent-prompt wording so the
 * composer can surface it at the next natural moment. Memory row is still
 * written but with consent_status = "needs_approval" and user_visibility =
 * "hidden_supporting" until confirmed.
 */
export async function writeMemory(input: WriteInput): Promise<WriteResult> {
  const { candidate } = input;

  // Final defensive gate
  if (!shouldCommit(candidate)) {
    return {
      written: null,
      skipped_reason: candidate.six_month_test === "watched"
        ? "six_month_test = watched"
        : candidate.confidence < 60
          ? `confidence ${candidate.confidence} below floor 60`
          : `memory humility · risk ${candidate.relationship_risk_score} + confidence ${candidate.confidence} insufficient`,
    };
  }

  const consentRequired = needsConsent(candidate);
  const consentStatus: ConsentStatus = consentRequired ? "needs_approval" : "silent_ok";

  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("hammerex_nex_memories")
    .insert({
      user_surface: input.user_surface,
      user_key: input.user_key,
      category: candidate.category,
      content: candidate.content,
      meaning_reason: candidate.meaning_reason,
      emotional_context: candidate.emotional_context ?? null,
      confidence: candidate.confidence,
      importance: candidate.importance,
      human_impact_score: candidate.human_impact_score,
      source_conversation_id: input.source_conversation_id ?? null,
      source_message_id: input.source_message_id ?? candidate.source_message_id ?? null,
      source_turn_number: candidate.source_turn_number ?? null,
      consent_status: consentStatus,
      user_visibility: consentRequired ? "hidden_supporting" : "visible",
      recall_when: candidate.recall_when,
      review_after: candidate.review_after ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      written: null,
      skipped_reason: `insert failed: ${error?.message ?? "unknown"}`,
    };
  }

  // Audit event
  await supabase.from("hammerex_nex_memory_events").insert({
    memory_id: data.id,
    event_type: consentRequired ? "approval_requested" : "created",
    new_value: data,
    triggered_by: "system",
  });

  return {
    written: data as NexMemoryRow,
    consent_prompt: consentRequired ? CONSENT_PROMPT_WORDING : undefined,
  };
}

/**
 * Write multiple candidates in one pass (typical extractor output).
 * Returns per-candidate results in the same order.
 */
export async function writeMemories(
  user_surface: MemoryUserSurface,
  user_key: string,
  candidates: MemoryCandidate[],
  source_conversation_id?: string,
): Promise<WriteResult[]> {
  const results: WriteResult[] = [];
  for (const candidate of candidates) {
    results.push(await writeMemory({
      user_surface,
      user_key,
      candidate,
      source_conversation_id,
      source_message_id: candidate.source_message_id,
    }));
  }
  return results;
}

/**
 * Confirm a pending-approval memory (called when user says yes to the
 * consent prompt). Flips consent_status → approved, user_visibility →
 * visible, and records the confirmation event.
 */
export async function approveMemory(memoryId: string): Promise<boolean> {
  const supabase = supabaseAdmin;
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("hammerex_nex_memories")
    .update({
      consent_status: "approved",
      user_visibility: "visible",
      confirmed_at: nowIso,
    })
    .eq("id", memoryId);

  if (error) return false;

  await supabase.from("hammerex_nex_memory_events").insert({
    memory_id: memoryId,
    event_type: "approved",
    triggered_by: "user",
  });

  return true;
}

/**
 * Reject a pending-approval memory (user said no to the consent prompt).
 * Sets consent_status = "rejected". The memory row is retained for the
 * audit trail but will never be surfaced to the user again.
 */
export async function rejectMemory(memoryId: string): Promise<boolean> {
  const supabase = supabaseAdmin;

  const { error } = await supabase
    .from("hammerex_nex_memories")
    .update({
      consent_status: "rejected",
      user_visibility: "hidden_supporting",
    })
    .eq("id", memoryId);

  if (error) return false;

  await supabase.from("hammerex_nex_memory_events").insert({
    memory_id: memoryId,
    event_type: "rejected",
    triggered_by: "user",
  });

  return true;
}

/**
 * Fetch pending-approval memories for a user. Composer uses this to decide
 * whether to surface the consent prompt at the next natural moment.
 */
export async function fetchPendingApprovals(
  user_surface: MemoryUserSurface,
  user_key: string,
): Promise<NexMemoryRow[]> {
  const supabase = supabaseAdmin;

  const { data } = await supabase
    .from("hammerex_nex_memories")
    .select("*")
    .eq("user_surface", user_surface)
    .eq("user_key", user_key)
    .eq("consent_status", "needs_approval")
    .is("superseded_by", null)
    .order("human_impact_score", { ascending: false })
    .limit(3); // never more than 3 pending prompts at once

  return (data ?? []) as NexMemoryRow[];
}
