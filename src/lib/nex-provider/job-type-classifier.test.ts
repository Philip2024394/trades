// src/lib/nex-provider/job-type-classifier.test.ts

import { describe, it, expect } from "vitest";
import {
  classifyJobType,
  requiredFieldsFor,
  recommendParcelJobType,
} from "./job-type-classifier";

describe("Job type classifier · unambiguous NL phrases", () => {
  it("'bike taxi' → passenger_motorbike", () => {
    const r = classifyJobType("bike taxi");
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.jobType).toBe("passenger_motorbike");
  });

  it("'motorbike ride' → passenger_motorbike", () => {
    const r = classifyJobType("I need a motorbike ride to town");
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.jobType).toBe("passenger_motorbike");
  });

  it("'bike parcel' → parcel_motorbike", () => {
    const r = classifyJobType("bike parcel");
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.jobType).toBe("parcel_motorbike");
  });

  it("'car parcel' → parcel_car", () => {
    const r = classifyJobType("car parcel to Sleman");
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.jobType).toBe("parcel_car");
  });

  it("'small truck parcel' → large_goods_pickup (default when hints absent)", () => {
    const r = classifyJobType("small truck parcel");
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.jobType).toBe("large_goods_pickup");
  });

  it("'take me from my hotel to YIA airport' → hotel_to_airport", () => {
    const r = classifyJobType("take me from my hotel to YIA airport");
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.jobType).toBe("hotel_to_airport");
  });
});

describe("Job type classifier · ambiguous inputs return AMBIGUOUS with disambiguation options", () => {
  it("'car' alone → AMBIGUOUS (passenger vs parcel)", () => {
    const r = classifyJobType("car");
    expect(r.status).toBe("AMBIGUOUS");
    if (r.status === "AMBIGUOUS") {
      const codes = r.candidates.map((c) => c.jobType);
      expect(codes).toContain("passenger_car");
      expect(codes).toContain("parcel_car");
    }
  });

  it("'send parcel' with no vehicle + no hints → AMBIGUOUS with bike/car/pickup", () => {
    const r = classifyJobType("send parcel");
    expect(r.status).toBe("AMBIGUOUS");
    if (r.status === "AMBIGUOUS") {
      const codes = r.candidates.map((c) => c.jobType);
      expect(codes).toContain("parcel_motorbike");
      expect(codes).toContain("parcel_car");
      expect(codes).toContain("large_goods_pickup");
    }
  });

  it("both bike + car → AMBIGUOUS passenger options", () => {
    const r = classifyJobType("bike or car ride");
    expect(r.status).toBe("AMBIGUOUS");
    if (r.status === "AMBIGUOUS") {
      expect(r.candidates.map((c) => c.jobType)).toEqual(
        expect.arrayContaining(["passenger_motorbike", "passenger_car"]),
      );
    }
  });
});

describe("Job type classifier · size/weight hints override vehicle mention", () => {
  it("'bike parcel' + 50 kg → escalated to parcel_car", () => {
    const r = classifyJobType("bike parcel", { parcelWeightKg: 50 });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.jobType).toBe("parcel_car");
      expect(r.interpretation.toLowerCase()).toMatch(/exceed motorbike limits/);
    }
  });

  it("'car parcel' + 500 kg → escalated to large_goods_pickup", () => {
    const r = classifyJobType("car parcel", { parcelWeightKg: 500 });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.jobType).toBe("large_goods_pickup");
    }
  });

  it("'send' + 15 kg + small dimensions → parcel_motorbike recommendation", () => {
    const r = classifyJobType("send this", { parcelWeightKg: 15, parcelLengthMm: 300, parcelWidthMm: 200, parcelHeightMm: 200 });
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.jobType).toBe("parcel_motorbike");
  });

  it("'send' + 2500 kg → large_goods_small_truck", () => {
    const r = classifyJobType("send this", { parcelWeightKg: 2500 });
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.jobType).toBe("large_goods_small_truck");
  });

  it("'send' + 5000 kg → large_goods_truck", () => {
    const r = classifyJobType("send this", { parcelWeightKg: 5000 });
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.jobType).toBe("large_goods_truck");
  });
});

describe("Job type classifier · fully unknown input", () => {
  it("'purple llama' → UNKNOWN", () => {
    const r = classifyJobType("purple llama");
    expect(r.status).toBe("UNKNOWN");
  });
});

describe("Required-field maps", () => {
  it("passenger job types include pickup/destination/passenger_count", () => {
    const f = requiredFieldsFor("passenger_motorbike");
    expect(f).toEqual(expect.arrayContaining(["pickup", "destination", "passenger_count"]));
  });

  it("parcel job types include recipient + dimensions + prohibited_goods_declaration", () => {
    const f = requiredFieldsFor("parcel_motorbike");
    expect(f).toEqual(expect.arrayContaining([
      "recipient_name", "recipient_phone",
      "parcel_length_mm", "parcel_width_mm", "parcel_height_mm",
      "parcel_weight_kg", "prohibited_goods_declaration",
    ]));
    // Prohibited-goods declaration is required by chain-of-custody design
    expect(f).toContain("prohibited_goods_declaration");
  });

  it("large-goods job types require load description + assistance flags + access notes", () => {
    const f = requiredFieldsFor("large_goods_pickup");
    expect(f).toEqual(expect.arrayContaining([
      "load_description",
      "loading_assistance_needed", "unloading_assistance_needed",
      "pickup_access_notes", "destination_access_notes",
    ]));
  });
});

describe("recommendParcelJobType (pure size-based recommender)", () => {
  it("null weight → null", () => {
    expect(recommendParcelJobType({})).toBeNull();
  });
  it("10 kg small → parcel_motorbike", () => {
    expect(recommendParcelJobType({ parcelWeightKg: 10, parcelLengthMm: 300, parcelWidthMm: 200, parcelHeightMm: 200 })).toBe("parcel_motorbike");
  });
  it("50 kg → parcel_car", () => {
    expect(recommendParcelJobType({ parcelWeightKg: 50, parcelLengthMm: 700, parcelWidthMm: 500, parcelHeightMm: 500 })).toBe("parcel_car");
  });
  it("500 kg → large_goods_pickup", () => {
    expect(recommendParcelJobType({ parcelWeightKg: 500 })).toBe("large_goods_pickup");
  });
  it("2500 kg → large_goods_small_truck", () => {
    expect(recommendParcelJobType({ parcelWeightKg: 2500 })).toBe("large_goods_small_truck");
  });
  it("5000 kg → large_goods_truck", () => {
    expect(recommendParcelJobType({ parcelWeightKg: 5000 })).toBe("large_goods_truck");
  });
  it("light but huge dimensions on motorbike → escalated past parcel_motorbike", () => {
    const r = recommendParcelJobType({ parcelWeightKg: 5, parcelLengthMm: 800, parcelWidthMm: 500, parcelHeightMm: 500 });
    expect(r).toBe("parcel_car");
  });
});
