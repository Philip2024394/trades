// src/lib/nex-hq/transport-data-aggregator.test.ts

import { describe, it, expect } from "vitest";
import {
  aggregateByVehicleKind,
  computeTotals,
  type TransportRecordRow,
} from "./transport-data-aggregator";

const row = (o: Partial<TransportRecordRow>): TransportRecordRow => ({
  vehicleTypes: ["motorcycle"],
  discoveryStage: "discovered",
  contactability: "contactable",
  publicWhatsappLink: "https://wa.me/6281234567890",
  canonicalPhoneE164: "+6281234567890",
  ...o,
});

describe("aggregateByVehicleKind · sums per category honestly", () => {
  it("single-kind rows count once", () => {
    const rows = [
      row({ vehicleTypes: ["motorcycle"] }),
      row({ vehicleTypes: ["car"] }),
      row({ vehicleTypes: ["car"] }),
    ];
    const agg = aggregateByVehicleKind(rows);
    expect(agg.find((a) => a.vehicleKind === "car")?.discovered).toBe(2);
    expect(agg.find((a) => a.vehicleKind === "motorcycle")?.discovered).toBe(1);
  });

  it("multi-kind rows contribute to each kind", () => {
    const rows = [row({ vehicleTypes: ["car", "airport_transfer"] })];
    const agg = aggregateByVehicleKind(rows);
    expect(agg.find((a) => a.vehicleKind === "car")?.discovered).toBe(1);
    expect(agg.find((a) => a.vehicleKind === "airport_transfer")?.discovered).toBe(1);
  });
});

describe("aggregateByVehicleKind · honest state discipline · verified/active only from stage", () => {
  it("all-discovered rows produce zero verified and zero active", () => {
    const rows = [
      row({ discoveryStage: "discovered" }),
      row({ discoveryStage: "invited" }),
      row({ discoveryStage: "registered" }),
      row({ discoveryStage: "kyc_pending" }),
    ];
    const agg = aggregateByVehicleKind(rows);
    for (const a of agg) {
      expect(a.verified).toBe(0);
      expect(a.active).toBe(0);
    }
  });

  it("verified stage counts in verified column", () => {
    const rows = [row({ discoveryStage: "verified" })];
    const agg = aggregateByVehicleKind(rows);
    expect(agg[0].verified).toBe(1);
    expect(agg[0].active).toBe(0);
  });

  it("active stage counts in active column", () => {
    const rows = [row({ discoveryStage: "active" })];
    const agg = aggregateByVehicleKind(rows);
    expect(agg[0].active).toBe(1);
    // verified column does not double-count active
    expect(agg[0].verified).toBe(0);
  });
});

describe("aggregateByVehicleKind · contactable + whatsapp columns", () => {
  it("counts contactable only when contactability='contactable'", () => {
    const rows = [
      row({ contactability: "contactable" }),
      row({ contactability: "unknown" }),
      row({ contactability: "invalid" }),
    ];
    const agg = aggregateByVehicleKind(rows);
    expect(agg[0].discovered).toBe(3);
    expect(agg[0].contactable).toBe(1);
  });

  it("counts withWhatsapp only when publicWhatsappLink is present", () => {
    const rows = [
      row({ publicWhatsappLink: "https://wa.me/6281234567890" }),
      row({ publicWhatsappLink: null }),
    ];
    const agg = aggregateByVehicleKind(rows);
    expect(agg[0].withWhatsapp).toBe(1);
  });
});

describe("computeTotals · duplicate phone detection · outreach never fabricated", () => {
  it("counts duplicates when the same canonical_phone_e164 appears more than once", () => {
    const rows = [
      row({ canonicalPhoneE164: "+6281111111111" }),
      row({ canonicalPhoneE164: "+6281111111111" }),
      row({ canonicalPhoneE164: "+6282222222222" }),
    ];
    const t = computeTotals(rows, 0);
    expect(t.totalRecords).toBe(3);
    expect(t.distinctPhones).toBe(2);
    expect(t.duplicatePhones).toBe(1);
    expect(t.automaticOutreachSent).toBe(0);
  });

  it("null phones are not counted in distinctPhones or duplicates", () => {
    const rows = [
      row({ canonicalPhoneE164: null }),
      row({ canonicalPhoneE164: null }),
      row({ canonicalPhoneE164: "+6281111111111" }),
    ];
    const t = computeTotals(rows, 0);
    expect(t.totalRecords).toBe(3);
    expect(t.distinctPhones).toBe(1);
    expect(t.duplicatePhones).toBe(0);
  });

  it("outreach count is passed in · never inferred · zero is the doctrine expectation", () => {
    const rows = [row({})];
    // Aggregator refuses to invent · caller supplies · zero is the correct default until Stage-B activation
    expect(computeTotals(rows, 0).automaticOutreachSent).toBe(0);
    // But if the caller passes non-zero the aggregator faithfully surfaces it (never hides)
    expect(computeTotals(rows, 42).automaticOutreachSent).toBe(42);
  });
});

describe("aggregateByVehicleKind · sorted by discovered descending", () => {
  it("returns kinds ordered by discovered count desc", () => {
    const rows = [
      row({ vehicleTypes: ["car"] }),
      row({ vehicleTypes: ["car"] }),
      row({ vehicleTypes: ["car"] }),
      row({ vehicleTypes: ["motorcycle"] }),
      row({ vehicleTypes: ["taxi"] }),
      row({ vehicleTypes: ["taxi"] }),
    ];
    const agg = aggregateByVehicleKind(rows);
    expect(agg.map((a) => a.vehicleKind)).toEqual(["car", "taxi", "motorcycle"]);
  });
});
