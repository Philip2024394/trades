// Timezone conversion — never uses server time.

import { describe, it, expect } from "vitest";
import { isValidTimezone, localToUtc, nextWeeklyRun, utcOffsetMinutes, formatInTz } from "./timezone";

describe("isValidTimezone", () => {
  it("accepts real IANA zones", () => {
    expect(isValidTimezone("Europe/London")).toBe(true);
    expect(isValidTimezone("Asia/Jakarta")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidTimezone("Not/A/Zone")).toBe(false);
    expect(isValidTimezone("UTC+7")).toBe(false);
  });
});

describe("utcOffsetMinutes", () => {
  it("Asia/Jakarta is +7h in July", () => {
    const at = new Date("2026-07-15T00:00:00Z");
    expect(utcOffsetMinutes("Asia/Jakarta", at)).toBe(420);
  });
  it("Europe/London is +1h in July (BST)", () => {
    const at = new Date("2026-07-15T00:00:00Z");
    expect(utcOffsetMinutes("Europe/London", at)).toBe(60);
  });
  it("Europe/London is 0 in January (GMT)", () => {
    const at = new Date("2026-01-15T00:00:00Z");
    expect(utcOffsetMinutes("Europe/London", at)).toBe(0);
  });
});

describe("localToUtc", () => {
  it("UK Friday 17:00 BST → 16:00 UTC", () => {
    const utc = localToUtc({ year: 2026, month: 7, day: 24, hour: 17, minute: 0, timezone: "Europe/London" });
    expect(utc.toISOString()).toBe("2026-07-24T16:00:00.000Z");
  });
  it("Jakarta Friday 17:00 → 10:00 UTC", () => {
    const utc = localToUtc({ year: 2026, month: 7, day: 24, hour: 17, minute: 0, timezone: "Asia/Jakarta" });
    expect(utc.toISOString()).toBe("2026-07-24T10:00:00.000Z");
  });
  it("Same local time in different timezones produces different UTC instants", () => {
    const uk = localToUtc({ year: 2026, month: 7, day: 24, hour: 17, minute: 0, timezone: "Europe/London" });
    const id = localToUtc({ year: 2026, month: 7, day: 24, hour: 17, minute: 0, timezone: "Asia/Jakarta" });
    expect(uk.getTime()).not.toBe(id.getTime());
    // Jakarta 17:00 happens 6h before UK 17:00 (in July).
    expect((uk.getTime() - id.getTime()) / 3_600_000).toBe(6);
  });
  it("Handles London DST transition (last Sunday of March)", () => {
    // At 02:00 on 29 Mar 2026, London clocks jump to 03:00.
    // 03:30 local = 02:30 UTC (offset +1).
    const utc = localToUtc({ year: 2026, month: 3, day: 29, hour: 3, minute: 30, timezone: "Europe/London" });
    expect(utc.toISOString()).toBe("2026-03-29T02:30:00.000Z");
  });
});

describe("nextWeeklyRun", () => {
  it("finds next Friday 17:00 in Europe/London", () => {
    // Tuesday 21 Jul 2026 in UK
    const now = new Date("2026-07-21T10:00:00Z");
    const next = nextWeeklyRun({ pattern: "weekly:friday@17:00", timezone: "Europe/London", now });
    expect(next).not.toBeNull();
    expect(next!.toISOString()).toBe("2026-07-24T16:00:00.000Z");
  });

  it("skips to next week when past the target this week", () => {
    // Friday 24 Jul 18:00 UTC (19:00 UK) — past 17:00 UK today
    const now = new Date("2026-07-24T18:00:00Z");
    const next = nextWeeklyRun({ pattern: "weekly:friday@17:00", timezone: "Europe/London", now });
    expect(next!.toISOString()).toBe("2026-07-31T16:00:00.000Z");
  });

  it("rejects malformed patterns", () => {
    expect(nextWeeklyRun({ pattern: "banana", timezone: "Europe/London" })).toBeNull();
    expect(nextWeeklyRun({ pattern: "weekly:notaday@17:00", timezone: "Europe/London" })).toBeNull();
  });
});

describe("formatInTz", () => {
  it("renders a UTC instant in the given zone", () => {
    const out = formatInTz("2026-07-24T16:00:00Z", "Europe/London");
    // UK renders as "24 Jul 2026, 17:00" — locale exact may vary; check hour presence
    expect(out).toContain("17:00");
  });
});
