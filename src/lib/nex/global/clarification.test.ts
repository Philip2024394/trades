// needsClarification — decides when Nex should ASK the country.

import { describe, it, expect } from "vitest";
import { needsClarification } from "./clarification";
import type { LocationContext } from "../world/types";

const ev = { source: "t", tables: [], computed_at: "x" };

function loc(source: LocationContext["source"], country: LocationContext["country"] = "unknown"): LocationContext {
  return { country, region: null, city: null, postcode: null, source, reason: "", evidence: ev };
}

describe("needsClarification", () => {
  it("engine_default always triggers", () => {
    expect(needsClarification({ location: loc("engine_default"), is_regulatory: false })).not.toBeNull();
    expect(needsClarification({ location: loc("engine_default"), is_regulatory: true  })).not.toBeNull();
  });

  it("ip_fallback triggers ONLY for regulatory calls", () => {
    expect(needsClarification({ location: loc("ip_fallback", "UK"), is_regulatory: true  })).not.toBeNull();
    expect(needsClarification({ location: loc("ip_fallback", "UK"), is_regulatory: false })).toBeNull();
  });

  it("merchant_setting never triggers — Nex trusts the merchant record", () => {
    expect(needsClarification({ location: loc("merchant_setting", "UK"), is_regulatory: true })).toBeNull();
  });

  it("active_project + customer never trigger", () => {
    expect(needsClarification({ location: loc("active_project", "IE"), is_regulatory: true })).toBeNull();
    expect(needsClarification({ location: loc("customer",       "IE"), is_regulatory: true })).toBeNull();
  });

  it("choices list every supported country", () => {
    const r = needsClarification({ location: loc("engine_default"), is_regulatory: true });
    expect(r).not.toBeNull();
    const codes = r!.choices.map((c) => c.code);
    for (const c of ["UK", "IE", "AU", "US", "CA", "NZ", "AE"]) expect(codes).toContain(c);
  });
});
