// src/lib/nex-agent/code-engine/capability-evidence-quality.ts
//
// NEX · G4 + G5 + G16 + G17 · Evidence Quality Composite · Phase 4 · 2026-09-21.
// Founder-authorised as part of "Global Web Intelligence".
//
// PURPOSE
//
//   Four related concerns share one underlying axis — "how much of a
//   claim can NEX legitimately make about this evidence?" — and are
//   composed here in one deterministic module:
//
//     G4 · Source quality       — is THIS source appropriate for
//                                 THIS class of question?
//     G5 · Contradiction state  — NO_CONFLICT / MINOR_VARIANCE /
//                                 MATERIAL_CONFLICT / UNRESOLVED
//     G16 · Knowledge gap       — NO_KNOWN_INFORMATION /
//                                 INSUFFICIENT_SOURCE /
//                                 CONFLICTING_EVIDENCE /
//                                 STALE_EVIDENCE /
//                                 UNSUPPORTED_CLASS /
//                                 RETRIEVAL_FAILURE
//     G17 · Answer calibration  — CONFIDENT / QUALIFIED / DISAGREEMENT
//                                 / HONEST_LIMITATION language guidance
//
// ANTI-CHEATING
//
//   · Pure functions of typed inputs. No LLM. No network.
//   · No universal trust score. Source-quality is question-specific
//     (per-class × per-source), consistent with the founder rule
//     "trust must be question-specific and evidence-specific".
//   · Contradiction states are named states, not a numeric
//     "conflict score" that could be silently tweaked.
//   · Knowledge-gap kinds are exhaustive · unknown class returns
//     UNSUPPORTED_CLASS (fail-safe).
//   · Answer-calibration maps evidence quality → response TONE
//     guidance · it does NOT rewrite the reply. The caller composes.

import type { InformationClass } from "./capability-freshness-policy";

// ── G4 · Source-quality (per-source × per-class) ────────────────────

export interface SourceQualityFactors {
  readonly reliability_tier: "authoritative" | "established" | "unknown";
  readonly success_rate: number;   // 0..1 from source-outcome ledger
  readonly total_calls: number;    // ledger count (lower = less evidence)
  readonly recency_bonus: number;  // 0..1 from ledger (fresh outcomes)
  readonly disagreement_rate: number; // 0..1
  readonly class_specific: boolean; // has the source been used for THIS class before?
}

export interface SourceQualityVerdict {
  readonly grade: "excellent" | "good" | "acceptable" | "insufficient";
  readonly score: number; // 0..1 composite
  readonly rationale: string;
}

const RELIABILITY_WEIGHT: Record<SourceQualityFactors["reliability_tier"], number> = {
  authoritative: 1.0,
  established: 0.75,
  unknown: 0.4,
};

export function assessSourceQuality(f: SourceQualityFactors): SourceQualityVerdict {
  // Never a universal trust score. This composite is INSIDE the
  // caller-supplied per-class context — the caller decides whether
  // to consult it. Sources with too little history return
  // "insufficient" so callers know not to over-rely on them.
  if (f.total_calls < 3) {
    return {
      grade: "insufficient",
      score: 0,
      rationale: `insufficient history · only ${f.total_calls} calls · needs ≥3 for a graded verdict`,
    };
  }
  const reliability = RELIABILITY_WEIGHT[f.reliability_tier];
  const classFit = f.class_specific ? 1 : 0.6;
  const composite =
    0.40 * reliability +
    0.20 * f.success_rate +
    0.15 * f.recency_bonus +
    0.15 * (1 - f.disagreement_rate) +
    0.10 * classFit;
  const grade: SourceQualityVerdict["grade"] =
    composite >= 0.85 ? "excellent" :
    composite >= 0.70 ? "good" :
    composite >= 0.50 ? "acceptable" : "insufficient";
  return {
    grade,
    score: Number(composite.toFixed(3)),
    rationale: `reliability=${reliability} · success_rate=${f.success_rate.toFixed(2)} · recency=${f.recency_bonus.toFixed(2)} · (1-disagreement)=${(1 - f.disagreement_rate).toFixed(2)} · class_fit=${classFit}`,
  };
}

// ── G5 · Contradiction state ────────────────────────────────────────

export type ContradictionState =
  | "NO_CONFLICT"
  | "MINOR_VARIANCE"     // small numeric drift or naming variance (acceptable)
  | "MATERIAL_CONFLICT"  // substantive disagreement · surface, don't hide
  | "UNRESOLVED";        // sources disagree AND no rule chose between them

export interface ContradictionInputs {
  readonly sources_agreeing: number;
  readonly sources_disagreeing: number;
  readonly max_variance_metric: number | null; // e.g. km apart for coords · scale-aware caller
  readonly minor_variance_threshold: number | null; // caller supplies threshold
  readonly material_conflict_threshold: number | null;
  readonly name_agreement: "matched" | "diverged" | "unchecked";
}

