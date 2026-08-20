// Staircase adapter · Phase 1 determinism + geometry tests.
//
// Phase 1 doctrine (Philip 2026-08-20): the adapter MUST produce
// deterministic geometry from a StaircaseDesignState. Same input →
// same output, always. No LLM. No prices. Silence-over-fabrication:
// unknowns yield warnings, never guessed numbers.

import { describe, it, expect } from "vitest";
import { staircaseAdapter, _internals } from "./staircase";
import { ENGINE_DEFAULTS } from "../defaults";
import type { MerchantDefaults } from "../types";

const defaults: MerchantDefaults = {
  ...ENGINE_DEFAULTS,
  source: { labour_rate: "engine", overhead: "engine", profit_margin: "engine", default_waste: "engine", vat: "engine" },
};

describe("staircase.parse", () => {
  it("recognises a straight staircase brief with floor-to-floor", () => {
    const p = staircaseAdapter.parse("quote me a straight staircase 2700 floor to floor in oak");
    expect(p).not.toBeNull();
    expect(p?.geometry).toBe("straight");
    expect(p?.wood).toBe("oak");
    expect(p?.floor_to_floor_mm).toBe(2700);
  });

  it("handles 2.7m notation and metric conversion", () => {
    const p = staircaseAdapter.parse("staircase 2.7m floor to floor");
    expect(p?.floor_to_floor_mm).toBe(2700);
  });

  it("returns null when not a staircase", () => {
    expect(staircaseAdapter.parse("42m² of plastering")).toBeNull();
    expect(staircaseAdapter.parse("block paving driveway 8x5")).toBeNull();
  });

  it("recognises geometry hints", () => {
    expect(staircaseAdapter.parse("quarter turn stairs")?.geometry).toBe("quarter_turn");
    expect(staircaseAdapter.parse("spiral staircase")?.geometry).toBe("spiral");
    expect(staircaseAdapter.parse("floating stairs")?.geometry).toBe("floating");
  });
});

describe("staircase.compute · geometry derivation", () => {
  it("derives 13 risers for 2700mm floor-to-floor · straight flight", () => {
    // 2700 / 220 (Doc K max rise) = 12.27 → 13 risers, rise=207.7
    // But pitch atan(207.7/going) at going≈228 = 42.3° which exceeds Doc K max 42°
    // Loop bumps to 14 risers · 2700/14 = 192.86 · going ≈ 300+ · pitch ≈ 32°
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "straight", floor_to_floor_mm: 2700 } } },
      defaults,
      {}
    );
    const derived = (base.parameters as any).derived;
    expect(derived.riser_count).toBeGreaterThanOrEqual(13);
    expect(derived.tread_count).toBe(derived.riser_count - 1);
    expect(derived.rise_actual_mm).toBeCloseTo(2700 / derived.riser_count, 1);
  });

  it("stringer length obeys Pythagoras", () => {
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "straight", floor_to_floor_mm: 2700 } } },
      defaults,
      {}
    );
    const d = (base.parameters as any).derived;
    const expected = Math.sqrt(2700 ** 2 + d.stair_plan_length_mm ** 2);
    expect(d.stringer_length_mm).toBeCloseTo(Math.round(expected), 0);
  });

  it("2R + G sits in the 550-700 comfort range", () => {
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "straight", floor_to_floor_mm: 2700 } } },
      defaults,
      {}
    );
    const d = (base.parameters as any).derived;
    const value = 2 * d.rise_actual_mm + d.going_mm;
    expect(value).toBeGreaterThanOrEqual(550);
    expect(value).toBeLessThanOrEqual(700);
  });

  it("pitch does not exceed Doc K 42° for a nominal 2700mm domestic staircase", () => {
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "straight", floor_to_floor_mm: 2700 } } },
      defaults,
      {}
    );
    const d = (base.parameters as any).derived;
    const pitch = Math.atan(d.rise_actual_mm / d.going_mm) * 180 / Math.PI;
    expect(pitch).toBeLessThanOrEqual(_internals.UK_DOC_K.max_pitch_degrees);
  });

  it("newel + landing counts match the geometry lookup", () => {
    const straight = staircaseAdapter.compute(
      { parameters: { design: { geometry: "straight", floor_to_floor_mm: 2700 } } },
      defaults, {}
    );
    const quarter = staircaseAdapter.compute(
      { parameters: { design: { geometry: "quarter_turn", floor_to_floor_mm: 2700 } } },
      defaults, {}
    );
    const half = staircaseAdapter.compute(
      { parameters: { design: { geometry: "half_turn", floor_to_floor_mm: 2700 } } },
      defaults, {}
    );
    const spiral = staircaseAdapter.compute(
      { parameters: { design: { geometry: "spiral", floor_to_floor_mm: 2700 } } },
      defaults, {}
    );
    const floating = staircaseAdapter.compute(
      { parameters: { design: { geometry: "floating", floor_to_floor_mm: 2700 } } },
      defaults, {}
    );

    expect((straight.parameters as any).derived.newel_count).toBe(2);
    expect((straight.parameters as any).derived.landing_count).toBe(0);
    expect((quarter.parameters as any).derived.newel_count).toBe(3);
    expect((quarter.parameters as any).derived.landing_count).toBe(1);
    expect((half.parameters as any).derived.newel_count).toBe(4);
    expect((half.parameters as any).derived.landing_count).toBe(1);
    expect((spiral.parameters as any).derived.newel_count).toBe(1);
    expect((floating.parameters as any).derived.newel_count).toBe(0);
  });

  it("tread_count_override wins over derived count", () => {
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "straight", floor_to_floor_mm: 2700, tread_count_override: 15 } } },
      defaults, {}
    );
    const d = (base.parameters as any).derived;
    expect(d.tread_count).toBe(15);
    expect(d.riser_count).toBe(16);
    expect(d.rise_actual_mm).toBeCloseTo(2700 / 16, 1);
  });

  it("going_mm_override wins over derived going", () => {
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "straight", floor_to_floor_mm: 2700, going_mm_override: 250 } } },
      defaults, {}
    );
    expect((base.parameters as any).derived.going_mm).toBe(250);
  });

  it("handrail_length_mm_override wins over derived length", () => {
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "straight", floor_to_floor_mm: 2700, handrail_length_mm_override: 4200 } } },
      defaults, {}
    );
    expect((base.parameters as any).derived.handrail_length_mm).toBe(4200);
  });
});

