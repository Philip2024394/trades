// src/lib/nex/master-ai/master-ai.test.ts
//
// NEX Master AI Engineer · comprehensive contract tests · M1..M11
// Philip 2026-09-07 · AUTHORIZE
//
// Uses NEX_MASTER_AI_DATA_ROOT temp-dir isolation for every test file
// (same pattern proven in A0 workforce isolation). Production
// data/master-ai/ can NEVER be touched by these tests.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tempDir = "";
let originalMasterAiRoot: string | undefined;
let originalAgentRuntimeRoot: string | undefined;

beforeEach(() => {
  originalMasterAiRoot = process.env.NEX_MASTER_AI_DATA_ROOT;
  originalAgentRuntimeRoot = process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-test-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
  // Also isolate the runtime paths so M3 observer + M11 stop-override
  // don't touch production data/nex-agent-runtime/.
  process.env.NEX_AGENT_RUNTIME_DATA_ROOT = path.join(tempDir, "agent-runtime");
});

afterEach(() => {
  if (originalMasterAiRoot === undefined) delete process.env.NEX_MASTER_AI_DATA_ROOT;
  else process.env.NEX_MASTER_AI_DATA_ROOT = originalMasterAiRoot;
  if (originalAgentRuntimeRoot === undefined) delete process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  else process.env.NEX_AGENT_RUNTIME_DATA_ROOT = originalAgentRuntimeRoot;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ═══════════════════════════════════════════════════════════════════════════
// M1 · Agent Registry
// ═══════════════════════════════════════════════════════════════════════════

describe("M1 · Agent Registry", () => {
  it("register + list · latest record per agent_id wins", async () => {
    const { registerAgent, listAgents } = await import("./agent-registry");
    registerAgent({
      agent_id: "programmer", name: "Programmer", description: "engineering core", version: "v0.1.0",
      lifecycle_state: "ACTIVE", domain: "engineering", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    registerAgent({
      agent_id: "programmer", name: "Programmer", description: "engineering core", version: "v0.2.0",
      lifecycle_state: "ACTIVE", domain: "engineering", capabilities: ["phase_a"],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    const list = listAgents();
    expect(list).toHaveLength(1);
    expect(list[0].version).toBe("v0.2.0");
    expect(list[0].capabilities).toEqual(["phase_a"]);
  });

  it("invalid agent_id rejected", async () => {
    const { registerAgent, InvalidAgentIdError } = await import("./agent-registry");
    expect(() => registerAgent({
      agent_id: "BAD-ID!", name: "x", description: "x", version: "x",
      lifecycle_state: "ACTIVE", domain: "x", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    })).toThrow(InvalidAgentIdError);
  });

  it("append-only · corrections produce NEW record, not in-place edit", async () => {
    const { registerAgent, readAllHistory } = await import("./agent-registry");
    registerAgent({
      agent_id: "accommodation", name: "Accommodation", description: "v1", version: "v0.1.0",
      lifecycle_state: "REGISTERED", domain: "accommodation", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    registerAgent({
      agent_id: "accommodation", name: "Accommodation", description: "v2 corrected", version: "v0.2.0",
      lifecycle_state: "ACTIVE", domain: "accommodation", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    const history = readAllHistory();
    expect(history).toHaveLength(2); // both preserved
    expect(history[0].version).toBe("v0.1.0");
    expect(history[1].version).toBe("v0.2.0");
  });

  it("ensureRuntimeAgentsRegistered seeds all 11 runtime agents (extended 2026-09-08: +speaking +vision +travel +business +food +construction +healthcare +transport)", async () => {
    const { ensureRuntimeAgentsRegistered, listAgents } = await import("./agent-registry");
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const ids = listAgents().map((a) => a.agent_id).sort();
    expect(ids).toEqual(["accommodation", "business", "construction", "food", "healthcare", "master_ai", "programmer", "speaking", "transport", "travel", "vision"]);
  });

  it("setLifecycleState + setAuthorizationState work via new records", async () => {
    const { registerAgent, setLifecycleState, setAuthorizationState, getAgent } = await import("./agent-registry");
    registerAgent({
      agent_id: "restaurant", name: "Restaurant", description: "test", version: "v0.1.0",
      lifecycle_state: "PROPOSED", domain: "restaurant", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "PENDING",
      registered_by: "test", notes: null,
    });
    setLifecycleState({ agent_id: "restaurant", lifecycle_state: "REGISTERED", registered_by: "test" });
    setAuthorizationState({ agent_id: "restaurant", authorization_state: "AUTHORIZED", registered_by: "test" });
    const cur = getAgent("restaurant");
    expect(cur?.lifecycle_state).toBe("REGISTERED");
    expect(cur?.authorization_state).toBe("AUTHORIZED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M2 · Capability Registry
// ═══════════════════════════════════════════════════════════════════════════

describe("M2 · Capability Registry", () => {
  it("register capability requires the agent to exist", async () => {
    const { registerCapability, UnknownAgentError } = await import("./capability-registry");
    expect(() => registerCapability({
      capability_slug: "deterministic_review", agent_id: "ghost", version: "v1",
      evidence_refs: [], benchmark_ref: null, performance_metrics: {},
      promotion_status: "PROPOSED", authority_tier: "TIER_3", created_by: "test", supersedes: null,
    })).toThrow(UnknownAgentError);
  });

  it("version chain via supersedes walks newest to oldest", async () => {
    const { registerAgent } = await import("./agent-registry");
    const { registerCapability, versionChain } = await import("./capability-registry");
    registerAgent({
      agent_id: "programmer", name: "Programmer", description: "core", version: "v0.1.0",
      lifecycle_state: "ACTIVE", domain: "engineering", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    const v1 = registerCapability({
      capability_slug: "deterministic_review", agent_id: "programmer", version: "v1",
      evidence_refs: [], benchmark_ref: null, performance_metrics: {},
      promotion_status: "PROMOTED", authority_tier: "TIER_2", created_by: "test", supersedes: null,
    });
    const v2 = registerCapability({
      capability_slug: "deterministic_review", agent_id: "programmer", version: "v2",
      evidence_refs: [], benchmark_ref: null, performance_metrics: {},
      promotion_status: "PROMOTED", authority_tier: "TIER_2", created_by: "test", supersedes: v1.capability_id,
    });
    const chain = versionChain("programmer", "deterministic_review");
    expect(chain).toHaveLength(2);
    expect(chain[0].capability_id).toBe(v2.capability_id);
    expect(chain[1].capability_id).toBe(v1.capability_id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M3 · Observation Layer
// ═══════════════════════════════════════════════════════════════════════════

describe("M3 · Observation (read-only)", () => {
  it("recordObservation appends and readAllObservations returns them", async () => {
    const { recordObservation, readAllObservations } = await import("./observation");
    recordObservation({
      kind: "AGENT_HEARTBEAT_SNAPSHOT",
      observer_run_id: "test-run",
      agent_id: "programmer",
      provenance: { source_path: "/test", read_only: true },
      attributes: { pid: 12345 },
    });
    const list = readAllObservations();
    expect(list).toHaveLength(1);
    expect(list[0].agent_id).toBe("programmer");
    expect(list[0].provenance.read_only).toBe(true);
  });

  it("observationTick returns records even when runtime heartbeats missing", async () => {
    const { observationTick } = await import("./observation");
    const emitted = observationTick("tick-run-1");
    // 2 heartbeat snapshots + 1 event-tail
    expect(emitted).toHaveLength(3);
    for (const r of emitted) expect(r.provenance.read_only).toBe(true);
  });

  it("readHeartbeatSnapshot returns null when heartbeat file missing", async () => {
    const { readHeartbeatSnapshot } = await import("./observation");
    // Test isolation dir has no heartbeats
    expect(readHeartbeatSnapshot("programmer")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M4 · Knowledge Ledger
// ═══════════════════════════════════════════════════════════════════════════

describe("M4 · Knowledge Ledger", () => {
  it("append-only knowledge · superseded records excluded from current list", async () => {
    const { recordKnowledge, listCurrentKnowledge, readAllKnowledge } = await import("./knowledge-ledger");
    const first = recordKnowledge({
      category: "RESEARCH_FINDING", agent_id: null, authority_tier: "TIER_3",
      content: { slug: "test", value: "v1" }, supersedes: null,
      provenance: { source: "test", source_ref: null }, created_by: "test",
    });
    recordKnowledge({
      category: "RESEARCH_FINDING", agent_id: null, authority_tier: "TIER_3",
      content: { slug: "test", value: "v2" }, supersedes: first.record_id,
      provenance: { source: "test", source_ref: null }, created_by: "test",
    });
    expect(readAllKnowledge()).toHaveLength(2);      // both preserved
    expect(listCurrentKnowledge()).toHaveLength(1);  // only v2 current
    expect((listCurrentKnowledge()[0].content as { value: string }).value).toBe("v2");
  });

  it("filter by category + agent_id works", async () => {
    const { recordKnowledge, listCurrentKnowledge } = await import("./knowledge-ledger");
    recordKnowledge({ category: "OPPORTUNITY_SIGNAL", agent_id: "programmer", authority_tier: "TIER_3",
      content: {}, supersedes: null, provenance: { source: "x", source_ref: null }, created_by: "test" });
    recordKnowledge({ category: "RISK_SIGNAL", agent_id: "accommodation", authority_tier: "TIER_3",
      content: {}, supersedes: null, provenance: { source: "x", source_ref: null }, created_by: "test" });
    expect(listCurrentKnowledge({ category: "OPPORTUNITY_SIGNAL" })).toHaveLength(1);
    expect(listCurrentKnowledge({ agent_id: "accommodation" })).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M5 · Research Engine
// ═══════════════════════════════════════════════════════════════════════════

describe("M5 · Research Engine", () => {
  it("registerSource + listSources current-state semantics", async () => {
    const { registerSource, listSources, getSource } = await import("./research-engine");
    registerSource({
      source_slug: "test_source", name: "Test", kind: "FIXTURE",
      authority_tier: "TIER_5", base_url: null,
      rate_policy: { max_requests_per_minute: 60, respect_retry_after: true },
      respects_robots_txt: true, license_note: null, authorization_state: "AUTHORIZED",
      registered_by: "test",
    });
    expect(listSources()).toHaveLength(1);
    expect(getSource("test_source")?.kind).toBe("FIXTURE");
  });

  it("research finding dedups via content_hash", async () => {
    const { recordFinding, readAllFindings } = await import("./research-engine");
    const f1 = recordFinding({
      query_id: "q1", source_slug: "s1", authority_tier: "TIER_3",
      raw_evidence: "same evidence", normalized_claim: "claim",
      retrieved_at_iso: new Date().toISOString(), freshness_expires_at_iso: null,
      language: null, license: null,
    });
    const f2 = recordFinding({
      query_id: "q1", source_slug: "s1", authority_tier: "TIER_3",
      raw_evidence: "same evidence", normalized_claim: "claim",
      retrieved_at_iso: new Date().toISOString(), freshness_expires_at_iso: null,
      language: null, license: null,
    });
    expect(f1.finding_id).toBe(f2.finding_id);
    expect(readAllFindings()).toHaveLength(1);
  });

  it("FACT is downgraded to OBSERVATION when source not TIER_1/TIER_2", async () => {
    const { recordFinding } = await import("./research-engine");
    const f = recordFinding({
      query_id: "q1", source_slug: "s1", authority_tier: "TIER_4",
      claimed_classification: "FACT" as const,
      raw_evidence: "e1", normalized_claim: "c1",
      retrieved_at_iso: new Date().toISOString(), freshness_expires_at_iso: null,
      language: null, license: null,
    });
    expect(f.classification).toBe("OBSERVATION");
  });

  it("FACT is preserved when source is TIER_1", async () => {
    const { recordFinding } = await import("./research-engine");
    const f = recordFinding({
      query_id: "q1", source_slug: "s1", authority_tier: "TIER_1",
      claimed_classification: "FACT" as const,
      raw_evidence: "official statement", normalized_claim: "c",
      retrieved_at_iso: new Date().toISOString(), freshness_expires_at_iso: null,
      language: null, license: null,
    });
    expect(f.classification).toBe("FACT");
  });

  it("empty raw_evidence rejected", async () => {
    const { recordFinding, InvalidResearchFindingError } = await import("./research-engine");
    expect(() => recordFinding({
      query_id: "q", source_slug: "s", authority_tier: "TIER_3",
      raw_evidence: "", normalized_claim: "c",
      retrieved_at_iso: new Date().toISOString(), freshness_expires_at_iso: null,
      language: null, license: null,
    })).toThrow(InvalidResearchFindingError);
  });

  it("query lifecycle: QUEUED → IN_PROGRESS → COMPLETED", async () => {
    const { enqueueResearchQuery, updateQueryStatus, listQueries } = await import("./research-engine");
    const q = enqueueResearchQuery({
      question: "Q1", target_source_slugs: ["s1"], priority: 100, created_by: "test",
    });
    updateQueryStatus({ query_id: q.query_id, status: "IN_PROGRESS" });
    updateQueryStatus({ query_id: q.query_id, status: "COMPLETED" });
    const cur = listQueries().find((x) => x.query_id === q.query_id);
    expect(cur?.status).toBe("COMPLETED");
    expect(cur?.resolved_at_iso).not.toBeNull();
  });

  it("adapter interface registerAdapter/getAdapter roundtrip", async () => {
    const { registerAdapter, getAdapter } = await import("./research-engine");
    registerAdapter({
      source_slug: "fixture",
      async fetch() {
        return { status: "OK", raw_evidence: "e", retrieved_at_iso: new Date().toISOString(), language: null, license: null };
      },
    });
    const a = getAdapter("fixture");
    expect(a).not.toBeNull();
    const r = await a!.fetch({} as any);
    expect(r.status).toBe("OK");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M6 · Benchmark Engine
// ═══════════════════════════════════════════════════════════════════════════

describe("M6 · Benchmark Engine", () => {
  it("registerCorpus rejects duplicate case_id", async () => {
    const { registerCorpus, DuplicateCaseIdError } = await import("./benchmark-engine");
    expect(() => registerCorpus({
      agent_id: "programmer", version: "v1",
      cases: [
        { case_id: "c1", input: 1, expected: 1, metadata: {} },
        { case_id: "c1", input: 2, expected: 2, metadata: {} },
      ],
    })).toThrow(DuplicateCaseIdError);
  });

  it("registered corpus is frozen", async () => {
    const { registerCorpus } = await import("./benchmark-engine");
    const corpus = registerCorpus({
      agent_id: "programmer", version: "v1",
      cases: [{ case_id: "c1", input: 1, expected: 1, metadata: {} }],
    });
    expect(Object.isFrozen(corpus)).toBe(true);
    expect(Object.isFrozen(corpus.cases)).toBe(true);
    expect(Object.isFrozen(corpus.cases[0])).toBe(true);
  });

  it("verdict: IMPROVED when pass rate exceeds prior + 0.01", async () => {
    const { registerCorpus, recordRun } = await import("./benchmark-engine");
    const c = registerCorpus({
      agent_id: "programmer", version: "v1",
      cases: [{ case_id: "c1", input: 1, expected: 1, metadata: {} }],
    });
    const prior = recordRun({
      corpus_id: c.corpus_id, capability_id: "cap-v1",
      case_count: 100, pass_count: 60, fail_count: 40,
      per_class_metrics: {}, compared_against_run_id: null, attribution: null,
    });
    const next = recordRun({
      corpus_id: c.corpus_id, capability_id: "cap-v2",
      case_count: 100, pass_count: 80, fail_count: 20,
      per_class_metrics: {}, compared_against_run_id: prior.run_id, attribution: "cap_upgrade",
    });
    expect(next.verdict).toBe("IMPROVED");
  });

  it("verdict: DEGRADED when pass rate falls below prior - 0.01", async () => {
    const { registerCorpus, recordRun } = await import("./benchmark-engine");
    const c = registerCorpus({
      agent_id: "programmer", version: "v1",
      cases: [{ case_id: "c1", input: 1, expected: 1, metadata: {} }],
    });
    const prior = recordRun({
      corpus_id: c.corpus_id, capability_id: "cap-v1",
      case_count: 100, pass_count: 80, fail_count: 20,
      per_class_metrics: {}, compared_against_run_id: null, attribution: null,
    });
    const next = recordRun({
      corpus_id: c.corpus_id, capability_id: "cap-v2",
      case_count: 100, pass_count: 60, fail_count: 40,
      per_class_metrics: {}, compared_against_run_id: prior.run_id, attribution: null,
    });
    expect(next.verdict).toBe("DEGRADED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M7 · Teaching · Cross-Agent Proposals
// ═══════════════════════════════════════════════════════════════════════════

describe("M7 · Cross-agent teaching", () => {
  it("proposal rejects source == target", async () => {
    const { registerAgent } = await import("./agent-registry");
    const { createProposal, ProposalPreconditionError } = await import("./teaching");
    registerAgent({
      agent_id: "programmer", name: "P", description: "", version: "v1",
      lifecycle_state: "ACTIVE", domain: "engineering", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    expect(() => createProposal({
      source_agent_id: "programmer", source_capability_id: "cap1",
      target_agent_id: "programmer", proposed_capability_slug: "x",
      hypothesis: "self-proposal", evidence_refs: [], benchmark_prediction: null, created_by: "test",
    })).toThrow(ProposalPreconditionError);
  });

  it("authorization gate: proposal starts AWAITING_APPROVAL", async () => {
    const { registerAgent } = await import("./agent-registry");
    const { createProposal, listProposals } = await import("./teaching");
    registerAgent({
      agent_id: "programmer", name: "P", description: "", version: "v1",
      lifecycle_state: "ACTIVE", domain: "engineering", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    registerAgent({
      agent_id: "accommodation", name: "A", description: "", version: "v1",
      lifecycle_state: "ACTIVE", domain: "accommodation", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    const p = createProposal({
      source_agent_id: "programmer", source_capability_id: "cap1",
      target_agent_id: "accommodation", proposed_capability_slug: "entity_resolver",
      hypothesis: "programmer review benefits accommodation entity resolution",
      evidence_refs: ["benchmark:xyz"], benchmark_prediction: "+12%", created_by: "test",
    });
    expect(p.authorization_state).toBe("AWAITING_APPROVAL");
    expect(listProposals({ authorization_state: "AWAITING_APPROVAL" })).toHaveLength(1);
  });

  it("authorize renders slice-authorization prompt", async () => {
    const { registerAgent } = await import("./agent-registry");
    const { createProposal, authorizeProposal, getProposal } = await import("./teaching");
    registerAgent({
      agent_id: "programmer", name: "P", description: "", version: "v1",
      lifecycle_state: "ACTIVE", domain: "engineering", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    registerAgent({
      agent_id: "accommodation", name: "A", description: "", version: "v1",
      lifecycle_state: "ACTIVE", domain: "accommodation", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    const p = createProposal({
      source_agent_id: "programmer", source_capability_id: "cap1",
      target_agent_id: "accommodation", proposed_capability_slug: "entity_resolver",
      hypothesis: "h", evidence_refs: [], benchmark_prediction: null, created_by: "test",
    });
    authorizeProposal({ proposal_id: p.proposal_id, founder_user_id: "Victus", authorization_reason: "approved" });
    const cur = getProposal(p.proposal_id);
    expect(cur?.authorization_state).toBe("AUTHORIZED");
    expect(cur?.slice_authorization_prompt).toContain("CROSS-AGENT CAPABILITY PROPOSAL");
    expect(cur?.slice_authorization_prompt).toContain("target-agent implementation");
  });

  it("rejected proposal cannot be re-authorized", async () => {
    const { registerAgent } = await import("./agent-registry");
    const { createProposal, rejectProposal, authorizeProposal, ProposalPreconditionError } = await import("./teaching");
    registerAgent({
      agent_id: "programmer", name: "P", description: "", version: "v1",
      lifecycle_state: "ACTIVE", domain: "engineering", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    registerAgent({
      agent_id: "accommodation", name: "A", description: "", version: "v1",
      lifecycle_state: "ACTIVE", domain: "accommodation", capabilities: [],
      benchmark_suite_ref: null, knowledge_domains: [], authorization_state: "AUTHORIZED",
      registered_by: "test", notes: null,
    });
    const p = createProposal({
      source_agent_id: "programmer", source_capability_id: "cap1",
      target_agent_id: "accommodation", proposed_capability_slug: "x",
      hypothesis: "h", evidence_refs: [], benchmark_prediction: null, created_by: "test",
    });
    rejectProposal({ proposal_id: p.proposal_id, founder_user_id: "Victus", authorization_reason: "no" });
    expect(() => authorizeProposal({
      proposal_id: p.proposal_id, founder_user_id: "Victus", authorization_reason: "changed mind",
    })).toThrow(ProposalPreconditionError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M8 · Agent Factory
// ═══════════════════════════════════════════════════════════════════════════

describe("M8 · Agent Factory (spec only)", () => {
  it("decomposeMission produces a DRAFT specification", async () => {
    const { decomposeMission, listSpecifications } = await import("./agent-factory");
    const spec = decomposeMission({
      mission: "Build a world-class Restaurant Intelligence Agent for Indonesia",
      proposed_agent_id: "restaurant", proposed_name: "NEX Restaurant Intelligence Agent",
      domain: "restaurant", internet_requirement: "PREFERRED", created_by: "test",
    });
    expect(spec.status).toBe("DRAFT");
    expect(spec.required_capabilities).toContain("cuisine_normalization");
    expect(spec.deployment_gate_list).toContain("A0_workforce_foundation");
    expect(spec.deployment_gate_list).toContain("A8_controlled_real_acquisition_one_city");
    expect(spec.safety_boundaries).toContain("no_bypass_of_captcha");
    expect(listSpecifications()).toHaveLength(1);
  });

  it("architecture_sketch mentions A0-A9 slice discipline", async () => {
    const { decomposeMission } = await import("./agent-factory");
    const spec = decomposeMission({
      mission: "Build a Travel Agent", proposed_agent_id: "travel", proposed_name: "Travel",
      domain: "travel", internet_requirement: "REQUIRED", created_by: "test",
    });
    expect(spec.architecture_sketch).toContain("A0");
    expect(spec.architecture_sketch).toContain("A9");
    expect(spec.architecture_sketch).toContain("Master AI does NOT activate this agent");
  });

  it("approveSpecification transitions DRAFT→APPROVED", async () => {
    const { decomposeMission, approveSpecification, getSpecification } = await import("./agent-factory");
    const spec = decomposeMission({
      mission: "Build a Business Agent", proposed_agent_id: "business", proposed_name: "Business",
      domain: "business", internet_requirement: "PREFERRED", created_by: "test",
    });
    approveSpecification({ specification_id: spec.specification_id, approved_by: "Victus" });
    const cur = getSpecification(spec.specification_id);
    expect(cur?.status).toBe("APPROVED");
    expect(cur?.approved_by).toBe("Victus");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M9 · Philip Intelligence
// ═══════════════════════════════════════════════════════════════════════════

describe("M9 · Philip Intelligence", () => {
  it("FACT with supporting refs accepted", async () => {
    const { emitClaim } = await import("./philip-intelligence");
    const c = emitClaim({
      classification: "FACT", statement: "Accommodation has 9,203 rows",
      supporting_refs: ["observation:xyz"], uncertainty_note: null, time_horizon: "NOW",
      category: "PERFORMANCE_SUMMARY",
    });
    expect(c.classification).toBe("FACT");
  });

  it("FACT without supporting refs rejected", async () => {
    const { emitClaim, InvalidClaimError } = await import("./philip-intelligence");
    expect(() => emitClaim({
      classification: "FACT", statement: "Nex has X",
      supporting_refs: [], uncertainty_note: null, time_horizon: null,
      category: "OPPORTUNITY",
    })).toThrow(InvalidClaimError);
  });

  it("INFERENCE without uncertainty note rejected", async () => {
    const { emitClaim, InvalidClaimError } = await import("./philip-intelligence");
    expect(() => emitClaim({
      classification: "INFERENCE", statement: "This may improve X",
      supporting_refs: ["ref"], uncertainty_note: null, time_horizon: "NEAR_TERM",
      category: "OPPORTUNITY",
    })).toThrow(InvalidClaimError);
  });

  it("INFERENCE with uncertainty note accepted", async () => {
    const { emitClaim } = await import("./philip-intelligence");
    const c = emitClaim({
      classification: "INFERENCE", statement: "Programmer review may improve accommodation ER",
      supporting_refs: ["ref1"], uncertainty_note: "MEDIUM — not yet benchmarked on accommodation corpus",
      time_horizon: "NEAR_TERM", category: "OPPORTUNITY",
    });
    expect(c.uncertainty_note).toBeTruthy();
  });

  it("unknown classification rejected", async () => {
    const { emitClaim, InvalidClaimError } = await import("./philip-intelligence");
    expect(() => emitClaim({
      // @ts-expect-error intentionally invalid
      classification: "MAGIC", statement: "x",
      supporting_refs: ["r"], uncertainty_note: null, time_horizon: null, category: "OPPORTUNITY",
    })).toThrow(InvalidClaimError);
  });

  it("filter by classification works", async () => {
    const { emitClaim, listClaims } = await import("./philip-intelligence");
    emitClaim({
      classification: "FACT", statement: "First claim statement", supporting_refs: ["r"], uncertainty_note: null,
      time_horizon: null, category: "PERFORMANCE_SUMMARY",
    });
    emitClaim({
      classification: "OBSERVATION", statement: "Second claim statement", supporting_refs: ["r"], uncertainty_note: null,
      time_horizon: null, category: "TREND",
    });
    expect(listClaims({ classification: "FACT" })).toHaveLength(1);
    expect(listClaims({ classification: "OBSERVATION" })).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M10 · Offline Reservoir
// ═══════════════════════════════════════════════════════════════════════════

describe("M10 · Offline Reservoir", () => {
  it("default mode is online with default reason", async () => {
    const { readMode } = await import("./offline-reservoir");
    const m = readMode();
    expect(m.online).toBe(true);
    expect(m.reason).toBe("default");
  });

  it("setOffline records reason + since", async () => {
    const { setOffline, readMode } = await import("./offline-reservoir");
    setOffline("network_lost");
    const m = readMode();
    expect(m.online).toBe(false);
    expect(m.reason).toBe("network_lost");
  });

  it("setOnline preserves last_online_iso", async () => {
    const { setOffline, setOnline, readMode } = await import("./offline-reservoir");
    setOffline("test");
    setOnline("network_restored");
    const m = readMode();
    expect(m.online).toBe(true);
    expect(m.last_online_iso).not.toBeNull();
  });

  it("freshnessOf classifies FRESH / STALE / PERMANENT / UNKNOWN", async () => {
    const { freshnessOf } = await import("./offline-reservoir");
    const now = Date.now();
    expect(freshnessOf("FACT", new Date(now - 10000).toISOString(), now)).toBe("PERMANENT");
    expect(freshnessOf("AGENT_HEARTBEAT", new Date(now - 10000).toISOString(), now)).toBe("FRESH");
    expect(freshnessOf("AGENT_HEARTBEAT", new Date(now - 120000).toISOString(), now)).toBe("STALE");
    expect(freshnessOf("UNKNOWN_CATEGORY", new Date().toISOString(), now)).toBe("UNKNOWN");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M11 · Bounded Autonomous Evolution
// ═══════════════════════════════════════════════════════════════════════════

describe("M11 · Bounded Autonomous Evolution", () => {
  it("validateBounds rejects out-of-Phase-G-range values", async () => {
    const { validateBounds, BoundsViolationError } = await import("./autonomous-evolution");
    expect(() => validateBounds({ max_iterations: 100, max_runtime_ms: 5000, max_files_changed: 10 })).toThrow(BoundsViolationError);
    expect(() => validateBounds({ max_iterations: 0, max_runtime_ms: 5000, max_files_changed: 10 })).toThrow(BoundsViolationError);
    expect(() => validateBounds({ max_iterations: 5, max_runtime_ms: 50, max_files_changed: 10 })).toThrow(BoundsViolationError);
    expect(() => validateBounds({ max_iterations: 5, max_runtime_ms: 5000, max_files_changed: 100 })).toThrow(BoundsViolationError);
  });

  it("validateBounds accepts values inside Phase G contract", async () => {
    const { validateBounds } = await import("./autonomous-evolution");
    expect(() => validateBounds({ max_iterations: 16, max_runtime_ms: 60_000, max_files_changed: 32 })).not.toThrow();
  });

  it("recordInvocation appends and reads back", async () => {
    const { recordInvocation, readAllInvocations } = await import("./autonomous-evolution");
    recordInvocation({
      invoker_reason: "test tick",
      bounds_applied: { max_iterations: 8, max_runtime_ms: 30_000, max_files_changed: 8 },
      candidates_produced: 3, proposals_created: 1, terminated_reason: "reached_iteration_budget",
    });
    expect(readAllInvocations()).toHaveLength(1);
  });

  it("Promotion Approval Queue: queue → approve", async () => {
    const { queuePromotion, approvePromotion, getPromotionEntry } = await import("./autonomous-evolution");
    const e = queuePromotion({
      proposal_id: "p1", capability_id: "c1", target_agent_id: "accommodation", reason: "improvement candidate",
    });
    approvePromotion({ entry_id: e.entry_id, founder_user_id: "Victus", reason: "approved" });
    const cur = getPromotionEntry(e.entry_id);
    expect(cur?.status).toBe("APPROVED");
    expect(cur?.founder_user_id).toBe("Victus");
  });

  it("Approved entry cannot be re-approved", async () => {
    const { queuePromotion, approvePromotion } = await import("./autonomous-evolution");
    const e = queuePromotion({
      proposal_id: "p1", capability_id: "c1", target_agent_id: "accommodation", reason: "r",
    });
    approvePromotion({ entry_id: e.entry_id, founder_user_id: "Victus", reason: "ok" });
    expect(() => approvePromotion({
      entry_id: e.entry_id, founder_user_id: "Victus", reason: "again",
    })).toThrow(/not_awaiting_approval/);
  });

  it("Master AI honours founder-stop-override sticky flag", async () => {
    const { recordInvocation, FounderStopOverrideActiveError } = await import("./autonomous-evolution");
    const { setFounderStopOverride } = await import("@/lib/nex/agent-runtime/registry");
    setFounderStopOverride(true, "Victus", "test_stop");
    expect(() => recordInvocation({
      invoker_reason: "should be blocked",
      bounds_applied: { max_iterations: 4, max_runtime_ms: 5_000, max_files_changed: 4 },
      candidates_produced: 0, proposals_created: 0, terminated_reason: "attempted",
    })).toThrow(FounderStopOverrideActiveError);
  });
});
