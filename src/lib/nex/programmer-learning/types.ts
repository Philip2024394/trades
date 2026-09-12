// src/lib/nex/programmer-learning/types.ts
//
// NEX Programmer Agent · Phase A · type definitions
// Philip 2026-09-05 · AUTHORIZE · PROGRAMMER LEARNING OBSERVER
//
// Central discipline: KNOWLEDGE, SKILL, and EXPERIENCE are three
// separate stores with three separate types. Never collapsed.
//
//   KNOWLEDGE  · "what is true?"           · sourced facts about tools/languages/APIs
//   SKILL      · "how do I do this?"       · ability to perform an engineering task
//   EXPERIENCE · "what happened when NEX did this?" · applied outcomes with evidence
//
// Every record carries PROVENANCE. Every record carries a
// VERIFICATION STATE (never "verified by default").
//
// The Phase-A agent is an OBSERVER / LEARNER / HISTORIAN. It has no
// authority to commit, deploy, alter production, or modify itself.
// Type unions here reflect that boundary (see PermissionScope below).

// ─── Engineering event categories (18 kinds per AUTHORIZE §3.A) ────
//
// One kind per meaningful event in the engineering lifecycle. The
// union is CLOSED — new kinds require an explicit code change (and
// an ADR/authorization if the semantic boundary is extended).

export type EngineeringEventKind =
  | "observation"
  | "implementation_attempt"
  | "code_change"
  | "test_result"
  | "typecheck_result"
  | "runtime_result"
  | "bug"
  | "root_cause"
  | "fix"
  | "regression"
  | "architecture_decision"
  | "architecture_rejection"
  | "security_finding"
  | "performance_finding"
  | "migration_event"
  | "external_source_read"
  | "verification"
  | "learning"
  | "experience_created";

// ─── Source types & authority tiers ────────────────────────────────

/** Where the evidence for a record came from. */
export type SourceType =
  | "claude_action"          // Claude proposed/executed an engineering action
  | "claude_claim"           // Claude asserted something (never authoritative on its own)
  | "ollama_action"          // local model action (future)
  | "human_engineer"         // Philip or another human
  | "test_runner"            // vitest / jest / go test / etc.
  | "type_checker"           // tsc / mypy / etc.
  | "linter"                 // eslint / etc.
  | "runtime"                // actual program execution
  | "http_probe"             // HTTP integration probe
  | "database_probe"         // DB query probe
  | "git"                    // git-derived evidence (log, diff, blame)
  | "external_documentation" // official docs / RFCs / standards
  | "external_source_other"  // any other externally-sourced material
  | "internal_artifact";     // NEX-produced artifact (proof reports etc.)

/** Authority ranking of a source (per AUTHORIZE §8).
 *  Tier 1 = official documentation/standards/primary sources.
 *  Tier 5 = search-result snippets / unsourced material.
 *  A source's tier ALONE does not grant "verified" status — it only
 *  informs how much weight verifiers should place on it. */
export type AuthorityTier = "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | "TIER_5";

// ─── Verification lifecycle ────────────────────────────────────────

/** Verification state · applies to knowledge, skill, and experience
 *  records. The default state is DISCOVERED — nothing is verified
 *  merely because it was captured. */
export type VerificationState =
  | "DISCOVERED"   // captured, not yet checked
  | "CHECKED"      // structural integrity confirmed (schema/provenance)
  | "VERIFIED"     // supported by independent evidence
  | "SUPERSEDED"   // newer authoritative source has replaced this
  | "REJECTED";    // marked invalid (contradiction, false positive)

// ─── Provenance ─────────────────────────────────────────────────────

/** Every record MUST carry provenance. This is the citation trail
 *  from record → source → evidence. The verifier reads this; the
 *  historian relies on this; retrieval returns this. */
export type Provenance = {
  source: string;               // human-readable source label
  source_type: SourceType;
  source_url?: string | null;
  authority_tier: AuthorityTier;
  retrieved_at: string;         // ISO
  /** Pointer to evidence — file path, HTTP response, test log, etc. */
  evidence_pointer: string;
  /** Actor that produced/observed this record. Explicitly labeled so
   *  provider identity does not become authority. */
  observed_by?: "claude" | "ollama" | "human" | "system" | "runtime" | "test_runner";
};

// ─── Engineering event ─────────────────────────────────────────────

export type EngineeringEvent = {
  event_id: string;
  kind: EngineeringEventKind;
  timestamp: string;              // ISO
  source: string;                 // short human label
  source_type: SourceType;
  project?: string;               // "nex" · "trades" etc.
  task?: string;                  // "P0.3 hotel resolved-reference continuity"
  description: string;
  evidence_pointer: string;       // file path, URL, or run id
  status: VerificationState;
  related_event_ids?: string[];   // parent event, chained events (root_cause → fix)
  /** Small structured metadata bag · schema-free but bounded (<4KB) so
   *  the event stream stays scannable. Keep only what is not
   *  representable in structured fields above. */
  meta?: Record<string, unknown>;
};

// ─── Knowledge ─────────────────────────────────────────────────────

/** A knowledge item is a sourced factual STATEMENT about a
 *  technology/domain. NEVER a subjective opinion. NEVER a self-report
 *  from Claude claiming "this is true". */
