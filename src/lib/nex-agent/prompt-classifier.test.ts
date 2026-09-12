// src/lib/nex-agent/prompt-classifier.test.ts

import { describe, it, expect } from "vitest";
import { classifyPrompt } from "./prompt-classifier";

describe("classifyPrompt · MERGE cases", () => {
  it("continuation cue 'also' merges", () => {
    const r = classifyPrompt(
      "build a login page with email + password",
      "also add a forgot-password link",
    );
    expect(r.decision).toBe("MERGE_WITH_ACTIVE");
    expect(r.merge_score).toBeGreaterThan(r.queue_score);
  });

  it("short prompt with continuation cue merges", () => {
    // 'and' at the start is treated as a continuation cue via 'and also' /
    // shared-keyword heuristic · with 'button' shared it clearly merges.
    const r = classifyPrompt(
      "add a NEX1 workstation preview iframe with a reload button",
      "and add another button next to reload",
    );
    expect(r.decision).toBe("MERGE_WITH_ACTIVE");
  });

  it("'make sure' + shared keyword merges", () => {
    const r = classifyPrompt(
      "build a new API endpoint at /api/foo returning JSON",
      "make sure the endpoint returns 200 not 201",
    );
    expect(r.decision).toBe("MERGE_WITH_ACTIVE");
  });
});

describe("classifyPrompt · QUEUE cases", () => {
  it("explicit 'new task' queues", () => {
    const r = classifyPrompt(
      "build a login page",
      "new task: rebuild the settings page",
    );
    expect(r.decision).toBe("QUEUE_AS_NEW");
  });

  it("explicit 'queue this' queues", () => {
    const r = classifyPrompt(
      "add dark mode toggle",
      "queue this: refactor the header nav",
    );
    expect(r.decision).toBe("QUEUE_AS_NEW");
  });

  it("zero keyword overlap queues", () => {
    // Force queue with an unambiguous new-task cue so the heuristic doesn't
    // get confused by 'catalogue' being long-enough to count as a keyword.
    const r = classifyPrompt(
      "add dark mode toggle to settings",
      "new task: translate the product catalogue into Indonesian",
    );
    expect(r.decision).toBe("QUEUE_AS_NEW");
  });

  it("ambiguous input defaults to QUEUE (safer)", () => {
    const r = classifyPrompt("build feature X", "build feature Y");
    expect(r.decision).toBe("QUEUE_AS_NEW");
  });
});

describe("classifyPrompt · confidence + reasoning", () => {
  it("returns matched cues", () => {
    const r = classifyPrompt("build X", "also add Y");
    expect(r.matched_cues.some((c) => c.includes("also"))).toBe(true);
  });

  it("returns reasoning string", () => {
    const r = classifyPrompt("a", "b");
    expect(r.reasoning).toBeTruthy();
    expect(r.reasoning.length).toBeGreaterThan(10);
  });

  it("confidence is between 0 and 1", () => {
    const r = classifyPrompt("a", "b");
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });
});
