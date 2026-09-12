// src/lib/nex-agent/playbook.test.ts

import { describe, it, expect } from "vitest";
import { validatePlaybook, validateAction, type Playbook } from "./playbook";

describe("validateAction", () => {
  it("accepts set-viewport with valid value", () => {
    expect(validateAction({ kind: "set-viewport", value: "mobile" }).ok).toBe(true);
  });
  it("rejects set-viewport with invalid value", () => {
    expect(validateAction({ kind: "set-viewport", value: "foo" as never }).ok).toBe(false);
  });
  it("accepts set-zoom in range", () => {
    expect(validateAction({ kind: "set-zoom", value: 1 }).ok).toBe(true);
    expect(validateAction({ kind: "set-zoom", value: 0.25 }).ok).toBe(true);
    expect(validateAction({ kind: "set-zoom", value: 3 }).ok).toBe(true);
  });
  it("rejects set-zoom out of range", () => {
    expect(validateAction({ kind: "set-zoom", value: 0.1 }).ok).toBe(false);
    expect(validateAction({ kind: "set-zoom", value: 5 }).ok).toBe(false);
  });
  it("accepts valid preview URL", () => {
    expect(validateAction({ kind: "set-preview-url", value: "/nexapp" }).ok).toBe(true);
  });
  it("rejects preview URL without leading slash", () => {
    expect(validateAction({ kind: "set-preview-url", value: "nexapp" }).ok).toBe(false);
  });
  it("accepts valid bezel hex", () => {
    expect(validateAction({ kind: "set-custom-bezel-hex", value: "#0B1220" }).ok).toBe(true);
  });
  it("rejects invalid bezel hex", () => {
    expect(validateAction({ kind: "set-custom-bezel-hex", value: "not-hex" }).ok).toBe(false);
  });
  it("accepts prompt-submit with content", () => {
    expect(validateAction({ kind: "prompt-submit", prompt: "hi" }).ok).toBe(true);
  });
  it("rejects prompt-submit empty", () => {
    expect(validateAction({ kind: "prompt-submit", prompt: "" }).ok).toBe(false);
  });
  it("rejects prompt-submit too long", () => {
    expect(validateAction({ kind: "prompt-submit", prompt: "x".repeat(9000) }).ok).toBe(false);
  });
  it("accepts delay 0..60000", () => {
    expect(validateAction({ kind: "delay-ms", value: 0 }).ok).toBe(true);
    expect(validateAction({ kind: "delay-ms", value: 60000 }).ok).toBe(true);
  });
  it("rejects delay > 60000", () => {
    expect(validateAction({ kind: "delay-ms", value: 100000 }).ok).toBe(false);
  });
});

describe("validatePlaybook", () => {
  const base: Playbook = {
    id: "pb-1",
    name: "Test Playbook",
    description: "…",
    createdAt: new Date().toISOString(),
    createdBy: "founder",
    actions: [{ kind: "set-viewport", value: "mobile" }],
  };

  it("accepts a well-formed playbook", () => {
    expect(validatePlaybook(base).ok).toBe(true);
  });
  it("rejects missing id", () => {
    expect(validatePlaybook({ ...base, id: "" }).ok).toBe(false);
  });
  it("rejects invalid name", () => {
    expect(validatePlaybook({ ...base, name: "!!bad!!" }).ok).toBe(false);
    expect(validatePlaybook({ ...base, name: "" }).ok).toBe(false);
  });
  it("rejects empty actions", () => {
    expect(validatePlaybook({ ...base, actions: [] }).ok).toBe(false);
  });
  it("rejects too many actions", () => {
    const many = Array.from({ length: 101 }, () => ({ kind: "reload-preview" as const }));
    expect(validatePlaybook({ ...base, actions: many }).ok).toBe(false);
  });
  it("rejects if any action invalid", () => {
    const r = validatePlaybook({
      ...base,
      actions: [{ kind: "set-viewport", value: "foo" as never }],
    });
    expect(r.ok).toBe(false);
  });
});
