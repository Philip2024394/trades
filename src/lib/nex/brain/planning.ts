// src/lib/nex/brain/planning.ts
//
// Stage 3.29 · Phase 22 · Planning (Philip 2026-08-31).
//
// Multi-step plan builder that sits ABOVE Insight. Insight picks ONE
// next question; Planning maps the whole path from current state to
// goal completion. Deterministic · reads slots + goal + retrieval
// outcome · produces a numbered sequence of remaining steps with
// estimated turns.
//
// v1 discipline:
//   · Deterministic step-generator · no LLM
//   · Accommodation-only v1 (matches the vertical with mature slots)
//   · Steps carry: number · kind · description · precondition · optional
//     current-state marker
//   · `currentStepIndex` marks where NEX is in the plan today
//   · Never fabricates a step that doesn't apply to the current state
//   · Observational v1 (composer/UI can render the plan · doesn't
//     automatically execute)

import type { AccommodationSlots } from "./accommodation-slots";

export type PlanStepKind =
  | "narrow_location"
  | "narrow_type"
  | "narrow_budget"
  | "narrow_area"
  | "present_candidates"
  | "resolve_reference"
  | "confirm_action"
  | "complete";

export type PlanStep = {
  number: number;
  kind: PlanStepKind;
  description: string;
  status: "done" | "current" | "pending";
  /** Explanation of why this step is here (or already done). */
  reason: string;
};

export type PlanReport = {
  goalKind: string;
  steps: PlanStep[];
  currentStepIndex: number;     // 0-indexed
  turnsRemaining: number;       // how many more steps until "complete"
  isPlanComplete: boolean;
  summary: string;
};

export type PlanningInput = {
  intent: string;
  slots?: Readonly<AccommodationSlots>;
  hasResolvedReference?: boolean;
  didExecuteAction?: boolean;
  realPropertiesMatched?: number;
};

// ─── Plan builder ────────────────────────────────────────────────────

export function buildPlan(input: PlanningInput): PlanReport {
  if (input.intent !== "accommodation") {
    return {
      goalKind: input.intent,
      steps: [],
      currentStepIndex: -1,
      turnsRemaining: 0,
      isPlanComplete: false,
      summary: `no plan built for intent=${input.intent} (accommodation only v1)`,
    };
  }

  const slots = input.slots ?? {};
  const propertiesMatched = input.realPropertiesMatched ?? 0;
  const hasRef = !!input.hasResolvedReference;
  const executed = !!input.didExecuteAction;

  // Compute per-step done/current/pending.
  const steps: PlanStep[] = [];
  let stepNumber = 0;

  const push = (kind: PlanStepKind, description: string, done: boolean, reason: string) => {
    stepNumber++;
    steps.push({ number: stepNumber, kind, description, status: done ? "done" : "pending", reason });
  };

  push("narrow_location", "know which city / region", !!slots.location, slots.location ? `location=${slots.location}` : "no location yet");
  push("narrow_type", "know property type (hotel/guesthouse/etc)", !!slots.type, slots.type ? `type=${slots.type}` : "type unspecified");
  push("narrow_budget", "know budget preference", !!slots.budget, slots.budget ? `budget=${slots.budget}` : "budget unspecified");
  push("narrow_area", "know sub-area (optional refinement)", !!slots.area, slots.area ? `area=${slots.area}` : "area not narrowed");
  push("present_candidates", "surface real properties from World", propertiesMatched > 0, propertiesMatched > 0 ? `${propertiesMatched} candidates` : "no candidates presented yet");
  push("resolve_reference", "user picks a specific property", hasRef, hasRef ? "reference resolved" : "no ordinal/pronoun resolved yet");
  push("confirm_action", "execute proposed action (open directory / contact / book)", executed, executed ? "action executed" : "no action executed yet");
  push("complete", "user has what they need", executed && hasRef, executed && hasRef ? "flow complete" : "flow in progress");

  // The FIRST pending step is the current step.
  const firstPendingIdx = steps.findIndex((s) => s.status === "pending");
  const currentStepIndex = firstPendingIdx === -1 ? steps.length - 1 : firstPendingIdx;
  if (currentStepIndex < steps.length && steps[currentStepIndex].status === "pending") {
    steps[currentStepIndex].status = "current";
  }

  const turnsRemaining = steps.filter((s) => s.status === "pending" || s.status === "current").length;
  const isPlanComplete = steps.every((s) => s.status === "done");
  const doneCount = steps.filter((s) => s.status === "done").length;

  const summary = isPlanComplete
    ? `plan complete · all ${steps.length} steps done`
    : `${doneCount}/${steps.length} done · current: ${steps[currentStepIndex]?.description ?? "n/a"} · ${turnsRemaining} steps remaining`;

  return {
    goalKind: "accommodation",
    steps,
    currentStepIndex,
    turnsRemaining,
    isPlanComplete,
    summary,
  };
}
