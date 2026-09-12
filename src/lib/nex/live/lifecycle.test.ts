// src/lib/nex/live/lifecycle.test.ts
// NEX LIVE · Phase A · lifecycle state machine

import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  isTerminal,
  isDiscoverable,
  permitsLiveNowPresentation,
} from "./lifecycle";

describe("lifecycle · happy path transitions", () => {
  it("DRAFT → UPLOADING is allowed", () => {
    expect(canTransition("DRAFT", "UPLOADING")).toBe(true);
  });
  it("UPLOADING → PROCESSING is allowed", () => {
    expect(canTransition("UPLOADING", "PROCESSING")).toBe(true);
  });
  it("PROCESSING → READY is allowed", () => {
    expect(canTransition("PROCESSING", "READY")).toBe(true);
  });
  it("READY → PUBLISHED is allowed", () => {
    expect(canTransition("READY", "PUBLISHED")).toBe(true);
  });
  it("PUBLISHED → LIVE is allowed", () => {
    expect(canTransition("PUBLISHED", "LIVE")).toBe(true);
  });
  it("LIVE → ENDED is allowed", () => {
    expect(canTransition("LIVE", "ENDED")).toBe(true);
  });
  it("ENDED → ARCHIVED is allowed", () => {
    expect(canTransition("ENDED", "ARCHIVED")).toBe(true);
  });
});

describe("lifecycle · rejection", () => {
  it("DRAFT → LIVE is REJECTED (must upload+process+publish first)", () => {
    expect(canTransition("DRAFT", "LIVE")).toBe(false);
  });
  it("PROCESSING → LIVE is REJECTED (must go READY first)", () => {
    expect(canTransition("PROCESSING", "LIVE")).toBe(false);
  });
  it("READY → LIVE is REJECTED (must PUBLISH first)", () => {
    expect(canTransition("READY", "LIVE")).toBe(false);
  });
  it("REMOVED is terminal — no transition allowed", () => {
    expect(canTransition("REMOVED", "DRAFT")).toBe(false);
    expect(canTransition("REMOVED", "PUBLISHED")).toBe(false);
  });
  it("assertTransition throws with descriptive error on invalid", () => {
    expect(() => assertTransition("DRAFT", "LIVE")).toThrow(/invalid_lifecycle_transition:DRAFT->LIVE/);
  });
});

describe("lifecycle · failure/moderation paths", () => {
  it("UPLOADING → UPLOAD_FAILED is allowed", () => {
    expect(canTransition("UPLOADING", "UPLOAD_FAILED")).toBe(true);
  });
  it("PROCESSING → PROCESSING_FAILED is allowed", () => {
    expect(canTransition("PROCESSING", "PROCESSING_FAILED")).toBe(true);
  });
  it("UPLOAD_FAILED → UPLOADING allows retry", () => {
    expect(canTransition("UPLOAD_FAILED", "UPLOADING")).toBe(true);
  });
  it("BLOCKED → READY allows moderator reinstate", () => {
    expect(canTransition("BLOCKED", "READY")).toBe(true);
  });
  it("LIVE → BLOCKED allows moderation kill-switch", () => {
    expect(canTransition("LIVE", "BLOCKED")).toBe(true);
  });
});

describe("lifecycle · discoverability + presentation guards", () => {
  it("DRAFT is NOT discoverable", () => {
    expect(isDiscoverable("DRAFT")).toBe(false);
  });
  it("UPLOADING is NOT discoverable", () => {
    expect(isDiscoverable("UPLOADING")).toBe(false);
  });
  it("PUBLISHED is discoverable", () => {
    expect(isDiscoverable("PUBLISHED")).toBe(true);
  });
  it("LIVE is discoverable", () => {
    expect(isDiscoverable("LIVE")).toBe(true);
  });
  it("ENDED is discoverable (archived catalogue)", () => {
    expect(isDiscoverable("ENDED")).toBe(true);
  });
  it("only LIVE permits the live-now presentation", () => {
    expect(permitsLiveNowPresentation("LIVE")).toBe(true);
    expect(permitsLiveNowPresentation("PUBLISHED")).toBe(false);
    expect(permitsLiveNowPresentation("ENDED")).toBe(false);
  });
  it("REMOVED is terminal", () => {
    expect(isTerminal("REMOVED")).toBe(true);
    expect(isTerminal("ARCHIVED")).toBe(false);
  });
});
