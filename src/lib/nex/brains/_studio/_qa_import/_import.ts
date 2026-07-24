// Q&A → candidate builder · deterministic · no LLM.
//
// Turns each parsed QAPair into an ExtractionCandidate with a fully
// populated craft.fact payload. Each candidate lands as `pending`
// (Author still clicks Accept, or bulk-Accepts). Provenance is
// explicit: llm_model="direct_import" so audit distinguishes.

import "server-only";
import { createHash } from "node:crypto";
import type { ExtractionCandidate, ExtractionRun } from "../_extraction/types";
import { saveRun } from "../_extraction/_queue";
import { parseQA } from "./_parser";

export const DIRECT_IMPORT_MODEL   = "direct_import";
export const DIRECT_IMPORT_PROMPT_VERSION = "qa_import.v1.2026-07-23";

export type ImportResult =
  | { ok: true; run: ExtractionRun; skipped: string[] }
  | { ok: false; reason: "empty_input" | "no_pairs_found" | "input_too_long"; detail: string };

const MAX_INPUT_CHARS = 200_000;   // 400x LLM cap · we're not paying per char here

export type QAImportInput = {
  brain_slug:  string;
  author_id:   string;
  author_name: string;
  raw_input:   string;
};

export async function importQaKnowledge(input: QAImportInput): Promise<ImportResult> {
  const raw = input.raw_input.trim();
  if (raw === "") return { ok: false, reason: "empty_input", detail: "Q&A input is empty." };
  if (raw.length > MAX_INPUT_CHARS) {
    return { ok: false, reason: "input_too_long", detail: `Input is ${raw.length} chars (max ${MAX_INPUT_CHARS}). Split into smaller batches.` };
  }

  const { pairs, skipped } = parseQA(raw);
  if (pairs.length === 0) {
    return {
      ok: false,
      reason: "no_pairs_found",
      detail: `No Q&A pairs detected. Expected format: 'Q: <question>' on one line then 'A: <answer>' on the next. Skipped hints: ${skipped.join(" · ") || "none"}`
    };
  }

  const now       = new Date().toISOString();
  const inputHash = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  const runId     = `qaimp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const authorNote = `Author's own experience · imported ${now.slice(0, 10)}`;

  const candidates: ExtractionCandidate[] = pairs.map((qa, i) => {
    const payload = {
      id:            `qa.fact.${runId.slice(-6)}.${i}`,
      statement:     qa.answer,
      evidence:      [{ source: `${input.author_name} · own experience`, note: qa.question }],
      confidence:    "medium" as const,
      classification: "expert_observation" as const
    };
    return {
      id:                  `${runId}_c${i}`,
      brain_slug:          input.brain_slug,
      kind:                "craft.fact",
      payload,
      source_span:         `Q: ${qa.question}\nA: ${qa.answer}`,
      needs_author_source: false,
      provenance: {
        llm_model:      DIRECT_IMPORT_MODEL,
        proposed_at:    now,
        prompt_version: DIRECT_IMPORT_PROMPT_VERSION,
        input_hash:     inputHash
      },
      status:         "pending" as const,
      admin_status:   "unreviewed" as const,
      review_history: []
    };
  });

  const run: ExtractionRun = {
    run_id:       runId,
    brain_slug:   input.brain_slug,
    author_id:    input.author_id,
    input_hash:   inputHash,
    input_length: raw.length,
    llm_model:    DIRECT_IMPORT_MODEL,
    created_at:   now,
    candidates
  };

  await saveRun(run);
  return { ok: true, run, skipped };
}
