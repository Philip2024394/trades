// src/lib/nex/l4-bakeoff/known-answer-registry-v1.ts
//
// V.5.4.5 · IMMUTABLE FOUNDER-AUTHORED KNOWN-ANSWER REFERENCE REGISTRY · v1
// Founder BEGIN V.5.4.5 · 2026-09-08
//
// EXTENDS V.5.4.4 KnownAnswerReference with:
//   · authoritative_source     — cited URL or document reference
//   · authority_tier           — TIER_1 (government / peer-reviewed / official standard)
//                                TIER_2 (established secondary source with authoritative primary)
//                                TIER_3 (widely-cited but requires additional verification)
//   · claim                    — the specific factual assertion the reference validates
//   · expected_answer_summary  — canonical short answer for human review + audit
//   · founder_review_status    — "draft_pending_review" | "founder_approved" | "founder_rejected"
//   · content_hash             — SHA-24 of the reference · immutability check
//   · authored_by              — must be a specific identifier (never anonymous)
//
// DISCIPLINE:
//   · Registry is CODE-DEFINED · not runtime-mutable · Founder review = code review
//   · Every reference starts as "draft_pending_review"
//   · Only "founder_approved" references are consumed by the scorer (V.5.4.5 gate)
//   · Immutable via Object.freeze + integrity verification on read
//   · Content hash frozen at authorship · never re-computed to disguise a change
//   · V4 corpus is NOT modified · references are external metadata keyed by case_id

import { createHash } from "node:crypto";

// ═══════════════════════════════════════════════════════════════════
// § A · TYPES (V.5.4.5 extension of V.5.4.4 KnownAnswerReference)
// ═══════════════════════════════════════════════════════════════════

export type AuthorityTier = "TIER_1" | "TIER_2" | "TIER_3";

export type FounderReviewStatus =
  | "draft_pending_review"     // authored · awaiting Founder inspection · scorer SKIPS
  | "founder_approved"         // Founder has reviewed + approved · scorer USES
  | "founder_rejected";        // Founder reviewed + rejected · scorer SKIPS · reason recorded

export type KnownAnswerMatchKind = "exact" | "substring" | "regex" | "any_of_substrings";

export type KnownAnswerReferenceV1 = {
  case_id: string;
  match_kind: KnownAnswerMatchKind;
  reference: string | readonly string[];
  claim: string;                              // NEW · the specific factual assertion
  expected_answer_summary: string;            // NEW · canonical short answer for audit
  authoritative_source: string;               // NEW · URL / document / statute reference
  authority_tier: AuthorityTier;              // NEW · TIER_1 highest
  founder_review_status: FounderReviewStatus; // NEW · defaults draft_pending_review
  founder_review_reason?: string;             // optional · required when status !== "draft_pending_review"
  jurisdiction_notes?: string;
  authored_by: string;
  authored_at_iso: string;
  content_hash: string;                       // NEW · SHA-24 · immutability check
};

// ═══════════════════════════════════════════════════════════════════
// § B · CONTENT HASH (SHA-24 · deterministic per reference)
// ═══════════════════════════════════════════════════════════════════

/** Canonical hash input · everything EXCEPT content_hash itself. Sorted keys ·
 *  stable JSON. Never include content_hash in the hash input (would fixed-point). */
function canonicalHashInput(ref: Omit<KnownAnswerReferenceV1, "content_hash">): string {
  const keys = Object.keys(ref).sort();
  const obj: Record<string, unknown> = {};
  for (const k of keys) obj[k] = (ref as unknown as Record<string, unknown>)[k];
  return JSON.stringify(obj);
}

export function computeReferenceHash(ref: Omit<KnownAnswerReferenceV1, "content_hash">): string {
  return createHash("sha256").update(canonicalHashInput(ref), "utf8").digest("hex").slice(0, 24);
}

