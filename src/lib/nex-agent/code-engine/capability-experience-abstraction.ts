// src/lib/nex-agent/code-engine/capability-experience-abstraction.ts
//
// NEX1 · Fix 34 · Cross-Experience Pattern Extractor.
// Founder-authorised 2026-09-18.
//
// PURPOSE
//   Read ACROSS source_files in the Fix 17 investigation-conclusion store,
//   extract deterministic structural features from each entry, group entries
//   whose features are identical, produce PatternRecord[] with support
//   counts. Provide a retrieval function that returns the best-matching
//   pattern for a target feature vector.
//
//   This is the "abstraction" step in
//     OBSERVE → EXTRACT → REPRESENT → ABSTRACT → GENERALISE → HYPOTHESISE
//     → CHALLENGE → VALIDATE → PROMOTE → PERSIST → RETRIEVE → APPLY
//   that has been missing from NEX1 to date.
//
// ANTI-CHEATING GUARANTEE
//   - The extractor knows NOTHING about specific fixtures. Its input is the
//     shape of entries in the store, not their names.
//   - Feature dimensions are declared in ONE table (SHAPE_FEATURE_DIMENSIONS)
//     and applied uniformly. No fixture-specific conditionals.
//   - Grouping is by exact-equality on the feature vector. No hidden bias.
//   - Retrieval is by exact-match then relaxation over a fixed ordering.
//     No "expected fixture" lookup.
//   - Support-count threshold is a caller-supplied minimum. No hardcoded
//     boost for any specific pattern.
//
// CONSTITUTIONAL PRESERVATION
//   - Zero LLM. Zero network.
//   - Pattern predictions are `evidence_kind: "INFERRED"` and carry an
//     R11-B marker · never enter R-4 SUPPORTING count.
//   - The abstraction NEVER changes the operator library.
//   - Q7/Q8/Fix 17/Fix 23a/b/c/Schema V1 UNCHANGED.

import fs from "node:fs";
import path from "node:path";
import type { InvestigationConclusionEntry } from "./investigation-conclusion-store";
import { getConclusionsStorePath } from "./investigation-conclusion-store";

// ── Public shape ────────────────────────────────────────────────────────

export type ValueType =
  | "number"
  | "string"
  | "boolean"
  | "empty"
  | "other";

export interface ShapeFeatures {
  readonly has_signature_format: boolean;
  readonly value_type: ValueType;
  readonly path_dir_root: string;
  readonly path_dir_second: string | null;
  readonly selection_state: InvestigationConclusionEntry["selection_state"];
}

export interface PatternRecord {
  readonly pattern_id: string;
  readonly features: ShapeFeatures;
  readonly support_count: number;
  readonly entry_ids: readonly string[];
  readonly first_seen: string;
  readonly last_seen: string;
  readonly evidence_kind: "INFERRED";
  readonly r11b_marker: "PATTERN_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
}

export interface RetrievalMatch {
  readonly pattern: PatternRecord;
  readonly match_kind: "exact" | "relaxed_second_dir" | "relaxed_state";
  readonly evidence_kind: "INFERRED";
}

export type RetrievalResult = RetrievalMatch | null;

// ── Feature-dimension table (the ONLY declarative knowledge) ────────────
//
// Every dimension is computed by a pure function that inspects the entry.
// No fixture-specific special cases. No hardcoded values.

const SHAPE_FEATURE_DIMENSIONS = [
  "has_signature_format",
  "value_type",
  "path_dir_root",
  "path_dir_second",
  "selection_state",
] as const;

// ── Feature extraction ───────────────────────────────────────────────────

function normSep(p: string): string {
  return p.replace(/\\/g, "/");
}

