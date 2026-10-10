// End-to-end migration test · parse the sample User model, diff against an
// empty ledger, apply, then re-run and prove the second pass is a no-op.
// No external database CLI required · every statement is validated syntactically.

import { describe, it, expect, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import { planFromInterface, isSafeDdlStatement, LEDGER_REL_PATH, forgetTableSchema, getTableSchema } from "..";

const REPO_ROOT = process.cwd();
const LEDGER_ABS = path.join(REPO_ROOT, LEDGER_REL_PATH);

afterEach(() => {
  if (existsSync(LEDGER_ABS)) rmSync(LEDGER_ABS, { force: true });
});

describe("nex-migration · end-to-end · postgresql", () => {
  it("first pass creates + adds every non-primary column, second pass is a no-op", () => {
    const first = planFromInterface({
      source_path: "src/lib/nex-migration/__samples__/user-model.ts",
      interface_name: "User",
      table_name: "users",
      dialect: "postgresql",
      persist: true,
    });
    expect(first.ok).toBe(true);
    expect(first.statements[0]?.kind).toBe("CREATE_TABLE");
    // 6 non-primary columns in the sample interface
    expect(first.statements.filter((s) => s.kind === "ADD_COLUMN").length).toBe(6);

    // Every emitted statement passes the additive syntactic gate.
    for (const s of first.statements) {
      expect(isSafeDdlStatement(s.sql)).toBe(true);
    }

    // Second pass · already persisted, nothing more to do.
    const second = planFromInterface({
      source_path: "src/lib/nex-migration/__samples__/user-model.ts",
      interface_name: "User",
      table_name: "users",
      dialect: "postgresql",
      persist: false,
    });
    expect(second.ok).toBe(true);
    expect(second.statements.length).toBe(0);
  });

  it("rollback removes the table from the ledger and re-planning starts fresh", () => {
    planFromInterface({
      source_path: "src/lib/nex-migration/__samples__/user-model.ts",
      interface_name: "User",
      table_name: "users",
      dialect: "sqlite",
      persist: true,
    });
    expect(getTableSchema("users")).not.toBeNull();

    const r = forgetTableSchema("users");
    expect(r.removed).toBe(true);
    expect(getTableSchema("users")).toBeNull();

    const replan = planFromInterface({
      source_path: "src/lib/nex-migration/__samples__/user-model.ts",
      interface_name: "User",
      table_name: "users",
      dialect: "sqlite",
      persist: false,
    });
    expect(replan.statements[0]?.kind).toBe("CREATE_TABLE");
  });
});

describe("nex-migration · e2e · sqlite dialect", () => {
  it("produces valid SQLite DDL for the User model", () => {
    const plan = planFromInterface({
      source_path: "src/lib/nex-migration/__samples__/user-model.ts",
      interface_name: "User",
      table_name: "users",
      dialect: "sqlite",
      persist: false,
    });
    expect(plan.ok).toBe(true);
    for (const s of plan.statements) {
      expect(isSafeDdlStatement(s.sql)).toBe(true);
      // SQLite ADD COLUMN must NOT contain IF NOT EXISTS (it errors on that).
      if (s.kind === "ADD_COLUMN") {
        expect(s.sql).not.toMatch(/IF NOT EXISTS/i);
      }
    }
  });
});
