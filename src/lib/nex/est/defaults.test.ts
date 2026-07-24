// Merchant defaults resolver — precedence + provenance.

import { describe, it, expect, vi } from "vitest";

// The loader currently returns null for any slug — mock so we can flip
// it back to a merchant row and confirm precedence works when a source
// eventually lands.
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: {} }));

import { ENGINE_DEFAULTS, resolveMerchantDefaults } from "./defaults";

describe("resolveMerchantDefaults", () => {
  it("falls back to engine defaults when nothing else is set", async () => {
    const d = await resolveMerchantDefaults({});
    expect(d.labour_rate_pence_per_hour).toBe(ENGINE_DEFAULTS.labour_rate_pence_per_hour);
    expect(d.source.labour_rate).toBe("engine");
    expect(d.source.overhead).toBe("engine");
    expect(d.source.profit_margin).toBe("engine");
  });

  it("honours per-estimate overrides + marks source as merchant", async () => {
    const d = await resolveMerchantDefaults({
      overrides: {
        labour_rate_pence_per_hour: 5500,
        profit_margin_pct:          25
      }
    });
    expect(d.labour_rate_pence_per_hour).toBe(5500);
    expect(d.profit_margin_pct).toBe(25);
    expect(d.source.labour_rate).toBe("merchant");
    expect(d.source.profit_margin).toBe("merchant");
    // Untouched fields stay engine.
    expect(d.source.overhead).toBe("engine");
  });

  it("preserves currency + region even when engine-only", async () => {
    const d = await resolveMerchantDefaults({});
    expect(d.currency).toBe("GBP");
    expect(d.region).toBe("UK");
  });
});
