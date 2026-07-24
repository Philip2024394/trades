// Multi-agent facade — handle detection.

import { describe, it, expect } from "vitest";
import { detectAgent } from "./agents";

describe("detectAgent", () => {
  it("marketing nex, ...", () => {
    const r = detectAgent("marketing nex, how are my posts?");
    expect(r?.agent).toBe("marketing");
    expect(r?.rest).toBe("how are my posts?");
  });

  it("finance nex: ...", () => {
    const r = detectAgent("finance nex: what's my profit?");
    expect(r?.agent).toBe("finance");
    expect(r?.rest).toBe("what's my profit?");
  });

  it("@procurement handle", () => {
    const r = detectAgent("@procurement compare suppliers");
    expect(r?.agent).toBe("procurement");
    expect(r?.rest).toBe("compare suppliers");
  });

  it("null when nothing matches", () => {
    expect(detectAgent("hello")).toBeNull();
    expect(detectAgent("how are you?")).toBeNull();
  });
});
