// runtime.test.ts · live-source runtime + health tracking.

import { describe, it, expect } from "vitest";
import { LiveSourceHealthRegistry, RecentObservationStore, eligibleConnectors, liveTick } from "./runtime";
import { createBmkgEarthquakeConnector } from "./bmkg";
import { createMagmaVolcanoConnector } from "./magma";

function mockClock(startMs: number) {
  let t = startMs;
  return { now: () => new Date(t), advance: (ms: number) => { t += ms; } };
}

const BMKG_FIXTURE = {
  Infogempa: { gempa: { Tanggal: "30 Aug 2026", Jam: "12:34:56 WIB", DateTime: "2026-08-30T05:34:56+00:00", Magnitude: "5.6", Kedalaman: "10 km", Wilayah: "35 km BD Denpasar", Coordinates: "-8.85,115.05" } },
};

describe("LiveSourceHealthRegistry · counters", () => {
  it("records successful poll and updates EMA latency", () => {
    const h = new LiveSourceHealthRegistry();
    h.recordPoll("s1", true, 100, "2026-08-30T00:00:00Z", 3);
    h.recordPoll("s1", true, 200, "2026-08-30T00:01:00Z", 5);
    const state = h.get("s1")!;
    expect(state.pollsTotal).toBe(2);
    expect(state.successesTotal).toBe(2);
    expect(state.avgLatencyMs).toBeGreaterThan(100);
    expect(state.cumulativeEntities).toBe(8);
    expect(state.consecutiveFailures).toBe(0);
  });

  it("failure resets nothing but bumps consecutiveFailures", () => {
    const h = new LiveSourceHealthRegistry();
    h.recordPoll("s1", true, 100, "2026-08-30T00:00:00Z", 3);
    h.recordPoll("s1", false, 50, "2026-08-30T00:01:00Z", 0, "timeout:abort");
    h.recordPoll("s1", false, 60, "2026-08-30T00:02:00Z", 0, "http_status:503");
    const state = h.get("s1")!;
    expect(state.consecutiveFailures).toBe(2);
    expect(state.failuresTotal).toBe(2);
    expect(state.lastError).toBe("http_status:503");
    expect(state.cumulativeEntities).toBe(3); // preserved from earlier success
  });
});

describe("RecentObservationStore · idempotency window", () => {
  it("marks and detects seen within TTL", () => {
    const clock = mockClock(1_000_000);
    const s = new RecentObservationStore(10 * 60_000);
    expect(s.seen("bmkg", "quake-1", clock.now())).toBe(false);
    s.mark("bmkg", "quake-1", clock.now());
    expect(s.seen("bmkg", "quake-1", clock.now())).toBe(true);
  });

  it("forgets entries past TTL", () => {
    const clock = mockClock(1_000_000);
    const s = new RecentObservationStore(1_000);
    s.mark("bmkg", "quake-1", clock.now());
    clock.advance(2_000);
    expect(s.seen("bmkg", "quake-1", clock.now())).toBe(false);
  });
});

describe("eligibleConnectors · scheduling", () => {
  it("never-polled connectors are eligible immediately", () => {
    const c1 = createBmkgEarthquakeConnector();
    const h = new LiveSourceHealthRegistry();
    const eligible = eligibleConnectors([c1], h, new Date());
    expect(eligible).toContain(c1);
  });

  it("recently-polled connector is NOT eligible until interval elapses", () => {
    const c1 = createBmkgEarthquakeConnector();
    const h = new LiveSourceHealthRegistry();
    const now = new Date("2026-08-30T00:00:00Z");
    h.recordPoll(c1.config.id, true, 100, now.toISOString(), 0);
    // BMKG earthquake polls every 60s
    const after30s = new Date(now.getTime() + 30_000);
    expect(eligibleConnectors([c1], h, after30s)).not.toContain(c1);
    const after120s = new Date(now.getTime() + 120_000);
    expect(eligibleConnectors([c1], h, after120s)).toContain(c1);
  });
});

describe("liveTick · full flow", () => {
  it("polls each eligible connector, publishes entities, updates health", async () => {
    const c1 = createBmkgEarthquakeConnector();
    const h = new LiveSourceHealthRegistry();
    const r = new RecentObservationStore();
    const publishedIds: string[] = [];
    const report = await liveTick({
      connectors: [c1], health: h, recent: r,
      onPublish: (_source, entities) => { publishedIds.push(...entities.map((e) => e.id)); },
      __mocks: { [c1.config.id]: BMKG_FIXTURE },
      now: () => new Date("2026-08-30T00:00:00Z"),
    });
    expect(report.polled).toBe(1);
    expect(report.succeeded).toBe(1);
    expect(report.publishedEntities).toBe(1);
    expect(publishedIds.length).toBe(1);
    expect(h.get(c1.config.id)?.cumulativeEntities).toBe(1);
  });

  it("dedupes repeated observations across ticks", async () => {
    const c1 = createBmkgEarthquakeConnector();
    const h = new LiveSourceHealthRegistry();
    const r = new RecentObservationStore(10 * 60_000);
    let publishedCount = 0;

    // Tick 1 · new observation.
    let clockMs = Date.parse("2026-08-30T00:00:00Z");
    await liveTick({
      connectors: [c1], health: h, recent: r,
      onPublish: (_s, e) => { publishedCount += e.length; },
      __mocks: { [c1.config.id]: BMKG_FIXTURE },
      now: () => new Date(clockMs),
    });
    expect(publishedCount).toBe(1);

    // Tick 2 · advance past the poll interval, same observation.
    clockMs += 120_000;
    const r2 = await liveTick({
      connectors: [c1], health: h, recent: r,
      onPublish: (_s, e) => { publishedCount += e.length; },
      __mocks: { [c1.config.id]: BMKG_FIXTURE },
      now: () => new Date(clockMs),
    });
    expect(r2.dedupedEntities).toBe(1);
    expect(publishedCount).toBe(1);  // still one · duplicate was dropped
  });

  it("mixes success and failure across connectors without stopping", async () => {
    const bmkg = createBmkgEarthquakeConnector();
    const magma = createMagmaVolcanoConnector();
    const h = new LiveSourceHealthRegistry();
    const r = new RecentObservationStore();
    const report = await liveTick({
      connectors: [bmkg, magma], health: h, recent: r,
      onPublish: () => undefined,
      __mocks: {
        [bmkg.config.id]: BMKG_FIXTURE,
        // Magma with no mock provided → fetch() is env-gated off →
        // returns disabled error → counted as failure, not a crash.
      },
      now: () => new Date(),
    });
    expect(report.succeeded).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.perSource.length).toBe(2);
    // Health captures both.
    expect(h.get(bmkg.config.id)?.successesTotal).toBe(1);
    expect(h.get(magma.config.id)?.failuresTotal).toBe(1);
  });
});
