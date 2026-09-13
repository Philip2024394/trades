// WO-ACADEMY-01 · types for the NEX Agent Academy.
//
// Founder-authorised 2026-09-13 under NEX Continuous Operation & Maximum
// Capability Doctrine + P-Q + P-U + P-S v2.
//
// Discipline: capability + career state NEVER grant execution authority.
// Authority stays with founder-signed WOs (P-U). Every record is content-
// hashed and provenance-chained.

// ── Career state ────────────────────────────────────────────────────────

export type CareerState =
  | "TRAINEE"          // enrolled; no qualifying evidence yet
  | "TESTED"           // completed controlled exercises
  | "CERTIFIED"        // passed real test cases + adversarial tests
  | "SPECIALIST"       // real production evidence; qualified for domain work
  | "ELITE_SPECIALIST" // cross-domain evidence + discovery contributions
  | "MASTER"           // ELITE + reproducibility + generalisation + regression discipline
  | "RESTRICTED"       // Notice 2: reduced privileges; retraining required
  | "DECOMMISSIONED"   // Notice 3: no longer assignable; Knowledge Harvest complete
  ;

/** Rank order used for minimum-career-state comparisons. Higher = more qualified. */
export const CAREER_RANK: Readonly<Record<CareerState, number>> = Object.freeze({
  DECOMMISSIONED:   -1,
  RESTRICTED:        0,
  TRAINEE:           1,
  TESTED:            2,
  CERTIFIED:         3,
  SPECIALIST:        4,
  ELITE_SPECIALIST:  5,
  MASTER:            6,
});

// ── Capability profile (the 11 founder-specified fields + weakness ledger) ──

export interface CapabilityProfileFailureType {
  readonly kind: string;
  readonly count: number;
  readonly last_seen_at: string;
}

export interface CapabilityProfileEvidencePointer {
  readonly collection: string;
  readonly record_id: string;
  readonly outcome: "SUCCESS" | "FAILURE" | "LIMITATION";
}

export type KnownWeaknessStatus =
  | "fixed"
  | "mitigated"
  | "bounded"
  | "monitored"
  | "investigated"
  | "founder-accepted";

export interface KnownWeakness {
  readonly weakness: string;
  readonly status: KnownWeaknessStatus;
  readonly discovered_at: string;
  readonly evidence_pointer: string | null;
}

export interface CapabilityProfile {
  readonly record_type: "NEX_ACADEMY_CAPABILITY_PROFILE";
  readonly profile_id: string;
  readonly agent_id: string;
  readonly version: number;
  readonly updated_at: string;

  // 11 founder fields
  readonly what_it_knows: readonly string[];
  readonly what_it_trained_on: readonly string[];
  readonly tasks_it_can_perform: readonly string[];
  readonly success_rate: number;                  // 0..1
  readonly failure_types: readonly CapabilityProfileFailureType[];
  readonly qualified_tools: readonly string[];
  readonly evidence_pointers: readonly CapabilityProfileEvidencePointer[];
  readonly capability_scope: readonly string[];   // domain-only; never authority
  readonly current_workload: number;
  readonly confidence: number;                    // 0..1 (advisory per P-B)
  readonly specialist_domain: string;

  // Continuous Operation Doctrine §4
  readonly known_weaknesses: readonly KnownWeakness[];

  readonly provenance_chain_hash: string;
}

// ── Academy record (one per agent) ──────────────────────────────────────

export interface CareerHistoryEntry {
  readonly state: CareerState;
  readonly entered_at: string;
  readonly reason: string;
  readonly evidence_pointer: string | null;
}

export interface AcademyRecord {
  readonly record_type: "NEX_ACADEMY_AGENT_RECORD";
  readonly agent_id: string;
  readonly agent_name: string;
  readonly domain: string;
  readonly career_state: CareerState;
  readonly career_history: readonly CareerHistoryEntry[];
  readonly capability_profile_version: number;
  readonly task_completion_score: number;      // 0..1
  readonly knowledge_contribution_score: number;// 0..1
  readonly regression_score: number;            // 0..1
  readonly notice_count: {
    readonly notice_1: number;
    readonly notice_2: number;
    readonly notice_3: number;
  };
  readonly last_updated_at: string;
  readonly provenance_chain_hash: string;
}

// ── Notices ─────────────────────────────────────────────────────────────

export type NoticeKind = "NOTICE_1" | "NOTICE_2" | "NOTICE_3";

export interface NoticeRecord {
  readonly record_type: "NEX_ACADEMY_NOTICE";
  readonly notice_id: string;
  readonly agent_id: string;
  readonly kind: NoticeKind;
  readonly issued_at: string;
  readonly reason: string;
  readonly measured_metric: string;
  readonly measured_value: number;
  readonly threshold: number;
  readonly evidence_pointers: readonly string[];
  readonly retraining_path: string | null;
  readonly resulting_career_state: CareerState;
  readonly provenance_chain_hash: string;
}

// ── Knowledge harvest (MUST precede DECOMMISSIONED) ─────────────────────

export interface HarvestedContribution {
  readonly source_collection: string;
  readonly record_id: string;
  readonly kind: "useful" | "reject";
  readonly reason: string;
}

export interface RejectedAssumption {
  readonly assertion: string;
  readonly reason: string;
}

export interface KnowledgeHarvest {
  readonly record_type: "NEX_ACADEMY_KNOWLEDGE_HARVEST";
  readonly harvest_id: string;
  readonly agent_id: string;
  readonly frozen_at: string;
  readonly collected_contributions: readonly HarvestedContribution[];
  readonly validated_knowledge_object_ids: readonly string[]; // FK -> nex_intelligence_knowledge_objects
  readonly rejected_assumptions: readonly RejectedAssumption[];
  readonly successor_agent_id: string | null;
  readonly provenance_chain_hash: string;
}

// ── Task market ─────────────────────────────────────────────────────────

export interface TaskRequirement {
  readonly record_type: "NEX_ACADEMY_TASK_REQUIREMENT";
  readonly task_id: string;
  readonly domain: string;
  readonly required_capability_scope: readonly string[];
  readonly required_qualified_tools: readonly string[];
  readonly minimum_career_state: CareerState;
  readonly created_at: string;
}

export interface MatchCandidate {
  readonly agent_id: string;
  readonly qualification_score: number;   // 0..1
  readonly reasons: readonly string[];
}

export interface Match {
  readonly record_type: "NEX_ACADEMY_MATCH";
  readonly match_id: string;
  readonly task_id: string;
  readonly ranked_candidates: readonly MatchCandidate[];
  readonly selected_agent_id: string | null;
  readonly reason_no_selection: string | null;
  readonly created_at: string;
}

// ── Union of persistable records ────────────────────────────────────────

export type AcademyPersistable =
  | AcademyRecord
  | CapabilityProfile
  | NoticeRecord
  | KnowledgeHarvest
  | TaskRequirement
  | Match;
