// src/lib/nex/live/rights.test.ts
// NEX LIVE · Phase A · rights declaration + publish gate

import { describe, it, expect } from "vitest";
import {
  canPublishUnderRights,
  assertRightsForPublish,
  newEmptyDeclaration,
  type RightsDeclaration,
} from "./rights";

const NOW = "2026-09-06T00:00:00.000Z";

function decl(overrides: Partial<RightsDeclaration>): RightsDeclaration {
  return {
    uploader_nex_id: "nex:test-uploader",
    declared_source: "authored",
    declared_licence: "internal",
    declared_notes: null,
    state: "KNOWN_OWNED",
    monetization: "UNKNOWN",
    moderation: "APPROVED",
    declared_at_iso: NOW,
    assessed_at_iso: NOW,
    ...overrides,
  };
}

describe("rights · publish gate", () => {
  it("KNOWN_OWNED + APPROVED → CAN publish", () => {
    expect(canPublishUnderRights(decl({ state: "KNOWN_OWNED", moderation: "APPROVED" }))).toBe(true);
  });
  it("KNOWN_LICENSED + APPROVED → CAN publish", () => {
    expect(canPublishUnderRights(decl({ state: "KNOWN_LICENSED", moderation: "APPROVED" }))).toBe(true);
  });
  it("UNKNOWN state → CANNOT publish (§7 immutable)", () => {
    expect(canPublishUnderRights(decl({ state: "UNKNOWN" }))).toBe(false);
  });
  it("UNVERIFIED state → CANNOT publish", () => {
    expect(canPublishUnderRights(decl({ state: "UNVERIFIED" }))).toBe(false);
  });
  it("DISPUTED → CANNOT publish", () => {
    expect(canPublishUnderRights(decl({ state: "DISPUTED" }))).toBe(false);
  });
  it("EXPIRED → CANNOT publish", () => {
    expect(canPublishUnderRights(decl({ state: "EXPIRED" }))).toBe(false);
  });
  it("CONFLICTING → CANNOT publish", () => {
    expect(canPublishUnderRights(decl({ state: "CONFLICTING" }))).toBe(false);
  });
  it("REJECTED moderation blocks even KNOWN_OWNED", () => {
    expect(canPublishUnderRights(decl({ state: "KNOWN_OWNED", moderation: "REJECTED" }))).toBe(false);
  });
  it("REMOVED moderation blocks even KNOWN_LICENSED", () => {
    expect(canPublishUnderRights(decl({ state: "KNOWN_LICENSED", moderation: "REMOVED" }))).toBe(false);
  });
  it("PENDING moderation with KNOWN_OWNED CAN publish (owner-provable material may go PENDING → APPROVED silently)", () => {
    expect(canPublishUnderRights(decl({ state: "KNOWN_OWNED", moderation: "PENDING" }))).toBe(true);
  });
});

describe("rights · assertRightsForPublish", () => {
  it("throws with descriptive reason for UNKNOWN state", () => {
    expect(() => assertRightsForPublish(decl({ state: "UNKNOWN" })))
      .toThrow(/rights_refused_publish:UNKNOWN/);
  });
  it("throws mentioning moderation when moderation blocks", () => {
    expect(() => assertRightsForPublish(decl({ state: "KNOWN_OWNED", moderation: "REJECTED" })))
      .toThrow(/moderation=REJECTED/);
  });
});

describe("rights · newEmptyDeclaration is safe by default (§26)", () => {
  it("creates an UNKNOWN declaration that CANNOT publish", () => {
    const d = newEmptyDeclaration("nex:new-user", NOW);
    expect(d.state).toBe("UNKNOWN");
    expect(d.declared_source).toBe("unknown");
    expect(d.declared_licence).toBe("unknown");
    expect(d.monetization).toBe("UNKNOWN");
    expect(d.moderation).toBe("PENDING");
    expect(canPublishUnderRights(d)).toBe(false);
  });
});
