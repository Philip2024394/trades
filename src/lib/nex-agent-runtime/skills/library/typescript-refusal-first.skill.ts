// §36-E-3B · WAVE-E3B · 2026-09-14 · first-real-skills
// NEX bounded infrastructure · skill definition · typescript-refusal-first · 2026-09-14
// Provenance recorded on the exported skill object as bounded NEX infrastructure. NOT NEX1-authored capability.
//
// Skill: typescript-refusal-first
// Domain: language (typescript)
//
// Purpose: encode the NEX primitive-authoring discipline · every primitive
// must (a) export refusal codes as a union type, (b) return a discriminated
// {ok: true} | {ok: false, refusal_code, reason} result, (c) never throw
// for validated-input paths.

import { createHash } from "node:crypto";
import type { Skill } from "../skill-schema-types";

const AUTHORING_EVIDENCE = createHash("sha256")
  .update("§36-E-3B · WAVE-E3B · 2026-09-14 · typescript-refusal-first", "utf8")
  .digest("hex");

export const TYPESCRIPT_REFUSAL_FIRST_SKILL: Skill = {
  identity: {
    slug: "typescript-refusal-first",
    version: "1.0.0",
    display_name: "TypeScript · Refusal-First Primitive Discipline",
    domain: "language",
  },
  applicability: {
    applicable_languages: ["typescript"],
    applicable_frameworks: [],
    applicable_change_kinds: ["file_new", "file_content"],
  },
  validators: [
    {
      validator_id: "declares_refusal_code_union",
      predicate_id: "text_matches_regex",
      predicate_args: {
        kind: "text_matches_regex",
        regex: "export type \\w+RefusalCode\\s*=",
      },
      kind: "invariant",
      rationale: "Primitives must export a locked refusal-code union type",
    },
    {
      validator_id: "declares_failure_interface",
      predicate_id: "text_matches_regex",
      predicate_args: {
        kind: "text_matches_regex",
        regex: "interface \\w+Failure",
      },
      kind: "invariant",
      rationale: "Primitives must have a Failure interface with { ok: false, refusal_code, reason }",
    },
    {
      validator_id: "declares_success_interface",
      predicate_id: "text_matches_regex",
      predicate_args: {
        kind: "text_matches_regex",
        regex: "interface \\w+Success",
      },
      kind: "invariant",
      rationale: "Primitives must have a Success interface with { ok: true, ... }",
    },
    {
      validator_id: "declares_result_union",
      predicate_id: "text_matches_regex",
      predicate_args: {
        kind: "text_matches_regex",
        regex: "export type \\w+Result\\s*=",
      },
      kind: "invariant",
      rationale: "Primitives must export a Result union type (Success | Failure)",
    },
    {
      validator_id: "no_throw_in_public_return",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "throw new (Error|TypeError|RangeError)",
      },
      kind: "anti_pattern",
      rationale: "Primitives return refusal · they do not throw for validated input paths",
    },
    {
      validator_id: "no_any_type",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: ":\\s*any\\b|<any>",
      },
      kind: "anti_pattern",
      rationale: "TypeScript discipline · no any type in primitive code",
    },
    {
      validator_id: "must_be_ts_file",
      predicate_id: "path_matches_regex",
      predicate_args: {
        kind: "path_matches_regex",
        regex: "\\.(ts|tsx)$",
      },
      kind: "precondition",
      rationale: "This skill applies to TypeScript files only",
    },
  ],
  procedures: [
    {
      step_id: "verify-refusal-shape",
      step_kind: "verify",
      description: "Ensure Result = Success | Failure with typed refusal_code",
      required_predicate_verdicts: [
        { validator_id: "declares_refusal_code_union", required_verdict: "satisfied" },
        { validator_id: "declares_result_union", required_verdict: "satisfied" },
      ],
    },
    {
      step_id: "verify-no-throw",
      step_kind: "verify",
      description: "Ensure primitive does not throw for validated inputs",
      required_predicate_verdicts: [
        { validator_id: "no_throw_in_public_return", required_verdict: "satisfied" },
      ],
    },
  ],
  known_anti_patterns: [],
  evidence_requirements: [],
  provenance: {
    authored_by: "MAI_infrastructure",
    authored_at: "2026-09-14T22:30:00.000Z",
    authoring_evidence_sha256: AUTHORING_EVIDENCE,
    promotion_state: "PROMOTED",
  },
};
