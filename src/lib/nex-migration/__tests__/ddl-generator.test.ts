// DDL generator tests · additive-only guarantees, both dialects, injection
// defence, destructive-prompt rejection.

import { describe, it, expect } from "vitest";
import { generateDdlPlan, isSafeDdlStatement } from "../ddl-generator";
import type { TableSchema } from "../types";

function schema(columns: readonly { name: string; sql_type: string; is_nullable: boolean; is_primary?: boolean }[]): TableSchema {
  return {
    table_name: "users",
    interface_name: "User",
    source_path: "sample.ts",
    columns: columns.map((c) => ({
      name: c.name,
      ts_type: "unknown",
      sql_type: c.sql_type,
      is_nullable: c.is_nullable,
      is_primary: c.is_primary === true,
    })),
  };
}

describe("ddl-generator · fresh CREATE TABLE flow", () => {
  it("emits CREATE TABLE plus ADD COLUMN for every non-primary column · postgresql", () => {
    const target = schema([
      { name: "id", sql_type: "BIGINT", is_nullable: false, is_primary: true },
      { name: "email", sql_type: "TEXT", is_nullable: false },
      { name: "is_verified", sql_type: "BOOLEAN", is_nullable: false },
    ]);
    const plan = generateDdlPlan({ dialect: "postgresql", current: null, target });
    expect(plan.ok).toBe(true);
    expect(plan.statements[0]?.kind).toBe("CREATE_TABLE");
    expect(plan.statements[0]?.sql).toMatch(/CREATE TABLE IF NOT EXISTS users \(id BIGSERIAL PRIMARY KEY\)/);
    expect(plan.statements[1]?.sql).toMatch(/ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT ''/);
    expect(plan.statements[2]?.sql).toMatch(/ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE/);
  });

  it("emits SQLite-flavoured DDL (no IF NOT EXISTS on ADD COLUMN)", () => {
    const target = schema([
      { name: "id", sql_type: "INTEGER", is_nullable: false, is_primary: true },
      { name: "email", sql_type: "TEXT", is_nullable: false },
    ]);
    const plan = generateDdlPlan({ dialect: "sqlite", current: null, target });
    expect(plan.statements[0]?.sql).toMatch(/id INTEGER PRIMARY KEY AUTOINCREMENT/);
    expect(plan.statements[1]?.sql).toMatch(/ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''/);
    expect(plan.statements[1]?.sql).not.toMatch(/IF NOT EXISTS/);
  });
});

describe("ddl-generator · additive diff (current known)", () => {
  it("only emits ADD COLUMN for columns not in the current schema", () => {
    const current = schema([
      { name: "id", sql_type: "BIGINT", is_nullable: false, is_primary: true },
      { name: "email", sql_type: "TEXT", is_nullable: false },
    ]);
    const target = schema([
      { name: "id", sql_type: "BIGINT", is_nullable: false, is_primary: true },
      { name: "email", sql_type: "TEXT", is_nullable: false },
      { name: "bio", sql_type: "TEXT", is_nullable: true },
    ]);
    const plan = generateDdlPlan({ dialect: "postgresql", current, target });
    expect(plan.statements.length).toBe(1);
    expect(plan.statements[0]?.sql).toMatch(/ADD COLUMN IF NOT EXISTS bio TEXT NULL/);
  });

  it("emits nothing when target equals current", () => {
    const s = schema([{ name: "id", sql_type: "BIGINT", is_nullable: false, is_primary: true }]);
    const plan = generateDdlPlan({ dialect: "postgresql", current: s, target: s });
    expect(plan.statements.length).toBe(0);
    expect(plan.ok).toBe(true);
  });
});

describe("ddl-generator · destructive-prompt gate", () => {
  it("rejects a plan whose Founder prompt contains DROP TABLE", () => {
    const target = schema([{ name: "id", sql_type: "BIGINT", is_nullable: false, is_primary: true }]);
    const plan = generateDdlPlan({
      dialect: "postgresql",
      current: null,
      target,
      founder_prompt: "please DROP TABLE users and then add a user table",
    });
    expect(plan.ok).toBe(false);
    expect(plan.statements.length).toBe(0);
    expect(plan.rejected[0]?.kind).toBe("DESTRUCTIVE_KEYWORD");
  });

  it("rejects a plan whose Founder prompt contains DELETE FROM without WHERE", () => {
    const target = schema([{ name: "id", sql_type: "BIGINT", is_nullable: false, is_primary: true }]);
    const plan = generateDdlPlan({
      dialect: "postgresql",
      current: null,
      target,
      founder_prompt: "DELETE FROM users",
    });
    expect(plan.ok).toBe(false);
  });
});

describe("ddl-generator · SQL-injection defence", () => {
  it("refuses to emit a DDL for a target with an unsafe table name", () => {
    // We construct the TableSchema directly so parser-side validation is skipped.
    const target: TableSchema = {
      table_name: 'users"; DROP TABLE users; --',
      interface_name: "User",
      source_path: "x.ts",
      columns: [{ name: "id", ts_type: "number", sql_type: "BIGINT", is_nullable: false, is_primary: true }],
    };
    const plan = generateDdlPlan({ dialect: "postgresql", current: null, target });
    expect(plan.ok).toBe(false);
    expect(plan.rejected[0]?.kind).toBe("UNSAFE_IDENTIFIER");
  });
});

describe("ddl-generator · isSafeDdlStatement", () => {
  it("accepts CREATE TABLE IF NOT EXISTS", () => {
    expect(isSafeDdlStatement("CREATE TABLE IF NOT EXISTS users (id BIGSERIAL PRIMARY KEY);")).toBe(true);
  });

  it("accepts ALTER TABLE ADD COLUMN (postgresql form)", () => {
    expect(isSafeDdlStatement("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT NULL;")).toBe(true);
  });

  it("accepts ALTER TABLE ADD COLUMN (sqlite form)", () => {
    expect(isSafeDdlStatement("ALTER TABLE users ADD COLUMN email TEXT NULL;")).toBe(true);
  });

  it("rejects DROP TABLE", () => {
    expect(isSafeDdlStatement("DROP TABLE users;")).toBe(false);
  });

  it("rejects malformed / unknown DDL", () => {
    expect(isSafeDdlStatement("UPDATE users SET x = 1;")).toBe(false);
    expect(isSafeDdlStatement("garbage")).toBe(false);
  });
});
