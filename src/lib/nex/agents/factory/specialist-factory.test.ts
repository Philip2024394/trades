// src/lib/nex/agents/factory/specialist-factory.test.ts
//
// Phase 13 · specialist factory · contract tests

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  bootstrapSpecialist,
  REQUIRED_DOCTRINE_INHERITANCE,
  RESERVED_AGENT_IDS,
  MAX_SPECIALISTS_TOTAL,
  type SpecialistSpec,
} from "./specialist-factory";

function synthRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "nex-p13-"));
  mkdirSync(path.join(root, "data", "nex-agent-runtime"), { recursive: true });
  return root;
}

function goodSpec(overrides: Partial<SpecialistSpec> = {}): SpecialistSpec {
  return {
    agent_id: "cooking",
    human_name: "NEX Cooking Intelligence Engineer",
    archetype: "conversation_driven",
    domain_slug: "cooking",
    priority_languages: ["en", "id", "ja"],
    benchmark_corpus_seed: { seed_case_count: 6, defect_class_focus: "cooking.food_safety" },
    doctrine_inheritance: [...REQUIRED_DOCTRINE_INHERITANCE],
    founder_authorization_id: "founder_auth_cooking_specialist_2026-09-08",
    founder_reason: "Founder authorized creation of NEX Cooking Intelligence Engineer with allergen + halal + kosher + veg + medical-diet awareness for Bali+Jakarta hospitality domain",
    ...overrides,
  };
}

// ─── Positive path ────────────────────────────────

describe("Phase 13 · bootstrapSpecialist · well-formed spec → valid plan", () => {
  it("well-formed spec produces DRY_RUN_PLAN with full manifest", () => {
    const root = synthRepo();
    const b = bootstrapSpecialist(goodSpec(), { repo_root: root });
    expect(b.status).toBe("DRY_RUN_PLAN");
    expect(b.rejection_reasons).toEqual([]);
    expect(b.planned_worker_file).toBe("src/lib/nex/agent-runtime/worker-cooking.ts");
    expect(b.planned_module_directory).toBe("src/lib/nex/agents/nex-cooking/");
    expect(b.planned_knowledge_namespace).toBe("cooking.*");
    expect(b.doctrine_manifest.length).toBe(REQUIRED_DOCTRINE_INHERITANCE.length);
    expect(b.requires_founder_approval_before_ship).toBe(true);
    expect(b.integration_checklist.length).toBeGreaterThan(5);
    expect(b.time_to_first_improvement_cycle_target_hours).toBe(24);
  });
});

// ─── Reserved-name protection ─────────────────────

describe("Phase 13 · reserved agent_ids → REJECTED", () => {
  for (const reserved of RESERVED_AGENT_IDS) {
    it(`agent_id '${reserved}' → REJECTED`, () => {
      const root = synthRepo();
      const b = bootstrapSpecialist(goodSpec({ agent_id: reserved }), { repo_root: root });
      expect(b.status).toBe("REJECTED");
      expect(b.rejection_reasons.some((r) => r.includes("RESERVED"))).toBe(true);
    });
  }
});

// ─── Founder authorization required ───────────────

describe("Phase 13 · Founder authorization required", () => {
  it("empty founder_authorization_id → REJECTED", () => {
    const root = synthRepo();
    const b = bootstrapSpecialist(goodSpec({ founder_authorization_id: "" }), { repo_root: root });
    expect(b.status).toBe("REJECTED");
    expect(b.rejection_reasons.some((r) => /founder_authorization_id/.test(r))).toBe(true);
  });
  it("founder_reason too short (<20 chars) → REJECTED", () => {
    const root = synthRepo();
    const b = bootstrapSpecialist(goodSpec({ founder_reason: "short" }), { repo_root: root });
    expect(b.status).toBe("REJECTED");
    expect(b.rejection_reasons.some((r) => /founder_reason/.test(r))).toBe(true);
  });
});

// ─── Doctrine inheritance completeness ────────────

