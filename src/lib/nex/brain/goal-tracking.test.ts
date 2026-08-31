// Stage 3.9 · Phase 2 · Goal Tracking tests.
// Unit tests for the state machine + end-to-end orchestrator tests
// for interruption + resume + abandonment.

import { describe, it, expect, beforeEach } from "vitest";
import {
  newAccommodationGoal,
  progressAccommodationGoal,
  markGoalNotProgressed,
  completeGoal,
  shouldSurfaceResume,
  shouldSurfacePausedHint,
  resumeAcknowledgement,
  pausedHint,
} from "./goal-tracking";
import { orchestrateChatTurn } from "./orchestrate";
import { _resetSessionsForTests, getSession } from "./session";

describe("Goal state machine", () => {
  it("newAccommodationGoal creates an active goal", () => {
    const g = newAccommodationGoal({ type: "hotel", location: "yogyakarta" });
    expect(g.kind).toBe("accommodation");
    expect(g.status).toBe("active");
    expect(g.turnsSinceProgress).toBe(0);
    expect(g.summary.toLowerCase()).toContain("hotel");
    expect(g.summary.toLowerCase()).toContain("yogyakarta");
  });

  it("progressAccommodationGoal keeps an active goal active", () => {
    const g0 = newAccommodationGoal({ type: "hotel", location: "yogyakarta" });
    const g1 = progressAccommodationGoal(g0, { type: "hotel", location: "yogyakarta", budget: "budget" });
    expect(g1.status).toBe("active");
    expect(g1.turnsSinceProgress).toBe(0);
  });

  it("markGoalNotProgressed advances active → paused after 1 non-goal turn", () => {
    const g0 = newAccommodationGoal({ type: "hotel" });
    const g1 = markGoalNotProgressed(g0);
    expect(g1.status).toBe("paused");
    expect(g1.turnsSinceProgress).toBe(1);
  });

  it("progressAccommodationGoal transitions paused → resumed", () => {
    let g = newAccommodationGoal({ type: "hotel" });
    g = markGoalNotProgressed(g); // paused
    g = progressAccommodationGoal(g, { type: "hotel", budget: "budget" });
    expect(g.status).toBe("resumed");
  });

  it("resumed → active on the next progressing turn", () => {
    let g = newAccommodationGoal({ type: "hotel" });
    g = markGoalNotProgressed(g);        // paused
    g = progressAccommodationGoal(g, { type: "hotel", budget: "budget" });   // resumed
    g = progressAccommodationGoal(g, { type: "hotel", budget: "budget", area: "malioboro" }); // active
    expect(g.status).toBe("active");
  });

  it("abandons after 8 consecutive non-goal turns", () => {
    let g = newAccommodationGoal({ type: "hotel" });
    for (let i = 0; i < 8; i++) g = markGoalNotProgressed(g);
    expect(g.status).toBe("abandoned");
  });

  it("completeGoal marks the goal completed", () => {
    const g = completeGoal(newAccommodationGoal({ type: "hotel" }));
    expect(g.status).toBe("completed");
  });

  it("shouldSurfaceResume fires only on the resumed transition", () => {
    let g = newAccommodationGoal({ type: "hotel" });
    expect(shouldSurfaceResume(g)).toBe(false);
    g = markGoalNotProgressed(g);
    expect(shouldSurfaceResume(g)).toBe(false);
    g = progressAccommodationGoal(g, { type: "hotel", budget: "budget" });
    expect(shouldSurfaceResume(g)).toBe(true);
    g = progressAccommodationGoal(g, { type: "hotel", budget: "budget", area: "malioboro" });
    expect(shouldSurfaceResume(g)).toBe(false); // now active, not resumed
  });

  it("shouldSurfacePausedHint fires only on the first paused turn", () => {
    let g = newAccommodationGoal({ type: "hotel" });
    g = markGoalNotProgressed(g);
    expect(shouldSurfacePausedHint(g)).toBe(true);
    g = markGoalNotProgressed(g);
    expect(shouldSurfacePausedHint(g)).toBe(false); // now turnsSinceProgress=2
  });

  it("resumeAcknowledgement + pausedHint use the goal summary", () => {
    const g = newAccommodationGoal({ type: "hotel", location: "yogyakarta" });
    expect(resumeAcknowledgement(g).toLowerCase()).toContain("hotel");
    expect(pausedHint(g).toLowerCase()).toContain("hotel");
  });
});

describe("End-to-end interruption + resume via orchestrateChatTurn", () => {
  const cid = "goal-e2e-1";
  beforeEach(() => _resetSessionsForTests());

  it("goal is created on first accommodation turn (status=active)", () => {
    orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID", conversationId: cid });
    const s = getSession(cid);
    expect(s?.goal?.kind).toBe("accommodation");
    expect(s?.goal?.status).toBe("active");
  });

  it("knowledge question mid-flow (non-accommodation intent) pauses the goal + appends hint", () => {
    orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("What is Yogyakarta?", { userMarket: "ID", conversationId: cid });
    const s = getSession(cid);
    expect(s?.goal?.status).toBe("paused");
    expect(r.reply.toLowerCase()).toMatch(/keep the .* search in mind|word to continue/);
  });

  it("accommodation turn AFTER a knowledge interruption transitions goal → resumed and prepends 'Coming back to'", () => {
    orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("What is Yogyakarta?", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Cheap", { userMarket: "ID", conversationId: cid });
    const s = getSession(cid);
    expect(s?.goal?.status).toBe("resumed");
    expect(r.reply).toMatch(/^Coming back to/);
    expect(r.reply.toLowerCase()).toContain("hotel");
  });

  it("subsequent accommodation turn transitions resumed → active (no double 'Coming back to')", () => {
    orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("What is Yogyakarta?", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Cheap", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Near Malioboro", { userMarket: "ID", conversationId: cid });
    const s = getSession(cid);
    expect(s?.goal?.status).toBe("active");
    expect(r.reply).not.toMatch(/^Coming back to/);
  });

  it("BrainReply.capabilities lists exercised capabilities including goal_tracking + insight + memory", () => {
    const r = orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID", conversationId: cid });
    expect(r.capabilities).toContain("goal_tracking");
    expect(r.capabilities).toContain("insight");
    expect(r.capabilities).toContain("memory");
    expect(r.capabilities).toContain("intent");
    expect(r.capabilities).toContain("perception");
  });

  it("BrainReply.goal carries current goal state", () => {
    const r = orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID", conversationId: cid });
    expect(r.goal?.kind).toBe("accommodation");
    expect(r.goal?.status).toBe("active");
    expect(r.goal?.summary.toLowerCase()).toContain("hotel");
  });
});
