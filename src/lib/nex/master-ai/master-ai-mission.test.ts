// src/lib/nex/master-ai/master-ai-mission.test.ts
//
// NEX Master AI · Global Free/Low-Cost Connectivity Intelligence Mission
// Contract tests · Philip 2026-09-07 · AUTHORIZE (research + intelligence)
//
// Covers:
//   · WhoPays enum meaning is complete (no unknown value missing a meaning)
//   · COUNTRY_CATALOGUE is frozen and includes 10+ countries + Indonesia
//   · composeGlobalConnectivityReport honours honesty invariants:
//       - empty ledger → answer=UNKNOWN, evidence_strength=NONE
//       - no primary Indonesian evidence → answer NEVER YES
//       - global ALLOWED_NOW without ID ALLOWED_NOW → PARTIAL
//       - two-phone proof only "ready" if ALLOWED_NOW device-to-device ID evidence exists

import { describe, it, expect } from "vitest";

describe("Global Connectivity Intelligence Mission · domain (§5 §6 §14)", () => {
  it("WhoPays enum · every value carries a meaning statement", async () => {
    const { WHO_PAYS_MEANING } = await import("./connectivity-mission-domain");
    const values = [
      "SELF_PAY", "GOVERNMENT", "MUNICIPALITY", "UNIVERSAL_SERVICE_FUND",
      "ISP_WHOLESALE", "SPONSOR_ADVERTISER", "UNIVERSITY_INSTITUTION",
      "COMMUNITY_COOPERATIVE", "DONOR_PHILANTHROPY", "CROSS_SUBSIDY",
      "GENUINELY_OPEN_LOCAL", "MULTIPLE", "UNKNOWN",
    ];
    for (const v of values) {
      expect(WHO_PAYS_MEANING).toHaveProperty(v);
      expect((WHO_PAYS_MEANING as Record<string, string>)[v].length).toBeGreaterThan(10);
    }
    expect(Object.isFrozen(WHO_PAYS_MEANING)).toBe(true);
  });

  it("COUNTRY_CATALOGUE · frozen · Indonesia + ≥10 countries", async () => {
    const { COUNTRY_CATALOGUE, findCountry } = await import("./connectivity-mission-domain");
    expect(Object.isFrozen(COUNTRY_CATALOGUE)).toBe(true);
    expect(COUNTRY_CATALOGUE.length).toBeGreaterThanOrEqual(10);
    expect(findCountry("ID")?.name).toBe("Indonesia");
    expect(findCountry("DE")?.name).toBe("Germany");
    expect(findCountry("ES")?.name).toBe("Spain");
    // No country entry claims Indonesian legality
    const id = findCountry("ID")!;
    expect(id.notes.toLowerCase()).not.toMatch(/allowed_now|allowed now/);
  });

  it("empty ledger · final_answer=UNKNOWN · evidence_strength=NONE", async () => {
    const { composeGlobalConnectivityReport } = await import("./connectivity-mission-domain");
    const r = composeGlobalConnectivityReport([]);
    expect(r.final_answer).toBe("UNKNOWN");
    expect(r.evidence_strength).toBe("NONE");
    expect(r.global_discoveries.total_findings).toBe(0);
    expect(r.indonesia_analysis.primary_regulator_evidence_present).toBe(false);
  });

  it("global ALLOWED_NOW but no ID ALLOWED_NOW · answer=PARTIAL", async () => {
    const { composeGlobalConnectivityReport } = await import("./connectivity-mission-domain");
    const findings = [
      mkFinding({ jurisdiction: "DE", category: "ALLOWED_NOW", authority_tier: "TIER_2" }),
      mkFinding({ jurisdiction: "ID", category: "UNKNOWN", authority_tier: "TIER_3", uncertainty_note: "Wikipedia only" }),
    ] as any;
    const r = composeGlobalConnectivityReport(findings);
    expect(r.final_answer).toBe("PARTIAL");
    expect(r.final_answer_reasoning).toMatch(/global_ALLOWED_NOW_finding/);
  });

  it("ID ALLOWED_NOW + primary evidence · answer=CONDITIONAL not YES", async () => {
    const { composeGlobalConnectivityReport } = await import("./connectivity-mission-domain");
    const findings = [
      mkFinding({ jurisdiction: "ID", category: "ALLOWED_NOW", authority_tier: "TIER_2" }),
    ] as any;
    const r = composeGlobalConnectivityReport(findings);
    expect(r.final_answer).toBe("CONDITIONAL");
    expect(r.indonesia_analysis.primary_regulator_evidence_present).toBe(true);
  });

  it("two_phone_proof_ready · only if Indonesian ALLOWED_NOW device-to-device evidence exists", async () => {
    const { composeGlobalConnectivityReport } = await import("./connectivity-mission-domain");
    const notReady = composeGlobalConnectivityReport([
      mkFinding({ jurisdiction: "ID", category: "UNKNOWN", authority_tier: "TIER_3", uncertainty_note: "gap" }),
    ] as any);
    expect(notReady.two_phone_proof_ready).toBe(false);

    const ready = composeGlobalConnectivityReport([
      mkFinding({
        jurisdiction: "ID", category: "ALLOWED_NOW", authority_tier: "TIER_2",
        statement: "Wi-Fi Direct is permitted for device-to-device communication under Regulation X (indoor use, EIRP < 100mW)",
      }),
    ] as any);
    expect(ready.two_phone_proof_ready).toBe(true);
  });

  it("who_pays UNKNOWN count · honestly reports evidence gap in biggest_unknowns", async () => {
    const { composeGlobalConnectivityReport } = await import("./connectivity-mission-domain");
    const findings = Array.from({ length: 5 }, () =>
      mkFinding({ jurisdiction: "DE", category: "REQUIRES_LICENSE", authority_tier: "TIER_3", who_pays: null }),
    ) as any;
    const r = composeGlobalConnectivityReport(findings);
    expect(r.biggest_unknowns.some((u) => u.startsWith("more_than_half_of_findings_lack_who_pays_evidence"))).toBe(true);
  });
});

function mkFinding(overrides: Partial<any> = {}) {
  return {
    finding_id: "test-" + Math.random().toString(36).slice(2, 10),
    created_at_iso: new Date().toISOString(),
    jurisdiction: overrides.jurisdiction ?? "GLOBAL",
    topic: overrides.topic ?? "OTHER",
    band_slug: overrides.band_slug ?? null,
    architecture_slug: overrides.architecture_slug ?? null,
    business_model_slug: overrides.business_model_slug ?? null,
    category: overrides.category ?? "UNKNOWN",
    authority_tier: overrides.authority_tier ?? "TIER_3",
    statement: overrides.statement ?? "test statement about connectivity",
    citation: "test",
    evidence_ref: null,
    uncertainty_note: overrides.uncertainty_note ?? null,
    supersedes: null,
    created_by: "test",
    who_pays: overrides.who_pays === undefined ? "UNKNOWN" : overrides.who_pays,
  };
}
