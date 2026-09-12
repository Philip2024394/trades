// src/components/nex-app/live/rights-declaration-form.test.ts
//
// NEX LIVE · Phase 2 · rights-declaration form logic (§13)

import { describe, it, expect } from "vitest";
import { isRightsDeclarationComplete } from "./RightsDeclarationForm";

const BASE = {
  declared_kind: "OWNER_DECLARED" as const,
  declared_statement: "I created this myself.",
  supporting_reference: null,
  confirmed: true,
};

describe("isRightsDeclarationComplete · §13 mandatory-confirmation gate", () => {
  it("valid: confirmed + statement ≥ 5 chars → true", () => {
    expect(isRightsDeclarationComplete(BASE)).toBe(true);
  });
  it("unchecked confirmation → false (never publishable)", () => {
    expect(isRightsDeclarationComplete({ ...BASE, confirmed: false })).toBe(false);
  });
  it("statement too short → false", () => {
    expect(isRightsDeclarationComplete({ ...BASE, declared_statement: "ok" })).toBe(false);
  });
  it("statement whitespace-only → false", () => {
    expect(isRightsDeclarationComplete({ ...BASE, declared_statement: "     " })).toBe(false);
  });
  it("all rights kinds equally valid when confirmed + statement present", () => {
    for (const k of ["OWNER_DECLARED", "LICENSED", "PUBLIC_DOMAIN", "CREATIVE_COMMONS"] as const) {
      expect(isRightsDeclarationComplete({ ...BASE, declared_kind: k })).toBe(true);
    }
  });
});
