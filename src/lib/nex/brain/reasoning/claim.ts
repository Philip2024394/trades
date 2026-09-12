// src/lib/nex/brain/reasoning/claim.ts
//
// NEX Wave 7 · Conversational Entity Reasoning
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§18 · §3)
//   Every substantive recommendation/comparison decomposes into
//   discrete claims. Each claim carries EVIDENCE + STATE. The
//   composer drops any claim whose STATE is UNSUPPORTED before the
//   reply is rendered — that is the mechanical guarantee against
//   "Gaotama is cheaper" being emitted when price is UNKNOWN.
//
// STATE ALPHABET
//   SUPPORTED    · KNOWN_YES evidence backs the claim
//   PARTIAL      · UNVERIFIED / STALE / CONFLICTING backs the claim
//   UNSUPPORTED  · UNKNOWN or KNOWN_NO backs the claim · MUST NOT SHIP
//
// STRICT RULE (§16 · §17 · §18)
//   No fabrication path exists here. Claims are pure data · a verifier
//   evaluates them against evidence · unsupported claims are filtered
//   out at the point of rendering. The model never authors a claim
//   directly · it only speaks over claims that have already been
//   verified against the evidence.

import type { AttributeState } from "../entity-attribute-contract";

// ─── Types ──────────────────────────────────────────────────────

/** A single substantive claim about an entity (or between entities).
 *  Composers build these; the verifier evaluates them. */
export type Claim = {
  /** Stable ID for the claim (audit) */
  id: string;
  /** Which entity the claim is about (ref_id from session.entities). */
  subject_ref_id: string;
  /** For comparisons · the other entity being compared. */
  vs_ref_id?: string;
  /** Human-readable claim text · rendered when verified. */
  text: string;
  /** Which attribute keys back the claim. Verifier checks these
   *  against the actual evidence-state map. */
  evidence_keys: readonly string[];
  /** Whether this claim is FACT, INFERENCE, RECOMMENDATION per §3 */
  kind: "FACT" | "INFERENCE" | "RECOMMENDATION";
};

/** Verified claim · carries the STATE that the verifier resolved. */
export type VerifiedClaim = Claim & {
  state: "SUPPORTED" | "PARTIAL" | "UNSUPPORTED";
  reason: string;
};

/** Evidence lookup · maps { entity_ref_id → { attribute_key → state } }
 *  Built by the composer from session.entityCardMemo · viewed-entity
 *  memo · attributes on session.entities. Never fabricated. */
export type EvidenceLookup = ReadonlyMap<string, ReadonlyMap<string, AttributeState>>;

// ─── Verifier ──────────────────────────────────────────────────

/** Determine claim state from evidence. A claim is:
 *  · SUPPORTED   when EVERY evidence key is KNOWN_YES on the subject
 *  · PARTIAL     when at least one is UNVERIFIED / STALE / CONFLICTING
 *                and the rest are KNOWN_YES / UNVERIFIED / STALE
 *  · UNSUPPORTED when ANY evidence key is UNKNOWN or KNOWN_NO
 *
 *  For comparison claims (vs_ref_id present) · both subjects must
 *  meet the same bar · a comparison claim about price that lacks price
 *  on either side is UNSUPPORTED. */
export function verifyClaim(claim: Claim, evidence: EvidenceLookup): VerifiedClaim {
  const subjectStates: AttributeState[] = [];
  const otherStates: AttributeState[] = [];
  const subjectMap = evidence.get(claim.subject_ref_id);
  for (const key of claim.evidence_keys) {
    const state = subjectMap?.get(key) ?? "UNKNOWN";
    subjectStates.push(state);
  }
  if (claim.vs_ref_id) {
    const otherMap = evidence.get(claim.vs_ref_id);
    for (const key of claim.evidence_keys) {
      const state = otherMap?.get(key) ?? "UNKNOWN";
      otherStates.push(state);
    }
  }
  const allStates = [...subjectStates, ...otherStates];
  // UNSUPPORTED if ANY missing
  if (allStates.some((s) => s === "UNKNOWN" || s === "KNOWN_NO")) {
    return { ...claim, state: "UNSUPPORTED", reason: "missing_or_negative_evidence" };
  }
  // SUPPORTED if all KNOWN_YES
  if (allStates.every((s) => s === "KNOWN_YES")) {
    return { ...claim, state: "SUPPORTED", reason: "all_known_yes" };
  }
  // Otherwise PARTIAL
  return { ...claim, state: "PARTIAL", reason: "unverified_stale_or_conflicting" };
}

/** Verify a batch of claims. Preserves order. */
export function verifyClaims(claims: readonly Claim[], evidence: EvidenceLookup): VerifiedClaim[] {
  return claims.map((c) => verifyClaim(c, evidence));
}

/** Filter for shippable claims — drops UNSUPPORTED (§18: "The second
 *  claim must not ship"). Preserves SUPPORTED and PARTIAL · caller
 *  renders PARTIAL with an unverified hedge. */
export function shippableClaims(verified: readonly VerifiedClaim[]): VerifiedClaim[] {
  return verified.filter((c) => c.state !== "UNSUPPORTED");
}

/** For UNKNOWN_REQUEST · list the evidence keys that would matter
 *  but are UNKNOWN across the entities in scope. */
export function listMissingEvidence(
  claims: readonly Claim[],
  evidence: EvidenceLookup,
): Array<{ key: string; refIds: string[] }> {
  const missing = new Map<string, Set<string>>();
  for (const claim of claims) {
    const refs = [claim.subject_ref_id, ...(claim.vs_ref_id ? [claim.vs_ref_id] : [])];
    for (const ref of refs) {
      const map = evidence.get(ref);
      for (const key of claim.evidence_keys) {
        const state = map?.get(key) ?? "UNKNOWN";
        if (state === "UNKNOWN" || state === "KNOWN_NO") {
          if (!missing.has(key)) missing.set(key, new Set());
          missing.get(key)!.add(ref);
        }
      }
    }
  }
  return [...missing.entries()].map(([key, set]) => ({ key, refIds: [...set] }));
}
