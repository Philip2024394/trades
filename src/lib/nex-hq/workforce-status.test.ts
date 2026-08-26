// src/lib/nex-hq/workforce-status.test.ts

import { describe, it, expect } from "vitest";
import { resolveWorkforceStatus, WORKFORCE_STATUS_META, type WorkforceStatusInput } from "./workforce-status";

function baseInput(overrides: Partial<WorkforceStatusInput> = {}): WorkforceStatusInput {
  return {
    city: "Sleman",
    category: "market",
    walkerAvailable: true,
    rotationState: "build",
    lastCycleStatus: "completed",
    consecutiveZeroNewCycles: 0,
    inFlight: false,
    isQueued: false,
    isEligible: false,
    isWaitingCooldown: false,
    isGatedProvider: false,
    ...overrides,
  };
}

describe("resolveWorkforceStatus · precedence ladder", () => {
  it("unavailable trumps EVERYTHING when walker not available", () => {
    expect(resolveWorkforceStatus(baseInput({ walkerAvailable: false, inFlight: true, isQueued: true, rotationState: "saturated" }))).toBe("unavailable");
  });

  it("working trumps queued/waiting/saturated when cycle actively running", () => {
    expect(resolveWorkforceStatus(baseInput({ inFlight: true, isQueued: true, isWaitingCooldown: true, rotationState: "saturated" }))).toBe("working");
  });

  it("queued when orchestrator picked but not yet running", () => {
    expect(resolveWorkforceStatus(baseInput({ isQueued: true }))).toBe("queued");
  });

  it("waiting when provider gated", () => {
    expect(resolveWorkforceStatus(baseInput({ isGatedProvider: true }))).toBe("waiting");
  });

  it("waiting when fairness cooldown active", () => {
    expect(resolveWorkforceStatus(baseInput({ isWaitingCooldown: true }))).toBe("waiting");
  });

  it("saturated when rotation state = saturated (no active work)", () => {
    expect(resolveWorkforceStatus(baseInput({ rotationState: "saturated", isEligible: false }))).toBe("saturated");
  });

  it("error when last cycle failed AND not saturated/queued/working", () => {
    expect(resolveWorkforceStatus(baseInput({ lastCycleStatus: "failed" }))).toBe("error");
  });

  it("idle when eligible but not queued/waiting/working", () => {
    expect(resolveWorkforceStatus(baseInput({ isEligible: true }))).toBe("idle");
  });

  it("idle default when nothing else applies (never fake queued)", () => {
    expect(resolveWorkforceStatus(baseInput({}))).toBe("idle");
  });

  it("error does NOT override saturated (saturation is the more actionable signal)", () => {
    expect(resolveWorkforceStatus(baseInput({ rotationState: "saturated", lastCycleStatus: "failed" }))).toBe("saturated");
  });

  it("saturated does NOT override actively-working (walker mid-cycle after temporary saturation revisit)", () => {
    expect(resolveWorkforceStatus(baseInput({ rotationState: "saturated", inFlight: true }))).toBe("working");
  });

  it("saturated does NOT override queued (revisit is imminent)", () => {
    expect(resolveWorkforceStatus(baseInput({ rotationState: "saturated", isQueued: true }))).toBe("queued");
  });
});

describe("WORKFORCE_STATUS_META · every status has renderable metadata", () => {
  it("every status has a dot + label + bg + fg + border", () => {
    const statuses: (keyof typeof WORKFORCE_STATUS_META)[] = ["working", "queued", "waiting", "idle", "saturated", "error", "unavailable"];
    for (const s of statuses) {
      const m = WORKFORCE_STATUS_META[s];
      expect(m.dot.length).toBeGreaterThan(0);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.bg).toMatch(/^rgba/);
      expect(m.fg).toMatch(/^#/);
      expect(m.border).toMatch(/^rgba/);
    }
  });

  it("uses fine-grained emoji vocabulary (never generic red/green binary)", () => {
    const dots = new Set(Object.values(WORKFORCE_STATUS_META).map((m) => m.dot));
    expect(dots.size).toBeGreaterThanOrEqual(7);
  });
});
