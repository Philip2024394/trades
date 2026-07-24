// _fixture_only.ts — synthetic Brain fixture for substrate tests only.
//
// This fixture is EXPLICITLY not construction knowledge. Every field
// is deliberately structural and abstract (test1/test2/foo/bar) so it
// cannot accidentally be surfaced as advice. Real Brain content lives
// in Author-authored JSON packs authored by contracted trade experts
// per ADR-0017 §4.
//
// If you find yourself tempted to copy this fixture into production
// seed data — don't. Read ADR-0017 §4 first.

import type { BrainPack } from "../_types";

export function fixtureBrainPack(overrides: Partial<{ slug: string; status: string }> = {}): BrainPack {
  const slug = overrides.slug ?? "fixture_test_brain";
  const status = overrides.status ?? "published";
  return {
    manifest: {
      slug,
      name:                 `Fixture Brain (${slug})`,
      category:             "trade",
      version:              "0.0.1-fixture",
      status,
      primary_author_id:    "fixture-author-id",
      primary_author_name:  "Fixture Author",
      primary_author_creds: "Not a real credential",
      supported_countries:  ["UK"],
      supported_regions:    null,
      published_at:         "2026-07-23T00:00:00.000Z",
      last_reviewed_at:     "2026-07-23T00:00:00.000Z",
      v1_modules_present:   ["craft", "regulations", "materials", "workflow", "defects", "pricing_model"]
    },
    modules: {
      craft: {
        header: {
          version: "0.0.1-fixture",
          authored_by: "fixture-author-id",
          authored_at: "2026-07-23T00:00:00.000Z",
          regions: ["UK"]
        },
        facts: [{
          id: "fact.test1",
          statement: "test1 fixture fact",
          evidence: [{ source: "fixture-source", note: "fixture only" }],
          confidence: "medium"
        }],
        techniques: [],
        glossary: [{
          term: "test1",
          definition: "fixture definition of test1",
          aliases: [],
          evidence: []
        }]
      },
      regulations: {
        header: {
          version: "0.0.1-fixture",
          authored_by: "fixture-author-id",
          authored_at: "2026-07-23T00:00:00.000Z",
          regions: ["UK"]
        },
        regulations: [{
          id: "test.reg.1",
          country: "UK",
          title: "Fixture regulation title",
          requirement: "test1 requirement stub",
          applies_to: [],
          evidence: [{ source: "fixture-reg-source" }],
          confidence: "high"
        }],
        rules: []
      },
      materials: {
        header: {
          version: "0.0.1-fixture",
          authored_by: "fixture-author-id",
          authored_at: "2026-07-23T00:00:00.000Z",
          regions: ["UK"]
        },
        materials: [{
          id: "mat.test1",
          family: "fixture_family",
          name: "test1 material",
          grades: [],
          pack_sizes: [],
          defect_risk: "low",
          waste_factor_pct: 10,
          compatible_with: [],
          incompatible_with: [],
          evidence: [],
          confidence: "medium"
        }]
      },
      workflow: {
        header: {
          version: "0.0.1-fixture",
          authored_by: "fixture-author-id",
          authored_at: "2026-07-23T00:00:00.000Z",
          regions: ["UK"]
        },
        playbooks: [{
          id: "pb.test1",
          title: "test1 workflow playbook",
          applies_to: [],
          steps: [{ order: 0, action: "fixture step" }],
          checkpoints: [],
          evidence: [],
          confidence: "medium"
        }]
      },
      defects: {
        header: {
          version: "0.0.1-fixture",
          authored_by: "fixture-author-id",
          authored_at: "2026-07-23T00:00:00.000Z",
          regions: ["UK"]
        },
        defects: [{
          id: "def.test1",
          name: "test1 defect",
          applies_to: [],
          symptoms: ["fixture symptom"],
          causes: [],
          fixes: [],
          severity: "cosmetic",
          vision_hints: ["fixture-hint"],
          evidence: [],
          confidence: "low"
        }]
      },
      pricing_model: {
        header: {
          version: "0.0.1-fixture",
          authored_by: "fixture-author-id",
          authored_at: "2026-07-23T00:00:00.000Z",
          regions: ["UK"]
        },
        rules: [{
          id: "rule.test1",
          rule_key: "fixture.per_unit",
          unit: "each",
          applies_when: {},
          base_value: 100,
          regional_multipliers: { "UK-LON": 1.2 },
          evidence: [],
          confidence: "medium"
        }]
      }
    }
  };
}
