// src/lib/nex/brain/business-context.test.ts
// Business v1 · unit tests

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  computeBusinessId,
  persistBusinessIdentity,
  getBusinessIdentity,
  listBusinessIdentities,
  persistBusinessProduct,
  listBusinessProducts,
  persistMarketObjective,
  listMarketObjectives,
  loadBusinessContext,
  createIdentityFromInput,
  _resetBusinessStoreForTests,
  type BusinessIdentity,
  type BusinessProduct,
  type MarketObjective,
} from "./business-context";

let tmpDir: string;
beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "biz-v1-"));
  process.env.NEX_BUSINESS_DIR = tmpDir;
  _resetBusinessStoreForTests();
});

// ═════════════ Identity ═════════════

describe("computeBusinessId · deterministic", () => {
  it("same input → same id", () => {
    const a = computeBusinessId({ legal_name: "PT Fresh On Time Seafood", country: "Indonesia" });
    const b = computeBusinessId({ legal_name: "PT Fresh On Time Seafood", country: "Indonesia" });
    expect(a).toBe(b);
    expect(a.startsWith("biz_")).toBe(true);
  });
  it("different case → same id (canonical)", () => {
    const a = computeBusinessId({ legal_name: "PT Fresh On Time Seafood", country: "Indonesia" });
    const b = computeBusinessId({ legal_name: "pt fresh on time seafood", country: "indonesia" });
    expect(a).toBe(b);
  });
});

describe("persistBusinessIdentity + getBusinessIdentity", () => {
  it("persists a new identity and reads it back", () => {
    const identity = createIdentityFromInput({
      legal_name: "PT Fresh On Time Seafood",
      country: "Indonesia",
      industry: "seafood",
      description: "Indonesian seafood exporter",
      source: "recruitment_flyer",
      source_type: "authorised_document",
    });
    persistBusinessIdentity(identity);
    const read = getBusinessIdentity(identity.business_id);
    expect(read?.legal_name).toBe("PT Fresh On Time Seafood");
    expect(read?.country).toBe("Indonesia");
    expect(read?.industry).toBe("seafood");
  });
  it("listBusinessIdentities returns latest per business_id", () => {
    const identity = createIdentityFromInput({
      legal_name: "PT X",
      country: "Indonesia",
      source: "flyer",
    });
    persistBusinessIdentity(identity);
    const updated = { ...identity, description: "updated", updated_at: new Date().toISOString() };
    // Add a small delay to ensure updated_at differs
    updated.updated_at = new Date(Date.now() + 1000).toISOString();
    persistBusinessIdentity(updated);
    const all = listBusinessIdentities();
    expect(all.length).toBe(1);
    expect(all[0].description).toBe("updated");
  });
});

// ═════════════ Product ═════════════

describe("persistBusinessProduct · owner-only", () => {
  it("accepts write when authorised_business_id matches", () => {
    const product: BusinessProduct = {
      product_id: "p1",
      business_id: "biz_A",
      name: "Frozen Tuna",
      created_at: new Date().toISOString(),
      attributes: {},
      provenance: {
        source: "flyer",
        source_type: "authorised_document",
        retrieved_at: new Date().toISOString(),
        authority_tier: "TIER_1",
        confidence: 0.95,
        ownership: "business_authorised",
      },
    };
    persistBusinessProduct(product, "biz_A");
    expect(listBusinessProducts("biz_A").length).toBe(1);
  });
  it("throws when authorised_business_id does not match (§20 ownership)", () => {
    const product: BusinessProduct = {
      product_id: "p1",
      business_id: "biz_A",
      name: "Frozen Tuna",
      created_at: new Date().toISOString(),
      attributes: {},
      provenance: {
        source: "flyer",
        source_type: "authorised_document",
        retrieved_at: new Date().toISOString(),
        authority_tier: "TIER_1",
        confidence: 0.95,
        ownership: "business_authorised",
      },
    };
    expect(() => persistBusinessProduct(product, "biz_B")).toThrow(/unauthorised_product_write/);
  });
});

// ═════════════ Market Objective ═════════════

describe("persistMarketObjective · owner-only", () => {
  it("accepts write when authorised_business_id matches", () => {
    const obj: MarketObjective = {
      objective_id: "o1",
      business_id: "biz_A",
      objective_kind: "FIND_BUYERS",
      target_market: "Japan",
      product_ids: ["p1"],
      created_at: new Date().toISOString(),
      provenance: {
        source: "onboarding",
        source_type: "authorised_document",
        retrieved_at: new Date().toISOString(),
        authority_tier: "TIER_1",
        confidence: 0.9,
        ownership: "business_authorised",
      },
    };
    persistMarketObjective(obj, "biz_A");
    expect(listMarketObjectives("biz_A").length).toBe(1);
  });
  it("throws when authorised_business_id does not match", () => {
    const obj: MarketObjective = {
      objective_id: "o1",
      business_id: "biz_A",
      objective_kind: "FIND_BUYERS",
      target_market: "Japan",
      product_ids: ["p1"],
      created_at: new Date().toISOString(),
      provenance: {
        source: "onboarding",
        source_type: "authorised_document",
        retrieved_at: new Date().toISOString(),
        authority_tier: "TIER_1",
        confidence: 0.9,
        ownership: "business_authorised",
      },
    };
    expect(() => persistMarketObjective(obj, "biz_B")).toThrow(/unauthorised_objective_write/);
  });
});

// ═════════════ Compose context ═════════════

describe("loadBusinessContext · composite", () => {
  it("returns identity + products + objectives", () => {
    const identity = createIdentityFromInput({
      legal_name: "PT X",
      country: "Indonesia",
      source: "flyer",
    });
    persistBusinessIdentity(identity);
    const product: BusinessProduct = {
      product_id: "p1", business_id: identity.business_id, name: "Frozen Tuna",
      created_at: new Date().toISOString(), attributes: {},
      provenance: identity.provenance,
    };
    persistBusinessProduct(product, identity.business_id);
    const obj: MarketObjective = {
      objective_id: "o1", business_id: identity.business_id,
      objective_kind: "FIND_BUYERS", target_market: "Japan",
      product_ids: ["p1"], created_at: new Date().toISOString(),
      provenance: identity.provenance,
    };
    persistMarketObjective(obj, identity.business_id);

    const ctx = loadBusinessContext(identity.business_id);
    expect(ctx).not.toBeNull();
    expect(ctx?.identity.legal_name).toBe("PT X");
    expect(ctx?.products.length).toBe(1);
    expect(ctx?.active_objective?.target_market).toBe("Japan");
  });
  it("returns null for unknown business_id", () => {
    expect(loadBusinessContext("biz_does_not_exist")).toBeNull();
  });
});

// ═════════════ Data isolation (§20) ═════════════

describe("business data isolation", () => {
  it("business_A cannot read business_B products", () => {
    const idA = createIdentityFromInput({ legal_name: "A", country: "Indonesia", source: "test" });
    const idB = createIdentityFromInput({ legal_name: "B", country: "Indonesia", source: "test" });
    persistBusinessIdentity(idA);
    persistBusinessIdentity(idB);
    const productB: BusinessProduct = {
      product_id: "pB", business_id: idB.business_id, name: "B Product",
      created_at: new Date().toISOString(), attributes: {},
      provenance: idB.provenance,
    };
    persistBusinessProduct(productB, idB.business_id);
    const productsForA = listBusinessProducts(idA.business_id);
    expect(productsForA.length).toBe(0);
    const productsForB = listBusinessProducts(idB.business_id);
    expect(productsForB.length).toBe(1);
  });
});
