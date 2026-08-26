// Focused tests for the P8+ enrichment write-back · Chief Architect 2026-08-27.
//
// Verifies applyEnrichmentToExisting on food + accommodation configs:
//   · COALESCE semantics (fills NULL · never overwrites non-null)
//   · owner_status='verified' rows protected via WHERE clause
//   · errors bubble up to caller (engine.mjs captures them)
//   · returns rowCount (0 or 1) so caller can count writes

import { describe, it, expect, vi } from "vitest";
import { foodYogyakartaConfig } from "./food-yogyakarta.mjs";
import { accommodationYogyakartaConfig } from "./accommodation-yogyakarta.mjs";

// Helper · mock pool that captures query args + returns provided rowCount
function mockPool(rowCount = 1, throwOn = null) {
  const calls = [];
  return {
    calls,
    query: vi.fn(async (sql, params) => {
      calls.push({ sql, params });
      if (throwOn && sql.includes(throwOn)) throw new Error("simulated DB error");
      return { rowCount, rows: rowCount > 0 ? [{ internal_id: "mock-id" }] : [] };
    }),
  };
}

describe("food applyEnrichmentToExisting · COALESCE semantics + owner protection", () => {
  const existing = { public_listing_ref: "#FL-2026-TEST1" };
  const ctx = { workerId: "test-worker", cycleRunId: "test-cycle", sourceName: "business_website" };

  it("issues UPDATE with COALESCE and owner-verified guard", async () => {
    const pool = mockPool(1);
    const gain = { phone: "+62-812-345-6789", whatsapp: "+62-812-345-6789" };
    const rowCount = await foodYogyakartaConfig.persistence.applyEnrichmentToExisting(
      pool, existing, gain, ctx
    );
    expect(rowCount).toBe(1);
    expect(pool.calls.length).toBe(1);
    const { sql, params } = pool.calls[0];
    expect(sql).toMatch(/UPDATE nex\.food_business/);
    expect(sql).toMatch(/phone\s*=\s*COALESCE\(phone/);
    expect(sql).toMatch(/whatsapp_number\s*=\s*COALESCE\(whatsapp_number/);
    expect(sql).toMatch(/public_social_links\s*=\s*COALESCE\(public_social_links/);
    expect(sql).toMatch(/last_verified_at\s*=\s*now\(\)/);
    expect(sql).toMatch(/verification_source\s*=\s*COALESCE\(verification_source,\s*'official_website'\)/);
    expect(sql).toMatch(/owner_status\s*!=\s*'verified'/);
    expect(params[0]).toBe("+62-812-345-6789"); // phone
    expect(params[1]).toBe("+62-812-345-6789"); // whatsapp
    expect(params[2]).toBe(null);               // no socials → null
    expect(params[3]).toBe("#FL-2026-TEST1");
  });

  it("packages socials as JSON when instagram/facebook present", async () => {
    const pool = mockPool(1);
    const gain = { instagram: "test.food", facebook: "testfood" };
    await foodYogyakartaConfig.persistence.applyEnrichmentToExisting(
      pool, existing, gain, ctx
    );
    const socialsJson = pool.calls[0].params[2];
    expect(socialsJson).not.toBeNull();
    const parsed = JSON.parse(socialsJson);
    expect(parsed).toEqual({ instagram: "test.food", facebook: "testfood" });
  });

  it("returns 0 when UPDATE affects no rows (owner-verified row)", async () => {
    const pool = mockPool(0);
    const gain = { phone: "+62-any" };
    const rowCount = await foodYogyakartaConfig.persistence.applyEnrichmentToExisting(
      pool, existing, gain, ctx
    );
    expect(rowCount).toBe(0);
  });

  it("propagates DB errors (engine.mjs will capture them)", async () => {
    const pool = mockPool(1, "UPDATE nex.food_business");
    const gain = { phone: "+62-any" };
    await expect(
      foodYogyakartaConfig.persistence.applyEnrichmentToExisting(pool, existing, gain, ctx)
    ).rejects.toThrow("simulated DB error");
  });

  it("null gain fields become $1=null $2=null · UPDATE preserves via COALESCE", async () => {
    const pool = mockPool(1);
    const gain = { instagram: "only-ig" }; // no phone, no whatsapp
    await foodYogyakartaConfig.persistence.applyEnrichmentToExisting(
      pool, existing, gain, ctx
    );
    expect(pool.calls[0].params[0]).toBe(null); // phone param null · COALESCE keeps existing
    expect(pool.calls[0].params[1]).toBe(null); // whatsapp param null · COALESCE keeps existing
  });
});

describe("accommodation applyEnrichmentToExisting · same shape · different table", () => {
  it("targets accommodation_business table with owner-verified guard", async () => {
    const pool = mockPool(1);
    const gain = { phone: "+62-hotel", whatsapp: "+62-wa" };
    await accommodationYogyakartaConfig.persistence.applyEnrichmentToExisting(
      pool,
      { public_listing_ref: "#AC-2026-TEST1" },
      gain,
      { workerId: "w", cycleRunId: "c", sourceName: "business_website" }
    );
    expect(pool.calls[0].sql).toMatch(/UPDATE nex\.accommodation_business/);
    expect(pool.calls[0].sql).toMatch(/COALESCE\(phone/);
    expect(pool.calls[0].sql).toMatch(/owner_status\s*!=\s*'verified'/);
    expect(pool.calls[0].params[3]).toBe("#AC-2026-TEST1");
  });
});

describe("engine.mjs Phase C · sanity that both configs expose the method", () => {
  it("food config exposes applyEnrichmentToExisting on persistence", () => {
    expect(typeof foodYogyakartaConfig.persistence.applyEnrichmentToExisting).toBe("function");
  });
  it("accommodation config exposes applyEnrichmentToExisting on persistence", () => {
    expect(typeof accommodationYogyakartaConfig.persistence.applyEnrichmentToExisting).toBe("function");
  });
  it("accommodation config now includes businessWebsiteSource for enrichment", () => {
    const names = accommodationYogyakartaConfig.sources.map((s) => s.name);
    expect(names).toContain("business_website");
  });
  it("food config already includes businessWebsiteSource (unchanged)", () => {
    const names = foodYogyakartaConfig.sources.map((s) => s.name);
    expect(names).toContain("business_website");
  });
});
