// src/lib/nex/master-ai/intelligence-status.test.ts
//
// NEX Native Intelligence (NI) Doctrine · unit tests
// Founder Section 16 requirements: prove the status system is honest.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  UNKNOWN_INTELLIGENCE_PROFILE,
  detectHiddenLLMClaim,
  hasSufficientEvidence,
  validateIntelligenceProfile,
  type Nex1IntelligenceProfile,
  type Nex1IntelligenceEvidence,
  type Nex1IntelligenceDelegation,
  type Nex1IntelligenceGap,
} from "./intelligence-status";

// ── Helpers ──────────────────────────────────────────────────────────────────

function evidence(name: string): Nex1IntelligenceEvidence {
  return {
    capability: name,
    implementation_path: `src/lib/nex-agent/code-engine/${name}/index.ts`,
    test_paths: [`src/lib/nex-agent/code-engine/${name}/__tests__/${name}.test.ts`],
    test_count: 42,
    version: "v1.0.0",
    last_verified_iso: "2026-09-16T00:00:00.000Z",
    scope_positive: ["thing it can do"],
    scope_negative: ["thing it cannot do"],
  };
}

function delegation(name: string): Nex1IntelligenceDelegation {
  return {
    capability: name,
    provider: "Anthropic Claude Opus 4.7",
    caller_path: `src/lib/nex/${name}.ts`,
    fallback_present: false,
  };
}

function gap(name: string): Nex1IntelligenceGap {
  return {
    capability: name,
    reason: "requires generative comprehension",
    requires_generative: true,
  };
}

function profile(overrides: Partial<Nex1IntelligenceProfile>): Nex1IntelligenceProfile {
  return {
    ...UNKNOWN_INTELLIGENCE_PROFILE,
    ...overrides,
  };
}

// ── Section 16 requirements ─────────────────────────────────────────────────

describe("NI Doctrine · Section 16 requirement #1 · NATIVE labelling", () => {
  it("agent with only deterministic evidence is labelled NATIVE + validates", () => {
    const p = profile({
      status: "NATIVE",
      maturity: "NI-1",
      native_capabilities: [evidence("classify")],
      last_audit_iso: "2026-09-16T00:00:00.000Z",
    });
    expect(validateIntelligenceProfile(p)).toBeNull();
    expect(hasSufficientEvidence(p)).toBe(true);
  });

  it("NATIVE claim WITHOUT evidence is REJECTED", () => {
    const p = profile({ status: "NATIVE", maturity: "NI-1" });
    expect(validateIntelligenceProfile(p)).toMatch(/NATIVE status requires at least one native_capabilities/);
    expect(hasSufficientEvidence(p)).toBe(false);
  });
});

describe("NI Doctrine · Section 16 requirement #2 · AI_DELEGATED / HYBRID labelling", () => {
  it("agent using an LLM for reasoning is labelled AI_DELEGATED", () => {
    const p = profile({
      status: "AI_DELEGATED",
      maturity: "NI-0",
      delegated_capabilities: [delegation("compose-brand-voice")],
    });
    expect(validateIntelligenceProfile(p)).toBeNull();
  });

  it("HYBRID requires BOTH native AND delegated capabilities", () => {
    const missingNative = profile({
      status: "HYBRID",
      maturity: "NI-1",
      delegated_capabilities: [delegation("llm-compose")],
    });
    expect(validateIntelligenceProfile(missingNative)).toMatch(/HYBRID.*BOTH/);

    const complete = profile({
      status: "HYBRID",
      maturity: "NI-2",
      native_capabilities: [evidence("retrieve-index")],
      delegated_capabilities: [delegation("llm-compose")],
    });
    expect(validateIntelligenceProfile(complete)).toBeNull();
  });
});

