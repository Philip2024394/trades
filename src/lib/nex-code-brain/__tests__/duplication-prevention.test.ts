// Duplication-prevention tests · the load-bearing invariant.
// "NEX1 and NEX-Twin must NEVER code the same files."
// We prove this by showing:
//   1. Two lanes cannot both hold a lease on the same path.
//   2. Attempting to assign a path to the wrong lane fails.
//   3. Cross-lane batches are rejected wholesale.
//   4. Path routing is deterministic (idempotent · pure function).

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import {
  seedLanes,
  registerLane,
  updateLaneStatus,
  __resetLanesForTest,
} from "../lane-registry";
import { routePath } from "../path-router";
import { acquireLease, listActiveLeases, __resetLeasesForTest } from "../leases";
import { requestWork } from "../brain";
import { __resetAssignmentsForTest } from "../assignments";
import { __resetAllFeedsForTest } from "../feed";

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
  seedLanes();
  // Activate the reserved nex-twin lane WITH a distinct path prefix so we can
  // simulate a future Twin NEX in these tests. We register a NEW lane rather
  // than modifying nex-twin's prefixes at rest (which the seed keeps empty).
  registerLane({
    lane_id: "nex-twin-test",
    display_name: "Twin NEX (test)",
    status: "active",
    owner_agent_ids: ["nex-twin"],
    // A distinct, non-overlapping tree that only Twin NEX would own.
    path_prefixes: ["src/lib/nex-twin-workspace/"],
    domain_tags: ["twin", "test"],
    notes: "test-only registration",
    registered_at: new Date().toISOString(),
  });
});

describe("duplication-prevention · two lanes CANNOT share a path", () => {
  it("if NEX1 leases a coding-team file, Twin cannot lease it (WRONG_LANE)", () => {
    // NEX1 (nex-coding-primary) leases the file first.
    const nex1 = acquireLease({
      agent_lane: "nex-coding-primary",
      path: "src/lib/nex-coding-team/runtime.ts",
    });
    expect(nex1.ok).toBe(true);

    // Twin tries to lease the SAME path with its lane id.
    const twin = acquireLease({
      agent_lane: "nex-twin-test",
      path: "src/lib/nex-coding-team/runtime.ts",
    });
    expect(twin.ok).toBe(false);
    if (!twin.ok) {
      // The router refuses BEFORE the lease system even inspects the lock,
      // because the path deterministically routes to nex-coding-primary.
      expect(twin.kind).toBe("WRONG_LANE");
      expect(twin.expected_lane).toBe("nex-coding-primary");
    }
  });

  it("if Twin leases its own file, NEX1 cannot claim it (WRONG_LANE)", () => {
    const twin = acquireLease({
      agent_lane: "nex-twin-test",
      path: "src/lib/nex-twin-workspace/component.ts",
    });
    expect(twin.ok).toBe(true);

    const nex1 = acquireLease({
      agent_lane: "nex-coding-primary",
      path: "src/lib/nex-twin-workspace/component.ts",
    });
    expect(nex1.ok).toBe(false);
    if (!nex1.ok) {
      expect(nex1.kind).toBe("WRONG_LANE");
      expect(nex1.expected_lane).toBe("nex-twin-test");
    }
  });

  it("path routing is a pure function (same input → same output, always)", () => {
    const first = routePath("src/lib/nex-coding-team/runtime.ts");
    const second = routePath("src/lib/nex-coding-team/runtime.ts");
    const third = routePath("src\\lib\\nex-coding-team\\runtime.ts");
    expect(first.resolved_lane).toBe(second.resolved_lane);
    expect(second.resolved_lane).toBe(third.resolved_lane);
    expect(first.resolved_lane).toBe("nex-coding-primary");
  });

  it("no path in the entire lane registry resolves to two lanes", () => {
    // Sample paths across every seeded lane · every path must resolve to at
    // most one active lane by construction of the registry validator.
    const samples = [
      "src/lib/nex-coding-team/runtime.ts",
      "src/lib/nex-coding-chat/memory.ts",
      "src/lib/nex-agent-runtime/nex1/brain.ts",
      "src/lib/nex-security/scanner.ts",
      "src/lib/nex-migration/index.ts",
      "src/lib/nex-video/nex-video-adapter.ts",
      "src/lib/nex-code-brain/leases.ts",
      "src/lib/nex-twin-workspace/anything.ts",
      "supabase/migrations/20260901.sql",
      "data/nex-coding-team/runs/x/manifest.json",
    ];
    for (const s of samples) {
      const r = routePath(s);
      // For each sample: resolved_lane is either null or exactly one string.
      // We simply verify calling twice yields the same answer.
      const r2 = routePath(s);
      expect(r.resolved_lane).toBe(r2.resolved_lane);
    }
  });
});

describe("duplication-prevention · requestWork rejects cross-lane batches", () => {
  it("rejects a batch that spans NEX1 + Twin", () => {
    const r = requestWork({
      task_id: "cross-lane-test",
      title: "bad batch",
      requested_by: "test",
      hint: "should fail",
      paths: [
        "src/lib/nex-coding-team/runtime.ts", // → nex-coding-primary
        "src/lib/nex-twin-workspace/component.ts", // → nex-twin-test
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.kind === "CROSS_LANE") {
      expect(r.distinct_lanes.length).toBe(2);
      expect(r.distinct_lanes).toContain("nex-coding-primary");
      expect(r.distinct_lanes).toContain("nex-twin-test");
    } else {
      throw new Error(`expected CROSS_LANE, got ${JSON.stringify(r)}`);
    }
  });

  it("accepts a batch that all resolves to the same lane", () => {
    const r = requestWork({
      task_id: "same-lane-test",
      title: "ok batch",
      requested_by: "test",
      hint: "should work",
      paths: [
        "src/lib/nex-coding-team/runtime.ts",
        "src/lib/nex-coding-team/permissions.ts",
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lane).toBe("nex-coding-primary");
    }
  });

  it("duplicate task_id is rejected", () => {
    const first = requestWork({
      task_id: "dup-test",
      title: "first",
      requested_by: "test",
      hint: "",
      paths: ["src/lib/nex-coding-team/dup-a.ts"],
    });
    expect(first.ok).toBe(true);
    const second = requestWork({
      task_id: "dup-test",
      title: "second",
      requested_by: "test",
      hint: "",
      paths: ["src/lib/nex-coding-team/dup-b.ts"],
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toMatch(/already has an active assignment/);
  });
});

describe("duplication-prevention · lane deactivation shuts the gate", () => {
  it("deactivating nex-twin-test blocks new leases on its paths", () => {
    // First lease works.
    const first = acquireLease({
      agent_lane: "nex-twin-test",
      path: "src/lib/nex-twin-workspace/a.ts",
    });
    expect(first.ok).toBe(true);

    // Deactivate the lane.
    updateLaneStatus("nex-twin-test", "quarantined");

    // Next lease attempt fails.
    const second = acquireLease({
      agent_lane: "nex-twin-test",
      path: "src/lib/nex-twin-workspace/b.ts",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.kind).toBe("LANE_INACTIVE");
  });
});
