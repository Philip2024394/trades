// src/app/nex-native/settings/_phase1_services.test.ts
//
// NEX Phase 1.0 · unit tests for the PURE helpers exported by the
// Security + Custom Intro service layers + the Geo lookup module.
// Sealed 2026-10-06.
//
// These tests never touch the DB. The Supabase admin client is mocked
// so the service modules load without demanding real env vars.

import { describe, test, expect, vi } from "vitest";

// Supabase admin is a load-bearing import for security-service +
// custom-intro-service · at module-load it validates env vars and
// instantiates the client. We mock it so the pure-function imports
// resolve without touching the real NEX Supabase project.
vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {},
  nexSupabaseProjectRef: () => "mock",
}));

import {
  validateVideo,
  CUSTOM_INTRO_VIDEO_LIMITS,
} from "@/lib/nex-native/custom-intro-service";
import {
  deriveDeviceLabel,
  sessionKeyFromAccessToken,
} from "@/lib/nex-native/security-service";
import {
  UNKNOWN_LOCATION,
  formatApproxLocation,
} from "@/lib/nex-native/geo/geoip-lookup";

// ─── A · validateVideo rejects wrong mime ────────────────────────────

describe("validateVideo · mime", () => {
  test("rejects image/jpeg", () => {
    const result = validateVideo({
      mime_type: "image/jpeg",
      size_bytes: 1_000_000,
      duration_ms: 5_000,
      width: 1920,
      height: 1080,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Video must be");
    }
  });
});

// ─── B · validateVideo rejects oversized files ───────────────────────

describe("validateVideo · size", () => {
  test("rejects a file larger than 20 MB", () => {
    const result = validateVideo({
      mime_type: "video/mp4",
      size_bytes: CUSTOM_INTRO_VIDEO_LIMITS.max_size_bytes + 1,
      duration_ms: 5_000,
      width: 1920,
      height: 1080,
    });
    expect(result.ok).toBe(false);
  });
});

// ─── C · validateVideo rejects too-short videos ──────────────────────

describe("validateVideo · duration lower bound", () => {
  test("rejects duration below 3000 ms", () => {
    const result = validateVideo({
      mime_type: "video/mp4",
      size_bytes: 5_000_000,
      duration_ms: 2_999,
      width: 1920,
      height: 1080,
    });
    expect(result.ok).toBe(false);
  });
});

// ─── D · validateVideo rejects too-long videos ───────────────────────

describe("validateVideo · duration upper bound", () => {
  test("rejects duration above 10000 ms", () => {
    const result = validateVideo({
      mime_type: "video/mp4",
      size_bytes: 5_000_000,
      duration_ms: 10_001,
      width: 1920,
      height: 1080,
    });
    expect(result.ok).toBe(false);
  });
});

// ─── E · validateVideo accepts 16:9 and rejects portrait ─────────────

describe("validateVideo · aspect ratio", () => {
  test("accepts 1920x1080 (16:9)", () => {
    const result = validateVideo({
      mime_type: "video/mp4",
      size_bytes: 8 * 1024 * 1024,
      duration_ms: 6_000,
      width: 1920,
      height: 1080,
    });
    expect(result.ok).toBe(true);
  });

  test("rejects 1080x1920 (portrait)", () => {
    const result = validateVideo({
      mime_type: "video/mp4",
      size_bytes: 8 * 1024 * 1024,
      duration_ms: 6_000,
      width: 1080,
      height: 1920,
    });
    expect(result.ok).toBe(false);
  });
});

// ─── F · validateVideo accepts the canonical "happy path" ────────────

describe("validateVideo · happy path", () => {
  test("accepts a valid 1920x1080, 6000ms, 8MB mp4", () => {
    const result = validateVideo({
      mime_type: "video/mp4",
      size_bytes: 8 * 1024 * 1024,
      duration_ms: 6_000,
      width: 1920,
      height: 1080,
    });
    expect(result.ok).toBe(true);
  });
});

// ─── G · deriveDeviceLabel ───────────────────────────────────────────

describe("deriveDeviceLabel", () => {
  test("null/empty returns 'Unknown device'", () => {
    expect(deriveDeviceLabel(null)).toBe("Unknown device");
    expect(deriveDeviceLabel(undefined)).toBe("Unknown device");
    expect(deriveDeviceLabel("")).toBe("Unknown device");
  });

  test("Chrome-on-macOS UA returns 'Chrome on macOS'", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
    expect(deriveDeviceLabel(ua)).toBe("Chrome on macOS");
  });

  test("Safari-on-iOS UA returns 'Safari on iOS'", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(deriveDeviceLabel(ua)).toBe("Safari on iOS");
  });

  test("Firefox-on-Linux UA returns 'Firefox on Linux'", () => {
    const ua =
      "Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0";
    expect(deriveDeviceLabel(ua)).toBe("Firefox on Linux");
  });

  test("caps the label at 80 chars", () => {
    const bogus = "Chrome/" + "x".repeat(300);
    const result = deriveDeviceLabel(bogus);
    expect(result.length).toBeLessThanOrEqual(80);
  });
});

// ─── H · sessionKeyFromAccessToken ───────────────────────────────────

describe("sessionKeyFromAccessToken", () => {
  test("returns a 64-char lowercase hex string", () => {
    const key = sessionKeyFromAccessToken("test-token");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  test("is deterministic · identical input yields identical output", () => {
    const a = sessionKeyFromAccessToken("same-input");
    const b = sessionKeyFromAccessToken("same-input");
    expect(a).toBe(b);
  });

  test("different inputs yield different outputs", () => {
    const a = sessionKeyFromAccessToken("input-one");
    const b = sessionKeyFromAccessToken("input-two");
    expect(a).not.toBe(b);
  });
});

// ─── I · formatApproxLocation ────────────────────────────────────────

describe("formatApproxLocation", () => {
  test("UNKNOWN_LOCATION formats as 'Unknown location'", () => {
    expect(formatApproxLocation(UNKNOWN_LOCATION)).toBe("Unknown location");
  });

  test("{ city: 'London', country: 'UK', resolved: true } formats as 'London, UK'", () => {
    expect(
      formatApproxLocation({ city: "London", country: "UK", resolved: true }),
    ).toBe("London, UK");
  });

  test("{ city: null, country: 'UK', resolved: true } formats as 'UK'", () => {
    expect(
      formatApproxLocation({ city: null, country: "UK", resolved: true }),
    ).toBe("UK");
  });

  test("{ city: 'London', country: null, resolved: true } formats as 'London'", () => {
    expect(
      formatApproxLocation({ city: "London", country: null, resolved: true }),
    ).toBe("London");
  });
});
