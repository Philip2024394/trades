// Regression tests for scripts/nex-discovery-rotation/_rotation-tick.mjs
//
// Locks in the SLIDING-COOLDOWN FIX shipped 2026-08-27 (Philip approved
// after root-cause report proved rotation-tick was refreshing cooldown_until
// to now()+6h on every 10-min tick, permanently locking all 34 food+accom
// surfaces in `saturated` state and blocking every discovery walker).
//
// The evaluator MUST:
//   · preserve cooldown_until unchanged when currentState is already
//     "saturated" AND cooldown_until is still in the future
//   · only reset cooldown_until on FRESH saturation (build/reactivate →
//     saturated), never on already-saturated pass-throughs
//   · still promote saturated → reactivate the moment cooldown expires
//   · still fresh-saturate a build-state surface whose latest cycles
//     produced ≥3 consecutive zero-new
//
// Philip: "The policy can remain 6 hours. The mistake would simply be
// restarting those six hours every time the controller looks at the surface."

import { describe, it, expect } from "vitest";
import { evaluate } from "./_rotation-tick.mjs";

// Helper · N zero-new cycles newest-first. Started at fixed timestamps so
// the evaluator's ordering is deterministic.
function zeroCycles(n, startMs = Date.parse("2026-08-26T10:00:00Z"), stepMinutes = 30) {
  return Array.from({ length: n }, (_, i) => ({
    id: `cycle-${i}`,
    started_at: new Date(startMs - i * stepMinutes * 60_000).toISOString(),
    finished_at: new Date(startMs - i * stepMinutes * 60_000 + 60_000).toISOString(),
    records_processed: 5,
    records_new: 0,
    status: "completed",
    cycle_outcome: "ALL_DEDUPED",   // saturation-countable
  }));
}

describe("Sliding-cooldown fix · Philip 2026-08-27 · evaluate() pass-through", () => {
  it("saturated surface with active cooldown returns UNCHANGED cooldown_until across repeated ticks", () => {
    // Setup: surface saturated at 12:00Z with cooldown_until = 18:00Z (6h).
    // Simulate rotation-tick firing at 12:10Z, 12:20Z, 12:30Z, 13:00Z, 15:00Z.
    // At every tick cooldown is still in the future. Expected: cooldown_until
    // stays exactly 18:00Z on every tick, state stays "saturated".
    const cooldownUntilOriginal = "2026-08-26T18:00:00.000Z";
    const existing = {
      state: "saturated",
      state_entered_at: "2026-08-26T12:00:00Z",
      cooldown_until: cooldownUntilOriginal,
      reactivation_count: 0,
      consecutive_unproductive_reactivations: 0,
      reactivation_reason: null,
    };
    const cycles = zeroCycles(10);

    const tickTimes = ["12:10", "12:20", "12:30", "13:00", "15:00", "17:59"].map(
      (t) => Date.parse(`2026-08-26T${t}:00Z`),
    );

    for (const nowMs of tickTimes) {
      const result = evaluate(cycles, existing, "food", nowMs);
      expect(result.state, `tick @ ${new Date(nowMs).toISOString()} state`).toBe("saturated");
      expect(result.cooldownUntil, `tick @ ${new Date(nowMs).toISOString()} cooldownUntil not null`).toBeInstanceOf(Date);
      expect(
        result.cooldownUntil.toISOString(),
        `tick @ ${new Date(nowMs).toISOString()} cooldownUntil unchanged`,
      ).toBe(cooldownUntilOriginal);
    }
  });

  it("saturated surface promotes to reactivate the tick AFTER cooldown expires", () => {
    const existing = {
      state: "saturated",
      state_entered_at: "2026-08-26T12:00:00Z",
      cooldown_until: "2026-08-26T18:00:00Z",
      reactivation_count: 0,
      consecutive_unproductive_reactivations: 0,
      reactivation_reason: null,
    };
    const cycles = zeroCycles(10);

    // At 17:59 (1 min before) → still saturated · cooldown preserved
    let result = evaluate(cycles, existing, "food", Date.parse("2026-08-26T17:59:00Z"));
    expect(result.state).toBe("saturated");
    expect(result.cooldownUntil.getTime()).toBe(Date.parse("2026-08-26T18:00:00Z"));

    // At 18:00 (exactly) → promoted to reactivate, cooldown cleared
    result = evaluate(cycles, existing, "food", Date.parse("2026-08-26T18:00:00Z"));
    expect(result.state).toBe("reactivate");
    expect(result.cooldownUntil).toBeNull();
    expect(result.reactivationReason).toBe("cooldown-expired");
    expect(result.reactivationCount).toBe(1);

    // At 18:01 (1 min after) → same promotion decision if row hasn't been updated yet
    result = evaluate(cycles, existing, "food", Date.parse("2026-08-26T18:01:00Z"));
    expect(result.state).toBe("reactivate");
  });

  it("fresh saturation from build state DOES reset cooldown to now()+6h (baseline preserved)", () => {
    // If a surface is in build state and just crossed the 3-consecutive-zero
    // threshold, the evaluator SHOULD set a fresh cooldown_until. The fix
    // must not accidentally suppress this legitimate transition.
    const existing = {
      state: "build",
      state_entered_at: "2026-08-26T10:00:00Z",
      cooldown_until: null,
      reactivation_count: 0,
      consecutive_unproductive_reactivations: 0,
      reactivation_reason: null,
    };
    const cycles = zeroCycles(5);
    const nowMs = Date.parse("2026-08-26T14:00:00Z");
    const result = evaluate(cycles, existing, "food", nowMs);
    expect(result.state).toBe("saturated");
    expect(result.cooldownUntil).toBeInstanceOf(Date);
    expect(result.cooldownUntil.getTime()).toBe(nowMs + 6 * 3600 * 1000);
  });

  it("build state with productive latest cycle stays build (not affected by fix)", () => {
    const existing = {
      state: "build",
      state_entered_at: "2026-08-26T10:00:00Z",
      cooldown_until: null,
      reactivation_count: 0,
      consecutive_unproductive_reactivations: 0,
      reactivation_reason: null,
    };
    // Latest cycle newest-first has 7 records_new, so consecutiveZero = 0.
    const productive = [
      {
        id: "cycle-productive",
        started_at: "2026-08-26T13:30:00Z",
        finished_at: "2026-08-26T13:31:00Z",
        records_processed: 12,
        records_new: 7,
        status: "completed",
        cycle_outcome: "PERSISTED",
      },
    ];
    const result = evaluate(productive, existing, "food", Date.parse("2026-08-26T14:00:00Z"));
    expect(result.state).toBe("build");
    expect(result.cooldownUntil).toBeNull();
  });

  it("saturated surface with NULL cooldown gets backfilled (fix doesn't suppress backfill)", () => {
    // Legacy pre-P3 rows had state='saturated' + cooldown_until=NULL. The
    // backfill branch (line ~139) must still fire — our pass-through
    // requires cooldownUntil to be truthy.
    const existing = {
      state: "saturated",
      state_entered_at: "2026-08-25T10:00:00Z",
      cooldown_until: null,   // legacy NULL
      reactivation_count: 0,
      consecutive_unproductive_reactivations: 0,
      reactivation_reason: null,
    };
    const cycles = zeroCycles(5);
    const nowMs = Date.parse("2026-08-26T14:00:00Z");
    const result = evaluate(cycles, existing, "food", nowMs);
    expect(result.state).toBe("saturated");
    expect(result.reactivationReason).toBe("cooldown-defaulted");
    expect(result.cooldownUntil).toBeInstanceOf(Date);
    expect(result.cooldownUntil.getTime()).toBe(nowMs + 6 * 3600 * 1000);
  });

  it("reactivate state waiting for first cycle stays reactivate (fix doesn't suppress wait)", () => {
    const stateEnteredAt = "2026-08-26T14:00:00Z";
    const existing = {
      state: "reactivate",
      state_entered_at: stateEnteredAt,
      cooldown_until: null,
      reactivation_count: 1,
      consecutive_unproductive_reactivations: 0,
      reactivation_reason: "cooldown-expired",
    };
    // All cycles are OLDER than state_entered_at → cyclesSinceReactivation = []
    const oldCycles = zeroCycles(5, Date.parse("2026-08-26T12:00:00Z"));
    const result = evaluate(oldCycles, existing, "food", Date.parse("2026-08-26T14:05:00Z"));
    expect(result.state).toBe("reactivate");
    expect(result.reason).toMatch(/awaiting/);
  });
});

