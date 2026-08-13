// case-id.test.ts — RefacingCaseId type + generator.

import { describe, it, expect } from "vitest";
import {
  newRefacingCaseId,
  isRefacingCaseId,
  assertRefacingCaseId,
} from "./case-id";

describe("newRefacingCaseId", () => {
  it("starts with rf_ prefix", () => {
    const id = newRefacingCaseId();
    expect(id.startsWith("rf_")).toBe(true);
  });

  it("has the shape rf_<time>_<rand>", () => {
    const id = newRefacingCaseId();
    expect(id).toMatch(/^rf_[0-9a-z]+_[0-9a-z]+$/);
  });

  it("returns unique IDs across successive calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(newRefacingCaseId());
    expect(ids.size).toBe(1000);
  });
});

describe("isRefacingCaseId", () => {
  it("accepts a freshly-generated ID", () => {
    expect(isRefacingCaseId(newRefacingCaseId())).toBe(true);
  });

  it("rejects legacy sr_ ids (Stage 1 · V1 remediation target)", () => {
    expect(isRefacingCaseId("sr_1723123123_abcdefgh")).toBe(false);
  });

  it("rejects the empty string, null, undefined, non-string values", () => {
    expect(isRefacingCaseId("")).toBe(false);
    expect(isRefacingCaseId(null)).toBe(false);
    expect(isRefacingCaseId(undefined)).toBe(false);
    expect(isRefacingCaseId(123)).toBe(false);
    expect(isRefacingCaseId({ id: "rf_abc" })).toBe(false);
  });

  it("rejects malformed rf_ prefixed strings", () => {
    expect(isRefacingCaseId("rf_")).toBe(false);
    expect(isRefacingCaseId("rf_abc")).toBe(false); // missing second segment
    expect(isRefacingCaseId("rf_UPPERCASE_here")).toBe(false); // uppercase not allowed
    expect(isRefacingCaseId("rf_ab_cd!")).toBe(false); // punctuation
  });
});

describe("assertRefacingCaseId", () => {
  it("does not throw for a valid ID", () => {
    expect(() => assertRefacingCaseId(newRefacingCaseId())).not.toThrow();
  });

  it("throws with Stage 1 citation for invalid input", () => {
    expect(() => assertRefacingCaseId("sr_bad_case_id")).toThrow(/Stage 1 · C2\/C5/);
  });
});
