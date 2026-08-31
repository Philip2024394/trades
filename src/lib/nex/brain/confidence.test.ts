// Stage 3.11 · Phase 4 · Confidence unit tests.

import { describe, it, expect } from "vitest";
import { assessConfidence } from "./confidence";

describe("Confidence · overall level determination", () => {
  it("empty reply → low", () => {
    const r = assessConfidence({ reply: "" });
    expect(r.overall).toBe("low");
    expect(r.evidenceCount).toBe(0);
    expect(r.claims).toEqual([]);
  });

  it("reply with real property names + count → high", () => {
    const r = assessConfidence({
      reply: "I've got 14 real listings for hotels in Yogyakarta — Griya Sentana, Hotel Trim Tiga, Asia Afrika, and more. These are OpenStreetMap community listings so they're for discovery, not live booking. Do you want budget, mid-range, or something more upmarket?",
      namesRealProperties: true,
      realPropertiesMatched: 14,
    });
    expect(r.overall).toBe("high");
    expect(r.evidenceCount).toBeGreaterThan(0);
    expect(r.claims.some((c) => c.evidence === "grounded_fact")).toBe(true);
  });

  it("grounded knowledge citation → high", () => {
    const r = assessConfidence({
      reply: "Kos-kosan is monthly-rented boarding-house accommodation... (Source: NEX Indonesia knowledge · Indonesia · verified 2026-08-30T16:05:43.447Z.)",
      isGroundedKnowledge: true,
    });
    expect(r.overall).toBe("high");
    expect(r.claims.some((c) => c.evidence === "retrieved")).toBe(true);
  });

  it("honest booking boundary → unavailable", () => {
    const r = assessConfidence({
      reply: "I can't book accommodation for you yet — the World has discovery listings but no live booking connection.",
      isHonestBoundary: true,
    });
    expect(r.overall).toBe("unavailable");
    expect(r.boundaryCount).toBeGreaterThan(0);
  });

  it("honest price boundary → unavailable", () => {
    const r = assessConfidence({
      reply: "OpenStreetMap listings don't carry price data, so I can't quote a rate honestly.",
    });
    expect(r.overall).toBe("unavailable");
  });

  it("honest amenity boundary → unavailable", () => {
    const r = assessConfidence({
      reply: "OpenStreetMap listings don't carry facility data (pool, wifi, breakfast, aircon), so I can't confidently filter for pool from what I have.",
    });
    expect(r.overall).toBe("unavailable");
  });

  it("refining question only → medium", () => {
    const r = assessConfidence({
      reply: "Do you want budget, mid-range, or something more upmarket?",
      isRefiningQuestion: true,
    });
    expect(r.overall).toBe("medium");
  });

  it("acknowledgement + property names → high (evidence dominates conversational)", () => {
    const r = assessConfidence({
      reply: "Got it — budget hotels in Yogyakarta. Griya Sentana, Hotel Trim Tiga, Asia Afrika, and more. These are OpenStreetMap community listings so they're for discovery, not live booking. Want me to focus around a specific area like Malioboro or Prawirotaman?",
      namesRealProperties: true,
      realPropertiesMatched: 14,
    });
    expect(r.overall).toBe("high");
  });

  it("area proximity claim recorded as computed evidence", () => {
    const r = assessConfidence({
      reply: "Got it — budget hotels near Malioboro. Griya Sentana...",
      namesRealProperties: true,
      realPropertiesMatched: 5,
      citesGeographicArea: true,
    });
    expect(r.claims.some((c) => c.evidence === "computed" && /area/i.test(c.claim))).toBe(true);
  });

  it("count claim provenance is attached", () => {
    const r = assessConfidence({
      reply: "I've got 14 real listings for hotels in Yogyakarta.",
      namesRealProperties: true,
      realPropertiesMatched: 14,
    });
    const countClaim = r.claims.find((c) => c.claim.startsWith("count claim"));
    expect(countClaim?.source).toContain("real property retrieval");
  });
});

describe("Confidence · evidenceCount / boundaryCount tallies", () => {
  it("tallies grounded_fact + retrieved + computed as evidence · boundary separately", () => {
    const r = assessConfidence({
      reply: "Got it — budget hotels near Malioboro. Griya Sentana, Hotel Trim Tiga, Asia Afrika. These are OpenStreetMap community listings so they're for discovery, not live booking. I don't have price data on these.",
      namesRealProperties: true,
      realPropertiesMatched: 3,
      citesGeographicArea: true,
    });
    expect(r.evidenceCount).toBeGreaterThan(0);
  });
});
