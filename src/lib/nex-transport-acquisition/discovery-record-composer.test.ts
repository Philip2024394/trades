// src/lib/nex-transport-acquisition/discovery-record-composer.test.ts

import { describe, it, expect } from "vitest";
import { composeDiscoveryRecord } from "./discovery-record-composer";

describe("Discovery composer · public source + valid phone + jurisdiction → OK", () => {
  it("wa.me source + Yogya jurisdiction → OK · discovered stage · contactable", () => {
    const r = composeDiscoveryRecord({
      sourceUrl: "https://wa.me/6281234567890",
      rawPhone: "0812 3456 7890",
      businessName: "Budi Transport Jogja",
      homeJurisdiction: "ID/DIY/Yogyakarta",
      city: "Yogyakarta",
      province: "DIY",
      vehicleTypes: ["motorcycle"],
      providerKindHint: "individual_driver",
      supportsPassenger: true,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.record.discoveryStage).toBe("discovered");
      expect(r.record.canonicalPhoneE164?.startsWith("+62")).toBe(true);
      expect(r.record.contactability).toBe("contactable");
      expect(r.record.homeJurisdiction).toBe("ID/DIY/Yogyakarta");
      expect(r.snapshot.sourceKind).toBe("public_whatsapp_business_link");
      expect(r.snapshot.sourceUrl).toBe("https://wa.me/6281234567890");
      // publicWhatsappLink derived from canonical phone
      expect(r.record.publicWhatsappLink).toMatch(/^https:\/\/wa\.me\/62/);
    }
  });
});

describe("Discovery composer · refuses disallowed sources", () => {
  it("chat.whatsapp.com group link → SOURCE_REJECTED", () => {
    const r = composeDiscoveryRecord({
      sourceUrl: "https://chat.whatsapp.com/ABC123",
      rawPhone: "0812 3456 7890",
      businessName: "Test",
      homeJurisdiction: "ID/DIY/Yogyakarta",
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") {
      expect(r.reason).toBe("SOURCE_REJECTED");
      expect(r.detail).toMatch(/CLOSED_SOCIAL_GROUP/);
    }
  });

  it("leaked URL path → SOURCE_REJECTED", () => {
    const r = composeDiscoveryRecord({
      sourceUrl: "https://somesite.com/leaked/drivers.csv",
      rawPhone: "0812 3456 7890",
      businessName: "Test",
      homeJurisdiction: "ID/DIY/Yogyakarta",
    });
    expect(r.status).toBe("REFUSED");
  });
});

describe("Discovery composer · requires jurisdiction + dedupe key", () => {
  it("missing jurisdiction → NO_JURISDICTION", () => {
    const r = composeDiscoveryRecord({
      sourceUrl: "https://wa.me/6281234567890",
      businessName: "Test",
      rawPhone: "0812 3456 7890",
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("NO_JURISDICTION");
  });

  it("no phone AND no business name → NO_DEDUPE_KEY", () => {
    const r = composeDiscoveryRecord({
      sourceUrl: "https://wa.me/6281234567890",
      homeJurisdiction: "ID/DIY/Yogyakarta",
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("NO_DEDUPE_KEY");
  });
});

describe("Discovery composer · records review flags without accusing", () => {
  it("invalid phone → invalid_phone_format flag · contactability='invalid'", () => {
    const r = composeDiscoveryRecord({
      sourceUrl: "https://www.facebook.com/BudiTransport",
      rawPhone: "555",
      businessName: "Budi Transport Jogja",
      homeJurisdiction: "ID/DIY/Yogyakarta",
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.record.reviewFlags).toContain("invalid_phone_format");
      expect(r.record.canonicalPhoneE164).toBeNull();
      expect(r.record.contactability).toBe("invalid");
    }
  });

  it("incompatible vehicle types (motorcycle + truck) → incompatible_vehicle_types flag", () => {
    const r = composeDiscoveryRecord({
      sourceUrl: "https://www.facebook.com/AnyoneTransport",
      rawPhone: "0812 3456 7890",
      businessName: "Anyone Transport",
      homeJurisdiction: "ID/DIY/Yogyakarta",
      vehicleTypes: ["motorcycle", "truck"],
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.record.reviewFlags).toContain("incompatible_vehicle_types");
    }
  });

  it("phone appears at multiple unrelated businesses → duplicate_phone_across_unrelated flag", () => {
    const r = composeDiscoveryRecord({
      sourceUrl: "https://www.facebook.com/One",
      rawPhone: "0812 3456 7890",
      businessName: "One Transport",
      homeJurisdiction: "ID/DIY/Yogyakarta",
      distinctBusinessesUsingSamePhoneAcrossUniverse: 5,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.record.reviewFlags).toContain("duplicate_phone_across_unrelated");
    }
  });
});

describe("Discovery composer · never auto-promotes past discovered", () => {
  it("every OK record enters at discovery_stage='discovered'", () => {
    const r = composeDiscoveryRecord({
      sourceUrl: "https://wa.me/6281234567890",
      rawPhone: "0812 3456 7890",
      businessName: "Budi Transport",
      homeJurisdiction: "ID/DIY/Yogyakarta",
      providerKindHint: "individual_driver",
    });
    if (r.status === "OK") {
      expect(r.record.discoveryStage).toBe("discovered");
    }
  });
});

describe("Discovery composer · jurisdiction separation preserved", () => {
  it("Yogyakarta and Central Java are stored as different jurisdictions", () => {
    const a = composeDiscoveryRecord({
      sourceUrl: "https://wa.me/6281234567890",
      rawPhone: "0812 3456 7890",
      businessName: "Yogya Driver",
      homeJurisdiction: "ID/DIY/Yogyakarta",
    });
    const b = composeDiscoveryRecord({
      sourceUrl: "https://wa.me/6281234567891",
      rawPhone: "0812 3456 7891",
      businessName: "Magelang Driver",
      homeJurisdiction: "ID/Central-Java/Magelang",
    });
    if (a.status === "OK" && b.status === "OK") {
      expect(a.record.homeJurisdiction).toBe("ID/DIY/Yogyakarta");
      expect(b.record.homeJurisdiction).toBe("ID/Central-Java/Magelang");
      expect(a.record.homeJurisdiction).not.toBe(b.record.homeJurisdiction);
    }
  });
});
