// Brain integration test · full lifecycle: requestWork → completeWork.
// Also verifies the assignment ledger + feed lines are consistent.

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { requestWork, completeWork } from "../brain";
import { currentAssignments, findActiveAssignment, __resetAssignmentsForTest } from "../assignments";
import { readFeed, __resetAllFeedsForTest } from "../feed";
import { listActiveLeases, __resetLeasesForTest } from "../leases";
import { seedLanes, __resetLanesForTest } from "../lane-registry";
import { addKnowledgeEntry, searchKnowledge } from "..";
import { __resetKnowledgeForTest } from "../knowledge-store";

const TEST_ROOT = path.join(process.cwd(), "data", `.nex-code-brain-test-${randomBytes(4).toString("hex")}`);
beforeAll(() => {
  process.env.NEX_CODE_BRAIN_ROOT = TEST_ROOT;
});
afterAll(() => {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
  delete process.env.NEX_CODE_BRAIN_ROOT;
});

beforeEach(() => {
  __resetLanesForTest();
  __resetLeasesForTest();
  __resetAssignmentsForTest();
  __resetAllFeedsForTest();
  __resetKnowledgeForTest();
  seedLanes();
});

describe("brain · requestWork → completeWork full lifecycle", () => {
  it("acceptance produces a lease + assignment + feed entry", () => {
    const r = requestWork({
      task_id: "lifecycle-1",
      title: "add helper util",
      requested_by: "founder",
      hint: "for coding-team pipeline",
      paths: ["src/lib/nex-coding-team/helper.ts"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");

    // Assignment appears in the ledger.
    const active = findActiveAssignment("lifecycle-1");
    expect(active?.status).toBe("leased");
    expect(active?.lane).toBe("nex-coding-primary");

    // Feed shows the task on the correct lane.
    const feed = readFeed("nex-coding-primary");
    expect(feed.some((f) => f.task_id === "lifecycle-1")).toBe(true);

    // A lease is held.
    const leases = listActiveLeases();
    expect(leases.some((l) => l.task_id === "lifecycle-1")).toBe(true);

    // Complete releases everything.
    const done = completeWork(r.assignment.assignment_id, "completed");
    expect(done.ok).toBe(true);

    const after = currentAssignments().find((a) => a.assignment_id === r.assignment.assignment_id);
    expect(after?.status).toBe("completed");
    expect(after?.closed_at).not.toBeNull();

    const leasesAfter = listActiveLeases();
    expect(leasesAfter.some((l) => l.task_id === "lifecycle-1")).toBe(false);
  });

  it("completing an already-completed assignment is refused", () => {
    const r = requestWork({
      task_id: "lifecycle-2",
      title: "x",
      requested_by: "founder",
      hint: "",
      paths: ["src/lib/nex-coding-team/x.ts"],
    });
    if (!r.ok) throw new Error("expected ok");
    completeWork(r.assignment.assignment_id, "completed");
    const second = completeWork(r.assignment.assignment_id, "completed");
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/already/);
  });

  it("abandoning also releases the lease", () => {
    const r = requestWork({
      task_id: "lifecycle-3",
      title: "y",
      requested_by: "founder",
      hint: "",
      paths: ["src/lib/nex-coding-team/y.ts"],
    });
    if (!r.ok) throw new Error("expected ok");
    completeWork(r.assignment.assignment_id, "abandoned");
    const leases = listActiveLeases();
    expect(leases.some((l) => l.task_id === "lifecycle-3")).toBe(false);
  });
});

describe("brain · knowledge store", () => {
  it("stores a contribution from a registered lane", () => {
    const r = addKnowledgeEntry({
      kind: "pattern",
      title: "Deterministic path routing prevents overlap",
      body: "Given a repo-relative path, the longest-prefix match yields exactly one active lane.",
      contributed_by_lane: "nex-code-brain-self",
      contributed_by_agent: "brain",
      applicable_paths: ["src/lib/nex-code-brain/"],
      tags: ["concurrency", "routing"],
      evidence: ["src/lib/nex-code-brain/path-router.ts:19"],
    });
    expect(r.ok).toBe(true);

    const found = searchKnowledge({ tag: "routing" });
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found[0]?.title).toContain("Deterministic path");
  });

  it("rejects a contribution from an unregistered lane", () => {
    const r = addKnowledgeEntry({
      kind: "pattern",
      title: "x",
      body: "y",
      contributed_by_lane: "no-such-lane",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/unknown/);
  });

  it("searches by lane and by path-prefix filter", () => {
    addKnowledgeEntry({
      kind: "convention",
      title: "safeWrite is the only write path",
      body: "All agent-driven writes must go through safe-write.ts.",
      contributed_by_lane: "nex-coding-primary",
      applicable_paths: ["src/lib/nex-coding-team/"],
      tags: ["safewrite"],
    });
    addKnowledgeEntry({
      kind: "gotcha",
      title: "Migration engine is additive only",
      body: "DROP/ALTER-DROP is refused.",
      contributed_by_lane: "nex-migration",
      applicable_paths: ["src/lib/nex-migration/"],
      tags: ["ddl"],
    });
    const byLane = searchKnowledge({ lane: "nex-migration" });
    expect(byLane.length).toBe(1);
    const byPath = searchKnowledge({ path_prefix: "src/lib/nex-coding-team/" });
    expect(byPath.length).toBe(1);
  });
});
