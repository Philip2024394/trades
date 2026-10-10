// WO-NEX-RUNTIME-01 · process runtime types.
//
// Founder-locked 2026-09-13. RUNTIME-01 proves independent process
// runtime, NOT autonomous engineering capability. The types here are
// deliberately narrow · they cover start/identity/heartbeat/mission/
// progress/evidence/stop/restart and nothing beyond.
//
// Hard boundary: an AgentIdentityRecord's public key is used to verify
// heartbeats + evidence signatures. It CANNOT approve workstation
// mutation. Execution authority lives in the founder key custody
// (RUNTIME-08), NEVER here.

/** Persistent per-agent identity. Same across process restarts. */
export interface AgentIdentityRecord {
  readonly record_type: "NEX_AGENT_IDENTITY";
  readonly agent_id: string;                  // stable e.g. "nex1", "minimal-echo"
  readonly public_key_der_hex: string;        // Ed25519 SPKI DER hex
  readonly created_at: string;
  readonly notes: string;
}

/** Per-process-start instance. Rotates on every daemon start. */
export interface AgentInstanceRecord {
  readonly record_type: "NEX_AGENT_INSTANCE";
  readonly agent_id: string;
  readonly instance_id: string;               // uuid · unique per process start
  readonly pid: number;
  readonly hostname: string;
  readonly startup_at: string;
  readonly heartbeat_interval_ms: number;
  readonly agent_public_key_der_hex: string;  // copy of identity pub-key at start
}

/** Signed heartbeat emitted by the daemon on its own timer. */
export interface AgentRuntimeHeartbeat {
  readonly record_type: "NEX_AGENT_RUNTIME_HEARTBEAT";
  readonly heartbeat_id: string;
  readonly agent_id: string;
  readonly instance_id: string;
  readonly pid: number;
  readonly emitted_at: string;
  readonly mission_id: string | null;
  readonly progress_counter: number;
  readonly evidence_refs: readonly string[];
  readonly lifecycle_state: ProcessLifecycleState;
  /** Ed25519 signature over the canonical payload (this record minus the
   *  signature field itself). Verifies against the agent identity key. */
  readonly signature_hex: string;
}

/** Process-level lifecycle state. Distinct from HeartbeatState in
 *  nex-hq-heartbeat/types.ts · that is a derived VIEW; this is the
 *  RUNTIME's own state machine. */
export type ProcessLifecycleState =
  | "INITIALISING"      // process spawned · identity loaded · not yet emitted heartbeat
  | "ALIVE_IDLE"        // heartbeat active · NO mission assigned
  | "MISSION_ASSIGNED"  // mission received · no progress yet
  | "WORKING"           // mission + heartbeat + progress + evidence (all four)
  | "MISSION_STALLED"   // mission received · no progress > threshold
  | "FAILED"            // explicit failure recorded
  | "STOPPING"          // received SIGTERM · draining
  | "STOPPED";          // clean shutdown emitted final audit

/** Process audit events. Persisted for external observers. */
export type ProcessAuditKind =
  | "PROCESS_STARTED"
  | "PROCESS_STOPPED"
  | "PROCESS_CRASHED"           // detected externally · never self-emitted
  | "MISSION_ASSIGNED"
  | "MISSION_COMPLETED"
  | "MISSION_FAILED"
  | "EVIDENCE_EMITTED"
  | "HEARTBEAT_SIG_VERIFY_FAILED";  // adversarial event · external observer emits

export interface AgentProcessAuditEvent {
  readonly record_type: "NEX_AGENT_PROCESS_AUDIT";
  readonly event_id: string;
  readonly kind: ProcessAuditKind;
  readonly agent_id: string;
  readonly instance_id: string;
  readonly pid: number | null;
  readonly at: string;
  readonly mission_id: string | null;
  readonly detail: string;
}

/** A mission envelope the daemon receives. RUNTIME-02 will define the
 *  queue that emits these; RUNTIME-01 accepts one via a test hook so
 *  minimal-echo can prove reception. */
export interface AgentMissionEnvelope {
  readonly record_type: "NEX_AGENT_MISSION_ENVELOPE";
  readonly mission_id: string;
  readonly agent_id: string;
  readonly cap_id: string | null;
  readonly kind: string;                      // e.g. "echo", "diagnose", "review"
  readonly payload: Readonly<Record<string, unknown>>;
  readonly created_at: string;
  readonly deadline_at: string | null;
}

/** A tiny evidence record the daemon emits during work. */
export interface AgentEvidenceRecord {
  readonly record_type: "NEX_AGENT_EVIDENCE";
  readonly evidence_id: string;
  readonly agent_id: string;
  readonly instance_id: string;
  readonly mission_id: string | null;
  readonly emitted_at: string;
  readonly kind: string;                      // e.g. "echo.reply"
  readonly payload: Readonly<Record<string, unknown>>;
  /** Ed25519 signature over canonical payload; verifiable via agent identity key. */
  readonly signature_hex: string;
}

// ── Collection names ───────────────────────────────────────────────────

export const AGENT_IDENTITY_COLLECTION = "nex_agent_identities" as const;
export const AGENT_INSTANCE_COLLECTION = "nex_agent_instances" as const;
export const AGENT_RUNTIME_HEARTBEAT_COLLECTION = "nex_agent_runtime_heartbeats" as const;
export const AGENT_PROCESS_AUDIT_COLLECTION = "nex_agent_process_audit" as const;
export const AGENT_EVIDENCE_COLLECTION = "nex_agent_evidence" as const;
