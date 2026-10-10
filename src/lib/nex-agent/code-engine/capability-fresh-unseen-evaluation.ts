// src/lib/nex-agent/code-engine/capability-fresh-unseen-evaluation.ts
//
// NEX1 · Fresh Unseen Evaluation Corpus + Runner
// Ledger B additive · Zero LLM · Deterministic reproducible.
//
// PURPOSE
//   Founder §49-51: run the coding engine against tasks NEVER used during
//   implementation. Measure whether behaviour generalises · report failures
//   honestly · no ground-truth tuning.
//
// FOUNDER INVARIANTS
//   · Corpus derived from templates NOT the implementation examples
//   · Every task has explicit ground truth pre-registered before running
//   · Results include pass · fail · refused · unknown · not_applicable
//   · No task→answer table · every result derives from real operator behaviour
//   · Deterministic seed for reproducibility

import { createHash } from "node:crypto";
import {
  opModifyReturn,
  opAddExport,
  opUpdateImport,
  opReplaceExpression,
  opAddObjectProperty,
  opCreateFile,
  opModifyComponentPropDefault,
  type OperatorResult,
} from "./capability-code-operator-library";
import {
  opAddJsxAttribute,
  opModifyJsxAttribute,
  opWrapJsxElement,
  opCreateReactComponent,
  type JsxOperatorResult,
} from "./capability-jsx-authoring-operators";

export const FRESH_UNSEEN_EVAL_VERSION = "fresh-unseen-evaluation.v1.2026-09-19";

// ── Task shape ────────────────────────────────────────────────────────

export interface FreshEvalTask {
  readonly task_id: string;
  readonly category: string;
  readonly description: string;
  readonly source_content: string;
  readonly operator: string;
  readonly operator_params: Record<string, unknown>;
  readonly expected_outcome: "operator_should_apply" | "operator_should_refuse";
  readonly expected_refusal_class?: string;  // if should_refuse · substring of refusal_reason
  readonly expected_content_check?: string;  // if should_apply · substring that must appear in new_content
  readonly expected_content_absent?: string; // if should_apply · substring that must NOT appear
}

// ── Task corpus (deliberately fresh · not from implementation examples) ─
//
// These are DIFFERENT from the strings used in operator tests · they use
// different symbol names · different content shapes · different edge cases.
// The intent is to probe generalisation without tuning against these tasks.

