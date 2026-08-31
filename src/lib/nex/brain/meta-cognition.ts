// src/lib/nex/brain/meta-cognition.ts
//
// Stage 3.12 · Phase 5 · Meta-Cognition (Philip 2026-08-31).
//
// CONSTITUTIONAL. Meta-Cognition is the umbrella that composes the
// constitutional honesty capabilities (Truth · Reflection · Confidence)
// into ONE self-awareness summary per turn. Philip's spec:
//
//   "What do I know?"    → what evidence + slots + goal did we actually use
//   "How sure am I?"     → composed confidence + reflection pass rate
//   "Am I wrong?"        → reflection failures + fabrication risk
//   "What should I do?"  → next-best action from Insight / Goal
//   "Did it work?"       → Verification (Phase 6 · not yet)
//   "What changed?"      → slot/goal deltas + gap writes
//   "What did I learn?"  → Learning (Phase 7 · not yet)
//
// v1 covers the four constitutional questions that have their inputs
// live today: whatIKnow · howSure · amIWrong · whatShouldIDo. The
// remaining three light up as their upstream capabilities do.
//
// v1 is OBSERVATIONAL. Report attached to response. Reply not
// rewritten. Downstream: Meta-Cognition can trigger targeted responses
// like "I noticed I was uncertain about X — want me to check more
// carefully?" once we have a re-composition loop.

import type { ReflectionReport } from "./reflection";
import type { ConfidenceReport, ConfidenceLevel } from "./confidence";
import type { Goal } from "./goal-tracking";
import { recentLearningForConversation, type LearningEntry } from "./learning";
import type { RecognisedEntity } from "./entities";
import type { VerificationReport } from "./verification";

export type FabricationRisk = "low" | "medium" | "high";

export type MetaCognitionReport = {
  /** "What do I know?" · what NEX actually used for this turn. */
  whatIKnow: {
    hasGroundedEvidence: boolean;
    evidenceCount: number;
    boundaryCount: number;
    goal: { kind: string; status: string; summary: string } | null;
    slotsFilled: string[];
    /** Stage 3.14 · entities NEX has recognised in this session
     *  (rolling window · last ~30 unique · both user-mentioned and
     *  NEX-presented). Bounded summary for observability; full window
     *  lives in session state. */
    entitiesSeen: { total: number; byKind: Record<string, number> };
  };
  /** "How sure am I?" · composed confidence + reflection pass rate. */
  howSure: {
    confidenceLevel: ConfidenceLevel;
    confidenceReason: string;
    reflectionOverallPass: boolean;
    reflectionPassRatio: string; // "5/5"
  };
  /** "Am I wrong?" · reflection failures + fabrication risk assessment. */
  amIWrong: {
    reflectionFailures: string[];
    fabricationRisk: FabricationRisk;
    fabricationReason: string;
  };
  /** "What should I do?" · next-best action recommendation. */
  whatShouldIDo: {
    action: string;
    origin: "goal_resume" | "goal_progress" | "insight_next_question" | "boundary_disclosed" | "grounded_answer" | "silence";
  };
  /** "What did I learn?" · Stage 3.13 · recent Learning ledger entries
   *  scoped to this conversation. Real signals only · never fabricated. */
  whatILearned: {
    recentEntries: Array<{ kind: string; scope?: string; summary: string; atMs: number }>;
    count: number;
  };
  /** "Did it work?" · Stage 3.22 · answered by Verification when an
   *  action executed · reports applicable=false when nothing happened
   *  this turn to verify. Completes constitutional five loop. */
  didItWork: {
    applicable: boolean;
    passed?: boolean;
    reason?: string;
    summary?: string;
  };
  /** One-line human-readable summary of NEX's self-assessment. */
  summary: string;
};

export type MetaCognitionInput = {
  reply: string;
  reflection?: ReflectionReport;
  confidence?: ConfidenceReport;
  goal?: Goal | null;
  slots?: Record<string, unknown>;
  intent?: string;
  conversationId?: string;
  /** Stage 3.14 · session entity window · consumed for whatIKnow. */
  entities?: ReadonlyArray<RecognisedEntity>;
  /** Stage 3.22 · Verification report from Action outcome · consumed
   *  for didItWork. */
  verification?: VerificationReport;
};

// ─── Fabrication risk heuristic ──────────────────────────────────────

function assessFabricationRisk(
  reflection: ReflectionReport | undefined,
  confidence: ConfidenceReport | undefined,
): { risk: FabricationRisk; reason: string } {
  // High risk: reflection caught a hasEvidenceForClaims failure OR a
  // respectsHonestBoundary failure (both point to invented content).
  const hardFailures = reflection?.findings.filter(
    (f) => !f.passed && (f.check === "hasEvidenceForClaims" || f.check === "respectsHonestBoundary")
  ) ?? [];
  if (hardFailures.length > 0) {
    return { risk: "high", reason: `Reflection caught ${hardFailures.length} evidence/honesty failure(s)` };
  }
  // Medium risk: Confidence overall = low (no recognisable claims)
  // combined with a non-empty reply · that's a case where NEX said
  // something without a clear claim type.
  if (confidence?.overall === "low") {
    return { risk: "medium", reason: "Confidence assessor found no recognisable claims" };
  }
  // Medium risk: any reflection failure at all (softer than hard failures)
  const softFailures = reflection?.findings.filter((f) => !f.passed) ?? [];
  if (softFailures.length > 0) {
    return { risk: "medium", reason: `${softFailures.length} soft reflection failure(s)` };
  }
  return { risk: "low", reason: "no reflection failures · confidence acceptable" };
}

