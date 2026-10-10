// WO-NEX-RUNTIME-02 · durable mission queue types.
//
// Founder-locked 2026-09-13. Constitutional rules:
//   1. "Scheduling authority ≠ engineering authority" · the scheduler
//      can order missions but cannot expand their authority.
//   2. "Locality can improve ordering, but it can never permanently
//      starve higher-priority eligible work."
//
// The queue holds engineering missions durably. It does NOT execute
// code, modify files, reach the workstation, or grant any authority.

/** The founder-defined status lifecycle. */
export type MissionStatus =
  | "QUEUED"                    // awaiting eligibility
  | "ELIGIBLE"                  // passed dependency + conflict + capability + security checks
  | "CLAIMED"                   // an agent holds a lease · not yet started work
  | "IN_PROGRESS"               // agent reported work started
  | "AWAITING_VERIFICATION"     // work reported complete · pending verification
  | "COMPLETED"                 // verification passed
  | "FAILED"                    // execution or verification failed
  | "BLOCKED"                   // waiting on a dependency / external condition
  | "QUARANTINED"               // security or integrity control stopped this mission
  | "CANCELLED";                // founder or system cancelled before completion

export type MissionPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type MissionSecurityClass =
  | "STANDARD"                  // ordinary engineering
  | "SENSITIVE"                 // touches auth · billing · founder-facing paths
  | "SECURITY_ESCALATION"       // security-critical · founder-only manual resolution
  | "BLOCKED_FROM_AUTOMATION";  // cannot be scheduled at all

export type MissionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "SEVERE";

/** Full mission record persisted to GB storage. */
export interface EngineeringMission {
  readonly record_type: "NEX_ENGINEERING_MISSION";

  // ── Identity + origin ────────────────────────────────────────────────
  readonly mission_id: string;
  readonly created_at: string;
  /** Stable dedupe key · same key → same mission_id (idempotent enqueue). */
  readonly dedupe_key: string;
  /** Where the mission came from (Work Map / CAP registry / founder direct). */
  readonly source: "WORK_MAP" | "CAP_REGISTRY" | "FOUNDER_DIRECT" | "SCHEDULER_INTERNAL";
  readonly cap_id: string | null;
  readonly work_map_ref: string | null;

  // ── Founder-authorised scope (never expanded by scheduler) ───────────
  readonly title: string;
  readonly authored_intent: string;                    // the founder's request text
  readonly priority: MissionPriority;
  readonly urgency: "NORMAL" | "URGENT";               // hint · not authority
  readonly security_class: MissionSecurityClass;
  readonly risk_level: MissionRiskLevel;

  // ── Engineering shape ────────────────────────────────────────────────
  readonly affected_paths: readonly string[];          // repo paths this mission expects to touch
  readonly required_capabilities: readonly string[];   // e.g. "typescript" · "next-app-router" · "sql"
  readonly build_targets: readonly string[];           // e.g. "npm-build" · "vitest"
  readonly dependencies: readonly string[];            // other mission_ids that must COMPLETE first
  readonly conflicts: readonly string[];               // mission_ids that cannot run simultaneously
  readonly parent_mission_id: string | null;
  readonly related_mission_ids: readonly string[];

  // ── State ────────────────────────────────────────────────────────────
  readonly status: MissionStatus;
  readonly queue_position: number | null;              // last-known scheduler position (informational)
  readonly attempt_count: number;

  // ── Scheduler evidence (latest scheduling decision snapshot) ─────────
  readonly last_scheduler_score: number | null;
  readonly last_scheduler_reason: string | null;
  readonly last_scheduler_at: string | null;

  // ── Claim / lease ────────────────────────────────────────────────────
  readonly assigned_agent_id: string | null;
  readonly lease_expires_at: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;

  // ── Evidence ─────────────────────────────────────────────────────────
  readonly evidence_refs: readonly string[];
  readonly last_updated_at: string;
  readonly provenance_chain_hash: string;
}

/** A lease held by an agent while it processes a mission. */
export interface MissionClaim {
  readonly record_type: "NEX_MISSION_CLAIM";
  readonly claim_id: string;
  readonly mission_id: string;
  readonly claimed_by_agent_id: string;
  readonly claimed_by_instance_id: string;
  readonly claimed_at: string;
  readonly expires_at: string;
  readonly released_at: string | null;
  readonly release_reason: "COMPLETED" | "FAILED" | "RELEASED" | "EXPIRED" | null;
}

/** Audit record: why the scheduler chose this mission. */
export interface SchedulerDecision {
  readonly record_type: "NEX_SCHEDULER_DECISION";
  readonly decision_id: string;
  readonly evaluated_at: string;
  readonly candidates_examined: number;
  readonly selected_mission_id: string | null;
  readonly rejected: readonly { mission_id: string; reason: string }[];
  readonly winner_score: number | null;
  readonly winner_factors: readonly SchedulerFactorContribution[];
  readonly reason_summary: string;                        // human-readable
  readonly provenance_chain_hash: string;
}

export interface SchedulerFactorContribution {
  readonly factor: SchedulerFactorKind;
  readonly delta: number;                                  // signed contribution to the total score
  readonly rationale: string;                              // human-readable
}

export type SchedulerFactorKind =
  | "eligibility"
  | "dependency_ready"
  | "conflict_free"
  | "capability_match"
  | "security_gate"
  | "priority"
  | "starvation_age_boost"
  | "locality"
  | "age_fairness"
  | "tie_break";

// ── Collection names (GB storage) ──────────────────────────────────────

export const ENGINEERING_MISSIONS_COLLECTION = "nex_engineering_missions" as const;
export const MISSION_CLAIMS_COLLECTION = "nex_mission_claims" as const;
export const SCHEDULER_DECISIONS_COLLECTION = "nex_scheduler_decisions" as const;

// ── Priority weights (deterministic, founder-locked) ───────────────────

export const PRIORITY_WEIGHTS: Readonly<Record<MissionPriority, number>> = Object.freeze({
  CRITICAL: 1000,
  HIGH:     100,
  MEDIUM:   10,
  LOW:      1,
});

// ── Security-class gate ────────────────────────────────────────────────

/** Missions in these classes are NEVER scheduled by the automatic
 *  scheduler · they surface to the founder only. */
export const SECURITY_CLASSES_BLOCKED: ReadonlySet<MissionSecurityClass> = new Set([
  "SECURITY_ESCALATION",
  "BLOCKED_FROM_AUTOMATION",
]);
