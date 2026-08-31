// Stage 3.26 · Phase 19 · Long-Term Memory unit tests.

import { describe, it, expect, beforeEach } from "vitest";
import {
  getPreferences,
  updatePreferencesFromSlots,
  snapshotPreferences,
  _resetLongTermMemoryForTests,
  longTermMemorySizeForTests,
} from "./long-term-memory";

beforeEach(() => _resetLongTermMemoryForTests());

describe("getPreferences · consent + userId gating", () => {
  it("returns null when userId absent", () => {
    expect(getPreferences(undefined, true)).toBeNull();
  });

  it("returns null when consent not granted", () => {
    expect(getPreferences("user-1", false)).toBeNull();
  });

  it("returns null when userId has no prior preferences", () => {
    expect(getPreferences("never-seen", true)).toBeNull();
  });
});

describe("updatePreferencesFromSlots · consent gating", () => {
  it("no-op when userId absent", () => {
    const r = updatePreferencesFromSlots({ userId: "", hasConsent: true, location: "yogyakarta" });
    expect(r).toBeNull();
    expect(longTermMemorySizeForTests()).toBe(0);
  });

  it("no-op when consent not granted", () => {
    const r = updatePreferencesFromSlots({ userId: "u1", hasConsent: false, location: "yogyakarta" });
    expect(r).toBeNull();
    expect(longTermMemorySizeForTests()).toBe(0);
  });

  it("writes preferences when userId + consent", () => {
    const r = updatePreferencesFromSlots({
      userId: "u1", hasConsent: true,
      location: "yogyakarta", type: "hotel", budget: "budget", area: "malioboro",
    });
    expect(r).not.toBeNull();
    expect(r?.userId).toBe("u1");
    expect(r?.interactionCount).toBe(1);
    expect(r?.locationPreference?.canonical).toBe("yogyakarta");
    expect(r?.typePreference?.canonical).toBe("hotel");
    expect(r?.budgetPreference?.canonical).toBe("budget");
    expect(r?.areaPreference?.canonical).toBe("malioboro");
  });
});

describe("updatePreferencesFromSlots · frequency-weighted bubble-up", () => {
  it("most-often-picked value wins", () => {
    // 3× yogyakarta, 1× bali → yogyakarta wins
    updatePreferencesFromSlots({ userId: "u1", hasConsent: true, location: "yogyakarta" });
    updatePreferencesFromSlots({ userId: "u1", hasConsent: true, location: "yogyakarta" });
    updatePreferencesFromSlots({ userId: "u1", hasConsent: true, location: "bali" });
    const final = updatePreferencesFromSlots({ userId: "u1", hasConsent: true, location: "yogyakarta" });
    expect(final?.locationPreference?.canonical).toBe("yogyakarta");
    expect(final?.locationPreference?.count).toBe(3);
    expect(final?.interactionCount).toBe(4);
  });

  it("interactionCount increments on every update", () => {
    updatePreferencesFromSlots({ userId: "u1", hasConsent: true, location: "yogyakarta" });
    updatePreferencesFromSlots({ userId: "u1", hasConsent: true, location: "yogyakarta" });
    const r = updatePreferencesFromSlots({ userId: "u1", hasConsent: true, location: "yogyakarta" });
    expect(r?.interactionCount).toBe(3);
  });
});

describe("cross-user isolation", () => {
  it("different users have separate stores", () => {
    updatePreferencesFromSlots({ userId: "userA", hasConsent: true, location: "yogyakarta", type: "hotel" });
    updatePreferencesFromSlots({ userId: "userB", hasConsent: true, location: "bali", type: "villa" });
    const pA = getPreferences("userA", true);
    const pB = getPreferences("userB", true);
    expect(pA?.locationPreference?.canonical).toBe("yogyakarta");
    expect(pA?.typePreference?.canonical).toBe("hotel");
    expect(pB?.locationPreference?.canonical).toBe("bali");
    expect(pB?.typePreference?.canonical).toBe("villa");
    expect(longTermMemorySizeForTests()).toBe(2);
  });
});

describe("snapshotPreferences · serialisation", () => {
  it("returns null for null input", () => {
    expect(snapshotPreferences(null)).toBeNull();
  });

  it("omits internal _counts field from snapshot", () => {
    const p = updatePreferencesFromSlots({ userId: "u1", hasConsent: true, location: "yogyakarta", type: "hotel" });
    const snap = snapshotPreferences(p);
    expect(snap).not.toBeNull();
    expect(snap?.userId).toBe("u1");
    expect(snap?.locationPreference?.canonical).toBe("yogyakarta");
    expect(snap?.typePreference?.canonical).toBe("hotel");
    // No internal _counts leaked
    expect((snap as unknown as { _counts?: unknown })._counts).toBeUndefined();
  });
});

describe("empty slot updates preserve prior preferences", () => {
  it("update with no slots doesn't clobber existing values", () => {
    updatePreferencesFromSlots({ userId: "u1", hasConsent: true, location: "yogyakarta", type: "hotel" });
    const r = updatePreferencesFromSlots({ userId: "u1", hasConsent: true });
    // interactionCount still bumps · but no slots change
    expect(r?.interactionCount).toBe(2);
    expect(r?.locationPreference?.canonical).toBe("yogyakarta");
    expect(r?.typePreference?.canonical).toBe("hotel");
  });
});
