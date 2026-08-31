// Stage 3.12 · Phase 5 · Meta-Cognition unit tests.

import { describe, it, expect } from "vitest";
import { assessMetaCognition } from "./meta-cognition";
import type { ReflectionReport } from "./reflection";
import type { ConfidenceReport } from "./confidence";
import type { Goal } from "./goal-tracking";
import { recordLearning, _resetLearningForTests } from "./learning";

const NOW = Date.now();

function passingReflection(): ReflectionReport {
  return {
    overallPass: true,
    findings: [
      { check: "answersUserMessage", passed: true, reason: "ok" },
      { check: "internallyConsistent", passed: true, reason: "ok" },
      { check: "hasEvidenceForClaims", passed: true, reason: "ok" },
      { check: "respectsHonestBoundary", passed: true, reason: "ok" },
      { check: "respectsMarketBoundary", passed: true, reason: "ok" },
    ],
    passedCount: 5,
    totalChecks: 5,
  };
}

function failingReflection(failure: "hasEvidenceForClaims" | "respectsHonestBoundary" | "answersUserMessage"): ReflectionReport {
  const findings: ReflectionReport["findings"] = [
    { check: "answersUserMessage", passed: failure !== "answersUserMessage", reason: failure === "answersUserMessage" ? "empty reply" : "ok" },
    { check: "internallyConsistent", passed: true, reason: "ok" },
    { check: "hasEvidenceForClaims", passed: failure !== "hasEvidenceForClaims", reason: failure === "hasEvidenceForClaims" ? "count claim 14 but retrieval had 8" : "ok" },
    { check: "respectsHonestBoundary", passed: failure !== "respectsHonestBoundary", reason: failure === "respectsHonestBoundary" ? "invented booking claim" : "ok" },
    { check: "respectsMarketBoundary", passed: true, reason: "ok" },
  ];
  const passedCount = findings.filter((f) => f.passed).length;
  return { overallPass: passedCount === 5, findings, passedCount, totalChecks: 5 };
}

function highConfidence(): ConfidenceReport {
  return {
    overall: "high",
    reason: "reply carries 2 grounded claims",
    claims: [
      { claim: "real property names surfaced", evidence: "grounded_fact" },
      { claim: "count claim: 14 real listings", evidence: "grounded_fact", source: "real property retrieval count" },
    ],
    evidenceCount: 2,
    boundaryCount: 0,
  };
}

function unavailableConfidence(): ConfidenceReport {
  return {
    overall: "unavailable",
    reason: "reply is an honest boundary",
    claims: [{ claim: "honest boundary statement", evidence: "boundary" }],
    evidenceCount: 0,
    boundaryCount: 1,
  };
}

function activeGoal(): Goal {
  return { id: "g1", kind: "accommodation", status: "active", createdAt: NOW, updatedAt: NOW, turnsSinceProgress: 0, summary: "hotels in Yogyakarta" };
}

describe("Meta-Cognition · whatIKnow", () => {
  it("counts evidence + boundary from Confidence", () => {
    const m = assessMetaCognition({
      reply: "I've got 14 real listings...",
      reflection: passingReflection(),
      confidence: highConfidence(),
      goal: activeGoal(),
      slots: { type: "hotel", location: "yogyakarta" },
    });
    expect(m.whatIKnow.hasGroundedEvidence).toBe(true);
    expect(m.whatIKnow.evidenceCount).toBe(2);
    expect(m.whatIKnow.boundaryCount).toBe(0);
    expect(m.whatIKnow.goal?.summary).toContain("hotels");
    expect(m.whatIKnow.slotsFilled).toEqual(["type", "location"]);
  });

  it("reports boundary count for unavailable-confidence turns", () => {
    const m = assessMetaCognition({
      reply: "I can't book yet...",
      reflection: passingReflection(),
      confidence: unavailableConfidence(),
    });
    expect(m.whatIKnow.hasGroundedEvidence).toBe(false);
    expect(m.whatIKnow.boundaryCount).toBe(1);
  });
});

describe("Meta-Cognition · howSure", () => {
  it("composes confidence + reflection pass ratio", () => {
    const m = assessMetaCognition({
      reply: "test",
      reflection: passingReflection(),
      confidence: highConfidence(),
    });
    expect(m.howSure.confidenceLevel).toBe("high");
    expect(m.howSure.reflectionOverallPass).toBe(true);
    expect(m.howSure.reflectionPassRatio).toBe("5/5");
  });
});

