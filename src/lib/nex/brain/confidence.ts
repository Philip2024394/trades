// src/lib/nex/brain/confidence.ts
//
// Stage 3.11 · Phase 4 · Confidence (Philip 2026-08-31).
//
// Constitutional layer — pairs with Truth and Reflection. Confidence
// makes NEX honestly say "I know this" vs "I have evidence for this"
// vs "I have incomplete information" vs "I don't know" vs "I can't
// do that". Prevents NEX from becoming super-confident nonsense.
//
// v1 is OBSERVATIONAL. The report is attached to the response for
// audit; the reply is not rewritten. Downstream (Phase 5 · Meta-
// Cognition) will compose Truth + Confidence + Reflection into a
// single self-awareness summary. Later phases can use confidence to
// shape reply hedging ("I found some matches, though details vary").
//
// Confidence is DIFFERENT from the numeric record `confidence` field
// on KnowledgeRecord. The record field is data quality (0..1 per
// record). This module is Brain-level: given the reply we're about to
// send, how well-supported is it?

export type ConfidenceLevel =
  | "high"          // reply is backed by grounded evidence or an honest boundary
  | "medium"        // reply is a coherent next step with partial evidence
  | "low"           // reply lacks supporting evidence
  | "unavailable";  // reply is a legitimate "I don't have this" statement

export type EvidenceKind =
  | "grounded_fact"   // verified data (real property name / count from World)
  | "retrieved"       // World corpus record with provenance
  | "computed"        // derived from real data (filter result count / area)
  | "boundary"        // honest "I don't have this / I can't do this" statement
  | "conversational"; // slot summary / refining question / acknowledgement

export type ClaimAudit = {
  claim: string;         // short excerpt of the claim
  evidence: EvidenceKind;
  source?: string;       // provenance hint (e.g. "OSM · N records")
};

export type ConfidenceReport = {
  overall: ConfidenceLevel;
  reason: string;
  claims: ClaimAudit[];
  /** Count of grounded_fact/retrieved claims — real evidence backing this reply. */
  evidenceCount: number;
  /** Count of boundary claims — honest declines. */
  boundaryCount: number;
};

export type ConfidenceInput = {
  reply: string;
  intent?: string;
  /** How many real property records match the current filters. */
  realPropertiesMatched?: number;
  /** How many real property records were available before filters. */
  realPropertiesAvailable?: number;
  /** True when the reply names real property records by name. */
  namesRealProperties?: boolean;
  /** True when the reply cites an OSM / provenance source. */
  citesProvenance?: boolean;
  /** True when the reply cites a specific area with geographic proximity. */
  citesGeographicArea?: boolean;
  /** True when the reply is an honest boundary (booking/price/amenity/no-match). */
  isHonestBoundary?: boolean;
  /** True when the reply is only a refining question. */
  isRefiningQuestion?: boolean;
  /** True when the reply presents grounded knowledge (World corpus fact). */
  isGroundedKnowledge?: boolean;
};

// ─── Deterministic assessment ─────────────────────────────────────────