describe("NI Doctrine · Section 16 requirement #3 · NOT_IMPLEMENTED for missing capability", () => {
  it("agent that cannot perform reasoning is labelled NOT_IMPLEMENTED", () => {
    const p = profile({
      status: "NOT_IMPLEMENTED",
      maturity: "NI-0",
      unsupported_capabilities: [gap("source-code-comprehension")],
    });
    expect(validateIntelligenceProfile(p)).toBeNull();
  });

  it("NOT_IMPLEMENTED forbids native or delegated claims", () => {
    const withNative = profile({
      status: "NOT_IMPLEMENTED",
      maturity: "NI-0",
      native_capabilities: [evidence("something")],
      unsupported_capabilities: [gap("something-else")],
    });
    expect(validateIntelligenceProfile(withNative)).toMatch(/NOT_IMPLEMENTED.*forbids/);
  });
});

describe("NI Doctrine · Section 16 requirement #4 · UNKNOWN does NOT auto-upgrade to NATIVE", () => {
  it("the UNKNOWN default is UNKNOWN with zero capabilities", () => {
    expect(UNKNOWN_INTELLIGENCE_PROFILE.status).toBe("UNKNOWN");
    expect(UNKNOWN_INTELLIGENCE_PROFILE.native_capabilities.length).toBe(0);
    expect(UNKNOWN_INTELLIGENCE_PROFILE.delegated_capabilities.length).toBe(0);
  });

  it("UNKNOWN profile validates (any shape acceptable while unverified)", () => {
    expect(validateIntelligenceProfile(UNKNOWN_INTELLIGENCE_PROFILE)).toBeNull();
  });

  it("UNKNOWN with capabilities present is still UNKNOWN — status is not inferred from capabilities", () => {
    const p = profile({
      status: "UNKNOWN",
      native_capabilities: [evidence("classify")],
    });
    // The status stays UNKNOWN. The doctrine forbids auto-upgrading.
    expect(p.status).toBe("UNKNOWN");
    // Validation accepts it — the human must EXPLICITLY change status to NATIVE
    // to make the claim. Presence of evidence alone does not make the claim.
    expect(validateIntelligenceProfile(p)).toBeNull();
  });
});

describe("NI Doctrine · Section 16 requirement #5 · LLM cannot be hidden and classified as NATIVE", () => {
  it("detectHiddenLLMClaim rejects NATIVE profile with delegated_capabilities", () => {
    const p = profile({
      status: "NATIVE",
      maturity: "NI-1",
      native_capabilities: [evidence("classify")],
      delegated_capabilities: [delegation("secretly-uses-llm")],
    });
    expect(detectHiddenLLMClaim(p)).toMatch(/hidden_llm_claim/);
  });

  it("validateIntelligenceProfile catches the same violation", () => {
    const p = profile({
      status: "NATIVE",
      maturity: "NI-1",
      native_capabilities: [evidence("classify")],
      delegated_capabilities: [delegation("secretly-uses-llm")],
    });
    expect(validateIntelligenceProfile(p)).toMatch(/NATIVE.*forbids delegated_capabilities/);
  });

  it("compliant HYBRID declaration is accepted", () => {
    const p = profile({
      status: "HYBRID",
      maturity: "NI-2",
      native_capabilities: [evidence("retrieve")],
      delegated_capabilities: [delegation("llm-compose")],
    });
    expect(detectHiddenLLMClaim(p)).toBeNull();
    expect(validateIntelligenceProfile(p)).toBeNull();
  });
});

describe("NI Doctrine · Section 16 requirement #6 · Capability claims must have evidence", () => {
  it("native capability with test_count=0 AND empty test_paths is REJECTED", () => {
    const evidenceWithNoTests: Nex1IntelligenceEvidence = {
      capability: "phantom-capability",
      implementation_path: "src/lib/phantom.ts",
      test_paths: [],
      test_count: 0,
      version: "v0.1.0",
      last_verified_iso: "2026-09-16T00:00:00.000Z",
      scope_positive: [],
      scope_negative: [],
    };
    const p = profile({
      status: "NATIVE",
      maturity: "NI-1",
      native_capabilities: [evidenceWithNoTests],
    });
    expect(validateIntelligenceProfile(p)).toMatch(/no test evidence/);
    expect(hasSufficientEvidence(p)).toBe(false);
  });

  it("native capability with test_count > 0 is accepted", () => {
    const p = profile({
      status: "NATIVE",
      maturity: "NI-1",
      native_capabilities: [evidence("real-capability")],
    });
    expect(hasSufficientEvidence(p)).toBe(true);
  });
});

