// src/lib/nex/brain/plan-from-world.test.ts
//
// Stage 3.35 · Phase D · Multi-step planning doctrine tests
// (Philip 2026-08-31).
//
// Constitutional rule:
//   A downstream step must NEVER consume an unverified assumption
//   from an upstream step.
//
// Locks in:
//   · detectMultiStep splits on sequence connectors (then · lalu · dst)
//   · parsePlanSteps returns per-substring vertical + slots
//   · transport step declares coordinates requirement from prior step
//   · executePlan runs sequentially · verifies each requirement · BLOCKS
//     downstream when required upstream evidence missing
//   · cascade skip: blocked step causes subsequent steps to skip
//   · never guesses coords/city when upstream pick lacks them
//   · allCompleted only true when every step completed

import { describe, expect, it } from "vitest";
import {
  detectMultiStep,
  parsePlanSteps,
  executePlan,
} from "./plan-from-world";
import type { WorldRecord, WorldVertical } from "./world-adapters/types";

function rec(o: Partial<WorldRecord> & { id: string; name: string; vertical?: WorldVertical }): WorldRecord {
  return {
    vertical: o.vertical ?? "accommodation",
    market: "ID",
    category: "hotel",
    city: "Yogyakarta",
    provenance: { sourceKey: "test", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
    ...o,
  };
}

// ─── detectMultiStep ─────────────────────────────────────────────────

describe("detectMultiStep", () => {
  it("splits on 'then' · EN", () => {
    expect(detectMultiStep("find me a hotel tonight, then transport to the airport tomorrow"))
      .toEqual(["find me a hotel tonight,", "transport to the airport tomorrow"]);
  });

  it("splits on 'lalu' · ID", () => {
    expect(detectMultiStep("cari hotel malam ini, lalu transport ke bandara besok"))
      .toEqual(["cari hotel malam ini,", "transport ke bandara besok"]);
  });

  it("splits on 'after that'", () => {
    expect(detectMultiStep("find me a restaurant, after that find a driver"))
      .toEqual(["find me a restaurant,", "find a driver"]);
  });

  it("no sequence connector → empty", () => {
    expect(detectMultiStep("find me a hotel in Yogyakarta")).toEqual([]);
  });
});

// ─── parsePlanSteps ──────────────────────────────────────────────────

describe("parsePlanSteps", () => {
  it("hotel then transport → 2 steps · transport requires coordinates from step 1", () => {
    const steps = parsePlanSteps("find me a hotel in Yogyakarta tonight, then transport from the hotel to the airport");
    expect(steps).toHaveLength(2);
    expect(steps[0].vertical).toBe("accommodation");
    expect(steps[0].slots.city).toBe("Yogyakarta");
    expect(steps[0].slots.when).toBe("tonight");
    expect(steps[1].vertical).toBe("transport");
    expect(steps[1].requiredInputs).toHaveLength(1);
    expect(steps[1].requiredInputs[0]).toEqual({ from: "step1", field: "coordinates", usedAs: "origin" });
  });

  it("Indonesian 'cari hotel malam ini, lalu transport' also parses", () => {
    const steps = parsePlanSteps("cari hotel di jogja malam ini, lalu transport ke bandara");
    expect(steps).toHaveLength(2);
    expect(steps[0].vertical).toBe("accommodation");
    expect(steps[1].vertical).toBe("transport");
    expect(steps[1].requiredInputs[0].field).toBe("coordinates");
  });

  it("restaurant then service → 2 steps · service has no coordinate dependency (only transport chains coords)", () => {
    const steps = parsePlanSteps("find me a restaurant, then find a dentist");
    expect(steps).toHaveLength(2);
    expect(steps[0].vertical).toBe("food");
    expect(steps[1].vertical).toBe("service");
    expect(steps[1].requiredInputs).toEqual([]);
  });

  it("single step → empty", () => {
    expect(parsePlanSteps("find me a hotel")).toEqual([]);
  });
});

// ─── executePlan · sequential execution + block doctrine ────────────

describe("executePlan · sequential execution", () => {
  it("all steps complete → allCompleted:true · reply lists picks", async () => {
    const steps = parsePlanSteps("find me a hotel in yogyakarta, then transport from the hotel");
    const hotelPick     = rec({ id: "h1", name: "Griya Sentana", vertical: "accommodation", latitude: -7.79, longitude: 110.36 });
    const transportPick = rec({ id: "t1", name: "Budi (Driver)", vertical: "transport" });
    const out = await executePlan({
      steps,
      stepExecutor: async (step) => {
        if (step.vertical === "accommodation") return { records: [hotelPick], pick: hotelPick };
        return { records: [transportPick], pick: transportPick };
      },
    });
    expect(out.planned).toBe(true);
    if (out.planned) {
      expect(out.allCompleted).toBe(true);
      expect(out.steps).toHaveLength(2);
      expect(out.steps[0].status.kind).toBe("completed");
      expect(out.steps[1].status.kind).toBe("completed");
      expect(out.replyText.en).toContain("Griya Sentana");
      expect(out.replyText.en).toContain("Budi (Driver)");
    }
  });
});

describe("executePlan · BLOCK downstream when upstream evidence missing", () => {
  it("hotel picked but coords null → transport BLOCKED · never guesses coords", async () => {
    const steps = parsePlanSteps("find me a hotel in yogyakarta, then transport from the hotel");
    const hotelPick = rec({ id: "h1", name: "NoCoords Inn", vertical: "accommodation" }); // NO lat/lng
    const out = await executePlan({
      steps,
      stepExecutor: async (step) => {
        if (step.vertical === "accommodation") return { records: [hotelPick], pick: hotelPick };
        return { records: [rec({ id: "t1", name: "Driver X", vertical: "transport" })] };
      },
    });
    expect(out.planned).toBe(true);
    if (out.planned) {
      expect(out.allCompleted).toBe(false);
      expect(out.steps[0].status.kind).toBe("completed");
      const step2Status = out.steps[1].status;
      expect(step2Status.kind).toBe("blocked");
      if (step2Status.kind === "blocked") {
        expect(step2Status.blockingField).toBe("coordinates");
        expect(step2Status.reason).toContain("no coordinates published");
      }
      expect(out.replyText.en).toContain("BLOCKED");
      expect(out.replyText.en).toContain("no coordinates published");
      expect(out.replyText.en).toContain("I never guess");
    }
  });

  it("upstream step no_matches → downstream skipped", async () => {
    const steps = parsePlanSteps("find me a hotel in yogyakarta, then transport from the hotel");
    const out = await executePlan({
      steps,
      stepExecutor: async (step) => {
        if (step.vertical === "accommodation") return { records: [] }; // 0 matches
        return { records: [rec({ id: "t1", name: "Driver X", vertical: "transport" })] };
      },
    });
    if (out.planned) {
      expect(out.allCompleted).toBe(false);
      expect(out.steps[0].status.kind).toBe("no_matches");
      expect(out.steps[1].status.kind).toBe("skipped");
    }
  });

  it("upstream step throws → downstream cascade-blocked", async () => {
    const steps = parsePlanSteps("find me a hotel, then transport from the hotel");
    const out = await executePlan({
      steps,
      stepExecutor: async (step) => {
        if (step.vertical === "accommodation") throw new Error("db down");
        return { records: [] };
      },
    });
    if (out.planned) {
      expect(out.steps[0].status.kind).toBe("blocked");
      expect(out.steps[1].status.kind).toBe("skipped");
    }
  });
});

describe("executePlan · edge cases", () => {
  it("zero steps → planned:false · no_steps_extracted", async () => {
    const out = await executePlan({ steps: [], stepExecutor: async () => ({ records: [] }) });
    expect(out.planned).toBe(false);
    if (!out.planned) expect(out.reason).toBe("no_steps_extracted");
  });

  it("single step → planned:false · single_step_only (use regular flow instead)", async () => {
    const singleStep = parsePlanSteps("find me a hotel then transport");
    // Use just the first step
    const out = await executePlan({ steps: [singleStep[0]], stepExecutor: async () => ({ records: [] }) });
    expect(out.planned).toBe(false);
    if (!out.planned) expect(out.reason).toBe("single_step_only");
  });
});

describe("executePlan · doctrine · never guesses required coordinates", () => {
  it("hotel pick has coords · transport gets coords for origin (verified use)", async () => {
    const steps = parsePlanSteps("find me a hotel in yogyakarta, then transport from the hotel");
    const hotelPick = rec({ id: "h1", name: "Real Hotel", vertical: "accommodation", latitude: -7.79, longitude: 110.36, city: "Yogyakarta" });
    let transportSawUpstream: WorldRecord | undefined;
    const out = await executePlan({
      steps,
      stepExecutor: async (step, priorPicks) => {
        if (step.vertical === "accommodation") return { records: [hotelPick], pick: hotelPick };
        // Capture what transport step saw
        transportSawUpstream = priorPicks["step1"];
        return { records: [rec({ id: "t1", name: "D", vertical: "transport" })] };
      },
    });
    if (out.planned) {
      expect(out.allCompleted).toBe(true);
      // Transport step SAW the verified upstream pick with real coords
      expect(transportSawUpstream?.latitude).toBe(-7.79);
      expect(transportSawUpstream?.longitude).toBe(110.36);
    }
  });
});