describe("Meta-Cognition · amIWrong", () => {
  it("fabrication risk = high when Reflection catches evidence/honesty failure", () => {
    const m = assessMetaCognition({
      reply: "I've got 27 listings...",
      reflection: failingReflection("hasEvidenceForClaims"),
      confidence: highConfidence(),
    });
    expect(m.amIWrong.fabricationRisk).toBe("high");
    expect(m.amIWrong.reflectionFailures.length).toBeGreaterThan(0);
    expect(m.amIWrong.reflectionFailures[0]).toContain("hasEvidenceForClaims");
  });

  it("fabrication risk = high when Reflection catches invented booking", () => {
    const m = assessMetaCognition({
      reply: "Booked!",
      reflection: failingReflection("respectsHonestBoundary"),
      confidence: highConfidence(),
    });
    expect(m.amIWrong.fabricationRisk).toBe("high");
  });

  it("fabrication risk = low when everything passes", () => {
    const m = assessMetaCognition({
      reply: "healthy reply",
      reflection: passingReflection(),
      confidence: highConfidence(),
    });
    expect(m.amIWrong.fabricationRisk).toBe("low");
    expect(m.amIWrong.reflectionFailures).toEqual([]);
  });

  it("fabrication risk = medium when Confidence=low", () => {
    const m = assessMetaCognition({
      reply: "vague reply",
      reflection: passingReflection(),
      confidence: { overall: "low", reason: "no claims", claims: [], evidenceCount: 0, boundaryCount: 0 },
    });
    expect(m.amIWrong.fabricationRisk).toBe("medium");
  });
});

describe("Meta-Cognition · whatShouldIDo", () => {
  it("recognises goal_resume when goal just transitioned to resumed", () => {
    const g: Goal = { ...activeGoal(), status: "resumed" };
    const m = assessMetaCognition({
      reply: "Coming back to hotels in Yogyakarta...",
      reflection: passingReflection(),
      confidence: highConfidence(),
      goal: g,
    });
    expect(m.whatShouldIDo.origin).toBe("goal_resume");
  });

  it("recognises boundary_disclosed for unavailable confidence", () => {
    const m = assessMetaCognition({
      reply: "I can't book that.",
      reflection: passingReflection(),
      confidence: unavailableConfidence(),
    });
    expect(m.whatShouldIDo.origin).toBe("boundary_disclosed");
  });

  it("recognises insight_next_question when reply ends with '?'", () => {
    const m = assessMetaCognition({
      reply: "Do you want budget, mid-range, or upmarket?",
      reflection: passingReflection(),
      confidence: { overall: "medium", reason: "conversational step", claims: [], evidenceCount: 0, boundaryCount: 0 },
    });
    expect(m.whatShouldIDo.origin).toBe("insight_next_question");
    expect(m.whatShouldIDo.action).toContain("ask:");
  });

  it("recognises goal_progress when goal is active and reply presented candidates", () => {
    const m = assessMetaCognition({
      reply: "Got it — budget hotels near Malioboro. Griya Sentana, Hotel Trim Tiga, and more. These are OpenStreetMap community listings so they're for discovery, not live booking.",
      reflection: passingReflection(),
      confidence: highConfidence(),
      goal: activeGoal(),
    });
    expect(["goal_progress", "grounded_answer"]).toContain(m.whatShouldIDo.origin);
  });
});

describe("Meta-Cognition · whatILearned (Stage 3.13)", () => {
  it("empty ledger for a fresh conversation → count=0 · summary omits 'learned='", () => {
    _resetLearningForTests();
    const m = assessMetaCognition({
      reply: "healthy reply",
      reflection: passingReflection(),
      confidence: highConfidence(),
      conversationId: "fresh-conv",
    });
    expect(m.whatILearned.count).toBe(0);
    expect(m.whatILearned.recentEntries).toEqual([]);
    expect(m.summary).not.toContain("learned=");
  });

  it("ledger entries scoped to conversation surface in whatILearned", () => {
    _resetLearningForTests();
    recordLearning({ kind: "insight_gap_detected", conversationId: "conv-X", scope: "accommodation.pricing", summary: "user asked about price" });
    recordLearning({ kind: "confidence_low", conversationId: "conv-X", scope: "accommodation.confidence", summary: "no claims" });
    recordLearning({ kind: "insight_gap_detected", conversationId: "conv-Y", scope: "accommodation.amenities", summary: "OTHER conversation gap" });
    const m = assessMetaCognition({
      reply: "any",
      reflection: passingReflection(),
      confidence: highConfidence(),
      conversationId: "conv-X",
    });
    expect(m.whatILearned.count).toBe(2);
    expect(m.whatILearned.recentEntries.map((e) => e.summary)).toEqual([
      "no claims",
      "user asked about price",
    ]);
    expect(m.summary).toContain("learned=2");
  });

  it("no conversationId → whatILearned is empty (never leaks other conversations)", () => {
    _resetLearningForTests();
    recordLearning({ kind: "insight_gap_detected", conversationId: "conv-A", summary: "leak?" });
    const m = assessMetaCognition({
      reply: "any",
      reflection: passingReflection(),
      confidence: highConfidence(),
    });
    expect(m.whatILearned.count).toBe(0);
  });
});

describe("Meta-Cognition · summary line", () => {
  it("summary is one line and contains confidence + reflection + fabrication + goal + next", () => {
    const m = assessMetaCognition({
      reply: "I've got 14 real listings...",
      reflection: passingReflection(),
      confidence: highConfidence(),
      goal: activeGoal(),
    });
    expect(m.summary).toContain("confidence=high");
    expect(m.summary).toContain("reflection=5/5");
    expect(m.summary).toContain("fabrication_risk=low");
    expect(m.summary).toContain("goal=active");
    expect(m.summary).toContain("next=");
    expect(m.summary.split("\n").length).toBe(1);
  });
});