// ── Section 16 requirement #7 · agent-capability-profile integration ────────

describe("NI Doctrine · integration with agent-capability-profile.ts", () => {
  let tempDir = "";
  let originalRoot: string | undefined;

  beforeEach(() => {
    originalRoot = process.env.NEX_MASTER_AI_DATA_ROOT;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-ni-test-"));
    process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
  });
  afterEach(() => {
    if (originalRoot === undefined) delete process.env.NEX_MASTER_AI_DATA_ROOT;
    else process.env.NEX_MASTER_AI_DATA_ROOT = originalRoot;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("recordCapabilityProfile defaults to UNKNOWN when caller omits intelligence_status", async () => {
    const { recordCapabilityProfile } = await import("./agent-capability-profile");
    const rec = recordCapabilityProfile({
      agent_id: "test_agent",
      mission: "Test agent for NI integration",
      domains: [],
      skills: [],
      evidence_refs: [],
      benchmark_performance_summary: "-",
      known_weaknesses: [],
      reliability: "MEDIUM",
      recent_failure_refs: [],
      learning_trajectory: "STABLE",
      knowledge_dependencies: [],
      current_state: "REGISTERED",
      resource_cost_profile: {
        approximate_monthly_compute_hours: null,
        approximate_monthly_storage_mb: null,
        approximate_monthly_research_requests: null,
        approximate_monthly_cost_idr: null,
      },
      supersedes: null,
      created_by: "test",
    });
    expect(rec.intelligence_status.status).toBe("UNKNOWN");
  });

  it("recordCapabilityProfile REJECTS a NATIVE claim with no native_capabilities", async () => {
    const { recordCapabilityProfile } = await import("./agent-capability-profile");
    expect(() =>
      recordCapabilityProfile({
        agent_id: "test_agent",
        mission: "Test agent for NI integration",
        domains: [],
        skills: [],
        evidence_refs: [],
        benchmark_performance_summary: "-",
        known_weaknesses: [],
        reliability: "MEDIUM",
        recent_failure_refs: [],
        learning_trajectory: "STABLE",
        knowledge_dependencies: [],
        current_state: "REGISTERED",
        resource_cost_profile: {
          approximate_monthly_compute_hours: null,
          approximate_monthly_storage_mb: null,
          approximate_monthly_research_requests: null,
          approximate_monthly_cost_idr: null,
        },
        supersedes: null,
        created_by: "test",
        intelligence_status: {
          status: "NATIVE",
          maturity: "NI-1",
          native_capabilities: [], // ← the violation
          delegated_capabilities: [],
          unsupported_capabilities: [],
          rejected_claims: [],
          last_audit_iso: "2026-09-16T00:00:00.000Z",
          taught_by: "master_ai_engineer",
        },
      }),
    ).toThrow(/intelligence_status/);
  });

  it("recordCapabilityProfile REJECTS a hidden-LLM NATIVE claim (delegation present)", async () => {
    const { recordCapabilityProfile } = await import("./agent-capability-profile");
    expect(() =>
      recordCapabilityProfile({
        agent_id: "test_agent",
        mission: "Test agent for NI integration",
        domains: [],
        skills: [],
        evidence_refs: [],
        benchmark_performance_summary: "-",
        known_weaknesses: [],
        reliability: "MEDIUM",
        recent_failure_refs: [],
        learning_trajectory: "STABLE",
        knowledge_dependencies: [],
        current_state: "REGISTERED",
        resource_cost_profile: {
          approximate_monthly_compute_hours: null,
          approximate_monthly_storage_mb: null,
          approximate_monthly_research_requests: null,
          approximate_monthly_cost_idr: null,
        },
        supersedes: null,
        created_by: "test",
        intelligence_status: {
          status: "NATIVE",
          maturity: "NI-2",
          native_capabilities: [evidence("legit-native-thing")],
          delegated_capabilities: [delegation("but-also-uses-an-llm")],
          unsupported_capabilities: [],
          rejected_claims: [],
          last_audit_iso: "2026-09-16T00:00:00.000Z",
          taught_by: "master_ai_engineer",
        },
      }),
    ).toThrow(/intelligence_status/);
  });

  it("recordCapabilityProfile accepts a legitimate HYBRID claim", async () => {
    const { recordCapabilityProfile } = await import("./agent-capability-profile");
    const rec = recordCapabilityProfile({
      agent_id: "staircase_advisor",
      mission: "Staircase advisor · retrieval + LLM composition",
      domains: ["staircase"],
      skills: [],
      evidence_refs: [],
      benchmark_performance_summary: "-",
      known_weaknesses: [],
      reliability: "MEDIUM",
      recent_failure_refs: [],
      learning_trajectory: "STABLE",
      knowledge_dependencies: [],
      current_state: "REGISTERED",
      resource_cost_profile: {
        approximate_monthly_compute_hours: null,
        approximate_monthly_storage_mb: null,
        approximate_monthly_research_requests: null,
        approximate_monthly_cost_idr: null,
      },
      supersedes: null,
      created_by: "test",
      intelligence_status: {
        status: "HYBRID",
        maturity: "NI-2",
        native_capabilities: [evidence("staircase-index")],
        delegated_capabilities: [delegation("advisor-composer")],
        unsupported_capabilities: [],
        rejected_claims: [],
        last_audit_iso: "2026-09-16T00:00:00.000Z",
        taught_by: "master_ai_engineer",
      },
    });
    expect(rec.intelligence_status.status).toBe("HYBRID");
  });
});

// ── Section 16 requirement #8 · NEX1 No-LLM Hard Rule intact ────────────────

describe("NI Doctrine · NEX1 No-LLM Hard Rule invariant", () => {
  it("nex-agent/** contains no LLM SDK imports (invariant)", () => {
    // Static invariant check performed by in-process file walk. If nex-agent
    // grows an LLM SDK import, this test fails immediately and announces the
    // No-LLM Hard Rule as broken.
    const projectRoot = process.cwd();
    const nexAgentDir = path.join(projectRoot, "src", "lib", "nex-agent");
    if (!fs.existsSync(nexAgentDir)) {
      throw new Error(`src/lib/nex-agent does not exist at ${nexAgentDir}`);
    }
    const bannedPackages = [
      "@anthropic-ai/sdk",
      "openai",
      "@google/generative-ai",
      "@google-ai/generativelanguage",
      "groq-sdk",
      "ollama",
      "together-ai",
      "cohere-ai",
      "replicate",
    ];
    const violations: string[] = [];
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".next") continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
        const content = fs.readFileSync(full, "utf8");
        for (const pkg of bannedPackages) {
          const patterns = [
            `from '${pkg}'`,
            `from "${pkg}"`,
            `require('${pkg}')`,
            `require("${pkg}")`,
          ];
          if (patterns.some((p) => content.includes(p))) {
            violations.push(`${full}: banned import '${pkg}'`);
          }
        }
      }
    }
    walk(nexAgentDir);
    if (violations.length > 0) {
      throw new Error(
        `NEX1 No-LLM Hard Rule VIOLATED — LLM SDK imports found in src/lib/nex-agent/:\n${violations.join("\n")}`,
      );
    }
    expect(violations).toEqual([]);
  });
});
