// src/lib/nex-agent/code-engine/brb/capability-brain-similarities-v2.ts
//
// NEX1 · Brain Similarities v2 · schema-invariant structural signatures.
//
// DESIGN RATIONALE (v1 → v2, honestly disclosed as Ledger B iteration)
//
//   v1 used field-name Jaccard as one of six equal-weighted components.
//   Empirical result: field-name Jaccard collapses to 0 across
//   experiences with different schemas even when the underlying
//   structural signature is identical. This causes v1 to fail on
//   genuinely cross-schema evidence — which is exactly the λ frontier.
//
//   v2 removes the schema-dependent components and works only on
//   schema-invariant structural signatures of each experience:
//     · signature: (numeric_zero_present, numeric_nonzero_present,
//                   string_present, string_token_count_bucket,
//                   outcome)
//   Similarity between two experiences = agreement on this signature.
//
// This is still generic: I have NOT encoded the target relationship
// vocabulary anywhere. The signature is a purely structural summary
// of any experience with any schema. Schema-differing but
// signature-agreeing experiences will look similar (which is the
// point of λ); schema-agreeing but signature-differing experiences
// will look different.
//
// If v2 STILL fails to discriminate cleanly on the λ test, that is
// truth · not further target-encoded tuning.

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import type { Experience } from "./capability-brain-similarities";

registerAgent({
  id: "brain_similarities_v2",
  name: "Brain Similarities v2 · schema-invariant signature",
  cognitive_layer: "brain_recovery_specialist",
  description: "Alternative to v1. Computes a fixed 5-dimension schema-invariant signature per experience (presence bits + outcome). Similarity = agreement fraction. Anti-cheating: signature is generic and applies to any experience.",
});

export interface ExperienceSignature {
  readonly experience_id: string;
  readonly has_numeric_zero: boolean;
  readonly has_numeric_nonzero: boolean;
  readonly has_string: boolean;
  readonly string_token_bucket: "none" | "few" | "many";  // 0 | 1–3 | 4+
  readonly outcome: "success" | "failure" | "unknown";
}

export interface PairwiseSignatureSimilarity {
  readonly a_id: string;
  readonly b_id: string;
  readonly agreement_fraction: number;   // 0..1 · how many of 5 dims agree
  readonly matching_dimensions: readonly string[];
  readonly non_matching_dimensions: readonly string[];
}

export interface SimilaritiesV2Result {
  readonly signatures: readonly ExperienceSignature[];
  readonly pairwise: readonly PairwiseSignatureSimilarity[];
  readonly evidence_kind: "OBSERVED";
  readonly r11b_marker: "SIMILARITIES_V2_STRUCTURAL_SIGNATURE_ONLY";
}

// ── Signature computation ─────────────────────────────────────────────

function signatureOf(e: Experience): ExperienceSignature {
  let zeros = 0, nonzeros = 0, strings = 0, tokens = 0;
  for (const v of Object.values(e.facts)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      if (v === 0) zeros++; else nonzeros++;
    } else if (typeof v === "string") {
      strings++;
      // Rough token count · same tokeniser as v1
      tokens += v.toLowerCase().split(/[\s._\-\/@:]+/).filter((t) => t.length > 0).length;
    }
  }
  const bucket: ExperienceSignature["string_token_bucket"] = tokens === 0 ? "none" : tokens <= 3 ? "few" : "many";
  return {
    experience_id: e.id,
    has_numeric_zero: zeros > 0,
    has_numeric_nonzero: nonzeros > 0,
    has_string: strings > 0,
    string_token_bucket: bucket,
    outcome: e.outcome,
  };
}

function agree(a: ExperienceSignature, b: ExperienceSignature): { fraction: number; matching: string[]; non_matching: string[] } {
  const dims: [string, unknown, unknown][] = [
    ["has_numeric_zero", a.has_numeric_zero, b.has_numeric_zero],
    ["has_numeric_nonzero", a.has_numeric_nonzero, b.has_numeric_nonzero],
    ["has_string", a.has_string, b.has_string],
    ["string_token_bucket", a.string_token_bucket, b.string_token_bucket],
    ["outcome", a.outcome, b.outcome],
  ];
  const matching: string[] = [];
  const non_matching: string[] = [];
  for (const [name, va, vb] of dims) {
    if (va === vb) matching.push(name); else non_matching.push(name);
  }
  return { fraction: matching.length / dims.length, matching, non_matching };
}

// ── Public API ────────────────────────────────────────────────────────

export function computeSignatureSimilarities(experiences: readonly Experience[]): SimilaritiesV2Result {
  const signatures = experiences.map(signatureOf);
  const pairs: PairwiseSignatureSimilarity[] = [];
  for (let i = 0; i < signatures.length; i++) {
    for (let j = i + 1; j < signatures.length; j++) {
      const g = agree(signatures[i], signatures[j]);
      pairs.push({
        a_id: signatures[i].experience_id,
        b_id: signatures[j].experience_id,
        agreement_fraction: g.fraction,
        matching_dimensions: g.matching,
        non_matching_dimensions: g.non_matching,
      });
    }
  }
  recordHeartbeat({
    agent_id: "brain_similarities_v2",
    event_type: "compute",
    event_data: { n: experiences.length, pairs: pairs.length },
  });
  return {
    signatures,
    pairwise: pairs,
    evidence_kind: "OBSERVED",
    r11b_marker: "SIMILARITIES_V2_STRUCTURAL_SIGNATURE_ONLY",
  };
}

export const BRAIN_SIMILARITIES_V2_VERSION = "brain-similarities.v2";
