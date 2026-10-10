// Parser tests · verify TypeScript interface → TableSchema mapping produces
// the correct column types for both dialects and rejects unsafe input.

import { describe, it, expect } from "vitest";
import { parseInterfaceToSchema } from "../schema-parser";

const SAMPLE = "src/lib/nex-migration/__samples__/user-model.ts";

describe("schema-parser · postgresql dialect", () => {
  const r = parseInterfaceToSchema(SAMPLE, { interface_name: "User", table_name: "users", dialect: "postgresql" });

  it("finds all 7 columns", () => {
    expect(r.schema?.columns.length).toBe(7);
    expect(r.rejections).toEqual([]);
  });

  it("maps number to BIGINT", () => {
    const id = r.schema?.columns.find((c) => c.name === "id");
    expect(id?.sql_type).toBe("BIGINT");
    expect(id?.is_primary).toBe(true);
    expect(id?.is_nullable).toBe(false);
  });

  it("maps string to TEXT", () => {
    const email = r.schema?.columns.find((c) => c.name === "email");
    expect(email?.sql_type).toBe("TEXT");
    expect(email?.is_nullable).toBe(false);
  });

  it("maps boolean to BOOLEAN", () => {
    const v = r.schema?.columns.find((c) => c.name === "is_verified");
    expect(v?.sql_type).toBe("BOOLEAN");
  });

  it("maps Date to TIMESTAMP WITH TIME ZONE", () => {
    const c = r.schema?.columns.find((c) => c.name === "created_at");
    expect(c?.sql_type).toBe("TIMESTAMP WITH TIME ZONE");
  });

  it("treats optional (?) as nullable", () => {
    const bio = r.schema?.columns.find((c) => c.name === "bio");
    expect(bio?.is_nullable).toBe(true);
  });

  it("treats `T | null` union as nullable", () => {
    const av = r.schema?.columns.find((c) => c.name === "avatar_url");
    expect(av?.is_nullable).toBe(true);
    expect(av?.sql_type).toBe("TEXT");
  });
});

describe("schema-parser · sqlite dialect", () => {
  const r = parseInterfaceToSchema(SAMPLE, { interface_name: "User", table_name: "users", dialect: "sqlite" });

  it("maps number to INTEGER", () => {
    const id = r.schema?.columns.find((c) => c.name === "id");
    expect(id?.sql_type).toBe("INTEGER");
  });

  it("maps boolean to INTEGER (SQLite has no native BOOLEAN)", () => {
    const v = r.schema?.columns.find((c) => c.name === "is_verified");
    expect(v?.sql_type).toBe("INTEGER");
  });

  it("maps Date to TEXT (SQLite ISO string)", () => {
    const c = r.schema?.columns.find((c) => c.name === "created_at");
    expect(c?.sql_type).toBe("TEXT");
  });
});

describe("schema-parser · error paths", () => {
  it("returns rejection for missing file", () => {
    const r = parseInterfaceToSchema("src/does-not-exist-xyz.ts", {
      interface_name: "User",
      table_name: "users",
      dialect: "sqlite",
    });
    expect(r.schema).toBeNull();
    expect(r.rejections.length).toBeGreaterThan(0);
  });

  it("returns rejection for missing interface", () => {
    const r = parseInterfaceToSchema(SAMPLE, {
      interface_name: "NoSuchInterface",
      table_name: "users",
      dialect: "sqlite",
    });
    expect(r.schema).toBeNull();
    expect(r.rejections[0]?.kind).toBe("UNRESOLVED_TYPE");
  });

  it("rejects unsafe target table name at parse time", () => {
    expect(() =>
      parseInterfaceToSchema(SAMPLE, { interface_name: "User", table_name: 'users"; DROP', dialect: "sqlite" }),
    ).toThrow(/unsafe table/);
  });

  it("rejects unsafe interface name at parse time", () => {
    expect(() =>
      parseInterfaceToSchema(SAMPLE, { interface_name: "User; DROP", table_name: "users", dialect: "sqlite" }),
    ).toThrow(/unsafe interface/);
  });
});
