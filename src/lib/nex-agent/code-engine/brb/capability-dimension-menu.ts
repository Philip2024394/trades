// src/lib/nex-agent/code-engine/brb/capability-dimension-menu.ts
//
// NEX1 · Dimension Menu · Ledger B · γ experiment substrate.
//
// PURPOSE
//   Enumerate a BROAD set of candidate generic structural dimensions.
//   Every dimension is a pure function: Experience → observable value.
//   NEX's γ selection mechanism will rank these by outcome-correlation
//   on a labelled corpus.
//
// ANTI-CHEATING PROTECTIONS
//   · No dimension is named or shaped after the target relationship.
//   · No dimension checks for "declared/registered/configured" vocabulary.
//   · No dimension checks specifically for the pattern that fires on λ.
//   · The menu deliberately includes RED HERRINGS · dimensions that are
//     structurally generic but unlikely to correlate with outcome on
//     the λ corpus.
//   · Every dimension applies to any experience regardless of schema.
//
// The menu is Ledger B. NEX's selection from the menu is data-derived.

import type { Experience } from "./capability-brain-similarities";

// ── Dimension type ────────────────────────────────────────────────────

export interface DimensionDefinition {
  readonly id: string;
  readonly description: string;
  /** Pure function of an Experience · returns a discrete observable value */
  readonly extract: (e: Experience) => string | number | boolean;
}

// ── The menu · 24 generic structural dimensions ───────────────────────
//
// Grouped by category so it's clear no target-relationship coupling.

