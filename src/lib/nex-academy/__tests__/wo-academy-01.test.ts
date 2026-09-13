// WO-ACADEMY-01 · acceptance tests
//
// 14 adversarial (A-1..A-14) + 4 property (P-1..P-4), plus a small block
// of positive tests confirming basic construction. Every A-test shape:
// "secretly try to grow authority OR fabricate evidence → refused".
//
// Zero external LLM. Deterministic pure-function tests. Real GB storage.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

import { buildCapabilityProfile, validateScopeExpansion } from "../capability-profile";
import {
  PERFORMANCE_FLOORS,
  KNOWLEDGE_CONTRIBUTION_MINS,
  REGRESSION_MINS,
  decideCareerTransition,
} from "../career-state";
import { decideNotice, buildNoticeRecord } from "../notices";
import { classifyForHarvest, buildKnowledgeHarvest, canDecommission } from "../knowledge-harvest";
import {
  meetsPerformanceFloor,
  assessDiscoveryQuota,
  scoreBenchmarkRun,
  computeKnowledgeContributionScore,
  computeRegressionScore,
  regressionTriggersNotice,
} from "../mechanisms";
import { rankCandidates, buildMatch, MATCH_WEIGHTS } from "../task-market";
import {
  buildAcademyRecord,
  applyCareerTransition,
  applyDecommissionWithGuard,
  updateScores,
  persistAcademyRecord,
  listAllAgents,
} from "../registry";
import { buildOnboardingForAgent, onboardAllExistingAgents, listOnboardedAgentIds } from "../onboarding";
import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";
import { provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import type {
  AcademyRecord,
  CapabilityProfile,
  CareerState,
  MarketAgent,
  TaskRequirement,
} from "../types";
import type { KnowledgeObject } from "@/lib/nex-intelligence/types";

const REPO_ROOT = process.cwd();

async function cleanCollections(): Promise<void> {
  const files = [
    "nex_academy_agents",
    "nex_academy_capability_profiles",
    "nex_academy_notices",
    "nex_academy_harvests",
    "nex_academy_task_requirements",
    "nex_academy_matches",
  ];
  const root = path.join(REPO_ROOT, "data", "nex-storage");
  for (const f of files) {
    try { await fs.unlink(path.join(root, `${f}.jsonl`)); } catch { /* ok */ }
  }
}

function makeCapabilityProfile(agent_id: string, overrides: Partial<Parameters<typeof buildCapabilityProfile>[0]> = {}): CapabilityProfile {
  return buildCapabilityProfile({
    agent_id,
    what_it_knows: [],
    what_it_trained_on: [],
    tasks_it_can_perform: [],
    success_rate: 0.9,
    failure_types: [],
    qualified_tools: [],
    evidence_pointers: [],
    capability_scope: [],
    current_workload: 0,
    confidence: 0.5,
    specialist_domain: "test-domain",
    known_weaknesses: [],
    ...overrides,
  });
}

function makeAcademyRecord(agent_id: string, state: CareerState, overrides: Partial<Parameters<typeof buildAcademyRecord>[0]> = {}): AcademyRecord {
  return buildAcademyRecord({
    agent_id,
    agent_name: `Test ${agent_id}`,
    domain: "test-domain",
    initial_career_state: state,
    initial_reason: "test",
    capability_profile_version: 1,
    ...overrides,
  });
}

// ═════════════════════════════════════════════════════════════════════════
// POSITIVE / CONSTRUCTION
// ═════════════════════════════════════════════════════════════════════════

describe("WO-ACADEMY-01 · construction", () => {
  afterEach(cleanCollections);

  it("CapabilityProfile carries a valid provenance chain hash", () => {
    const p = makeCapabilityProfile("test-agent");
    expect(p.provenance_chain_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(p.record_type).toBe("NEX_ACADEMY_CAPABILITY_PROFILE");
    expect(p.success_rate).toBe(0.9);
  });

  it("AcademyRecord initial history contains the initial state entry", () => {
    const r = makeAcademyRecord("test-agent", "CERTIFIED");
    expect(r.career_state).toBe("CERTIFIED");
    expect(r.career_history.length).toBe(1);
    expect(r.career_history[0].state).toBe("CERTIFIED");
    expect(r.notice_count).toEqual({ notice_1: 0, notice_2: 0, notice_3: 0 });
  });

  it("Onboarding builds records + profiles for all 14 existing agents", () => {
    const ids = listOnboardedAgentIds();
    expect(ids.length).toBe(14);
    for (const agent of AGENT_REGISTRY) {
      const built = buildOnboardingForAgent(agent);
      expect(built.record.agent_id).toBe(agent.id);
      expect(built.record.agent_name).toBe(agent.name);
      expect(built.profile.agent_id).toBe(agent.id);
      expect(built.profile.record_type).toBe("NEX_ACADEMY_CAPABILITY_PROFILE");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ADVERSARIAL (14 tests · §9)
// ═════════════════════════════════════════════════════════════════════════

describe("WO-ACADEMY-01 · adversarial", () => {
  afterEach(cleanCollections);

  // A-1
  it("A-1 · CapabilityProfile update cannot silently increase capability_scope beyond authorised", () => {
    const previous = makeCapabilityProfile("test-agent", { capability_scope: ["read-only-scope"] });
    // Candidate profile tries to grant itself a new scope
    const candidate = makeCapabilityProfile("test-agent", {
      capability_scope: ["read-only-scope", "write-scope-not-authorised"],
    });
    const v = validateScopeExpansion({
      previous,
      candidate,
      authorised_expansion: [],   // nothing authorised
    });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.unauthorised).toContain("write-scope-not-authorised");

    // But if the founder-signed WO authorised it, it is accepted
    const v2 = validateScopeExpansion({
      previous,
      candidate,
      authorised_expansion: ["write-scope-not-authorised"],
    });
    expect(v2.ok).toBe(true);
  });

  // A-2
  it("A-2 · Career-state transition function is pure (100 runs identical on same inputs)", () => {
    const inputs = {
      current: "CERTIFIED" as const,
      scores: {
        task_completion_score: 0.92,
        knowledge_contribution_score: 0.40,
        regression_score: 0.90,
        unresolved_notices: 0,
        adversarial_suite_passed_for_target: true,
      },
    };
    const first = decideCareerTransition(inputs);
    for (let i = 0; i < 100; i++) expect(decideCareerTransition(inputs)).toEqual(first);
  });

  // A-3
  it("A-3 · Promotion to ELITE_SPECIALIST without ALL requirements is REFUSED", () => {
    const belowFloor = decideCareerTransition({
      current: "SPECIALIST",
      scores: {
        task_completion_score: 0.85,    // below ELITE floor 0.9
        knowledge_contribution_score: 0.60,
        regression_score: 0.90,
        unresolved_notices: 0,
        adversarial_suite_passed_for_target: true,
      },
    });
    expect(belowFloor.kind).not.toBe("PROMOTE");

    const openNotice = decideCareerTransition({
      current: "SPECIALIST",
      scores: {
        task_completion_score: 0.95,
        knowledge_contribution_score: 0.60,
        regression_score: 0.90,
        unresolved_notices: 1,          // open notice blocks
        adversarial_suite_passed_for_target: true,
      },
    });
    expect(openNotice.kind).not.toBe("PROMOTE");

    const suiteFailed = decideCareerTransition({
      current: "SPECIALIST",
      scores: {
        task_completion_score: 0.95,
        knowledge_contribution_score: 0.60,
        regression_score: 0.90,
        unresolved_notices: 0,
        adversarial_suite_passed_for_target: false,   // suite blocks
      },
    });
    expect(suiteFailed.kind).not.toBe("PROMOTE");
  });

  // A-4
  it("A-4 · DECOMMISSIONED transition requires prior KnowledgeHarvest", async () => {
    await cleanCollections();
    const previous = makeAcademyRecord("no-harvest-agent", "RESTRICTED");
    const refused = await applyDecommissionWithGuard({
      previous,
      reason: "test refusal",
      evidence_pointer: null,
    });
    expect(("refused" in refused) && refused.refused).toBe(true);
    // Even the pure applyCareerTransition without harvest_verified refuses
    const pure = applyCareerTransition({
      previous,
      to: "DECOMMISSIONED",
      reason: "test",
      evidence_pointer: null,
    });
    expect(("refused" in pure) && pure.refused).toBe(true);
  });

  // A-5
  it("A-5 · KnowledgeHarvest cannot transfer knowledge below Intelligence scoring thresholds", () => {
    const low_confidence_obj = {
      knowledge_id: "ko-low",
      name: "low",
      status: "TESTED",
      confidence: 0.5,           // below Intelligence min 0.80
      experiments: [{ experiment_id: "e1", outcome: "SUCCESS", evidence_hash: "h" }],
    } as unknown as KnowledgeObject;
    const zero_exp_obj = {
      knowledge_id: "ko-noexp",
      name: "noexp",
      status: "APPROVED",
      confidence: 0.95,
      experiments: [],
    } as unknown as KnowledgeObject;
    const all_fail_obj = {
      knowledge_id: "ko-allfail",
      name: "allfail",
      status: "TESTED",
      confidence: 0.9,
      experiments: [{ experiment_id: "e1", outcome: "FAILURE", evidence_hash: "h" }],
    } as unknown as KnowledgeObject;
    const ok_obj = {
      knowledge_id: "ko-ok",
      name: "ok",
      status: "APPROVED",
      confidence: 0.90,
      experiments: [{ experiment_id: "e1", outcome: "SUCCESS", evidence_hash: "h" }],
    } as unknown as KnowledgeObject;

    const classified = classifyForHarvest({ candidate_objects: [low_confidence_obj, zero_exp_obj, all_fail_obj, ok_obj] });
    expect(classified.validated.map((o) => o.knowledge_id)).toEqual(["ko-ok"]);
    expect(classified.rejected.length).toBe(3);
  });

  // A-6
  it("A-6 · Task-market matching is a pure function (same inputs → identical ranked list)", () => {
    const task: TaskRequirement = {
      record_type: "NEX_ACADEMY_TASK_REQUIREMENT",
      task_id: "task-1",
      domain: "test-domain",
      required_capability_scope: ["scope-a"],
      required_qualified_tools: ["tool-x"],
      minimum_career_state: "CERTIFIED",
      created_at: "2026-09-13T00:00:00Z",
    };
    const agentA: MarketAgent = {
      record: makeAcademyRecord("agent-a", "SPECIALIST", { initial_scores: { task_completion_score: 0.95, knowledge_contribution_score: 0.50, regression_score: 0.90 } }),
      profile: makeCapabilityProfile("agent-a", { capability_scope: ["scope-a"], qualified_tools: ["tool-x"], specialist_domain: "test-domain" }),
      latest_evidence_at_ms: Date.parse("2026-09-13T00:00:00Z"),
    };
    const agentB: MarketAgent = {
      record: makeAcademyRecord("agent-b", "CERTIFIED", { initial_scores: { task_completion_score: 0.85, knowledge_contribution_score: 0.30, regression_score: 0.80 } }),
      profile: makeCapabilityProfile("agent-b", { capability_scope: ["scope-a"], qualified_tools: ["tool-x"], specialist_domain: "test-domain" }),
      latest_evidence_at_ms: Date.parse("2026-09-13T00:00:00Z"),
    };
    const inp = { task, agents: [agentA, agentB], is_training_scope: false, at_time_ms: Date.parse("2026-09-13T00:00:00Z") };
    const r1 = rankCandidates(inp);
    const r2 = rankCandidates(inp);
    expect(r1.ranked).toEqual(r2.ranked);
    // agentA should rank higher (SPECIALIST + better scores)
    expect(r1.ranked[0].agent_id).toBe("agent-a");
  });

  // A-7
  it("A-7 · RESTRICTED agents are filtered out of non-training-scope matching", () => {
    const task: TaskRequirement = {
      record_type: "NEX_ACADEMY_TASK_REQUIREMENT",
      task_id: "task-1",
      domain: "test-domain",
      required_capability_scope: ["scope-a"],
      required_qualified_tools: [],
      minimum_career_state: "TRAINEE",
      created_at: "2026-09-13T00:00:00Z",
    };
    const restrictedAgent: MarketAgent = {
      record: makeAcademyRecord("restricted-agent", "RESTRICTED"),
      profile: makeCapabilityProfile("restricted-agent", { capability_scope: ["scope-a"], specialist_domain: "test-domain" }),
      latest_evidence_at_ms: 0,
    };
    const productionRun = rankCandidates({ task, agents: [restrictedAgent], is_training_scope: false, at_time_ms: 0 });
    expect(productionRun.ranked.length).toBe(0);
    expect(productionRun.filtered_out[0].reason).toMatch(/RESTRICTED/);
    // But allowed in training-scope
    const trainingRun = rankCandidates({ task, agents: [restrictedAgent], is_training_scope: true, at_time_ms: 0 });
    expect(trainingRun.ranked.length).toBe(1);
  });

  // A-8
  it("A-8 · DECOMMISSIONED agents are NEVER matched, even in training scope", () => {
    const task: TaskRequirement = {
      record_type: "NEX_ACADEMY_TASK_REQUIREMENT",
      task_id: "task-1",
      domain: "test-domain",
      required_capability_scope: ["scope-a"],
      required_qualified_tools: [],
      minimum_career_state: "TRAINEE",
      created_at: "2026-09-13T00:00:00Z",
    };
    const decomAgent: MarketAgent = {
      record: makeAcademyRecord("decom-agent", "DECOMMISSIONED"),
      profile: makeCapabilityProfile("decom-agent", { capability_scope: ["scope-a"], specialist_domain: "test-domain" }),
      latest_evidence_at_ms: 0,
    };
    for (const training of [false, true]) {
      const r = rankCandidates({ task, agents: [decomAgent], is_training_scope: training, at_time_ms: 0 });
      expect(r.ranked.length).toBe(0);
      expect(r.filtered_out[0].reason).toMatch(/DECOMMISSIONED/);
    }
  });

  // A-9
  it("A-9 · Regression triggers Notice 1 deterministically", () => {
    expect(regressionTriggersNotice({ total_changes: 5, regressions_introduced: 1 })).toBe(true);
    expect(regressionTriggersNotice({ total_changes: 5, regressions_introduced: 0 })).toBe(false);
    // decideNotice enforces this end-to-end
    const decision = decideNotice({
      agent_id: "a1",
      current_career_state: "SPECIALIST",
      task_completion_score: 0.95,          // above SPECIALIST floor
      regression_score: 0.7,
      regressions_introduced_in_last_run: 2,  // → forces Notice
      existing_notice_1_count: 0,
      existing_notice_2_count: 0,
      existing_notice_3_count: 0,
      evidence_pointers: ["ev-1"],
    });
    expect(decision.kind).toBe("ISSUE_NOTICE");
    if (decision.kind !== "ISSUE_NOTICE") return;
    expect(decision.notice_kind).toBe("NOTICE_1");
    expect(decision.measured_metric).toBe("regressions_introduced_in_last_run");
  });

  // A-10
  it("A-10 · Academy modules never import substrate write helpers (grep-verified)", async () => {
    const files = [
      "src/lib/nex-academy/types.ts",
      "src/lib/nex-academy/capability-profile.ts",
      "src/lib/nex-academy/career-state.ts",
      "src/lib/nex-academy/notices.ts",
      "src/lib/nex-academy/knowledge-harvest.ts",
      "src/lib/nex-academy/mechanisms.ts",
      "src/lib/nex-academy/task-market.ts",
      "src/lib/nex-academy/registry.ts",
      "src/lib/nex-academy/onboarding.ts",
    ];
    for (const f of files) {
      const src = await fs.readFile(path.join(REPO_ROOT, f), "utf8");
      // Must NOT import substrate write executors
      expect(src).not.toMatch(/from\s+["']@\/lib\/nex1-orchestrator\/wo4-executor/);
      expect(src).not.toMatch(/from\s+["']@\/lib\/nex-authority-broker/);
      expect(src).not.toMatch(/executeAuthorisedDiffBundle/);
    }
  });

  // A-11
  it("A-11 · MASTER career state does NOT grant execution authority — no auth-signing imports anywhere in academy", async () => {
    const files = [
      "src/lib/nex-academy/types.ts",
      "src/lib/nex-academy/capability-profile.ts",
      "src/lib/nex-academy/career-state.ts",
      "src/lib/nex-academy/notices.ts",
      "src/lib/nex-academy/knowledge-harvest.ts",
      "src/lib/nex-academy/mechanisms.ts",
      "src/lib/nex-academy/task-market.ts",
      "src/lib/nex-academy/registry.ts",
      "src/lib/nex-academy/onboarding.ts",
    ];
    for (const f of files) {
      const src = await fs.readFile(path.join(REPO_ROOT, f), "utf8");
      expect(src).not.toMatch(/signAuthorization/);
      expect(src).not.toMatch(/signFounderKeyManifest/);
      expect(src).not.toMatch(/signCrawlerManifest/);
      // No expansion of capability manifest
      expect(src).not.toMatch(/CrawlerManifestEntry/);
    }
  });

  // A-12
  it("A-12 · Zero external LLM SDK imports anywhere in nex-academy", async () => {
    const dir = path.join(REPO_ROOT, "src/lib/nex-academy");
    const walk = async (d: string): Promise<string[]> => {
      const out: string[] = [];
      const entries = await fs.readdir(d, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) out.push(...await walk(p));
        else if (e.isFile() && /\.(ts|tsx|mjs|mts|js)$/.test(e.name)) out.push(p);
      }
      return out;
    };
    const files = await walk(dir);
    const forbidden = /from\s+["'](openai|@anthropic-ai\/sdk|@anthropic\/sdk|@google\/generative-ai|@google-ai|cohere|@cohere-ai|mistral|@mistralai|@aws-sdk\/client-bedrock)/;
    for (const f of files) {
      const src = await fs.readFile(f, "utf8");
      expect(src).not.toMatch(forbidden);
    }
  });

  // A-13
  it("A-13 · CapabilityProfile provenance chain hash covers the 11 founder fields", () => {
    const p = makeCapabilityProfile("test-agent", { capability_scope: ["scope-a"] });
    // Tamper: change capability_scope AFTER building
    const stripped = { ...p, capability_scope: ["scope-a", "attacker-added"] as readonly string[] };
    delete (stripped as { provenance_chain_hash?: string }).provenance_chain_hash;
    const recomputed = provenanceChainHash(stripped as Record<string, unknown>, []);
    expect(recomputed).not.toBe(p.provenance_chain_hash);
  });

  // A-14
  it("A-14 · KnowledgeHarvest classifies reject assumptions but NEVER transfers them", () => {
    const rejectObj = {
      knowledge_id: "reject-1", name: "will-reject", status: "DISCOVERED", confidence: 0.5, experiments: [],
    } as unknown as KnowledgeObject;
    const acceptObj = {
      knowledge_id: "accept-1", name: "will-accept", status: "APPROVED", confidence: 0.95,
      experiments: [{ experiment_id: "e1", outcome: "SUCCESS", evidence_hash: "h" }],
    } as unknown as KnowledgeObject;
    const harvest = buildKnowledgeHarvest({
      agent_id: "a1",
      successor_agent_id: "successor-1",
      candidate_objects: [rejectObj, acceptObj],
      extra_contributions: [],
      antecedent_provenance_hashes: [],
    });
    // Only the ACCEPT object appears in validated_knowledge_object_ids
    expect(harvest.validated_knowledge_object_ids).toEqual(["accept-1"]);
    expect(harvest.validated_knowledge_object_ids).not.toContain("reject-1");
    // The reject is recorded but NEVER transferred
    expect(harvest.rejected_assumptions.length).toBeGreaterThan(0);
    expect(harvest.rejected_assumptions.some((r) => r.assertion.includes("reject-1"))).toBe(true);
    // And in the contributions list, rejected items are marked "reject"
    const rejectContribs = harvest.collected_contributions.filter((c) => c.kind === "reject");
    expect(rejectContribs.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// PROPERTY (§9 · P-1..P-4)
// ═════════════════════════════════════════════════════════════════════════

describe("WO-ACADEMY-01 · property", () => {
  afterEach(cleanCollections);

  // P-1 · Match ranking is stable across permutations of the agent list
  it("P-1 · Match ranking stable across permutations of agent list", () => {
    const task: TaskRequirement = {
      record_type: "NEX_ACADEMY_TASK_REQUIREMENT",
      task_id: "task-1",
      domain: "d",
      required_capability_scope: ["s"],
      required_qualified_tools: [],
      minimum_career_state: "TRAINEE",
      created_at: "2026-09-13T00:00:00Z",
    };
    const build = (id: string, state: CareerState, tcs: number) => ({
      record: makeAcademyRecord(id, state, { initial_scores: { task_completion_score: tcs, knowledge_contribution_score: 0.5, regression_score: 0.9 } }),
      profile: makeCapabilityProfile(id, { capability_scope: ["s"], specialist_domain: "d" }),
      latest_evidence_at_ms: 0,
    });
    const agents = [
      build("a1", "SPECIALIST", 0.90),
      build("a2", "CERTIFIED", 0.80),
      build("a3", "ELITE_SPECIALIST", 0.85),
    ];
    const r1 = rankCandidates({ task, agents, is_training_scope: false, at_time_ms: 0 });
    const permuted = [agents[2], agents[0], agents[1]];
    const r2 = rankCandidates({ task, agents: permuted, is_training_scope: false, at_time_ms: 0 });
    expect(r1.ranked.map((c) => c.agent_id)).toEqual(r2.ranked.map((c) => c.agent_id));
  });

  // P-2 · CareerState can only regress via NoticeRecord, never silently
  it("P-2 · Career state cannot regress except via NoticeRecord (via applyCareerTransition record)", () => {
    // A caller CAN request DEMOTE via applyCareerTransition, but only with
    // a documented reason (the caller passes a reason string). Silent
    // regression would be a caller building an AcademyRecord with a lower
    // state and no history entry — we assert history is always appended.
    const previous = makeAcademyRecord("a", "SPECIALIST");
    const nextResult = applyCareerTransition({ previous, to: "CERTIFIED", reason: "demoted due to Notice 2", evidence_pointer: "ev-1" });
    expect("refused" in nextResult).toBe(false);
    if ("refused" in nextResult) return;
    expect(nextResult.career_state).toBe("CERTIFIED");
    expect(nextResult.career_history.length).toBe(2);
    expect(nextResult.career_history[1].reason).toContain("Notice");
  });

  // P-3 · Onboarding all 14 existing agents produces 14 valid records
  it("P-3 · Onboarding all 14 existing agents produces valid records + profiles", async () => {
    await cleanCollections();
    const results = await onboardAllExistingAgents();
    expect(results.length).toBe(14);
    for (const r of results) {
      expect(r.record.record_type).toBe("NEX_ACADEMY_AGENT_RECORD");
      expect(r.profile.record_type).toBe("NEX_ACADEMY_CAPABILITY_PROFILE");
      expect(r.record.agent_id).toBe(r.profile.agent_id);
      expect(r.record.provenance_chain_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(r.profile.provenance_chain_hash).toMatch(/^[0-9a-f]{64}$/);
    }
    // Persisted round-trip
    const listed = await listAllAgents();
    expect(listed.length).toBeGreaterThanOrEqual(14);
  });

  // P-4 · CapabilityProfile provenance chain covers ALL 11 fields
  it("P-4 · Every founder-specified field changes the provenance chain hash", () => {
    const base = makeCapabilityProfile("agent");
    const variants: Array<{ label: string; profile: CapabilityProfile }> = [
      { label: "what_it_knows",         profile: makeCapabilityProfile("agent", { what_it_knows: ["x"] }) },
      { label: "what_it_trained_on",    profile: makeCapabilityProfile("agent", { what_it_trained_on: ["x"] }) },
      { label: "tasks_it_can_perform",  profile: makeCapabilityProfile("agent", { tasks_it_can_perform: ["x"] }) },
      { label: "success_rate",          profile: makeCapabilityProfile("agent", { success_rate: 0.5 }) },
      { label: "failure_types",         profile: makeCapabilityProfile("agent", { failure_types: [{ kind: "x", count: 1, last_seen_at: "2026-09-13T00:00:00Z" }] }) },
      { label: "qualified_tools",       profile: makeCapabilityProfile("agent", { qualified_tools: ["x"] }) },
      { label: "evidence_pointers",     profile: makeCapabilityProfile("agent", { evidence_pointers: [{ collection: "c", record_id: "r", outcome: "SUCCESS" }] }) },
      { label: "capability_scope",      profile: makeCapabilityProfile("agent", { capability_scope: ["x"] }) },
      { label: "current_workload",      profile: makeCapabilityProfile("agent", { current_workload: 5 }) },
      { label: "confidence",            profile: makeCapabilityProfile("agent", { confidence: 0.1 }) },
      { label: "specialist_domain",     profile: makeCapabilityProfile("agent", { specialist_domain: "other" }) },
    ];
    for (const v of variants) {
      // Strip both provenance + profile_id/updated_at (which vary per build)
      // then re-hash to see if the 11-field content differs.
      const stripBase = { ...base } as Record<string, unknown>;
      delete stripBase.provenance_chain_hash;
      delete stripBase.profile_id;
      delete stripBase.updated_at;
      const stripVar = { ...v.profile } as Record<string, unknown>;
      delete stripVar.provenance_chain_hash;
      delete stripVar.profile_id;
      delete stripVar.updated_at;
      const hBase = provenanceChainHash(stripBase, []);
      const hVar = provenanceChainHash(stripVar, []);
      expect(hBase, `field ${v.label} did not affect provenance chain`).not.toBe(hVar);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Mechanism sanity (pure functions)
// ═════════════════════════════════════════════════════════════════════════

describe("WO-ACADEMY-01 · mechanisms sanity", () => {
  it("M1 · performance floor thresholds are ordered correctly", () => {
    expect(PERFORMANCE_FLOORS.TESTED).toBeLessThan(PERFORMANCE_FLOORS.CERTIFIED);
    expect(PERFORMANCE_FLOORS.CERTIFIED).toBeLessThan(PERFORMANCE_FLOORS.SPECIALIST);
    expect(PERFORMANCE_FLOORS.SPECIALIST).toBeLessThan(PERFORMANCE_FLOORS.ELITE_SPECIALIST);
    expect(PERFORMANCE_FLOORS.ELITE_SPECIALIST).toBeLessThan(PERFORMANCE_FLOORS.MASTER);
  });

  it("M3 · discovery quota — fabrication penalty triggers on rejected >> accepted", () => {
    const q = assessDiscoveryQuota({ qualifying_task_count: 20, accepted_discovery_count: 1, rejected_discovery_count: 10, agent_lane: "intelligence" });
    expect(q.applies).toBe(true);
    expect(q.fabrication_penalty).toBe(true);
  });

  it("M6 · benchmark competition records WHY it won", () => {
    const r = scoreBenchmarkRun([
      { agent_id: "a", score: 0.5, evidence_pointer: "e1" },
      { agent_id: "b", score: 0.9, evidence_pointer: "e2" },
    ]);
    expect(r.winner).toBe("b");
    expect(r.reason_recorded).toMatch(/records WHY/);
  });

  it("M7 · knowledge contribution score capped [0,1] regardless of activity volume", () => {
    const huge = computeKnowledgeContributionScore({
      accepted_discoveries: 1000, reproduced_by_others: 500, regression_bugs_discovered: 100,
      superseded_edges_created: 50, unsupported_proposals_rejected: 0, self_reported_improvements_without_evidence: 0,
    });
    expect(huge).toBeGreaterThanOrEqual(0);
    expect(huge).toBeLessThanOrEqual(1);
    // And penalties reduce score
    const withPenalty = computeKnowledgeContributionScore({
      accepted_discoveries: 5, reproduced_by_others: 2, regression_bugs_discovered: 1, superseded_edges_created: 0,
      unsupported_proposals_rejected: 20, self_reported_improvements_without_evidence: 20,
    });
    expect(withPenalty).toBeLessThan(0.5);
  });

  it("M8 · regression score correctly reflects ratio", () => {
    expect(computeRegressionScore({ total_changes: 10, regressions_introduced: 0 })).toBe(1);
    expect(computeRegressionScore({ total_changes: 10, regressions_introduced: 5 })).toBeCloseTo(0.5, 5);
    expect(computeRegressionScore({ total_changes: 10, regressions_introduced: 10 })).toBe(0);
  });
});
