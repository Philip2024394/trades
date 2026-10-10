// WO-CAP-01 · Capability Gap types.
//
// Founder-locked 2026-09-13 · governed self-improvement doctrine:
//   Discovery ≠ Authority. A CAP is a bounded, evidenced description of
//   something NEX needs to improve. It does NOT grant NEX permission to
//   change anything. Every proposed fix passes through the Authority Broker.

export type CapCategory =
  | "SECURITY"       // e.g. Guardian rejections · unauthorised access attempts
  | "PERFORMANCE"    // e.g. slow verification · repeated 429s beyond threshold
  | "RELIABILITY"    // e.g. ALIVE_NO_PROGRESS · repeated agent restarts
  | "INTELLIGENCE"   // e.g. pipeline stall · no NET GROWTH for N snapshots
  | "UX";            // e.g. HQ metric ambiguity · founder-flagged language

export type CapPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type CapStatus =
  | "OPEN"           // detected · not yet triaged
  | "TRIAGED"        // classified · has category + priority
  | "PROPOSED"       // engineering proposal drafted · awaiting authorisation
  | "IN_PROGRESS"    // authorised change under way
  | "RESOLVED"       // change landed · evidence recorded
  | "ESCALATED"      // outside safe scope · founder review required
  | "DISMISSED";     // false positive / duplicate · reason recorded

/**
 * Founder-locked three-outcome resolver decision.
 *   AUTO_FIX: within pre-authorised safe scope. Broker gates.
 *   PROPOSE:  understood but out of pre-auth scope. Founder must sign WO.
 *   ESCALATE: unsafe / ambiguous / protected / outside authority.
 */
export type CapResolverOutcome = "AUTO_FIX" | "PROPOSE" | "ESCALATE";

/**
 * Evidence pointer inside a CAP · every pointer must resolve to a real
 * GB record (rejection, heartbeat, snapshot, etc.).
 */
export interface CapEvidencePointer {
  readonly collection: string;
  readonly record_id: string;
  readonly kind: string;   // e.g. "guardian_rejection" / "rate_limit_event" / "growth_snapshot"
}

export interface CapabilityGap {
  readonly record_type: "NEX_CAPABILITY_GAP";
  readonly cap_id: string;
  readonly kind: string;                          // human-readable short kind e.g. "guardian.repeated_rejection"
  readonly category: CapCategory;
  readonly priority: CapPriority;
  readonly status: CapStatus;
  readonly resolver_outcome: CapResolverOutcome | null;
  readonly title: string;                          // short human-facing
  readonly evidence: readonly CapEvidencePointer[];
  readonly proposed_wo_id: string | null;          // FK to unsigned WO envelope (for PROPOSE) or null
  readonly resolution_note: string | null;         // set when RESOLVED / ESCALATED / DISMISSED
  readonly detected_at: string;
  readonly last_updated_at: string;
  readonly detector_agent_id: string | null;       // which observer surfaced this
  readonly provenance_chain_hash: string;
}

export const CAP_COLLECTION = "nex_capability_gaps";
