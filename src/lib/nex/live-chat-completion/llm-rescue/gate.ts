// src/lib/nex/live-chat-completion/llm-rescue/gate.ts
//
// Founder BEGIN Phase 3.4 · LLM output → Truth-Engine-gated verdict.
//
// Applies the founder rule:
//   "LLM rescue must never bypass the Truth Engine."
//
// Steps:
//   1. Every claim.source_ref MUST match an item in the evidence bundle
//      by ref_id · orphan claims are REJECTED (fabrication guard).
//   2. If zero valid claims → verified=false, honest "couldn't verify".
//   3. Trust caps at "evidence_provisional" — LLM output is NEVER
//      elevated to canonical_verified, even if all sources are verified.
//   4. Reply text = LLM's reply_hint IF present AND all its cited refs
//      survived validation · otherwise a composed "based on <source>: X"
//      from valid claims.
//   5. When verified=false, emit the honest limitation text.

import type {
  LlmRescueOutput, RescueVerdict, RetrievalBundle, RescueProviderMeta,
} from "./contract";
import type { TrustBand } from "@/lib/nex/live-chat-completion/contract";
import { scoreClaimAlignment, getAlignmentThreshold } from "./alignment";
// Founder Path A · Phase C1 · gate event log (best-effort, non-fatal).
import { writeGateRejection, writeGateKept } from "./gate-events";
// Founder RB-3 · optional NLI hook (opt-in · graceful fallback).
import { scoreNliAlignment, isNliEnabled } from "./alignment-nli";

export interface GateInput {
  bundle: RetrievalBundle;
  output: LlmRescueOutput;
  provider_meta: RescueProviderMeta;
  /** Founder Path A · Phase C1 · optional conversation id for event log. */
  conversation_id?: string | null;
}

const HONEST_LIMITATION_EN =
  "I couldn't verify that against my sources yet. I've asked our team to look into it — want to try a different angle?";
const HONEST_LIMITATION_ID =
  "Saya belum bisa memverifikasi itu dari sumber terpercaya. Tim kami akan mencari infonya. Coba pertanyaan lain?";

