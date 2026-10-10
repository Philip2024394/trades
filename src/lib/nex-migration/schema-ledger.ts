// NEX Migration Engine · schema ledger
// Persistent record of the current known schema per table. Lives in
// `data/nex-migration/live-schema.json` (NOT in the coding-chat namespace;
// migrations have their own data home). Writes are atomic (tmp + rename).
//
// Rollback support = removing a table from the ledger. The engine NEVER
// deletes or modifies any physical database file.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import type { LedgerFile, TableSchema } from "./types";
import { assertSafeIdentifier } from "./policy";

const REPO_ROOT = process.cwd();
const LEDGER_DIR = path.join(REPO_ROOT, "data", "nex-migration");
const LEDGER_PATH = path.join(LEDGER_DIR, "live-schema.json");

function ensureLedgerDir(): void {
  if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
}

/** Load the ledger; returns an empty one if none exists. */
export function loadLedger(): LedgerFile {
  if (!existsSync(LEDGER_PATH)) {
    const now = new Date().toISOString();
    return { version: 1, created_at: now, updated_at: now, tables: {} };
  }
  return JSON.parse(readFileSync(LEDGER_PATH, "utf8")) as LedgerFile;
}

/** Get the recorded schema for a table, or null if unrecorded. */
export function getTableSchema(table_name: string): TableSchema | null {
  const ledger = loadLedger();
  return ledger.tables[table_name] ?? null;
}

/** Insert or replace a table's recorded schema · atomic write. */
export function saveTableSchema(schema: TableSchema): LedgerFile {
  assertSafeIdentifier(schema.table_name, "table");
  ensureLedgerDir();
  const ledger = loadLedger();
  const nextTables: Record<string, TableSchema> = { ...ledger.tables, [schema.table_name]: schema };
  const next: LedgerFile = {
    version: 1,
    created_at: ledger.created_at,
    updated_at: new Date().toISOString(),
    tables: nextTables,
  };
  atomicWrite(LEDGER_PATH, JSON.stringify(next, null, 2));
  return next;
}

/** Remove a table from the ledger (rollback-in-ledger only · never touches physical files). */
export function forgetTableSchema(table_name: string): { removed: boolean; ledger: LedgerFile } {
  assertSafeIdentifier(table_name, "table");
  ensureLedgerDir();
  const ledger = loadLedger();
  if (!(table_name in ledger.tables)) {
    return { removed: false, ledger };
  }
  const nextTables = { ...ledger.tables };
  delete nextTables[table_name];
  const next: LedgerFile = {
    version: 1,
    created_at: ledger.created_at,
    updated_at: new Date().toISOString(),
    tables: nextTables,
  };
  atomicWrite(LEDGER_PATH, JSON.stringify(next, null, 2));
  return { removed: true, ledger: next };
}

export const LEDGER_REL_PATH = "data/nex-migration/live-schema.json";

function atomicWrite(abs: string, content: string): void {
  const tmp = abs + ".tmp";
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, abs);
}
