// src/lib/nex/live/live-status.test.ts
//
// NEX LIVE · Master Experience · live-status derivation tests (§37 §41 §42)

import { describe, it, expect } from "vitest";
import {
  deriveLiveDiscoveryStatus,
  isDiscoveryVisibleStatus,
  discoveryOrderWeight,
  labelForStatus,
} from "./live-status";
import { MOCK_FIXTURES, fixturesForEntity, fixturesForCity, fixtureEntityIds } from "./mock-fixtures";

const NOW = "2026-09-06T14:00:00.000Z";
const isoInMin = (m: number) => new Date(Date.parse(NOW) + m * 60_000).toISOString();

describe("deriveLiveDiscoveryStatus · LIVE_NOW gate (§42 fresh heartbeat required)", () => {
  it("LIVE state + fresh heartbeat + past start_at → LIVE_NOW", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "LIVE",
      visibility_state: "ACTIVE",
      started_at_iso: isoInMin(-10),
      end_at_iso: null,
      last_heartbeat_iso: isoInMin(-0.5),
      now_iso: NOW,
    })).toBe("LIVE_NOW");
  });
  it("LIVE state + STALE heartbeat → STALE (not LIVE_NOW)", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "LIVE",
      visibility_state: "ACTIVE",
      started_at_iso: isoInMin(-10),
      end_at_iso: null,
      last_heartbeat_iso: isoInMin(-30),   // 30 min stale · well past 2min TTL
      now_iso: NOW,
    })).toBe("STALE");
  });
  it("LIVE state + no heartbeat → STALE (§42 conservative)", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "LIVE",
      visibility_state: "ACTIVE",
      started_at_iso: isoInMin(-5),
      end_at_iso: null,
      last_heartbeat_iso: null,
      now_iso: NOW,
    })).toBe("STALE");
  });
  it("LIVE state + past end_at → ENDED", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "LIVE",
      visibility_state: "ACTIVE",
      started_at_iso: isoInMin(-60),
      end_at_iso: isoInMin(-5),
      last_heartbeat_iso: isoInMin(-1),
      now_iso: NOW,
    })).toBe("ENDED");
  });
});

describe("deriveLiveDiscoveryStatus · scheduled windows", () => {
  it("PUBLISHED + start in 30 min → STARTING_SOON", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "PUBLISHED",
      visibility_state: "ACTIVE",
      started_at_iso: isoInMin(30),
      end_at_iso: null,
      last_heartbeat_iso: null,
      now_iso: NOW,
    })).toBe("STARTING_SOON");
  });
  it("PUBLISHED + start in 90 min (past soon window) → UPCOMING or TONIGHT", () => {
    // NOW = 14:00 local · +90 min = 15:30 · not TONIGHT window · UPCOMING
    const r = deriveLiveDiscoveryStatus({
      content_state: "PUBLISHED",
      visibility_state: "ACTIVE",
      started_at_iso: isoInMin(90),
      end_at_iso: null,
      last_heartbeat_iso: null,
      now_iso: NOW,
    });
    expect(["UPCOMING", "TONIGHT"]).toContain(r);
  });
  it("PUBLISHED + start already past + not LIVE state → UNKNOWN", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "PUBLISHED",
      visibility_state: "ACTIVE",
      started_at_iso: isoInMin(-5),
      end_at_iso: null,
      last_heartbeat_iso: null,
      now_iso: NOW,
    })).toBe("UNKNOWN");
  });
});

describe("deriveLiveDiscoveryStatus · terminal states short-circuit", () => {
  it("ENDED lifecycle → ENDED", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "ENDED",
      visibility_state: "ACTIVE",
      started_at_iso: isoInMin(-60),
      end_at_iso: null,
      last_heartbeat_iso: null,
      now_iso: NOW,
    })).toBe("ENDED");
  });
  it("ARCHIVED → ENDED", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "ARCHIVED",
      visibility_state: "ACTIVE",
      started_at_iso: null,
      end_at_iso: null,
      last_heartbeat_iso: null,
      now_iso: NOW,
    })).toBe("ENDED");
  });
  it("REMOVED lifecycle → ENDED (never LIVE_NOW)", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "REMOVED",
      visibility_state: "ACTIVE",
      started_at_iso: isoInMin(-1),
      end_at_iso: null,
      last_heartbeat_iso: isoInMin(0),
      now_iso: NOW,
    })).toBe("ENDED");
  });
  it("visibility REMOVED → ENDED (§43 rights safety)", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "LIVE",
      visibility_state: "REMOVED",
      started_at_iso: isoInMin(-1),
      end_at_iso: null,
      last_heartbeat_iso: isoInMin(0),
      now_iso: NOW,
    })).toBe("ENDED");
  });
  it("visibility RESTRICTED → ENDED", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "LIVE",
      visibility_state: "RESTRICTED",
      started_at_iso: isoInMin(-1),
      end_at_iso: null,
      last_heartbeat_iso: isoInMin(0),
      now_iso: NOW,
    })).toBe("ENDED");
  });
});

describe("deriveLiveDiscoveryStatus · defensive", () => {
  it("null started_at → UNKNOWN (regular published media, not Live axis)", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "PUBLISHED",
      visibility_state: "ACTIVE",
      started_at_iso: null,
      end_at_iso: null,
      last_heartbeat_iso: null,
      now_iso: NOW,
    })).toBe("UNKNOWN");
  });
  it("malformed now_iso → UNKNOWN", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "LIVE",
      visibility_state: "ACTIVE",
      started_at_iso: isoInMin(-1),
      end_at_iso: null,
      last_heartbeat_iso: isoInMin(0),
      now_iso: "not-a-date",
    })).toBe("UNKNOWN");
  });
  it("malformed started_at → UNKNOWN", () => {
    expect(deriveLiveDiscoveryStatus({
      content_state: "LIVE",
      visibility_state: "ACTIVE",
      started_at_iso: "invalid",
      end_at_iso: null,
      last_heartbeat_iso: isoInMin(0),
      now_iso: NOW,
    })).toBe("UNKNOWN");
  });
});