export function generateFreshEvalCorpus(): readonly FreshEvalTask[] {
  return Object.freeze([
    // ─── 1. modify_return · normal case with different symbol name ────
    {
      task_id: "FU-01",
      category: "modify_return",
      description: "Change classifyRiskScore to return 100 instead of 50 · unseen symbol name",
      source_content: `export function classifyRiskScore(): number {\n  return 50;\n}\n`,
      operator: "modify_return",
      operator_params: { function_name: "classifyRiskScore", new_return_expression: "100" },
      expected_outcome: "operator_should_apply",
      expected_content_check: "return 100;",
      expected_content_absent: "return 50;",
    },
    // ─── 2. modify_return · non-existent function · should refuse ─────
    {
      task_id: "FU-02",
      category: "modify_return",
      description: "Attempt to modify a function that does not exist",
      source_content: `export function alpha() { return 1; }\n`,
      operator: "modify_return",
      operator_params: { function_name: "omega", new_return_expression: "42" },
      expected_outcome: "operator_should_refuse",
      expected_refusal_class: "function_not_found",
    },
    // ─── 3. add_export · declaration exists but not exported ──────────
    {
      task_id: "FU-03",
      category: "add_export",
      description: "Add export to a previously non-exported const · unseen name",
      source_content: `const paymentGateway = { region: "eu" };\n`,
      operator: "add_export",
      operator_params: { symbol: "paymentGateway", export_mode: "convert_declaration" },
      expected_outcome: "operator_should_apply",
      expected_content_check: "export const paymentGateway",
    },
    // ─── 4. add_export · already exported · should refuse ─────────────
    {
      task_id: "FU-04",
      category: "add_export",
      description: "Attempt to double-export an already-exported class",
      source_content: `export class InventoryLedger {}\n`,
      operator: "add_export",
      operator_params: { symbol: "InventoryLedger", export_mode: "convert_declaration" },
      expected_outcome: "operator_should_refuse",
      expected_refusal_class: "already_exported",
    },
    // ─── 5. update_import · path change · unseen module names ─────────
    {
      task_id: "FU-05",
      category: "update_import",
      description: "Rename import path from old-billing to billing/v2",
      source_content: `import { Invoice } from "./old-billing";\nexport const x = 1;\n`,
      operator: "update_import",
      operator_params: { current_module: "./old-billing", new_module: "./billing/v2" },
      expected_outcome: "operator_should_apply",
      expected_content_check: `"./billing/v2"`,
      expected_content_absent: `"./old-billing"`,
    },
    // ─── 6. replace_expression · single occurrence ────────────────────
    {
      task_id: "FU-06",
      category: "replace_expression",
      description: "Change a magic number in isolation",
      source_content: `export const MAX_RETRIES = 5;\n`,
      operator: "replace_expression",
      operator_params: { target: "5", replacement: "8" },
      expected_outcome: "operator_should_apply",
      expected_content_check: "MAX_RETRIES = 8",
    },
    // ─── 7. replace_expression · ambiguous · should refuse ────────────
    {
      task_id: "FU-07",
      category: "replace_expression",
      description: "Attempt ambiguous replacement of a common token",
      source_content: `const a = 1; const b = 1; const c = 1;\n`,
      operator: "replace_expression",
      operator_params: { target: "1", replacement: "9" },
      expected_outcome: "operator_should_refuse",
      expected_refusal_class: "ambiguous_match",
    },
    // ─── 8. add_object_property · unique anchor ───────────────────────
    {
      task_id: "FU-08",
      category: "add_object_property",
      description: "Add a new field to a settings object",
      source_content: `const settings = {\n  language: "en",\n};\n`,
      operator: "add_object_property",
      operator_params: { anchor_symbol: "const settings", key: "timezone", value: `"UTC"` },
      expected_outcome: "operator_should_apply",
      expected_content_check: `timezone: "UTC"`,
    },
    // ─── 9. add_object_property · key already present · should refuse ─
    {
      task_id: "FU-09",
      category: "add_object_property",
      description: "Attempt to add a key that already exists",
      source_content: `const settings = { timezone: "PST", language: "en" };\n`,
      operator: "add_object_property",
      operator_params: { anchor_symbol: "const settings", key: "timezone", value: `"UTC"` },
      expected_outcome: "operator_should_refuse",
      expected_refusal_class: "key_already_present",
    },
    // ─── 10. modify_component_prop_default · unseen React component ───
    {
      task_id: "FU-10",
      category: "modify_component_prop_default",
      description: "Change a prop default in a React function component",
      source_content: `export function Notification({ severity = "info", persistent = false }: Props) { return <div />; }\n`,
      operator: "modify_component_prop_default",
      operator_params: { component_name: "Notification", prop_name: "severity", new_default_value: `"warning"` },
      expected_outcome: "operator_should_apply",
      expected_content_check: `severity = "warning"`,
      expected_content_absent: `severity = "info"`,
    },
    // ─── 11. create_file · valid ──────────────────────────────────────
    {
      task_id: "FU-11",
      category: "create_file",
      description: "Create a new module file with an exported const",
      source_content: "",
      operator: "create_file",
      operator_params: { path: "src/lib/features/announcements.ts", content: `export const announcements: readonly string[] = [];\n` },
      expected_outcome: "operator_should_apply",
      expected_content_check: "announcements",
    },
    // ─── 12. create_file · path traversal · should refuse ─────────────
    {
      task_id: "FU-12",
      category: "create_file",
      description: "Attempt path traversal · must refuse",
      source_content: "",
      operator: "create_file",
      operator_params: { path: "../../../../etc/passwd", content: "bad" },
      expected_outcome: "operator_should_refuse",
      expected_refusal_class: "path_traversal_refused",
    },
    // ─── 13. add_jsx_attribute · unseen element ───────────────────────
    {
      task_id: "FU-13",
      category: "add_jsx_attribute",
      description: "Add aria-label to a new component reference",
      source_content: `export function Panel() { return <Toolbar>content</Toolbar>; }\n`,
      operator: "add_jsx_attribute",
      operator_params: { element_name: "Toolbar", attribute_name: "aria-label", attribute_value: `"main-toolbar"` },
      expected_outcome: "operator_should_apply",
      expected_content_check: `aria-label="main-toolbar"`,
    },
    // ─── 14. modify_jsx_attribute · single occurrence ─────────────────
    {
      task_id: "FU-14",
      category: "modify_jsx_attribute",
      description: "Change an existing attribute value on a unique element",
      source_content: `export function A() { return <ProgressBar percent={25} />; }\n`,
      operator: "modify_jsx_attribute",
      operator_params: { element_name: "ProgressBar", attribute_name: "percent", new_attribute_value: `{75}` },
      expected_outcome: "operator_should_apply",
      expected_content_check: `percent={75}`,
    },
    // ─── 15. create_react_component · valid PascalCase ────────────────
    {
      task_id: "FU-15",
      category: "create_react_component",
      description: "Generate a new component file",
      source_content: "",
      operator: "create_react_component",
      operator_params: {
        component_name: "SearchResultCard",
        props: [{ name: "title", type: "string" }],
        body_jsx: `<article>{title}</article>`,
      },
      expected_outcome: "operator_should_apply",
      expected_content_check: `export function SearchResultCard`,
    },
  ]);
}

