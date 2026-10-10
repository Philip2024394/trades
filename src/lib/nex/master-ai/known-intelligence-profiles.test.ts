// src/lib/nex/master-ai/known-intelligence-profiles.test.ts
//
// Verifies that every evidence-backed profile in KNOWN_INTELLIGENCE_PROFILES
// passes the NI Doctrine validation. If a profile is added to the known map
// but fails validation, this test fails immediately.

import { describe, it, expect } from "vitest";
import {
  KNOWN_INTELLIGENCE_PROFILES,
  NEX1_CAPABILITY_A_PROFILE,
  NEX1_COMPOSITE_PROFILE,
  NEX_BRAIN_PROFILE,
  NEX_NEX_ORCHESTRATOR_PROFILE,
} from "./known-intelligence-profiles";
import {
  detectHiddenLLMClaim,
  hasSufficientEvidence,
  validateIntelligenceProfile,
} from "./intelligence-status";

describe("known intelligence profiles · every entry passes NI Doctrine validation", () => {
  it("every profile in KNOWN_INTELLIGENCE_PROFILES validates", () => {
    for (const [slug, profile] of KNOWN_INTELLIGENCE_PROFILES) {
      const error = validateIntelligenceProfile(profile);
      if (error) {
        throw new Error(`known profile '${slug}' fails validation: ${error}`);
      }
      const hidden = detectHiddenLLMClaim(profile);
      if (hidden) {
        throw new Error(`known profile '${slug}' has hidden LLM claim: ${hidden}`);
      }
    }
    expect(KNOWN_INTELLIGENCE_PROFILES.size).toBeGreaterThan(0);
  });

  it("NEX1 profiles are NATIVE and have zero delegated capabilities (No-LLM Hard Rule)", () => {
    const nex1Profiles = [
      NEX1_CAPABILITY_A_PROFILE,
      NEX1_COMPOSITE_PROFILE,
    ];
    for (const p of nex1Profiles) {
      expect(p.status).toBe("NATIVE");
      expect(p.delegated_capabilities.length).toBe(0);
    }
  });

  it("NEX Brain and NEX Nex Orchestrator are honestly labelled AI_DELEGATED", () => {
    expect(NEX_BRAIN_PROFILE.status).toBe("AI_DELEGATED");
    expect(NEX_BRAIN_PROFILE.delegated_capabilities.length).toBeGreaterThan(0);
    expect(NEX_BRAIN_PROFILE.native_capabilities.length).toBe(0);

    expect(NEX_NEX_ORCHESTRATOR_PROFILE.status).toBe("AI_DELEGATED");
    expect(NEX_NEX_ORCHESTRATOR_PROFILE.delegated_capabilities.length).toBeGreaterThan(0);
  });

  it("Staircase Advisor is NOT in the known map (evidence deferred pending test-path verification)", () => {
    // The audit could not locate tests for the deterministic side of the
    // Staircase Advisor, so the doctrine forbids listing it as HYBRID.
    // Under UNKNOWN stays UNKNOWN until direct evidence, this exclusion is
    // CORRECT — surfacing here so future work knows to verify + include.
    expect(KNOWN_INTELLIGENCE_PROFILES.has("staircase_advisor")).toBe(false);
  });

  it("NEX1 composite profile declares Test-20 gaps honestly (13 explicit unsupported capabilities)", () => {
    expect(NEX1_COMPOSITE_PROFILE.unsupported_capabilities.length).toBeGreaterThanOrEqual(10);
    const capabilities = NEX1_COMPOSITE_PROFILE.unsupported_capabilities.map((g) => g.capability);
    expect(capabilities.some((c) => c.includes("source-code-comprehension"))).toBe(true);
    expect(capabilities.some((c) => c.includes("execution-flow"))).toBe(true);
    expect(capabilities.some((c) => c.includes("data-flow"))).toBe(true);
  });

  it("NEX1 composite profile explicitly rejects the '~24/50 skill ladder' claim", () => {
    const rejected = NEX1_COMPOSITE_PROFILE.rejected_claims.join(" · ");
    expect(rejected).toContain("skill ladder");
  });

  it("Capability A has evidence with test_count > 1000 (proven via 1634-test suite)", () => {
    // The evidence must NOT be zero — hasSufficientEvidence checks this too.
    expect(hasSufficientEvidence(NEX1_CAPABILITY_A_PROFILE)).toBe(true);
    const ev = NEX1_CAPABILITY_A_PROFILE.native_capabilities[0]!;
    expect(ev.test_count).toBeGreaterThan(1000);
  });
});
