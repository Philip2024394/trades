// halal.test.ts · halal certification schema + query surface.

import { describe, it, expect } from "vitest";
import type { EntityRecord } from "../data/types";
import { HALAL_USER_PHRASES } from "./types";
import type { HalalCertification } from "./types";
import { lookupBPJPH } from "./bpjph";
import { getHalalCertification, describeHalalStatus, findHalalRestaurants, withHalalCertification, halalStatusCounts } from "./query";

function restaurant(id: string, over: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id, kind: "business", name: `Restaurant ${id}`, keywords: [],
    lifecycle: "PUBLISHED", lifecycleChangedAt: "2026-08-30",
    provenance: [{ walkerId: "w", sourceKey: "s", sourceName: "s", sourceTier: "C",
      firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30",
      lastChangedAt: "2026-08-30", observedAt: "2026-08-30" }],
    freshness: { policy: "weekly", lastVerifiedAt: "2026-08-30T00:00:00Z" },
    ...over,
  };
}

describe("HALAL_USER_PHRASES · user-facing wording", () => {
  it("certified phrase surfaces authority + certificate ref + verified date", () => {
    const c: HalalCertification = {
      status: "certified", authority: "BPJPH", certificateRef: "ID-BPJPH-000123",
      verifiedAt: "2026-08-30T00:00:00Z", confidence: 0.98,
    };
    const phrase = HALAL_USER_PHRASES.certified(c);
    expect(phrase).toMatch(/BPJPH/);
    expect(phrase).toMatch(/000123/);
    expect(phrase).toMatch(/2026-08-30/);
  });

  it("claimed phrase says NEX could not verify · encourages on-site check", () => {
    const phrase = HALAL_USER_PHRASES.claimed({} as HalalCertification);
    expect(phrase).toMatch(/could not/i);
    expect(phrase).toMatch(/confirm/i);
  });

  it("not_halal phrase is unambiguous", () => {
    const phrase = HALAL_USER_PHRASES.not_halal({} as HalalCertification);
    expect(phrase).toMatch(/Not halal/i);
  });

  it("unknown phrase does NOT say the business is not halal", () => {
    const phrase = HALAL_USER_PHRASES.unknown({} as HalalCertification);
    expect(phrase).not.toMatch(/not halal/i);
    expect(phrase).toMatch(/don't have/i);
  });
});

describe("lookupBPJPH · env gating + mock path", () => {
  it("returns 'unknown' with confidence 0 when NEX_BPJPH_ENABLED is off", async () => {
    delete process.env.NEX_BPJPH_ENABLED;
    const r = await lookupBPJPH({ entityId: "r1", name: "Warung X" });
    expect(r.certification.status).toBe("unknown");
    expect(r.certification.confidence).toBe(0);
  });

  it("__mocks path returns the injected certification", async () => {
    const now = new Date();
    const r = await lookupBPJPH(
      { entityId: "r1", name: "Warung Halal Certified" },
      { __mocks: { r1: { status: "certified", authority: "BPJPH", certificateRef: "ID-BPJPH-000001", verifiedAt: now.toISOString(), confidence: 0.98 } } },
    );
    expect(r.certification.status).toBe("certified");
    expect(r.__mocked).toBe(true);
  });
});

describe("query · describeHalalStatus", () => {
  it("business with no cert attribute → 'don't have' phrase", () => {
    const e = restaurant("r1");
    expect(describeHalalStatus(e)).toMatch(/don't have/i);
  });

  it("business with certified attribute → BPJPH phrase", () => {
    const cert: HalalCertification = { status: "certified", authority: "BPJPH", certificateRef: "ID-BPJPH-42", verifiedAt: "2026-08-30", confidence: 1 };
    const e = withHalalCertification(restaurant("r1"), cert);
    expect(describeHalalStatus(e)).toMatch(/BPJPH-certified/i);
  });
});

describe("query · findHalalRestaurants", () => {
  const certified = withHalalCertification(
    restaurant("cert1", { geo: { province: "di-yogyakarta", regency: "sleman" }, name: "Halal Cert 1" }),
    { status: "certified", authority: "BPJPH", verifiedAt: "2026-08-30", confidence: 0.95 },
  );
  const claimed = withHalalCertification(
    restaurant("clm1", { geo: { province: "di-yogyakarta", regency: "sleman" }, name: "Claims Halal" }),
    { status: "claimed", authority: "self_declared", verifiedAt: "2026-08-30", confidence: 0.4 },
  );
  const notHalal = withHalalCertification(
    restaurant("nh1", { geo: { province: "bali", regency: "denpasar" }, name: "Babi Guling Bali" }),
    { status: "not_halal", authority: "review_signal", verifiedAt: "2026-08-30", confidence: 0.9 },
  );
  const unknown = restaurant("u1", { geo: { province: "di-yogyakarta", regency: "sleman" }, name: "Warung Unknown" });

  it("requireCertified=true excludes claimed and not_halal", () => {
    const hits = findHalalRestaurants([certified, claimed, notHalal, unknown], { requireCertified: true });
    expect(hits.map((h) => h.entity.id)).toEqual(["cert1"]);
  });

  it("requireCertified=true + includeClaimed=true adds claimed", () => {
    const hits = findHalalRestaurants([certified, claimed, notHalal, unknown], { requireCertified: true, includeClaimed: true });
    expect(hits.map((h) => h.entity.id).sort()).toEqual(["cert1", "clm1"]);
  });

  it("area filter matches on regency", () => {
    const hits = findHalalRestaurants([certified, claimed, notHalal, unknown], { requireCertified: false, area: "sleman" });
    expect(hits.every((h) => h.entity.geo?.regency === "sleman")).toBe(true);
    expect(hits.find((h) => h.entity.id === "nh1")).toBeUndefined();
  });

  it("never treats 'unknown' as halal · unknown records are excluded", () => {
    const hits = findHalalRestaurants([unknown], { requireCertified: false });
    expect(hits.length).toBe(0);
  });
});

describe("halalStatusCounts · corpus rollup", () => {
  it("counts by status + tracks not_scored businesses", () => {
    const e1 = withHalalCertification(restaurant("a"), { status: "certified", authority: "BPJPH", verifiedAt: "2026-08-30", confidence: 1 });
    const e2 = withHalalCertification(restaurant("b"), { status: "claimed", authority: "self_declared", verifiedAt: "2026-08-30", confidence: 0.4 });
    const e3 = restaurant("c"); // not scored
    const e4 = { ...restaurant("d"), kind: "knowledge" as const }; // not a business · ignored

    const counts = halalStatusCounts([e1, e2, e3, e4]);
    expect(counts.certified).toBe(1);
    expect(counts.claimed).toBe(1);
    expect(counts.not_scored).toBe(1);
    expect(counts.not_halal).toBe(0);
    expect(counts.unknown).toBe(0);
  });
});
