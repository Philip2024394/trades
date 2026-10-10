// src/lib/nex-native/directory/related-businesses/__tests__/tiers.test.ts
//
// NEX Directory · Related Businesses · tier resolver tests.
//
// Covers
//   · extractProvidedByBusiness honest-empty for null / malformed / absent
//   · extractProvidedByBusiness returns tier-1 items from provided[]
//   · extractProvidedByBusiness returns tier-1 items from facilities[]
//   · extractProvidedByBusiness merges both arrays (order + dedupe)
//   · extractProvidedByBusiness drops non-string entries
//   · extractEstablishedPartners honest-empty for null / malformed / absent
//   · extractEstablishedPartners returns tier-2 items with valid uuids
//   · extractEstablishedPartners drops malformed entries
//   · extractEstablishedPartners preserves optional label override
//   · extractEstablishedPartners dedupes duplicate uuids
//   · Sealed group labels match the frozen vocabulary
//
// This test file is environment-neutral: no "server-only" import, no
// DB access, no clock, no network, no randomness.

import { describe, expect, it } from "vitest";
import {
  extractProvidedByBusiness,
  extractEstablishedPartners,
  TIER_GROUP_LABELS,
  type AnchorForTiers,
} from "../tiers";

const anchor = (verticalPayload: unknown, entityType = "accommodation"): AnchorForTiers => ({
  entityType,
  verticalPayload,
});

describe("extractProvidedByBusiness · honest-empty", () => {
  it("returns [] when verticalPayload is null", () => {
    expect(extractProvidedByBusiness(anchor(null))).toEqual([]);
  });

  it("returns [] when verticalPayload is undefined", () => {
    expect(extractProvidedByBusiness(anchor(undefined))).toEqual([]);
  });

  it("returns [] when verticalPayload is a primitive", () => {
    expect(extractProvidedByBusiness(anchor("not-an-object"))).toEqual([]);
    expect(extractProvidedByBusiness(anchor(42))).toEqual([]);
    expect(extractProvidedByBusiness(anchor(true))).toEqual([]);
  });

  it("returns [] when verticalPayload is an array (not an object)", () => {
    expect(extractProvidedByBusiness(anchor(["Airport pickup"]))).toEqual([]);
  });

  it("returns [] when neither provided nor facilities exists", () => {
    expect(extractProvidedByBusiness(anchor({ other_key: ["foo"] }))).toEqual([]);
  });

  it("returns [] when provided is present but not an array", () => {
    expect(
      extractProvidedByBusiness(anchor({ provided: "Airport pickup" })),
    ).toEqual([]);
  });
});

describe("extractProvidedByBusiness · tier-1 items", () => {
  it("extracts labels from provided[]", () => {
    const result = extractProvidedByBusiness(
      anchor({ provided: ["Airport pickup", "Laundry"] }),
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      tier: "provided_by_business",
      label: "Airport pickup",
      canonicalBusinessId: null,
    });
    expect(result[1]).toEqual({
      tier: "provided_by_business",
      label: "Laundry",
      canonicalBusinessId: null,
    });
  });

  it("extracts labels from facilities[]", () => {
    const result = extractProvidedByBusiness(
      anchor({ facilities: ["Swimming pool", "Wi-Fi"] }),
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.label)).toEqual(["Swimming pool", "Wi-Fi"]);
    expect(result.every((r) => r.canonicalBusinessId === null)).toBe(true);
    expect(result.every((r) => r.tier === "provided_by_business")).toBe(true);
  });

  it("merges provided[] + facilities[] with provided items first", () => {
    const result = extractProvidedByBusiness(
      anchor({
        provided: ["Airport pickup", "Breakfast"],
        facilities: ["Swimming pool", "Parking"],
      }),
    );
    expect(result.map((r) => r.label)).toEqual([
      "Airport pickup",
      "Breakfast",
      "Swimming pool",
      "Parking",
    ]);
  });

  it("dedupes case-insensitively, first occurrence wins", () => {
    const result = extractProvidedByBusiness(
      anchor({
        provided: ["Airport pickup", "LAUNDRY"],
        facilities: ["airport pickup", "Laundry"],
      }),
    );
    expect(result.map((r) => r.label)).toEqual(["Airport pickup", "LAUNDRY"]);
  });

  it("drops non-string / empty entries, keeps the rest", () => {
    const result = extractProvidedByBusiness(
      anchor({
        provided: [
          "Airport pickup",
          "",
          "  ",
          null,
          undefined,
          123,
          { label: "nope" },
          "Laundry",
        ],
      }),
    );
    expect(result.map((r) => r.label)).toEqual(["Airport pickup", "Laundry"]);
  });

  it("trims surrounding whitespace from labels", () => {
    const result = extractProvidedByBusiness(
      anchor({ provided: ["  Airport pickup  "] }),
    );
    expect(result[0]!.label).toBe("Airport pickup");
  });

  it("is pure · same input produces the same output on repeated calls", () => {
    const payload = {
      provided: ["Airport pickup", "Breakfast"],
      facilities: ["Wi-Fi"],
    };
    const a = extractProvidedByBusiness(anchor(payload));
    const b = extractProvidedByBusiness(anchor(payload));
    expect(a).toEqual(b);
  });
});