describe("Phase 13 · missing doctrine → REJECTED", () => {
  it("dropping ANY required doctrine → REJECTED with specific doctrine name", () => {
    const root = synthRepo();
    const partial = REQUIRED_DOCTRINE_INHERITANCE.slice(0, -1);   // drop the last one
    const b = bootstrapSpecialist(goodSpec({ doctrine_inheritance: [...partial] }), { repo_root: root });
    expect(b.status).toBe("REJECTED");
    const dropped = REQUIRED_DOCTRINE_INHERITANCE[REQUIRED_DOCTRINE_INHERITANCE.length - 1];
    expect(b.rejection_reasons.some((r) => r.includes(dropped))).toBe(true);
  });
  it("dropping life_safety_supersession → REJECTED (the highest-priority doctrine)", () => {
    const root = synthRepo();
    const noLifeSafety = REQUIRED_DOCTRINE_INHERITANCE.filter((d) => d !== "life_safety_supersession");
    const b = bootstrapSpecialist(goodSpec({ doctrine_inheritance: [...noLifeSafety] }), { repo_root: root });
    expect(b.status).toBe("REJECTED");
    expect(b.rejection_reasons.some((r) => r.includes("life_safety_supersession"))).toBe(true);
  });
});

// ─── Bounds ────────────────────────────────────────

describe("Phase 13 · benchmark seed minimum + priority languages required", () => {
  it("seed_case_count < 5 → REJECTED", () => {
    const root = synthRepo();
    const b = bootstrapSpecialist(goodSpec({ benchmark_corpus_seed: { seed_case_count: 3, defect_class_focus: "cooking" } }), { repo_root: root });
    expect(b.status).toBe("REJECTED");
    expect(b.rejection_reasons.some((r) => /seed_case_count/.test(r))).toBe(true);
  });
  it("empty priority_languages → REJECTED", () => {
    const root = synthRepo();
    const b = bootstrapSpecialist(goodSpec({ priority_languages: [] }), { repo_root: root });
    expect(b.status).toBe("REJECTED");
    expect(b.rejection_reasons.some((r) => /priority_languages/.test(r))).toBe(true);
  });
});

// ─── Sprawl cap ────────────────────────────────────

describe("Phase 13 · sprawl cap · MAX_SPECIALISTS_TOTAL enforced", () => {
  it(`registering ${MAX_SPECIALISTS_TOTAL} specialists → next one REJECTED`, () => {
    const root = synthRepo();
    // Fake positions.json with MAX_SPECIALISTS_TOTAL non-reserved agents
    const positions = Array.from({ length: MAX_SPECIALISTS_TOTAL }, (_, i) => ({ agent_id: `custom_${i}` }));
    writeFileSync(path.join(root, "data", "nex-agent-runtime", "positions.json"), JSON.stringify(positions), "utf8");
    const b = bootstrapSpecialist(goodSpec({ agent_id: "one_too_many" }), { repo_root: root });
    expect(b.status).toBe("REJECTED");
    expect(b.rejection_reasons.some((r) => /sprawl cap/i.test(r))).toBe(true);
  });
  it(`reserved agent_ids don't count toward sprawl cap`, () => {
    const root = synthRepo();
    // Fake positions.json with 4 reserved agents only (should not count)
    const positions = RESERVED_AGENT_IDS.map((id) => ({ agent_id: id }));
    writeFileSync(path.join(root, "data", "nex-agent-runtime", "positions.json"), JSON.stringify(positions), "utf8");
    const b = bootstrapSpecialist(goodSpec({ agent_id: "new_one" }), { repo_root: root });
    expect(b.status).toBe("DRY_RUN_PLAN");
  });
});

// ─── agent_id format ───────────────────────────────

describe("Phase 13 · agent_id must match slug format", () => {
  it("uppercase in agent_id → REJECTED", () => {
    const root = synthRepo();
    const b = bootstrapSpecialist(goodSpec({ agent_id: "Cooking" }), { repo_root: root });
    expect(b.status).toBe("REJECTED");
  });
  it("hyphen in agent_id → REJECTED (underscores only)", () => {
    const root = synthRepo();
    const b = bootstrapSpecialist(goodSpec({ agent_id: "cook-ing" }), { repo_root: root });
    expect(b.status).toBe("REJECTED");
  });
  it("too-long agent_id (>32 chars) → REJECTED", () => {
    const root = synthRepo();
    const b = bootstrapSpecialist(goodSpec({ agent_id: "a".repeat(33) }), { repo_root: root });
    expect(b.status).toBe("REJECTED");
  });
});

// ─── requires_founder_approval_before_ship contract ─

describe("Phase 13 · every bootstrap carries requires_founder_approval_before_ship: true", () => {
  it("even DRY_RUN_PLAN carries the flag (contract-enforced)", () => {
    const root = synthRepo();
    const b = bootstrapSpecialist(goodSpec(), { repo_root: root });
    expect(b.requires_founder_approval_before_ship).toBe(true);
  });
});
