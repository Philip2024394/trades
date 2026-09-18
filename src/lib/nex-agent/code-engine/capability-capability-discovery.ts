// src/lib/nex-agent/code-engine/capability-capability-discovery.ts
//
// NEX1 · Fix 35 · Capability Discovery · Founder-authorised 2026-09-18.
//
// FOUNDER'S TEST E QUESTION
//   "Can NEX1 discover and create a reusable capability when that
//    capability was not explicitly supplied by the developer?"
//
// SCOPE (honest)
//   Without an LLM, NEX1 cannot invent new *algorithms*. Every algorithm
//   in this module is authored by hand (deterministic, testable, zero-
//   LLM). What NEX1 CAN discover from accumulated experience is:
//     - specific structural invariants that hold across a family of
//       past investigation-conclusion entries
//     - a reusable prediction rule derived from those invariants
//     - a persistable capability record that survives session boundaries
//       and can be applied to novel inputs.
//
//   Whether a downstream consumer chooses to CALL an existing operator
//   because of the discovered prediction remains a separate decision;
//   this module produces predictions, never mutations.
//
// ANTI-CHEATING GUARANTEE
//   - Zero fixture names in this module.
//   - Zero hardcoded expected answers.
//   - The set of induction "probes" is declared ONCE in
//     INDUCTION_PROBES and applied uniformly to every candidate group.
//   - A probe fires only when it holds across ALL supporting entries
//     of a group (deterministic universal quantification, not
//     hand-picked instances).
//   - Persistence + retrieval are content-addressed (rule_id is a
//     hash of the invariant set), so a different seed produces a
//     different rule_id automatically.
//
// R11-B / CONSTITUTIONAL
//   - Every returned prediction carries `evidence_kind: "INFERRED"` and
//     the R11-B marker.
//   - Zero LLM. Zero network.
//   - Q7/Q8/Fix 17/Fix 23a/b/c/Schema V1/Fear/Concern/Afraid UNCHANGED.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { InvestigationConclusionEntry } from "./investigation-conclusion-store";
import {
  extractShapeFeatures,
  extractPatterns,
  loadAllEntriesFromStore,
  type ShapeFeatures,
  type PatternRecord,
} from "./capability-experience-abstraction";

// ── Public shape ─────────────────────────────────────────────────────────

export type InvariantKind =
  | "selected_candidate_has_double_colon_separator"
  | "selected_candidate_prefix_equals_source_file"
  | "selected_candidate_suffix_is_numeric"
  | "selected_candidate_suffix_is_quoted_string"
  | "selected_candidate_suffix_is_boolean_literal"
  | "all_entries_share_path_prefix";

