// NEX Migration Engine · TypeScript interface → TableSchema
// Uses the TypeScript compiler API that already ships with the project
// (no new npm dependency). Reads a .ts file, finds a named exported
// interface, walks its properties, maps them to SQL columns for the
// requested dialect.

import { readFileSync, existsSync } from "node:fs";
import * as ts from "typescript";
import * as path from "node:path";
import { assertSafeIdentifier } from "./policy";
import type { ColumnDefinition, SqlDialect, TableSchema, PolicyRejection } from "./types";

const REPO_ROOT = process.cwd();

export interface ParseOptions {
  readonly interface_name: string;
  readonly table_name: string;
  readonly dialect: SqlDialect;
}

export interface ParseResult {
  readonly schema: TableSchema | null;
  readonly rejections: readonly PolicyRejection[];
}

export function parseInterfaceToSchema(rel_or_abs_path: string, opts: ParseOptions): ParseResult {
  assertSafeIdentifier(opts.table_name, "table");
  assertSafeIdentifier(opts.interface_name, "interface");

  const abs = path.isAbsolute(rel_or_abs_path) ? rel_or_abs_path : path.resolve(REPO_ROOT, rel_or_abs_path);
  if (!existsSync(abs)) {
    return {
      schema: null,
      rejections: [
        { kind: "UNRESOLVED_TYPE", reason: `source file not found: ${rel_or_abs_path}`, evidence: rel_or_abs_path },
      ],
    };
  }

  const source_text = readFileSync(abs, "utf8");
  const source = ts.createSourceFile(abs, source_text, ts.ScriptTarget.Latest, /*setParentNodes*/ true, ts.ScriptKind.TS);

  const decl = findInterfaceDeclaration(source, opts.interface_name);
  if (!decl) {
    return {
      schema: null,
      rejections: [
        {
          kind: "UNRESOLVED_TYPE",
          reason: `interface "${opts.interface_name}" not found (must be an exported named interface)`,
          evidence: rel_or_abs_path,
        },
      ],
    };
  }

  const columns: ColumnDefinition[] = [];
  const rejections: PolicyRejection[] = [];

  for (const member of decl.members) {
    if (!ts.isPropertySignature(member)) continue;
    if (!member.name || !ts.isIdentifier(member.name)) continue;
    const name = member.name.text;
    if (!nameIsSafe(name)) {
      rejections.push({
        kind: "UNSAFE_IDENTIFIER",
        reason: `column identifier "${name}" is not safe (only [A-Za-z_][A-Za-z0-9_]{0,62})`,
        evidence: name,
      });
      continue;
    }
    const ts_type = typeText(member.type);
    const nullable = member.questionToken !== undefined || typeUnionIncludesNull(member.type);
    const resolved = resolveSqlType(member.type, opts.dialect);
    if (!resolved.ok) {
      rejections.push({
        kind: "UNRESOLVED_TYPE",
        reason: resolved.reason,
        evidence: `${opts.interface_name}.${name}: ${ts_type}`,
      });
      continue;
    }
    const is_primary = name === "id";
    columns.push({
      name,
      ts_type,
      sql_type: resolved.sql_type,
      is_nullable: nullable && !is_primary,
      is_primary,
    });
  }

  const schema: TableSchema = {
    table_name: opts.table_name,
    columns,
    source_path: path.relative(REPO_ROOT, abs).replace(/\\/g, "/"),
    interface_name: opts.interface_name,
  };
  return { schema, rejections };
}

function findInterfaceDeclaration(source: ts.SourceFile, target_name: string): ts.InterfaceDeclaration | null {
  let hit: ts.InterfaceDeclaration | null = null;
  source.forEachChild((node) => {
    if (hit) return;
    if (ts.isInterfaceDeclaration(node) && node.name.text === target_name) {
      hit = node;
    }
  });
  return hit;
}

function typeText(t: ts.TypeNode | undefined): string {
  if (!t) return "unknown";
  return t.getText();
}

function typeUnionIncludesNull(t: ts.TypeNode | undefined): boolean {
  if (!t) return false;
  if (!ts.isUnionTypeNode(t)) return false;
  return t.types.some(
    (u) =>
      (ts.isLiteralTypeNode(u) && u.literal.kind === ts.SyntaxKind.NullKeyword) ||
      u.kind === ts.SyntaxKind.UndefinedKeyword,
  );
}

interface TypeResolve {
  readonly ok: boolean;
  readonly sql_type: string;
  readonly reason: string;
}

function resolveSqlType(t: ts.TypeNode | undefined, dialect: SqlDialect): TypeResolve {
  if (!t) return { ok: false, sql_type: "", reason: "no type annotation" };

  // Unwrap `T | null` and `T | undefined`.
  if (ts.isUnionTypeNode(t)) {
    const meaningful = t.types.filter(
      (u) =>
        !(ts.isLiteralTypeNode(u) && u.literal.kind === ts.SyntaxKind.NullKeyword) &&
        u.kind !== ts.SyntaxKind.UndefinedKeyword,
    );
    if (meaningful.length === 1 && meaningful[0]) {
      return resolveSqlType(meaningful[0], dialect);
    }
    // union of literals — treat as TEXT (a small enum), still safe
    return { ok: true, sql_type: "TEXT", reason: "union of literals mapped to TEXT" };
  }

  switch (t.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { ok: true, sql_type: "TEXT", reason: "string" };
    case ts.SyntaxKind.NumberKeyword:
      return { ok: true, sql_type: dialect === "postgresql" ? "BIGINT" : "INTEGER", reason: "number" };
    case ts.SyntaxKind.BooleanKeyword:
      return { ok: true, sql_type: dialect === "postgresql" ? "BOOLEAN" : "INTEGER", reason: "boolean" };
  }

  if (ts.isTypeReferenceNode(t)) {
    const name = t.typeName.getText();
    if (name === "Date") {
      return {
        ok: true,
        sql_type: dialect === "postgresql" ? "TIMESTAMP WITH TIME ZONE" : "TEXT",
        reason: "Date",
      };
    }
    if (name === "Buffer" || name === "Uint8Array") {
      return { ok: true, sql_type: dialect === "postgresql" ? "BYTEA" : "BLOB", reason: name };
    }
  }

  return {
    ok: false,
    sql_type: "",
    reason: `unsupported TypeScript type in migration context: ${typeText(t)}`,
  };
}

function nameIsSafe(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name);
}
