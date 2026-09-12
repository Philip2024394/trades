// src/lib/nex/knowledge-acquisition/types.ts
//
// P1 REDIRECT · Knowledge Acquisition Capability · types
// (Philip 2026-09-05 · corrective authorization)
//
// The seven pipeline types + status enum + operational-run type.
// Strict typing between stages is what prevents "candidate slipping
// into promoted" — the two never share a table.
//
// COMPOSITION with prior doctrines:
//   · Operational Truth doctrine §16: pipeline modules NEVER set their
//     own status · status is derived by status.ts from evidence trail
//   · P1 REDIRECT §OP: every PipelineRun carries the full evidence
//     schema so absence-of-progress can be detected without waiting
//     for a human or Claude to notice
//   · Business Brain evidence-per-fact discipline: every promoted fact
//     carries provenance + confidence + freshness
//   · Provider independence: no LLM signature in any type · extractors
//     are pluggable · verification is deterministic

// ─── Stage 1 · Sources ────────────────────────────────────────────

export type AuthorityTier = "primary" | "research" | "community";

/** A registered source of engineering/domain knowledge. */
export type Source = {
  source_id: string;
  authority: string;                    // e.g., "WCO", "FAO", "KKP", "seed.controlled"
  authority_tier: AuthorityTier;
  base_url?: string;
  /** How this source is materialised into snapshots. */
  retrieval_policy: "static_reference" | "manual_snapshot" | "future_walker";
  /** Topic prefixes this source covers. Used by dispatch. */
  covers_domain: string[];
};

// ─── Stage 2 · Source snapshots (raw material · never a fact) ─────

export type SourceSnapshot = {
  snapshot_id: string;
  source_id: string;
  retrieved_at: string;                 // ISO
  content_ref: string;                  // file path or content-addressable id
  content_hash: string;                 // SHA-256 of the content
  bytes: number;
  /** Raw content, held in memory during a pipeline run.
   *  Persisted separately via content_ref for provenance. */
  content?: string;
  /** Optional structured payload for structured.json extractor. */
  structured?: unknown;
};

// ─── Stage 3 · Candidate claims (never NEX knowledge) ─────────────

/** A structured claim extracted from a snapshot.
 *  Status is always "candidate" · promotion happens elsewhere. */
export type CandidateClaim = {
  claim_id: string;
  subject: string;                      // canonical entity/topic
  predicate: string;                    // definitional predicate
  qualifiers?: Record<string, string>;  // e.g., { authority: "WCO", edition: "2022" }
  extracted_from: string;               // snapshot_id
  extractor_id: string;                 // e.g., "regex.definitional"
  extracted_at: string;                 // ISO
  status: "candidate";                  // literal · never promoted here
  /** Evidence-first: predicate keywords the record explicitly is NOT.
   *  Optional at extraction · may be populated by structured/manual extractors
   *  for high-stakes definitional claims (HS codes, regulations, etc). */
  contradictions?: string[];
};

// ─── Stage 4 · Provenance ─────────────────────────────────────────

export type Provenance = {
  provenance_id: string;
  claim_id: string;
  source_id: string;
  snapshot_id: string;
  /** The exact substring of the source content that supports the claim. */
  evidence_span?: string;
  extractor_id: string;
  attributed_at: string;                // ISO
};

// ─── Stage 5 · Verification outcomes ──────────────────────────────

export type VerificationOutcome =
  | {
      claim_id: string;
      outcome: "VERIFIED";
      /** Provenance ids that support the VERIFIED verdict. */
      supporting_provenance: string[];
      confidence: number;               // 0..1
      verified_at: string;              // ISO
      /** Which rule fired (1-5 from spec §6). */
      rule: 1 | 2 | 3 | 4 | 5;
    }
  | {
      claim_id: string;
      outcome: "CONTRADICTED";
      contradicting_provenance: string[];
      against: string;                  // knowledge_id or claim_id
      verified_at: string;
      rule: 3 | 4;
    }
  | {
      claim_id: string;
      outcome: "UNVERIFIED";
      reason: string;
      verified_at: string;
      rule: 4;
    }
  | {
      claim_id: string;
      outcome: "INSUFFICIENT_EVIDENCE";
      verified_at: string;
      rule: 5;
    };

