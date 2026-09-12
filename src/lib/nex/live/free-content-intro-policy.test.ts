// src/lib/nex/live/free-content-intro-policy.test.ts
//
// NEX LIVE · Phase 3 · Free-user intro decision engine tests
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 3

import { describe, it, expect } from "vitest";
import {
  decideFreeIntro,
  INTRO_MIN_INTERVAL_MS,
  type FreeIntroCandidate,
  type FreeIntroDecisionInput,
} from "./free-content-intro-policy";

const NOW_MS = Date.parse("2026-09-06T14:00:00.000Z");

const REAL_CLIP: FreeIntroCandidate = {
  media_id: "mock_video_hotel_room_tour",
  entity_name: "Gaotama Hotel (mock entity)",
  city_label: "yogyakarta",
  title: "Hotel Room Tour",
  playback_url: "/api/nex-live/media/stream/mock_video_hotel_room_tour",
  poster_url: null,
  duration_hint_sec: 10,
  is_mock_fixture: true,
};

const NULL_URL_CLIP: FreeIntroCandidate = { ...REAL_CLIP, media_id: "no_url", playback_url: null };
const EMPTY_URL_CLIP: FreeIntroCandidate = { ...REAL_CLIP, media_id: "empty_url", playback_url: "" };

const baseInput: FreeIntroDecisionInput = {
  user_tier: "FREE",
  intro_frequency: "HIGH",
  last_intro_shown_at_ms: null,
  now_ms: NOW_MS,
  reduced_motion: false,
  intro_shown_this_session: false,
  candidates: [REAL_CLIP],
};

describe("decideFreeIntro · governing rules (§28-§36)", () => {
  it("Rule 1 · paid users NEVER see the intro", () => {
    const d = decideFreeIntro({ ...baseInput, user_tier: "PAID" });
    expect(d).toEqual({ action: "SUPPRESS", reason: "user_is_paid" });
  });

  it("Rule 3a · OFF frequency is a hard opt-out", () => {
    const d = decideFreeIntro({ ...baseInput, intro_frequency: "OFF" });
    expect(d).toEqual({ action: "SUPPRESS", reason: "frequency_off" });
  });

  it("Rule 5 · reduced-motion hard opt-out (§36)", () => {
    const d = decideFreeIntro({ ...baseInput, reduced_motion: true });
    expect(d).toEqual({ action: "SUPPRESS", reason: "reduced_motion" });
  });

  it("Rule 3c · one intro per session · hard cap", () => {
    const d = decideFreeIntro({ ...baseInput, intro_shown_this_session: true });
    expect(d).toEqual({ action: "SUPPRESS", reason: "already_shown_this_session" });
  });

  it("Rule 3b · min interval not elapsed → suppress", () => {
    const last = NOW_MS - (INTRO_MIN_INTERVAL_MS.HIGH - 1);
    const d = decideFreeIntro({ ...baseInput, last_intro_shown_at_ms: last });
    expect(d).toEqual({ action: "SUPPRESS", reason: "min_interval_not_elapsed" });
  });

  it("Rule 3b · min interval elapsed → eligible", () => {
    const last = NOW_MS - (INTRO_MIN_INTERVAL_MS.HIGH + 1000);
    const d = decideFreeIntro({ ...baseInput, last_intro_shown_at_ms: last });
    expect(d.action).toBe("SHOW");
  });

  it("Rule 4 · no candidates → never fabricate", () => {
    const d = decideFreeIntro({ ...baseInput, candidates: [] });
    expect(d).toEqual({ action: "SUPPRESS", reason: "no_clip" });
  });

  it("Rule 4b · every candidate missing a playback URL → suppress", () => {
    const d = decideFreeIntro({ ...baseInput, candidates: [NULL_URL_CLIP, EMPTY_URL_CLIP] });
    expect(d).toEqual({ action: "SUPPRESS", reason: "candidate_missing_playback" });
  });

  it("Happy path · FREE user · HIGH frequency · fresh clip → SHOW", () => {
    const d = decideFreeIntro(baseInput);
    if (d.action !== "SHOW") throw new Error(`Expected SHOW, got ${JSON.stringify(d)}`);
    expect(d.clip.media_id).toBe(REAL_CLIP.media_id);
    expect(d.reason).toBe("eligible");
  });

  it("Skips URL-less candidates in favor of one with a real playback URL", () => {
    const d = decideFreeIntro({ ...baseInput, candidates: [NULL_URL_CLIP, REAL_CLIP, EMPTY_URL_CLIP] });
    if (d.action !== "SHOW") throw new Error("Expected SHOW");
    expect(d.clip.media_id).toBe(REAL_CLIP.media_id);
  });

  it("OFF beats reduced-motion in ordering · both suppress but reason is frequency_off", () => {
    // Explicit rule order · frequency_off is checked before reduced_motion.
    // This locks in that operator-configured OFF is reported over accessibility.
    const d = decideFreeIntro({ ...baseInput, intro_frequency: "OFF", reduced_motion: true });
    expect(d).toEqual({ action: "SUPPRESS", reason: "frequency_off" });
  });

  it("Never returns SHOW for PAID even if all other conditions are ideal", () => {
    const d = decideFreeIntro({ ...baseInput, user_tier: "PAID", intro_frequency: "HIGH" });
    expect(d.action).toBe("SUPPRESS");
  });
});

describe("INTRO_MIN_INTERVAL_MS · §34 frequency contract", () => {
  it("OFF is infinite (never)", () => {
    expect(INTRO_MIN_INTERVAL_MS.OFF).toBe(Number.POSITIVE_INFINITY);
  });
  it("HIGH is stricter than MEDIUM which is stricter than LOW", () => {
    expect(INTRO_MIN_INTERVAL_MS.HIGH).toBeLessThan(INTRO_MIN_INTERVAL_MS.MEDIUM);
    expect(INTRO_MIN_INTERVAL_MS.MEDIUM).toBeLessThan(INTRO_MIN_INTERVAL_MS.LOW);
  });
});
