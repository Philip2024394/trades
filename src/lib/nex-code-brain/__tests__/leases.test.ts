// Lease tests · exclusive acquisition, TTL, wrong-lane rejection, protected paths.

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import {
  acquireLease,
  releaseLease,
  listActiveLeases,
  sweepExpiredLeases,
  forceReleaseByLane,
  __resetLeasesForTest,
} from "../leases";
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
  __resetLeasesForTest();
  seedLanes();
});

describe("leases · basic grant + release", () => {
  it("grants a lease when path routes to the requesting lane", () => {
    const r = acquireLease({
      agent_lane: "nex-coding-primary",
      path: "src/lib/nex-coding-team/runtime.ts",
      task_id: "T1",
      ttl_seconds: 60,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lease.path).toBe("src/lib/nex-coding-team/runtime.ts");
      expect(r.lease.agent_lane).toBe("nex-coding-primary");
    }
  });

  it("release frees the path for reacquisition", () => {
    const r1 = acquireLease({ agent_lane: "nex-coding-primary", path: "src/lib/nex-coding-team/x.ts" });
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      const rel = releaseLease(r1.lease.lease_id);
      expect(rel.ok).toBe(true);
    }
    const r2 = acquireLease({ agent_lane: "nex-coding-primary", path: "src/lib/nex-coding-team/x.ts" });
    expect(r2.ok).toBe(true);
  });

  it("listActiveLeases returns everything currently held", () => {
    acquireLease({ agent_lane: "nex-coding-primary", path: "src/lib/nex-coding-team/a.ts" });
    acquireLease({ agent_lane: "nex-coding-primary", path: "src/lib/nex-coding-team/b.ts" });
    const active = listActiveLeases();
    expect(active.length).toBeGreaterThanOrEqual(2);
  });
});

describe("leases · rejection cases", () => {
  it("rejects when path routes to a different lane", () => {
    const r = acquireLease({
      agent_lane: "nex-coding-primary",
      path: "src/lib/nex-migration/schema-parser.ts",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe("WRONG_LANE");
      expect(r.expected_lane).toBe("nex-migration");
    }
  });

  it("rejects when path is universally denied (.env)", () => {
    const r = acquireLease({ agent_lane: "nex-coding-primary", path: ".env" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("UNSAFE_PATH");
  });

  it("rejects when path is universally denied (src/lib/nex-v3/anything)", () => {
    const r = acquireLease({ agent_lane: "nex-coding-primary", path: "src/lib/nex-v3/whatever.ts" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("UNSAFE_PATH");
  });

  it("rejects when lane is unknown", () => {
    const r = acquireLease({ agent_lane: "no-such-lane", path: "src/lib/nex-coding-team/runtime.ts" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("UNKNOWN_LANE");
  });

  it("rejects when lane is pending_activation (nex-twin)", () => {
    const r = acquireLease({
      agent_lane: "nex-twin",
      path: "src/lib/nex-coding-team/runtime.ts",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("LANE_INACTIVE");
  });

  it("rejects absolute paths that escape the repo", () => {
    const r = acquireLease({ agent_lane: "nex-coding-primary", path: "../../../etc/passwd" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("UNSAFE_PATH");
  });
});

describe("leases · expiry + reclaim", () => {
  it("expired lease can be reclaimed by the same lane", async () => {
    const short = acquireLease({
      agent_lane: "nex-coding-primary",
      path: "src/lib/nex-coding-team/expire-test.ts",
      ttl_seconds: 1,
    });
    expect(short.ok).toBe(true);
    // Wait for expiry
    await new Promise((r) => setTimeout(r, 1100));
    const reclaim = acquireLease({
      agent_lane: "nex-coding-primary",
      path: "src/lib/nex-coding-team/expire-test.ts",
      ttl_seconds: 60,
    });
    expect(reclaim.ok).toBe(true);
    if (reclaim.ok) {
      expect(reclaim.reclaimed_from).toBeDefined();
    }
  });

  it("sweepExpiredLeases removes stale locks", async () => {
    acquireLease({
      agent_lane: "nex-coding-primary",
      path: "src/lib/nex-coding-team/sweep-test.ts",
      ttl_seconds: 1,
    });
    await new Promise((r) => setTimeout(r, 1100));
    const s = sweepExpiredLeases();
    expect(s.removed).toBeGreaterThanOrEqual(1);
  });
});

describe("leases · forceReleaseByLane", () => {
  it("releases every lease owned by a given lane", () => {
    acquireLease({ agent_lane: "nex-coding-primary", path: "src/lib/nex-coding-team/f1.ts" });
    acquireLease({ agent_lane: "nex-coding-primary", path: "src/lib/nex-coding-team/f2.ts" });
    const r = forceReleaseByLane("nex-coding-primary");
    expect(r.released).toBeGreaterThanOrEqual(2);
  });
});