// Explicit sliding-cooldown regression · replays the exact bug we shipped
// the fix for. If someone accidentally removes the pass-through branch
// this test will fail immediately.
describe("Sliding-cooldown regression · reproduces the exact 2026-08-27 bug", () => {
  it("100 consecutive rotation-ticks 10min apart never change cooldown_until", () => {
    const cooldownUntilOriginal = "2026-08-26T18:00:00.000Z";
    const existing = {
      state: "saturated",
      state_entered_at: "2026-08-26T12:00:00Z",
      cooldown_until: cooldownUntilOriginal,
      reactivation_count: 0,
      consecutive_unproductive_reactivations: 0,
      reactivation_reason: null,
    };
    const cycles = zeroCycles(20);

    // 100 ticks × 10 min = 1000 min = 16.67 hours simulated.
    // Cooldown expires at 18:00Z (6h after saturation). Start at 12:05Z
    // so the first ~35 ticks fall BEFORE cooldown expiry — those MUST
    // preserve cooldown_until. After 18:00Z the surface should promote.
    const startMs = Date.parse("2026-08-26T12:05:00Z");
    const cooldownExpiryMs = Date.parse(cooldownUntilOriginal);

    let preservedTicks = 0;
    let promotedTick = null;
    for (let i = 0; i < 100; i++) {
      const nowMs = startMs + i * 10 * 60_000;
      const result = evaluate(cycles, existing, "food", nowMs);
      if (nowMs < cooldownExpiryMs) {
        // BEFORE expiry: must preserve cooldown, stay saturated
        expect(result.state, `tick ${i} @ ${new Date(nowMs).toISOString()}`).toBe("saturated");
        expect(result.cooldownUntil.toISOString(), `tick ${i}`).toBe(cooldownUntilOriginal);
        preservedTicks++;
      } else {
        // AFTER expiry: must promote to reactivate
        expect(result.state, `tick ${i} @ ${new Date(nowMs).toISOString()}`).toBe("reactivate");
        if (promotedTick === null) promotedTick = i;
      }
    }
    // Sanity: cooldown expires at 18:00, we started at 12:05, ticks every
    // 10 min → 35 ticks before expiry (12:05, 12:15, ..., 17:55) then
    // tick 36 at 18:05 promotes.
    expect(preservedTicks).toBe(36);
    expect(promotedTick).toBe(36);
  });
});
