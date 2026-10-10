// src/lib/nex-agent/code-engine/capability-retention-model.ts
//
// NEX · Internet as External Knowledge Substrate · Retention Model
// Founder-authorised 2026-09-21.
//
// PURPOSE
//
//   This module encodes the founder's engineering invariant:
//
//     THE INTERNET IS NEX'S EXTERNAL, LIVE KNOWLEDGE SUBSTRATE.
//     THE INTERNET IS NOT NEX'S INTELLIGENCE.
//     NEX DOES NOT NEED TO COPY THE WORLD TO UNDERSTAND THE WORLD.
//
//   Concretely: NEX distinguishes FOUR knowledge kinds that must NEVER
//   become one undifferentiated database. Every retrieved item flows
//   through a five-stage lifecycle where its identity — how confirmed,
//   how retained, how sourced — remains inspectable at every stage.
//
//   The module itself is pure declarative structure (types + one const
//   table). It changes no behaviour. Downstream capabilities consume
//   these definitions so that decisions like "should this be retained?"
//   or "how fresh must this be?" reference a single canonical shape.
//
// ANTI-CHEATING GUARANTEE
//
//   · No behaviour lives here. This is doctrine, not policy.
//   · No LLM call, no network, no I/O.
//   · The four kinds and five lifecycle stages are declared in ONE
//     canonical table; TypeScript enforces the union types.
//   · Adding a knowledge kind or a lifecycle stage is a governance
//     action (one edit to this file, breaks TypeScript everywhere
//     downstream — deliberately loud).
//
// RELATION TO EXISTING CAPABILITIES
//
//   · capability-evidence-status.ts already models source + reliability
//     + disagreements — this module adds the orthogonal axes of
//     KNOWLEDGE_KIND and LIFECYCLE_STAGE without changing the envelope.
//   · capability-conversation-context.ts already stores personal/project
//     knowledge (findings, decisions, mutations, verifications) — this
//     module names that kind: PERSONAL_PROJECT.
//   · capability-know-or-look.ts (K17.3) consumes KNOWLEDGE_KIND to
//     answer "do I already know?" honestly.
//   · capability-selective-retention.ts (K17.7) uses LIFECYCLE_STAGE +
//     RetentionSignal to decide whether an EVALUATED item earns the
//     terminal NEX_RETAINED stage.

// ── The four knowledge kinds ────────────────────────────────────────────
//
// These MUST NEVER blur. A single row in a store can belong to exactly
// one kind. Cross-kind aggregation happens at read time via explicit
// composition — never by conflating stores.

export type NexKnowledgeKind =
  | "PERSONAL_PROJECT"     // user's conversations · projects · preferences · decisions · corrections
  | "WORLD"                // externally-available public information (weather · coordinates · gov data)
  | "CURRENT_EVIDENCE"     // retrieved for THIS turn only · may or may not be retained
  | "LEARNED_ABSTRACTION"; // a reusable pattern derived from experience · earned, not assumed

export interface KnowledgeKindDefinition {
  readonly kind: NexKnowledgeKind;
  readonly what: string;
  readonly examples: readonly string[];
  readonly canonical_store: string;   // file:table where this kind lives
  readonly ownership: "nex" | "world";
  readonly retention_default: "retained_forever" | "retained_selectively" | "transient_only" | "never_stored";
}

