// Stage 3.10 · Phase 3 · Reflection unit tests.
// Constitutional per Philip 2026-08-31.

import { describe, it, expect } from "vitest";
import { reflectOnReply } from "./reflection";

describe("Reflection · individual checks", () => {
  it("answersUserMessage passes when reply is non-empty and appropriate", () => {
    const r = reflectOnReply({
      userMessage: "I need a hotel in Yogyakarta",
      reply: "I've got 14 real listings for hotels in Yogyakarta — Griya Sentana, Hotel Trim Tiga, Asia Afrika...",
      userMarket: "ID",
      realPropertiesMentioned: 14,
    });
    const f = r.findings.find((x) => x.check === "answersUserMessage")!;
    expect(f.passed).toBe(true);
  });

  it("answersUserMessage FAILS when reply is empty", () => {
    const r = reflectOnReply({ userMessage: "I need a hotel", reply: "", userMarket: "ID" });
    const f = r.findings.find((x) => x.check === "answersUserMessage")!;
    expect(f.passed).toBe(false);
  });

  it("answersUserMessage FAILS when discovery request is answered with only a question", () => {
    const r = reflectOnReply({
      userMessage: "Find me a hotel",
      reply: "Which city?",
      userMarket: "ID",
    });
    const f = r.findings.find((x) => x.check === "answersUserMessage")!;
    expect(f.passed).toBe(false);
  });

  it("internallyConsistent passes when reply matches slot type", () => {
    const r = reflectOnReply({
      userMessage: "Cheap",
      reply: "Got it — budget hotels in Yogyakarta. Griya Sentana, Hotel Trim Tiga...",
      slots: { type: "hotel", location: "yogyakarta", budget: "budget" },
    });
    const f = r.findings.find((x) => x.check === "internallyConsistent")!;
    expect(f.passed).toBe(true);
  });

  it("hasEvidenceForClaims passes when numeric claim matches evidence", () => {
    const r = reflectOnReply({
      userMessage: "hotels?",
      reply: "I've got 14 real listings for hotels in Yogyakarta.",
      realPropertiesMentioned: 14,
    });
    const f = r.findings.find((x) => x.check === "hasEvidenceForClaims")!;
    expect(f.passed).toBe(true);
  });

  it("hasEvidenceForClaims FAILS when numeric claim does not match evidence (fabrication)", () => {
    const r = reflectOnReply({
      userMessage: "hotels?",
      reply: "I've got 27 real listings for hotels in Yogyakarta.",
      realPropertiesMentioned: 14,
    });
    const f = r.findings.find((x) => x.check === "hasEvidenceForClaims")!;
    expect(f.passed).toBe(false);
    expect(f.reason).toContain("27");
    expect(f.reason).toContain("14");
  });

  it("respectsHonestBoundary FAILS on invented booking phrase", () => {
    const r = reflectOnReply({
      userMessage: "book it",
      reply: "Booked for you · reservation confirmed at IDR 850,000 per night.",
      userMarket: "ID",
    });
    const f = r.findings.find((x) => x.check === "respectsHonestBoundary")!;
    expect(f.passed).toBe(false);
  });

  it("respectsHonestBoundary passes on honest 'can't book' boundary", () => {
    const r = reflectOnReply({
      userMessage: "book it",
      reply: "I can't book accommodation for you yet — the World has discovery listings but no live booking connection.",
      userMarket: "ID",
    });
    const f = r.findings.find((x) => x.check === "respectsHonestBoundary")!;
    expect(f.passed).toBe(true);
  });

  it("respectsMarketBoundary FAILS when ID user gets UK-staircase copy", () => {
    const r = reflectOnReply({
      userMessage: "I need a staircase",
      reply: "The Staircase Library is where I keep the designs I know best...",
      userMarket: "ID",
    });
    const f = r.findings.find((x) => x.check === "respectsMarketBoundary")!;
    expect(f.passed).toBe(false);
  });

  it("respectsMarketBoundary passes when UK-staircase copy goes to UK user", () => {
    const r = reflectOnReply({
      userMessage: "I need a staircase",
      reply: "The Staircase Library is where I keep the designs I know best...",
      userMarket: "UK",
    });
    const f = r.findings.find((x) => x.check === "respectsMarketBoundary")!;
    expect(f.passed).toBe(true);
  });
});

describe("Reflection · overall report", () => {
  it("overallPass=true when all 5 checks pass", () => {
    const r = reflectOnReply({
      userMessage: "I need a hotel in Yogyakarta",
      reply: "I've got 14 real listings for hotels in Yogyakarta — Griya Sentana, Hotel Trim Tiga, Asia Afrika, and more. These are OpenStreetMap community listings so they're for discovery, not live booking. Do you want budget, mid-range, or something more upmarket?",
      userMarket: "ID",
      realPropertiesMentioned: 14,
      slots: { type: "hotel", location: "yogyakarta" },
    });
    expect(r.overallPass).toBe(true);
    expect(r.passedCount).toBe(5);
    expect(r.totalChecks).toBe(5);
  });

  it("overallPass=false when any check fails", () => {
    const r = reflectOnReply({
      userMessage: "Find me a hotel",
      reply: "Which city?",
      userMarket: "ID",
    });
    expect(r.overallPass).toBe(false);
    expect(r.passedCount).toBeLessThan(r.totalChecks);
  });
});
