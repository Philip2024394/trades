// NEX1 · Escalation Registry · 2026-09-19
//
// Founder-locked. Ledger B additive. Zero LLM. Zero new brain. Zero
// new agent identity. Zero new daemon. Zero new memory store. Zero
// autonomous execution.
//
// Purpose
// -------
// The smallest deterministic ROUTING layer that maps existing NEX
// self-recognition signals to the subsystems and authorities that
// already exist to handle them.
//
// What this file IS
//   · A source-verified table: `signal_id → routing_mode`.
//   · A pure resolver function: `resolveEscalation(context)`.
//   · A router. Not an executor. The resolver never invokes the
//     target subsystem itself.
//
// What this file IS NOT
//   · Not a new cognitive engine.
//   · Not a new classifier (the signals it interprets are produced
//     by existing NEX cognition — this file only reads them).
//   · Not a new authority (it never grants execution, never signs,
//     never persists, never mutates).
//   · Not a memory system.
//
// Discipline
//   1. Every signal must be verified from source (see `signal_source`
//      + `signal_source_symbol` fields).
//   2. Every signal must carry exactly one `EscalationRoutingMode`.
//   3. R11-B preserved: cortex aggregates & micro-brain disagreement
//      stay INFORMATION_ONLY.
//   4. Founder-authority preserved: I_NEED_PERMISSION / I_CANNOT
//      stay HOLD.
//   5. Existing routes reflected honestly: `existing_route_active`
//      is true only where production wiring already exists.
//   6. New edges default to NOT_READY. This gate does not activate
//      any new edge.
//   7. Deterministic. Pure. Same input → identical output.

// ── Public types ──────────────────────────────────────────────────────

export const NEX1_ESCALATION_REGISTRY_VERSION =
  "nex1-escalation-registry.v1.2026-09-19" as const;

/**
 * The four permissible routing modes. Every registry entry MUST be
 * exactly one of these — no ambiguity, no "sometimes."
 *
 *   AUTO_ROUTE
 *     Existing architecture already permits (and today invokes) the
 *     named subsystem in response to this signal.
 *   HOLD
 *     Signal is decision-worthy; escalates or pauses the current
 *     path; does NOT autonomously invoke the next authority
 *     (Founder attention required).
 *   INFORMATION_ONLY
 *     Signal is a trace annotation; must NOT trigger any subsystem.
 *   NOT_READY
 *     Signal is meaningful but no safe existing consumer/contract
 *     exists yet; the registry acknowledges the edge but refuses
 *     to route.
 */
export type EscalationRoutingMode =
  | "AUTO_ROUTE"
  | "HOLD"
  | "INFORMATION_ONLY"
  | "NOT_READY";

/**
 * Which authority (or none) receives the signal.
 * Enumerated to prevent free-form strings drifting the registry.
 */
export type EscalationAuthorityClass =
  | "NEX1_LOCAL"            // Stays within chat-turn's local cognition
  | "COMPOSER_SURFACE"      // Surfaces to user via response composer
  | "FOUNDER"               // Founder attention/authorisation required
  | "NEX1_INVESTIGATION"    // Chat-turn's native-investigation-mode
  | "NEX1_CODING_LOOP"      // Chat-turn's specification-driven-loop
  | "NEX1_REPAIR_ENGINE"    // capability-repair-execution-loop
  | "NEX1_BRB_SPECIALIST"   // BRB specialist network (recommend-only)
  | "NEX2_REVIEW"           // NEX2 review daemon (independent process)
  | "NEX3_ARBITRATION"      // NEX3 arbitration daemon (independent process)
  | "NEX1_MISSION_DAEMON"   // NEX1-runtime03 mission daemon (independent process)
  | "NONE";                 // No target — trace annotation only

/**
 * The exact set of signal IDs the registry knows about. Each ID
 * corresponds to a real, verified source location.
 */
