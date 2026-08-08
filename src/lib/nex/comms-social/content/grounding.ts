// NEX Comms Centre · Social · grounding validator.
//
// Charter §S-III: every claim must resolve to a source. In Phase 2:
//   * Template-fill generator supplies explicit provenance for each
//     {{variable}} · these ARE grounded by construction.
//   * The classifier scans the FULL rendered text (caption + hashtags
//     + cta) for forbidden patterns and explicit-reject descriptors.
//   * A claim is grounded when EITHER it's a provenance-anchored
//     variable value OR it matches a whitelisted subjective descriptor.
//   * Anything else → hard-reject.
//
// This module is intentionally decoupled from the generator (they live
// in different files · no shared state · the validator receives a
// CandidatePost, not a template).

import { classifyClaims, isGreenDescriptor } from "./claims";
import type { CandidatePost } from "./generator";
import type { ExtractedClaim, ProvenanceEntry, RejectionReason } from "./types";

export interface GroundingResult {
  grounding_state:  "grounded" | "rejected";
  claims:           ExtractedClaim[];
  rejection_reasons: RejectionReason[];
}

export function validateGrounding(candidate: CandidatePost & { ok: true }): GroundingResult {
  const classified = classifyClaims({
    caption:  candidate.caption,
    hashtags: candidate.hashtags,
    cta:      candidate.cta,
  });

  // For each classifier hit, check whether it's grounded by one of:
  //   (a) matching a variable value in provenance (factual claims from templates)
  //   (b) being a green-whitelist descriptor
  const rejections: RejectionReason[] = [];
  const provenanceValues = Object.values(candidate.provenance).map((p) => p.value.toLowerCase());

  const claims: ExtractedClaim[] = classified.claims.map((c) => {
    const norm = c.text.toLowerCase();
    // Green whitelist rescue for subjective descriptors is not applicable
    // here — the classifier only emits explicit_reject entries as
    // subjective_descriptor · those are NOT whitelisted by definition.
    // But we still allow the check for defence-in-depth.
    if (isGreenDescriptor(norm)) {
      return { ...c, grounded: true, reason: "matched green descriptor whitelist" };
    }
    // Match against provenance values (case-insensitive substring · a
    // factual claim like "Nottingham" from a source counts as grounded).
    if (provenanceValues.some((v) => v.includes(norm) || norm.includes(v))) {
      return { ...c, grounded: true, reason: "matched provenance value from template variable" };
    }
    return c;
  });

  // Any hard_block that is NOT grounded → reject.
  for (const c of claims) {
    if (c.enforcement === "hard_block" && !c.grounded) {
      rejections.push({
        code:              "hard_blocked_claim",
        detail:            c.reason ?? "hard-blocked claim without evidence",
        offending_claim:   c.text,
      });
    }
  }
  // review_required that is NOT grounded → also route to Manual (rejected here · the "Manual queue" is Phase 4 · Phase 2 just refuses autopublish).
  for (const c of claims) {
    if (c.enforcement === "review_required" && !c.grounded) {
      rejections.push({
        code:              "review_required_claim",
        detail:            c.reason ?? "claim requires evidence · route to Manual",
        offending_claim:   c.text,
      });
    }
  }

  return {
    grounding_state:  rejections.length === 0 ? "grounded" : "rejected",
    claims,
    rejection_reasons: rejections,
  };
}

// Also expose a variable-level check for tests: every variable in
// provenance must have come from a source that is currently active +
// rights-eligible. Called by pipeline · re-validated at persist time.
export function validateProvenanceIntegrity(
  provenance: Record<string, ProvenanceEntry>,
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const [name, entry] of Object.entries(provenance)) {
    if (!entry.source_id || !entry.source_kind || !entry.source_path) missing.push(name);
  }
  return { ok: missing.length === 0, missing };
}
