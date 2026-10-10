// Path router tests · deterministic longest-prefix match.

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { routePath, routePaths, normaliseRel } from "../path-router";
import { seedLanes, __resetLanesForTest } from "../lane-registry";

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
  seedLanes();
});

describe("path-router · single path", () => {
  it("routes an nex-coding-team file to nex-coding-primary", () => {
    const r = routePath("src/lib/nex-coding-team/runtime.ts");
    expect(r.resolved_lane).toBe("nex-coding-primary");
  });

  it("routes an nex-agent-runtime file to nex-runtime-guardian", () => {
    const r = routePath("src/lib/nex-agent-runtime/nex1/brain.ts");
    expect(r.resolved_lane).toBe("nex-runtime-guardian");
  });

  it("routes an nex-migration file to nex-migration", () => {
    const r = routePath("src/lib/nex-migration/schema-parser.ts");
    expect(r.resolved_lane).toBe("nex-migration");
  });

  it("routes an image-gen file to nex-visual", () => {
    const r = routePath("src/lib/nex/live-chat-completion/image-gen/index.ts");
    expect(r.resolved_lane).toBe("nex-visual");
  });

  it("routes a code-brain file to nex-code-brain-self", () => {
    const r = routePath("src/lib/nex-code-brain/leases.ts");
    expect(r.resolved_lane).toBe("nex-code-brain-self");
  });

  it("normalises Windows-style backslashes", () => {
    const r = routePath("src\\lib\\nex-coding-team\\runtime.ts");
    expect(r.resolved_lane).toBe("nex-coding-primary");
  });

  it("returns null for an unclaimed path", () => {
    const r = routePath("src/lib/something-nobody-owns/foo.ts");
    expect(r.resolved_lane).toBeNull();
  });

  it("does not route to nex-twin (pending_activation is skipped)", () => {
    // Even if we somehow gave nex-twin a prefix, its status would still exclude it.
    const r = routePath("nex-twin-imaginary-path/foo.ts");
    expect(r.resolved_lane).toBeNull();
  });
});

describe("path-router · batch routing", () => {
  it("returns distinct_lanes for a same-lane batch", () => {
    const r = routePaths([
      "src/lib/nex-coding-team/runtime.ts",
      "src/lib/nex-coding-team/permissions.ts",
      "src/lib/nex-coding-chat/memory.ts",
    ]);
    expect(r.distinct_lanes).toEqual(["nex-coding-primary"]);
    expect(r.unresolved).toEqual([]);
  });

  it("returns multiple distinct_lanes for a cross-lane batch", () => {
    const r = routePaths([
      "src/lib/nex-coding-team/runtime.ts", // → nex-coding-primary
      "src/lib/nex-agent-runtime/nex1/brain.ts", // → nex-runtime-guardian
      "src/lib/nex-migration/index.ts", // → nex-migration
    ]);
    expect(r.distinct_lanes.length).toBe(3);
    expect(r.distinct_lanes).toContain("nex-coding-primary");
    expect(r.distinct_lanes).toContain("nex-runtime-guardian");
    expect(r.distinct_lanes).toContain("nex-migration");
  });

  it("collects unresolved paths separately", () => {
    const r = routePaths(["src/lib/nex-coding-team/x.ts", "src/lib/orphan/y.ts"]);
    expect(r.distinct_lanes).toEqual(["nex-coding-primary"]);
    expect(r.unresolved).toEqual(["src/lib/orphan/y.ts"]);
  });
});

describe("path-router · normaliseRel", () => {
  it("collapses Windows separators", () => {
    expect(normaliseRel("src\\lib\\foo.ts")).toBe("src/lib/foo.ts");
  });
  it("returns already-relative paths unchanged", () => {
    expect(normaliseRel("src/lib/foo.ts")).toBe("src/lib/foo.ts");
  });
});
