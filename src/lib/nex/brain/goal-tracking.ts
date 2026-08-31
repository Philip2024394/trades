// src/lib/nex/brain/goal-tracking.ts
//
// Stage 3.9 · Phase 2 · Goal Tracking (Philip 2026-08-31).
//
// Explicit goal object with a state machine, so NEX can:
//   · know what the user is currently trying to accomplish
//   · preserve that goal across knowledge interruptions
//   · offer to resume when the user returns
//   · detect abandonment gracefully
//
// State machine:
//   active   — the current turn is directly progressing this goal
//   paused   — a non-goal turn happened (knowledge question / greeting)
//   resumed  — first turn back to the goal after a pause
//   completed — user accepted a result (future signal)
//   abandoned — session TTL expired or user explicitly walked away
//
// The Goal is attached to SessionState alongside the accommodation slots.
// It's a canonical layer above slots · goal describes WHAT the user
// wants to accomplish, slots describe HOW to search for it.

import type { AccommodationSlots } from "./accommodation-slots";
import { describeSlots } from "./accommodation-slots";

export type GoalKind =
  | "accommodation"
  | "food"          // future
  | "commerce"      // future
  | "conversation"; // catch-all when no discovery goal is active

export type GoalStatus =
  | "active"
  | "paused"
  | "resumed"
  | "completed"
  | "abandoned";

export type Goal = {
  id: string;
  kind: GoalKind;
  status: GoalStatus;
  createdAt: number;
  updatedAt: number;
  /** Turns since the goal was last directly touched. */
  turnsSinceProgress: number;
  /** Short human-readable description of the goal — for resume prompts. */
  summary: string;
};

const GOAL_PAUSE_TURNS = 1;     // one non-goal turn is enough to mark paused
const GOAL_ABANDON_TURNS = 8;   // 8 consecutive non-goal turns → abandon

/** Create a new active goal from an accommodation intent turn. */
export function newAccommodationGoal(slots: AccommodationSlots, now: number = Date.now()): Goal {
  return {
    id: `goal:accommodation:${now}`,
    kind: "accommodation",
    status: "active",
    createdAt: now,
    updatedAt: now,
    turnsSinceProgress: 0,
    summary: describeSlots(slots) || "an accommodation search",
  };
}

/** Update the goal after an accommodation-progressing turn.
 *  Transitions:
 *    active   → active   (still working on it)
 *    paused   → resumed  (user returned after an interruption)
 *    resumed  → active   (welcome-back was on the previous turn; back to normal)
 *    completed / abandoned → active   (user re-engaged after ending) */
export function progressAccommodationGoal(
  goal: Goal,
  slots: AccommodationSlots,
  now: number = Date.now(),
): Goal {
  const nextStatus: GoalStatus = goal.status === "paused" ? "resumed" : "active";
  return {
    ...goal,
    status: nextStatus,
    updatedAt: now,
    turnsSinceProgress: 0,
    summary: describeSlots(slots) || goal.summary,
  };
}

/** Called when the current turn did NOT progress the goal (knowledge
 *  question, greeting, weather, food, etc.). Escalates the goal to
 *  paused, then to abandoned if it stays untouched long enough. */
export function markGoalNotProgressed(goal: Goal, now: number = Date.now()): Goal {
  const next: Goal = {
    ...goal,
    turnsSinceProgress: goal.turnsSinceProgress + 1,
    updatedAt: now,
  };
  if (next.status === "active" && next.turnsSinceProgress >= GOAL_PAUSE_TURNS) {
    next.status = "paused";
  }
  if (next.status === "resumed") {
    // A resumed goal that doesn't progress transitions straight back to active
    // on the NEXT progressing turn; if it fails to progress here, it goes
    // back to paused.
    next.status = "paused";
  }
  if (next.status === "paused" && next.turnsSinceProgress >= GOAL_ABANDON_TURNS) {
    next.status = "abandoned";
  }
  return next;
}

/** Called after a real property is presented to the user with a narrow
 *  set (≤3 matches) · the goal moves to "completed" once the user
 *  accepts / opens directory / books (future action layer). For v1
 *  this is called by the orchestrator when Insight fires the narrow-
 *  list opportunity signal and the user acknowledges. Not wired in v1. */
export function completeGoal(goal: Goal, now: number = Date.now()): Goal {
  return { ...goal, status: "completed", updatedAt: now, turnsSinceProgress: 0 };
}

/** Should the composer surface a "welcome back to your X search"
 *  acknowledgement this turn? Only when the goal transitioned into
 *  `resumed` on THIS turn (not on subsequent active turns). */
export function shouldSurfaceResume(goal: Goal): boolean {
  return goal.status === "resumed";
}

/** Short resume acknowledgement to prepend to the reply. */
export function resumeAcknowledgement(goal: Goal): string {
  return `Coming back to ${goal.summary}. `;
}

/** Should the composer surface a "do you still want X?" prompt this turn?
 *  Fires when the goal is paused AND the user just asked a non-goal
 *  question · the composer appends a soft nudge to the knowledge answer
 *  so the user knows the search is preserved. */
export function shouldSurfacePausedHint(goal: Goal): boolean {
  return goal.status === "paused" && goal.turnsSinceProgress === 1;
}

export function pausedHint(goal: Goal): string {
  return ` (I'll keep the ${goal.summary} search in mind — just say the word to continue.)`;
}
