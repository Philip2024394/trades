// NEX Migration Engine · shared types
// Deterministic TypeScript-interface → SQL DDL pipeline. No LLM · no external
// SQL CLI · no external network. Every step is pure-JS and reproducible.

export type SqlDialect = "postgresql" | "sqlite";

export interface ColumnDefinition {
  readonly name: string;
  readonly ts_type: string; // raw TypeScript type token ("number", "string", "boolean", "Date", "string | null")
  readonly sql_type: string; // resolved SQL type for the target dialect
  readonly is_nullable: boolean;
  readonly is_primary: boolean;
}

export interface TableSchema {
  readonly table_name: string;
  readonly columns: readonly ColumnDefinition[];
  readonly source_path: string; // repo-relative path of the TS file
  readonly interface_name: string;
}

export interface DdlStatement {
  readonly kind: "CREATE_TABLE" | "ADD_COLUMN";
  readonly sql: string;
  readonly evidence: string; // "TargetInterface.field" that triggered this statement
}

export interface DdlPlan {
  readonly dialect: SqlDialect;
  readonly target: TableSchema;
  readonly current: TableSchema | null;
  readonly statements: readonly DdlStatement[];
  readonly rejected: readonly PolicyRejection[];
  readonly ok: boolean;
  readonly planned_at: string;
}

export interface PolicyRejection {
  readonly kind: "DESTRUCTIVE_KEYWORD" | "UNSAFE_IDENTIFIER" | "UNRESOLVED_TYPE";
  readonly reason: string;
  readonly evidence: string;
}

export interface LedgerFile {
  readonly version: 1;
  readonly created_at: string;
  readonly updated_at: string;
  readonly tables: Readonly<Record<string, TableSchema>>;
}
