// src/lib/nex/programmer-learning/knowledge-evolution.test.ts
//
// Phase 10 · knowledge evolution · contract tests

import { describe, it, expect } from "vitest";
import { detectStaleness, detectContradictions, proposeSupersessions, generateEvolutionReport } from "./knowledge-evolution";
import type { KnowledgeItem } from "./types";

function mk(id: string, overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    knowledge_id: id,
    statement: "some statement",
    domain: "test",
    provenance: {
      source: "test",
      source_type: "internal_test",
      source_url: null,
      authority_tier: "TIER_3",
      retrieved_at: new Date().toISOString(),
      evidence_pointer: "test",
      observed_by: "system",
    },
    verification_status: "VERIFIED",
    confidence: 0.9,
    content_hash: `hash_${id}`,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Staleness ─────────────────────────────────────────

describe("Phase 10 · staleness detection · per-domain policies", () => {
  it("fresh knowledge (created today) is FRESH regardless of domain", () => {
    const items = [
      mk("k1", { domain: "ui", created_at: new Date().toISOString() }),
      mk("k2", { domain: "network", created_at: new Date().toISOString() }),
    ];
    const stale = detectStaleness(items);
    expect(stale.every((s) => s.status === "FRESH")).toBe(true);
  });

  it("UI knowledge older than 90 days is STALE", () => {
    const now = new Date();
    const past = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
    const items = [mk("k_ui_old", { domain: "ui", created_at: past.toISOString() })];
    const stale = detectStaleness(items, now);
    expect(stale[0].status).toBe("STALE_BUT_USABLE");
    expect(stale[0].freshness_policy_days).toBe(90);
  });

  it("UI knowledge older than 135 days (>1.5x 90) is STALE (not usable)", () => {
    const now = new Date();
    const past = new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000);
    const items = [mk("k_ui_very_old", { domain: "ui.design_practice", created_at: past.toISOString() })];
    const stale = detectStaleness(items, now);
    expect(stale[0].status).toBe("STALE");
  });

  it("network knowledge 200 days old is still FRESH (365-day policy)", () => {
    const now = new Date();
    const past = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);
    const items = [mk("k_net", { domain: "network.resilience", created_at: past.toISOString() })];
    const stale = detectStaleness(items, now);
    expect(stale[0].status).toBe("FRESH");
  });

  it("unknown domain falls back to default 365-day policy", () => {
    const now = new Date();
    const past = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
    const items = [mk("k_unk", { domain: "obscure_domain_never_registered", created_at: past.toISOString() })];
    const stale = detectStaleness(items, now);
    expect(stale[0].freshness_policy_days).toBe(365);
    expect(stale[0].status).toBe("STALE_BUT_USABLE");
  });
});

// ─── Contradictions ────────────────────────────────────

describe("Phase 10 · contradiction detection · domain-aware · conservative", () => {
  it("same-domain must-include vs must-not-include on same token → contradiction detected", () => {
    const items = [
      mk("k1", { domain: "network", statement: "For network calls the implementation must include retry with backoff." }),
      mk("k2", { domain: "network", statement: "For network calls the implementation must not include retry with backoff." }),
    ];
    const pairs = detectContradictions(items);
    expect(pairs.length).toBe(1);
    expect(pairs[0].contradiction_signal).toContain("retry");
    expect(pairs[0].confidence).toBe("high");
  });

  it("DIFFERENT-domain must-include vs must-not-include is NOT flagged (domain-awareness)", () => {
    const items = [
      mk("k1", { domain: "network", statement: "the implementation must include retry." }),
      mk("k2", { domain: "ui", statement: "the implementation must not include retry." }),
    ];
    const pairs = detectContradictions(items);
    expect(pairs.length).toBe(0);
  });

  it("same-domain complementary statements (no clash) → no false positive", () => {
    const items = [
      mk("k1", { domain: "network", statement: "the network client must include timeout." }),
      mk("k2", { domain: "network", statement: "the network client must include retry with backoff." }),
    ];
    const pairs = detectContradictions(items);
    expect(pairs.length).toBe(0);
  });

  it("returns an empty array on an empty store", () => {
    expect(detectContradictions([])).toEqual([]);
  });
});

