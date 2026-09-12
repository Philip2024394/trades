// src/lib/nex/live-chat-completion/contract.ts
//
// Founder BEGIN 2026-09-09 · LIVE CHAT COMPLETION · domain-neutral contract.
//
// Every category (accommodation · food · markets · transport · business · ...)
// implements this same contract. The chat route classifies the turn to a
// domain, hands to that adapter, promotes the composed reply when the
// adapter honestly answered. Otherwise the legacy path takes over.
//
// The contract deliberately does NOT model retrieval, storage, or ranking —
// each adapter owns those concerns. The contract only shapes what the chat
// route needs to decide whether to promote: an answered/unanswered verdict,
// a trust layer, a tri-state {known · unknown · requested} claim ledger,
// and a natural-language reply body.
//
// Zero LLM. Every rendering step is deterministic.

// ═══════════════════════════════════════════════════════════════════
// Domains
// ═══════════════════════════════════════════════════════════════════

export type Domain =
  | "accommodation"
  | "food"
  | "markets"
  | "transport"
  | "business"
  | "travel"
  | "attractions"
  | "code"
  | "unknown";

/**
 * Founder BEGIN Phase 2 2026-09-09 · Every active category has its own master +
 * workers. This list is the source of truth for the master rulebook seeder,
 * the observatory, and the scheduler. `unknown` and `master_ai_engineer` are
 * NOT categories — they route separately.
 *
 * Founder BEGIN 2026-09-10 · "code" added as a domain. NEX1 is the
 * software-engineering role of NEX · programming is a domain OF NEX,
 * not a separate language system owned by NEX1.
 */
export const ACTIVE_CATEGORIES: readonly Exclude<Domain, "unknown">[] = Object.freeze([
  "accommodation",
  "food",
  "markets",
  "transport",
  "business",
  "travel",
  "attractions",
  "code",
]);

// ═══════════════════════════════════════════════════════════════════
// Trust ladder (domain-neutral · matches accommodation fact-computer TrustLayer)
// ═══════════════════════════════════════════════════════════════════

export type TrustBand =
  | "canonical_verified"    // Row column present AND provenance trust_layer is verified
  | "canonical_unverified"  // Row column present but weak provenance
  | "evidence_verified"     // From evidence with confidence ≥ 0.7
  | "evidence_provisional"  // From evidence with confidence 0.4-0.7
  | "unknown"               // Nothing verified · Gap Engine candidate
  | "clarify"               // Composer asked for clarification instead of answering
  | "mixed";                // Multi-property or composite: some verified, some not

// ═══════════════════════════════════════════════════════════════════
// Reply kinds (domain-neutral)
// ═══════════════════════════════════════════════════════════════════

export type ReplyKind =
  | "fact"                // Single fact about one entity
  | "list"                // A list of verified entities (kills "Yep — found N")
  | "list_reference"      // Fact about the Nth item of a prior list
  | "multi_property_list" // Same fact rendered for each property in a prior list
  | "clarify"             // Composer needs more info
  | "unknown"             // Composer honestly has no verified answer
  | "availability_unknown" // We have the entities, but not live availability
  | "research_needed"     // Handoff signal for search adapter
  | "unsupported";        // Not answerable by this domain (route elsewhere)

// ═══════════════════════════════════════════════════════════════════
// Tri-state claim ledger (Founder demand: known / unknown / requested)
// ═══════════════════════════════════════════════════════════════════

/**
 * One structured claim the composer used (or wanted to use) to build its
 * reply. The reply is honest when every rendered claim appears here.
 * Empty arrays are honest too — "we have nothing verified" is a claim.
 */
export interface ReplyClaim {
  /** Short label for the fact (e.g. "hotels_in_city", "wifi", "rooms"). */
  kind: string;
  /** Optional entity the claim is about (business_ref · canonical name · null for aggregate). */
  entity_ref?: string | null;
  /** The rendered value used in the reply (string form). Never the raw storage row. */
  value?: string;
  /** Trust band this claim sits at. Composite claims round down. */
  trust: TrustBand;
}