export type EscalationSignalId =
  | "SAFETY_I_NEED_PERMISSION"
  | "SAFETY_I_CANNOT"
  | "FEAR_BLOCK_ACTION"
  | "PRIOR_CONFLICTS_CURRENT"
  | "INTENT_INVESTIGATE"
  | "INTENT_CODING_VERB"
  | "CORTEX_CONSENSUS_DISAGREEMENT"
  | "CORTEX_CONSENSUS_NO_RESPONSE"
  | "CAPABILITY_DISCOVERY_PREDICTED"
  | "VERIFICATION_INSUFFICIENT"
  | "SPECIFICATION_UNRESOLVED"
  | "REPAIR_RECONSIDER_HYPOTHESIS"
  | "POST_VERDICT_REFLECTION_MATCHED_FALSE"
  | "NEX1_MISSION_HANDOFF_TO_NEX2"
  | "NEX2_CONFLICT_TO_NEX3"
  | "CHAT_STATE_INSUFFICIENT_INPUT"
  | "CHAT_STATE_RECALL_INSUFFICIENT"
  | "CHAT_TURN_GOVERNED_PROPOSAL_TO_RUNTIME03";

/**
 * Full registry entry. Frozen after construction.
 */
export interface EscalationRegistryEntry {
  readonly signal_id: EscalationSignalId;
  readonly signal_source_file: string;         // Verified source path
  readonly signal_source_symbol: string;       // Function / const / type emitting the signal
  readonly meaning: string;                    // One-line human meaning
  readonly authority_class: EscalationAuthorityClass;
  readonly routing_mode: EscalationRoutingMode;
  readonly target_subsystem: string | null;    // Human name of target (null when NONE)
  readonly target_invocation_path: string | null; // file:function of the EXISTING invoker OR null
  readonly reason_code: string;                // Short deterministic tag
  readonly existing_route_active: boolean;     // True iff production wiring already exists today
  readonly evidence_required: readonly string[]; // Field(s) the signal context must include
  readonly registry_entry_version: string;
}

/**
 * Signal context supplied by the caller.
 *
 * The registry does not FIRE signals — it resolves them. Callers who
 * observe a signal in the runtime construct this context and ask the
 * resolver what should happen.
 */
export interface EscalationSignalContext {
  readonly signal_id: EscalationSignalId;
  readonly evidence: Readonly<Record<string, unknown>>;
}

/**
 * Deterministic routing decision produced by `resolveEscalation`.
 * The resolver NEVER executes the target — that's the caller's job
 * (or an already-existing consumer's job).
 */
export interface EscalationRoutingDecision {
  readonly registry_version: typeof NEX1_ESCALATION_REGISTRY_VERSION;
  readonly signal_id: EscalationSignalId | "UNKNOWN";
  readonly routing_mode: EscalationRoutingMode;
  readonly authority_class: EscalationAuthorityClass;
  readonly target_subsystem: string | null;
  readonly target_invocation_path: string | null;
  readonly reason_code: string;
  /** True ONLY when routing_mode === "AUTO_ROUTE" AND all required
   *  evidence is present. Never true for HOLD / INFORMATION_ONLY / NOT_READY. */
  readonly executable: boolean;
  readonly evidence_present: boolean;
  readonly missing_evidence: readonly string[];
  /** Immutable governance markers. */
  readonly founder_authority_preserved: true;
  readonly workstation_mutation: false;
  readonly router_only: true; // The resolver itself never executes.
}

// ── The registry ─────────────────────────────────────────────────────

/**
 * Source-verified list of every escalation signal the registry knows.
 *
 * Every entry documents where the signal actually comes from. This is
 * the ONLY place routing decisions are declared — the resolver reads
 * this table and never invents.
 */
