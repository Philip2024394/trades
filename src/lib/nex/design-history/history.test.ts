// Design History Engine · full-coverage tests.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { createHistory, apply, undo, redo, branch, compare, versionSnapshot, auditLog } from "./index";

type DemoDoc = {
  staircase: { handrail: { material: string; finish: string }; treads: { count: number } };
  kitchen: { island_mm: number };
};

function initial(): DemoDoc {
  return { staircase: { handrail: { material: "oak", finish: "satin_lacquer" }, treads: { count: 14 } }, kitchen: { island_mm: 2400 } };
}

describe("Design History Engine", () => {
  it("createHistory captures the initial snapshot at version 0", () => {
    const h = createHistory("doc_001", initial(), "philip");
    expect(h.branches.main.head_version).toBe(0);
    expect(h.entries).toHaveLength(0);
    expect(h.head_snapshots.main.document).toEqual(initial());
  });

  it("apply advances version + records op + updates head snapshot", () => {
    let h = createHistory<DemoDoc>("doc_001", initial(), "philip");
    const result = apply(h, "main", { kind: "set_property", target_path: "/staircase/handrail/finish", before: "satin_lacquer", after: "dark_walnut", author: "philip", reason: "user asked to darken handrail" });
    h = result.history;
    expect(h.branches.main.head_version).toBe(1);
    expect(h.entries).toHaveLength(1);
    expect(result.snapshot.document.staircase.handrail.finish).toBe("dark_walnut");
  });

  it("does NOT mutate the input document (pure operations)", () => {
    const doc = initial();
    const h = createHistory<DemoDoc>("doc_001", doc, "philip");
    apply(h, "main", { kind: "set_property", target_path: "/staircase/handrail/finish", before: "satin_lacquer", after: "dark_walnut", author: "philip" });
    expect(doc.staircase.handrail.finish).toBe("satin_lacquer");
  });

  it("undo restores the pre-op value and moves head back", () => {
    let h = createHistory<DemoDoc>("doc_001", initial(), "philip");
    h = apply(h, "main", { kind: "set_property", target_path: "/staircase/handrail/finish", before: "satin_lacquer", after: "dark_walnut", author: "philip" }).history;
    const r = undo(h, "main");
    expect(r.snapshot.document.staircase.handrail.finish).toBe("satin_lacquer");
    expect(r.history.branches.main.head_version).toBe(0);
  });

  it("redo re-applies the most recently undone op", () => {
    let h = createHistory<DemoDoc>("doc_001", initial(), "philip");
    h = apply(h, "main", { kind: "set_property", target_path: "/staircase/handrail/finish", before: "satin_lacquer", after: "dark_walnut", author: "philip" }).history;
    h = undo(h, "main").history;
    const r = redo(h, "main");
    expect(r.snapshot.document.staircase.handrail.finish).toBe("dark_walnut");
    expect(r.history.branches.main.head_version).toBe(1);
  });

  it("applying a new op after undo clears the redo stack", () => {
    let h = createHistory<DemoDoc>("doc_001", initial(), "philip");
    h = apply(h, "main", { kind: "set_property", target_path: "/staircase/handrail/finish", before: "satin_lacquer", after: "dark_walnut", author: "philip" }).history;
    h = undo(h, "main").history;
    h = apply(h, "main", { kind: "set_property", target_path: "/kitchen/island_mm", before: 2400, after: 3200, author: "philip" }).history;
    expect(() => redo(h, "main")).toThrow(/Nothing to redo/);
  });

  it("branch forks a divergent line at the head version", () => {
    let h = createHistory<DemoDoc>("doc_001", initial(), "philip");
    h = apply(h, "main", { kind: "set_property", target_path: "/kitchen/island_mm", before: 2400, after: 3000, author: "philip" }).history;
    h = branch(h, "main", "walnut_variant", "walnut variant", "philip");
    expect(h.branches.walnut_variant.base_version).toBe(1);
    expect(h.head_snapshots.walnut_variant.document.kitchen.island_mm).toBe(3000);
  });

  it("branches evolve independently after fork", () => {
    let h = createHistory<DemoDoc>("doc_001", initial(), "philip");
    h = branch(h, "main", "walnut_variant", "walnut variant", "philip");
    h = apply(h, "walnut_variant", { kind: "set_property", target_path: "/staircase/handrail/material", before: "oak", after: "walnut", author: "philip" }).history;
    expect(h.head_snapshots.main.document.staircase.handrail.material).toBe("oak");
    expect(h.head_snapshots.walnut_variant.document.staircase.handrail.material).toBe("walnut");
  });

  it("compare surfaces changed leaves", () => {
    let h = createHistory<DemoDoc>("doc_001", initial(), "philip");
    h = branch(h, "main", "walnut_variant", "walnut variant", "philip");
    h = apply(h, "walnut_variant", { kind: "set_property", target_path: "/staircase/handrail/material", before: "oak", after: "walnut", author: "philip" }).history;
    const diff = compare(h, { branch_id: "main" }, { branch_id: "walnut_variant" });
    expect(diff.lines.some((l) => l.path === "/staircase/handrail/material" && l.kind === "changed" && l.before === "oak" && l.after === "walnut")).toBe(true);
  });

  it("versionSnapshot reconstructs a prior version via inverse walk", () => {
    let h = createHistory<DemoDoc>("doc_001", initial(), "philip");
    h = apply(h, "main", { kind: "set_property", target_path: "/kitchen/island_mm", before: 2400, after: 3000, author: "philip" }).history;
    h = apply(h, "main", { kind: "set_property", target_path: "/kitchen/island_mm", before: 3000, after: 3200, author: "philip" }).history;
    const snap0 = versionSnapshot(h, "main", 0);
    const snap1 = versionSnapshot(h, "main", 1);
    expect(snap0.document.kitchen.island_mm).toBe(2400);
    expect(snap1.document.kitchen.island_mm).toBe(3000);
  });

  it("auditLog returns ordered operations for a branch (why the design evolved)", () => {
    let h = createHistory<DemoDoc>("doc_001", initial(), "philip");
    h = apply(h, "main", { kind: "set_property", target_path: "/kitchen/island_mm", before: 2400, after: 3000, author: "philip", reason: "customer wanted bigger island" }).history;
    h = apply(h, "main", { kind: "set_property", target_path: "/staircase/handrail/finish", before: "satin_lacquer", after: "dark_walnut", author: "philip", reason: "matches walnut kitchen" }).history;
    const log = auditLog(h, "main");
    expect(log).toHaveLength(2);
    expect(log[0].operation.reason).toContain("bigger island");
    expect(log[1].operation.reason).toContain("walnut kitchen");
  });
});
