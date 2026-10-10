// src/lib/nex/failure-governance/types.ts
//
// UWI · Wave 6 · Failure taxonomy + human-authority governance types.
// Founder-authorised programme.
//
// Rule 5k discipline · TWO SEPARATE typed failure taxonomies:
//   - 20 durability failure modes (CRII-A) at durability layer
//   - 13 research failure classes (CRII-C) at research layer
// These MUST NOT be merged into a single "33-class" taxonomy — they
// live at different architectural layers and drive different responses.

// ═══ 20-mode durability failure taxonomy (CRII-A) ══════════════════
// Substrate failures — infrastructure / execution level. Handled by
// the durability substrate (Wave 2 primitives). Each maps to a
// preventing primitive in Wave 2 §5 (documented per code comment).
export type DurabilityFailureMode =
  | "worker_crash"                     // → lock-heartbeat + reaper
  | "machine_restart"                  // → durable-queue rehydration
  | "network_partition"                // → circuit breaker + retry
  | "disk_full"                        // → capacity alarm
  | "out_of_memory"                    // → supervisor restart + backpressure
  | "deadlock"                         // → timeout + kill
  | "lock_timeout"                     // → heartbeat + lease
  | "clock_skew"                       // → NTP + tolerant windows
  | "replay_divergence"                // → deterministic workflow discipline
  | "idempotency_key_collision"        // → key-scheme review
  | "schema_migration_mid_flight"      // → schema-version check
  | "queue_backlog"                    // → backpressure + drop policy
  | "consumer_lag"                     // → autoscale + prioritisation
  | "poison_message"                   // → DLQ + operator review
  | "downstream_unavailable"           // → circuit breaker + fallback
  | "authentication_expired"           // → rotation + auto-refresh
  | "quota_exhausted"                  // → cost cap + adaptive rate
  | "configuration_drift"              // → config-snapshot detector
  | "dependency_version_mismatch"      // → pinned deps + audit
  | "unknown";                         // → explicit UNCLASSIFIED state

// ═══ 13-class research failure taxonomy (CRII-C) ═══════════════════
// Outcome failures — research-layer level. Every failure becomes a
// typed RESEARCH_EVENT for the research-memory to learn from. Never
// silence.
export type ResearchFailureClass =
  | "no_sources"                       // → capability-gap record
  | "source_unavailable"               // → source-health event · reliability drops
  | "crawl_blocked"                    // → access-policy event · escalate to human
  | "insufficient_evidence"            // → hypothesis stays UNVALIDATED · retry wider net
  | "conflicting_evidence"             // → opportunity contradicting_signals[] · escalate if unresolved
  | "stale_evidence"                   // → freshness refresh
  | "duplicate_evidence"               // → dedup cascade
  | "malformed_source"                 // → parser-defect · reliability drops
  | "research_timeout"                 // → cost event · scope reduction
  | "worker_failure"                   // → infrastructure event · NOT a research failure
  | "quota_exhausted"                  // → rate-planning event
  | "infrastructure_failure"           // → ops event · not attributed to research
  | "unclassified";                    // → explicit UNCLASSIFIED · never silently coerced

// ═══ Human-authority boundary ══════════════════════════════════════
// Transitions requiring human authority (CRII synthesis §16 · founder-
// locked). Every such transition writes an HMAC-signed promotion event
// via existing ADR-0304 §5 `nex_lab.promotion_events` machinery.
export type HumanAuthorityAction =
  // Idea lifecycle
  | "idea.built"                       // NEW → BUILT · production change
  | "idea.rejected"                    // NEW → REJECTED · commercial commitment
  | "idea.merged"                      // NEW → MERGED (absorbed into another)
  | "idea.superseded"                  // NEW → SUPERSEDED (better idea replaces)
  // Opportunity lifecycle
  | "opportunity.promoted"             // → PROMOTED · promotion from lab to build track
  | "opportunity.rejected"             // → REJECTED (formal decision, not decay)
  | "opportunity.merged"               // → MERGED (absorbed into another)
  | "opportunity.superseded"           // → SUPERSEDED (better opportunity replaces)
  // Substrate-level
  | "source.new_allowlist_entry"       // Adding a source not previously allowlisted
  | "governance.new_data_category"     // New data-collection category
  | "governance.production_change"     // Any production change originating from lab
  | "governance.architecture_change";  // Major architecture change

// Autonomous transitions (no human authority needed) — enumerated for
// completeness so future callers can assert action is autonomous.
export type AutonomousAction =
  | "opportunity.discovered"
  | "opportunity.evidence_gathered"
  | "opportunity.validated"
  | "opportunity.moved_to_active"
  | "opportunity.moved_to_monitoring"
  | "opportunity.declining"
  | "opportunity.parked"          // reversible; wake from park is also autonomous
  | "opportunity.woke_from_park"
  | "opportunity.archived_after_absorbing"
  | "novelty.scored"
  | "dedup.cascade_layer_1_to_5"
  | "signal.detected"
  | "hypothesis.generated";

// ═══ Typed failure event (M25) ═════════════════════════════════════
export interface DurabilityFailureEvent {
  readonly layer: "durability";
  readonly failure_mode: DurabilityFailureMode;
  readonly at_iso: string;
  readonly worker_id: string | null;
  readonly job_id: string | null;
  readonly detail: string;
  readonly context: Readonly<Record<string, unknown>>;
}

export interface ResearchFailureEvent {
  readonly layer: "research";
  readonly failure_class: ResearchFailureClass;
  readonly at_iso: string;
  readonly workflow_id: string | null;
  readonly source: string | null;
  readonly source_class: string | null;
  readonly opportunity_id: string | null;
  readonly detail: string;
  readonly context: Readonly<Record<string, unknown>>;
}

export type TypedFailureEvent = DurabilityFailureEvent | ResearchFailureEvent;

// ═══ Human-authority signed decision (M26) ═════════════════════════
export interface HumanAuthoritySignedDecision {
  readonly action: HumanAuthorityAction;
  readonly target_id: string;                  // e.g. opportunity_id / idea_id
  readonly approved_by_user_id: string;
  readonly approved_at_iso: string;
  readonly rationale: string;
  readonly signature_hmac_sha256: string;
  readonly context: Readonly<Record<string, unknown>>;
}

export class HumanAuthorityRequiredError extends Error {
  constructor(public readonly action: HumanAuthorityAction, public readonly target_id: string) {
    super(`Human authority required for action '${action}' on target '${target_id}'. Autonomous execution rejected — obtain an HMAC-signed decision first.`);
    this.name = "HumanAuthorityRequiredError";
  }
}

export class HumanAuthoritySignatureInvalidError extends Error {
  constructor(public readonly action: HumanAuthorityAction, public readonly target_id: string, public readonly reason: string) {
    super(`Human authority signature invalid for action '${action}' on target '${target_id}': ${reason}`);
    this.name = "HumanAuthoritySignatureInvalidError";
  }
}

// ═══ Compile-time refusal to merge the two taxonomies ═════════════
// Any function that accepts both a DurabilityFailureMode AND a
// ResearchFailureClass in the same slot is a Rule 5k violation.
// If you find yourself needing to write `type AllFailures = A | B`,
// STOP and re-read Rule 5k.

export class TaxonomyMergingProhibitedError extends Error {
  constructor(caller: string) {
    super(`Rule 5k violation: attempt to merge 20-mode durability + 13-class research taxonomies in '${caller}'. The two taxonomies live at different architectural layers · never combine into a single 33-class enum.`);
    this.name = "TaxonomyMergingProhibitedError";
  }
}
