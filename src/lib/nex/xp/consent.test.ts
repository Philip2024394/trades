// Consent — default opt-out + override behaviour.

import { describe, it, expect } from "vitest";
import { isContributing, resolveConsent } from "./consent";

describe("resolveConsent", () => {
  it("default = opt_out with engine_default source", () => {
    const c = resolveConsent({ projectId: "p1", merchantSlug: "m1" });
    expect(c.status).toBe("opt_out");
    expect(c.source).toBe("engine_default");
  });

  it("override:'opt_in' produces merchant_choice source", () => {
    const c = resolveConsent({ projectId: "p1", merchantSlug: "m1", override: "opt_in" });
    expect(c.status).toBe("opt_in");
    expect(c.source).toBe("merchant_choice");
  });

  it("override:'opt_out' also uses merchant_choice source", () => {
    const c = resolveConsent({ projectId: "p1", merchantSlug: "m1", override: "opt_out" });
    expect(c.status).toBe("opt_out");
    expect(c.source).toBe("merchant_choice");
  });
});

describe("isContributing", () => {
  it("true only for opt_in", () => {
    expect(isContributing({ project_id: "p1", merchant_slug: "m", status: "opt_in",  source: "engine_default", set_at: "x" })).toBe(true);
    expect(isContributing({ project_id: "p1", merchant_slug: "m", status: "opt_out", source: "engine_default", set_at: "x" })).toBe(false);
  });
});