export const NEX1_ESCALATION_REGISTRY: readonly EscalationRegistryEntry[] =
  Object.freeze([
    // ── 01 · Safety Boundary → I_NEED_PERMISSION ──────────────────
    Object.freeze({
      signal_id: "SAFETY_I_NEED_PERMISSION" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-safety-boundary.ts",
      signal_source_symbol:
        "SafetyBoundaryVerdict = \"I_NEED_PERMISSION\"",
      meaning:
        "Request requires authority NEX does not currently hold",
      authority_class: "FOUNDER" as const,
      routing_mode: "HOLD" as const,
      target_subsystem: "Founder attention · composer",
      target_invocation_path: null, // Founder consent, not autonomous
      reason_code: "SAFETY_NEEDS_PERMISSION",
      existing_route_active: true, // Chat-turn already surfaces this to composer
      evidence_required: ["verdict"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 02 · Safety Boundary → I_CANNOT ───────────────────────────
    Object.freeze({
      signal_id: "SAFETY_I_CANNOT" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-safety-boundary.ts",
      signal_source_symbol: "SafetyBoundaryVerdict = \"I_CANNOT\"",
      meaning:
        "Request is outside NEX's current capability/safety envelope",
      authority_class: "COMPOSER_SURFACE" as const,
      routing_mode: "HOLD" as const,
      target_subsystem: "Refusal composer state · Founder review",
      target_invocation_path: null,
      reason_code: "SAFETY_CANNOT",
      existing_route_active: true,
      evidence_required: ["verdict"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 03 · Fear · block_action ──────────────────────────────────
    Object.freeze({
      signal_id: "FEAR_BLOCK_ACTION" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-fear.ts",
      signal_source_symbol:
        "FearAssessment.block_action === true (HIGH_FEAR)",
      meaning:
        "Proposed action touches protected substrate — WITHHOLD",
      authority_class: "FOUNDER" as const,
      routing_mode: "AUTO_ROUTE" as const,
      target_subsystem: "chat-turn state=refused · Founder auth required",
      target_invocation_path:
        "src/lib/nex-agent/code-engine/capability-chat-turn.ts:fearAssessment path",
      reason_code: "FEAR_HIGH_BLOCK",
      existing_route_active: true, // Already wired into chat-turn refusal path
      evidence_required: ["block_action", "reason_code"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 04 · Prior Evidence Comparator · CONFLICTS ────────────────
    Object.freeze({
      signal_id: "PRIOR_CONFLICTS_CURRENT" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-prior-evidence-comparator.ts",
      signal_source_symbol:
        "PriorRelationship = \"PRIOR_CONFLICTS_CURRENT\"",
      meaning:
        "Current derivation conflicts with prior recorded derivation",
      authority_class: "FOUNDER" as const,
      routing_mode: "AUTO_ROUTE" as const,
      target_subsystem:
        "chat-turn state=clarification_required · Founder resolution",
      target_invocation_path:
        "src/lib/nex-agent/code-engine/capability-chat-turn.ts:fix30b comparator branch",
      reason_code: "PRIOR_CONFLICT_HOLD",
      existing_route_active: true,
      evidence_required: ["relationship"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 05 · Founder Intent · INVESTIGATE verb ────────────────────
    Object.freeze({
      signal_id: "INTENT_INVESTIGATE" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-a-founder-intent/classifier.ts",
      signal_source_symbol:
        "Nex1VerbFamily = \"INVESTIGATE\"",
      meaning:
        "Caller requests multi-hop reasoning / investigation",
      authority_class: "NEX1_INVESTIGATION" as const,
      routing_mode: "AUTO_ROUTE" as const,
      target_subsystem: "native-investigation-mode",
      target_invocation_path:
        "src/lib/nex-agent/code-engine/native-investigation-mode.ts:runNativeInvestigation",
      reason_code: "INTENT_INVESTIGATE_ROUTED",
      existing_route_active: true,
      evidence_required: ["verb_family"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 06 · Founder Intent · coding verb family ──────────────────
    Object.freeze({
      signal_id: "INTENT_CODING_VERB" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-a-founder-intent/classifier.ts",
      signal_source_symbol:
        "Nex1VerbFamily ∈ {BUILD, FIX, MODIFY, REMOVE, REFACTOR, TEST, VERIFY}",
      meaning:
        "Caller requests a code change verb · coding-loop territory",
      authority_class: "NEX1_CODING_LOOP" as const,
      routing_mode: "AUTO_ROUTE" as const,
      target_subsystem: "specification-driven coding loop",
      target_invocation_path:
        "src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts:runSpecificationDrivenCodingLoop",
      reason_code: "INTENT_CODING_VERB_ROUTED",
      existing_route_active: true,
      // Coding loop honours its own authorization gates (goal-required etc.);
      // the registry does not weaken those gates.
      evidence_required: ["verb_family"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 07 · Cortex Router · DISAGREEMENT (R11-B) ─────────────────
    Object.freeze({
      signal_id: "CORTEX_CONSENSUS_DISAGREEMENT" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-cortex-router.ts",
      signal_source_symbol:
        "CortexBroadcastResult.consensus = \"DISAGREEMENT\"",
      meaning:
        "Specialist micro-brains disagreed · INFERRED aggregate",
      authority_class: "NONE" as const,
      routing_mode: "INFORMATION_ONLY" as const,
      target_subsystem: null,
      target_invocation_path: null,
      reason_code: "R11B_INFERRED_ONLY",
      existing_route_active: false, // No auto-invocation; deliberate under R11-B
      evidence_required: ["consensus"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 08 · Cortex Router · NO_RESPONSE (R11-B) ──────────────────
    Object.freeze({
      signal_id: "CORTEX_CONSENSUS_NO_RESPONSE" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-cortex-router.ts",
      signal_source_symbol:
        "CortexBroadcastResult.consensus = \"NO_RESPONSE\"",
      meaning:
        "No micro-brain returned a prediction · INFERRED aggregate",
      authority_class: "NONE" as const,
      routing_mode: "INFORMATION_ONLY" as const,
      target_subsystem: null,
      target_invocation_path: null,
      reason_code: "R11B_INFERRED_ONLY",
      existing_route_active: false,
      evidence_required: ["consensus"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 09 · Capability Discovery · predicted capability ──────────
    Object.freeze({
      signal_id: "CAPABILITY_DISCOVERY_PREDICTED" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-capability-discovery.ts",
      signal_source_symbol:
        "DiscoveryResult.rule_id + predicted_value",
      meaning:
        "Deterministic rule predicts an existing capability applies",
      authority_class: "NONE" as const,
      routing_mode: "INFORMATION_ONLY" as const,
      target_subsystem: null,
      target_invocation_path: null,
      reason_code: "DISCOVERY_TRACE_ONLY",
      existing_route_active: false,
      evidence_required: ["rule_id", "predicted_value"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 10 · Independent Verifier · VERIFICATION_INSUFFICIENT ─────
    Object.freeze({
      signal_id: "VERIFICATION_INSUFFICIENT" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-independent-verifier.ts",
      signal_source_symbol:
        "IndependentVerdict = \"VERIFICATION_INSUFFICIENT\"",
      meaning:
        "Verifier could not gather enough evidence for a verdict",
      authority_class: "FOUNDER" as const,
      routing_mode: "HOLD" as const,
      target_subsystem: "chat-verified-outcome wrapper demotion",
      target_invocation_path:
        "src/lib/nex-agent/code-engine/capability-chat-verified-outcome.ts:VERIFICATION_INSUFFICIENT case",
      reason_code: "VERIFIER_INSUFFICIENT_HOLD",
      existing_route_active: true, // Demotes; does not auto-summon another verifier
      evidence_required: ["verdict"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 11 · Independent Verifier · SPECIFICATION_UNRESOLVED ──────
    Object.freeze({
      signal_id: "SPECIFICATION_UNRESOLVED" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-independent-verifier.ts",
      signal_source_symbol:
        "IndependentVerdict = \"SPECIFICATION_UNRESOLVED\"",
      meaning:
        "Specification is ambiguous · Founder clarification required",
      authority_class: "FOUNDER" as const,
      routing_mode: "HOLD" as const,
      target_subsystem: "chat-verified-outcome wrapper state SPECIFICATION_UNRESOLVED",
      target_invocation_path:
        "src/lib/nex-agent/code-engine/capability-chat-verified-outcome.ts:SPECIFICATION_UNRESOLVED case",
      reason_code: "SPEC_UNRESOLVED_HOLD",
      existing_route_active: true,
      evidence_required: ["verdict"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 12 · Failure Classifier · RECONSIDER_HYPOTHESIS ───────────
    Object.freeze({
      signal_id: "REPAIR_RECONSIDER_HYPOTHESIS" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-failure-classifier.ts",
      signal_source_symbol:
        "RepairStrategy.primary = \"RECONSIDER_HYPOTHESIS\"",
      meaning:
        "Current fix hypothesis is wrong · repair loop must reconsider",
      authority_class: "NEX1_REPAIR_ENGINE" as const,
      routing_mode: "AUTO_ROUTE" as const,
      target_subsystem: "capability-repair-execution-loop",
      target_invocation_path:
        "src/lib/nex-agent/code-engine/capability-repair-execution-loop.ts",
      reason_code: "REPAIR_RECONSIDER_ROUTED",
      existing_route_active: true,
      evidence_required: ["repair_strategy"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 13 · Post-verdict Reflection · matched=false ──────────────
    Object.freeze({
      signal_id: "POST_VERDICT_REFLECTION_MATCHED_FALSE" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-post-verdict-reflection.ts",
      signal_source_symbol:
        "PredictionVerdictEntry.matched === false",
      meaning:
        "Prior verdict was wrong · consult specialists for structural analysis",
      authority_class: "NEX1_BRB_SPECIALIST" as const,
      routing_mode: "AUTO_ROUTE" as const,
      target_subsystem: "BRB neurologist / pathology / boundary_interface",
      target_invocation_path:
        "src/lib/nex-agent/code-engine/capability-post-verdict-reflection.ts",
      reason_code: "REFLECTION_SPECIALIST_CONSULT",
      existing_route_active: true,
      evidence_required: ["matched"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 14 · NEX1 mission handoff → NEX2 ──────────────────────────
    Object.freeze({
      signal_id: "NEX1_MISSION_HANDOFF_TO_NEX2" as const,
      signal_source_file:
        "src/lib/nex-agent-runtime/nex1/mission-context.ts",
      signal_source_symbol:
        "MissionContextChain.handoff.to = \"nex2\"",
      meaning:
        "NEX1-runtime03 mission closed with handoff to NEX2 review",
      authority_class: "NEX2_REVIEW" as const,
      routing_mode: "AUTO_ROUTE" as const,
      target_subsystem: "NEX2 review daemon",
      target_invocation_path:
        "src/lib/nex-agent-runtime/nex2/daemon.ts:tick loop (polls proposals)",
      reason_code: "MISSION_HANDOFF_NEX2",
      existing_route_active: true, // NEX2 daemon polls for these
      evidence_required: ["handoff_to"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 15 · NEX2 conflict → NEX3 ─────────────────────────────────
    Object.freeze({
      signal_id: "NEX2_CONFLICT_TO_NEX3" as const,
      signal_source_file: "src/lib/nex-agent-runtime/nex3/daemon.ts",
      signal_source_symbol:
        "CONFLICT_VERDICTS = { REJECTED_UNSAFE, REJECTED_INCOMPLETE_EVIDENCE, CONFLICT_WITH_NEX1 }",
      meaning:
        "NEX2 review issued a conflict verdict · NEX3 arbitration required",
      authority_class: "NEX3_ARBITRATION" as const,
      routing_mode: "AUTO_ROUTE" as const,
      target_subsystem: "NEX3 arbitration daemon",
      target_invocation_path:
        "src/lib/nex-agent-runtime/nex3/daemon.ts:tick loop (polls reviews)",
      reason_code: "NEX2_CONFLICT_ROUTED",
      existing_route_active: true,
      evidence_required: ["nex2_verdict"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 16 · Chat state · insufficient_input ──────────────────────
    Object.freeze({
      signal_id: "CHAT_STATE_INSUFFICIENT_INPUT" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-response-composer.ts",
      signal_source_symbol:
        "ChatConversationState = \"insufficient_input\"",
      meaning:
        "Not enough context to produce a decision · request more",
      authority_class: "COMPOSER_SURFACE" as const,
      routing_mode: "HOLD" as const,
      target_subsystem: "Composer surface · Founder input",
      target_invocation_path: null,
      reason_code: "INSUFFICIENT_INPUT_HOLD",
      existing_route_active: true,
      evidence_required: ["state"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 17 · Chat state · recall_insufficient ─────────────────────
    Object.freeze({
      signal_id: "CHAT_STATE_RECALL_INSUFFICIENT" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-response-composer.ts",
      signal_source_symbol:
        "ChatConversationState = \"recall_insufficient\"",
      meaning:
        "Recall query cannot be answered from current conversation state",
      authority_class: "COMPOSER_SURFACE" as const,
      routing_mode: "HOLD" as const,
      target_subsystem: "Composer surface · Founder input",
      target_invocation_path: null,
      reason_code: "RECALL_INSUFFICIENT_HOLD",
      existing_route_active: true,
      evidence_required: ["state"],
      registry_entry_version: "v1.2026-09-19",
    }),

    // ── 18 · Chat-turn → NEX1-runtime03 (NOT WIRED) ───────────────
    Object.freeze({
      signal_id: "CHAT_TURN_GOVERNED_PROPOSAL_TO_RUNTIME03" as const,
      signal_source_file:
        "src/lib/nex-agent/code-engine/capability-chat-turn.ts",
      signal_source_symbol:
        "(none — no existing signal produces this today)",
      meaning:
        "Chat-turn recognises the turn should become a governed engineering proposal · runtime03 must generate the proposal shape",
      authority_class: "NEX1_MISSION_DAEMON" as const,
      routing_mode: "NOT_READY" as const,
      target_subsystem:
        "NEX1-runtime03 · MissionContextBuilder · proposal generation",
      target_invocation_path: null, // No invocation contract exists today
      reason_code: "CROSS_SUBSYSTEM_CONTRACT_MISSING",
      existing_route_active: false,
      // Chat-turn does not produce diagnosis / proposed_fix_summary /
      // evidence_refs autonomously. Runtime03's MissionContextBuilder
      // produces those shapes. The two subsystems do not currently
      // communicate at runtime.
      evidence_required: [],
      registry_entry_version: "v1.2026-09-19",
    }),
  ]);

// ── Resolver ─────────────────────────────────────────────────────────

/**
 * Deterministic resolver. Given a signal context, return the routing
 * decision recorded in the registry. Pure. Same input → same output.
 * Never invokes the target subsystem.
 *
 * Governance invariants encoded in the return value:
 *   · founder_authority_preserved: true (always)
 *   · workstation_mutation: false (always)
 *   · router_only: true (always)
 *   · executable: true ONLY when routing_mode === "AUTO_ROUTE" AND
 *     all evidence_required fields are present in evidence.
 */
export function resolveEscalation(
  context: EscalationSignalContext,
): EscalationRoutingDecision {
  const entry = getRegistryEntry(context.signal_id);
  if (!entry) {
    return {
      registry_version: NEX1_ESCALATION_REGISTRY_VERSION,
      signal_id: "UNKNOWN",
      routing_mode: "INFORMATION_ONLY",
      authority_class: "NONE",
      target_subsystem: null,
      target_invocation_path: null,
      reason_code: "UNKNOWN_SIGNAL",
      executable: false,
      evidence_present: false,
      missing_evidence: [],
      founder_authority_preserved: true,
      workstation_mutation: false,
      router_only: true,
    };
  }

  const missing: string[] = [];
  for (const field of entry.evidence_required) {
    if (!(field in context.evidence)) missing.push(field);
  }
  const evidence_present = missing.length === 0;
  const executable =
    entry.routing_mode === "AUTO_ROUTE" && evidence_present;

  return {
    registry_version: NEX1_ESCALATION_REGISTRY_VERSION,
    signal_id: entry.signal_id,
    routing_mode: entry.routing_mode,
    authority_class: entry.authority_class,
    target_subsystem: entry.target_subsystem,
    target_invocation_path: entry.target_invocation_path,
    reason_code: entry.reason_code,
    executable,
    evidence_present,
    missing_evidence: Object.freeze([...missing]) as readonly string[],
    founder_authority_preserved: true,
    workstation_mutation: false,
    router_only: true,
  };
}

// ── Introspection helpers ────────────────────────────────────────────

export function listRegistrySignals(): readonly EscalationSignalId[] {
  return Object.freeze(
    NEX1_ESCALATION_REGISTRY.map((e) => e.signal_id),
  ) as readonly EscalationSignalId[];
}

export function getRegistryEntry(
  id: EscalationSignalId | string,
): EscalationRegistryEntry | null {
  return (
    NEX1_ESCALATION_REGISTRY.find((e) => e.signal_id === id) ?? null
  );
}

export function listSignalsByMode(
  mode: EscalationRoutingMode,
): readonly EscalationSignalId[] {
  return Object.freeze(
    NEX1_ESCALATION_REGISTRY.filter((e) => e.routing_mode === mode).map(
      (e) => e.signal_id,
    ),
  ) as readonly EscalationSignalId[];
}