// ─── Next-best action inference ──────────────────────────────────────

function inferNextBestAction(
  reply: string,
  confidence: ConfidenceReport | undefined,
  goal: Goal | null | undefined,
): { action: string; origin: MetaCognitionReport["whatShouldIDo"]["origin"] } {
  // Goal just resumed → surface the resume acknowledgement.
  if (goal?.status === "resumed") {
    return { action: `resume ${goal.summary}`, origin: "goal_resume" };
  }
  // Honest boundary disclosed → nothing more to do, the boundary IS the action.
  if (confidence?.overall === "unavailable") {
    return { action: "boundary disclosed · no further action available", origin: "boundary_disclosed" };
  }
  // Reply ends with a question → we're seeking one more piece of info.
  const trimmed = reply.trim();
  if (trimmed.endsWith("?")) {
    // Extract the question.
    const lastSentence = trimmed.split(/[.!]/).filter((s) => s.trim().length > 0).pop() ?? trimmed;
    return { action: `ask: "${lastSentence.trim().slice(0, 100)}"`, origin: "insight_next_question" };
  }
  // Grounded knowledge answer without question → we delivered a fact.
  if (confidence?.overall === "high" && confidence.claims.some((c) => c.evidence === "retrieved")) {
    return { action: "grounded answer delivered · await user's next turn", origin: "grounded_answer" };
  }
  // Goal actively progressing without a trailing question → we presented results.
  if (goal?.status === "active" || goal?.status === "resumed") {
    return { action: `presented candidates for ${goal.summary} · await refinement`, origin: "goal_progress" };
  }
  return { action: "no explicit next-step signal", origin: "silence" };
}

// ─── The composer ────────────────────────────────────────────────────

export function assessMetaCognition(input: MetaCognitionInput): MetaCognitionReport {
  const { reflection, confidence, goal, slots } = input;

  const slotsFilled = slots
    ? Object.entries(slots).filter(([, v]) => v !== undefined && v !== null && (typeof v !== "string" || v.length > 0)).map(([k]) => k)
    : [];

  // Stage 3.14 · entity roll-up for whatIKnow.
  const entities = input.entities ?? [];
  const entityByKind: Record<string, number> = {};
  for (const e of entities) entityByKind[e.kind] = (entityByKind[e.kind] ?? 0) + 1;

  const whatIKnow = {
    hasGroundedEvidence: (confidence?.evidenceCount ?? 0) > 0,
    evidenceCount: confidence?.evidenceCount ?? 0,
    boundaryCount: confidence?.boundaryCount ?? 0,
    goal: goal
      ? { kind: goal.kind, status: goal.status, summary: goal.summary }
      : null,
    slotsFilled,
    entitiesSeen: { total: entities.length, byKind: entityByKind },
  };

  const howSure = {
    confidenceLevel: (confidence?.overall ?? "low") as ConfidenceLevel,
    confidenceReason: confidence?.reason ?? "no confidence report available",
    reflectionOverallPass: reflection?.overallPass ?? false,
    reflectionPassRatio: reflection ? `${reflection.passedCount}/${reflection.totalChecks}` : "0/0",
  };

  const reflectionFailures = (reflection?.findings ?? [])
    .filter((f) => !f.passed)
    .map((f) => `${f.check}: ${f.reason}`);

  const fabrication = assessFabricationRisk(reflection, confidence);
  const amIWrong = {
    reflectionFailures,
    fabricationRisk: fabrication.risk,
    fabricationReason: fabrication.reason,
  };

  const whatShouldIDo = inferNextBestAction(input.reply, confidence, goal);

  // Stage 3.13 · whatILearned · reads real Learning ledger entries.
  // Never fabricated · empty when the ledger is empty for this conversation.
  const recent = recentLearningForConversation(input.conversationId, 5);
  const whatILearned = {
    recentEntries: recent.map((e: LearningEntry) => ({
      kind: e.kind,
      scope: e.scope,
      summary: e.summary,
      atMs: e.atMs,
    })),
    count: recent.length,
  };

  // Stage 3.22 · didItWork · reads real Verification report.
  // Never fabricates · reports applicable=false honestly when nothing
  // was executed this turn.
  const v = input.verification;
  const didItWork = v
    ? (v.applicable
      ? { applicable: true, passed: v.passed, summary: v.summary }
      : { applicable: false, reason: v.reason, summary: v.summary })
    : { applicable: false, reason: "no_verification_report" as const, summary: "no verification report attached" };

  // Compose a one-line human-readable summary.
  const parts: string[] = [];
  parts.push(`confidence=${howSure.confidenceLevel}`);
  parts.push(`reflection=${howSure.reflectionPassRatio}`);
  parts.push(`fabrication_risk=${amIWrong.fabricationRisk}`);
  if (whatIKnow.goal) parts.push(`goal=${whatIKnow.goal.status}`);
  parts.push(`next=${whatShouldIDo.origin}`);
  if (whatILearned.count > 0) parts.push(`learned=${whatILearned.count}`);
  if (didItWork.applicable) parts.push(`didItWork=${didItWork.passed ? "yes" : "NO"}`);
  const summary = parts.join(" · ");

  return { whatIKnow, howSure, amIWrong, whatShouldIDo, whatILearned, didItWork, summary };
}
