// src/lib/nex-agent/code-engine/types.ts
//
// NEX1 Code Authoring Engine · Sprint 1 · type surface.
//
// Constitution (2026-09-12 Amendment 1 · IMMUTABLE):
//   · NEX1 is the accountable programming agent.
//   · Adapters may assist only within the code-proposal sub-step.
//   · Interface names are NEX1-owned · no vendor names permitted.
//   · Template-only is the identity floor · not a fallback.

export type Nex1IntentKind =
  | "add_feature"
  | "fix_bug"
  | "refactor"
  | "add_test"
  | "add_scaffold"
  | "add_jsdoc";

export type Nex1OutputKind = "diff" | "structured_plan" | "test_diagnosis";

export interface Nex1FileSlice {
  readonly path: string;
  readonly content_hash: string;
  readonly content: string;
}

export interface Nex1ReasoningContext {
  readonly task_prompt: string;
  readonly repo_snapshot_hash: string;
  readonly file_slices: readonly Nex1FileSlice[];
  readonly relevant_adrs: readonly string[];
  readonly declared_scope: readonly string[];
}

export interface Nex1ReasoningRequest {
  readonly task_id: string;
  readonly attempt_id: string;
  readonly intent: Nex1IntentKind;
  readonly context: Nex1ReasoningContext;
  readonly output_kind: Nex1OutputKind;
  readonly max_tokens?: number;
  readonly seed?: number;
  /** Structured hint for the template adapter · optional for LLM adapters. */
  readonly template_directive?: TemplateDirective;
}

/**
 * A deterministic directive the template-only adapter can act on. Structured so
 * pure-code synthesis can produce a valid diff without any language model.
 */
export type TemplateDirective =
  | {
      readonly kind: "scaffold_ts_module";
      readonly target_path: string;
      readonly module_purpose: string;
      readonly exported_constants?: ReadonlyArray<{ readonly name: string; readonly value_literal: string; readonly annotation?: string }>;
    }
  | {
      readonly kind: "add_jsdoc";
      readonly target_path: string;
      readonly target_symbol: string;
      readonly summary: string;
    }
  | {
      readonly kind: "add_import";
      readonly target_path: string;
      readonly import_spec: string;
    }
  // ── Sprint 2 · semantic-modification directives · handled by AST adapter ──
  | {
      readonly kind: "add_interface_field";
      readonly target_path: string;
      readonly target_interface: string;
      readonly field_name: string;
      readonly field_type: string;              // TS type text · parsed by AST adapter · e.g. "string | null"
      readonly readonly_field?: boolean;         // default true · matches surrounding pattern
      readonly field_annotation?: string;        // optional JSDoc summary
    }
  | {
      readonly kind: "add_return_object_property";
      readonly target_path: string;
      readonly target_function: string;
      readonly property_name: string;
      readonly property_value: string;           // TS expression text · e.g. `new Date().toISOString()`
    }
  | {
      readonly kind: "add_test_case";
      readonly target_path: string;
      readonly target_describe: string;          // describe(...) title to insert into
      readonly test_name: string;                // string passed to it("...")
      readonly test_body: string;                // TS body statements · inserted verbatim inside async () => { ... }
    }
  // ── Sprint 2.5 · consequence-reasoning directive ─────────────────────
  | {
      readonly kind: "add_property_to_object_at_position";
      readonly target_path: string;
      readonly line: number;                     // 1-indexed · from tsc diagnostic
      readonly column: number;                   // 1-indexed · from tsc diagnostic
      readonly property_name: string;
      readonly property_value: string;           // TS expression text · e.g. `null`
    };

export interface Nex1ReasoningResult {
  readonly adapter_id: string;
  readonly model_id: string | null;
  readonly model_version: string | null;
  readonly proposed_diff: string;
  readonly rationale: string;
  readonly confidence: number;
  readonly tokens_in: number;
  readonly tokens_out: number;
  readonly latency_ms: number;
  readonly deterministic: boolean;
  readonly adapter_scope: "code_proposal_only";
}

export type Nex1ReasoningResponse =
  | { readonly ok: true; readonly result: Nex1ReasoningResult }
  | { readonly ok: false; readonly code: string; readonly reason: string };

export interface Nex1AdapterCapabilities {
  readonly deterministic: boolean;
  readonly supported_intents: readonly Nex1IntentKind[];
  readonly network_egress: "none" | "local-only";
  readonly declared_max_context_bytes: number;
}

export interface Nex1ReasoningAdapter {
  readonly id: string;
  readonly deterministic: boolean;
  isAvailable(): Promise<boolean>;
  capabilities(): Nex1AdapterCapabilities;
  reason(req: Nex1ReasoningRequest): Promise<Nex1ReasoningResponse>;
}

/** Constitutional error codes reserved for the engine · see Sprint 1 §15. */
export const NEX1_ENGINE_ERRORS = {
  reasoning_not_bound: "sec.nex1_reasoning_not_bound",
  diff_malformed: "sec.nex1_diff_malformed",
  context_leak: "sec.nex1_context_leak_attempt",
  egress_blocked: "sec.nex1_egress_blocked",
  secret_in_context: "sec.nex1_secret_in_context",
  secret_in_diff: "sec.nex1_secret_in_diff",
  scope_violation: "sec.nex1_scope_violation",
  adapter_killed: "sec.nex1_adapter_process_killed",
  provenance_missing: "sec.nex1_provenance_missing",
  deterministic_replay_mismatch: "sec.nex1_deterministic_replay_mismatch",
  adapter_removal_test_failed: "sec.nex1_adapter_removal_test_failed",
  authorship_attribution: "sec.nex1_authorship_attribution_violation",
} as const;

/**
 * NEX1's decision trail · records what NEX1 (not the adapter) decided at
 * every step. This is the accountability record.
 */
export interface Nex1DecisionTrail {
  readonly task_interpretation: { readonly at: string; readonly hash: string };
  readonly files_selected: readonly string[];
  readonly context_composed_hash: string;
  readonly candidate_accepted: boolean;
  readonly candidate_rejected_count: number;
  readonly diff_evaluated: "passed" | "failed" | "not_applicable";
  readonly tests_run: readonly string[];
  readonly diagnosis_notes: string;
  readonly repair_attempts: number;
  readonly evidence_recorded_at: string | null;
  readonly completion_decided_at: string | null;
}
