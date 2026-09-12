// src/lib/nex-code-intelligence/operation-taxonomy.ts
// Deterministic operation-kind requirements per CI-5.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12

import type { OperationKind, OperationRequirements } from "./types";

const R = (o: Partial<OperationRequirements> & { notes: string }): OperationRequirements => ({
  parser_required: !!o.parser_required,
  semantic_analysis_required: !!o.semantic_analysis_required,
  validation_required: !!o.validation_required,
  test_required: !!o.test_required,
  rollback_required: !!o.rollback_required,
  authorisation_required: !!o.authorisation_required,
  notes: o.notes,
});

const TAXONOMY: Readonly<Record<OperationKind, OperationRequirements>> = Object.freeze({
  FORMAT:                 R({ parser_required: true, semantic_analysis_required: false, validation_required: true, rollback_required: true, authorisation_required: true, notes: "formatter must preserve semantics · parse before + after · diff required" }),
  STYLE_CHANGE:           R({ parser_required: true, semantic_analysis_required: false, validation_required: true, rollback_required: true, authorisation_required: true, notes: "same as FORMAT + rule-driven style rewrite · not semantic" }),
  LINT_FIX:               R({ parser_required: true, semantic_analysis_required: true,  validation_required: true, rollback_required: true, authorisation_required: true, notes: "auto-fixes must produce a parseable + type-checkable result" }),
  SYNTAX_REPAIR:          R({ parser_required: true, semantic_analysis_required: false, validation_required: true, rollback_required: true, authorisation_required: true, notes: "attempts to make a broken parse succeed · never guesses semantics" }),
  DIALECT_CHANGE:         R({ parser_required: true, semantic_analysis_required: true,  validation_required: true, test_required: true, rollback_required: true, authorisation_required: true, notes: "within-language dialect (e.g. py2 → py3) · must preserve semantics · tests required" }),
  LANGUAGE_TRANSLATION:   R({ parser_required: true, semantic_analysis_required: true,  validation_required: true, test_required: true, rollback_required: true, authorisation_required: true, notes: "cross-language · MUST preserve semantics · MUST produce parseable target · MUST diff · CI-6 · fails-closed if semantic preservation cannot be demonstrated" }),
  FRAMEWORK_MIGRATION:    R({ parser_required: true, semantic_analysis_required: true,  validation_required: true, test_required: true, rollback_required: true, authorisation_required: true, notes: "framework-level migration · project-wide · founder scope" }),
  DEPENDENCY_MIGRATION:   R({ parser_required: false, semantic_analysis_required: false, validation_required: true, test_required: true, rollback_required: true, authorisation_required: true, notes: "package version changes · lockfile updates · tests must pass" }),
  FILE_FORMAT_CONVERSION: R({ parser_required: false, semantic_analysis_required: false, validation_required: true, rollback_required: true, authorisation_required: true, notes: "e.g. JSON ↔ YAML · TOML ↔ JSON · lossless roundtrip required" }),
  PROJECT_MIGRATION:      R({ parser_required: true, semantic_analysis_required: true,  validation_required: true, test_required: true, rollback_required: true, authorisation_required: true, notes: "multi-file semantic transformation across the whole project" }),
  REFACTOR:               R({ parser_required: true, semantic_analysis_required: true,  validation_required: true, test_required: true, rollback_required: true, authorisation_required: true, notes: "rename · extract · inline · move · signature change · behaviour preserved" }),
  BUG_FIX:                R({ parser_required: true, semantic_analysis_required: true,  validation_required: true, test_required: true, rollback_required: true, authorisation_required: true, notes: "behaviour change intentional · tests must demonstrate the fix" }),
  FEATURE_CHANGE:         R({ parser_required: true, semantic_analysis_required: true,  validation_required: true, test_required: true, rollback_required: true, authorisation_required: true, notes: "behaviour change intentional · tests required" }),
  TEST_CHANGE:            R({ parser_required: true, semantic_analysis_required: false, validation_required: true, rollback_required: true, authorisation_required: true, notes: "changes to test files only · production code untouched" }),
  CONFIGURATION_CHANGE:   R({ parser_required: false, semantic_analysis_required: false, validation_required: true, rollback_required: true, authorisation_required: true, notes: "config-file edit · schema-validated where applicable" }),
});

export function requirementsFor(op: OperationKind): OperationRequirements { return TAXONOMY[op]; }
export function listOperations(): readonly OperationKind[] { return Object.keys(TAXONOMY) as OperationKind[]; }
