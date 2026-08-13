// Image Critic Brain · tests.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { critique, CRITIQUE_DIMENSIONS } from "./index";

describe("Image Critic Brain", () => {
  it("declares 10 dimensions", () => {
    expect(CRITIQUE_DIMENSIONS).toHaveLength(10);
  });

  it("empty context produces baseline overall > 70", () => {
    const r = critique({});
    expect(r.scores).toHaveLength(10);
    expect(r.overall_score).toBeGreaterThan(70);
  });

  it("grammar violations penalise typography + marketing", () => {
    const r = critique({ grammar_violations: [{ severity: "warn", rule: "luxury.headline_max_words" }, { severity: "warn", rule: "luxury.cta_max_words" }] });
    const typo = r.scores.find((s) => s.dimension === "typography")!;
    expect(typo.score).toBeLessThan(85);
    expect(r.issues.some((i) => i.dimension === "typography")).toBe(true);
  });

  it("reality_advisor.impossible zeroes realism + construction_accuracy", () => {
    const r = critique({ reality_report: { classification: "impossible", scores: { reality_score: 0, construction_score: 0 } } });
    expect(r.scores.find((s) => s.dimension === "realism")?.score).toBe(0);
    expect(r.scores.find((s) => s.dimension === "construction_accuracy")?.score).toBe(0);
    expect(r.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("missing render manifest suggests a theme edit", () => {
    const r = critique({});
    expect(r.suggestions.some((s) => s.dimension === "brand_consistency")).toBe(true);
    expect(r.suggestions[0].edit_command).toMatch(/theme/);
  });

  it("well-specified render manifest lifts brand_consistency", () => {
    const r = critique({ render_manifest: { theme_pack: "luxury_burgundy", font_set: { heading: "Playfair Display", subheading: "Montserrat", body: "Inter", cta: "Montserrat" } } });
    const brand = r.scores.find((s) => s.dimension === "brand_consistency")!;
    expect(brand.score).toBeGreaterThanOrEqual(90);
  });

  it("hero intelligence with safe areas lifts composition + accessibility", () => {
    const r = critique({ hero_intelligence: { safe_areas: [{ kind: "cta" }, { kind: "text" }], focal_point: { x_pct: 50, y_pct: 50 } } });
    const comp = r.scores.find((s) => s.dimension === "composition")!;
    expect(comp.score).toBeGreaterThanOrEqual(90);
  });

  it("overall_score is the mean of all 10 dimensions", () => {
    const r = critique({});
    const mean = Math.round(r.scores.reduce((s, x) => s + x.score, 0) / r.scores.length);
    expect(r.overall_score).toBe(mean);
  });
});
