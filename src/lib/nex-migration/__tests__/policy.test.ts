// Policy layer tests · SQL identifier safety and destructive keyword scanning.
// These rules are the load-bearing safety net for the whole migration engine.

import { describe, it, expect } from "vitest";
import { isSafeIdentifier, assertSafeIdentifier, scanForDestructive } from "../policy";

describe("policy · isSafeIdentifier", () => {
  it("accepts plain identifiers", () => {
    expect(isSafeIdentifier("users")).toBe(true);
    expect(isSafeIdentifier("user_profile")).toBe(true);
    expect(isSafeIdentifier("_internal")).toBe(true);
    expect(isSafeIdentifier("id")).toBe(true);
    expect(isSafeIdentifier("Column1")).toBe(true);
  });

  it("rejects empty and length-abusive names", () => {
    expect(isSafeIdentifier("")).toBe(false);
    expect(isSafeIdentifier("a".repeat(64))).toBe(false);
  });

  it("rejects names starting with a digit", () => {
    expect(isSafeIdentifier("1st")).toBe(false);
  });

  it("rejects any character that could break out of an identifier", () => {
    expect(isSafeIdentifier('users"; DROP TABLE users; --')).toBe(false);
    expect(isSafeIdentifier("users`")).toBe(false);
    expect(isSafeIdentifier("users'")).toBe(false);
    expect(isSafeIdentifier("users)")).toBe(false);
    expect(isSafeIdentifier("users;")).toBe(false);
    expect(isSafeIdentifier("us-ers")).toBe(false);
    expect(isSafeIdentifier("us.ers")).toBe(false);
    expect(isSafeIdentifier("us ers")).toBe(false);
    expect(isSafeIdentifier("us\\ers")).toBe(false);
  });

  it("assertSafeIdentifier throws with role in the message", () => {
    expect(() => assertSafeIdentifier("bad; drop", "table")).toThrow(/table/);
  });
});

describe("policy · scanForDestructive", () => {
  it("finds DROP TABLE", () => {
    const r = scanForDestructive("please DROP TABLE users");
    expect(r.length).toBe(1);
    expect(r[0]?.kind).toBe("DESTRUCTIVE_KEYWORD");
  });

  it("finds DROP COLUMN", () => {
    const r = scanForDestructive("ALTER TABLE users DROP COLUMN email");
    expect(r.length).toBe(1);
  });

  it("finds TRUNCATE", () => {
    const r = scanForDestructive("truncate users");
    expect(r.length).toBe(1);
  });

  it("finds DELETE FROM without WHERE", () => {
    const r = scanForDestructive("DELETE FROM users");
    expect(r.length).toBe(1);
  });

  it("permits DELETE FROM WHERE …", () => {
    const r = scanForDestructive("DELETE FROM users WHERE id = 1");
    expect(r.length).toBe(0);
  });

  it("finds nothing in benign prompts", () => {
    const r = scanForDestructive("add a user table with email and display_name");
    expect(r.length).toBe(0);
  });

  it("returns evidence substring for every hit", () => {
    const r = scanForDestructive("first DROP TABLE users then something");
    expect(r[0]?.evidence).toMatch(/DROP\s+TABLE/i);
  });
});
