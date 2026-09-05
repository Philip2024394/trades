// src/lib/nex/brain/business-market-gate.test.ts
// Business v1 · gate + company-intelligence integration tests

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { SessionState } from "./session";
import {
  createIdentityFromInput,
  persistBusinessIdentity,
  persistBusinessProduct,
  persistMarketObjective,
  _resetBusinessStoreForTests,
  type MarketObjective,
  type BusinessProduct,
} from "./business-context";
import {
  persistDiscoveredCompany,
  _resetCompanyStoreForTests,
  computeCompanyId,
  type DiscoveredCompany,
} from "./company-intelligence";
import { decideBusinessMarketGate } from "./business-market-gate";

let tmpDir: string;
beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "biz-gate-"));
  process.env.NEX_BUSINESS_DIR = tmpDir;
  _resetBusinessStoreForTests();
  _resetCompanyStoreForTests();
});

function emptySession(): SessionState {
  return { session_id: "s", conversation_id: "c", entities: [] } as unknown as SessionState;
}

function seedPtFreshOnTime(): string {
  const identity = createIdentityFromInput({
    legal_name: "PT Fresh On Time Seafood",
    display_name: "PT Fresh On Time Seafood",
    country: "Indonesia",
    industry: "seafood",
    description: "Indonesian seafood exporter",
    source: "recruitment_flyer_2026",
    source_type: "authorised_document",
  });
  persistBusinessIdentity(identity);
  const product: BusinessProduct = {
    product_id: "p_tuna",
    business_id: identity.business_id,
    name: "Frozen Tuna",
    category: "seafood",
    created_at: new Date().toISOString(),
    target_markets: ["Japan", "USA", "Europe"],
    attributes: {},
    provenance: identity.provenance,
  };
  persistBusinessProduct(product, identity.business_id);
  const obj: MarketObjective = {
    objective_id: "obj_japan",
    business_id: identity.business_id,
    objective_kind: "FIND_BUYERS",
    target_market: "Japan",
    product_ids: ["p_tuna"],
    created_at: new Date().toISOString(),
    provenance: identity.provenance,
  };
  persistMarketObjective(obj, identity.business_id);
  return identity.business_id;
}

// ═════════════ Non-gate cases ═════════════

describe("decideBusinessMarketGate · pass-through when no commercial signal", () => {
  it("plain 'hello' → no gate", () => {
    const r = decideBusinessMarketGate({
      userMessage: "hello",
      session: emptySession(),
      activeLanguage: "EN",
      business_id: seedPtFreshOnTime(),
    });
    expect(r.shouldGate).toBe(false);
  });
});

// ═════════════ Send blocked (§10 §30) ═════════════

