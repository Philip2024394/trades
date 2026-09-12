// src/lib/nex-agent/error-guardian.test.ts

import { describe, it, expect } from "vitest";
import { pickPositiveMessage, pickClearMessage, errorSignature, POSITIVE_MESSAGES, CLEAR_MESSAGES } from "./error-guardian";

describe("errorSignature", () => {
  it("deterministic across calls", () => {
    const err = new Error("Cannot read property foo of undefined");
    expect(errorSignature(err, "chip-upload")).toBe(errorSignature(err, "chip-upload"));
  });
  it("differs by context", () => {
    const err = new Error("boom");
    const a = errorSignature(err, "context-a");
    const b = errorSignature(err, "context-b");
    expect(a).not.toBe(b);
  });
  it("handles string errors", () => {
    expect(errorSignature("failed to compile", "ctx")).toBeTruthy();
  });
  it("handles unknown errors", () => {
    expect(errorSignature({ weird: "shape" }, "ctx")).toBeTruthy();
  });
});

describe("pickPositiveMessage", () => {
  it("always returns a message from the pool", () => {
    const m = pickPositiveMessage("sig-123");
    expect(POSITIVE_MESSAGES).toContainEqual(m);
  });
  it("deterministic per signature", () => {
    const a = pickPositiveMessage("same-signature");
    const b = pickPositiveMessage("same-signature");
    expect(a.title).toBe(b.title);
  });
  it("never contains error language", () => {
    for (const m of POSITIVE_MESSAGES) {
      expect(m.title.toLowerCase()).not.toContain("error");
      expect(m.title.toLowerCase()).not.toContain("failed");
      expect(m.title.toLowerCase()).not.toContain("crash");
    }
  });
});

describe("pickClearMessage", () => {
  it("returns positive completion text", () => {
    const c = pickClearMessage("sig");
    expect(CLEAR_MESSAGES).toContain(c);
    expect(c).toMatch(/^✓/);
  });
});
