// src/lib/nex/research-brain/synthesis-worker.ts
//
// Founder Path A · Phase A2 · Synthesis Worker.
//
// Composes the CitedReport. Every claim in the report MUST cite ≥1
// EvidenceSpan and pass Fabrication Gate v2 alignment scoring
// (getAlignmentThreshold()). Trust ceiling = evidence_provisional.
//
// Composition-first: deterministic synthesis by default (one claim
// per agreement cluster · representative_text as claim, cluster members
// as citations). A future BEGIN may wire the LLM as an optional
// rephrase step gated by the same alignment threshold.

import type { CitedReport, CitedClaim, EvidenceSpan, CrossCheckResult, ResearchObjective, ResearchPlan } from "./contract";
import { makeReportId } from "./contract";
import { scoreClaimAlignment, getAlignmentThreshold } from "@/lib/nex/live-chat-completion/llm-rescue/alignment";

const MAX_CLAIMS = 8;
const HEADLINE_MAX_CHARS = 220;

export interface SynthesisInput {
  objective: ResearchObjective;
  plan: ResearchPlan;
  spans: readonly EvidenceSpan[];
  cross_check: CrossCheckResult;
  loop_ms_start: number;              // for total latency calc
  stage_ms: CitedReport["stage_ms"];
  provider_meta: Readonly<Record<string, unknown>>;
}

export function synthesiseReport(input: SynthesisInput): CitedReport {
  const t0 = performance.now();
  const threshold = getAlignmentThreshold();
  const claims: CitedClaim[] = [];

  // Group clusters by highest-authority representative first.
  const rankedClusters = [...input.cross_check.agreement_clusters].sort((a, b) => {
    const aAuth = maxAuthority(a.span_ref_ids, input.spans);
    const bAuth = maxAuthority(b.span_ref_ids, input.spans);
    return bAuth - aAuth;
  });

  for (const cluster of rankedClusters) {
    if (claims.length >= MAX_CLAIMS) break;
    const rep = cluster.representative_text.trim();
    if (rep.length < 8) continue;

    // Alignment check: representative text vs each span it cites.
    // Take the max alignment as the claim's alignment score.
    let bestAlign = 0;
    const validCites: string[] = [];
    for (const refId of cluster.span_ref_ids) {
      const span = input.spans.find((s) => s.ref_id === refId);
      if (!span) continue;
      const a = scoreClaimAlignment(rep, span.text).score;
      if (a >= threshold) {
        validCites.push(refId);
        if (a > bestAlign) bestAlign = a;
      }
    }
    if (validCites.length === 0) continue; // no aligned span → drop the claim

    claims.push({
      text: rep,
      cites: validCites,
      alignment_score: Number(bestAlign.toFixed(3)),
      trust: "evidence_provisional",
    });
  }

  // Headline: first claim's text, truncated.
  const answered = claims.length > 0;
  const headline = answered
    ? claims[0].text.slice(0, HEADLINE_MAX_CHARS)
    : "No sufficiently aligned evidence found · honest UNKNOWN";

  const synthesisMs = Math.round(performance.now() - t0);
  const totalMs = Math.round(performance.now() - input.loop_ms_start);

  const stage_ms: CitedReport["stage_ms"] = {
    ...input.stage_ms,
    synthesis: synthesisMs,
  };

  return {
    report_id: makeReportId(input.plan.plan_id),
    objective: input.objective.objective,
    plan_id: input.plan.plan_id,
    answered,
    headline,
    claims,
    spans: input.spans,
    disagreements: input.cross_check.disagreements,
    unverified_reason: answered ? undefined : "no_aligned_evidence_after_cross_check",
    latency_ms: totalMs,
    stage_ms,
    provider_meta: input.provider_meta,
  };
}

function maxAuthority(refIds: readonly string[], spans: readonly EvidenceSpan[]): number {
  let m = 0;
  for (const r of refIds) {
    const s = spans.find((x) => x.ref_id === r);
    if (s && s.authority > m) m = s.authority;
  }
  return m;
}