describe("decideBusinessMarketGate · SEND is deterministically blocked", () => {
  it("'send it' → gate fires with send_blocked reply", () => {
    const r = decideBusinessMarketGate({
      userMessage: "send it",
      session: emptySession(),
      activeLanguage: "EN",
      business_id: seedPtFreshOnTime(),
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.reason.startsWith("send_blocked")).toBe(true);
      expect(r.observability.send_action_blocked).toBe(true);
      expect(r.reply.toLowerCase()).toMatch(/not authorised|prepare a draft/);
    }
  });
  it("'contact them' → blocked", () => {
    const r = decideBusinessMarketGate({
      userMessage: "contact them",
      session: emptySession(),
      activeLanguage: "EN",
      business_id: seedPtFreshOnTime(),
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) expect(r.observability.send_action_blocked).toBe(true);
  });
  it("SEND blocked EVEN WHEN business_id is missing", () => {
    const r = decideBusinessMarketGate({
      userMessage: "send it",
      session: emptySession(),
      activeLanguage: "EN",
      business_id: null,
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) expect(r.observability.send_action_blocked).toBe(true);
  });
});

// ═════════════ Draft allowed (§10) ═════════════

describe("decideBusinessMarketGate · DRAFT is allowed with business context", () => {
  it("'draft an email' with business context → draft reply generated", () => {
    const bid = seedPtFreshOnTime();
    const r = decideBusinessMarketGate({
      userMessage: "draft an email to the first one",
      session: emptySession(),
      activeLanguage: "EN",
      business_id: bid,
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.reason.startsWith("draft:")).toBe(true);
      expect(r.observability.draft_action_offered).toBe(true);
      expect(r.reply).toContain("PT Fresh On Time Seafood");
    }
  });
  it("'draft an email' WITHOUT business context → guidance reply", () => {
    const r = decideBusinessMarketGate({
      userMessage: "draft an email",
      session: emptySession(),
      activeLanguage: "EN",
      business_id: null,
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) expect(r.reason).toBe("no_business_context");
  });
});

// ═════════════ Commercial ask · no companies ═════════════

describe("decideBusinessMarketGate · FIND_BUYERS in Japan · no companies", () => {
  it("→ honest 'no verified evidence' reply (§13 §33)", () => {
    const bid = seedPtFreshOnTime();
    const r = decideBusinessMarketGate({
      userMessage: "find seafood buyers in Japan",
      session: emptySession(),
      activeLanguage: "EN",
      business_id: bid,
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.observability.commercial_objective).toBe("FIND_BUYERS");
      expect(r.observability.target_market).toBe("Japan");
      expect(r.observability.companies_retrieved).toBe(0);
      expect(r.reply.toLowerCase()).toMatch(/don't have verified/);
      expect(r.reply.toLowerCase()).toMatch(/rather say so than invent/);
      // Must NEVER fabricate company names
      expect(r.reply).not.toMatch(/Tokyo Bay|Osaka Seafood|Yokohama Fish/i);
      expect(r.cards).toBeNull();
    }
  });
});

// ═════════════ Commercial ask · companies present ═════════════

describe("decideBusinessMarketGate · with seed companies (SEED_FIXTURE)", () => {
  it("returns result cards with proper provenance labelling", () => {
    const bid = seedPtFreshOnTime();
    const seedCo: DiscoveredCompany = {
      company_id: computeCompanyId({ name: "Tokyo Test Fixture Co", country: "Japan" }),
      name: "Tokyo Test Fixture Co",
      country: "Japan",
      region: "Tokyo",
      industry: "seafood",
      short_description: "SEED FIXTURE · demo company only, do not present as real recommendation",
      public_website: null,
      public_contact: null,
      relevance_evidence: [{
        claim: "Fixture · demo seafood importer profile",
        supporting_source: "SEED_FIXTURE",
        confidence: 1.0,
        evidence_state: "KNOWN_YES",
      }],
      attributes: {},
      provenance: {
        source: "seed_fixture_v1",
        source_type: "internal_artifact",
        source_url: null,
        retrieved_at: new Date().toISOString(),
        authority_tier: "TIER_5",
        confidence: 1.0,
        ownership: "nex_analysis",
        source_class: "SEED_FIXTURE",
      },
      discovered_at: new Date().toISOString(),
    };
    // Persist via the placeholder-guard path (source_class SEED_FIXTURE allowed)
    persistDiscoveredCompany(seedCo);
    const r = decideBusinessMarketGate({
      userMessage: "find seafood importers in Japan",
      session: emptySession(),
      activeLanguage: "EN",
      business_id: bid,
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.observability.companies_retrieved).toBeGreaterThan(0);
      expect(r.observability.companies_source_classes).toContain("SEED_FIXTURE");
      expect(r.cards).not.toBeNull();
      expect(r.cards?.cards.length).toBeGreaterThan(0);
      expect(r.cards?.cards[0].provenance_summary).toContain("SEED_FIXTURE");
    }
  });
});

// ═════════════ Placeholder guard (§33) ═════════════

describe("company store · refuses obvious placeholder names outside SEED_FIXTURE", () => {
  it("'Demo Company X' with source_class OTHER_LEGITIMATE_PUBLIC_SOURCE → refused", () => {
    const co: DiscoveredCompany = {
      company_id: computeCompanyId({ name: "Demo Company X", country: "Japan" }),
      name: "Demo Company X",
      country: "Japan",
      public_contact: null,
      relevance_evidence: [],
      attributes: {},
      provenance: {
        source: "internet_search",
        source_type: "public_source",
        source_url: null,
        retrieved_at: new Date().toISOString(),
        authority_tier: "TIER_4",
        confidence: 0.4,
        ownership: "external_evidence",
        source_class: "OTHER_LEGITIMATE_PUBLIC_SOURCE",
      },
      discovered_at: new Date().toISOString(),
    };
    expect(() => persistDiscoveredCompany(co)).toThrow(/refused_placeholder_name/);
  });
});
