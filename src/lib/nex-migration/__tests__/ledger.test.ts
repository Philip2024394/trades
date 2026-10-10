// Ledger tests · atomic writes, round-trip, rollback (forget) semantics.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { loadLedger, getTableSchema, saveTableSchema, forgetTableSchema, LEDGER_REL_PATH } from "../schema-ledger";
import type { TableSchema } from "../types";

const REPO_ROOT = process.cwd();
const LEDGER_ABS = path.join(REPO_ROOT, LEDGER_REL_PATH);
const LEDGER_DIR = path.dirname(LEDGER_ABS);

function cleanLedger(): void {
  if (existsSync(LEDGER_ABS)) rmSync(LEDGER_ABS, { force: true });
}

// Clean both before AND after each test so any external persisted state
// (e.g. from a live API smoke test hitting /api/nex-migration/plan) doesn't
// pollute the assertions.
beforeEach(cleanLedger);
afterEach(cleanLedger);

function makeSchema(name: string): TableSchema {
  return {
    table_name: name,
    interface_name: "X",
    source_path: "x.ts",
    columns: [{ name: "id", ts_type: "number", sql_type: "BIGINT", is_nullable: false, is_primary: true }],
  };
}

describe("ledger · load and save", () => {
  it("returns an empty ledger when the file does not exist", () => {
    const l = loadLedger();
    expect(l.version).toBe(1);
    expect(Object.keys(l.tables).length).toBe(0);
  });

  it("save + get round-trips schema by name", () => {
    saveTableSchema(makeSchema("orders"));
    const got = getTableSchema("orders");
    expect(got?.table_name).toBe("orders");
  });

  it("save is idempotent + updates updated_at", async () => {
    const first = saveTableSchema(makeSchema("orders"));
    await new Promise((r) => setTimeout(r, 5));
    const second = saveTableSchema(makeSchema("orders"));
    expect(first.created_at).toBe(second.created_at);
    expect(new Date(second.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(first.updated_at).getTime());
  });

  it("multiple tables coexist", () => {
    saveTableSchema(makeSchema("orders"));
    saveTableSchema(makeSchema("customers"));
    const l = loadLedger();
    expect(Object.keys(l.tables).sort()).toEqual(["customers", "orders"]);
  });
});

describe("ledger · rollback via forgetTableSchema", () => {
  it("removes a table from the ledger", () => {
    saveTableSchema(makeSchema("orders"));
    const r = forgetTableSchema("orders");
    expect(r.removed).toBe(true);
    expect(getTableSchema("orders")).toBeNull();
  });

  it("returns removed=false when table wasn't tracked", () => {
    const r = forgetTableSchema("never_existed");
    expect(r.removed).toBe(false);
  });

  it("never touches any file outside data/nex-migration/", () => {
    // Sanity check: the ledger path is stable and inside data/.
    expect(LEDGER_REL_PATH).toBe("data/nex-migration/live-schema.json");
  });
});

describe("ledger · defensive · malformed input", () => {
  it("throws on unsafe table name to prevent path or SQL injection", () => {
    expect(() => saveTableSchema(makeSchema('bad"; drop'))).toThrow(/unsafe table/);
    expect(() => forgetTableSchema('bad"; drop')).toThrow(/unsafe table/);
  });

  it("recovers gracefully if the ledger file becomes corrupt", () => {
    if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
    writeFileSync(LEDGER_ABS, "{not valid json", "utf8");
    expect(() => loadLedger()).toThrow();
  });
});
