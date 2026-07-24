// Knowledge Extraction Pipeline — types.
//
// The pipeline turns raw Author input (pasted text at V1 · voice/PDF
// stubs later) into structured candidate items that map to Brain
// module payloads. Every candidate is provisional. Nothing lands in
// the Brain until the Author explicitly clicks Accept on each item.
//
// The strict discipline: an LLM cannot invent citations. The prompt
// forces the LLM to reference exact passages from the input as the
// evidence source, or to flag the candidate as `needs_author_source`
// so the Author fills in the citation before it can be Accepted.

export type CandidateStatus = "pending" | "accepted" | "rejected" | "edited";

/** Administrator's per-candidate decision, tracked independently from
 *  Author's `status`. Author-accepted candidates land in the DRAFT
 *  Brain content immediately (so the Author sees them in their editor).
 *  They only reach the RUNTIME pack when admin_status is 'approved'.
 *
 *  Nothing publishes automatically. Author approval alone is not
 *  enough. Administrator approval is mandatory. Every published node
 *  must be fully auditable and reversible — the review_history array
 *  is the audit surface. */
export type CandidateAdminStatus =
  | "unreviewed"          // Author accepted · in Admin queue
  | "approved"            // Admin approved · eligible for Runtime pack
  | "rejected"            // Admin rejected · never reaches Runtime
  | "changes_requested"   // Admin asked Author to revise · back with Author
  | "merged"              // Admin merged with existing published node · original archived
  | "sent_back";          // Admin sent back to Author for more work

export type AdminReviewAction =
  | "approve"
  | "reject"
  | "request_changes"
  | "merge"
  | "send_back";

/** Immutable audit-trail entry. Every state transition on a candidate
 *  appends one of these. Never mutated · never deleted. */
export type CandidateReviewEvent = {
  actor:            { kind: "author" | "brain_admin"; id: string };
  action:           "accepted" | "rejected" | "edited"           // Author actions
                  | AdminReviewAction;                            // Admin actions
  at:               string;      // ISO
  reason?:          string;      // Admin rationale (mandatory for reject / changes_requested)
  notes?:           string;      // Free-form notes
  brain_version:    string;      // Manifest version at review time (supports reversibility)
  merge_target_id?: string;      // For merge action: which existing node was targeted
};

export type CandidateKind =
  | "craft.fact"
  | "craft.glossary"
  | "regulations.reg"
  | "materials.mat"
  | "workflow.playbook"
  | "defects.defect"
  | "pricing_model.rule";

/** A single extraction candidate. `payload` matches the corresponding
 *  module schema shape (post-Zod-validation) — the LLM producer is
 *  responsible for shape correctness. `provenance` is immutable: it
 *  records who / when / how the candidate was proposed. */
export type ExtractionCandidate = {
  id:            string;
  brain_slug:    string;
  kind:          CandidateKind;
  payload:       unknown;
  /** Verbatim slice from the Author's input the LLM used as the basis
   *  for this candidate. Null when the LLM claims to synthesise from
   *  multiple passages — which the Author must verify. */
  source_span:   string | null;
  /** True when the candidate has no verifiable citation and the Author
   *  must supply one before Accept is allowed. */
  needs_author_source: boolean;
  provenance: {
    llm_model:      string;
    proposed_at:    string;         // ISO
    prompt_version: string;
    input_hash:     string;         // SHA-256 of raw input (first 16 chars)
  };
  status:        CandidateStatus;
  author_notes?: string;
  reviewed_at?:  string;
  /** Administrator decision · defaults to 'unreviewed' when Author
   *  Accepts. Only 'approved' candidates reach the Runtime pack. */
  admin_status:  CandidateAdminStatus;
  /** Immutable audit trail. Every Author + Admin action appends here. */
  review_history: CandidateReviewEvent[];
};

export type ExtractionRun = {
  run_id:       string;
  brain_slug:   string;
  author_id:    string;
  input_hash:   string;
  input_length: number;
  llm_model:    string;
  created_at:   string;
  candidates:   ExtractionCandidate[];
};

/** Result envelope every extraction API returns. Never returns the
 *  raw LLM text — only structured candidates. */
export type ExtractionResult =
  | { ok: true;  run: ExtractionRun }
  | { ok: false; reason: "no_llm_key" | "llm_error" | "parse_error" | "empty_input" | "input_too_long"; detail: string };
