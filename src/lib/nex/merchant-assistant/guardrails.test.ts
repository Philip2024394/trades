// NEX Merchant Assistant — guardrail tests.
//
// Covers every category of guardrail: certification claims (with and
// without registered credentials), comparative claims, absolute safety
// claims, health-outcome claims, and trading-history maths.
//
// Reference: src/lib/nex/merchant-assistant/guardrails.ts

import { describe, expect, it } from "vitest";
import { checkText, checkFields } from "./guardrails";

describe("checkText — certification phrases", () => {
  it("blocks ISO 9001 when merchant has no credentials on file", () => {
    const result = checkText("This product is ISO 9001 certified.");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.matched).toBe("ISO 9001");
      expect(result.reason).toMatch(/does not currently hold/i);
    }
  });

  it("allows ISO 9001 when merchant lists it as a credential", () => {
    const result = checkText(
      "This product is ISO 9001 certified.",
      { merchantCredentials: ["ISO 9001"] }
    );
    expect(result.ok).toBe(true);
  });

  it("blocks TrustMark member if merchant is not one", () => {
    const result = checkText("We are a TrustMark member workshop.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.matched).toBe("TrustMark member");
  });

  it("blocks Gas Safe registered for a non-Gas Safe merchant", () => {
    const result = checkText("Our engineers are Gas Safe registered.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.matched).toBe("Gas Safe registered");
  });

  it("is case-insensitive on phrase matching", () => {
    const result = checkText("bsi APPROVED workshop");
    expect(result.ok).toBe(false);
  });
});

describe("checkText — comparative claims (blocked outright)", () => {
  it("blocks 'cheaper than'", () => {
    const result = checkText("Cheaper than any competitor in Leeds.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.matched).toBe("cheaper than");
  });

  it("blocks 'number one'", () => {
    const result = checkText("The number one staircase brand in the UK.");
    expect(result.ok).toBe(false);
  });

  it("blocks 'award-winning' even if the merchant claims to have credentials", () => {
    const result = checkText(
      "Our award-winning craftsmanship stands out.",
      { merchantCredentials: ["BSI"] }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.matched).toBe("award-winning");
  });

  it("allows non-comparative descriptive language", () => {
    const result = checkText(
      "Solid oak treads with a hand-rubbed hardwax oil finish."
    );
    expect(result.ok).toBe(true);
  });
});

describe("checkText — absolute safety claims", () => {
  it("blocks '100% safe'", () => {
    const result = checkText("Guaranteed 100% safe for all households.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.matched).toBe("100% safe");
  });

  it("blocks 'waterproof' (should be water-resistant)", () => {
    const result = checkText("Our finish is fully waterproof.");
    expect(result.ok).toBe(false);
  });

  it("blocks 'lifetime guarantee'", () => {
    const result = checkText("Backed by our lifetime guarantee.");
    expect(result.ok).toBe(false);
  });

  it("allows measured claims like 'durable' or 'long-lasting'", () => {
    const result = checkText(
      "A durable, long-lasting oak finish suitable for daily use."
    );
    expect(result.ok).toBe(true);
  });
});

describe("checkText — health outcome claims", () => {
  it("blocks 'clinically proven'", () => {
    const result = checkText("Clinically proven to reduce allergies.");
    expect(result.ok).toBe(false);
  });

  it("blocks 'medically proven'", () => {
    const result = checkText("Medically proven anti-slip finish.");
    expect(result.ok).toBe(false);
  });
});

describe("checkText — trading history maths", () => {
  it("blocks 'established 1980' when merchant registered in 2015", () => {
    const result = checkText(
      "Established 1980, delivering craftsmanship for generations.",
      { merchantTradingSince: 2015 }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.matched).toMatch(/established 1980/i);
  });

  it("allows 'established 1980' when merchant registered in 1980 or earlier", () => {
    const result = checkText(
      "Established 1980, family-run.",
      { merchantTradingSince: 1975 }
    );
    expect(result.ok).toBe(true);
  });

  it("blocks '30 years of experience' when merchant registered in 2015", () => {
    const result = checkText(
      "30 years of experience in bespoke staircase manufacture.",
      { merchantTradingSince: 2015 }
    );
    expect(result.ok).toBe(false);
  });

  it("allows accurate trading duration", () => {
    const currentYear = new Date().getFullYear();
    const result = checkText(
      "5 years of experience in bespoke joinery.",
      { merchantTradingSince: currentYear - 6 }
    );
    expect(result.ok).toBe(true);
  });

  it("allows trading-history claims when merchantTradingSince is not provided", () => {
    const result = checkText("Established 1990.");
    expect(result.ok).toBe(true);
  });
});

describe("checkFields — multi-field validation", () => {
  it("returns the field name that first failed", () => {
    const result = checkFields({
      name: "Oak Treads",
      description: "Cheaper than any competitor.",
      tags: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("description");
      expect(result.matched).toBe("cheaper than");
    }
  });

  it("returns ok when every field is clean", () => {
    const result = checkFields({
      name: "American White Oak Treads 40mm",
      description: "Solid oak stair treads suitable for domestic use.",
      tags: null,
    });
    expect(result.ok).toBe(true);
  });

  it("skips null / empty fields", () => {
    const result = checkFields({
      name: "Product",
      description: null,
      body: undefined as unknown as string | null,
    });
    expect(result.ok).toBe(true);
  });

  it("respects merchant credentials across all fields", () => {
    const result = checkFields(
      {
        headline: "TrustMark member workshop",
        body: "ISO 9001 certified for consistency.",
      },
      {
        merchantCredentials: ["TrustMark member", "ISO 9001"],
      }
    );
    expect(result.ok).toBe(true);
  });
});
