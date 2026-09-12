// src/lib/nex/section-build/section-build.test.ts
//
// Stage 3 · pure-function tests. Database-dependent tests (createBuildArtifact ·
// createSectionRevision etc.) require the migration to be applied · which is
// out of scope for this test suite. Those tests will run in Stage 3b when
// migration is applied.

import { describe, it, expect } from "vitest";
import {
  hashFileContent,
  hashArtifact,
  toArtifactFile,
  parseSemver,
  formatSemver,
  bumpPatch,
  bumpMinor,
  bumpMajor,
  compareSemver,
  isLegalTransition,
} from "./index";
import type { LifecycleState } from "./index";

describe("content-hash · deterministic + reproducible", () => {
  it("hashes identical content to identical value", () => {
    const a = hashFileContent("hello world");
    const b = hashFileContent("hello world");
    expect(a).toBe(b);
  });

  it("hashes different content to different values", () => {
    const a = hashFileContent("hello world");
    const b = hashFileContent("hello world!");
    expect(a).not.toBe(b);
  });

  it("hashes an artifact deterministically regardless of file order", () => {
    const files = [
      toArtifactFile("b/x.ts", "content b"),
      toArtifactFile("a/x.ts", "content a"),
      toArtifactFile("c/x.ts", "content c"),
    ];
    const reordered = [files[2], files[0], files[1]];
    expect(hashArtifact(files)).toBe(hashArtifact(reordered));
  });

  it("hashes different file lists to different values", () => {
    const files1 = [toArtifactFile("a.ts", "a")];
    const files2 = [toArtifactFile("a.ts", "b")];
    expect(hashArtifact(files1)).not.toBe(hashArtifact(files2));
  });

  it("toArtifactFile computes correct size for UTF-8 strings", () => {
    const f = toArtifactFile("test.ts", "hello");
    expect(f.size).toBe(5);
    expect(f.content_hash).toBeTruthy();
    expect(f.path).toBe("test.ts");
  });
});

describe("semver · parse/format/increment/compare", () => {
  it("parses valid semver", () => {
    expect(parseSemver("v1.0.0")).toEqual({ major: 1, minor: 0, patch: 0 });
    expect(parseSemver("v10.20.30")).toEqual({ major: 10, minor: 20, patch: 30 });
  });

  it("returns null for invalid semver", () => {
    expect(parseSemver("1.0.0")).toBeNull();
    expect(parseSemver("v1.0")).toBeNull();
    expect(parseSemver("va.b.c")).toBeNull();
  });

  it("formats semver back", () => {
    expect(formatSemver({ major: 1, minor: 2, patch: 3 })).toBe("v1.2.3");
  });

  it("bumps patch", () => {
    expect(bumpPatch("v1.0.0")).toBe("v1.0.1");
    expect(bumpPatch("v1.0.9")).toBe("v1.0.10");
  });

  it("bumps minor · resets patch to 0", () => {
    expect(bumpMinor("v1.0.5")).toBe("v1.1.0");
    expect(bumpMinor("v1.9.9")).toBe("v1.10.0");
  });

  it("bumps major · resets minor+patch to 0", () => {
    expect(bumpMajor("v1.5.3")).toBe("v2.0.0");
  });

  it("compares semver correctly", () => {
    expect(compareSemver("v1.0.0", "v1.0.1")).toBe(-1);
    expect(compareSemver("v1.0.1", "v1.0.0")).toBe(1);
    expect(compareSemver("v1.0.0", "v1.0.0")).toBe(0);
    expect(compareSemver("v1.10.0", "v1.9.0")).toBe(1);
    expect(compareSemver("v2.0.0", "v1.99.99")).toBe(1);
  });

  it("throws on invalid semver in compare/bump", () => {
    expect(() => bumpPatch("bad")).toThrow();
    expect(() => bumpMinor("bad")).toThrow();
    expect(() => bumpMajor("bad")).toThrow();
    expect(() => compareSemver("bad", "v1.0.0")).toThrow();
  });
});

describe("lifecycle state machine · legal transitions", () => {
  it("BUILDING → TESTING legal · BUILDING → ACTIVE illegal", () => {
    expect(isLegalTransition("BUILDING", "TESTING")).toBe(true);
    expect(isLegalTransition("BUILDING", "ACTIVE")).toBe(false);
  });

  it("TESTING → AWAITING_PREVIEW legal", () => {
    expect(isLegalTransition("TESTING", "AWAITING_PREVIEW")).toBe(true);
  });

  it("TESTING → BUILDING legal (failed-tests loop)", () => {
    expect(isLegalTransition("TESTING", "BUILDING")).toBe(true);
  });

  it("AWAITING_PREVIEW → IN_REVIEW legal", () => {
    expect(isLegalTransition("AWAITING_PREVIEW", "IN_REVIEW")).toBe(true);
  });

  it("IN_REVIEW → APPROVED legal · IN_REVIEW → ACTIVE illegal", () => {
    expect(isLegalTransition("IN_REVIEW", "APPROVED")).toBe(true);
    expect(isLegalTransition("IN_REVIEW", "ACTIVE")).toBe(false);
  });

  it("APPROVED → ACTIVATING legal · APPROVED → ACTIVE illegal (must pass gate)", () => {
    expect(isLegalTransition("APPROVED", "ACTIVATING")).toBe(true);
    expect(isLegalTransition("APPROVED", "ACTIVE")).toBe(false);
  });

  it("ACTIVATING → ACTIVE legal · ACTIVATING → REJECTED legal (gate failed)", () => {
    expect(isLegalTransition("ACTIVATING", "ACTIVE")).toBe(true);
    expect(isLegalTransition("ACTIVATING", "REJECTED")).toBe(true);
  });

  it("ACTIVE → REVERTED legal · ACTIVE → BUILDING illegal", () => {
    expect(isLegalTransition("ACTIVE", "REVERTED")).toBe(true);
    expect(isLegalTransition("ACTIVE", "BUILDING")).toBe(false);
  });

  it("ACTIVE → DISABLED legal (three-level intervention)", () => {
    expect(isLegalTransition("ACTIVE", "DISABLED")).toBe(true);
  });

  it("DISABLED → ACTIVE legal (founder unhides)", () => {
    expect(isLegalTransition("DISABLED", "ACTIVE")).toBe(true);
  });

  it("REVERTED is terminal (no outgoing legal transitions)", () => {
    const targets: LifecycleState[] = [
      "BUILDING",
      "TESTING",
      "AWAITING_PREVIEW",
      "IN_REVIEW",
      "REQUEST_UPDATE",
      "REJECTED",
      "APPROVED",
      "ACTIVATING",
      "ACTIVE",
      "REVERTED",
      "DISABLED",
    ];
    for (const t of targets) {
      expect(isLegalTransition("REVERTED", t)).toBe(false);
    }
  });

  it("REQUEST_UPDATE → BUILDING legal (new revision spawns)", () => {
    expect(isLegalTransition("REQUEST_UPDATE", "BUILDING")).toBe(true);
  });
});