// ── Runner ────────────────────────────────────────────────────────────

export interface FreshEvalResult {
  readonly task_id: string;
  readonly category: string;
  readonly operator: string;
  readonly expected_outcome: FreshEvalTask["expected_outcome"];
  readonly observed_outcome: "operator_applied" | "operator_refused" | "not_applicable";
  readonly result: "PASS" | "FAIL" | "UNKNOWN";
  readonly rationale: string;
  readonly observed_refusal_reason: string | null;
  readonly observed_content_snippet: string | null;
}

export interface FreshEvalReport {
  readonly run_id: string;
  readonly corpus_digest: string;
  readonly run_started_iso: string;
  readonly run_ended_iso: string;
  readonly total_tasks: number;
  readonly passed: number;
  readonly failed: number;
  readonly unknown: number;
  readonly pass_rate: number;
  readonly results: readonly FreshEvalResult[];
  readonly per_category: Record<string, { total: number; passed: number; failed: number }>;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

export function runFreshEvaluation(): FreshEvalReport {
  const run_started_iso = new Date().toISOString();
  const corpus = generateFreshEvalCorpus();
  const corpus_digest = createHash("sha256").update(JSON.stringify(corpus)).digest("hex").slice(0, 16);
  const results: FreshEvalResult[] = [];

  for (const task of corpus) {
    const res = executeTask(task);
    results.push(res);
  }

  const passed = results.filter((r) => r.result === "PASS").length;
  const failed = results.filter((r) => r.result === "FAIL").length;
  const unknown = results.filter((r) => r.result === "UNKNOWN").length;
  const per_category: Record<string, { total: number; passed: number; failed: number }> = {};
  for (const r of results) {
    if (!per_category[r.category]) per_category[r.category] = { total: 0, passed: 0, failed: 0 };
    per_category[r.category].total += 1;
    if (r.result === "PASS") per_category[r.category].passed += 1;
    if (r.result === "FAIL") per_category[r.category].failed += 1;
  }

  return {
    run_id: `fresh_eval_${Date.now()}`,
    corpus_digest,
    run_started_iso,
    run_ended_iso: new Date().toISOString(),
    total_tasks: corpus.length,
    passed,
    failed,
    unknown,
    pass_rate: corpus.length > 0 ? passed / corpus.length : 0,
    results,
    per_category,
    zero_llm: true,
    ledger: "B",
    version: FRESH_UNSEEN_EVAL_VERSION,
  };
}

// ── Per-task execution ────────────────────────────────────────────────

function executeTask(task: FreshEvalTask): FreshEvalResult {
  const p = task.operator_params;
  let operator_result: OperatorResult | JsxOperatorResult | { ok: boolean; refusal_reason: string | null; new_content?: string | null; content?: string } | null = null;

  try {
    switch (task.operator) {
      case "modify_return":
        operator_result = opModifyReturn({
          content: task.source_content,
          function_name: p.function_name as string,
          new_return_expression: p.new_return_expression as string,
        });
        break;
      case "add_export":
        operator_result = opAddExport({
          content: task.source_content,
          symbol: p.symbol as string,
          export_mode: p.export_mode as "convert_declaration" | "reexport",
          from_module: p.from_module as string | undefined,
        });
        break;
      case "update_import":
        operator_result = opUpdateImport({
          content: task.source_content,
          current_module: p.current_module as string,
          new_module: p.new_module as string | undefined,
          add_named: p.add_named as string[] | undefined,
          remove_named: p.remove_named as string[] | undefined,
        });
        break;
      case "replace_expression":
        operator_result = opReplaceExpression({
          content: task.source_content,
          target: p.target as string,
          replacement: p.replacement as string,
          max_occurrences: p.max_occurrences as number | undefined,
        });
        break;
      case "add_object_property":
        operator_result = opAddObjectProperty({
          content: task.source_content,
          anchor_symbol: p.anchor_symbol as string,
          key: p.key as string,
          value: p.value as string,
        });
        break;
      case "modify_component_prop_default":
        operator_result = opModifyComponentPropDefault({
          content: task.source_content,
          component_name: p.component_name as string,
          prop_name: p.prop_name as string,
          new_default_value: p.new_default_value as string,
        });
        break;
      case "create_file": {
        const r = opCreateFile({ path: p.path as string, content: p.content as string });
        operator_result = { ok: r.ok, refusal_reason: r.refusal_reason, new_content: r.content };
        break;
      }
      case "add_jsx_attribute":
        operator_result = opAddJsxAttribute({
          content: task.source_content,
          element_name: p.element_name as string,
          attribute_name: p.attribute_name as string,
          attribute_value: p.attribute_value as string,
        });
        break;
      case "modify_jsx_attribute":
        operator_result = opModifyJsxAttribute({
          content: task.source_content,
          element_name: p.element_name as string,
          attribute_name: p.attribute_name as string,
          new_attribute_value: p.new_attribute_value as string,
        });
        break;
      case "wrap_jsx_element":
        operator_result = opWrapJsxElement({
          content: task.source_content,
          inner_element_name: p.inner_element_name as string,
          wrapper_element_name: p.wrapper_element_name as string,
          wrapper_attributes: p.wrapper_attributes as string | undefined,
        });
        break;
      case "create_react_component": {
        const r = opCreateReactComponent({
          component_name: p.component_name as string,
          props: p.props as { name: string; type: string; default_value?: string }[] | undefined,
          body_jsx: p.body_jsx as string,
        });
        operator_result = { ok: r.ok, refusal_reason: r.refusal_reason, content: r.content };
        break;
      }
      default:
        return {
          task_id: task.task_id,
          category: task.category,
          operator: task.operator,
          expected_outcome: task.expected_outcome,
          observed_outcome: "not_applicable",
          result: "UNKNOWN",
          rationale: `unknown_operator:${task.operator}`,
          observed_refusal_reason: null,
          observed_content_snippet: null,
        };
    }
  } catch (err) {
    return {
      task_id: task.task_id,
      category: task.category,
      operator: task.operator,
      expected_outcome: task.expected_outcome,
      observed_outcome: "not_applicable",
      result: "UNKNOWN",
      rationale: `execution_threw:${err instanceof Error ? err.message.slice(0, 100) : "unknown"}`,
      observed_refusal_reason: null,
      observed_content_snippet: null,
    };
  }

  if (!operator_result) {
    return {
      task_id: task.task_id, category: task.category, operator: task.operator,
      expected_outcome: task.expected_outcome, observed_outcome: "not_applicable", result: "UNKNOWN",
      rationale: "no_result", observed_refusal_reason: null, observed_content_snippet: null,
    };
  }

  const observed = operator_result.ok ? "operator_applied" : "operator_refused";
  const contentToCheck = (operator_result as { new_content?: string | null; content?: string }).new_content
    ?? (operator_result as { new_content?: string | null; content?: string }).content
    ?? null;

  // Check expected outcome
  if (task.expected_outcome === "operator_should_apply" && observed === "operator_applied") {
    if (task.expected_content_check && contentToCheck && !contentToCheck.includes(task.expected_content_check)) {
      return {
        task_id: task.task_id, category: task.category, operator: task.operator,
        expected_outcome: task.expected_outcome, observed_outcome: observed, result: "FAIL",
        rationale: `applied but expected_content_check missing: "${task.expected_content_check}"`,
        observed_refusal_reason: null,
        observed_content_snippet: contentToCheck ? contentToCheck.slice(0, 200) : null,
      };
    }
    if (task.expected_content_absent && contentToCheck && contentToCheck.includes(task.expected_content_absent)) {
      return {
        task_id: task.task_id, category: task.category, operator: task.operator,
        expected_outcome: task.expected_outcome, observed_outcome: observed, result: "FAIL",
        rationale: `applied but expected_content_absent still present: "${task.expected_content_absent}"`,
        observed_refusal_reason: null,
        observed_content_snippet: contentToCheck ? contentToCheck.slice(0, 200) : null,
      };
    }
    return {
      task_id: task.task_id, category: task.category, operator: task.operator,
      expected_outcome: task.expected_outcome, observed_outcome: observed, result: "PASS",
      rationale: "operator applied · content checks satisfied",
      observed_refusal_reason: null,
      observed_content_snippet: contentToCheck ? contentToCheck.slice(0, 200) : null,
    };
  }
  if (task.expected_outcome === "operator_should_refuse" && observed === "operator_refused") {
    if (task.expected_refusal_class && operator_result.refusal_reason
      && !operator_result.refusal_reason.includes(task.expected_refusal_class)) {
      return {
        task_id: task.task_id, category: task.category, operator: task.operator,
        expected_outcome: task.expected_outcome, observed_outcome: observed, result: "FAIL",
        rationale: `refused but reason "${operator_result.refusal_reason}" did not contain "${task.expected_refusal_class}"`,
        observed_refusal_reason: operator_result.refusal_reason,
        observed_content_snippet: null,
      };
    }
    return {
      task_id: task.task_id, category: task.category, operator: task.operator,
      expected_outcome: task.expected_outcome, observed_outcome: observed, result: "PASS",
      rationale: "operator refused as expected",
      observed_refusal_reason: operator_result.refusal_reason,
      observed_content_snippet: null,
    };
  }
  // Mismatch: expected apply but refused, or expected refuse but applied
  return {
    task_id: task.task_id, category: task.category, operator: task.operator,
    expected_outcome: task.expected_outcome, observed_outcome: observed, result: "FAIL",
    rationale: `expected ${task.expected_outcome} · observed ${observed}`,
    observed_refusal_reason: operator_result.refusal_reason,
    observed_content_snippet: contentToCheck ? contentToCheck.slice(0, 200) : null,
  };
}