// ═══════════════════════════════════════════════════════════════════
// The Reply shape (what an adapter returns to the chat route)
// ═══════════════════════════════════════════════════════════════════

export interface AdapterReply {
  /** True → composer produced a substantive answer. False → clarify/unknown/unsupported. */
  answered: boolean;
  /** The user-visible reply text. Deterministic. Never fabricated. */
  reply_text: string;
  reply_kind: ReplyKind;
  /** Overall trust of the reply. Composite = lowest band across claims. */
  trust: TrustBand;
  /** Which intent slug the adapter classified. */
  intent_slug: string | null;
  /** Which entity the reply is about, if any (e.g. a listing ref). */
  entity_ref: string | null;
  /** Tri-state ledger: facts we DID use to build the reply. */
  known: readonly ReplyClaim[];
  /** Tri-state ledger: facts the user asked about but we do not have. */
  unknown: readonly ReplyClaim[];
  /**
   * Tri-state ledger: facts the user REQUESTED that we cannot compute at all
   * from stored data (e.g. "tomorrow's availability" · live pricing).
   * Distinct from `unknown` — this is scope-of-system, not gaps.
   */
  requested: readonly ReplyClaim[];
  /** Debug trace lines the chat route may attach to _debug_timings. Never shown to user. */
  reasoning: readonly string[];
  /** Per-adapter latency for the compose call. Excludes network + storage bootstrap. */
  latency_ms: number;
  /**
   * Founder BEGIN Phase 3.1 · when the adapter rendered a list of entities,
   * it MAY return the entities so the chat route can register a result_set
   * (nex.result_set) for the conversation. Follow-up filters use it.
   */
  list_rendered?: {
    intent_slug: string;
    entity_refs: readonly string[];
    city: string | null;
    category: string | null;
    render_summary: string | null;
  };
  /**
   * Optional performance breakdown for observability. Never affects reply.
   */
  perf?: {
    fingerprint_hit?: boolean;
    hot_tier_hit?: boolean;
    postgres_ms?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// What the chat route hands to the adapter (turn input)
// ═══════════════════════════════════════════════════════════════════

export interface AdapterTurnInput {
  /** The raw user message. */
  message: string;
  /** Language hint from upstream. Adapters fall back to "en". */
  language: "en" | "id";
  /** Prior-turn list of entities the chat brain has already surfaced. Used for follow-ups. */
  prior_entities: readonly {
    entity_ref: string;
    display_name: string;
    /** Free-form category tag ("hotel", "villa"...) — informational only. */
    category?: string;
  }[];
  /** Conversation id — adapters may keep per-conversation state (e.g. current focus). */
  conversation_id: string | null;
  /** The chat brain's classified intent, if it produced one. Adapters may ignore. */
  chat_brain_intent: string | null;
  /** The chat brain's own reply text — the fallback we might promote past. */
  chat_brain_reply_text: string;
  /** Chat brain world_cards list count — signals discovery-vs-fact turn. */
  chat_brain_world_cards_count: number;
  /**
   * Founder BEGIN Phase 3.1 · pre-adapter turn interpretation.
   * When present, the conversation-brain turn interpreter has already
   * classified this turn (fragment · follow-up · new topic) and resolved
   * an entity/list context from durable conversation state.
   */
  turn_plan?: {
    classification:
      | "new_topic"
      | "follow_up_on_entity"
      | "follow_up_on_list"
      | "fragment"
      | "clarification"
      | "topic_switch";
    inferred_intent_slug: string | null;
    resolved_entity_ref: string | null;
    resolved_ordinal?: number | null;
    result_set?: {
      result_set_id: string;
      entity_refs: readonly string[];
      city: string | null;
      category: string | null;
      intent_slug: string;
    } | null;
    list_filter?: { fact_slug: string; expected: unknown };
    ambiguous?: boolean;
    ambiguity_reason?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════
// The DomainAdapter interface (one implementation per domain)
// ═══════════════════════════════════════════════════════════════════

export interface DomainAdapter {
  domain: Domain;
  /**
   * True if this adapter can answer the given turn. Cheap check — no
   * storage lookups. Used by the router before compose() is called.
   */
  canHandle(input: AdapterTurnInput): Promise<boolean> | boolean;
  /**
   * Produce a reply from stored facts. Never fabricates. Never invokes LLM.
   * Must fill known / unknown / requested honestly.
   */
  compose(input: AdapterTurnInput): Promise<AdapterReply>;
}

// ═══════════════════════════════════════════════════════════════════
// Helpers the chat route uses to decide "promote or fall back"
// ═══════════════════════════════════════════════════════════════════

const VERIFIED_BANDS = new Set<TrustBand>(["canonical_verified", "evidence_verified"]);
const PROMOTABLE_KINDS = new Set<ReplyKind>([
  "fact",
  "list",
  "list_reference",
  "multi_property_list",
  "availability_unknown",
  // "unknown" is promotable only when entity_ref is set — an honest
  // "I don't have that on record for <specific entity> yet" IS an answer.
  // The rule is applied in shouldPromoteReply, not by set membership alone.
]);

/**
 * Founder rule: promote when the adapter honestly answered AND its trust
 * clears the verified bar AND the reply_kind is one that renders a real
 * answer. availability_unknown IS promotable — telling the customer we
 * cannot verify live availability IS a real, honest answer. unknown IS
 * promotable when entity_ref is set — that's an honest per-entity "we don't
 * have that fact yet" answer.
 */
export function shouldPromoteReply(reply: AdapterReply): { promote: boolean; reason: string } {
  if (!reply.answered) return { promote: false, reason: "adapter_did_not_answer" };
  if (!reply.reply_text || reply.reply_text.trim().length === 0) {
    return { promote: false, reason: "empty_reply_text" };
  }
  // Honest per-entity unknown → promote. Trust is "unknown" by definition.
  if (reply.reply_kind === "unknown" && reply.entity_ref) {
    return { promote: true, reason: "unknown_for_resolved_entity_is_honest" };
  }
  // Founder BEGIN Phase 3.1 · fact with resolved entity ALWAYS promotes.
  // Legacy discovery_hit ("Yep — found 3") must never win over an adapter
  // fact reply against a specific entity. Trust band is already reported
  // in the reply itself so the UI can badge it.
  if (reply.reply_kind === "fact" && reply.entity_ref) {
    return { promote: true, reason: `fact_for_resolved_entity_trust=${reply.trust}` };
  }
  if (!PROMOTABLE_KINDS.has(reply.reply_kind)) {
    return { promote: false, reason: `reply_kind_not_promotable:${reply.reply_kind}` };
  }
  // availability_unknown carries mixed/canonical_verified trust honestly — allow.
  if (reply.reply_kind === "availability_unknown") return { promote: true, reason: "availability_unknown_is_honest" };
  // list_reference and multi_property_list: promote if trust is verified OR
  // the adapter explicitly answered — the composer only produces these when
  // there's real content behind them.
  if ((reply.reply_kind === "list_reference" || reply.reply_kind === "multi_property_list") && reply.answered) {
    return { promote: true, reason: `${reply.reply_kind}_promoted` };
  }
  if (!VERIFIED_BANDS.has(reply.trust)) {
    return { promote: false, reason: `trust_below_verified:${reply.trust}` };
  }
  return { promote: true, reason: "promoted" };
}

/**
 * Package the promotion decision for _debug_timings. Never returns raw
 * reply text — that's already in composed.reply.
 */
export interface PromotionRecord {
  attempted: boolean;
  accepted: boolean;
  reason: string;
  domain: Domain;
  intent_slug: string | null;
  reply_kind?: ReplyKind;
  trust?: TrustBand;
  known_count?: number;
  unknown_count?: number;
  requested_count?: number;
  latency_ms?: number;
}

// ═══════════════════════════════════════════════════════════════════
// Founder BEGIN Phase 2 · Knowledge Factory contracts
//
// The permanent knowledge-factory shape. Accommodation is the reference
// implementation. Every other category implements the same interfaces so
// adding food/markets/transport/business/travel/attractions is a
// per-category adapter, NOT an architectural change.
//
// Every generator/verifier/gap/worker is:
//   - domain-scoped (§25 category independence)
//   - idempotent (§14 crash resilience)
//   - checkpointed (worker crash mid-batch is safe)
//   - governed (§17 storage, §18 generation)
//   - observable (§12 heartbeat, §19 scorecard)
// ═══════════════════════════════════════════════════════════════════

/**
 * A short deterministic label + typed payload for the intent classification
 * that the question generator produced. Kept small — real intent definitions
 * live in per-domain intent registries.
 */
export interface CandidateIntent {
  intent_slug: string;
  /** Which structured facts the composer will need to answer this question. */
  required_fact_slugs: readonly string[];
}

/**
 * One generated question variant. Stored in nex.question_variant. Never
 * contains a composed answer — the composer produces answers from
 * canonical facts at read time.
 */
export interface QuestionVariant {
  /** Deterministic fingerprint over normalised text · domain · entity_ref · intent. */
  fingerprint: string;
  domain: Domain;
  entity_ref: string;
  intent_slug: string;
  /** Free-form as authored (e.g. "Does Grand Aston have wifi?"). */
  raw_text: string;
  /** Whitespace-collapsed lower-case punctuation-stripped form. */
  normalised_text: string;
  language: "en" | "id";
  required_fact_slugs: readonly string[];
  /** Where this variant came from — the generator's rulebook or a real user turn. */
  source: "template" | "user_turn" | "gap_backfill" | "conversation_followup";
}

export type QuestionAnswerStatus =
  | "candidate"           // Just generated, not yet verified
  | "answered"            // Verifier resolved it to a canonical fact
  | "partially_answered"  // Answered but with weak trust
  | "unknown"             // Verifier confirmed we have no data
  | "conflicting"         // Verifier found ≥ 2 canonical facts disagreeing
  | "unsupported"         // Out of scope (e.g. live availability)
  | "stale";              // Was answered but source_ref past freshness ttl

export interface VerificationResult {
  fingerprint: string;
  answer_status: QuestionAnswerStatus;
  trust: TrustBand;
  reply_kind: ReplyKind;
  /** Fact refs that resolved the question. Empty when unknown/unsupported. */
  supporting_fact_refs: readonly string[];
  /** Composer text produced during verification. NOT stored — used only to prove the loop. */
  composed_preview?: string;
  latency_ms: number;
  verified_at: string; // ISO
}

/**
 * The question factory. Every domain has one. Runs continuously.
 */
export interface QuestionGenerator {
  domain: Domain;
  /**
   * Generate a batch of candidate variants. Batch size respects the
   * generation governor (§18) — the generator MAY return fewer if governor
   * says so. Each call is idempotent: repeated calls with the same cursor
   * produce the same fingerprints, existing rows are UPSERTed.
   */
  generateBatch(input: {
    max_variants: number;
    cursor?: string | null;
  }): Promise<{
    variants: readonly QuestionVariant[];
    next_cursor: string | null;
    exhausted: boolean;
    generation_notes: readonly string[];
  }>;
}

/**
 * The verifier. Pulls candidates and resolves them via the domain adapter.
 * Never invokes an LLM. Never fabricates. If the adapter honestly cannot
 * answer, records "unknown" and enqueues a knowledge_gap.
 */
export interface QuestionVerifier {
  domain: Domain;
  verifyBatch(input: {
    max_variants: number;
  }): Promise<{
    results: readonly VerificationResult[];
    remaining_candidates: number;
  }>;
}

/**
 * The knowledge-gap queue. Fed by live-chat unknown replies AND by the
 * verifier's own honest unknown verdicts. Workers pull from this queue.
 */
export interface KnowledgeGapQueue {
  /**
   * Idempotent enqueue keyed on (domain, entity_ref, intent_slug). Repeat
   * calls increment `times_seen` and refresh `last_seen_at` without
   * duplicating the row.
   */
  enqueue(input: {
    domain: Domain;
    entity_ref: string;
    intent_slug: string;
    source: "live_chat" | "verifier" | "conflict_resolver" | "freshness_worker";
    source_conversation_id?: string | null;
  }): Promise<{ gap_id: string; created: boolean }>;
  /** Pull open gaps in priority order. Filters by domain when set. */
  pull(input: { domain?: Domain; limit: number }): Promise<readonly {
    gap_id: string;
    domain: Domain;
    entity_ref: string;
    intent_slug: string;
    times_seen: number;
    first_seen_at: string;
  }[]>;
  /** Mark a gap as resolved by a specific fact ref. Idempotent. */
  resolve(input: {
    gap_id: string;
    resolution_fact_ref: string;
    resolved_by: "verifier" | "master_ai_engineer" | "freshness_worker";
  }): Promise<void>;
}

/**
 * The hot lookup on the live chat path. Given a normalised question,
 * returns a fingerprint hit + its verified answer status. Adapter uses
 * this BEFORE running the full parse → resolve → compose pipeline.
 */
export interface HotKnowledgeIndex {
  domain: Domain;
  /** Returns a hit only when the question is answered at verified trust. */
  lookup(input: {
    normalised_text: string;
    language: "en" | "id";
  }): Promise<{
    fingerprint: string;
    entity_ref: string;
    intent_slug: string;
    required_fact_slugs: readonly string[];
    answer_status: QuestionAnswerStatus;
    trust: TrustBand;
  } | null>;
}

/**
 * Persisted per-category mission. Every worker (and the master engineer)
 * consults this every loop iteration. Not a database of instructions — a
 * single row per category with the concrete targets and the doctrine text.
 */
export interface MasterRuleBook {
  domain: Domain;
  mission_text: string;
  /** Long-term coverage milestone. §3 · 1,000,000+ per category. */
  question_variant_target: number;
  /** Coverage % below which the master should prioritise generation. */
  minimum_coverage_pct: number;
  /** Duplicate rate that triggers governor pause. §18. */
  duplicate_rate_threshold_pct: number;
  /** Storage growth (bytes/hour) that triggers governor pause. §17. */
  storage_growth_bytes_per_hour_threshold: number;
  /** Bounded retry — a worker that fails N times in a row is isolated. */
  bounded_retry_max: number;
  updated_at: string; // ISO
}

/**
 * The public scorecard for a category. Computed from live state at every
 * observatory read — the row is NOT the source of truth, it's a cache.
 */
export interface CategoryScorecard {
  domain: Domain;
  entities: number;
  canonical_facts: number;
  question_variants: number;
  answered: number;
  partially_answered: number;
  unknown: number;
  conflicting: number;
  stale: number;
  open_gaps: number;
  question_variant_target: number;
  coverage_pct: number;              // question_variants / target × 100
  answered_pct: number;              // answered / question_variants × 100
  generation_throughput_per_hour: number | null;
  verification_throughput_per_hour: number | null;
  live_chat_deterministic_hit_rate_pct: number | null;
  live_chat_p50_ms: number | null;
  live_chat_p95_ms: number | null;
  live_chat_p99_ms: number | null;
  last_updated_at: string; // ISO
}

/**
 * Worker liveness snapshot. §12. Every worker writes one row every loop.
 * A stale heartbeat is detected by the supervisor by comparing `updated_at`
 * to now — do not trust `state` alone.
 */
export interface WorkerHealth {
  worker_id: string;
  domain: Domain;
  worker_kind:
    | "question_generator"
    | "question_verifier"
    | "gap_resolver"
    | "freshness_worker"
    | "master_engineer";
  state: "RUNNING" | "IDLE" | "PAUSED" | "DEGRADED" | "FAILED" | "RECOVERING";
  current_task: string | null;
  last_success_at: string | null; // ISO
  last_failure_at: string | null; // ISO
  tasks_completed: number;
  tasks_failed: number;
  queue_depth: number;
  updated_at: string;             // ISO — supervisor uses this to detect staleness
}
