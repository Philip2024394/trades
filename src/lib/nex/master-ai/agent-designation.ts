// src/lib/nex/master-ai/agent-designation.ts
//
// NEX AGENT DESIGNATION SYSTEM · canonical types
// Founder-authorised 2026-09-16 · IMMUTABLE governance rules
//
// A NEX designation is an OFFICIAL IDENTITY, NOT a capability rating.
// Number-first, capability-earned-separately per founder rule:
//   Identity → evidence → capability → maturity
//
// The number tells us WHAT this agent IS.
// The intelligence_status (from intelligence-status.ts) tells us what it HAS PROVEN.
// The two axes are STRICTLY INDEPENDENT.
//
// Governance rules (founder-locked):
//   1. NEX1 (the code brain) may PROPOSE designations for discovered agents.
//   2. Only the founder may APPROVE a proposal to OFFICIAL status.
//   3. UNKNOWN agents stay UNKNOWN — no automatic number assignment.
//   4. An OFFICIAL designation cannot be revoked without a new founder directive.
//   5. Once a NEX number is claimed by ANY status (PROPOSED / OFFICIAL /
//      REJECTED / DEFERRED), it MUST NOT be re-proposed for a different agent.
//
// This file is a PROTECTED LAYER — see safety-doctrine.ts.

/**
 * Designation lifecycle states.
 *
 *   UNASSIGNED    · No designation and no proposal. Default.
 *   DISCOVERED    · NEX1 found the agent but has not yet proposed a number.
 *   PROPOSED      · NEX1 has proposed a number + purpose. Awaits founder decision.
 *   OFFICIAL      · Founder approved. Number is reserved permanently.
 *   REJECTED      · Founder decided this agent does not deserve its own NEX number.
 *                   The proposed number is NOT reusable (audit-trail integrity).
 *   DEFERRED      · Founder deferred decision. Proposed number stays reserved.
 */
export type Nex1DesignationStatus =
  | "UNASSIGNED"
  | "DISCOVERED"
  | "PROPOSED"
  | "OFFICIAL"
  | "REJECTED"
  | "DEFERRED";

/**
 * NEX designation number. Format: `NEX-\d{2,}` (zero-padded, two-digit minimum).
 * Examples: `NEX-01`, `NEX-02`, `NEX-42`, `NEX-99`. Grows to `NEX-100`+ if ever needed.
 *
 * The founding designation NEX-01 is the code brain historically known as "NEX1".
 * The historical alias `NEX1` is preserved for readability but the canonical
 * form for all machine records is `NEX-01`.
 */
export type Nex1DesignationNumber = string; // validated by isValidDesignationNumber

const DESIGNATION_NUMBER_REGEX = /^NEX-\d{2,}$/;

export function isValidDesignationNumber(s: string): boolean {
  return DESIGNATION_NUMBER_REGEX.test(s);
}

/**
 * A relationship between two NEX-designated agents. Captures organisational
 * structure without implying capability.
 */
export type Nex1DesignationRelationshipKind =
  | "supervises"    // NEX-01 supervises NEX-02 (authority-only)
  | "reports_to"    // inverse of supervises
  | "peer"          // co-equal
  | "extends"       // NEX-N extends NEX-M's capabilities without inheriting authority
  | "depends_on";   // NEX-N requires NEX-M to function

export interface Nex1DesignationRelationship {
  readonly to_designation: string;                     // e.g. "NEX-01"
  readonly relationship_kind: Nex1DesignationRelationshipKind;
}

/**
 * A NEX agent's designation record. Kept append-only in practice (see
 * agent-registry.ts JSONL pattern) — corrections happen via a new record
 * that supersedes a prior one.
 */
export interface Nex1AgentDesignation {
  /** Internal codebase identifier (matches MasterAgentId · agent-registry.ts). */
  readonly agent_id: string;

  /** Current lifecycle state. */
  readonly status: Nex1DesignationStatus;

  /**
   * The proposed NEX number (e.g. `NEX-02`). REQUIRED for PROPOSED / OFFICIAL /
   * REJECTED / DEFERRED. Absent for UNASSIGNED / DISCOVERED.
   */
  readonly proposed_number: Nex1DesignationNumber | null;

  /**
   * The OFFICIAL NEX number. Non-null ONLY when status=OFFICIAL. Must equal
   * proposed_number when set. Once assigned, permanently reserved.
   */
  readonly official_number: Nex1DesignationNumber | null;

  /** One-sentence purpose statement from NEX1's inspection or founder authorship. */
  readonly proposed_purpose: string;

  /** Who authored the proposal. NEX1 = automated discovery; founder = manual authorship. */
  readonly proposed_by: "nex1" | "founder";

  /** ISO timestamp when the proposal record was created. */
  readonly proposed_at_iso: string;

  /** Founder is the ONLY entity that can approve. Null until OFFICIAL. */
  readonly approved_by: "founder" | null;

  /** ISO timestamp of founder approval. Null until OFFICIAL. */
  readonly approved_at_iso: string | null;

  /** Reason for REJECTED status. Null in all other states. */
  readonly rejected_reason: string | null;

  /** Relationships to other NEX-designated agents. Empty for solo designations. */
  readonly relationships: readonly Nex1DesignationRelationship[];