describe("extractEstablishedPartners · honest-empty", () => {
  it("returns [] when verticalPayload is null", () => {
    expect(extractEstablishedPartners(anchor(null))).toEqual([]);
  });

  it("returns [] when verticalPayload is a primitive", () => {
    expect(extractEstablishedPartners(anchor("not-an-object"))).toEqual([]);
  });

  it("returns [] when partners key missing", () => {
    expect(
      extractEstablishedPartners(anchor({ provided: ["X"] })),
    ).toEqual([]);
  });

  it("returns [] when partners is present but not an array", () => {
    expect(
      extractEstablishedPartners(
        anchor({ partners: "not-an-array" }),
      ),
    ).toEqual([]);
  });
});

describe("extractEstablishedPartners · tier-2 items", () => {
  const partnerA = "11111111-1111-4111-8111-111111111111";
  const partnerB = "22222222-2222-4222-8222-222222222222";

  it("extracts uuids from valid partner entries", () => {
    const result = extractEstablishedPartners(
      anchor({
        partners: [
          { canonical_business_id: partnerA },
          { canonical_business_id: partnerB },
        ],
      }),
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ canonicalBusinessId: partnerA });
    expect(result[1]).toEqual({ canonicalBusinessId: partnerB });
  });

  it("preserves optional label override when non-empty", () => {
    const result = extractEstablishedPartners(
      anchor({
        partners: [
          { canonical_business_id: partnerA, label: "XYZ Airport Transport" },
        ],
      }),
    );
    expect(result[0]).toEqual({
      canonicalBusinessId: partnerA,
      label: "XYZ Airport Transport",
    });
  });

  it("omits label when source label is empty/whitespace", () => {
    const result = extractEstablishedPartners(
      anchor({
        partners: [
          { canonical_business_id: partnerA, label: "   " },
          { canonical_business_id: partnerB, label: "" },
        ],
      }),
    );
    expect(result[0]).toEqual({ canonicalBusinessId: partnerA });
    expect(result[1]).toEqual({ canonicalBusinessId: partnerB });
  });

  it("drops entries missing canonical_business_id", () => {
    const result = extractEstablishedPartners(
      anchor({
        partners: [
          { canonical_business_id: partnerA },
          { label: "orphan" },
          {},
          null,
          "string",
          42,
          { canonical_business_id: partnerB },
        ],
      }),
    );
    expect(result.map((p) => p.canonicalBusinessId)).toEqual([
      partnerA,
      partnerB,
    ]);
  });

  it("drops entries with malformed uuids", () => {
    const result = extractEstablishedPartners(
      anchor({
        partners: [
          { canonical_business_id: "not-a-uuid" },
          { canonical_business_id: "11111111-1111-4111-8111-11111111111" }, // too short
          { canonical_business_id: partnerA },
        ],
      }),
    );
    expect(result.map((p) => p.canonicalBusinessId)).toEqual([partnerA]);
  });

  it("dedupes duplicate uuids · first wins (incl. label)", () => {
    const result = extractEstablishedPartners(
      anchor({
        partners: [
          { canonical_business_id: partnerA, label: "First Label" },
          { canonical_business_id: partnerA, label: "Later Label" },
          { canonical_business_id: partnerB },
        ],
      }),
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      canonicalBusinessId: partnerA,
      label: "First Label",
    });
    expect(result[1]).toEqual({ canonicalBusinessId: partnerB });
  });

  it("is pure · deterministic across repeated calls", () => {
    const payload = {
      partners: [{ canonical_business_id: partnerA }],
    };
    const a = extractEstablishedPartners(anchor(payload));
    const b = extractEstablishedPartners(anchor(payload));
    expect(a).toEqual(b);
  });
});

describe("TIER_GROUP_LABELS · sealed vocabulary", () => {
  it("matches the three sealed labels exactly", () => {
    expect(TIER_GROUP_LABELS).toEqual({
      provided_by_business: "This business offers",
      established_partner: "Partner services",
      nearby_independent: "Independent businesses nearby",
    });
  });

  it("has no 'partner' word in the nearby label (doctrine)", () => {
    expect(TIER_GROUP_LABELS.nearby_independent.toLowerCase()).not.toContain(
      "partner",
    );
  });

  it("has no 'nearby' word in the partner label (doctrine)", () => {
    expect(TIER_GROUP_LABELS.established_partner.toLowerCase()).not.toContain(
      "nearby",
    );
  });
});
