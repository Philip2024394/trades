// src/lib/nex/brain/live-discovery-handler.test.ts
//
// NEX · Phase D · Live discovery handler tests
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D §19-§24

import { describe, it, expect } from "vitest";
import { runLiveDiscoveryHandler } from "./live-discovery-handler";
import type { LiveDiscoveryScope } from "./live-discovery-intent";

function scope(overrides: Partial<LiveDiscoveryScope>): LiveDiscoveryScope {
  return {
    is_live_discovery: true,
    language: "EN",
    time_scope: "TONIGHT",
    category_scope: "any",
    explicit_city: null,
    reason: "en:live+tonight",
    ...overrides,
  };
}

describe("runLiveDiscoveryHandler · §21 zero-evidence honesty", () => {
  it("no city context → empty cards + honest English summary", async () => {
    const r = await runLiveDiscoveryHandler({ scope: scope({ explicit_city: null }), session_city: null });
    expect(r.cards).toEqual([]);
    expect(r.city_used).toBeNull();
    expect(r.empty_reason).toBe("no_city_context");
    expect(r.summary.toLowerCase()).toContain("city");
  });

  it("no city context · Indonesian language → honest Indonesian summary", async () => {
    const r = await runLiveDiscoveryHandler({ scope: scope({ language: "ID", explicit_city: null }), session_city: null });
    expect(r.empty_reason).toBe("no_city_context");
    expect(r.summary.toLowerCase()).toContain("kota");
  });

  it("summary NEVER contains 'LIVE_DISCOVERY_REQUEST' string · §20 calm reply", async () => {
    const r = await runLiveDiscoveryHandler({ scope: scope({ explicit_city: null }), session_city: null });
    expect(r.summary).not.toContain("LIVE_DISCOVERY_REQUEST");
    expect(r.summary).not.toContain("intent");
  });
});

describe("runLiveDiscoveryHandler · §22-§24 preserved primitives", () => {
  it("gracefully handles a city with no timing sidecar OR no fixtures without throwing", async () => {
    const r = await runLiveDiscoveryHandler({ scope: scope({ explicit_city: "not-a-real-city" }), session_city: null });
    expect(r.cards).toEqual([]);
    // Depending on env: either no_timing_sidecar OR no_fixtures_for_scope.
    // Both are legitimate honest empty reasons · both preserve §21.
    expect(["no_timing_sidecar", "no_fixtures_for_scope"]).toContain(r.empty_reason);
  });

  it("respects category scope · food scope returns 0 cards when no food fixtures exist for the city", async () => {
    const r = await runLiveDiscoveryHandler({ scope: scope({ explicit_city: "not-a-real-city", category_scope: "food" }), session_city: null });
    expect(r.cards).toEqual([]);
    expect(r.category_used).toBe("food");
  });
});

describe("runLiveDiscoveryHandler · summary conventions", () => {
  it("empty result summary mentions the requested city when known", async () => {
    const r = await runLiveDiscoveryHandler({ scope: scope({ explicit_city: "not-a-real-city" }), session_city: null });
    expect(r.summary.toLowerCase()).toContain("not-a-real-city");
  });

  it("empty result summary in Indonesian uses honest phrasing", async () => {
    const r = await runLiveDiscoveryHandler({ scope: scope({ language: "ID", explicit_city: "not-a-real-city" }), session_city: null });
    // Empty state should use "tidak" (not) somewhere · a positive
    // Indonesian sentence would use "ada" alone.
    expect(r.summary.toLowerCase()).toContain("tidak");
  });
});
