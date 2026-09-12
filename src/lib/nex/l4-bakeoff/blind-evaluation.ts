// src/lib/nex/l4-bakeoff/blind-evaluation.ts
//
// V.5.2 · L4 bakeoff · blind evaluation (anonymized outputs)
// Founder BEGIN V.5.2 · 2026-09-08
//
// Discipline (Founder Section 9):
//   · Model identity hidden from human evaluators
//   · Anonymized IDs shuffled per case (system_A, system_B, ...)
//   · Sealed candidate_id · only unblindable AFTER judgment recorded
//   · Avoids brand bias

import { createHash, randomBytes } from "node:crypto";
import type { AnonymizedOutput, BlindMapping } from "./types";

/** Deterministic hash for sealing a candidate_id + case_id pair.
 *  Reversible ONLY when paired with the mapping ledger. */
function sealCandidate(candidate_id: string, case_id: string, salt: string): string {
  return createHash("sha256").update(`${candidate_id}|${case_id}|${salt}`, "utf8").digest("hex").slice(0, 32);
}

/** Fisher-Yates shuffle · seeded (for reproducibility) or unseeded. */
function shuffle<T>(arr: T[], seedBytes?: Buffer): T[] {
  const out = [...arr];
  const rand = seedBytes
    ? (() => {
        let idx = 0;
        return () => {
          const b = seedBytes[idx % seedBytes.length];
          idx += 1;
          return b / 256;
        };
      })()
    : Math.random;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Build a blind-evaluation batch: one case · N candidates · shuffled
 *  presentation order · sealed candidate ids.
 *
 *  Returns:
 *    · outputs: what the human evaluator sees (anonymized)
 *    · mapping: kept sealed until judgment is recorded */
export function buildBlindBatch(input: {
  session_id: string;
  case_id: string;
  responses: readonly { candidate_id: string; response_text: string }[];
  seed?: Buffer;
}): { outputs: AnonymizedOutput[]; mappings: BlindMapping[] } {
  const shuffled = shuffle(input.responses.map((r) => ({ ...r })), input.seed);
  const salt = randomBytes(16).toString("hex");

  const outputs: AnonymizedOutput[] = [];
  const mappings: BlindMapping[] = [];

  for (let i = 0; i < shuffled.length; i++) {
    const anonId = `system_${String.fromCharCode(65 + i)}`;   // system_A, system_B, ...
    const r = shuffled[i];
    const sealed = sealCandidate(r.candidate_id, input.case_id, salt);
    outputs.push({
      anon_id: anonId,
      case_id: input.case_id,
      response_text: r.response_text,
      sealed_candidate_id: sealed,
    });
    mappings.push({
      session_id: input.session_id,
      case_id: input.case_id,
      anon_id: anonId,
      real_candidate_id: r.candidate_id,
      judgment_recorded_at_iso: null,
    });
  }

  return { outputs, mappings };
}

/** Record that a judgment has been recorded for a particular anon_id ·
 *  ONLY after this can the mapping be safely queried by the reporter. */
export function markJudgmentRecorded(mapping: BlindMapping, now_iso?: string): BlindMapping {
  return { ...mapping, judgment_recorded_at_iso: now_iso ?? new Date().toISOString() };
}

/** Refuse unblinding until judgment recorded · returns null if premature. */
export function safeUnblind(mapping: BlindMapping): { real_candidate_id: string } | null {
  if (!mapping.judgment_recorded_at_iso) return null;
  return { real_candidate_id: mapping.real_candidate_id };
}
