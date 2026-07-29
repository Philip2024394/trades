// src/lib/nex/brains/_explainability.ts
//
// Explainability envelope helpers · ADR-0037.
//
// The Living Brain Principle demands that every answer served by any
// Brain surface (chat · ask · retrieve) carry a complete
// BrainAnswerEnvelope: answer · evidence · trade_rule · reason ·
// confidence · brain_slug · brain_version · brain_version_id ·
// answered_at · answer_kind.
//
// This file provides:
//   · A Zod schema for runtime validation of the envelope shape
//   · Helpers to build well-formed envelopes from a partial payload
//   · Query-hash utility (sha256 · normalised) for dedup + trend
//   · Evidence normaliser + validator
//   · A logger that writes each answer to hammerex_nex_brain_answers
//     with the raw envelope preserved · Phase 2 outcome tracking joins
//     against this row via brain_answer_id.

import { z } from "zod";
import { createHash } from "node:crypto";
import type {
  BrainAnswerEnvelope,
  BrainAnswerRow,
  BrainEvidence,
  BrainAnswerKind,
} from "./_living_types";
import { insertBrainAnswer, brainSupabaseAvailable } from "./_supabase";

// ---------- Zod schema ----------

export const BrainEvidenceSchema = z.object({
  kind: z.enum(["brain_module", "url", "regulation", "material_spec"]),
  ref:  z.string().min(1),
  excerpt: z.string().optional(),
});

export const BrainAnswerEnvelopeSchema = z.object({
  answer:           z.string().min(1),
  evidence:         z.array(BrainEvidenceSchema).default([]),
  trade_rule:       z.string().nullable(),
  reason:           z.string().min(1),
  confidence:       z.number().min(0).max(1),
  brain_slug:       z.string().min(1),
  brain_version:    z.string().min(1),
  brain_version_id: z.string().uuid(),
  answered_at:      z.string().datetime(),
  answer_kind:      z.enum(["verified", "derived", "unknown", "out_of_scope"]),
});

// ---------- Builders ----------

/**
 * Build a well-formed BrainAnswerEnvelope from a partial payload.
 * Fills defaults (answered_at, evidence=[]) and derives answer_kind
 * from confidence + content when not explicit.
 */
export function buildBrainAnswerEnvelope(input: {
  answer:           string;
  reason:           string;
  brain_slug:       string;
  brain_version:    string;
  brain_version_id: string;
  confidence:       number;
  evidence?:        BrainEvidence[];
  trade_rule?:      string | null;
  answer_kind?:     BrainAnswerKind;
  answered_at?:     string;
}): BrainAnswerEnvelope {
  const kind: BrainAnswerKind =
    input.answer_kind ??
    (input.confidence < 0.4 ? "unknown"
      : input.confidence < 0.85 ? "derived"
      : "verified");
  const envelope: BrainAnswerEnvelope = {
    answer:           input.answer,
    evidence:         input.evidence ?? [],
    trade_rule:       input.trade_rule ?? null,
    reason:           input.reason,
    confidence:       clampConfidence(input.confidence),
    brain_slug:       input.brain_slug,
    brain_version:    input.brain_version,
    brain_version_id: input.brain_version_id,
    answered_at:      input.answered_at ?? new Date().toISOString(),
    answer_kind:      kind,
  };
  // Runtime validation — throws if the caller violates the contract.
  BrainAnswerEnvelopeSchema.parse(envelope);
  return envelope;
}

/**
 * Envelope for "I don't know" / declined-answer cases. Confidence 0 ·
 * evidence empty · answer_kind unknown. Still gets logged so the
 * author feedback queue picks it up.
 */
export function buildUnknownAnswer(input: {
  reason:           string;
  brain_slug:       string;
  brain_version:    string;
  brain_version_id: string;
  suggested_next?:  string;
}): BrainAnswerEnvelope {
  return buildBrainAnswerEnvelope({
    answer:           input.suggested_next ?? "I do not have verified knowledge to answer this yet.",
    reason:           input.reason,
    brain_slug:       input.brain_slug,
    brain_version:    input.brain_version,
    brain_version_id: input.brain_version_id,
    confidence:       0,
    evidence:         [],
    trade_rule:       null,
    answer_kind:      "unknown",
  });
}

// ---------- Utilities ----------

export function clampConfidence(c: number): number {
  if (!Number.isFinite(c)) return 0;
  if (c < 0) return 0;
  if (c > 1) return 1;
  return Number(c.toFixed(4));
}

/**
 * Hash of a normalised query — trim · collapse whitespace · lowercase.
 * Used for dedup + trend detection across the answer log.
 */
export function hashQuery(text: string): string {
  const normalised = text.trim().replace(/\s+/g, " ").toLowerCase();
  return createHash("sha256").update(normalised).digest("hex");
}

/** Hash a user identifier so raw PII is never stored. */
export function hashUserIdentifier(id: string | null | undefined): string | null {
  if (!id) return null;
  return createHash("sha256").update(id).digest("hex");
}

/**
 * Validate + normalise an evidence array (called by builders and by
 * writer helpers that accept external evidence lists).
 */
export function normaliseEvidence(list: unknown): BrainEvidence[] {
  if (!Array.isArray(list)) return [];
  const out: BrainEvidence[] = [];
  for (const item of list) {
    const parsed = BrainEvidenceSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

// ---------- Logging ----------

/**
 * Persists a served answer to hammerex_nex_brain_answers. Non-blocking
 * from the caller's perspective — errors are swallowed and logged so a
 * transient Supabase issue never breaks the user-facing response path.
 * The row is joinable to future outcome data via brain_answer_id.
 */
export async function logBrainAnswer(input: {
  envelope:           BrainAnswerEnvelope;
  query_text:         string;
  answered_by_channel?: "api" | "chat" | "web" | "mobile" | "admin_preview";
  user_id?:           string | null;
  session_id?:        string | null;
  metadata?:          Record<string, unknown>;
}): Promise<string | null> {
  if (!brainSupabaseAvailable()) return null;
  const row: Omit<BrainAnswerRow, "id"> = {
    ...input.envelope,
    query_text:          input.query_text,
    query_hash:          hashQuery(input.query_text),
    answered_by_channel: input.answered_by_channel ?? "api",
    user_id_hash:        hashUserIdentifier(input.user_id ?? null),
    session_hash:        hashUserIdentifier(input.session_id ?? null),
    metadata:            input.metadata ?? {},
  };
  try {
    return await insertBrainAnswer(row);
  } catch (err) {
    console.error("[nex/brains/logBrainAnswer] insert failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Convenience: build the envelope AND log it in one call, returning
 * both the envelope (for the API response) and the answer_id (for
 * downstream outcome recording).
 */
export async function serveAndLogAnswer(input: Parameters<typeof buildBrainAnswerEnvelope>[0] & {
  query_text:         string;
  answered_by_channel?: "api" | "chat" | "web" | "mobile" | "admin_preview";
  user_id?:           string | null;
  session_id?:        string | null;
  metadata?:          Record<string, unknown>;
}): Promise<{ envelope: BrainAnswerEnvelope; answer_id: string | null }> {
  const { query_text, answered_by_channel, user_id, session_id, metadata, ...rest } = input;
  const envelope = buildBrainAnswerEnvelope(rest);
  const answer_id = await logBrainAnswer({
    envelope,
    query_text,
    answered_by_channel,
    user_id,
    session_id,
    metadata,
  });
  return { envelope, answer_id };
}