export const DIMENSION_MENU: readonly DimensionDefinition[] = [
  // ── Presence bits (5 · same shape as v2 signature dimensions plus extras) ──
  {
    id: "has_numeric_zero",
    description: "at least one numeric field with value 0",
    extract: (e) => Object.values(e.facts).some((v) => typeof v === "number" && v === 0),
  },
  {
    id: "has_numeric_nonzero",
    description: "at least one numeric field with non-zero value",
    extract: (e) => Object.values(e.facts).some((v) => typeof v === "number" && v !== 0),
  },
  {
    id: "has_string",
    description: "at least one string field",
    extract: (e) => Object.values(e.facts).some((v) => typeof v === "string"),
  },
  {
    id: "has_boolean",
    description: "at least one boolean field",
    extract: (e) => Object.values(e.facts).some((v) => typeof v === "boolean"),
  },
  {
    id: "has_null_field",
    description: "at least one null-valued field",
    extract: (e) => Object.values(e.facts).some((v) => v === null),
  },

  // ── Count / cardinality (5) ──
  {
    id: "field_count_bucket",
    description: "small (≤2) / medium (3–5) / large (6+) field count",
    extract: (e) => {
      const n = Object.keys(e.facts).length;
      return n <= 2 ? "small" : n <= 5 ? "medium" : "large";
    },
  },
  {
    id: "numeric_field_count_bucket",
    description: "number of numeric fields · none / few / many",
    extract: (e) => {
      const n = Object.values(e.facts).filter((v) => typeof v === "number").length;
      return n === 0 ? "none" : n <= 2 ? "few" : "many";
    },
  },
  {
    id: "string_field_count_bucket",
    description: "number of string fields · none / few / many",
    extract: (e) => {
      const n = Object.values(e.facts).filter((v) => typeof v === "string").length;
      return n === 0 ? "none" : n <= 2 ? "few" : "many";
    },
  },
  {
    id: "string_token_bucket",
    description: "total token count across all string fields · none / few / many",
    extract: (e) => {
      let n = 0;
      for (const v of Object.values(e.facts)) {
        if (typeof v === "string") n += v.toLowerCase().split(/[\s._\-\/@:]+/).filter((t) => t.length > 0).length;
      }
      return n === 0 ? "none" : n <= 3 ? "few" : "many";
    },
  },
  {
    id: "distinct_value_types_count",
    description: "how many different value types appear (string, number, boolean, null)",
    extract: (e) => new Set(Object.values(e.facts).map((v) => v === null ? "null" : typeof v)).size,
  },

  // ── Numeric magnitude / range (4) ──
  {
    id: "max_numeric_bucket",
    description: "max numeric value · zero / small / large",
    extract: (e) => {
      const nums = Object.values(e.facts).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      if (nums.length === 0) return "no_numeric";
      const max = Math.max(...nums);
      return max === 0 ? "zero" : max < 100 ? "small" : "large";
    },
  },
  {
    id: "min_numeric_bucket",
    description: "min numeric value · zero / positive / negative",
    extract: (e) => {
      const nums = Object.values(e.facts).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      if (nums.length === 0) return "no_numeric";
      const min = Math.min(...nums);
      return min < 0 ? "negative" : min === 0 ? "zero" : "positive";
    },
  },
  {
    id: "any_numeric_matches_field_count",
    description: "any numeric value equals the total field count (a generic structural coincidence)",
    extract: (e) => {
      const n = Object.keys(e.facts).length;
      return Object.values(e.facts).some((v) => typeof v === "number" && v === n);
    },
  },
  {
    id: "numeric_range_bucket",
    description: "max minus min numeric value · zero / small / large",
    extract: (e) => {
      const nums = Object.values(e.facts).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      if (nums.length === 0) return "no_numeric";
      const range = Math.max(...nums) - Math.min(...nums);
      return range === 0 ? "zero" : range < 100 ? "small" : "large";
    },
  },

  // ── String characteristics (5 · deliberately generic) ──
  {
    id: "has_long_string",
    description: "at least one string longer than 20 chars",
    extract: (e) => Object.values(e.facts).some((v) => typeof v === "string" && v.length > 20),
  },
  {
    id: "any_string_contains_digit",
    description: "at least one string field contains a digit",
    extract: (e) => Object.values(e.facts).some((v) => typeof v === "string" && /\d/.test(v)),
  },
  {
    id: "any_string_has_dot",
    description: "at least one string field contains a period",
    extract: (e) => Object.values(e.facts).some((v) => typeof v === "string" && v.includes(".")),
  },
  {
    id: "any_string_has_slash",
    description: "at least one string field contains a slash",
    extract: (e) => Object.values(e.facts).some((v) => typeof v === "string" && (v.includes("/") || v.includes("\\"))),
  },
  {
    id: "any_string_has_underscore",
    description: "at least one string field contains an underscore",
    extract: (e) => Object.values(e.facts).some((v) => typeof v === "string" && v.includes("_")),
  },

  // ── Field-name characteristics (4 · schema-agnostic aggregates) ──
  {
    id: "any_field_name_starts_with_upper",
    description: "at least one field name starts with uppercase (schema-agnostic aggregate)",
    extract: (e) => Object.keys(e.facts).some((k) => /^[A-Z]/.test(k)),
  },
  {
    id: "avg_field_name_length_bucket",
    description: "average field name length · short (<8) / medium (8-15) / long (16+)",
    extract: (e) => {
      const keys = Object.keys(e.facts);
      if (keys.length === 0) return "empty";
      const avg = keys.reduce((s, k) => s + k.length, 0) / keys.length;
      return avg < 8 ? "short" : avg < 16 ? "medium" : "long";
    },
  },
  {
    id: "any_field_name_contains_underscore",
    description: "at least one field name contains an underscore (naming convention indicator)",
    extract: (e) => Object.keys(e.facts).some((k) => k.includes("_")),
  },
  {
    id: "field_name_uniqueness_bucket",
    description: "shortest field name length · 1-3 / 4-8 / 9+",
    extract: (e) => {
      const keys = Object.keys(e.facts);
      if (keys.length === 0) return "empty";
      const min = Math.min(...keys.map((k) => k.length));
      return min <= 3 ? "very_short" : min <= 8 ? "short" : "long";
    },
  },

  // ── Outcome dimension (1) ──
  {
    id: "outcome",
    description: "the experience outcome · success / failure / unknown",
    extract: (e) => e.outcome,
  },
];

export const DIMENSION_MENU_VERSION = "dimension-menu.v1.n24";
