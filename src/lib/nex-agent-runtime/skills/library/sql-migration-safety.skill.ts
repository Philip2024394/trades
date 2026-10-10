// §36-E-3B · WAVE-E3B · 2026-09-14 · first-real-skills
// NEX bounded infrastructure · skill definition · sql-migration-safety · 2026-09-14
// Provenance recorded on the exported skill object as bounded NEX infrastructure. NOT NEX1-authored capability.
//
// Skill: sql-migration-safety
// Domain: database

import { createHash } from "node:crypto";
import type { Skill } from "../skill-schema-types";

const AUTHORING_EVIDENCE = createHash("sha256")
  .update("§36-E-3B · WAVE-E3B · 2026-09-14 · sql-migration-safety", "utf8")
  .digest("hex");

export const SQL_MIGRATION_SAFETY_SKILL: Skill = {
  identity: {
    slug: "sql-migration-safety",
    version: "1.0.0",
    display_name: "SQL · Migration Safety Discipline",
    domain: "database",
  },
  applicability: {
    applicable_languages: ["sql"],
    applicable_frameworks: ["postgresql", "supabase"],
    applicable_change_kinds: ["file_new"],
  },
  validators: [
    {
      validator_id: "must_be_sql_or_ts_migration",
      predicate_id: "path_matches_regex",
      predicate_args: {
        kind: "path_matches_regex",
        regex: "(migrations/|migration).*\\.(sql|ts)$",
      },
      kind: "precondition",
      rationale: "Skill applies to migration files under migrations/ paths",
    },
    {
      validator_id: "no_drop_table_without_if_exists",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "DROP TABLE(?!\\s+IF\\s+EXISTS)",
      },
      kind: "anti_pattern",
      rationale: "DROP TABLE must include IF EXISTS to be idempotent",
    },
    {
      validator_id: "no_drop_column_without_if_exists",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "DROP COLUMN(?!\\s+IF\\s+EXISTS)",
      },
      kind: "anti_pattern",
      rationale: "DROP COLUMN must include IF EXISTS to be idempotent",
    },
    {
      validator_id: "add_column_default_or_nullable",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "ADD COLUMN\\s+\\w+\\s+\\w+\\s+NOT\\s+NULL\\s*;",
      },
      kind: "anti_pattern",
      rationale: "ADD COLUMN NOT NULL without DEFAULT locks rows and fails on non-empty tables",
    },
    {
      validator_id: "no_bare_delete_without_where",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "DELETE\\s+FROM\\s+\\w+\\s*;",
      },
      kind: "anti_pattern",
      rationale: "DELETE without WHERE is almost never intended · use TRUNCATE explicitly",
    },
    {
      validator_id: "no_bare_update_without_where",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "UPDATE\\s+\\w+\\s+SET\\s+[^;]{1,200};",
      },
      kind: "anti_pattern",
      rationale: "UPDATE without WHERE mutates every row · always include WHERE explicitly",
    },
    {
      validator_id: "prefer_create_index_concurrently",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "CREATE INDEX(?!\\s+CONCURRENTLY|\\s+IF\\s+NOT\\s+EXISTS)",
      },
      kind: "anti_pattern",
      rationale: "Prefer CREATE INDEX CONCURRENTLY on production tables to avoid write locks",
    },
    {
      validator_id: "no_alter_type_data_type",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "ALTER COLUMN\\s+\\w+\\s+TYPE",
      },
      kind: "anti_pattern",
      rationale: "ALTER COLUMN TYPE requires an exclusive lock · plan two-phase migration",
    },
  ],
  procedures: [
    {
      step_id: "verify-idempotence",
      step_kind: "verify",
      description: "Every destructive statement must be idempotent (IF EXISTS or IF NOT EXISTS)",
      required_predicate_verdicts: [
        { validator_id: "no_drop_table_without_if_exists", required_verdict: "satisfied" },
        { validator_id: "no_drop_column_without_if_exists", required_verdict: "satisfied" },
      ],
    },
    {
      step_id: "verify-locking-safety",
      step_kind: "verify",
      description: "Locking-hazardous operations flagged",
      required_predicate_verdicts: [
        { validator_id: "add_column_default_or_nullable", required_verdict: "satisfied" },
        { validator_id: "no_alter_type_data_type", required_verdict: "satisfied" },
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
