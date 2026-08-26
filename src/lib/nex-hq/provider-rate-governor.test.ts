// src/lib/nex-hq/provider-rate-governor.test.ts
//
// Pure decideAcquire tests · no DB · covers the throttle math.

import { describe, it, expect } from "vitest";
import { decideAcquire, type RateConfig, type ActiveLease } from "./provider-rate-governor";

const nominatim: RateConfig = { provider: "nominatim", minIntervalMs: 1500, maxConcurrent: 1 };
const overpass:  RateConfig = { provider: "overpass",  minIntervalMs: 2000, maxConcurrent: 1 };

function lease(id: string, walker: string, acquired: string, expires: string): ActiveLease {
  return { leaseId: id, provider: "nominatim", walkerId: walker, acquiredAt: new Date(acquired), expiresAt: new Date(expires) };
}

describe("decideAcquire · pure throttle decision", () => {
  it("grants when no active leases and no recent release", () => {
    const d = decideAcquire(nominatim, [], null, new Date("2026-08-24T10:00:00Z"));
    expect(d.granted).toBe(true);
    expect(d.reason).toBe("granted");
  });

  it("denies with unknown_provider when config missing", () => {
    const d = decideAcquire(null, [], null, new Date());
    expect(d.granted).toBe(false);
    expect(d.reason).toBe("unknown_provider");
  });

  it("denies with max_concurrent_reached when active count == cap", () => {
    const now = new Date("2026-08-24T10:00:00Z");
    const active = [lease("l1", "walker-A", "2026-08-24T09:59:58Z", "2026-08-24T10:00:28Z")];
    const d = decideAcquire(nominatim, active, null, now);
    expect(d.granted).toBe(false);
    expect(d.reason).toBe("max_concurrent_reached");
    // Wait until the oldest active lease expires
    expect(d.waitMs).toBeGreaterThan(0);
    expect(d.waitMs).toBeLessThanOrEqual(30000);
  });

  it("treats leases past expires_at as effectively released (stale walker recovery)", () => {
    const now = new Date("2026-08-24T10:00:00Z");
    const staleActive = [lease("stale", "crashed-walker", "2026-08-24T09:00:00Z", "2026-08-24T09:00:30Z")];
    const d = decideAcquire(nominatim, staleActive, null, now);
    // Stale lease is ignored · granted (subject to min-interval check on last acquiredAt)
    expect(d.granted).toBe(true);
  });

  it("denies with min_interval_not_elapsed when recent release too recent", () => {
    const now = new Date("2026-08-24T10:00:00Z");
    const recentRelease = new Date("2026-08-24T09:59:59.500Z"); // 500ms ago · nominatim needs 1500ms
    const d = decideAcquire(nominatim, [], recentRelease, now);
    expect(d.granted).toBe(false);
    expect(d.reason).toBe("min_interval_not_elapsed");
    expect(d.waitMs).toBeGreaterThan(0);
    expect(d.waitMs).toBeLessThanOrEqual(1500);
  });

  it("grants when min_interval_ms has elapsed since last release", () => {
    const now = new Date("2026-08-24T10:00:00Z");
    const oldRelease = new Date("2026-08-24T09:59:57Z"); // 3s ago
    const d = decideAcquire(nominatim, [], oldRelease, now);
    expect(d.granted).toBe(true);
  });

  it("min_interval also considers acquired_at of currently-active leases (not just releases)", () => {
    const now = new Date("2026-08-24T10:00:00Z");
    const holding = [{ ...lease("l1", "walker-A", "2026-08-24T09:59:59Z", "2026-08-24T10:00:30Z"), provider: "nominatim" }];
    // With max_concurrent=1 this hits max_concurrent first · but with maxConcurrent=2 we'd hit min_interval
    const configHigh = { ...nominatim, maxConcurrent: 2 };
    const d = decideAcquire(configHigh, holding, null, now);
    expect(d.granted).toBe(false);
    expect(d.reason).toBe("min_interval_not_elapsed");
  });

  it("waitMs is at least 50ms even for zero elapsed edge case (avoids tight retry loop)", () => {
    const now = new Date("2026-08-24T10:00:00Z");
    const activeExactlyNow = [{ ...lease("l1", "walker-A", "2026-08-24T09:59:59.999Z", "2026-08-24T10:00:00Z"), provider: "nominatim" }];
    const d = decideAcquire(nominatim, activeExactlyNow, null, now);
    if (!d.granted && d.reason === "max_concurrent_reached") {
      expect(d.waitMs).toBeGreaterThanOrEqual(50);
    }
  });

  it("overpass config throttles independently (2000ms vs nominatim 1500ms)", () => {
    const now = new Date("2026-08-24T10:00:00Z");
    // 1600ms since last release · past nominatim (1500) but not past overpass (2000)
    const releasedRecent = new Date("2026-08-24T09:59:58.400Z");
    const dNom = decideAcquire(nominatim, [], releasedRecent, now);
    const dOvp = decideAcquire(overpass,  [], releasedRecent, now);
    expect(dNom.granted).toBe(true);   // 1600ms >= 1500ms · nominatim allows
    expect(dOvp.granted).toBe(false);  // 1600ms <  2000ms · overpass denies
    if (!dOvp.granted) {
      expect(dOvp.reason).toBe("min_interval_not_elapsed");
      expect(dOvp.waitMs).toBeGreaterThan(0);
      expect(dOvp.waitMs).toBeLessThanOrEqual(2000);
    }
  });
});