export type KnowledgeItem = {
  knowledge_id: string;
  statement: string;              // the factual claim
  domain: string;                 // "typescript" · "postgres" · "http" · "security"
  technology?: string | null;     // finer-grained: "typescript.narrowing"
  /** Provenance (source, url, tier, retrieved_at, evidence). */
  provenance: Provenance;
  verification_status: VerificationState;
  confidence: number;             // 0..1 · derived from tier + verification
  /** If this record was replaced by a newer authoritative source. */
  superseded_by?: string | null;
  /** Cross-references to related knowledge (same domain / technology). */
  related_knowledge?: string[];
  /** Content hash for dedup / contradiction detection. */
  content_hash: string;
  created_at: string;             // ISO
};

// ─── Skill ─────────────────────────────────────────────────────────

/** A skill is the ability to perform / reason about a specific
 *  engineering task. A skill is NOT proven just because docs were
 *  read — it requires supporting EXPERIENCE records showing NEX
 *  actually applied it and observed the outcome. */
export type SkillPromotionState =
  | "OBSERVED"   // NEX has seen the skill described but never attempted it
  | "PRACTICED"  // NEX (via any actor) has attempted this skill at least once
  | "VERIFIED";  // supporting experiences meet the promotion threshold

export type SkillItem = {
  skill_id: string;
  name: string;                     // "trace a Next.js API route into DB retrieval"
  domain: string;                   // "nextjs" · "postgres" · "conversation-composition"
  description: string;
  /** IDs of skills required before this one is meaningful. */
  prerequisites?: string[];
  /** IDs of KnowledgeItem records this skill depends on. */
  knowledge_dependencies?: string[];
  /** Human-readable recipe for verifying the skill was applied correctly. */
  verification_recipe?: string;
  confidence: number;               // 0..1
  promotion_state: SkillPromotionState;
  /** IDs of ExperienceItem records that support this skill. */
  supporting_experiences?: string[];
  /** Optional pointer to a benchmark that could measure this skill. */
  benchmark_reference?: string;
  created_at: string;
};

// ─── Experience ────────────────────────────────────────────────────

/** An experience is a factual record of what NEX (or Claude, or a
 *  human via NEX) actually did on a real engineering task, and what
 *  happened. Failures are FIRST-CLASS — an incorrect attempt teaches
 *  as much as a successful one. */
export type ExperienceOutcome =
  | "success"        // action produced the expected result with evidence
  | "partial_success"// expected result achieved with caveats
  | "failure"        // did not achieve expected result · evidence records why
  | "reverted";      // action was undone after evaluation

export type ExperienceItem = {
  experience_id: string;
  task: string;                     // "P0.3 hotel resolved-reference continuity"
  initial_hypothesis: string;
  action_taken: string;
  files_involved: string[];
  expected_result: string;
  actual_result: string;
  /** Evidence pointers · test logs · HTTP proofs · diff refs etc. */
  evidence: string[];
  outcome: ExperienceOutcome;
  root_cause?: string | null;       // required when outcome=failure
  correction?: string | null;       // what changed the outcome
  regression_result?: string | null;// evidence that regression suite was checked
  lessons: string[];
  related_knowledge?: string[];     // knowledge_ids invoked
  related_skill?: string | null;    // skill_id being practiced/verified
  timestamp: string;
  /** Every experience carries provenance too · so retrieval can trace
   *  who did what and where the evidence lives. */
  provenance: Provenance;
};

// ─── Learning run (for §19 Operational-Truth compliance) ───────────

/** A learning run captures ONE session of Phase-A activity so an
 *  independent verifier can later derive PROVEN/DEGRADED/FAILED.
 *  Never sets its own status. Never claims health. */
export type LearningRun = {
  run_id: string;
  started_at: string;
  completed_at: string | null;
  triggered_by: "manual" | "hook" | "cron_future";  // no cron in Phase A
  events_captured: number;
  knowledge_ingested: number;
  skills_touched: number;
  experiences_created: number;
  external_sources_read: number;
  errors: string[];
  /** Pointers so the verifier can independently confirm. */
  evidence_pointers: string[];
  /** Explicitly null per Op-Truth §OP.5 · derived by external verifier. */
  final_status: null;
};

// ─── Permission scope · Phase-A boundary ───────────────────────────

/** The Phase-A agent's PERMITTED action set. Encoded as a type so
 *  future modules must declare which permissions they need. Anything
 *  not on this list requires a separate authorization slice. */
export type PhaseAPermission =
  | "read_file"
  | "read_git_history"
  | "read_test_output"
  | "read_runtime_output"
  | "read_http_response"
  | "read_external_url"
  | "write_learning_store"      // writes ONLY under data/programmer-learning/
  | "append_event"
  | "append_knowledge"
  | "append_skill"
  | "append_experience"
  | "append_learning_run";

/** Actions explicitly FORBIDDEN in Phase A · these throw on attempt. */
export type ForbiddenPhaseAAction =
  | "commit"
  | "push"
  | "deploy"
  | "alter_database_schema"
  | "modify_production"
  | "grant_access"
  | "modify_workforce"
  | "modify_own_core"
  | "create_workforce_job"
  | "run_shell_arbitrary";