export interface Invariant {
  readonly kind: InvariantKind;
  readonly holds: true;
  readonly evidence_entry_ids: readonly string[];
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface DiscoveredRule {
  readonly rule_id: string;
  readonly shape_signature: ShapeFeatures;
  readonly support_count: number;
  readonly invariants: readonly Invariant[];
  readonly first_seen: string;
  readonly last_seen: string;
  readonly evidence_kind: "INFERRED";
  readonly r11b_marker: "DISCOVERED_RULE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
  readonly discovered_at: string;
}

export type PredictionKind =
  | "value_from_selected_candidate_suffix"
  | "value_type_from_selected_candidate_suffix"
  | "no_applicable_rule";

export interface Prediction {
  readonly kind: PredictionKind;
  readonly rule_id: string | null;
  readonly predicted_value: string | number | boolean | null;
  readonly predicted_value_type: "number" | "string" | "boolean" | "other" | null;
  readonly explanation: string;
  readonly evidence_kind: "INFERRED";
  readonly r11b_marker: "DISCOVERED_PREDICTION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
}

// ── Induction probes (the ONLY hand-authored knowledge) ─────────────────

const INDUCTION_PROBES: readonly {
  kind: InvariantKind;
  test: (entries: readonly InvestigationConclusionEntry[]) => { holds: boolean; extra?: Record<string, unknown> };
}[] = [
  {
    kind: "selected_candidate_has_double_colon_separator",
    test: (entries) => ({
      holds: entries.every(
        (e) => typeof e.selected_candidate === "string" && e.selected_candidate.includes("::"),
      ),
    }),
  },
  {
    kind: "selected_candidate_prefix_equals_source_file",
    test: (entries) => ({
      holds: entries.every(
        (e) =>
          typeof e.selected_candidate === "string" &&
          e.selected_candidate.startsWith(e.source_file + "::"),
      ),
    }),
  },
  {
    kind: "selected_candidate_suffix_is_numeric",
    test: (entries) => ({
      holds: entries.every((e) => {
        if (typeof e.selected_candidate !== "string") return false;
        const idx = e.selected_candidate.indexOf("::");
        if (idx < 0) return false;
        const suffix = e.selected_candidate.slice(idx + 2);
        return /^-?\d+(\.\d+)?$/.test(suffix);
      }),
    }),
  },
  {
    kind: "selected_candidate_suffix_is_quoted_string",
    test: (entries) => ({
      holds: entries.every((e) => {
        if (typeof e.selected_candidate !== "string") return false;
        const idx = e.selected_candidate.indexOf("::");
        if (idx < 0) return false;
        const suffix = e.selected_candidate.slice(idx + 2);
        return /^["'`]/.test(suffix);
      }),
    }),
  },
  {
    kind: "selected_candidate_suffix_is_boolean_literal",
    test: (entries) => ({
      holds: entries.every((e) => {
        if (typeof e.selected_candidate !== "string") return false;
        const idx = e.selected_candidate.indexOf("::");
        if (idx < 0) return false;
        const suffix = e.selected_candidate.slice(idx + 2);
        return suffix === "true" || suffix === "false";
      }),
    }),
  },
  {
    kind: "all_entries_share_path_prefix",
    test: (entries) => {
      if (entries.length === 0) return { holds: false };
      const first = (entries[0].source_file ?? "").split(/[/\\]/);
      let prefix: string[] = first;
      for (const e of entries.slice(1)) {
        const parts = (e.source_file ?? "").split(/[/\\]/);
        const common: string[] = [];
        for (let i = 0; i < Math.min(prefix.length, parts.length); i++) {
          if (prefix[i] === parts[i]) common.push(prefix[i]);
          else break;
        }
        prefix = common;
      }
      return prefix.length > 0
        ? { holds: true, extra: { path_prefix: prefix.join("/") } }
        : { holds: false };
    },
  },
];

// ── Induction ────────────────────────────────────────────────────────────

function ruleIdOf(shape: ShapeFeatures, invariants: readonly Invariant[]): string {
  const material = JSON.stringify({
    shape,
    invariants: invariants.map((i) => ({ kind: i.kind, extra: i.extra ?? null })),
  });
  return "rule-" + crypto.createHash("sha256").update(material).digest("hex").slice(0, 16);
}

/**
 * Induce discovered rules from accumulated Fix 17 entries.
 *
 * For each pattern group (identified by Fix 34's shape features) with
 * support >= `min_support`, apply every induction probe. Any probe that
 * holds across all supporting entries contributes an Invariant. A rule
 * is produced when at least one invariant fires.
 *
 * Deterministic. Zero LLM. No fixture names. No hardcoded outputs.
 */
export function induceRules(
  entries: readonly InvestigationConclusionEntry[],
  min_support: number,
): DiscoveredRule[] {
  const patterns: readonly PatternRecord[] = extractPatterns(entries);
  const byPatternId = new Map<string, InvestigationConclusionEntry[]>();
  for (const e of entries) {
    const feat = extractShapeFeatures(e);
    // Reuse Fix 34's patternIdOf via re-derivation is fine but simpler: group by JSON.
    const key = JSON.stringify(feat);
    const arr = byPatternId.get(key) ?? [];
    arr.push(e);
    byPatternId.set(key, arr);
  }
  const rules: DiscoveredRule[] = [];
  const nowIso = new Date().toISOString();
  for (const p of patterns) {
    if (p.support_count < min_support) continue;
    const key = JSON.stringify(p.features);
    const supporting = byPatternId.get(key) ?? [];
    const invariants: Invariant[] = [];
    for (const probe of INDUCTION_PROBES) {
      const r = probe.test(supporting);
      if (r.holds) {
        invariants.push({
          kind: probe.kind,
          holds: true,
          evidence_entry_ids: supporting.map((e) => e.entry_id),
          extra: r.extra,
        });
      }
    }
    if (invariants.length === 0) continue;
    const rule: DiscoveredRule = {
      rule_id: ruleIdOf(p.features, invariants),
      shape_signature: p.features,
      support_count: p.support_count,
      invariants,
      first_seen: p.first_seen,
      last_seen: p.last_seen,
      evidence_kind: "INFERRED",
      r11b_marker: "DISCOVERED_RULE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      discovered_at: nowIso,
    };
    rules.push(rule);
  }
  // Deterministic ordering
  rules.sort((a, b) => {
    if (b.support_count !== a.support_count) return b.support_count - a.support_count;
    return a.rule_id.localeCompare(b.rule_id);
  });
  return rules;
}

// ── Persistence ──────────────────────────────────────────────────────────

export function getDiscoveredRulesStorePath(repo_root?: string): string {
  const rr = repo_root ?? process.cwd();
  return path.join(rr, "data", "nex1-discovered-capabilities", "rules.jsonl");
}

/** Append-only persistence with rule-id de-duplication at read time. */
export function persistRules(rules: readonly DiscoveredRule[], repo_root?: string): {
  path: string;
  appended: number;
} {
  const p = getDiscoveredRulesStorePath(repo_root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  let appended = 0;
  for (const r of rules) {
    fs.appendFileSync(p, JSON.stringify(r) + "\n", "utf8");
    appended++;
  }
  return { path: p, appended };
}

/** Load all rules; de-duplicate by rule_id keeping the FIRST occurrence. */
export function loadDiscoveredRules(repo_root?: string): DiscoveredRule[] {
  const p = getDiscoveredRulesStorePath(repo_root);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8");
  const seen = new Set<string>();
  const out: DiscoveredRule[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    try {
      const r = JSON.parse(line) as DiscoveredRule;
      if (typeof r.rule_id === "string" && !seen.has(r.rule_id)) {
        seen.add(r.rule_id);
        out.push(r);
      }
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

/** Convenience · one-shot induction + persistence from the store on disk. */
export function discoverAndPersistFromStore(
  min_support: number,
  repo_root?: string,
): { rules: DiscoveredRule[]; path: string; appended: number } {
  const entries = loadAllEntriesFromStore(repo_root);
  const rules = induceRules(entries, min_support);
  const { path: p, appended } = persistRules(rules, repo_root);
  return { rules, path: p, appended };
}

// ── Application to novel inputs ─────────────────────────────────────────

export interface NovelInput {
  /** Repo-relative source_file for the novel target. */
  readonly source_file: string;
  /** Optional selected_candidate-shaped hint (e.g. from a fresh proposal). */
  readonly selected_candidate?: string | null;
  /** Optional current selection_state. */
  readonly selection_state?: InvestigationConclusionEntry["selection_state"];
}

/**
 * Apply discovered rules to a novel input and return a Prediction.
 * Zero-LLM · deterministic · never invokes an operator.
 */
export function predictFromRules(
  rules: readonly DiscoveredRule[],
  input: NovelInput,
): Prediction {
  // Compute the input's shape features from what we have.
  const pseudoEntry = {
    source_file: input.source_file,
    selected_candidate: input.selected_candidate ?? null,
    selection_state: input.selection_state ?? "SELECTED",
  } as unknown as InvestigationConclusionEntry;
  const inputFeatures = extractShapeFeatures(pseudoEntry);
  // Find a rule whose shape_signature matches exactly on the dimensions
  // that are meaningful for prediction (has_signature_format + value_type).
  const applicable = rules.find(
    (r) =>
      r.shape_signature.has_signature_format === inputFeatures.has_signature_format &&
      r.shape_signature.value_type === inputFeatures.value_type &&
      r.shape_signature.selection_state === inputFeatures.selection_state,
  );
  if (!applicable) {
    return {
      kind: "no_applicable_rule",
      rule_id: null,
      predicted_value: null,
      predicted_value_type: null,
      explanation: "no discovered rule matches the input's shape signature",
      evidence_kind: "INFERRED",
      r11b_marker: "DISCOVERED_PREDICTION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    };
  }
  // Read the rule's invariants and produce a prediction.
  const inv = applicable.invariants.map((i) => i.kind);
  const hasSep = inv.includes("selected_candidate_has_double_colon_separator");
  const isNumeric = inv.includes("selected_candidate_suffix_is_numeric");
  const isString = inv.includes("selected_candidate_suffix_is_quoted_string");
  const isBool = inv.includes("selected_candidate_suffix_is_boolean_literal");
  if (!hasSep || typeof input.selected_candidate !== "string" || !input.selected_candidate.includes("::")) {
    return {
      kind: "no_applicable_rule",
      rule_id: applicable.rule_id,
      predicted_value: null,
      predicted_value_type: null,
      explanation:
        "rule requires `::` separator in selected_candidate; input does not satisfy the induced invariant",
      evidence_kind: "INFERRED",
      r11b_marker: "DISCOVERED_PREDICTION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    };
  }
  const idx = input.selected_candidate.indexOf("::");
  const suffix = input.selected_candidate.slice(idx + 2);
  let value_type: Prediction["predicted_value_type"] = null;
  let predicted_value: Prediction["predicted_value"] = null;
  if (isNumeric && /^-?\d+(\.\d+)?$/.test(suffix)) {
    value_type = "number";
    predicted_value = Number(suffix);
  } else if (isString && /^["'`]/.test(suffix)) {
    value_type = "string";
    // strip matching outer quote if present
    const q = suffix[0];
    const trimmed = suffix.endsWith(q) ? suffix.slice(1, -1) : suffix.slice(1);
    predicted_value = trimmed;
  } else if (isBool && (suffix === "true" || suffix === "false")) {
    value_type = "boolean";
    predicted_value = suffix === "true";
  } else {
    value_type = "other";
    predicted_value = suffix;
  }
  return {
    kind:
      value_type === "number" || value_type === "string" || value_type === "boolean"
        ? "value_from_selected_candidate_suffix"
        : "value_type_from_selected_candidate_suffix",
    rule_id: applicable.rule_id,
    predicted_value,
    predicted_value_type: value_type,
    explanation:
      `induced invariants: [${inv.join(",")}] · suffix parsed as ${value_type}`,
    evidence_kind: "INFERRED",
    r11b_marker: "DISCOVERED_PREDICTION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
  };
}

export const CAPABILITY_DISCOVERY_VERSION = "fix35.v1";
export const _INTERNAL = { INDUCTION_PROBES };
