// src/lib/nex/brain/world-extractors.test.ts
//
// Stage 3.34e · Search-query + max-price extractor tests
// (Philip 2026-08-31).
//
// Closes the "buy me headphones returns all products" gap by proving
// the message → adapter.query + max-price pipeline works.

import { describe, expect, it } from "vitest";
import { extractWorldSearchQuery, extractMaxPriceIdr } from "./orchestrate";

describe("extractWorldSearchQuery · English", () => {
  it("'buy me headphones' → 'headphones'", () => {
    expect(extractWorldSearchQuery("buy me headphones")).toBe("headphones");
  });

  it("'find me a phone under 3 million' → 'phone' (drops the price tail)", () => {
    expect(extractWorldSearchQuery("find me a phone under 3 million")).toBe("phone");
  });

  it("'find me a plumber near me' → 'plumber' (drops locative tail)", () => {
    expect(extractWorldSearchQuery("find me a plumber near me")).toBe("plumber");
  });

  it("'where can I find gudeg' → 'gudeg'", () => {
    expect(extractWorldSearchQuery("where can I find gudeg")).toBe("gudeg");
  });

  it("'recommend a laptop for gaming' → 'laptop' (drops for-clause)", () => {
    expect(extractWorldSearchQuery("recommend a laptop for gaming")).toBe("laptop");
  });

  it("'buy me a wireless headset with noise cancellation' → keeps the compound noun", () => {
    const q = extractWorldSearchQuery("buy me a wireless headset with noise cancellation");
    expect(q).toBe("wireless headset");
  });

  it("returns undefined when no verb + noun pattern present", () => {
    expect(extractWorldSearchQuery("hello there")).toBeUndefined();
    expect(extractWorldSearchQuery("")).toBeUndefined();
  });
});

describe("extractWorldSearchQuery · Bahasa Indonesia", () => {
  it("'beli headphone' → 'headphone'", () => {
    expect(extractWorldSearchQuery("beli headphone")).toBe("headphone");
  });

  it("'cari warung' → 'warung'", () => {
    expect(extractWorldSearchQuery("cari warung")).toBe("warung");
  });

  it("'cari dokter gigi di jogja' → 'dokter gigi' (drops city tail)", () => {
    expect(extractWorldSearchQuery("cari dokter gigi di jogja")).toBe("dokter gigi");
  });

  it("'butuh laptop untuk gaming' → 'laptop'", () => {
    expect(extractWorldSearchQuery("butuh laptop untuk gaming")).toBe("laptop");
  });
});

describe("extractMaxPriceIdr · English", () => {
  it("'phone under 3 million' → 3,000,000", () => {
    expect(extractMaxPriceIdr("phone under 3 million")).toBe(3_000_000);
  });

  it("'less than 5m' → 5,000,000", () => {
    expect(extractMaxPriceIdr("laptop less than 5m")).toBe(5_000_000);
  });

  it("'below Rp 2,500' → 2500 (raw number)", () => {
    expect(extractMaxPriceIdr("book below Rp 2,500")).toBe(2500);
  });

  it("no price signal → undefined", () => {
    expect(extractMaxPriceIdr("find me a phone")).toBeUndefined();
    expect(extractMaxPriceIdr("hello")).toBeUndefined();
  });
});

describe("extractMaxPriceIdr · Bahasa Indonesia", () => {
  it("'bawah 3 juta' → 3,000,000", () => {
    expect(extractMaxPriceIdr("hp bawah 3 juta")).toBe(3_000_000);
  });

  it("'kurang dari 500 ribu' → 500,000", () => {
    expect(extractMaxPriceIdr("baju kurang dari 500 ribu")).toBe(500_000);
  });

  it("'maksimal 2 jt' → 2,000,000", () => {
    expect(extractMaxPriceIdr("laptop maksimal 2 jt")).toBe(2_000_000);
  });
});
