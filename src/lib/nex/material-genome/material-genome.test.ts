// Material Genome Library · tests.
//
// Doctrine: docs/brains/nex-material-genome-tenth-library-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import {
  get, all, count, reset, reinforce,
  materialsForTrade, materialsForPremiumLevel, pairsWith, materialsCompatibleWithFinish,
  mostRepairable, mostSustainable, query, detectPairingClashes,
  substitutionsFor, substitute, explainRecommendation,
} from "./index";

beforeEach(() => reset());

describe("Material Genome Library", () => {
  it("seeds 15 MaterialDNA records across timber · metal · glass · stone · composite · paint · porcelain · concrete", () => {
    expect(count()).toBe(15);
    const cats = new Set(all().map((m) => m.category));
    expect(cats.has("timber")).toBe(true);
    expect(cats.has("metal")).toBe(true);
    expect(cats.has("glass")).toBe(true);
    expect(cats.has("stone")).toBe(true);
    expect(cats.has("composite")).toBe(true);
    expect(cats.has("paint")).toBe(true);
    expect(cats.has("porcelain")).toBe(true);
    expect(cats.has("concrete")).toBe(true);
  });

  it("every MaterialDNA carries Rule-c provenance + required design intelligence fields", () => {
    for (const m of all()) {
      expect(m.provenance.named_expert).toBe("Philip O'Farrell");
      expect(m.provenance.authored).toBe("2026-08-04");
      expect(m.durability_score).toBeGreaterThan(0);
      expect(m.repairability_score).toBeGreaterThanOrEqual(0);
      expect(m.sustainability_score).toBeGreaterThanOrEqual(0);
      expect(m.premium_level).toBeGreaterThanOrEqual(1);
      expect(m.premium_level).toBeLessThanOrEqual(5);
      expect(m.recommended_applications.length).toBeGreaterThan(0);
      expect(m.compatible_finishes.length).toBeGreaterThan(0);
    }
  });

  it("materialsForTrade(kitchen) surfaces oak · walnut · quartz · brass · paint · porcelain · stainless · glass", () => {
    const kitchen = materialsForTrade("kitchen", "good");
    const ids = kitchen.map((m) => m.material_id);
    expect(ids).toContain("oak_american_white_satin_lacquer");
    expect(ids).toContain("european_walnut_matt_lacquer");
    expect(ids).toContain("quartz_worktop_white");
    expect(ids).toContain("brass_polished");
    expect(ids).toContain("paint_matt_emulsion_white_shaker");
    expect(ids).toContain("porcelain_grey_large_format");
    expect(ids).toContain("stainless_steel_brushed");
    expect(ids).toContain("glass_toughened_10mm");
  });

  it("materialsForTrade(staircase, excellent) surfaces oak · walnut · mahogany · ash · steel · glass · brass NOT included at excellent", () => {
    const excellent = materialsForTrade("staircase", "excellent");
    const ids = excellent.map((m) => m.material_id);
    expect(ids).toContain("oak_american_white_satin_lacquer");
    expect(ids).toContain("european_walnut_matt_lacquer");
    expect(ids).toContain("mahogany_polished");
    expect(ids).toContain("ash_white");
    expect(ids).toContain("glass_toughened_10mm");
    // brass_polished is "good" for staircase not "excellent"
    expect(ids).not.toContain("brass_polished");
  });

  it("materialsForPremiumLevel(5) surfaces flagship materials only", () => {
    const flagship = materialsForPremiumLevel(5);
    const ids = flagship.map((m) => m.material_id);
    expect(ids).toContain("european_walnut_matt_lacquer");
    expect(ids).toContain("mahogany_polished");
    expect(ids).not.toContain("scandinavian_pine");
  });

  it("pairsWith(oak) surfaces coherent partners (brass · quartz · paint · porcelain)", () => {
    const partners = pairsWith("oak_american_white_satin_lacquer").map((m) => m.material_id);
    expect(partners).toContain("brass_polished");
    expect(partners).toContain("quartz_worktop_white");
    expect(partners).toContain("paint_matt_emulsion_white_shaker");
    expect(partners).toContain("porcelain_grey_large_format");
  });

  it("materialsCompatibleWithFinish(hardwax_oil) surfaces the timbers that accept it", () => {
    const ids = materialsCompatibleWithFinish("hardwax_oil").map((m) => m.material_id);
    expect(ids).toContain("oak_american_white_satin_lacquer");
    expect(ids).toContain("european_walnut_matt_lacquer");
    expect(ids).toContain("ash_white");
  });

  it("mostRepairable(90) surfaces high-repair materials sorted desc", () => {
    const repairable = mostRepairable(90);
    expect(repairable.length).toBeGreaterThan(0);
    for (let i = 1; i < repairable.length; i++) {
      expect(repairable[i - 1].repairability_score).toBeGreaterThanOrEqual(repairable[i].repairability_score);
    }
    expect(repairable.map((m) => m.material_id)).toContain("paint_matt_emulsion_white_shaker");
    expect(repairable.map((m) => m.material_id)).toContain("oak_american_white_satin_lacquer");
  });

  it("mostSustainable(85) surfaces biogenic + high-recycle materials", () => {
    const sust = mostSustainable(85);
    const ids = sust.map((m) => m.material_id);
    expect(ids).toContain("oak_american_white_satin_lacquer");
    expect(ids).toContain("scandinavian_pine");
    expect(ids).toContain("ash_white");
  });

  it("reinforce records the trade + bumps confidence + adds evidence + widens trades_it_appears_in", () => {
    reinforce("oak_american_white_satin_lacquer", "staircase", 0.02, "grand curved oak staircase upload", "asset_stair_001");
    reinforce("oak_american_white_satin_lacquer", "kitchen", 0.02, "shaker kitchen with oak butcher-block island", "asset_kitchen_001");
    reinforce("oak_american_white_satin_lacquer", "kitchen", 0.02, "second kitchen upload reinforcing oak", "asset_kitchen_002");
    const oak = get("oak_american_white_satin_lacquer")!;
    expect(oak.observation_count).toBe(3);
    expect(oak.aggregate_confidence).toBeGreaterThan(0.6);
    expect(oak.evidence_asset_ids).toHaveLength(3);
    expect(oak.trades_it_appears_in).toContain("staircase");
    expect(oak.trades_it_appears_in).toContain("kitchen");
    expect(oak.trades_it_appears_in).toHaveLength(2);   // dedupes
  });

  it("reinforce caps confidence at 1.0 · unknown material throws", () => {
    for (let i = 0; i < 20; i++) reinforce("brass_polished", "kitchen", 0.5, "spam");
    expect(get("brass_polished")!.aggregate_confidence).toBeLessThanOrEqual(1);
    expect(() => reinforce("nonexistent", "kitchen", 0.01, "x")).toThrow(/Unknown MaterialDNA/);
  });

  it("query composes multiple filters (trades × premium_level × finish × min_repairability)", () => {
    const results = query({ trades: ["kitchen"], min_premium_level: 4, finish: "satin_lacquer", min_repairability: 80 });
    // Should surface oak + walnut (both level >= 4 · both accept satin_lacquer · both repairable >= 80)
    const ids = results.map((m) => m.material_id);
    expect(ids).toContain("oak_american_white_satin_lacquer");
    expect(ids).toContain("european_walnut_matt_lacquer");
    expect(ids).not.toContain("scandinavian_pine");
  });

  it("detectPairingClashes fires when oak + stainless are combined", () => {
    const clashes = detectPairingClashes(["oak_american_white_satin_lacquer", "stainless_steel_brushed", "brass_polished"]);
    expect(clashes.length).toBeGreaterThanOrEqual(1);
    expect(clashes.some((c) => c.reason.toLowerCase().includes("oak") && c.reason.toLowerCase().includes("stainless"))).toBe(true);
    // brass + stainless also clash
    expect(clashes.some((c) => c.reason.toLowerCase().includes("brass") && c.reason.toLowerCase().includes("stainless"))).toBe(true);
  });

  it("detectPairingClashes returns empty for a coherent selection", () => {
    const coherent = ["oak_american_white_satin_lacquer", "brass_polished", "quartz_worktop_white", "paint_matt_emulsion_white_shaker", "porcelain_grey_large_format"];
    expect(detectPairingClashes(coherent)).toEqual([]);
  });

  // Philip 2026-08-04 · substitutions + explanation stage.
  it("substitutions surface premium · economical · sustainable · appearance alternates", () => {
    const subs = substitutionsFor("european_walnut_matt_lacquer");
    const kinds = new Set(subs.map((s) => s.kind));
    expect(kinds.has("premium")).toBe(true);
    expect(kinds.has("economical")).toBe(true);
    expect(kinds.has("sustainable")).toBe(true);
    expect(kinds.has("appearance")).toBe(true);
    const econ = substitute("european_walnut_matt_lacquer", "economical");
    expect(econ?.material_id).toBe("oak_american_white_satin_lacquer");
    expect(econ?.reason).toMatch(/dark stain that mimics walnut/i);
  });

  it("explainRecommendation composes suitability · pairings · clashes · substitutions into prose", () => {
    const explanation = explainRecommendation({
      material_id: "european_walnut_matt_lacquer",
      trades: ["staircase", "kitchen"],
      intended_pairings: ["brass_polished", "quartz_worktop_white"],
      budget_conscious: true,
    });
    expect(explanation.display_name).toBe("European Walnut · matt lacquer");
    expect(explanation.prose).toMatch(/recommended because/i);
    expect(explanation.bullets.some((b) => /suitability for staircase/i.test(b))).toBe(true);
    expect(explanation.bullets.some((b) => /suitability for kitchen/i.test(b))).toBe(true);
    expect(explanation.bullets.some((b) => /complements/i.test(b))).toBe(true);
    expect(explanation.bullets.some((b) => /no significant material conflicts/i.test(b))).toBe(true);
    expect(explanation.clashes).toEqual([]);
    expect(explanation.substitution_notes.length).toBeGreaterThan(0);
    expect(explanation.substitution_notes[0]).toMatch(/budget is a concern/i);
  });

  it("explainRecommendation flags clashes when the intended pairing conflicts", () => {
    const explanation = explainRecommendation({
      material_id: "brass_polished",
      trades: ["kitchen"],
      intended_pairings: ["stainless_steel_brushed"],
    });
    expect(explanation.clashes.length).toBeGreaterThan(0);
    expect(explanation.clashes[0].reason.toLowerCase()).toContain("brass");
    expect(explanation.clashes[0].reason.toLowerCase()).toContain("stainless");
    expect(explanation.bullets.some((b) => /avoid_pairing_with/i.test(b))).toBe(true);
  });

  it("Recommendation Engine can chain query + pairsWith + detectPairingClashes", () => {
    const primary = query({ trades: ["kitchen"], min_premium_level: 4, min_repairability: 85 })[0];
    expect(primary).toBeDefined();
    const partners = pairsWith(primary.material_id);
    expect(partners.length).toBeGreaterThan(0);
    const selection = [primary.material_id, ...partners.slice(0, 3).map((p) => p.material_id)];
    const clashes = detectPairingClashes(selection);
    // A curated selection built from pairsWith should NOT clash with the source material.
    for (const c of clashes) {
      expect(c.a !== primary.material_id && c.b !== primary.material_id).toBe(true);
    }
  });
});
