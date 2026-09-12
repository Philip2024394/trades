// src/lib/nex/live/first-use-prefs.test.ts
//
// NEX Music/Video · first-use tutorial prefs tests · Phase M

import { describe, it, expect, beforeEach } from "vitest";
import {
  hasCompletedTutorial,
  markTutorialComplete,
  currentTutorialLesson,
  advanceTutorialLesson,
  replayTutorial,
  TUTORIAL_LESSONS,
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_STEP_STORAGE_KEY,
} from "./first-use-prefs";

// Minimal in-memory localStorage shim for vitest's jsdom-free environment.
// Vitest defaults to node · we install a shim before each test.
beforeEach(() => {
  const store = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  (globalThis as unknown as { window?: { localStorage: typeof stub } }).window = { localStorage: stub };
});

describe("first-use-prefs · storage keys are stable identifiers", () => {
  it("uses namespaced storage keys · never collides with other NEX prefs", () => {
    expect(TUTORIAL_STORAGE_KEY).toMatch(/^nex\.music\.spatial\.tutorial/);
    expect(TUTORIAL_STEP_STORAGE_KEY).toMatch(/^nex\.music\.spatial\.tutorial/);
    expect(TUTORIAL_STORAGE_KEY).not.toBe(TUTORIAL_STEP_STORAGE_KEY);
  });
});

describe("first-use-prefs · tutorial lifecycle (§14 §15)", () => {
  it("fresh user has NOT completed the tutorial", () => {
    expect(hasCompletedTutorial()).toBe(false);
  });

  it("fresh user starts on the 'down' lesson", () => {
    expect(currentTutorialLesson()).toBe("down");
  });

  it("markTutorialComplete flips both flags", () => {
    markTutorialComplete();
    expect(hasCompletedTutorial()).toBe(true);
    expect(currentTutorialLesson()).toBe("done");
  });

  it("progressive advance follows down → left → right → up → done", () => {
    let cursor = currentTutorialLesson();
    expect(cursor).toBe("down");
    cursor = advanceTutorialLesson(cursor); expect(cursor).toBe("left");
    cursor = advanceTutorialLesson(cursor); expect(cursor).toBe("right");
    cursor = advanceTutorialLesson(cursor); expect(cursor).toBe("up");
    cursor = advanceTutorialLesson(cursor); expect(cursor).toBe("done");
    expect(hasCompletedTutorial()).toBe(true);
  });

  it("advancing when already done stays done · never loops", () => {
    markTutorialComplete();
    const next = advanceTutorialLesson("done");
    expect(next).toBe("done");
  });

  it("replayTutorial resets to 'down' and clears completion", () => {
    markTutorialComplete();
    expect(hasCompletedTutorial()).toBe(true);
    replayTutorial();
    expect(hasCompletedTutorial()).toBe(false);
    expect(currentTutorialLesson()).toBe("down");
  });
});

describe("first-use-prefs · lesson order matches doctrine (§12)", () => {
  it("ordered exactly: down · left · right · up · done", () => {
    expect(TUTORIAL_LESSONS).toEqual(["down", "left", "right", "up", "done"]);
  });
});