// ─── Supersession proposals ─────────────────────────────

describe("Phase 10 · supersession proposals · never auto-apply · Founder approval required", () => {
  it("newer + same-tier + higher-confidence same-topic knowledge → proposal", () => {
    const now = Date.now();
    const older = mk("k_old", {
      domain: "network",
      technology: "network.resilience",
      created_at: new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString(),
      confidence: 0.7,
      provenance: { source: "old", source_type: "external_documentation", source_url: null, authority_tier: "TIER_3", retrieved_at: new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString(), evidence_pointer: "old", observed_by: "system" },
    });
    const newer = mk("k_new", {
      domain: "network",
      technology: "network.resilience",
      created_at: new Date().toISOString(),
      confidence: 0.9,
      provenance: { source: "new", source_type: "external_documentation", source_url: null, authority_tier: "TIER_1", retrieved_at: new Date().toISOString(), evidence_pointer: "new", observed_by: "system" },
    });
    const props = proposeSupersessions([older, newer]);
    expect(props.length).toBe(1);
    expect(props[0].older_knowledge_id).toBe("k_old");
    expect(props[0].newer_knowledge_id).toBe("k_new");
    expect(props[0].requires_founder_approval).toBe(true);
  });

  it("newer with LOWER authority tier → NO proposal (tier regression not allowed)", () => {
    const now = Date.now();
    const older = mk("k_high_tier", {
      domain: "network", technology: "network.resilience",
      created_at: new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString(),
      confidence: 0.9,
      provenance: { source: "old", source_type: "external_documentation", source_url: null, authority_tier: "TIER_1", retrieved_at: new Date().toISOString(), evidence_pointer: "old", observed_by: "system" },
    });
    const newer = mk("k_low_tier", {
      domain: "network", technology: "network.resilience",
      created_at: new Date().toISOString(),
      confidence: 0.7,
      provenance: { source: "new", source_type: "external_documentation", source_url: null, authority_tier: "TIER_3", retrieved_at: new Date().toISOString(), evidence_pointer: "new", observed_by: "system" },
    });
    const props = proposeSupersessions([older, newer]);
    expect(props.length).toBe(0);
  });

  it("different-technology items in same domain → no proposal", () => {
    const items = [
      mk("k1", { domain: "network", technology: "network.timeout", created_at: new Date(Date.now() - 100 * 86400000).toISOString() }),
      mk("k2", { domain: "network", technology: "network.retry", created_at: new Date().toISOString() }),
    ];
    expect(proposeSupersessions(items).length).toBe(0);
  });
});

// ─── Full report ─────────────────────────────────────────

describe("Phase 10 · generateEvolutionReport", () => {
  it("empty store → zero counts · no fabrication", () => {
    const r = generateEvolutionReport([]);
    expect(r.scanned_count).toBe(0);
    expect(r.stale_items).toEqual([]);
    expect(r.contradictions).toEqual([]);
    expect(r.supersession_proposals).toEqual([]);
    expect(r.domains_covered).toEqual([]);
  });

  it("mixed store surfaces stale + contradictions + supersessions independently", () => {
    const now = Date.now();
    const items = [
      mk("k_ui_stale", { domain: "ui", created_at: new Date(now - 200 * 86400000).toISOString() }),
      mk("k_net_contra_a", { domain: "network", statement: "the client must include timeout." }),
      mk("k_net_contra_b", { domain: "network", statement: "the client must not include timeout." }),
      mk("k_older_super", { domain: "security", technology: "security.input", created_at: new Date(now - 100 * 86400000).toISOString(), confidence: 0.7 }),
      mk("k_newer_super", { domain: "security", technology: "security.input", created_at: new Date().toISOString(), confidence: 0.9 }),
    ];
    const r = generateEvolutionReport(items);
    expect(r.scanned_count).toBe(5);
    expect(r.stale_items.length).toBeGreaterThan(0);
    expect(r.contradictions.length).toBe(1);
    expect(r.supersession_proposals.length).toBe(1);
    expect(r.domains_covered).toContain("network");
    expect(r.domains_covered).toContain("security");
    expect(r.domains_covered).toContain("ui");
  });
});
