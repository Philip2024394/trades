// WO-NEX-RUNTIME-03 · NEX1 types (memory, tools, mission context).
//
// Founder-locked 2026-09-13. NEX1's brain proposes; the Workstation
// still performs governed mutation. Every tool has explicit scope +
// identity + audit + authorization requirements + failure behaviour.

// ── Seven-layer persistent memory ──────────────────────────────────────

export type MemoryLayer =
  | "WORKING"       // current mission context
  | "ENGINEERING"   // past engineering tasks + outcomes
  | "KNOWLEDGE"     // validated NEX knowledge (query only)
  | "FAILURE"       // known failures and conditions
  | "RECOVERY"      // successful recovery procedures
  | "CAPABILITY"    // what NEX1 has demonstrated it can do
  | "PROVENANCE";   // where every important memory item originated

export interface NexMemoryRecord {
  readonly record_type: "NEX1_MEMORY_RECORD";
  readonly memory_id: string;
  readonly agent_id: string;
  readonly layer: MemoryLayer;
  readonly mission_id: string | null;              // WORKING-layer records are scoped to a mission
  readonly key: string;                            // human-readable slot key
  readonly value: string;                          // serialised value (JSON-stringifiable)
  readonly kind: string;                           // e.g. "observation" · "tool_result" · "diagnosis"
  readonly created_at: string;
  readonly source_evidence_refs: readonly string[];
  readonly provenance: string;                     // human-readable origin
  readonly signature_hex: string;                  // agent-identity signature over canonical value
}

// ── Governed tool interface ────────────────────────────────────────────

export type ToolKind =
  | "inspect_repository"
  | "read_file"
  | "search_code"
  | "inspect_dependencies"
  | "inspect_git_state"
  | "inspect_build"
  | "run_tests_interface"           // records intent · does NOT execute in RUNTIME-03
  | "run_build_interface"           // records intent · does NOT execute in RUNTIME-03
  | "run_runtime_interface"         // records intent · does NOT execute in RUNTIME-03
  | "inspect_logs"
  | "query_gb"
  | "query_knowledge"
  | "query_evidence"
  | "query_capabilities"
  | "create_engineering_proposal"   // creates UNSIGNED proposal · never signs
  | "record_evidence";

export interface ToolContract {
  readonly kind: ToolKind;
  readonly description: string;
  /** Read-only tools cannot mutate anything on disk or reach any external
   *  service. Interface tools record intent + prepare specs · they never
   *  execute. Proposal tools create UNSIGNED records only. */
  readonly effect_class: "READ_ONLY" | "RECORDS_INTENT" | "CREATES_UNSIGNED_PROPOSAL" | "RECORDS_EVIDENCE";
  readonly required_scope: readonly string[];       // capability strings from mission's required_capabilities
  readonly authority_class: "AGENT_IDENTITY_ONLY" | "FOUNDER_AUTHORITY";
  /** Tool contracts locked as agent-identity-only in RUNTIME-03. Nothing
   *  in this module signs with founder authority. */
}

/** Every tool call is audited whether it succeeds or fails. */
export interface ToolInvocation {
  readonly record_type: "NEX1_TOOL_INVOCATION";
  readonly invocation_id: string;
  readonly agent_id: string;
  readonly instance_id: string;
  readonly mission_id: string | null;
  readonly kind: ToolKind;
  readonly requested_at: string;
  readonly completed_at: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly outcome: "ok" | "denied" | "failed" | "unavailable";
  readonly outcome_detail: string;
  readonly result_ref: string | null;               // ID of any produced record
  readonly signature_hex: string;                   // signed by agent identity
}

// ── Capability profile ─────────────────────────────────────────────────

export type CapabilityStatus =
  | "CLAIMED"                    // NEX1 declares it can do this
  | "DEMONSTRATED"                // has actually done it (evidence exists)
  | "RUNTIME_VERIFIED"            // demonstrated + validated
  | "PRODUCTION_VERIFIED";        // demonstrated in PRODUCTION_WORKFORCE

export interface CapabilityProfileEntry {
  readonly capability: string;                    // e.g. "typescript" · "sql"
  readonly status: CapabilityStatus;
  readonly first_claimed_at: string;
  readonly last_demonstrated_at: string | null;
  readonly demonstrated_evidence_refs: readonly string[];
}

export interface CapabilityProfile {
  readonly record_type: "NEX1_CAPABILITY_PROFILE";
  readonly agent_id: string;
  readonly entries: readonly CapabilityProfileEntry[];
  readonly updated_at: string;
}

// ── Mission context (reconstructible chain) ────────────────────────────

