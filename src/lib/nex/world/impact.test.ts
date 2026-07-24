// Impact analysis — traversal + effect generation.

import { describe, it, expect, vi } from "vitest";

vi.mock("./entities", () => ({
  loadEntityCloud: vi.fn(async () => ({
    root: { kind: "project", id: "p1", label: "Smith kitchen" },
    entities: [
      { kind: "project", id: "p1", label: "Smith kitchen" },
      { kind: "cost",    id: "c1", label: "Kitchen units" },
      { kind: "job",     id: "j1", label: "Kitchen fit"    },
      { kind: "photo",   id: "ph1", label: "Photo"         }
    ],
    relationships: [
      { from: { kind: "project", id: "p1", label: "Smith kitchen" }, to: { kind: "cost",  id: "c1", label: "Kitchen units" }, kind: "belongs_to",  evidence: { source: "t", tables: [], computed_at: "x" } },
      { from: { kind: "project", id: "p1", label: "Smith kitchen" }, to: { kind: "job",   id: "j1", label: "Kitchen fit"    }, kind: "sits_on",     evidence: { source: "t", tables: [], computed_at: "x" } },
      { from: { kind: "project", id: "p1", label: "Smith kitchen" }, to: { kind: "photo", id: "ph1", label: "Photo"         }, kind: "captured_on", evidence: { source: "t", tables: [], computed_at: "x" } }
    ],
    evidence: { source: "t", tables: [], computed_at: "x" }
  }))
}));

import { buildImpactAnalysis } from "./impact";

describe("buildImpactAnalysis", () => {
  const target = { kind: "project" as const, id: "p1", label: "Smith kitchen" };

  it("delay → notice on cost + warning on job + info on photo", async () => {
    const a = await buildImpactAnalysis({ change: { kind: "delay", target, detail: "5 days" } });
    const severities = a.effects.map((e) => e.severity);
    expect(severities).toContain("notice");
    expect(severities).toContain("warning");
    expect(severities).toContain("info");
  });

  it("cancel → warnings on cost + job", async () => {
    const a = await buildImpactAnalysis({ change: { kind: "cancel", target, detail: "" } });
    const kinds = a.effects.map((e) => e.affected.kind);
    expect(kinds).toContain("cost");
    expect(kinds).toContain("job");
  });

  it("reprice → notice on cost", async () => {
    const a = await buildImpactAnalysis({ change: { kind: "reprice", target, detail: "" } });
    expect(a.effects.some((e) => e.affected.kind === "cost" && e.severity === "notice")).toBe(true);
  });

  it("reassign → notice on job", async () => {
    const a = await buildImpactAnalysis({ change: { kind: "reassign", target, detail: "" } });
    expect(a.effects.some((e) => e.affected.kind === "job" && e.severity === "notice")).toBe(true);
  });
});
