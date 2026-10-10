// WO-AGENT-RUNTIME-01 · foundation types.
//
// Founder-authorised 2026-09-13 with harder acceptance bar. Each agent
// gets an independent identity + memory + heartbeat + runtime.
//
// Doctrine anchors:
//  - feedback_agent_workforce_15_facets_doctrine_2026_09_13.md
//  - feedback_wo_agent_runtime_01_authorised_hard_bar_2026_09_13.md
//
// Discipline: NO EVIDENCE = NO CLAIM. Every record here is signed with
// the agent's OWN runtime key. Central orchestrator cannot forge these.

// ── 15-facet enumeration (workforce contract) ────────────────────────────

export type FacetKey =
  | "brain"                    // 🧠 reasoning/decision mechanism
  | "memory"                   // 🗃️ persistent knowledge
  | "tools"                    // 🛠️ authorised specialist instruments
  | "vision"                   // 👁️ perception (when role requires)
  | "network"                  // 🌐 authorised external data access
  | "experiment"               // 🧪 hypothesis testing (when role requires)
  | "knowledge"                // 📚 specialist knowledge
  | "identity"                 // 🪪 unique identity
  | "liveness"                 // ❤️ own heartbeat
  | "performance_history"      // 📈 accomplishments
  | "evidence"                 // 🧾 proof of work
  | "training_state"           // 🎓 Academy record + capability profile version
  | "authority_boundary"       // 🔐 P-U envelope
  | "recovery_state"           // 🔄 bounded recovery
  | "learning_contribution";   // 🧠➡️📚 validated knowledge back to NEX

/**
 * Founder-locked verification tiers 2026-09-13.
 *
 * CLAIMED = code path exists → does NOT grant HQ green
 * RUNTIME_VERIFIED = adversarial + property tests pass at runtime
 * PRODUCTION_VERIFIED = real-mission observation confirms behaviour
 * NOT_APPLICABLE = agent role does not require this facet (must be explicit)
 */
export type FacetVerificationTier =
  | "CLAIMED"
  | "RUNTIME_VERIFIED"
  | "PRODUCTION_VERIFIED"
  | "NOT_APPLICABLE";

export interface FacetStatus {
  readonly facet: FacetKey;
  readonly tier: FacetVerificationTier;
  readonly evidence_pointer: string | null;   // GB record link or null when NOT_APPLICABLE
  readonly last_verified_at: string | null;
}

// ── Agent Identity ───────────────────────────────────────────────────────

/**
 * Founder-locked 2026-09-13 · agent environment classification.
 * HQ production statistics must ONLY include PRODUCTION_WORKFORCE agents.
 * Test / simulation / fixture / development agents may write to shared
 * collections but must NEVER inflate production metrics.
 */
export type AgentEnvironment =
  | "PRODUCTION_WORKFORCE"
  | "TEST"
  | "SIMULATION"
  | "FIXTURE"
  | "DEVELOPMENT";

export interface AgentIdentity {
  readonly record_type: "NEX_AGENT_IDENTITY";
  readonly identity_id: string;                    // unique per identity spawn
  readonly agent_id: string;                       // stable identity across restarts (e.g. "intelligence-crawler")
  readonly runtime_version: string;                // semver of the agent runtime code
  readonly runtime_key_public_hex: string;         // Ed25519 public key
  readonly capability_manifest_hash: string;       // SHA-256 of the CapabilityManifest
  readonly authority_manifest_hash: string;        // SHA-256 of the AuthorityManifest
  readonly environment: AgentEnvironment;          // founder-locked 2026-09-13
  readonly spawned_at: string;
  readonly founder_attestation_signature_hex: string;  // signed by founder attestation root
  readonly provenance_chain_hash: string;
}

// ── Capability Manifest ──────────────────────────────────────────────────

export interface CapabilityManifest {
  readonly record_type: "NEX_AGENT_CAPABILITY_MANIFEST";
  readonly manifest_id: string;
  readonly agent_id: string;
  readonly runtime_version: string;
  readonly version: number;                        // increments monotonically
  readonly emitted_at: string;
  readonly facets: readonly FacetStatus[];         // one entry per 15 facets
  readonly specialist_domain: string;
  readonly runtime_signature_hex: string;          // signed by agent's runtime private key
  readonly provenance_chain_hash: string;
}

// ── Authority Manifest (envelope for P-U enforcement) ────────────────────

/**
 * Bounded envelope defining exactly what this agent's runtime may do.
 * Founder-locked: intelligence ≠ authority. Never self-modifiable.
 */
