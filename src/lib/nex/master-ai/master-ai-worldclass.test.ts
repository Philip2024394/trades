// src/lib/nex/master-ai/master-ai-worldclass.test.ts
//
// NEX Master AI · World-Class Capability · contract tests
// Philip 2026-09-07 · AUTHORIZE

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tempDir = "";
let origMasterRoot: string | undefined;

beforeEach(() => {
  origMasterRoot = process.env.NEX_MASTER_AI_DATA_ROOT;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-wc-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
  fs.mkdirSync(process.env.NEX_MASTER_AI_DATA_ROOT, { recursive: true });
});
afterEach(() => {
  if (origMasterRoot === undefined) delete process.env.NEX_MASTER_AI_DATA_ROOT;
  else process.env.NEX_MASTER_AI_DATA_ROOT = origMasterRoot;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ═══════════════════════════════════════════════════════════════════
// Storage intelligence (§1-§7)
// ═══════════════════════════════════════════════════════════════════

describe("Storage intelligence · provider catalogue (§1)", () => {
  it("REJECTS provider without https terms URL", async () => {
    const { recordStorageProvider } = await import("./storage-intelligence");
    expect(() => recordStorageProvider({
      provider_slug: "bad", legal_name: "Bad Co", parent_org: null,
      hq_country: "US", service_kind: "OBJECT_STORAGE",
      published_free_tier: { storage_gb: 10, egress_gb_per_month: null, api_requests_per_month: null, additional_notes: "" },
      published_terms_url: "ftp://bad.example",
      data_portability_supported: true,
      security_characteristics: [], known_regions: [],
      suitable_data_classes: ["CACHE"],
      policy_risk: "LOW",
      reliability_note: "test note here",
      reputation_note: "test reputation note",
      evidence_confidence: "MEDIUM", notes: "-",
    })).toThrow(/published_terms_url_required_https/);
  });

  it("ACCEPTS well-formed provider · currentProviders returns latest per slug", async () => {
    const { recordStorageProvider, currentProviders } = await import("./storage-intelligence");
    recordStorageProvider({
      provider_slug: "test_r2", legal_name: "Test Object Storage", parent_org: null,
      hq_country: "US", service_kind: "OBJECT_STORAGE",
      published_free_tier: { storage_gb: 10, egress_gb_per_month: null, api_requests_per_month: 1_000_000, additional_notes: "" },
      published_terms_url: "https://example.com/terms",
      data_portability_supported: true,
      security_characteristics: ["AT_REST_ENCRYPTION", "TRANSIT_ENCRYPTION"],
      known_regions: ["us-east"], suitable_data_classes: ["CACHE", "BACKUP"],
      policy_risk: "LOW",
      reliability_note: "Public-cloud grade",
      reputation_note: "Widely known enterprise provider",
      evidence_confidence: "HIGH", notes: "-",
    });
    // Update
    recordStorageProvider({
      provider_slug: "test_r2", legal_name: "Test Object Storage", parent_org: null,
      hq_country: "US", service_kind: "OBJECT_STORAGE",
      published_free_tier: { storage_gb: 15, egress_gb_per_month: null, api_requests_per_month: 1_000_000, additional_notes: "" },
      published_terms_url: "https://example.com/terms",
      data_portability_supported: true,
      security_characteristics: ["AT_REST_ENCRYPTION", "TRANSIT_ENCRYPTION"],
      known_regions: ["us-east"], suitable_data_classes: ["CACHE", "BACKUP"],
      policy_risk: "LOW",
      reliability_note: "Public-cloud grade",
      reputation_note: "Widely known enterprise provider · re-verified with updated tier",
      evidence_confidence: "HIGH", notes: "-",
    });
    const current = currentProviders();
    expect(current.length).toBe(1);
    expect(current[0].published_free_tier.storage_gb).toBe(15);
  });
});

describe("Storage intelligence · utilization + forecasting (§2 §5)", () => {
  it("recordUtilization computes headroom from provider cap", async () => {
    const { recordStorageProvider, recordUtilization } = await import("./storage-intelligence");
    recordStorageProvider({
      provider_slug: "p1", legal_name: "P1", parent_org: null, hq_country: "US",
      service_kind: "OBJECT_STORAGE",
      published_free_tier: { storage_gb: 100, egress_gb_per_month: null, api_requests_per_month: null, additional_notes: "" },
      published_terms_url: "https://example.com/terms",
      data_portability_supported: true, security_characteristics: [], known_regions: [],
      suitable_data_classes: ["CACHE"], policy_risk: "LOW",
      reliability_note: "-------------------",
      reputation_note: "reputation note goes here",
      evidence_confidence: "MEDIUM", notes: "",
    });
    const u = recordUtilization({
      provider_slug: "p1", used_gb: 40, used_api_requests_last_day: 0, used_egress_gb_last_day: 0,
      source: "MEASURED", note: "test",
    });
    expect(u.headroom_gb).toBe(60);
    expect(u.headroom_pct).toBeCloseTo(0.6, 4);
  });

  it("forecast triggers needs_action when projected to cross safe threshold in ≤30 days", async () => {
    const { recordStorageProvider, recordUtilization, computeForecast } = await import("./storage-intelligence");
    recordStorageProvider({
      provider_slug: "p2", legal_name: "P2", parent_org: null, hq_country: "US",
      service_kind: "OBJECT_STORAGE",
      published_free_tier: { storage_gb: 100, egress_gb_per_month: null, api_requests_per_month: null, additional_notes: "" },
      published_terms_url: "https://example.com/terms",
      data_portability_supported: true, security_characteristics: [], known_regions: [],
      suitable_data_classes: ["CACHE"], policy_risk: "LOW",
      reliability_note: "-------------------",
      reputation_note: "reputation note",
      evidence_confidence: "MEDIUM", notes: "",
    });
    // Two observations 10 days apart · 50GB growth · daily 5 · would cross safe threshold (80GB) in ((80-70)/5)=2 days from now
    const t0 = Date.now() - 10 * 24 * 60 * 60 * 1000;
    fs.appendFileSync(path.join(process.env.NEX_MASTER_AI_DATA_ROOT!, "storage_utilization.jsonl"),
      JSON.stringify({ utilization_id: "u1", observed_at_iso: new Date(t0).toISOString(), provider_slug: "p2", used_gb: 20, used_api_requests_last_day: 0, used_egress_gb_last_day: 0, headroom_gb: 80, headroom_pct: 0.8, source: "MEASURED", note: "" }) + "\n", "utf8");
    recordUtilization({ provider_slug: "p2", used_gb: 70, used_api_requests_last_day: 0, used_egress_gb_last_day: 0, source: "MEASURED", note: "" });
    const f = computeForecast({ provider_slug: "p2", window_days: 30 });
    expect(f.needs_action).toBe(true);
    expect(f.action_recommendation).toContain("cross safe threshold");
  });
});

describe("Storage intelligence · placement (§6 §7)", () => {
  it("PRIVATE data requires AT_REST_ENCRYPTION · rejects providers without it", async () => {
    const { recordStorageProvider, recommendPlacement } = await import("./storage-intelligence");
    recordStorageProvider({
      provider_slug: "unenc", legal_name: "Unencrypted", parent_org: null, hq_country: "US",
      service_kind: "OBJECT_STORAGE",
      published_free_tier: { storage_gb: 100, egress_gb_per_month: null, api_requests_per_month: null, additional_notes: "" },
      published_terms_url: "https://example.com/terms",
      data_portability_supported: true, security_characteristics: ["TRANSIT_ENCRYPTION"], known_regions: [],
      suitable_data_classes: ["PRIVATE"], policy_risk: "LOW",
      reliability_note: "reliability note here",
      reputation_note: "reputation note here",
      evidence_confidence: "MEDIUM", notes: "",
    });
    recordStorageProvider({
      provider_slug: "enc", legal_name: "Encrypted", parent_org: null, hq_country: "US",
      service_kind: "OBJECT_STORAGE",
      published_free_tier: { storage_gb: 100, egress_gb_per_month: null, api_requests_per_month: null, additional_notes: "" },
      published_terms_url: "https://example.com/terms",
      data_portability_supported: true,
      security_characteristics: ["AT_REST_ENCRYPTION", "TRANSIT_ENCRYPTION"],
      known_regions: [], suitable_data_classes: ["PRIVATE"], policy_risk: "LOW",
      reliability_note: "reliability note here",
      reputation_note: "reputation note here",
      evidence_confidence: "HIGH", notes: "",
    });
    const r = recommendPlacement({ data_class: "PRIVATE", approx_size_gb: 5 });
    expect(r.recommended_provider_slug).toBe("enc");
    const unencReason = r.rejected_alternatives.find((x) => x.provider_slug === "unenc");
    expect(unencReason?.reason).toContain("AT_REST_ENCRYPTION");
  });

  it("PRIMARY / USER / MODEL data classes trigger redundancy_recommended", async () => {
    const { recordStorageProvider, recommendPlacement } = await import("./storage-intelligence");
    recordStorageProvider({
      provider_slug: "any", legal_name: "Any", parent_org: null, hq_country: "US",
      service_kind: "OBJECT_STORAGE",
      published_free_tier: { storage_gb: 100, egress_gb_per_month: null, api_requests_per_month: null, additional_notes: "" },
      published_terms_url: "https://example.com/terms",
      data_portability_supported: true,
      security_characteristics: ["AT_REST_ENCRYPTION"], known_regions: [],
      suitable_data_classes: ["PRIMARY", "USER", "MODEL", "CACHE"],
      policy_risk: "LOW",
      reliability_note: "reliability note here",
      reputation_note: "reputation note here",
      evidence_confidence: "MEDIUM", notes: "",
    });
    expect(recommendPlacement({ data_class: "PRIMARY", approx_size_gb: 1 }).redundancy_recommended).toBe(true);
    expect(recommendPlacement({ data_class: "USER", approx_size_gb: 1 }).redundancy_recommended).toBe(true);
    expect(recommendPlacement({ data_class: "MODEL", approx_size_gb: 1 }).redundancy_recommended).toBe(true);
    expect(recommendPlacement({ data_class: "CACHE", approx_size_gb: 1 }).redundancy_recommended).toBe(false);
  });

  it("returns null recommended_provider when no suitable provider exists", async () => {
    const { recommendPlacement } = await import("./storage-intelligence");
    const r = recommendPlacement({ data_class: "ARCHIVE", approx_size_gb: 500 });
    expect(r.recommended_provider_slug).toBeNull();
    expect(r.reason).toContain("No suitable provider");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Local knowledge intelligence (§9)
// ═══════════════════════════════════════════════════════════════════

describe("Local knowledge intelligence (§9)", () => {
  it("REJECTS profile with country_code that is not ISO-2", async () => {
    const { recordLocalKnowledgeProfile } = await import("./local-knowledge-intelligence");
    expect(() => recordLocalKnowledgeProfile({
      scope: "CITY", location_slug: "id-jkt", display_name: "Jakarta",
      primary_language_codes: ["id"], country_code: "IDN",
      items: [{
        item_id: "i1", category: "LANGUAGE", headline: "Bahasa Indonesia is primary",
        detail: "-", evidence_status: "SECONDARY", source_refs: [], original_language: "id",
        observed_at_iso: new Date().toISOString(), freshness_expires_iso: null, confidence: "MEDIUM",
      }],
      overall_freshness_note: "-", overall_confidence: "MEDIUM",
      supersedes: null, created_by: "test",
    })).toThrow(/country_code_must_be_iso2/);
  });

  it("REJECTS item with UNKNOWN evidence + non-LOW confidence", async () => {
    const { recordLocalKnowledgeProfile } = await import("./local-knowledge-intelligence");
    expect(() => recordLocalKnowledgeProfile({
      scope: "CITY", location_slug: "id-jkt", display_name: "Jakarta",
      primary_language_codes: ["id"], country_code: "ID",
      items: [{
        item_id: "i1", category: "SAFETY", headline: "Very safe (heuristic)",
        detail: "-", evidence_status: "UNKNOWN", source_refs: [],
        original_language: null,
        observed_at_iso: new Date().toISOString(), freshness_expires_iso: null,
        confidence: "HIGH",
      }],
      overall_freshness_note: "-", overall_confidence: "MEDIUM",
      supersedes: null, created_by: "test",
    })).toThrow(/unknown_evidence_requires_LOW_confidence/);
  });

  it("ACCEPTS well-formed profile · staleItems flags expired items", async () => {
    const { recordLocalKnowledgeProfile, staleItems } = await import("./local-knowledge-intelligence");
    const pastIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    recordLocalKnowledgeProfile({
      scope: "CITY", location_slug: "id-jkt", display_name: "Jakarta",
      primary_language_codes: ["id"], country_code: "ID",
      items: [
        {
          item_id: "i1", category: "LANGUAGE",
          headline: "Bahasa Indonesia is the primary language",
          detail: "Widely spoken across all districts", evidence_status: "SECONDARY",
          source_refs: ["wikipedia:jakarta"], original_language: "en",
          observed_at_iso: new Date().toISOString(),
          freshness_expires_iso: null, confidence: "HIGH",
        },
        {
          item_id: "i2", category: "TRANSPORT",
          headline: "TransJakarta bus rapid transit + MRT",
          detail: "-", evidence_status: "SECONDARY",
          source_refs: ["wikipedia:transjakarta"], original_language: "en",
          observed_at_iso: new Date().toISOString(),
          freshness_expires_iso: pastIso,          // stale
          confidence: "MEDIUM",
        },
      ],
      overall_freshness_note: "-", overall_confidence: "MEDIUM",
      supersedes: null, created_by: "test",
    });
    const stale = staleItems("id-jkt");
    expect(stale.length).toBe(1);
    expect(stale[0].category).toBe("TRANSPORT");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Cross-agent intelligence (§17)
// ═══════════════════════════════════════════════════════════════════

describe("Cross-agent intelligence (§17)", () => {
  it("REJECTS flow with same source and target agent", async () => {
    const { recordFlow } = await import("./cross-agent-intelligence");
    expect(() => recordFlow({
      kind: "SKILL_TRANSFER_PROPOSAL",
      source_agent_id: "agent_a", target_agent_id: "agent_a",
      source_evidence_refs: ["e1"],
      hypothesis: "sufficient hypothesis text",
      expected_improvement: "-", compatibility: "UNKNOWN",
      compatibility_reasoning: "-", status: "DETECTED",
      proposal_id: null, benchmark_before_ref: null, benchmark_after_ref: null,
      reviewer_notes: null, created_by: "test",
    })).toThrow(/same_agent_source_and_target/);
  });

  it("REJECTS APPROVED status without pre/post benchmarks", async () => {
    const { recordFlow } = await import("./cross-agent-intelligence");
    expect(() => recordFlow({
      kind: "SKILL_TRANSFER_PROPOSAL",
      source_agent_id: "programmer", target_agent_id: "accommodation",
      source_evidence_refs: ["e1"],
      hypothesis: "programmer skill would help accommodation persister",
      expected_improvement: "-", compatibility: "COMPATIBLE_AS_IS",
      compatibility_reasoning: "shared typescript domain", status: "APPROVED",
      proposal_id: "p1", benchmark_before_ref: null, benchmark_after_ref: null,
      reviewer_notes: null, created_by: "test",
    })).toThrow(/approval_requires_pre_and_post_benchmarks/);
  });

  it("detectOpportunities finds candidates where target has matching weakness", async () => {
    const { detectOpportunities } = await import("./cross-agent-intelligence");
    const candidates = detectOpportunities({
      agent_profiles: [
        { agent_id: "programmer", skills: [{ skill_slug: "deterministic_review", version: "v1", benchmark_score: 90 }], known_weaknesses: [] },
        { agent_id: "accommodation", skills: [], known_weaknesses: ["deterministic review process is inconsistent"] },
      ],
    });
    expect(candidates.length).toBe(1);
    expect(candidates[0].source_agent_id).toBe("programmer");
    expect(candidates[0].target_agent_id).toBe("accommodation");
    expect(candidates[0].skill_slug).toBe("deterministic_review");
  });

  it("assessCompatibility · shared domains produce direct transfer", async () => {
    const { assessCompatibility } = await import("./cross-agent-intelligence");
    const r = assessCompatibility({
      source_agent_domains: ["typescript", "vitest", "react"],
      target_agent_domains: ["typescript", "vitest"],
      skill_kind: "DOMAIN_SPECIFIC",
    });
    expect(r.compatibility).toBe("COMPATIBLE_AS_IS");
  });

  it("assessCompatibility · no shared domains · INCOMPATIBLE", async () => {
    const { assessCompatibility } = await import("./cross-agent-intelligence");
    const r = assessCompatibility({
      source_agent_domains: ["typescript"],
      target_agent_domains: ["postgresql", "data-classification"],
      skill_kind: "DOMAIN_SPECIFIC",
    });
    expect(r.compatibility).toBe("INCOMPATIBLE");
  });
});
