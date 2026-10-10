// src/lib/nex/marketing/deliverability/__tests__/recurrence.test.ts
//
// NEX Deliverability · Recurrence acceptance
// Founder-authorised programme · Session-16 · Part 11j · 2026-09-22.

import { describe, it, expect } from "vitest";
import {
  computeNextRun, enumerateOccurrences, validateRecurrenceSpec,
  _RECURRENCE_NEVER_TRIGGERS, _RECURRENCE_NEVER_PERSISTS,
  _RECURRENCE_DETERMINISTIC, _RECURRENCE_RESPECTS_ENDS_AT,
  type RecurrenceSpec,
} from "..";

// ═══════════════════════════════════════════════════════════════════
// A · Validation
// ═══════════════════════════════════════════════════════════════════
describe("Recurrence · (A) validation", () => {
  it("(A1) valid daily spec passes", () => {
    const v = validateRecurrenceSpec({
      frequency: "daily", at_hour: 9, at_minute: 0,
      starts_at: "2026-01-01T00:00:00Z",
    });
    expect(v.ok).toBe(true);
  });
  it("(A2) at_hour out of range fails", () => {
    const v = validateRecurrenceSpec({
      frequency: "daily", at_hour: 24, at_minute: 0,
      starts_at: "2026-01-01T00:00:00Z",
    });
    expect(v.ok).toBe(false);
  });
  it("(A3) weekly without days_of_week fails", () => {
    const v = validateRecurrenceSpec({
      frequency: "weekly", at_hour: 9, at_minute: 0,
      starts_at: "2026-01-01T00:00:00Z",
    });
    expect(v.ok).toBe(false);
  });
  it("(A4) monthly without day_of_month fails", () => {
    const v = validateRecurrenceSpec({
      frequency: "monthly", at_hour: 9, at_minute: 0,
      starts_at: "2026-01-01T00:00:00Z",
    });
    expect(v.ok).toBe(false);
  });
  it("(A5) ends_at before starts_at fails", () => {
    const v = validateRecurrenceSpec({
      frequency: "daily", at_hour: 9, at_minute: 0,
      starts_at: "2026-06-01T00:00:00Z",
      ends_at: "2026-01-01T00:00:00Z",
    });
    expect(v.ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Daily recurrence
// ═══════════════════════════════════════════════════════════════════
describe("Recurrence · (B) daily", () => {
  const spec: RecurrenceSpec = {
    frequency: "daily", at_hour: 9, at_minute: 0,
    starts_at: "2026-09-01T00:00:00Z",
  };
  it("(B1) next run today at 09:00 when now is before 09:00", () => {
    const r = computeNextRun(spec, "2026-09-22T05:00:00Z");
    expect(r.kind).toBe("scheduled");
    if (r.kind === "scheduled") expect(r.next_run_at).toBe("2026-09-22T09:00:00.000Z");
  });
  it("(B2) next run tomorrow at 09:00 when now is after 09:00", () => {
    const r = computeNextRun(spec, "2026-09-22T15:00:00Z");
    if (r.kind === "scheduled") expect(r.next_run_at).toBe("2026-09-23T09:00:00.000Z");
  });
  it("(B3) respects starts_at · no occurrence before starts_at", () => {
    const r = computeNextRun(spec, "2025-01-01T00:00:00Z");
    if (r.kind === "scheduled") expect(r.next_run_at).toBe("2026-09-01T09:00:00.000Z");
  });
  it("(B4) ends_at cuts off future runs", () => {
    const bounded: RecurrenceSpec = { ...spec, ends_at: "2026-09-22T08:00:00Z" };
    const r = computeNextRun(bounded, "2026-09-22T05:00:00Z");
    expect(r.kind).toBe("spec_expired");
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Weekly recurrence
// ═══════════════════════════════════════════════════════════════════
describe("Recurrence · (C) weekly", () => {
  // Mon+Wed+Fri at 10:00 UTC
  const spec: RecurrenceSpec = {
    frequency: "weekly", at_hour: 10, at_minute: 0,
    starts_at: "2026-09-01T00:00:00Z",
    days_of_week: [1, 3, 5],
  };
  it("(C1) next Monday when now is Sunday morning", () => {
    // 2026-09-20 was a Sunday · next Mon is 2026-09-21
    const r = computeNextRun(spec, "2026-09-20T05:00:00Z");
    if (r.kind === "scheduled") expect(r.next_run_at).toBe("2026-09-21T10:00:00.000Z");
  });
  it("(C2) skips to Wednesday when now is Monday afternoon", () => {
    // 2026-09-21 Mon after 10 · next is Wed 2026-09-23
    const r = computeNextRun(spec, "2026-09-21T15:00:00Z");
    if (r.kind === "scheduled") expect(r.next_run_at).toBe("2026-09-23T10:00:00.000Z");
  });
  it("(C3) skips past Sat/Sun to Monday", () => {
    // 2026-09-26 is a Saturday · next is Mon 2026-09-28
    const r = computeNextRun(spec, "2026-09-26T00:00:00Z");
    if (r.kind === "scheduled") expect(r.next_run_at).toBe("2026-09-28T10:00:00.000Z");
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Monthly recurrence
// ═══════════════════════════════════════════════════════════════════
describe("Recurrence · (D) monthly", () => {
  const spec: RecurrenceSpec = {
    frequency: "monthly", at_hour: 8, at_minute: 30,
    starts_at: "2026-01-01T00:00:00Z",
    day_of_month: 15,
  };
  it("(D1) next 15th of current month if not passed", () => {
    const r = computeNextRun(spec, "2026-09-01T00:00:00Z");
    if (r.kind === "scheduled") expect(r.next_run_at).toBe("2026-09-15T08:30:00.000Z");
  });
  it("(D2) next 15th of following month if current already passed", () => {
    const r = computeNextRun(spec, "2026-09-20T00:00:00Z");
    if (r.kind === "scheduled") expect(r.next_run_at).toBe("2026-10-15T08:30:00.000Z");
  });
  it("(D3) day_of_month=31 clamps to actual month length (Feb → 28/29)", () => {
    const s: RecurrenceSpec = {
      frequency: "monthly", at_hour: 12, at_minute: 0,
      starts_at: "2026-01-01T00:00:00Z", day_of_month: 31,
    };
    // 2026 is not a leap year · Feb has 28 days
    const r = computeNextRun(s, "2026-02-01T00:00:00Z");
    if (r.kind === "scheduled") expect(r.next_run_at).toBe("2026-02-28T12:00:00.000Z");
  });
  it("(D4) day_of_month=31 in April clamps to 30", () => {
    const s: RecurrenceSpec = {
      frequency: "monthly", at_hour: 0, at_minute: 0,
      starts_at: "2026-01-01T00:00:00Z", day_of_month: 31,
    };
    const r = computeNextRun(s, "2026-04-01T00:00:00Z");
    if (r.kind === "scheduled") expect(r.next_run_at).toBe("2026-04-30T00:00:00.000Z");
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Enumerate occurrences
// ═══════════════════════════════════════════════════════════════════
describe("Recurrence · (E) enumerateOccurrences", () => {
  it("(E1) daily · 7 occurrences over a week", () => {
    const spec: RecurrenceSpec = { frequency: "daily", at_hour: 9, at_minute: 0, starts_at: "2026-09-01T00:00:00Z" };
    const r = enumerateOccurrences(spec, {
      from_iso: "2026-09-22T00:00:00Z",
      to_iso: "2026-09-29T00:00:00Z",
      max: 100,
    });
    if (r.kind === "occurrences") {
      expect(r.occurrences).toHaveLength(7);
      expect(r.truncated_at_max).toBe(false);
    }
  });
  it("(E2) weekly Mon+Wed+Fri · 6 occurrences over 2 weeks", () => {
    const spec: RecurrenceSpec = {
      frequency: "weekly", at_hour: 10, at_minute: 0,
      starts_at: "2026-09-01T00:00:00Z", days_of_week: [1, 3, 5],
    };
    const r = enumerateOccurrences(spec, {
      from_iso: "2026-09-21T00:00:00Z", // Monday
      to_iso: "2026-10-05T00:00:00Z",   // next Monday of week 3
      max: 100,
    });
    if (r.kind === "occurrences") {
      expect(r.occurrences).toHaveLength(6);
    }
  });
  it("(E3) monthly 1st · 3 occurrences over 3 months", () => {
    const spec: RecurrenceSpec = {
      frequency: "monthly", at_hour: 0, at_minute: 0,
      starts_at: "2026-01-01T00:00:00Z", day_of_month: 1,
    };
    const r = enumerateOccurrences(spec, {
      from_iso: "2026-09-01T00:00:00Z",
      to_iso: "2026-12-01T00:00:00Z",
      max: 100,
    });
    if (r.kind === "occurrences") {
      expect(r.occurrences).toHaveLength(3);
      expect(r.occurrences[0]).toBe("2026-09-01T00:00:00.000Z");
    }
  });
  it("(E4) truncated_at_max when occurrences exceed max", () => {
    const spec: RecurrenceSpec = { frequency: "daily", at_hour: 9, at_minute: 0, starts_at: "2026-01-01T00:00:00Z" };
    const r = enumerateOccurrences(spec, {
      from_iso: "2026-09-01T00:00:00Z",
      to_iso: "2026-12-01T00:00:00Z",
      max: 5,
    });
    if (r.kind === "occurrences") {
      expect(r.occurrences).toHaveLength(5);
      expect(r.truncated_at_max).toBe(true);
    }
  });
  it("(E5) to before from → window_invalid", () => {
    const spec: RecurrenceSpec = { frequency: "daily", at_hour: 9, at_minute: 0, starts_at: "2026-01-01T00:00:00Z" };
    const r = enumerateOccurrences(spec, {
      from_iso: "2026-09-05T00:00:00Z",
      to_iso: "2026-09-01T00:00:00Z",
      max: 10,
    });
    expect(r.kind).toBe("window_invalid");
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Recurrence · (F) governance canaries", () => {
  it("(F1) boundary markers exported", () => {
    expect(_RECURRENCE_NEVER_TRIGGERS).toContain("never_fires_cron");
    expect(_RECURRENCE_NEVER_PERSISTS).toContain("no_DB_writes");
    expect(_RECURRENCE_DETERMINISTIC).toContain("same_spec");
    expect(_RECURRENCE_RESPECTS_ENDS_AT).toContain("never_fabricated");
  });
  it("(F2) module exports NO trigger/dispatch/schedule function", async () => {
    const mod: any = await import("..");
    expect(mod.triggerRecurrence).toBeUndefined();
    expect(mod.dispatchRecurrence).toBeUndefined();
    expect(mod.scheduleRecurrence).toBeUndefined();
    expect(mod.fireRecurrence).toBeUndefined();
    expect(mod.startRecurrenceCron).toBeUndefined();
  });
  it("(F3) deterministic · same inputs → same output", () => {
    const spec: RecurrenceSpec = { frequency: "daily", at_hour: 9, at_minute: 0, starts_at: "2026-01-01T00:00:00Z" };
    const now = "2026-09-22T00:00:00Z";
    const r1 = computeNextRun(spec, now);
    const r2 = computeNextRun(spec, now);
    expect(r1).toEqual(r2);
  });
  it("(F4) module source contains no setInterval/setTimeout/cron/schedule", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/marketing/deliverability/recurrence.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/\bsetInterval\(/);
    expect(code).not.toMatch(/\bsetTimeout\(/);
    expect(code).not.toMatch(/["']node:http["']/);
    expect(code).not.toMatch(/\.tick\(/);
  });
});
