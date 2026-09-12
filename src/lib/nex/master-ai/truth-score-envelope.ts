// src/lib/nex/master-ai/truth-score-envelope.ts
//
// Founder 2026-09-10 · World-class NEX supervisor · per-request truth score.
//
// Every chat envelope gets a `truth_score` block that gives the user a
// deterministic, transparent read on how much to trust this reply:
//
//   {
//     overall: 0.0..1.0,
//     band: "verified" | "high" | "moderate" | "low" | "unknown",
//     components: { ... },
//     policy: "NEX never blocks information · signal truth, don't suppress"
//   }
//
// CORE INVARIANT (Founder rule): this system NEVER blocks a reply.
// It surfaces trust as a first-class metric so users decide.
// Even trust=0.1 replies ship — with a clear "low confidence" band.
// Only Fabrication Gate v2 + Doctrine gates can suppress content —
// this scorer is purely additive UX.
//
// The score is a deterministic combination of already-existing signals:
//   1. reflection.overallPass (constitutional checks: 5 gates)
//   2. confidence.overall (LLM's own self-assessment)
//   3. deterministic_reply_promotion.accepted (was reply promoted?)
//   4. cited_sources trust_band mix (canonical_verified > provisional > unknown)
//   5. cross_domain_meta.answered (cross-domain fired + succeeded?)
//   6. reply_kind not "unknown" · not empty
//
// Nothing new is retrieved. This is pure aggregation over what the
// pipeline already computes. Cost: sub-ms.

export type TruthBand = "verified" | "high" | "moderate" | "low" | "unknown";

export interface TruthScoreComponents {
  reflection_pass:              number; // 0 or 1
  confidence_self_report:       number; // 0.0..1.0
  deterministic_reply_accepted: number; // 0 or 1
  citation_trust_ratio:         number; // 0.0..1.0 (canonical / total)
  cross_domain_answered:        number; // 0 or 1
  reply_shape_healthy:          number; // 0 or 1 (non-empty, kind != unknown)
}

export interface TruthScore {
  overall:    number;
  band:       TruthBand;
  components: TruthScoreComponents;
  policy:     string;
  computed_at_iso: string;
  version:    "1.0";
}

const POLICY_LINE =
  "NEX never blocks information · trust is signalled, not suppressed · only Fabrication Gate v2 can reject content";

// Weights sum to 1.0. Tuned so a fully-verified deterministic answer
// scores ~0.95 (canonical) and a bare LLM guess scores ~0.35.
const WEIGHTS = Object.freeze({
  reflection_pass:              0.20,
  confidence_self_report:       0.15,
  deterministic_reply_accepted: 0.25,
  citation_trust_ratio:         0.20,
  cross_domain_answered:        0.05,
  reply_shape_healthy:          0.15,
});

interface CitedSourceLike {
  trust_band?: string;
}

interface ReplyEnvelopeLike {
  reply?: string;
  cited_sources?: CitedSourceLike[];
  reflection?: { overallPass?: boolean; passedCount?: number; totalChecks?: number };
  confidence?: { overall?: "very_high" | "high" | "medium" | "low" | "very_low" | string };
  _debug_timings?: {
    lcc_adapter_reply?: { reply_kind?: string };
    deterministic_reply_promotion?: { accepted?: boolean };
    cross_domain_meta?: { fired?: boolean; answered?: boolean };
  };
  intent?: string;
  composition_meta?: { accepted?: boolean; reason?: string };
}

function selfReportToNumber(v: unknown): number {
  const s = String(v ?? "").toLowerCase();
  if (s === "very_high" || s === "veryhigh") return 1.0;
  if (s === "high")     return 0.85;
  if (s === "medium" || s === "moderate") return 0.6;
  if (s === "low")      return 0.3;
  if (s === "very_low" || s === "verylow") return 0.15;
  return 0.5; // unknown → middle
}

function citationTrustRatio(sources: readonly CitedSourceLike[] | undefined): number {
  if (!sources || sources.length === 0) return 0.0;
  let total = 0;
  for (const s of sources) {
    const b = String(s.trust_band ?? "").toLowerCase();
    if (b === "canonical_verified")   total += 1.00;
    else if (b === "evidence_verified") total += 0.85;
    else if (b === "canonical_unverified") total += 0.70;
    else if (b === "evidence_provisional") total += 0.55;
    else if (b === "clarify" || b === "mixed") total += 0.35;
    else                                total += 0.20;
  }
  return total / sources.length;
}

function bandFromScore(score: number): TruthBand {
  if (score >= 0.85) return "verified";
  if (score >= 0.70) return "high";
  if (score >= 0.50) return "moderate";
  if (score >= 0.30) return "low";
  return "unknown";
}

/**
 * Compute a per-request truth score from the chat envelope's existing
 * signals. Never blocks — always returns a score, even for empty replies.
 */
export function computeTruthScore(env: ReplyEnvelopeLike): TruthScore {
  const reflectionPass = env.reflection?.overallPass === true ? 1 : 0;
  const confSelf = selfReportToNumber(env.confidence?.overall);
  const detAccepted = env._debug_timings?.deterministic_reply_promotion?.accepted === true ? 1 : 0;
  const citTrust = citationTrustRatio(env.cited_sources);
  const crossFired = env._debug_timings?.cross_domain_meta?.fired === true;
  const crossAns   = env._debug_timings?.cross_domain_meta?.answered === true;
  const crossScore = !crossFired ? 0.5 : (crossAns ? 1 : 0); // don't penalise when not fired
  const replyText = String(env.reply ?? "");
  const replyKind = env._debug_timings?.lcc_adapter_reply?.reply_kind ?? "";
  const shapeHealthy = replyText.trim().length > 0 && replyKind !== "unknown" ? 1 : 0;

  const components: TruthScoreComponents = {
    reflection_pass:              reflectionPass,
    confidence_self_report:       confSelf,
    deterministic_reply_accepted: detAccepted,
    citation_trust_ratio:         citTrust,
    cross_domain_answered:        crossScore,
    reply_shape_healthy:          shapeHealthy,
  };

  const overall = clamp01(
    components.reflection_pass              * WEIGHTS.reflection_pass +
    components.confidence_self_report       * WEIGHTS.confidence_self_report +
    components.deterministic_reply_accepted * WEIGHTS.deterministic_reply_accepted +
    components.citation_trust_ratio         * WEIGHTS.citation_trust_ratio +
    components.cross_domain_answered        * WEIGHTS.cross_domain_answered +
    components.reply_shape_healthy          * WEIGHTS.reply_shape_healthy
  );

  return {
    overall: Number(overall.toFixed(3)),
    band:    bandFromScore(overall),
    components,
    policy:  POLICY_LINE,
    computed_at_iso: new Date().toISOString(),
    version: "1.0",
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
