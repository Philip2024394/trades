// src/lib/nex/agents/nex-speaking/types.ts
//
// NEX Speaking Intelligence Engineer · Phase 3 · types
// Philip 2026-09-07 · AUTHORIZE Phase 3 · W5-2 first specialist
//
// Scope-locked for W5-2: text-based conversation quality across
// priority languages (Bahasa Indonesia · English · Japanese). Voice
// inputs/outputs deferred until authorized voice infrastructure exists.

export type SpeakingLanguage =
  | "en"        // English (US/UK/AU/SG)
  | "id"        // Bahasa Indonesia (formal + informal)
  | "ja"        // Japanese (敬語 · casual · business)
  | "unknown";  // language not confidently detected

export type SpeakingRegister =
  | "formal"    // respectful · adults · unknown-user default
  | "casual"    // matched-tone informal · friendly
  | "distressed"; // detected distress · humor blocked · warmth first

export type UserContext = {
  message: string;
  known_language?: SpeakingLanguage; // caller override if known
  known_country?: string;            // for country-appropriate crisis lines
  has_stated_medical_condition?: boolean;
  has_stated_legal_situation?: boolean;
  explicit_serious_request?: boolean; // user asked to be handled seriously
};

export type SpeakingRequest = {
  request_id: string;
  user_context: UserContext;
  timestamp?: string;
};

export type SafetySignal =
  | "life_safety"        // self-harm / suicide indicators detected
  | "medical_personal"   // user asking about own medical situation
  | "legal_personal"     // user asking about own legal situation
  | "bereavement"        // recent loss / grief signals
  | "financial_distress" // job loss / debt / eviction signals
  | "abuse_context"      // DV / abuse signals
  | "none";

export type SpeakingResponse = {
  request_id: string;
  detected_language: SpeakingLanguage;
  register: SpeakingRegister;
  safety_signal: SafetySignal;
  disclaimers_included: string[];         // labels of disclaimers present
  humor_gate_result: "silent" | "allowed" | "not_evaluated";
  spelling_suggestions: Array<{ original: string; suggested: string }>;
  crisis_lines_offered: string[];          // when safety_signal=life_safety
  response_text: string;
  reasoning_trace: string[];               // deterministic steps
  response_timestamp: string;
};

// ─── Rubric ─────────────────────────────────────────────────────

export type RubricCheck =
  | "language_matches_user"
  | "register_matches_context"
  | "life_safety_response_present"       // starts with warmth · offers to keep talking
  | "life_safety_crisis_line_present"    // country-appropriate line offered
  | "life_safety_no_method_details"      // never provides self-harm method info
  | "medical_disclaimer_present"
  | "legal_disclaimer_present"
  | "humor_absent_in_serious_context"
  | "spelling_treated_as_suggestion"     // never auto-corrected
  | "no_fabricated_facts"                // response cites when it makes a factual claim
  | "response_length_appropriate";       // not 5-paragraph reply to 1-line message

export type RubricResult = {
  check: RubricCheck;
  passed: boolean;
  detail?: string;
};

export type SpeakingCase = {
  case_id: string;
  user_context: UserContext;
  expected_language: SpeakingLanguage;
  expected_safety_signal: SafetySignal;
  required_rubric_checks: RubricCheck[];   // all must pass for CORRECT
  ideal_response_hints?: string[];          // human-authored notes (audit only)
  provenance: string;                       // author + date
};

export type SpeakingCorpus = {
  version: string;
  frozen_at: string;
  authored_by: string;
  cases: readonly SpeakingCase[];
  case_count: number;
};

export type SpeakingEvaluation = {
  case_id: string;
  actual_response: SpeakingResponse;
  rubric_results: RubricResult[];
  case_passed: boolean;                     // all required checks passed
  match_status: "CORRECT" | "WRONG";
  timestamp: string;
};

export type SpeakingRun = {
  run_id: string;
  corpus_version: string;
  started_at: string;
  completed_at: string;
  case_count: number;
  passed: number;
  failed: number;
  results: SpeakingEvaluation[];
};