export function verifyReferenceIntegrity(ref: KnownAnswerReferenceV1): { ok: boolean; reason?: string } {
  const recomputed = computeReferenceHash({ ...ref, content_hash: undefined } as unknown as Omit<KnownAnswerReferenceV1, "content_hash">);
  if (recomputed !== ref.content_hash) {
    return { ok: false, reason: `hash_mismatch: expected=${ref.content_hash} actual=${recomputed}` };
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
// § C · AUTHORING HELPER (freezes + hashes at author time)
// ═══════════════════════════════════════════════════════════════════

/** Author a reference · computes content_hash + freezes · deterministic. */
function author(input: Omit<KnownAnswerReferenceV1, "content_hash">): KnownAnswerReferenceV1 {
  const hash = computeReferenceHash(input);
  return Object.freeze({ ...input, content_hash: hash });
}

// ═══════════════════════════════════════════════════════════════════
// § D · IMMUTABLE REFERENCE REGISTRY V1 (Founder review required per entry)
// ═══════════════════════════════════════════════════════════════════
//
// Each reference below is DRAFT-authored by Claude citing authoritative sources.
// All start as "draft_pending_review". Founder edits this file to change status
// to "founder_approved" (or "founder_rejected" with a reason). Scorer respects
// the status field · only "founder_approved" references produce classifications.
//
// Adding a reference to this registry does NOT modify V4 corpus. References are
// external metadata keyed by case_id.

export const KNOWN_ANSWER_REGISTRY_V1_5: readonly KnownAnswerReferenceV1[] = Object.freeze([
  // ─── f2_factuality_easy_verifiable ───────────────────────────────
  // Prompt: "How many provinces does Indonesia have as of 2024?"
  // Answer: 38 (after 2022 New Guinea splits · 4 new provinces from Papua/West Papua)
  // Source: BPS (Statistics Indonesia) + Kemendagri (Ministry of Home Affairs)
  author({
    case_id: "f2_factuality_easy_verifiable",
    match_kind: "any_of_substrings",
    reference: ["38", "thirty-eight"],
    claim: "Indonesia has 38 provinces as of 2024",
    expected_answer_summary: "38 provinces (following the 2022 New Guinea provincial splits creating 4 new provinces from the former Papua and West Papua provinces · plus DKI Jakarta special region)",
    authoritative_source: "BPS (Badan Pusat Statistik / Statistics Indonesia) + Kemendagri (Ministry of Home Affairs Regulation UU 14/2022 · UU 15/2022 · UU 16/2022 · UU 29/2022 splitting Papua)",
    authority_tier: "TIER_1",
    founder_review_status: "draft_pending_review",
    jurisdiction_notes: "Indonesia · valid as of late 2022 through 2024",
    authored_by: "nex-master-ai-v5.4.5-draft",
    authored_at_iso: "2026-09-08T00:00:00Z",
  }),

  // ─── f4_UK_time_zone_facts ───────────────────────────────────────
  // Prompt: "Is the UK on GMT or BST in early January?"
  // Answer: GMT (BST runs late March to late October · early January is definitively GMT)
  // Source: gov.uk clock changes · Interpretation Act 1978
  author({
    case_id: "f4_UK_time_zone_facts",
    match_kind: "substring",
    reference: "GMT",
    claim: "The UK is on GMT (Greenwich Mean Time) in early January · BST (British Summer Time) runs from the last Sunday of March to the last Sunday of October",
    expected_answer_summary: "GMT · Greenwich Mean Time · early January falls outside the BST period (last Sunday March → last Sunday October)",
    authoritative_source: "gov.uk clock changes (https://www.gov.uk/when-do-the-clocks-change) · Interpretation Act 1978 s.9 · Summer Time Act 1972",
    authority_tier: "TIER_1",
    founder_review_status: "draft_pending_review",
    jurisdiction_notes: "United Kingdom",
    authored_by: "nex-master-ai-v5.4.5-draft",
    authored_at_iso: "2026-09-08T00:00:00Z",
  }),

  // ─── mi1_general_knowledge ───────────────────────────────────────
  // Prompt: "Roughly how far is Manchester from London by train?"
  // Answer: ~200 miles · Avanti West Coast express services ~2 hours 5 min - 2 hours 15 min
  // Source: National Rail Enquiries + Avanti West Coast timetables
  author({
    case_id: "mi1_general_knowledge",
    match_kind: "any_of_substrings",
    reference: ["200", "180", "190", "210", "220", "two hundred", "2 hour", "2h", "two hour"],
    claim: "London to Manchester by train is approximately 200 miles (Euston to Manchester Piccadilly · Avanti West Coast West Coast Main Line) with express journeys around 2 hours 5-15 minutes",
    expected_answer_summary: "~200 miles (183-200 depending on route) · ~2 hours by fastest Avanti West Coast express services",
    authoritative_source: "National Rail Enquiries (https://www.nationalrail.co.uk) · Avanti West Coast timetables · Network Rail West Coast Main Line",
    authority_tier: "TIER_1",
    founder_review_status: "draft_pending_review",
    jurisdiction_notes: "UK · London Euston → Manchester Piccadilly",
    authored_by: "nex-master-ai-v5.4.5-draft",
    authored_at_iso: "2026-09-08T00:00:00Z",
  }),
]);

// ═══════════════════════════════════════════════════════════════════
// § E · LOOKUP HELPERS
// ═══════════════════════════════════════════════════════════════════

export function lookupReferenceV1_5(case_id: string): KnownAnswerReferenceV1 | undefined {
  return KNOWN_ANSWER_REGISTRY_V1_5.find((r) => r.case_id === case_id);
}

/** IDs of references currently APPROVED by Founder (scorer-consumable). */
export function approvedReferenceCaseIds(): ReadonlySet<string> {
  return new Set(
    KNOWN_ANSWER_REGISTRY_V1_5
      .filter((r) => r.founder_review_status === "founder_approved")
      .map((r) => r.case_id),
  );
}

/** IDs of ALL references in the registry regardless of status. Used by
 *  the partitioner to know which case_ids MIGHT be routed to known_answer
 *  once approved. */
export function allRegistryCaseIds(): ReadonlySet<string> {
  return new Set(KNOWN_ANSWER_REGISTRY_V1_5.map((r) => r.case_id));
}

// ═══════════════════════════════════════════════════════════════════
// § F · REGISTRY-LEVEL INTEGRITY (called by scorer at read time)
// ═══════════════════════════════════════════════════════════════════

export function verifyRegistryIntegrity(): { ok: boolean; violations: readonly { case_id: string; reason: string }[] } {
  const violations: { case_id: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const ref of KNOWN_ANSWER_REGISTRY_V1_5) {
    // Uniqueness: case_id may only appear once (Founder can supersede via file edit + hash update)
    if (seen.has(ref.case_id)) {
      violations.push({ case_id: ref.case_id, reason: "duplicate case_id in registry" });
    }
    seen.add(ref.case_id);
    // Integrity
    const check = verifyReferenceIntegrity(ref);
    if (!check.ok) violations.push({ case_id: ref.case_id, reason: check.reason ?? "unknown integrity failure" });
    // Rejected/approved must carry a reason
    if (ref.founder_review_status !== "draft_pending_review" && !ref.founder_review_reason) {
      violations.push({ case_id: ref.case_id, reason: `status=${ref.founder_review_status} requires founder_review_reason` });
    }
    // Object.freeze check
    if (!Object.isFrozen(ref)) {
      violations.push({ case_id: ref.case_id, reason: "reference is not frozen" });
    }
  }
  return { ok: violations.length === 0, violations };
}
