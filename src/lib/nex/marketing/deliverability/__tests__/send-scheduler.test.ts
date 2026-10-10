// src/lib/nex/marketing/deliverability/__tests__/send-scheduler.test.ts
//
// NEX Deliverability · Send Scheduler acceptance
// Founder-authorised programme · Session-12 · Part 11f · 2026-09-21.

import { describe, it, expect } from "vitest";
import {
  computeSendSchedule, REPUTATION_CEILING_MULTIPLIER,
  _SCHEDULER_NEVER_SENDS, _SCHEDULER_NEVER_QUEUES,
  _SCHEDULER_REPUTATION_HARD_BLOCKS, _SCHEDULER_DETERMINISTIC,
  type SendSchedulerInput,
} from "..";

const START = "2026-09-21T09:00:00.000Z";

function base(overrides: Partial<SendSchedulerInput> = {}): SendSchedulerInput {
  return {
    sender_id: "sender-1",
    reputation_state: "healthy",
    requested_units: 100,
    window_hours: 4,
    per_hour_cap: 50,
    start_at: START,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// A · Basic distribution
// ═══════════════════════════════════════════════════════════════════
describe("Send scheduler · (A) basic distribution", () => {
  it("(A1) healthy sender · request within ceiling → full amount scheduled", () => {
    const r = computeSendSchedule(base({ requested_units: 100 }));
    expect(r.kind).toBe("scheduled");
    if (r.kind === "scheduled") {
      expect(r.total_scheduled).toBe(100);
      expect(r.ceiling_units).toBe(200); // 50/hr * 4hr * 1.0
      expect(r.slots.length).toBeGreaterThan(0);
      const distributed = r.slots.reduce((a, s) => a + s.units, 0);
      expect(distributed).toBe(100);
    }
  });

  it("(A2) request exceeds ceiling → capped to ceiling", () => {
    const r = computeSendSchedule(base({ requested_units: 1000 }));
    if (r.kind === "scheduled") {
      expect(r.total_scheduled).toBe(200); // capped to 50*4
      expect(r.reason).toMatch(/capped_to_ceiling/);
    }
  });

  it("(A3) zero requested → zero slots · outcome=scheduled(0)", () => {
    const r = computeSendSchedule(base({ requested_units: 0 }));
    if (r.kind === "scheduled") {
      expect(r.total_scheduled).toBe(0);
      expect(r.slots).toHaveLength(0);
    }
  });

  it("(A4) slots ordered chronologically", () => {
    const r = computeSendSchedule(base({ requested_units: 200 }));
    if (r.kind === "scheduled") {
      const times = r.slots.map(s => Date.parse(s.scheduled_at));
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]!);
      }
    }
  });

  it("(A5) slot hour_bucket matches actual hour offset from start", () => {
    const start_ms = Date.parse(START);
    const r = computeSendSchedule(base({ requested_units: 200 }));
    if (r.kind === "scheduled") {
      for (const s of r.slots) {
        const offset_h = Math.floor((Date.parse(s.scheduled_at) - start_ms) / 3_600_000);
        expect(s.hour_bucket).toBe(offset_h);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Reputation-aware ceiling
// ═══════════════════════════════════════════════════════════════════
describe("Send scheduler · (B) reputation-aware ceiling", () => {
  it("(B1) healthy multiplier = 1.0 · full cap", () => {
    expect(REPUTATION_CEILING_MULTIPLIER.healthy).toBe(1.00);
  });
  it("(B2) watch multiplier = 0.75 · per-hour floored conservatively", () => {
    expect(REPUTATION_CEILING_MULTIPLIER.watch).toBe(0.75);
    const r = computeSendSchedule(base({ reputation_state: "watch", requested_units: 200 }));
    if (r.kind === "scheduled") {
      // floor(50 * 0.75) = 37 per hour · 37 * 4 hours = 148
      expect(r.ceiling_units).toBe(148);
      expect(r.total_scheduled).toBe(148);
    }
  });
  it("(B3) warning multiplier = 0.50 · schedule halved", () => {
    expect(REPUTATION_CEILING_MULTIPLIER.warning).toBe(0.50);
    const r = computeSendSchedule(base({ reputation_state: "warning", requested_units: 200 }));
    if (r.kind === "scheduled") {
      expect(r.ceiling_units).toBe(100); // 50 * 0.5 = 25/hr · 25 * 4 = 100
    }
  });
  it("(B4) limited → hard block · reputation_hold outcome · zero slots", () => {
    const r = computeSendSchedule(base({ reputation_state: "limited" }));
    expect(r.kind).toBe("reputation_hold");
    if (r.kind === "reputation_hold") expect(r.reputation_state).toBe("limited");
  });
  it("(B5) frozen → hard block · reputation_hold outcome", () => {
    const r = computeSendSchedule(base({ reputation_state: "frozen" }));
    expect(r.kind).toBe("reputation_hold");
  });
  it("(B6) unknown treated conservatively as 0.75", () => {
    expect(REPUTATION_CEILING_MULTIPLIER.unknown).toBe(0.75);
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Per-hour cap enforcement
// ═══════════════════════════════════════════════════════════════════
describe("Send scheduler · (C) per-hour cap enforcement", () => {
  it("(C1) no single hour exceeds effective_hourly_cap", () => {
    const r = computeSendSchedule(base({ requested_units: 200, per_hour_cap: 50, window_hours: 4 }));
    if (r.kind === "scheduled") {
      const per_hour: Record<number, number> = {};
      for (const s of r.slots) per_hour[s.hour_bucket] = (per_hour[s.hour_bucket] ?? 0) + s.units;
      for (const [h, u] of Object.entries(per_hour)) {
        expect(u).toBeLessThanOrEqual(50);
      }
    }
  });
  it("(C2) max_slot_size respected · no single slot exceeds 50 units default", () => {
    const r = computeSendSchedule(base({ requested_units: 200, per_hour_cap: 200 }));
    if (r.kind === "scheduled") {
      for (const s of r.slots) expect(s.units).toBeLessThanOrEqual(50);
    }
  });
  it("(C3) custom max_slot_size overrides default", () => {
    const r = computeSendSchedule(base({ requested_units: 100, per_hour_cap: 100, max_slot_size: 10 }));
    if (r.kind === "scheduled") {
      for (const s of r.slots) expect(s.units).toBeLessThanOrEqual(10);
    }
  });
  it("(C4) per_hour_cap=0 → no_capacity", () => {
    const r = computeSendSchedule(base({ per_hour_cap: 0 }));
    expect(r.kind).toBe("no_capacity");
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Determinism (jitter seeded by sender_id)
// ═══════════════════════════════════════════════════════════════════
describe("Send scheduler · (D) determinism", () => {
  it("(D1) same inputs produce identical schedule", () => {
    const r1 = computeSendSchedule(base({ requested_units: 150 }));
    const r2 = computeSendSchedule(base({ requested_units: 150 }));
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
  it("(D2) different sender_ids produce different schedules (jitter divergence)", () => {
    const r1 = computeSendSchedule(base({ sender_id: "a", requested_units: 150 }));
    const r2 = computeSendSchedule(base({ sender_id: "b", requested_units: 150 }));
    if (r1.kind === "scheduled" && r2.kind === "scheduled") {
      const times_a = r1.slots.map(s => s.scheduled_at);
      const times_b = r2.slots.map(s => s.scheduled_at);
      expect(times_a).not.toEqual(times_b);
      // But total_scheduled and unit counts are identical
      expect(r1.total_scheduled).toBe(r2.total_scheduled);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Input validation
// ═══════════════════════════════════════════════════════════════════
describe("Send scheduler · (E) input validation", () => {
  it("(E1) negative requested_units → invalid_input", () => {
    const r = computeSendSchedule(base({ requested_units: -1 }));
    expect(r.kind).toBe("invalid_input");
  });
  it("(E2) zero window_hours → invalid_input", () => {
    const r = computeSendSchedule(base({ window_hours: 0 }));
    expect(r.kind).toBe("invalid_input");
  });
  it("(E3) non-ISO start_at → invalid_input", () => {
    const r = computeSendSchedule(base({ start_at: "not-a-date" }));
    expect(r.kind).toBe("invalid_input");
  });
  it("(E4) negative per_hour_cap → invalid_input", () => {
    const r = computeSendSchedule(base({ per_hour_cap: -5 }));
    expect(r.kind).toBe("invalid_input");
  });
  it("(E5) NaN inputs → invalid_input", () => {
    const r = computeSendSchedule(base({ requested_units: Number.NaN }));
    expect(r.kind).toBe("invalid_input");
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Send scheduler · (F) governance canaries", () => {
  it("(F1) boundary markers exported", () => {
    expect(_SCHEDULER_NEVER_SENDS).toContain("never_transmits_email");
    expect(_SCHEDULER_NEVER_QUEUES).toContain("never_writes_to_send_queue");
    expect(_SCHEDULER_REPUTATION_HARD_BLOCKS).toContain("no_bypass");
    expect(_SCHEDULER_DETERMINISTIC).toContain("seeded_by_sender_id");
  });
  it("(F2) module exports NO send/queue/dispatch function", async () => {
    const mod: any = await import("..");
    // Scheduler-related exports NEVER include the send-side verbs
    expect(mod.dispatchSchedule).toBeUndefined();
    expect(mod.executeSchedule).toBeUndefined();
    expect(mod.sendScheduledBatch).toBeUndefined();
    expect(mod.enqueueSchedule).toBeUndefined();
    expect(mod.transmitSlot).toBeUndefined();
    expect(mod.forceSchedule).toBeUndefined();
    expect(mod.bypassReputation).toBeUndefined();
  });
  it("(F3) limited and frozen states have multiplier=0 · verified structurally", () => {
    expect(REPUTATION_CEILING_MULTIPLIER.limited).toBe(0);
    expect(REPUTATION_CEILING_MULTIPLIER.frozen).toBe(0);
  });
  it("(F4) module source contains no fetch/http/https/mailer references", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/marketing/deliverability/send-scheduler.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/["']node:http["']/);
    expect(code).not.toMatch(/nodemailer/i);
    expect(code).not.toMatch(/sendMail\(/);
    expect(code).not.toMatch(/\.send\(/); // no SMTP-style transmit calls
  });
});