export function assessConfidence(input: ConfidenceInput): ConfidenceReport {
  const reply = (input.reply ?? "").trim();
  const claims: ClaimAudit[] = [];

  // Empty reply · low confidence · no claims.
  if (reply.length === 0) {
    return {
      overall: "low",
      reason: "empty reply · no claims to assess",
      claims: [],
      evidenceCount: 0,
      boundaryCount: 0,
    };
  }

  // Real property names/counts · grounded_fact.
  if (input.namesRealProperties) {
    claims.push({
      claim: "real property names surfaced",
      evidence: "grounded_fact",
      source: input.realPropertiesMatched != null
        ? `${input.realPropertiesMatched} real record${input.realPropertiesMatched === 1 ? "" : "s"} matched`
        : undefined,
    });
  }
  // Stage 3.31 · bilingual EN + ID literal detection so ID replies
  // classify correctly. Every pattern below carries an EN clause OR
  // an ID clause · triggering either counts as a positive detection.
  const countMatch = reply.match(/\b(\d+)\s+real listings\b/i)
    || reply.match(/\bhave\s+(\d+)\s+listings\b/i)
    || reply.match(/\b(\d+)\s+listingan asli\b/i)
    || reply.match(/\bpunya\s+(\d+)\s+listingan\b/i);
  if (countMatch) {
    claims.push({
      claim: `count claim: ${countMatch[0]}`,
      evidence: "grounded_fact",
      source: "real property retrieval count",
    });
  }

  // Grounded knowledge (World corpus record with provenance) · retrieved.
  if (input.isGroundedKnowledge || input.citesProvenance || /source: nex indonesia knowledge|sumber: pengetahuan nex indonesia/i.test(reply)) {
    claims.push({
      claim: "grounded knowledge citation",
      evidence: "retrieved",
      source: "NEX Indonesia knowledge corpus",
    });
  }

  // Honest boundary · boundary.
  // Patterns cover: accommodation booking/price/facility (Stage 3.11) ·
  // commerce empty corpus (Stage 3.19: "no listings yet · pipeline
  // is ready" · "no sellers or products") · ID accommodation boundaries
  // (Stage 3.31: booking / harga / fasilitas). Future capability limits
  // extend this pack.
  if (input.isHonestBoundary || /can'?t book|no live booking|don'?t carry (price|facility) data|no.*price data|don'?t have any.*listings|pipeline is ready|no sellers or products|can'?t confidently filter|belum bisa memesan|belum ada koneksi booking|tidak menyimpan data (harga|fasilitas)|belum bisa memfilter|belum ada listingan asli/i.test(reply)) {
    claims.push({
      claim: "honest boundary statement",
      evidence: "boundary",
      source: "capability limit disclosed",
    });
  }

  // Geographic area match · computed.
  if (input.citesGeographicArea || /\b(near|dekat) (malioboro|prawirotaman|kraton|kotagede|tugu|gondomanan)\b/i.test(reply)) {
    claims.push({
      claim: "area proximity claim",
      evidence: "computed",
      source: "haversine ≤1.5 km from known area centroid",
    });
  }

  // Slot summary / refining question · conversational (not an evidence claim).
  if (input.isRefiningQuestion || /\b(do you want|want me to|which city|any particular|budget, mid-range|mau saya|kamu mau|kota atau area|lingkungan khusus)\b/i.test(reply)) {
    claims.push({
      claim: "next-step refining question",
      evidence: "conversational",
    });
  }

  // "Got it — X." / "Baik — X." acknowledgement · conversational.
  if (/^(got it|baik) — /i.test(reply) || /coming back to|kembali ke/i.test(reply)) {
    claims.push({
      claim: "acknowledgement / resume lead",
      evidence: "conversational",
    });
  }

  const evidenceCount = claims.filter((c) => c.evidence === "grounded_fact" || c.evidence === "retrieved" || c.evidence === "computed").length;
  const boundaryCount = claims.filter((c) => c.evidence === "boundary").length;

  // Overall level:
  //   · Any grounded evidence OR retrieved knowledge → high
  //   · Honest boundary (with or without evidence) → high (honestly-uncertain is
  //     still high confidence in the honesty of the statement itself)
  //   · Just a refining question / acknowledgement · no evidence · no boundary → medium
  //     (nothing to be wrong about, but nothing new was claimed)
  //   · Falls through when reply has NO recognisable claim type → low
  let overall: ConfidenceLevel;
  let reason: string;
  if (evidenceCount > 0) {
    overall = "high";
    reason = `reply carries ${evidenceCount} grounded/retrieved/computed claim${evidenceCount === 1 ? "" : "s"}`;
  } else if (boundaryCount > 0) {
    overall = "unavailable";
    reason = "reply is an honest boundary · capability not available";
  } else if (claims.length > 0) {
    overall = "medium";
    reason = "reply is a coherent conversational step · no new factual claims";
  } else {
    overall = "low";
    reason = "reply has no recognisable claims";
  }

  return { overall, reason, claims, evidenceCount, boundaryCount };
}
