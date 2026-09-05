// src/lib/nex/brain/evidence-scope.test.ts
// Wave 4 · Evidence & Reasoning Discipline · unit tests
// Philip 2026-09-06 · AUTHORIZE · WAVE 4

import { describe, it, expect } from "vitest";
import {
  classifyEvidenceState,
  stateAllowsComposition,
  stateRequiresHonestBoundary,
  toEvidenceObservability,
  type MinimalHit,
  type EvidenceScope,
} from "./evidence-scope";

const hit = (over: Partial<MinimalHit> = {}): MinimalHit => ({
  id: "h1", content: "generic content", region: "yogyakarta", domain: "food",
  last_verified: new Date().toISOString(),
  confidence: 0.9, ...over,
});

// ═════════════ NO_EVIDENCE ═════════════

describe("classifyEvidenceState · NO_EVIDENCE", () => {
  it("empty hits → NO_EVIDENCE regardless of scope", () => {
    const r = classifyEvidenceState({ scope: {}, hits: [] });
    expect(r.state).toBe("NO_EVIDENCE");
  });
  it("empty hits with pinned scope → NO_EVIDENCE + missing_dimensions populated", () => {
    const r = classifyEvidenceState({
      scope: { domain: "food", geography: "Tokyo" },
      hits: [],
    });
    expect(r.state).toBe("NO_EVIDENCE");
    expect(r.missing_dimensions).toEqual(expect.arrayContaining(["domain", "geography"]));
  });
});

// ═════════════ OUT_OF_SCOPE_EVIDENCE ═════════════

describe("classifyEvidenceState · OUT_OF_SCOPE_EVIDENCE (G24 case)", () => {
  it("geography pinned but not covered → OUT_OF_SCOPE (primary dimension miss)", () => {
    const r = classifyEvidenceState({
      scope: { geography: "Tokyo", domain: "food" },
      hits: [hit({ content: "gudeg is a Yogyakarta specialty", region: "yogyakarta", domain: "food" })],
    });
    // Domain "food" matches, but geography "Tokyo" doesn't — primary
    // dimension miss trumps secondary coverage.
    expect(r.state).toBe("OUT_OF_SCOPE_EVIDENCE");
    expect(r.missing_dimensions).toContain("geography");
  });
  it("no scope pinned dimensions match at all → OUT_OF_SCOPE", () => {
    const r = classifyEvidenceState({
      scope: { attribute: "helicopter_pad" },
      hits: [hit({ content: "no helicopter pad in this record" })],
    });
    // "helicopter_pad" doesn't match the hit content · missed
    expect(r.state).toBe("OUT_OF_SCOPE_EVIDENCE");
  });
});

// ═════════════ PARTIAL_EVIDENCE ═════════════

describe("classifyEvidenceState · PARTIAL_EVIDENCE", () => {
  it("some pinned covered, others missing", () => {
    const r = classifyEvidenceState({
      scope: { geography: "Yogyakarta", domain: "food", attribute: "michelin" },
      hits: [hit({ content: "gudeg Yogyakarta food specialty" })],
    });
    expect(r.state).toBe("PARTIAL_EVIDENCE");
    expect(r.covered_dimensions).toEqual(expect.arrayContaining(["geography", "domain"]));
    expect(r.missing_dimensions).toEqual(expect.arrayContaining(["attribute"]));
  });
});

// ═════════════ SUFFICIENT_EVIDENCE ═════════════

describe("classifyEvidenceState · SUFFICIENT_EVIDENCE", () => {
  it("all pinned covered", () => {
    const r = classifyEvidenceState({
      scope: { geography: "Yogyakarta", domain: "food" },
      hits: [hit({ content: "gudeg Yogyakarta food dish" })],
    });
    expect(r.state).toBe("SUFFICIENT_EVIDENCE");
  });
  it("no dimensions pinned → SUFFICIENT_EVIDENCE (general chat)", () => {
    const r = classifyEvidenceState({ scope: {}, hits: [hit()] });
    expect(r.state).toBe("SUFFICIENT_EVIDENCE");
  });
});

// ═════════════ STALE_EVIDENCE ═════════════

describe("classifyEvidenceState · STALE_EVIDENCE", () => {
  it("all hits past freshness window + freshness pinned to current", () => {
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const r = classifyEvidenceState({
      scope: { freshness: "current" },
      hits: [hit({ content: "old", last_verified: old })],
    });
    expect(r.state).toBe("STALE_EVIDENCE");
  });
  it("some hits fresh → NOT stale even if others old", () => {
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const r = classifyEvidenceState({
      scope: { freshness: "current" },
      hits: [hit({ id: "old", last_verified: old }), hit({ id: "fresh" })],
    });
    expect(r.state).not.toBe("STALE_EVIDENCE");
  });
});

// ═════════════ State-based helpers ═════════════

describe("stateAllowsComposition · stateRequiresHonestBoundary", () => {
  it("SUFFICIENT_EVIDENCE + PARTIAL_EVIDENCE allow composition", () => {
    expect(stateAllowsComposition("SUFFICIENT_EVIDENCE")).toBe(true);
    expect(stateAllowsComposition("PARTIAL_EVIDENCE")).toBe(true);
  });
  it("NO_EVIDENCE / OUT_OF_SCOPE / STALE / CONFLICTING require honest boundary", () => {
    expect(stateRequiresHonestBoundary("NO_EVIDENCE")).toBe(true);
    expect(stateRequiresHonestBoundary("OUT_OF_SCOPE_EVIDENCE")).toBe(true);
    expect(stateRequiresHonestBoundary("STALE_EVIDENCE")).toBe(true);
    expect(stateRequiresHonestBoundary("CONFLICTING_EVIDENCE")).toBe(true);
  });
  it("SUFFICIENT_EVIDENCE does not require honest boundary", () => {
    expect(stateRequiresHonestBoundary("SUFFICIENT_EVIDENCE")).toBe(false);
  });
});

// ═════════════ Observability ═════════════

describe("toEvidenceObservability", () => {
  it("returns hit_count + fresh_hit_count + covered/missing dims", () => {
    const o = toEvidenceObservability({
      scope: { geography: "Yogyakarta" },
      hits: [hit({ content: "yogyakarta specialty" }), hit({ content: "unrelated" })],
    });
    expect(o.hit_count).toBe(2);
    expect(o.fresh_hit_count).toBe(2);
    expect(o.state).toBe("SUFFICIENT_EVIDENCE");
  });
});