/** The founder-locked audit chain for every mission NEX1 processes.
 *  NEX2 must be able to reconstruct this to answer "why did NEX1
 *  propose this change?" */
export interface MissionContextChain {
  readonly record_type: "NEX1_MISSION_CONTEXT_CHAIN";
  readonly context_id: string;
  readonly agent_id: string;
  readonly instance_id: string;
  readonly mission_id: string;
  readonly observations: readonly MissionChainLink[];      // what NEX1 observed
  readonly knowledge_used: readonly MissionChainLink[];    // knowledge records queried
  readonly analysis: readonly MissionChainLink[];          // deterministic analysis steps
  readonly files_considered: readonly string[];            // paths read
  readonly tests_considered: readonly string[];            // test targets recorded (not executed)
  readonly proposed_solution: MissionChainLink | null;     // the engineering proposal
  readonly evidence_refs: readonly string[];               // evidence emitted
  readonly handoff: {
    readonly to: "NEX2_REVIEW" | "SECURITY_REVIEW" | "FOUNDER_AUTHORIZATION" | "NONE";
    readonly reason: string;
    readonly proposal_id: string | null;
  } | null;
  readonly started_at: string;
  readonly closed_at: string | null;
  readonly signature_hex: string;
}

export interface MissionChainLink {
  readonly at: string;
  readonly kind: string;                                  // e.g. "read_file" · "search_code" · "diagnosis"
  readonly detail: string;
  readonly evidence_ref: string | null;
}

// ── Collections ────────────────────────────────────────────────────────

export const NEX1_MEMORY_COLLECTION = "nex1_memory_records" as const;
export const NEX1_TOOL_INVOCATIONS_COLLECTION = "nex1_tool_invocations" as const;
export const NEX1_CAPABILITY_PROFILE_COLLECTION = "nex1_capability_profiles" as const;
export const NEX1_MISSION_CONTEXT_COLLECTION = "nex1_mission_contexts" as const;

// ── Tool contract registry (frozen · founder-locked) ───────────────────

export const NEX1_TOOL_CONTRACTS: Readonly<Record<ToolKind, ToolContract>> = Object.freeze({
  inspect_repository:            { kind: "inspect_repository",            description: "Read-only enumeration of repository top-level structure", effect_class: "READ_ONLY", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  read_file:                     { kind: "read_file",                     description: "Read a file from the repository (path must be inside repo_root)", effect_class: "READ_ONLY", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  search_code:                   { kind: "search_code",                   description: "Search for a string/pattern across the repository (read-only)", effect_class: "READ_ONLY", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  inspect_dependencies:          { kind: "inspect_dependencies",          description: "Read package.json / lockfile to enumerate dependencies", effect_class: "READ_ONLY", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  inspect_git_state:             { kind: "inspect_git_state",             description: "Read git state (branch, uncommitted files, last commit)", effect_class: "READ_ONLY", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  inspect_build:                 { kind: "inspect_build",                 description: "Read prior build reports · does NOT execute a build", effect_class: "READ_ONLY", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  run_tests_interface:           { kind: "run_tests_interface",           description: "Record intent to run tests · workstation executes later · this call does NOT execute", effect_class: "RECORDS_INTENT", required_scope: ["vitest"], authority_class: "AGENT_IDENTITY_ONLY" },
  run_build_interface:           { kind: "run_build_interface",           description: "Record intent to run a build · workstation executes later", effect_class: "RECORDS_INTENT", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  run_runtime_interface:         { kind: "run_runtime_interface",         description: "Record intent to run a runtime · workstation executes later", effect_class: "RECORDS_INTENT", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  inspect_logs:                  { kind: "inspect_logs",                  description: "Read prior audit/log records from GB storage", effect_class: "READ_ONLY", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  query_gb:                      { kind: "query_gb",                      description: "Read a GB storage collection (read-only)", effect_class: "READ_ONLY", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  query_knowledge:               { kind: "query_knowledge",               description: "Read the KNOWLEDGE memory layer", effect_class: "READ_ONLY", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  query_evidence:                { kind: "query_evidence",                description: "Read prior evidence records", effect_class: "READ_ONLY", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  query_capabilities:            { kind: "query_capabilities",            description: "Read the capability profile", effect_class: "READ_ONLY", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  create_engineering_proposal:   { kind: "create_engineering_proposal",   description: "Create an UNSIGNED engineering proposal · founder signature still required · NEVER grants execution authority", effect_class: "CREATES_UNSIGNED_PROPOSAL", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
  record_evidence:               { kind: "record_evidence",               description: "Record an evidence entry to GB · signed by agent identity", effect_class: "RECORDS_EVIDENCE", required_scope: [], authority_class: "AGENT_IDENTITY_ONLY" },
});