  /** Author trace · doctrine invariant. */
  readonly taught_by: "master_ai_engineer";
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate that a designation's fields are internally consistent with its status.
 * Returns null if valid, otherwise a rejection reason.
 *
 * Governance invariants enforced:
 *   UNASSIGNED   · no number, no proposal, no approval, no rejection
 *   DISCOVERED   · no number, no proposal, no approval, no rejection
 *   PROPOSED     · proposed_number required; no official_number; no approval; no rejection
 *   OFFICIAL     · proposed_number required; official_number required and equal;
 *                  approved_by="founder" and approved_at_iso required
 *   REJECTED     · proposed_number required; no official_number; rejected_reason required
 *   DEFERRED     · proposed_number required; no official_number; no approval; no rejection reason
 *
 * If proposed_number is present, it must satisfy isValidDesignationNumber.
 */
export function validateDesignation(d: Nex1AgentDesignation): string | null {
  if (!d.agent_id || d.agent_id.trim().length === 0) return "agent_id required";
  if (!d.proposed_purpose || d.proposed_purpose.trim().length === 0) {
    return "proposed_purpose required";
  }
  if (d.proposed_number !== null && !isValidDesignationNumber(d.proposed_number)) {
    return `invalid proposed_number '${d.proposed_number}' · must match NEX-\\d{2,}`;
  }
  if (d.official_number !== null && !isValidDesignationNumber(d.official_number)) {
    return `invalid official_number '${d.official_number}' · must match NEX-\\d{2,}`;
  }

  switch (d.status) {
    case "UNASSIGNED":
    case "DISCOVERED":
      if (d.proposed_number !== null) return `${d.status} forbids proposed_number`;
      if (d.official_number !== null) return `${d.status} forbids official_number`;
      if (d.approved_by !== null) return `${d.status} forbids approved_by`;
      if (d.rejected_reason !== null) return `${d.status} forbids rejected_reason`;
      break;
    case "PROPOSED":
      if (d.proposed_number === null) return "PROPOSED requires proposed_number";
      if (d.official_number !== null) return "PROPOSED forbids official_number (only OFFICIAL sets it)";
      if (d.approved_by !== null) return "PROPOSED forbids approved_by";
      if (d.approved_at_iso !== null) return "PROPOSED forbids approved_at_iso";
      if (d.rejected_reason !== null) return "PROPOSED forbids rejected_reason";
      break;
    case "OFFICIAL":
      if (d.proposed_number === null) return "OFFICIAL requires proposed_number";
      if (d.official_number === null) return "OFFICIAL requires official_number";
      if (d.official_number !== d.proposed_number) {
        return "OFFICIAL requires official_number === proposed_number (no number-substitution)";
      }
      if (d.approved_by !== "founder") return "OFFICIAL requires approved_by='founder'";
      if (d.approved_at_iso === null || d.approved_at_iso.trim().length === 0) {
        return "OFFICIAL requires approved_at_iso";
      }
      if (d.rejected_reason !== null) return "OFFICIAL forbids rejected_reason";
      break;
    case "REJECTED":
      if (d.proposed_number === null) return "REJECTED requires proposed_number (audit trail)";
      if (d.official_number !== null) return "REJECTED forbids official_number";
      if (d.rejected_reason === null || d.rejected_reason.trim().length === 0) {
        return "REJECTED requires rejected_reason";
      }
      if (d.approved_by !== null) return "REJECTED forbids approved_by";
      break;
    case "DEFERRED":
      if (d.proposed_number === null) return "DEFERRED requires proposed_number (reservation)";
      if (d.official_number !== null) return "DEFERRED forbids official_number";
      if (d.approved_by !== null) return "DEFERRED forbids approved_by";
      if (d.rejected_reason !== null) return "DEFERRED forbids rejected_reason";
      break;
  }

  return null;
}

/**
 * Independence-of-axes guard. A designation's approval or number does NOT
 * imply anything about intelligence status. Any code that upgrades
 * intelligence_status because a designation became OFFICIAL is violating the
 * founder rule "Identity first → evidence → capability → maturity".
 *
 * This function returns true if the given designation status could ONLY be
 * reached via founder approval (i.e. the founder consented to the identity
 * being official). It does NOT return anything about capability.
 */
export function isFounderApprovedIdentity(d: Nex1AgentDesignation): boolean {
  return d.status === "OFFICIAL" && d.approved_by === "founder";
}

// ─── Number registry helpers ─────────────────────────────────────────────────
//
// A pure in-memory helper for enforcing "once a number is claimed by ANY
// status, it cannot be re-proposed for a different agent." Long-term
// persistence lives in a future append-only JSONL registry.

/**
 * Given a set of designations, return the map of designation-number → agent_id
 * that currently claims that number in any non-UNASSIGNED / non-DISCOVERED state.
 */
export function claimedNumbersMap(designations: readonly Nex1AgentDesignation[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const d of designations) {
    if (d.status === "UNASSIGNED" || d.status === "DISCOVERED") continue;
    if (d.proposed_number === null) continue;
    // First claimant wins; if two records claim the same number, that is a governance error.
    if (!map.has(d.proposed_number)) map.set(d.proposed_number, d.agent_id);
  }
  return map;
}

/**
 * Validate that a proposed designation does not conflict with an existing claim.
 * Returns null if OK, otherwise a rejection reason.
 */
export function validateNoNumberConflict(
  candidate: Nex1AgentDesignation,
  existing: readonly Nex1AgentDesignation[],
): string | null {
  if (candidate.proposed_number === null) return null;
  const claims = claimedNumbersMap(existing);
  const claimant = claims.get(candidate.proposed_number);
  if (claimant && claimant !== candidate.agent_id) {
    return `number ${candidate.proposed_number} already claimed by agent '${claimant}' (record status must differ or same agent_id must match)`;
  }
  return null;
}
