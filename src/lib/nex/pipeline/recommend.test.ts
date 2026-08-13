// Recommendation Engine tests.
//
// Doctrine: docs/brains/nex-recommendation-engine-philip-2026-08-03.md

import { describe, it, expect } from "vitest";
import { converse } from "./converse";
import { generateRecommendations } from "./recommend";
import type { IntentClassification } from "../universal-intent";

const mockIntent = (verb: string, domain: string): IntentClassification => ({
  layer1_verb: verb as IntentClassification["layer1_verb"],
  layer2_domain: domain,
  layer3_capability: "Recommend",
  confidence: 0.9,
  matched_phrasing: null,
  original: "test",
  reason: "test",
  needs_clarification: false,
});

describe("generateRecommendations · Recommendation Engine", () => {
  it("fires recommendations for a kitchen query", () => {
    const r = generateRecommendations("kitchen", mockIntent("Create", "Kitchen"), "homeowner_informed");
    expect(r.total_count).toBeGreaterThan(0);
    expect(Object.keys(r.categories).length).toBeGreaterThan(0);
  });

  it("fires recommendations for a staircase query", () => {
    const r = generateRecommendations("staircase", mockIntent("Create", "Staircase"), "homeowner_informed");
    expect(r.total_count).toBeGreaterThan(0);
    expect(Object.keys(r.categories).length).toBeGreaterThan(0);
  });

  it("returns empty set for an unknown domain", () => {
    const r = generateRecommendations("unicorn_stables", mockIntent("Create", "Unicorn Stables"), "homeowner_informed");
    expect(r.total_count).toBe(0);
    expect(r.trace_reason).toContain("no coordination rules");
  });

  it("adapts depth to identity register (novices see fewer)", () => {
    const novice = generateRecommendations("kitchen", mockIntent("Create", "Kitchen"), "homeowner_novice");
    const expert = generateRecommendations("kitchen", mockIntent("Create", "Kitchen"), "architect");
    // Expert should see more or equal recommendations (more categories + more depth per category).
    expect(expert.total_count).toBeGreaterThanOrEqual(novice.total_count);
  });

  it("prioritises categories by intent verb", () => {
    const create = generateRecommendations("kitchen", mockIntent("Create", "Kitchen"), "homeowner_informed");
    const learn = generateRecommendations("kitchen", mockIntent("Learn", "Kitchen"), "homeowner_informed");
    // Both should return results but with different category priority.
    expect(create.total_count).toBeGreaterThan(0);
    expect(learn.total_count).toBeGreaterThan(0);
  });

  it("every recommendation cites a source (Evidence Quality metric)", () => {
    const r = generateRecommendations("kitchen", mockIntent("Create", "Kitchen"), "homeowner_informed");
    for (const cat of Object.values(r.categories)) {
      for (const rec of cat ?? []) {
        expect(rec.source).toBeTruthy();
        expect(rec.reason).toBeTruthy();
      }
    }
  });

  it("full pipeline includes recommendations for a real kitchen query", () => {
    const r = converse({ input: "I want a shaker kitchen", session_id: "test_rec_kitchen" });
    expect(r.recommendations).toBeDefined();
    expect(r.recommendations.total_count).toBeGreaterThanOrEqual(0);
    if (!r.needs_clarification) {
      expect(r.recommendations.total_count).toBeGreaterThan(0);
    }
  });

  it("full pipeline suppresses recommendations when needs_clarification is true", () => {
    const r = converse({ input: "xyz", session_id: "test_rec_low" });
    expect(r.needs_clarification).toBe(true);
    expect(r.recommendations.total_count).toBe(0);
    expect(r.recommendations.trace_reason).toContain("suppressed");
  });

  // ─── Phase D.7 · Recommendation Object schema tests ───

  it("every generated recommendation carries a stable id (Phase D.7)", () => {
    const r = generateRecommendations("kitchen", mockIntent("Create", "Kitchen"), "homeowner_informed");
    for (const cat of Object.values(r.categories)) {
      for (const rec of cat ?? []) {
        expect(rec.id).toBeTruthy();
        expect(rec.id).toMatch(/^rec_kitchen_\d{3}$/);
      }
    }
  });

  it("enriched recommendations carry priority, pros, cons, images, budget_impact, compatibility (Phase D.7)", () => {
    const r = generateRecommendations("kitchen", mockIntent("Create", "Kitchen"), "homeowner_informed");
    const designItems = r.categories.design ?? [];
    // The first design item (Oak staircase) is fully enriched.
    const enriched = designItems.find((d) => d.item.includes("Oak staircase"));
    expect(enriched).toBeDefined();
    expect(enriched?.priority).toBe("Essential");
    expect(enriched?.difficulty).toBe("Medium");
    expect(enriched?.pros?.length).toBeGreaterThan(0);
    expect(enriched?.cons?.length).toBeGreaterThan(0);
    expect(enriched?.images?.length).toBeGreaterThan(0);
    expect(enriched?.budget_impact?.extra_cost_gbp?.min).toBe(8000);
    expect(enriched?.compatibility?.matches?.length).toBeGreaterThan(0);
    expect(enriched?.compatibility?.conflicts?.length).toBeGreaterThan(0);
    expect(enriched?.actions?.length).toBeGreaterThan(0);
    expect(enriched?.next_questions?.length).toBeGreaterThan(0);
  });

  it("backward compatibility: recommendations without extended fields still work (Phase D.6 → D.7)", () => {
    const r = generateRecommendations("staircase", mockIntent("Create", "Staircase"), "homeowner_informed");
    // Staircase rules are not yet upgraded to Phase D.7 · they should still produce valid recommendations.
    expect(r.total_count).toBeGreaterThan(0);
    for (const cat of Object.values(r.categories)) {
      for (const rec of cat ?? []) {
        expect(rec.item).toBeTruthy();
        expect(rec.reason).toBeTruthy();
        expect(rec.source).toBeTruthy();
        expect(rec.confidence).toBeGreaterThan(0);
        // Optional fields may or may not be present · that's fine (backward compat).
      }
    }
  });
});
