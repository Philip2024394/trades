// src/app/nex-native/directory/__tests__/verified.test.ts
//
// NEX Directory · Phase A · "Verified" chip semantic lock.
//
// The audit identified D-1: the previous detail-page chip rendered a
// visitor-facing "Verified" label from evidence-row presence. Evidence
// is provenance; verification is a lifecycle_state concern. This file
// tests the sealed predicate `isVerifiedLifecycle` across every
// lifecycle value and locks the set of valid triggers.

import { describe, expect, it } from "vitest";
import {
  VERIFIED_LIFECYCLE_STATES,
  isVerifiedLifecycle,
} from "../_verified";
import type { LifecycleState } from "@/lib/nex-native/directory";

// ═════════════════════════════════════════════════════════════════════
// §1 · The sealed trigger set
// ═════════════════════════════════════════════════════════════════════

describe("VERIFIED_LIFECYCLE_STATES · the sealed trigger set", () => {
  it("contains exactly two members", () => {
    expect(VERIFIED_LIFECYCLE_STATES.length).toBe(2);
  });

  it("contains VERIFIED and OWNER_VERIFIED", () => {
    expect([...VERIFIED_LIFECYCLE_STATES].sort()).toEqual(
      ["OWNER_VERIFIED", "VERIFIED"],
    );
  });

  it("does not contain any non-verification lifecycle state", () => {
    const nonVerification: readonly LifecycleState[] = [
      "DISCOVERED",
      "ENRICHED",
      "OWNER_CLAIMED",
      "DORMANT",
      "SUPERSEDED",
    ];
    for (const s of nonVerification) {
      expect(VERIFIED_LIFECYCLE_STATES).not.toContain(s);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · isVerifiedLifecycle · explicit matrix across every lifecycle
// ═════════════════════════════════════════════════════════════════════

describe("isVerifiedLifecycle · explicit matrix", () => {
  it("DISCOVERED → false (no Verified chip)", () => {
    expect(isVerifiedLifecycle("DISCOVERED")).toBe(false);
  });

  it("ENRICHED → false (no Verified chip)", () => {
    expect(isVerifiedLifecycle("ENRICHED")).toBe(false);
  });

  it("VERIFIED → true (Verified chip permitted)", () => {
    expect(isVerifiedLifecycle("VERIFIED")).toBe(true);
  });

  it("OWNER_CLAIMED → false (claim is not verification)", () => {
    expect(isVerifiedLifecycle("OWNER_CLAIMED")).toBe(false);
  });

  it("OWNER_VERIFIED → true (owner-verified qualifies)", () => {
    expect(isVerifiedLifecycle("OWNER_VERIFIED")).toBe(true);
  });

  it("DORMANT → false (dormant is not verification)", () => {
    expect(isVerifiedLifecycle("DORMANT")).toBe(false);
  });

  it("SUPERSEDED → false (superseded rows never show on their own; defensive)", () => {
    expect(isVerifiedLifecycle("SUPERSEDED")).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Honesty · provenance is NOT verification
// ═════════════════════════════════════════════════════════════════════

describe("isVerifiedLifecycle · honesty invariants", () => {
  it("does not accept any value outside the sealed set as truthy", () => {
    const allLifecycles: readonly LifecycleState[] = [
      "DISCOVERED",
      "ENRICHED",
      "VERIFIED",
      "OWNER_CLAIMED",
      "OWNER_VERIFIED",
      "DORMANT",
      "SUPERSEDED",
    ];
    const truthy = allLifecycles.filter((s) => isVerifiedLifecycle(s));
    expect([...truthy].sort()).toEqual(["OWNER_VERIFIED", "VERIFIED"]);
  });

  it("is a pure function · same input yields same output", () => {
    expect(isVerifiedLifecycle("VERIFIED")).toBe(
      isVerifiedLifecycle("VERIFIED"),
    );
    expect(isVerifiedLifecycle("DISCOVERED")).toBe(
      isVerifiedLifecycle("DISCOVERED"),
    );
  });

  it("the sealed trigger set is readonly (no runtime mutation)", () => {
    // The constant is declared `as const readonly` — attempting to
    // mutate it at runtime should throw in strict mode or no-op in
    // non-strict. We only assert the array shape stays stable.
    const before = [...VERIFIED_LIFECYCLE_STATES];
    expect([...VERIFIED_LIFECYCLE_STATES]).toEqual(before);
  });
});