// ─── Stage 6 · Promoted (NEX-owned) knowledge ─────────────────────

/** A candidate claim that has passed verification + promotion gate.
 *  Only these records participate in NEX retrieval. */
export type PromotedKnowledge = {
  knowledge_id: string;
  claim_id: string;                     // link back to originating candidate
  subject: string;
  predicate: string;
  qualifiers?: Record<string, string>;
  confidence: number;                   // 0..1
  stability: "stable" | "seasonal" | "time_sensitive";
  valid_until?: string;                 // ISO · when this promotion should be re-verified
  promoted_at: string;                  // ISO
  /** Prior knowledge_id if this promotion updates an existing fact. */
  supersedes?: string;
  /** When this row was superseded by a newer promotion.
   *  null = current · timestamp = superseded (retained for provenance). */
  superseded_at?: string | null;
  /** Provenance: which pipeline run produced this promotion. */
  from_run_id: string;
  from_provenance_ids: string[];
  /** P1 §OP: fixture-derived knowledge is marked explicitly.
   *  Retrieval must filter these out unless NEX_P1_ALLOW_FIXTURE_KNOWLEDGE=true. */
  provenance_kind: "authoritative" | "fixture";
  /** Evidence-first denial list, propagated from the candidate claim. */
  contradictions?: string[];
};

// ─── Operational · Pipeline run history (§OP.2) ───────────────────

/** Per-run evidence record. Persisted append-only.
 *  §OP.5: pipeline modules NEVER set their own final_status.
 *  final_status is derived by status.ts::deriveStatus(). */
export type PipelineRun = {
  run_id: string;                       // UUID
  started_at: string;                   // ISO
  last_progress_at: string;             // ISO · updated at every stage
  completed_at: string | null;          // ISO on completion · null while running
  source_id: string | null;             // populated after Stage 1 select
  snapshot_id: string | null;           // populated after Stage 2
  snapshot_status: "PENDING" | "SUCCESS" | "FAILED";
  claims_extracted: number;
  claims_verified: number;
  claims_rejected: number;
  claims_promoted: number;
  failure_stage: RunStage | null;
  failure_reason: string | null;
  retry_count: number;
  recovery_result: "NOT_ATTEMPTED" | "IN_PROGRESS" | "SUCCESS" | "EXHAUSTED";
  /** DERIVED by status.ts · never set by pipeline. Nullable here to
   *  reflect that the pipeline persists RunHeader (with final_status=null)
   *  and the evaluator computes final_status on read. */
  final_status: Status | null;
  evidence_pointers: string[];          // artifact paths per stage
};

/** Stages of a pipeline run. Each stage transition emits an evidence
 *  event and updates last_progress_at. */
export type RunStage =
  | "RUN_CREATED"
  | "SOURCE_ACCESS"
  | "SNAPSHOT_SUCCESS"
  | "EXTRACTION_SUCCESS"
  | "CLAIMS_FOUND"
  | "VERIFICATION_COMPLETED"
  | "PROMOTION_DECISION"
  | "RUN_COMPLETED";

// ─── Status vocabulary (Operational Truth doctrine §3 · LOCKED) ───

/** Evidence-derived status · never self-asserted by any component. */
export type Status =
  | "PROVEN_HEALTHY"                    // recent run completed + verification success within threshold
  | "DEGRADED"                          // completed with warnings (partial failures, high rejection)
  | "FAILED"                            // deadline exceeded OR recovery exhausted OR stale
  | "NEVER_PROVEN"                      // no successful run has ever completed
  | "RECOVERING";                       // failure detected + recovery in progress

// ─── Pipeline execution result ────────────────────────────────────

/** What a single pipeline invocation returns to its caller.
 *  Structurally separate from PipelineRun (which is the persisted
 *  historical record). This is the in-memory result of one call. */
export type PipelineResult = {
  run: PipelineRun;                     // the persisted record for this invocation
  candidates: CandidateClaim[];         // what was extracted
  verifications: VerificationOutcome[]; // what verification said
  promoted: PromotedKnowledge[];        // what actually became NEX knowledge
};