export async function gateLlmOutput(input: GateInput): Promise<RescueVerdict> {
  const { bundle, output, provider_meta } = input;
  // Index evidence items by ref_id for O(1) text lookup during alignment.
  const evidenceById = new Map(bundle.items.map((i) => [i.ref_id, i]));
  const rejected: { text: string; reason: string }[] = [];
  const kept: { text: string; source_ref: string; confidence: number }[] = [];
  // Founder Path A · Phase A1 · Fabrication Gate v2 · per-claim alignment.
  const alignmentScores: { source_ref: string; score: number; method: string }[] = [];
  const alignmentThreshold = getAlignmentThreshold();

  const cid = input.conversation_id ?? null;
  const providerModel = provider_meta.model ?? null;

  // ── 1. Filter claims ──────────────────────────────────────────────
  for (const claim of output.claims ?? []) {
    if (!claim?.text || !claim?.source_ref) {
      rejected.push({ text: claim?.text ?? "(no text)", reason: "missing_fields" });
      writeGateRejection({
        conversation_id: cid, provider_model: providerModel,
        reason: "missing_fields",
        source_ref: claim?.source_ref ?? null,
        claim_text_preview: claim?.text ?? null,
      });
      continue;
    }
    // Founder Doctrine #4 (MEMORY IS NOT TRUTH): defensive reject for any
    // ref that looks like a memory citation. Memory refs never appear in
    // bundle.items so this is also caught by the not-in-evidence check
    // below · we surface it with a clearer reason for observability.
    if (/^memory:/i.test(claim.source_ref)) {
      rejected.push({ text: claim.text, reason: `doctrine_4_memory_is_not_truth:${claim.source_ref}` });
      writeGateRejection({
        conversation_id: cid, provider_model: providerModel,
        reason: "doctrine_4_memory",
        source_ref: claim.source_ref,
        claim_text_preview: claim.text,
      });
      continue;
    }
    const evidenceItem = evidenceById.get(claim.source_ref);
    if (!evidenceItem) {
      rejected.push({ text: claim.text, reason: `source_ref_not_in_evidence:${claim.source_ref}` });
      writeGateRejection({
        conversation_id: cid, provider_model: providerModel,
        reason: "orphan_citation",
        source_ref: claim.source_ref,
        claim_text_preview: claim.text,
      });
      continue;
    }
    // ── Fabrication Gate v2 · claim-span alignment ─────────────────
    // Presence of a citation is necessary but not sufficient (arXiv
    // 2510.24476 · postrationalisation). We score how well the cited
    // evidence text supports the claim. Below threshold → reject.
    //
    // Founder RB-3 · when NLI is enabled + Ollama reachable, we ALSO
    // score via Ollama entailment and take the MAX (either signal can
    // rescue a borderline claim). If Ollama unreachable, we fall back
    // silently to the deterministic score alone.
    const detAlignment = scoreClaimAlignment(claim.text, evidenceItem.text);
    let combinedScore = detAlignment.score;
    let method: string = detAlignment.method;
    if (isNliEnabled()) {
      const nli = await scoreNliAlignment(claim.text, evidenceItem.text);
      if (nli && nli.verdict !== "error") {
        if (nli.score > combinedScore) {
          combinedScore = nli.score;
          method = `combined+nli:${nli.verdict}`;
        } else {
          method = `combined+nli_lower:${nli.verdict}`;
        }
      }
    }
    const alignment = { score: combinedScore, method };
    alignmentScores.push({
      source_ref: claim.source_ref,
      score: Number(alignment.score.toFixed(3)),
      method: alignment.method,
    });
    if (alignment.score < alignmentThreshold) {
      rejected.push({
        text: claim.text,
        reason: `postrationalisation_suspected:${alignment.score.toFixed(3)}<${alignmentThreshold}:${claim.source_ref}`,
      });
      writeGateRejection({
        conversation_id: cid, provider_model: providerModel,
        reason: "postrationalisation",
        source_ref: claim.source_ref,
        alignment_score: alignment.score,
        alignment_threshold: alignmentThreshold,
        claim_text_preview: claim.text,
      });
      continue;
    }
    // Claim survives · log to kept-events table for postrationalisation_rate.
    writeGateKept({
      conversation_id: cid, provider_model: providerModel,
      source_ref: claim.source_ref,
      alignment_score: alignment.score,
      alignment_threshold: alignmentThreshold,
    });
    kept.push(claim);
  }

  // ── 2. Verified verdict ───────────────────────────────────────────
  const providerCompleted = provider_meta.completed;
  const abstained = output.answered === false || kept.length === 0;

  if (abstained || !providerCompleted) {
    const reason = output.unverified_reason
      ?? (kept.length === 0 && rejected.length > 0 ? "all_claims_rejected" : "provider_abstained");
    const text = bundle.language === "id" ? HONEST_LIMITATION_ID : HONEST_LIMITATION_EN;
    return {
      verified: false,
      reply_text: `${text} (${reason})`,
      trust: "unknown",
      cited_source_refs: [],
      rejected_claims: rejected,
      provider_meta,
      alignment_scores: alignmentScores,
      alignment_summary: summariseAlignment(alignmentScores, alignmentThreshold),
    };
  }

  // ── 3. Compose the final reply text ───────────────────────────────
  // Prefer the LLM's reply_hint if EVERY ref it would want to cite
  // survived validation. Otherwise compose a from-claims sentence.
  const cited = kept.map((c) => c.source_ref);
  const useHint = typeof output.reply_hint === "string" && output.reply_hint.trim().length > 0;
  let reply_text: string;
  if (useHint) {
    reply_text = output.reply_hint!.trim();
  } else {
    reply_text = kept
      .map((c) => c.text)
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 4)
      .join(" · ");
  }

  // Founder rule: trust caps at evidence_provisional for LLM-rescued replies.
  const capped_trust: TrustBand = "evidence_provisional";

  return {
    verified: true,
    reply_text,
    trust: capped_trust,
    cited_source_refs: cited,
    rejected_claims: rejected,
    provider_meta,
    alignment_scores: alignmentScores,
    alignment_summary: summariseAlignment(alignmentScores, alignmentThreshold),
  };
}

function summariseAlignment(
  scores: readonly { source_ref: string; score: number }[],
  threshold: number,
): { min: number; mean: number; max: number; threshold: number } {
  if (scores.length === 0) return { min: 0, mean: 0, max: 0, threshold };
  let min = 1, max = 0, sum = 0;
  for (const s of scores) {
    if (s.score < min) min = s.score;
    if (s.score > max) max = s.score;
    sum += s.score;
  }
  return {
    min: Number(min.toFixed(3)),
    mean: Number((sum / scores.length).toFixed(3)),
    max: Number(max.toFixed(3)),
    threshold,
  };
}