export function classifyContradiction(i: ContradictionInputs): { state: ContradictionState; rationale: string } {
  if (i.sources_agreeing >= 2 && i.sources_disagreeing === 0 && i.name_agreement !== "diverged") {
    return { state: "NO_CONFLICT", rationale: "≥2 sources agree, no name divergence" };
  }
  if (i.name_agreement === "diverged") {
    return { state: "MATERIAL_CONFLICT", rationale: "entity-label divergence across sources · likely misidentified entity" };
  }
  if (i.max_variance_metric !== null && i.minor_variance_threshold !== null && i.max_variance_metric <= i.minor_variance_threshold) {
    return { state: "MINOR_VARIANCE", rationale: `variance ${i.max_variance_metric} ≤ minor_threshold ${i.minor_variance_threshold}` };
  }
  if (i.max_variance_metric !== null && i.material_conflict_threshold !== null && i.max_variance_metric > i.material_conflict_threshold) {
    return { state: "MATERIAL_CONFLICT", rationale: `variance ${i.max_variance_metric} > material_threshold ${i.material_conflict_threshold}` };
  }
  return { state: "UNRESOLVED", rationale: "sources disagree without a rule that chooses between them" };
}

// ── G16 · Knowledge-gap detection ───────────────────────────────────

export type KnowledgeGapKind =
  | "NO_KNOWN_INFORMATION"
  | "INSUFFICIENT_SOURCE"
  | "CONFLICTING_EVIDENCE"
  | "STALE_EVIDENCE"
  | "UNSUPPORTED_CLASS"
  | "RETRIEVAL_FAILURE"
  | "NO_GAP";

export interface KnowledgeGapInputs {
  readonly info_class: InformationClass | "unknown";
  readonly source_available: boolean;
  readonly retrieval_ok: boolean;
  readonly evidence_present: boolean;
  readonly contradiction: ContradictionState;
  readonly freshness_stale: boolean;
}

export function detectKnowledgeGap(i: KnowledgeGapInputs): { kind: KnowledgeGapKind; rationale: string } {
  if (i.info_class === "unknown") return { kind: "UNSUPPORTED_CLASS", rationale: "information class unregistered" };
  if (!i.source_available) return { kind: "NO_KNOWN_INFORMATION", rationale: "no permitted source for this class" };
  if (!i.retrieval_ok) return { kind: "RETRIEVAL_FAILURE", rationale: "source unavailable · timeout · malformed response" };
  if (!i.evidence_present) return { kind: "INSUFFICIENT_SOURCE", rationale: "retrieval ok but returned no usable evidence" };
  if (i.contradiction === "MATERIAL_CONFLICT" || i.contradiction === "UNRESOLVED") {
    return { kind: "CONFLICTING_EVIDENCE", rationale: `sources conflict · state=${i.contradiction}` };
  }
  if (i.freshness_stale) return { kind: "STALE_EVIDENCE", rationale: "evidence exists but freshness policy says stale" };
  return { kind: "NO_GAP", rationale: "evidence is sufficient · no gap detected" };
}

// ── G17 · Answer calibration guidance ───────────────────────────────

export type AnswerTone =
  | "CONFIDENT"          // strong evidence · direct answer
  | "QUALIFIED"          // partial evidence · qualified answer
  | "DISAGREEMENT"       // conflict · explain the disagreement
  | "HONEST_LIMITATION"; // no or insufficient evidence · say so

export interface AnswerCalibrationInputs {
  readonly evidence_level: "confirmed" | "unconfirmed" | "own_record" | null;
  readonly knowledge_gap: KnowledgeGapKind;
  readonly contradiction: ContradictionState;
}

export function calibrateAnswerTone(i: AnswerCalibrationInputs): { tone: AnswerTone; guidance: string } {
  if (i.knowledge_gap !== "NO_GAP") {
    if (i.knowledge_gap === "CONFLICTING_EVIDENCE") {
      return {
        tone: "DISAGREEMENT",
        guidance: "surface sources separately · explain the disagreement · never merge into one fake answer · never silently pick one",
      };
    }
    return {
      tone: "HONEST_LIMITATION",
      guidance: `state the honest limitation: ${i.knowledge_gap.toLowerCase().replace(/_/g, " ")} · do not fabricate`,
    };
  }
  if (i.contradiction === "MINOR_VARIANCE") {
    return {
      tone: "QUALIFIED",
      guidance: "answer with a qualifier noting the minor variance · do not hide it",
    };
  }
  if (i.evidence_level === "confirmed") {
    return { tone: "CONFIDENT", guidance: "answer directly · cite the source · include retrieval timestamp when live" };
  }
  return {
    tone: "QUALIFIED",
    guidance: `evidence level ${i.evidence_level ?? "null"} · answer with appropriate hedging`,
  };
}

// ── Trace emitters ──────────────────────────────────────────────────

export function emitSourceQualityTrace(source: string, info_class: string, v: SourceQualityVerdict): string {
  return `source_quality · source=${source} · class=${info_class} · grade=${v.grade} · score=${v.score}`;
}
export function emitContradictionTrace(state: ContradictionState, rationale: string): string {
  return `contradiction · state=${state} · ${rationale.slice(0, 120)}`;
}
export function emitKnowledgeGapTrace(kind: KnowledgeGapKind, rationale: string): string {
  return `knowledge_gap · kind=${kind} · ${rationale.slice(0, 120)}`;
}
export function emitAnswerToneTrace(tone: AnswerTone): string {
  return `answer_tone · ${tone}`;
}