describe("discovery helpers", () => {
  it("isDiscoveryVisibleStatus · LIVE_NOW/STARTING_SOON/TONIGHT/UPCOMING → true", () => {
    for (const s of ["LIVE_NOW", "STARTING_SOON", "TONIGHT", "UPCOMING"] as const) {
      expect(isDiscoveryVisibleStatus(s)).toBe(true);
    }
  });
  it("isDiscoveryVisibleStatus · ENDED/STALE/UNKNOWN → false", () => {
    for (const s of ["ENDED", "STALE", "UNKNOWN"] as const) {
      expect(isDiscoveryVisibleStatus(s)).toBe(false);
    }
  });
  it("discoveryOrderWeight · LIVE_NOW first, ENDED last", () => {
    expect(discoveryOrderWeight("LIVE_NOW")).toBeLessThan(discoveryOrderWeight("STARTING_SOON"));
    expect(discoveryOrderWeight("STARTING_SOON")).toBeLessThan(discoveryOrderWeight("TONIGHT"));
    expect(discoveryOrderWeight("TONIGHT")).toBeLessThan(discoveryOrderWeight("UPCOMING"));
    expect(discoveryOrderWeight("UPCOMING")).toBeLessThan(discoveryOrderWeight("ENDED"));
  });
  it("labelForStatus · LIVE_NOW → 'LIVE'", () => {
    expect(labelForStatus("LIVE_NOW")).toBe("LIVE");
    expect(labelForStatus("STARTING_SOON")).toBe("Starting soon");
    expect(labelForStatus("TONIGHT")).toBe("Tonight");
    expect(labelForStatus("UNKNOWN")).toBe("");
  });
});

// ── Mock fixtures invariants ─────────────────────────────────────

describe("MOCK_FIXTURES invariants (§17 §21 §55)", () => {
  it("every fixture is clearly marked as mock (via seed marker)", () => {
    // The fixture list itself declares that all entries are mock; the
    // marker is applied at seed-write time. Here we assert every fixture
    // uses a mock_* creator_id / entity_id pattern to remove ambiguity.
    for (const f of MOCK_FIXTURES) {
      expect(f.creator_id).toMatch(/^mock_/);
      expect(f.entity_id).toMatch(/^mock_/);
    }
  });
  it("every fixture has a non-empty rights_statement (§21 gate)", () => {
    for (const f of MOCK_FIXTURES) {
      expect(f.rights_statement.length).toBeGreaterThan(5);
    }
  });
  it("every fixture uses OWNER_DECLARED / LICENSED / PUBLIC_DOMAIN / CREATIVE_COMMONS · never UNKNOWN", () => {
    const ok = new Set(["OWNER_DECLARED", "LICENSED", "PUBLIC_DOMAIN", "CREATIVE_COMMONS"]);
    for (const f of MOCK_FIXTURES) {
      expect(ok.has(f.rights_kind)).toBe(true);
    }
  });
  it("MUSIC fixtures use audio media_asset · VIDEO fixtures use existing_sample_video", () => {
    for (const f of MOCK_FIXTURES) {
      if (f.mode === "MUSIC") expect(f.media_asset.startsWith("seed_wav_silence:")).toBe(true);
      if (f.mode === "VIDEO") expect(f.media_asset).toBe("existing_sample_video");
    }
  });
  it("fixture roster covers §55 baseline (music + video + multi-city + entity-linked)", () => {
    const music = MOCK_FIXTURES.filter((f) => f.mode === "MUSIC");
    const video = MOCK_FIXTURES.filter((f) => f.mode === "VIDEO");
    const cities = new Set(MOCK_FIXTURES.map((f) => f.city_slug));
    expect(music.length).toBeGreaterThanOrEqual(3);
    expect(video.length).toBeGreaterThanOrEqual(3);
    expect(cities.size).toBeGreaterThanOrEqual(2);
    // At least one entity has multiple sessions (§8 carousel test)
    const entityCounts = new Map<string, number>();
    for (const f of MOCK_FIXTURES) {
      entityCounts.set(f.entity_id, (entityCounts.get(f.entity_id) ?? 0) + 1);
    }
    const maxSessions = Math.max(...entityCounts.values());
    expect(maxSessions).toBeGreaterThanOrEqual(2);
  });
  it("fixtures span multiple statuses (LIVE, STARTING_SOON via offsets)", () => {
    const hasLive = MOCK_FIXTURES.some((f) => f.content_state === "LIVE");
    const hasStarting = MOCK_FIXTURES.some((f) => f.started_at_offset_min > 0);
    expect(hasLive).toBe(true);
    expect(hasStarting).toBe(true);
  });
});

describe("fixture helpers", () => {
  it("fixturesForEntity returns only that entity's fixtures", () => {
    const hotelFxs = fixturesForEntity("mock_entity_gaotama_hotel");
    expect(hotelFxs.length).toBeGreaterThanOrEqual(2);
    for (const f of hotelFxs) expect(f.entity_id).toBe("mock_entity_gaotama_hotel");
  });
  it("fixturesForCity returns only that city's fixtures", () => {
    const yogFxs = fixturesForCity("yogyakarta");
    for (const f of yogFxs) expect(f.city_slug).toBe("yogyakarta");
  });
  it("fixtureEntityIds enumerates distinct entities", () => {
    const ids = fixtureEntityIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });
});
