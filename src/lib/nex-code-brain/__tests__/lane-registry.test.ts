// Lane registry tests · seed lanes valid, no overlaps, registration guards.

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import {
  loadLanes,
  seedLanes,
  registerLane,
  validateLanesNonOverlapping,
  findLane,
  __resetLanesForTest,
} from "../lane-registry";
import type { AgentLane } from "../types";

// Isolate this test file's brain root so parallel test files can't race.
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
});

describe("lane-registry · seed", () => {
  it("seeds and loads without error", () => {
    seedLanes();
    const lanes = loadLanes();
    expect(lanes.length).toBeGreaterThanOrEqual(7);
  });

  it("seed lanes contain no overlapping path prefixes", () => {
    seedLanes();
    const problem = validateLanesNonOverlapping(loadLanes());
    expect(problem).toBeNull();
  });

  it("registers nex-twin as pending_activation with empty prefixes", () => {
    seedLanes();
    const twin = findLane("nex-twin");
    expect(twin).not.toBeNull();
    expect(twin?.status).toBe("pending_activation");
    expect(twin?.path_prefixes.length).toBe(0);
  });

  it("registers nex-coding-primary as active", () => {
    seedLanes();
    const l = findLane("nex-coding-primary");
    expect(l?.status).toBe("active");
    expect(l?.path_prefixes).toContain("src/lib/nex-coding-team/");
  });
});

describe("lane-registry · registerLane", () => {
  it("rejects a duplicate lane_id", () => {
    seedLanes();
    const dup: AgentLane = {
      lane_id: "nex-coding-primary",
      display_name: "dup",
      status: "active",
      owner_agent_ids: ["x"],
      path_prefixes: ["src/lib/some-new-dir/"],
      domain_tags: [],
      notes: "",
      registered_at: new Date().toISOString(),
    };
    const r = registerLane(dup);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/already registered/);
  });

  it("rejects an overlapping prefix", () => {
    seedLanes();
    const overlap: AgentLane = {
      lane_id: "nex-conflict-test",
      display_name: "conflict",
      status: "active",
      owner_agent_ids: ["x"],
      // This overlaps with nex-coding-primary's src/lib/nex-coding-team/
      path_prefixes: ["src/lib/nex-coding-team/agents/"],
      domain_tags: [],
      notes: "",
      registered_at: new Date().toISOString(),
    };
    const r = registerLane(overlap);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/overlap/);
  });

  it("rejects a bad lane_id format", () => {
    seedLanes();
    const bad: AgentLane = {
      lane_id: "InvalidCaps",
      display_name: "bad",
      status: "active",
      owner_agent_ids: [],
      path_prefixes: [],
      domain_tags: [],
      notes: "",
      registered_at: new Date().toISOString(),
    };
    const r = registerLane(bad);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/lowercase/);
  });

  it("accepts a valid non-overlapping registration", () => {
    seedLanes();
    const fresh: AgentLane = {
      lane_id: "nex-experimental",
      display_name: "experimental",
      status: "active",
      owner_agent_ids: ["exp"],
      path_prefixes: ["src/lib/nex-experimental-xyz/"],
      domain_tags: [],
      notes: "",
      registered_at: new Date().toISOString(),
    };
    const r = registerLane(fresh);
    expect(r.ok).toBe(true);
    expect(findLane("nex-experimental")).not.toBeNull();
  });
});