export interface AuthorityManifest {
  readonly record_type: "NEX_AGENT_AUTHORITY_MANIFEST";
  readonly manifest_id: string;
  readonly agent_id: string;
  readonly runtime_version: string;
  readonly authorised_tools: readonly string[];    // tool ids
  readonly authorised_hosts: readonly string[];    // network hosts
  readonly authorised_collections_read: readonly string[];
  readonly authorised_collections_write: readonly string[];
  readonly prohibited_actions: readonly string[];  // e.g. ["POST", "authorise", "modify-substrate"]
  readonly emitted_at: string;
  readonly founder_attestation_signature_hex: string;
  readonly provenance_chain_hash: string;
}

// ── Heartbeat Event (agent-emitted) ──────────────────────────────────────

/**
 * The AGENT emits this. NOT the runner. NOT the observer. Founder-locked
 * 2026-09-13: HQ may only display WORKING if such a record exists AND
 * it is cryptographically attributable to the agent's runtime key AND
 * it references ≥1 persisted evidence record.
 */
export interface AgentHeartbeatEvent {
  readonly record_type: "NEX_AGENT_HEARTBEAT_EVENT";
  readonly heartbeat_id: string;                   // unique · idempotent
  readonly agent_id: string;
  readonly runtime_version: string;
  readonly identity_id: string;                    // ties to AgentIdentity spawn
  readonly emitted_at: string;                     // agent-side timestamp
  readonly mission_id: string | null;
  readonly progress_counter: number;               // monotonic per mission
  readonly last_completed_work: string | null;
  readonly evidence_refs: readonly string[];       // ids of persisted evidence
  readonly runtime_signature_hex: string;          // signed by agent runtime key
  readonly provenance_chain_hash: string;
}

// ── Agent Memory Record ──────────────────────────────────────────────────

export type AgentMemoryKind =
  | "MISSION_OUTCOME"
  | "FAILURE"
  | "VALIDATED_LESSON"
  | "LEARNED_PATTERN";

export interface AgentMemoryRecord {
  readonly record_type: "NEX_AGENT_MEMORY_RECORD";
  readonly memory_id: string;
  readonly agent_id: string;
  readonly kind: AgentMemoryKind;
  readonly mission_id: string | null;
  readonly content_hash: string;
  readonly content: Readonly<Record<string, unknown>>;
  readonly created_at: string;
  readonly runtime_signature_hex: string;          // signed by agent runtime key
  readonly provenance_chain_hash: string;
}

// ── Performance History Record ───────────────────────────────────────────

export interface AgentPerformanceRecord {
  readonly record_type: "NEX_AGENT_PERFORMANCE_RECORD";
  readonly performance_id: string;
  readonly agent_id: string;
  readonly mission_id: string;
  readonly started_at: string;
  readonly finished_at: string;
  readonly outcome: "SUCCESS" | "FAILURE" | "PARTIAL";
  readonly evidence_refs: readonly string[];
  readonly items_processed: number;
  readonly compute_used_ms: number;
  readonly runtime_signature_hex: string;
  readonly provenance_chain_hash: string;
}

// ── Learning Contribution ────────────────────────────────────────────────

export interface AgentLearningContribution {
  readonly record_type: "NEX_AGENT_LEARNING_CONTRIBUTION";
  readonly contribution_id: string;
  readonly agent_id: string;
  readonly mission_id: string;
  readonly kind: "VALIDATED_LESSON" | "NEW_PATTERN" | "RETRACTED_ASSUMPTION";
  readonly content: Readonly<Record<string, unknown>>;
  readonly evidence_refs: readonly string[];       // supporting evidence
  readonly proposed_at: string;
  readonly runtime_signature_hex: string;
  readonly provenance_chain_hash: string;
}

// ── Verification result union ───────────────────────────────────────────

/**
 * Founder-locked 2026-09-13: rejection reasons for heartbeat/identity
 * verification. Each is a distinct evidence category — never lumped as
 * "invalid".
 */
export type VerificationRejection =
  | "SIGNATURE_INVALID"
  | "WRONG_KEY"
  | "MISSING_SIGNATURE"
  | "FUTURE_TIMESTAMP"
  | "STALE_TIMESTAMP"
  | "DUPLICATE_HEARTBEAT_ID"
  | "AGENT_ID_MISMATCH"
  | "PROGRESS_WITHOUT_EVIDENCE"    // heartbeat claims progress but evidence_refs is empty
  | "UNKNOWN_IDENTITY"
  | "ATTESTATION_INVALID";

export interface VerificationResult {
  readonly ok: boolean;
  readonly rejection?: VerificationRejection;
  readonly reason?: string;
}
