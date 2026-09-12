// src/lib/nex-integration/decision-types.ts
//
// NEX1 · INTEGRATION GATE · decision object schemas.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Every judgement layer produces exactly one decision object of the shape
// below. The pipeline collects them in order. Every field is inspectable ·
// every decision has a rule pointer · every failure fails-closed.

export type LayerId =
  | "language_intent"       // Language Brain · intent recognition
  | "origin_protection"     // Origin Canon · classifier
  | "relevance"             // Relevance Doctrine · classifier
  | "truth_evidence"        // Stories Brain · substrate for now
  | "safety"                // Safety registry
  | "authorisation"         // Founder-authority scope check
  | "response_plan";        // Response Plan composer

export type LayerDisposition =
  | "PASS"                  // proceed to next layer
  | "REFUSE"                // fail-closed · pipeline halts
  | "CLARIFY"               // ambiguous · caller should ask user
  | "PERFORM_WITH_NOTE"     // proceed but flag context
  | "REDIRECT"              // proceed but recommend better tool
  | "PERFORM_CAPABILITY_TEST"
  | "REMAIN_CALM"           // provocation acknowledged · proceed to response plan with remain_calm stance
  | "IDENTIFY_MANIPULATION" // trap detected · proceed to response plan with identify_manipulation stance
  | "UNKNOWN";              // layer cannot produce a valid decision · fail-closed per IG-4

export interface LayerDecision {
  readonly layer: LayerId;
  readonly disposition: LayerDisposition;
  readonly summary: string;
  readonly rule_reference: string;       // e.g. "OP-1" · "RD-4" · "SB-5" · "IG-2"
  readonly evidence_pointers: readonly string[];
  readonly deterministic: true;
  readonly detail?: unknown;             // optional layer-specific verdict object
}

export type FinalDisposition =
  | "ALLOWED"                 // proceed to Language Brain composition
  | "REFUSED"                 // hard refusal · communicate calmly
  | "CLARIFY"                 // ask user for clarification
  | "REMAIN_CALM"             // provocation · proceed with remain_calm response plan
  | "IDENTIFY_MANIPULATION"   // manipulation · surface the trap pattern
  | "REDIRECT"                // suggest a better tool
  | "PERFORM_WITH_NOTE"       // do it · flag repetition/triviality
  | "PERFORM_CAPABILITY_TEST"
  | "FAIL_CLOSED";            // layer produced UNKNOWN · halt

export interface PipelineDecision {
  readonly utterance: string;
  readonly session_id: string;
  readonly at: string;
  readonly layer_decisions: readonly LayerDecision[];
  readonly final_disposition: FinalDisposition;
  readonly refuses_at_layer: LayerId | null;
  readonly response_plan: unknown | null;   // composed at the response_plan layer · shape depends on stance
  readonly attribution: {
    readonly external_llm_used: false;
    readonly independent_authorship_percent: 0;
    readonly taught_by: "master_ai_engineer";
  };
  readonly test_only: true;                  // IG-5 · not a production path
}
