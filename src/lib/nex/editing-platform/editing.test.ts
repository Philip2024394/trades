// Editing Platform · MVP parser tests + Operation bridge tests.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { parseCommand, toOperation } from "./index";

describe("Editing Platform · parseCommand", () => {
  it('parses "Move the staircase 300mm left"', () => {
    const r = parseCommand("Move the staircase 300mm left");
    expect(r.commands).toHaveLength(1);
    const c = r.commands[0];
    expect(c.intent).toBe("move");
    expect(c.target_id).toBe("staircase");
    expect(c.amount_mm).toBe(300);
    expect(c.direction).toBe("left");
    expect(c.confidence).toBeGreaterThan(0.7);
  });

  it('parses "Replace oak with walnut"', () => {
    const r = parseCommand("Replace oak with walnut");
    expect(r.commands).toHaveLength(1);
    const c = r.commands[0];
    expect(c.intent).toBe("replace_material");
    expect(c.from).toBe("oak");
    expect(c.to).toBe("walnut");
  });

  it('parses "Increase the logo by 15%"', () => {
    const r = parseCommand("Increase the logo by 15%");
    const c = r.commands[0];
    expect(c.intent).toBe("resize");
    expect(c.target_id).toBe("logo");
    expect(c.amount_pct).toBe(15);
  });

  it('parses "Make the handrail darker"', () => {
    const r = parseCommand("Make the handrail darker");
    const c = r.commands[0];
    expect(c.intent).toBe("recolor");
    expect(c.target_id).toBe("handrail");
    expect(c.hex_delta).toBe("-15%");
  });

  it('parses camera switch "Change the camera to Instagram"', () => {
    const r = parseCommand("Change the camera to Instagram");
    const c = r.commands[0];
    expect(c.intent).toBe("change_camera");
    expect(c.to).toBe("instagram");
  });

  it('parses lighting switch "Change lighting to golden hour"', () => {
    const r = parseCommand("Change lighting to golden hour");
    const c = r.commands[0];
    expect(c.intent).toBe("change_lighting");
    expect(c.to).toBe("golden hour");
  });

  it('parses theme switch "Use the luxury_burgundy theme"', () => {
    const r = parseCommand("Use the luxury_burgundy theme");
    const c = r.commands[0];
    expect(c.intent).toBe("change_theme");
    expect(c.to).toBe("luxury_burgundy");
  });

  it("splits multi-command utterance with 'and'", () => {
    const r = parseCommand("Move the staircase 200mm left and replace oak with walnut");
    expect(r.commands).toHaveLength(2);
    expect(r.commands[0].intent).toBe("move");
    expect(r.commands[1].intent).toBe("replace_material");
  });

  it("captures unrecognised fragments · does not throw", () => {
    const r = parseCommand("Do something magical with the vibe");
    expect(r.commands).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("retains the original raw_text on every command", () => {
    const r = parseCommand("Move the staircase 300mm left");
    expect(r.commands[0].raw_text).toBe("Move the staircase 300mm left");
  });
});

describe("Editing Platform · toOperation bridge", () => {
  it("converts a replace_material command into a Design History Operation", () => {
    const cmd = parseCommand("Replace oak with walnut").commands[0];
    const op = toOperation(cmd, {
      before: "oak",
      author: "philip",
      target_path_resolver: () => "/staircase/handrail/material",
    });
    expect(op.kind).toBe("replace_material");
    expect(op.target_path).toBe("/staircase/handrail/material");
    expect(op.before).toBe("oak");
    expect(op.after).toBe("walnut");
    expect(op.author).toBe("philip");
    expect(op.reason).toContain("Replace oak with walnut");
  });

  it("converts a move command into a move_layer Operation", () => {
    const cmd = parseCommand("Move the staircase 300mm left").commands[0];
    const op = toOperation(cmd, { before: { direction: null }, author: "philip", target_path_resolver: () => "/staircase/position" });
    expect(op.kind).toBe("move_layer");
    expect((op.after as { direction: string; amount_mm: number }).direction).toBe("left");
    expect((op.after as { direction: string; amount_mm: number }).amount_mm).toBe(300);
  });

  it("throws when no target path can be resolved", () => {
    const cmd = parseCommand("Move the staircase 300mm left").commands[0];
    expect(() => toOperation({ ...cmd, target_id: undefined }, { before: null, author: "philip" })).toThrow(/target_path/);
  });
});