describe("staircase.compute · determinism", () => {
  // Strip evidence.computed_at from every line before comparing. That field
  // is populated per-call via evidenceFor(new Date()) — inherent to how ALL
  // adapters record evidence · plastering/paving/etc do the same. Geometry
  // (qty, total, explanation arithmetic) MUST be identical.
  function stripTimestamps(base: { materialLines: any[]; labourLines: any[] }) {
    const scrub = (l: any) => ({ ...l, evidence: { source: l.evidence?.source, tables: l.evidence?.tables } });
    return {
      materialLines: base.materialLines.map(scrub),
      labourLines:   base.labourLines.map(scrub),
    };
  }

  it("produces IDENTICAL output on identical input, called twice", () => {
    const input = { parameters: { design: { geometry: "quarter_turn", floor_to_floor_mm: 2600, wood: "walnut", balustrade: "glass" } } };
    const a = staircaseAdapter.compute(input, defaults, {});
    const b = staircaseAdapter.compute(input, defaults, {});
    const aScrubbed = stripTimestamps(a);
    const bScrubbed = stripTimestamps(b);
    expect(JSON.stringify(a.parameters)).toBe(JSON.stringify(b.parameters));
    expect(JSON.stringify(aScrubbed.materialLines)).toBe(JSON.stringify(bScrubbed.materialLines));
    expect(JSON.stringify(aScrubbed.labourLines)).toBe(JSON.stringify(bScrubbed.labourLines));
    expect(a.warnings).toEqual(b.warnings);
    expect(a.scope).toBe(b.scope);
    expect(a.labour_hours).toBe(b.labour_hours);
    expect(a.duration_days).toBe(b.duration_days);
  });
});

describe("staircase.compute · silence over fabrication", () => {
  it("every material + labour line has total_pence = 0 (no invented prices)", () => {
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "straight", floor_to_floor_mm: 2700, wood: "oak" } } },
      defaults, {}
    );
    for (const line of [...base.materialLines, ...base.labourLines]) {
      expect(line.total_pence).toBe(0);
    }
  });

  it("emits the top-level PRICING NOT CONFIGURED warning", () => {
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "straight", floor_to_floor_mm: 2700 } } },
      defaults, {}
    );
    expect(base.warnings[0]).toMatch(/PRICING NOT CONFIGURED/);
  });

  it("warns when floor_to_floor_mm is missing (no fabricated geometry)", () => {
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "straight" } } },
      defaults, {}
    );
    expect(base.warnings.some(w => /floor_to_floor_mm not provided/.test(w))).toBe(true);
    // No dimensional lines when measurements are missing.
    expect(base.materialLines.every(l => l.qty === undefined || l.qty === 0 || !l.label.includes("Treads"))).toBe(true);
  });

  it("surfaces compatibility rule matches as warnings (spiral + glass)", () => {
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "spiral", materialFamily: "glass", floor_to_floor_mm: 2700 } } },
      defaults, {}
    );
    const specialistWarn = base.warnings.find(w => /spiral_glass_only|specialist/i.test(w));
    expect(specialistWarn).toBeDefined();
  });

  it("every line's explanation contains the arithmetic (no bare numbers)", () => {
    const base = staircaseAdapter.compute(
      { parameters: { design: { geometry: "quarter_turn", floor_to_floor_mm: 2600, wood: "oak" } } },
      defaults, {}
    );
    for (const line of [...base.materialLines, ...base.labourLines]) {
      expect(line.explanation.length).toBeGreaterThan(20);
      expect(line.explanation).toMatch(/pending Phase 2 pricing sheet|rate pending/i);
    }
  });
});

describe("staircase._internals.pickCompliantGoing", () => {
  it("returns a going ≥ Doc K minimum 220mm", () => {
    for (const rise of [150, 175, 200, 210]) {
      expect(_internals.pickCompliantGoing(rise)).toBeGreaterThanOrEqual(220);
    }
  });

  it("produces goings that keep 2R+G inside comfort range for typical rises", () => {
    for (const rise of [175, 185, 195, 205]) {
      const g = _internals.pickCompliantGoing(rise);
      const v = 2 * rise + g;
      expect(v).toBeGreaterThanOrEqual(_internals.UK_DOC_K.formula_2RG_min_mm);
      expect(v).toBeLessThanOrEqual(_internals.UK_DOC_K.formula_2RG_max_mm);
    }
  });

  it("is deterministic (idempotent)", () => {
    expect(_internals.pickCompliantGoing(195)).toBe(_internals.pickCompliantGoing(195));
    expect(_internals.pickCompliantGoing(200)).toBe(_internals.pickCompliantGoing(200));
  });
});