function classifyValueSuffix(v: string | null | undefined): ValueType {
  if (v === null || v === undefined || v === "") return "empty";
  if (/^-?\d+(\.\d+)?$/.test(v)) return "number";
  if (v === "true" || v === "false") return "boolean";
  if (/^["'`]/.test(v)) return "string";
  return "other";
}

export function extractShapeFeatures(entry: InvestigationConclusionEntry): ShapeFeatures {
  const sc = entry.selected_candidate;
  const has_sig = typeof sc === "string" && sc.includes("::");
  let value_type: ValueType = "empty";
  if (has_sig && typeof sc === "string") {
    const idx = sc.indexOf("::");
    const suffix = idx >= 0 ? sc.slice(idx + 2) : "";
    value_type = classifyValueSuffix(suffix);
  }
  const parts = normSep(entry.source_file ?? "").split("/");
  return {
    has_signature_format: has_sig,
    value_type,
    path_dir_root: parts[0] ?? "",
    path_dir_second: parts.length >= 2 ? (parts[1] ?? null) : null,
    selection_state: entry.selection_state,
  };
}

export function patternIdOf(f: ShapeFeatures): string {
  return [
    "pat",
    f.selection_state,
    f.value_type,
    f.has_signature_format ? "sig" : "nosig",
    f.path_dir_root || "-",
    f.path_dir_second ?? "-",
  ].join("-");
}

// ── Extraction / grouping ────────────────────────────────────────────────

export function extractPatterns(
  entries: readonly InvestigationConclusionEntry[],
): PatternRecord[] {
  const groups = new Map<
    string,
    {
      features: ShapeFeatures;
      entry_ids: string[];
      first: string;
      last: string;
    }
  >();
  for (const e of entries) {
    const f = extractShapeFeatures(e);
    const id = patternIdOf(f);
    const existing = groups.get(id);
    if (existing) {
      existing.entry_ids.push(e.entry_id);
      if (e.timestamp < existing.first) existing.first = e.timestamp;
      if (e.timestamp > existing.last) existing.last = e.timestamp;
    } else {
      groups.set(id, {
        features: f,
        entry_ids: [e.entry_id],
        first: e.timestamp,
        last: e.timestamp,
      });
    }
  }
  const records: PatternRecord[] = [];
  for (const [pattern_id, g] of groups.entries()) {
    records.push({
      pattern_id,
      features: g.features,
      support_count: g.entry_ids.length,
      entry_ids: [...g.entry_ids],
      first_seen: g.first,
      last_seen: g.last,
      evidence_kind: "INFERRED",
      r11b_marker: "PATTERN_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    });
  }
  // Deterministic order: descending support_count, then ascending pattern_id.
  records.sort((a, b) => {
    if (b.support_count !== a.support_count) return b.support_count - a.support_count;
    return a.pattern_id.localeCompare(b.pattern_id);
  });
  return records;
}

// ── Store loader (idempotent · read-only) ────────────────────────────────

export function loadAllEntriesFromStore(repo_root?: string): readonly InvestigationConclusionEntry[] {
  const storePath = getConclusionsStorePath(repo_root);
  if (!fs.existsSync(storePath)) return [];
  const raw = fs.readFileSync(storePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  const entries: InvestigationConclusionEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (
        parsed &&
        typeof parsed.entry_id === "string" &&
        typeof parsed.source_file === "string" &&
        typeof parsed.selection_state === "string" &&
        parsed.evidence_kind === "INFERRED"
      ) {
        entries.push(parsed);
      }
    } catch {
      /* skip malformed */
    }
  }
  return entries;
}

// ── Retrieval ────────────────────────────────────────────────────────────

export interface RetrievalQuery {
  readonly target_features: ShapeFeatures;
  readonly min_support: number;
}

/**
 * Deterministic retrieval:
 *   1. exact-feature match with support ≥ min_support
 *   2. relaxed on path_dir_second (allow null OR any) with same other dims
 *   3. relaxed on selection_state
 *
 * Returns first success in that order, or null.
 */
export function retrievePattern(
  patterns: readonly PatternRecord[],
  query: RetrievalQuery,
): RetrievalResult {
  const T = query.target_features;
  // Exact
  for (const p of patterns) {
    if (
      p.support_count >= query.min_support &&
      p.features.has_signature_format === T.has_signature_format &&
      p.features.value_type === T.value_type &&
      p.features.path_dir_root === T.path_dir_root &&
      p.features.path_dir_second === T.path_dir_second &&
      p.features.selection_state === T.selection_state
    ) {
      return { pattern: p, match_kind: "exact", evidence_kind: "INFERRED" };
    }
  }
  // Relaxed · second directory
  for (const p of patterns) {
    if (
      p.support_count >= query.min_support &&
      p.features.has_signature_format === T.has_signature_format &&
      p.features.value_type === T.value_type &&
      p.features.path_dir_root === T.path_dir_root &&
      p.features.selection_state === T.selection_state
    ) {
      return { pattern: p, match_kind: "relaxed_second_dir", evidence_kind: "INFERRED" };
    }
  }
  // Relaxed · selection_state
  for (const p of patterns) {
    if (
      p.support_count >= query.min_support &&
      p.features.has_signature_format === T.has_signature_format &&
      p.features.value_type === T.value_type &&
      p.features.path_dir_root === T.path_dir_root
    ) {
      return { pattern: p, match_kind: "relaxed_state", evidence_kind: "INFERRED" };
    }
  }
  return null;
}

// ── Convenience · one-shot from store ────────────────────────────────────

export function extractAndRetrieveFromStore(
  target_features: ShapeFeatures,
  min_support: number,
  repo_root?: string,
): {
  patterns: readonly PatternRecord[];
  match: RetrievalResult;
  total_entries: number;
} {
  const entries = loadAllEntriesFromStore(repo_root);
  const patterns = extractPatterns(entries);
  const match = retrievePattern(patterns, {
    target_features,
    min_support,
  });
  return { patterns, match, total_entries: entries.length };
}

export const EXPERIENCE_ABSTRACTION_VERSION = "fix34.v1";
export const _INTERNAL = { SHAPE_FEATURE_DIMENSIONS };