export const KNOWLEDGE_KIND_TABLE: readonly KnowledgeKindDefinition[] = [
  {
    kind: "PERSONAL_PROJECT",
    what: "Information NEX has intentionally retained about the user's conversations, projects, preferences, decisions, corrections, and ongoing work.",
    examples: [
      "\"always show me the source\" preference (K14)",
      "recorded decision \"we ripped out the old auth middleware\"",
      "prior finding that computeEvidenceStatus is defined in capability-evidence-status.ts",
      "user correction \"actually I meant the safety boundary\"",
    ],
    canonical_store: "capability-conversation-context.ts · ConversationHead + Nex1ChatTurn[]",
    ownership: "nex",
    retention_default: "retained_forever",
  },
  {
    kind: "WORLD",
    what: "Information available externally from permitted public sources. NEX does not own this. NEX reaches for it when the current turn needs it.",
    examples: [
      "current Jakarta weather (BMKG)",
      "coordinates of Bandung (Nominatim + Wikidata + Overpass)",
      "current opening hours of a public building",
      "current price of a currency pair",
    ],
    canonical_store: "external · not NEX-owned · reached via allowlisted providers",
    ownership: "world",
    retention_default: "transient_only",
  },
  {
    kind: "CURRENT_EVIDENCE",
    what: "Information retrieved during THIS turn from a WORLD source. Lives in the evidence envelope for the turn. May be promoted to LEARNED_ABSTRACTION or PERSONAL_PROJECT by explicit selective-retention rule, otherwise discarded when the turn closes.",
    examples: [
      "the actual 25°C figure returned by BMKG at 12:34 UTC for this turn",
      "the -8.2271,115.1919 coordinate returned by Nominatim for \"Bali\" this turn",
      "the disagreement note that Nominatim + Wikidata differed by 37km on Bali",
    ],
    canonical_store: "capability-evidence-status.ts · EvidenceStatus (per turn) · never persisted by default",
    ownership: "nex",
    retention_default: "transient_only",
  },
  {
    kind: "LEARNED_ABSTRACTION",
    what: "A reusable pattern earned through repeated experience: which source answers a class of questions well, which source disagrees, which information class needs fresh retrieval, which is stable. Never a raw external fact.",
    examples: [
      "\"Nominatim answers 'coordinates of <major city>' with agreement rate 95% over 42 turns\"",
      "\"BMKG weather requires no User-Agent header (403 otherwise)\"",
      "\"Wikidata + Nominatim typically agree on major-city coordinates within 5km\"",
    ],
    canonical_store: "capability-source-outcome-ledger.ts · SourceOutcomeLedger",
    ownership: "nex",
    retention_default: "retained_selectively",
  },
];

// ── The five-stage retrieval lifecycle ──────────────────────────────────
//
// Every WORLD-kind item that enters NEX follows this sequence. Its
// stage identity is preserved at every step. Retrieved is NOT Evidence
// is NOT Evaluated is NOT Confirmed is NOT Retained. The lifecycle
// makes the distinction inspectable — a downstream reader can always
// ask "at what stage is this item?" and get a truthful answer.

export type RetrievalLifecycleStage =
  | "EXTERNAL_RETRIEVED"   // fetch completed · raw response received · not yet interpreted
  | "EVIDENCE"             // response accepted as EvidenceSource · provenance recorded
  | "EVALUATED"            // per-turn evaluator ran (agreement/disagreement/insufficient)
  | "CONFIRMED"            // authoritative source + no disagreement + no failure → FACT ✓
  | "NEX_RETAINED";        // selective-retention rules fired · item earned durable storage

export interface RetrievalLifecycleDefinition {
  readonly stage: RetrievalLifecycleStage;
  readonly what: string;
  readonly implies_permanent_storage: boolean;
  readonly required_provenance_fields: readonly (
    | "source_identifier"
    | "retrieved_at_iso"
    | "url_or_query"
    | "reliability_tier"
    | "duration_ms"
    | "evaluation_verdict"
    | "retention_reason"
  )[];
}

export const RETRIEVAL_LIFECYCLE_TABLE: readonly RetrievalLifecycleDefinition[] = [
  {
    stage: "EXTERNAL_RETRIEVED",
    what: "Fetch to a permitted allowlisted source completed. Raw response bytes received. Zero interpretation yet.",
    implies_permanent_storage: false,
    required_provenance_fields: ["source_identifier", "retrieved_at_iso", "url_or_query", "duration_ms"],
  },
  {
    stage: "EVIDENCE",
    what: "Response accepted as a valid EvidenceSource · added to EvidenceStatus.sources[] · reliability tier consulted from SOURCE_RELIABILITY registry.",
    implies_permanent_storage: false,
    required_provenance_fields: ["source_identifier", "retrieved_at_iso", "reliability_tier", "duration_ms"],
  },
  {
    stage: "EVALUATED",
    what: "Per-turn evaluator ran: multi-source verdict (AGREE/PARTIAL/CONFLICT/INSUFFICIENT) OR single-source verdict (present/absent/failed). Disagreements enumerated inline. No silent selection.",
    implies_permanent_storage: false,
    required_provenance_fields: ["source_identifier", "reliability_tier", "evaluation_verdict"],
  },
  {
    stage: "CONFIRMED",
    what: "EvidenceStatus.level === 'confirmed': at least one authoritative source AND no disagreement AND no retrieval failure. Response can carry the fact WITH source citation.",
    implies_permanent_storage: false,
    required_provenance_fields: ["source_identifier", "retrieved_at_iso", "reliability_tier", "evaluation_verdict"],
  },
  {
    stage: "NEX_RETAINED",
    what: "Selective-retention rules fired for this item · earns durable storage in retained-knowledge store · retention reason recorded. This is the ONLY stage that implies permanent NEX ownership of a WORLD-derived fact.",
    implies_permanent_storage: true,
    required_provenance_fields: ["source_identifier", "retrieved_at_iso", "url_or_query", "reliability_tier", "evaluation_verdict", "retention_reason"],
  },
];

