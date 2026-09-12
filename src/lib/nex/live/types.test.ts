// src/lib/nex/live/types.test.ts
// NEX LIVE · Phase A · universal LiveEntity + presentation guards

import { describe, it, expect } from "vitest";
import {
  isLiveRightNow,
  derivePresentationState,
} from "./types";

const NOW = "2026-09-06T20:00:00.000Z";

describe("types · isLiveRightNow (§26 both status AND freshness required)", () => {
  it("status=LIVE + freshness=FRESH → live now", () => {
    expect(isLiveRightNow({ status: "LIVE", freshness: "FRESH" })).toBe(true);
  });
  it("status=LIVE + freshness=STALE → NOT live (honest boundary)", () => {
    expect(isLiveRightNow({ status: "LIVE", freshness: "STALE" })).toBe(false);
  });
  it("status=LIVE + freshness=UNKNOWN → NOT live (never fabricates)", () => {
    expect(isLiveRightNow({ status: "LIVE", freshness: "UNKNOWN" })).toBe(false);
  });
  it("status=LIVE + freshness=ENDED → NOT live", () => {
    expect(isLiveRightNow({ status: "LIVE", freshness: "ENDED" })).toBe(false);
  });
  it("status=PUBLISHED + freshness=FRESH → NOT live (status hasn't transitioned)", () => {
    expect(isLiveRightNow({ status: "PUBLISHED", freshness: "FRESH" })).toBe(false);
  });
});

describe("types · derivePresentationState", () => {
  it("LIVE + FRESH → LIVE_NOW", () => {
    expect(derivePresentationState({ status: "LIVE", freshness: "FRESH", start_time_iso: null }, NOW))
      .toBe("LIVE_NOW");
  });
  it("LIVE + STALE → STALE_UNKNOWN (never LIVE_NOW when freshness fails)", () => {
    expect(derivePresentationState({ status: "LIVE", freshness: "STALE", start_time_iso: null }, NOW))
      .toBe("STALE_UNKNOWN");
  });
  it("LIVE + UNKNOWN freshness → STALE_UNKNOWN", () => {
    expect(derivePresentationState({ status: "LIVE", freshness: "UNKNOWN", start_time_iso: null }, NOW))
      .toBe("STALE_UNKNOWN");
  });
  it("PUBLISHED + start_time within 60min → STARTING_SOON", () => {
    const start = new Date(Date.parse(NOW) + 30 * 60 * 1000).toISOString();
    expect(derivePresentationState({ status: "PUBLISHED", freshness: "UNKNOWN", start_time_iso: start }, NOW))
      .toBe("STARTING_SOON");
  });
  it("PUBLISHED + start_time > 60min → DRAFT_NOT_VISIBLE (not near-term)", () => {
    const start = new Date(Date.parse(NOW) + 2 * 60 * 60 * 1000).toISOString();
    expect(derivePresentationState({ status: "PUBLISHED", freshness: "UNKNOWN", start_time_iso: start }, NOW))
      .toBe("DRAFT_NOT_VISIBLE");
  });
  it("ENDED status → ENDED", () => {
    expect(derivePresentationState({ status: "ENDED", freshness: "ENDED", start_time_iso: null }, NOW))
      .toBe("ENDED");
  });
  it("ARCHIVED status → ENDED", () => {
    expect(derivePresentationState({ status: "ARCHIVED", freshness: "UNKNOWN", start_time_iso: null }, NOW))
      .toBe("ENDED");
  });
  it("BLOCKED status → HIDDEN", () => {
    expect(derivePresentationState({ status: "BLOCKED", freshness: "FRESH", start_time_iso: null }, NOW))
      .toBe("HIDDEN");
  });
  it("REMOVED status → HIDDEN", () => {
    expect(derivePresentationState({ status: "REMOVED", freshness: "FRESH", start_time_iso: null }, NOW))
      .toBe("HIDDEN");
  });
  it("DRAFT → DRAFT_NOT_VISIBLE", () => {
    expect(derivePresentationState({ status: "DRAFT", freshness: "UNKNOWN", start_time_iso: null }, NOW))
      .toBe("DRAFT_NOT_VISIBLE");
  });
  it("UPLOADING → DRAFT_NOT_VISIBLE", () => {
    expect(derivePresentationState({ status: "UPLOADING", freshness: "UNKNOWN", start_time_iso: null }, NOW))
      .toBe("DRAFT_NOT_VISIBLE");
  });
  it("UPLOAD_FAILED → DRAFT_NOT_VISIBLE (never accidentally discoverable)", () => {
    expect(derivePresentationState({ status: "UPLOAD_FAILED", freshness: "UNKNOWN", start_time_iso: null }, NOW))
      .toBe("DRAFT_NOT_VISIBLE");
  });
});
