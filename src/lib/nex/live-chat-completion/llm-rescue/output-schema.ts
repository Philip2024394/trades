// src/lib/nex/live-chat-completion/llm-rescue/output-schema.ts
//
// Founder BEGIN Phase 3.6 · Zod strict-mode validation for LLM output.
//
// Prior to this, providers hand-rolled a permissive parse in-file. The gate
// then filtered claims against evidence. Zod adds a STRICTER boundary:
// non-conforming payloads (wrong types · missing required fields · extra
// unknown fields on strict shapes) are rejected before they ever hit the
// gate. Fabrication guard downstream is unchanged.
//
// Kept in its own module so multiple providers can share the schema.

import { z } from "zod";
import type { LlmRescueOutput } from "./contract";

// ═══════════════════════════════════════════════════════════════════
// Schema
// ═══════════════════════════════════════════════════════════════════

export const LlmClaimSchema = z.object({
  text: z.string().min(1).max(2000),
  source_ref: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const LlmSuggestedGapSchema = z.object({
  intent_slug: z.string().max(200).optional(),
  entity_ref: z.string().max(200).optional(),
  evidence_needed_text: z.string().min(1).max(1000),
});

// Founder Phase 3.7 Safe Actionable Intelligence · action proposal shape.
// Kept permissive at the schema layer · the action registry does its own
// strict Zod validation of args per action_id.
export const LlmProposedActionSchema = z.object({
  action_id: z.string().min(1).max(60),
  args: z.record(z.string(), z.unknown()).optional().default({}),
  rationale: z.string().max(500).optional(),
});

export const LlmRescueOutputSchema = z.object({
  answered: z.boolean(),
  requires_evidence: z.boolean().optional(),
  claims: z.array(LlmClaimSchema).max(20).default([]),
  reply_hint: z.string().max(2000).optional(),
  unverified_reason: z.string().max(500).optional(),
  suggested_gap: LlmSuggestedGapSchema.optional(),
  proposed_action: LlmProposedActionSchema.optional(),
});

// ═══════════════════════════════════════════════════════════════════
// Parse function · returns null on invalid input (never throws)
// ═══════════════════════════════════════════════════════════════════

export interface StrictParseResult {
  ok: boolean;
  output?: LlmRescueOutput;
  errors?: readonly string[];
}

export function parseLlmOutputStrict(raw: string): StrictParseResult {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { ok: false, errors: ["empty_response"] };

  // Strip accidental markdown fences.
  const stripped = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let obj: unknown;
  try { obj = JSON.parse(stripped); }
  catch (e) { return { ok: false, errors: [`json_parse_failed:${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`] }; }

  const result = LlmRescueOutputSchema.safeParse(obj);
  if (!result.success) {
    const errs = result.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "root"}:${i.message}`);
    return { ok: false, errors: errs };
  }
  return { ok: true, output: result.data as LlmRescueOutput };
}