// ── Retention signals ───────────────────────────────────────────────────
//
// The declarative signal set that governs whether a CONFIRMED item is
// promoted to NEX_RETAINED. capability-selective-retention.ts consults
// these signals; a positive signal earns retention, a negative signal
// blocks it. Retention requires at least one positive signal AND zero
// blocking negative signals (fail-closed).

export type RetentionSignal =
  // Positive signals · a match earns retention consideration
  | "USER_EXPLICITLY_ASKED_TO_REMEMBER"
  | "RELEVANT_TO_ONGOING_PROJECT"
  | "STABLE_AND_REUSABLE"
  | "CONFIRMED_BY_SUFFICIENT_EVIDENCE"
  | "REPEATEDLY_USEFUL_ACROSS_TURNS"
  | "MATERIALLY_CHANGES_FUTURE_REASONING"
  | "LEARNED_CORRECTION"
  | "USEFUL_ABSTRACTION"
  | "SOURCE_RELIABILITY_ESTABLISHED"
  // Negative signals · a match BLOCKS retention regardless of positives
  | "TRANSIENT_INFORMATION"
  | "LOW_CONFIDENCE"
  | "UNVERIFIED_CLAIM"
  | "ONE_OFF_IRRELEVANT_SEARCH_RESULT"
  | "STALE_INFORMATION"
  | "CONFLICTING_WITHOUT_RESOLUTION"
  | "EASILY_RE_RETRIEVABLE_LITTLE_FUTURE_VALUE";

export const POSITIVE_RETENTION_SIGNALS: readonly RetentionSignal[] = [
  "USER_EXPLICITLY_ASKED_TO_REMEMBER",
  "RELEVANT_TO_ONGOING_PROJECT",
  "STABLE_AND_REUSABLE",
  "CONFIRMED_BY_SUFFICIENT_EVIDENCE",
  "REPEATEDLY_USEFUL_ACROSS_TURNS",
  "MATERIALLY_CHANGES_FUTURE_REASONING",
  "LEARNED_CORRECTION",
  "USEFUL_ABSTRACTION",
  "SOURCE_RELIABILITY_ESTABLISHED",
];

export const BLOCKING_RETENTION_SIGNALS: readonly RetentionSignal[] = [
  "TRANSIENT_INFORMATION",
  "LOW_CONFIDENCE",
  "UNVERIFIED_CLAIM",
  "ONE_OFF_IRRELEVANT_SEARCH_RESULT",
  "STALE_INFORMATION",
  "CONFLICTING_WITHOUT_RESOLUTION",
  "EASILY_RE_RETRIEVABLE_LITTLE_FUTURE_VALUE",
];

// ── Inventory helper ────────────────────────────────────────────────────

export interface RetentionModelInventory {
  readonly kinds: number;
  readonly lifecycle_stages: number;
  readonly positive_signals: number;
  readonly blocking_signals: number;
  readonly by_kind: Readonly<Record<NexKnowledgeKind, KnowledgeKindDefinition>>;
  readonly by_stage: Readonly<Record<RetrievalLifecycleStage, RetrievalLifecycleDefinition>>;
}

export function inventoryRetentionModel(): RetentionModelInventory {
  const by_kind: Record<string, KnowledgeKindDefinition> = {};
  for (const k of KNOWLEDGE_KIND_TABLE) by_kind[k.kind] = k;
  const by_stage: Record<string, RetrievalLifecycleDefinition> = {};
  for (const s of RETRIEVAL_LIFECYCLE_TABLE) by_stage[s.stage] = s;
  return {
    kinds: KNOWLEDGE_KIND_TABLE.length,
    lifecycle_stages: RETRIEVAL_LIFECYCLE_TABLE.length,
    positive_signals: POSITIVE_RETENTION_SIGNALS.length,
    blocking_signals: BLOCKING_RETENTION_SIGNALS.length,
    by_kind: by_kind as Readonly<Record<NexKnowledgeKind, KnowledgeKindDefinition>>,
    by_stage: by_stage as Readonly<Record<RetrievalLifecycleStage, RetrievalLifecycleDefinition>>,
  };
}
