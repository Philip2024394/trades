// src/lib/nex/observatory-brain/contract.ts
//
// Founder Path A/B · ECO-1 · Observatory Brain contract.
//
// Continuously answers "is NEX operating at world-class standards?"
// with MEASURED metrics · not vibes. Every metric here has a durable
// data source · every doctrine violation is counted (target zero).
//
// The Observatory Brain is a CONSUMER of existing tables and event
// streams:
//   nex.action_audit          → action outcomes + doctrine #2
//   nex.moderation_event      → safety guardrail firings
//   nex.safety_audit_event    → destructive-action trail
//   nex.knowledge_gap         → gap engine surface
//   nex.retrieval_hit         → retrieval telemetry
//   nex.category_scorecard    → per-domain coverage
//   nex.question_variant      → coverage + freshness
// It NEVER writes to any of them — pure read.

// ═══════════════════════════════════════════════════════════════════
// Time window
// ═══════════════════════════════════════════════════════════════════

export type WindowPreset = "1h" | "24h" | "7d" | "30d";

export interface ObservatoryWindow {
  since: string;         // ISO timestamp
  until: string;         // ISO timestamp
  preset: WindowPreset;
}

// ═══════════════════════════════════════════════════════════════════
// Doctrine health (target: zero violations)
// ═══════════════════════════════════════════════════════════════════

export interface DoctrineHealth {
  /** Doctrine #1: orphan or postrationalised citations rejected by gate. */
  doctrine_1_gate_rejections: {
    total: number;
    orphan_citations: number;
    postrationalisation_suspected: number;
    memory_citations_reject: number;      // also Doctrine #4
    average_alignment_of_kept_claims?: number;
  };
  /** Doctrine #2: proposed actions rejected by authorization. */
  doctrine_2_action_rejections: {
    total_proposed: number;
    executed: number;
    rejected_schema: number;
    rejected_unknown_action: number;
    rejected_permission: number;
    rejected_guardrail: number;
    rejected_no_llm_rule: number;
  };
  /** Doctrine #3: web/vision/file evidence that stayed capped at evidence_provisional. */
  doctrine_3_trust_cap_violations: number;   // target 0
  /** Doctrine #4: memory citations attempted. */
  doctrine_4_memory_citation_attempts: number;
  /** Aggregate score in [0..1] · 1.0 = zero violations of any doctrine. */
  overall_score: number;
}

// ═══════════════════════════════════════════════════════════════════
// Groundedness (Gate v2 · alignment quality)
// ═══════════════════════════════════════════════════════════════════

export interface GroundednessMetrics {
  /** LLM rescue calls that produced a verified verdict. */
  verified_replies: number;
  /** LLM rescue calls that produced an honest UNKNOWN. */
  unverified_replies: number;
  /** Alignment score distribution (Gate v2). */
  alignment_min: number;
  alignment_p50: number;
  alignment_p95: number;
  alignment_max: number;
  /** Postrationalisation rate: rejected/verified where reason starts with postrationalisation. */
  postrationalisation_rate: number;         // 0..1
}

// ═══════════════════════════════════════════════════════════════════
// Coverage (Composition Pilot n=354 methodology)
// ═══════════════════════════════════════════════════════════════════

export interface DomainCoverage {
  domain: string;
  total_entities?: number;
  answered_question_variants: number;
  partially_answered: number;
  unknown: number;
  coverage_ratio: number;                    // answered / (answered + unknown)
  open_gap_count: number;
  freshness_stale_ratio?: number;            // rows past freshness TTL
}

/**
 * Founder OBS-4 · per-domain drill-down of the top open knowledge_gap
 * rows so the founder can see at a glance which entities are starving
 * for facts. Rows are ranked by times_seen desc (customer demand).
 */
export interface DomainGapDrillDown {
  domain: string;
  open_gap_count: number;
  oldest_open_age_days?: number;
  top_gaps: readonly {
    entity_ref: string;
    intent_slug: string;
    times_seen: number;
    first_seen_at: string;
    last_seen_at: string;
    source: string;
  }[];
}

// ═══════════════════════════════════════════════════════════════════
// Latency + cost (composition-first discipline monitor)
// ═══════════════════════════════════════════════════════════════════

export interface LatencyMetrics {
  adapter_promoted_ratio: number;            // target ≥ 0.90 for accommodation
  composer_accepted_ratio: number;
  rescue_fired_ratio: number;
  research_fired_ratio: number;
  llm_invoked_ratio: number;                  // target < 0.05 per Composition Pilot
  adapter_p50_ms?: number;
  composer_p50_ms?: number;
  rescue_p50_ms?: number;
  research_p50_ms?: number;
  end_to_end_p50_ms?: number;
  end_to_end_p95_ms?: number;
}

// ═══════════════════════════════════════════════════════════════════
// Snapshot
// ═══════════════════════════════════════════════════════════════════

export interface ObservatorySnapshot {
  window: ObservatoryWindow;
  emitted_at: string;
  doctrine_health: DoctrineHealth;
  groundedness: GroundednessMetrics;
  domain_coverage: readonly DomainCoverage[];
  /** Founder OBS-4 · per-domain top open gaps by customer demand. */
  domain_gaps: readonly DomainGapDrillDown[];
  latency: LatencyMetrics;
  /** Free-form notes surfacing anything anomalous · never suppresses signal. */
  alerts: readonly { severity: "info" | "warning" | "critical"; category: string; message: string }[];
}

// ═══════════════════════════════════════════════════════════════════
// Facade
// ═══════════════════════════════════════════════════════════════════

export interface ObservatoryBrainFacade {
  name: string;
  snapshot(window: WindowPreset): Promise<ObservatorySnapshot>;
}
