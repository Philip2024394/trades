// Graph traversal — BFS depth + node cap tests.
// Uses the injectable neighboursFn so we don't need Supabase.

import { describe, it, expect } from "vitest";
import { traverse } from "./graph";

// Small in-memory graph:
//   A → B, A → C, B → D, D → E, C → E
const EDGES: Record<string, Array<{ to_entry: string }>> = {
  A: [{ to_entry: "B" }, { to_entry: "C" }],
  B: [{ to_entry: "D" }],
  D: [{ to_entry: "E" }],
  C: [{ to_entry: "E" }],
  E: []
};

const fakeNeighbours = async (id: string) => EDGES[id] ?? [];

describe("Knowledge graph traversal", () => {
  it("visits BFS-order neighbours from A", async () => {
    const nodes = await traverse({ seedEntryId: "A", maxHops: 3, neighboursFn: fakeNeighbours });
    const ids = nodes.map((n) => n.entryId);
    expect(ids).toEqual(expect.arrayContaining(["A", "B", "C", "D", "E"]));
    expect(nodes.find((n) => n.entryId === "A")?.depth).toBe(0);
    expect(nodes.find((n) => n.entryId === "B")?.depth).toBe(1);
    expect(nodes.find((n) => n.entryId === "D")?.depth).toBe(2);
  });

  it("respects maxHops (only 1 hop from A)", async () => {
    const nodes = await traverse({ seedEntryId: "A", maxHops: 1, neighboursFn: fakeNeighbours });
    const ids = nodes.map((n) => n.entryId);
    expect(ids).toEqual(expect.arrayContaining(["A", "B", "C"]));
    expect(ids).not.toContain("D");
    expect(ids).not.toContain("E");
  });

  it("respects maxNodes cap", async () => {
    const nodes = await traverse({ seedEntryId: "A", maxHops: 5, maxNodes: 2, neighboursFn: fakeNeighbours });
    expect(nodes.length).toBeLessThanOrEqual(2);
    expect(nodes[0].entryId).toBe("A");
  });

  it("returns just the seed when no edges out", async () => {
    const nodes = await traverse({ seedEntryId: "E", maxHops: 3, neighboursFn: fakeNeighbours });
    expect(nodes).toEqual([{ entryId: "E", depth: 0 }]);
  });

  it("dedupes shared neighbours (E is reached via B→D and C)", async () => {
    const nodes = await traverse({ seedEntryId: "A", maxHops: 3, neighboursFn: fakeNeighbours });
    const eNodes = nodes.filter((n) => n.entryId === "E");
    expect(eNodes.length).toBe(1);
  });
});
