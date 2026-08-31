// Unit tests · commercial qualification engine · Philip 2026-08-27.
//
// Locks in the deterministic funnel rules so a future change (e.g. loosening
// contactable to accept email) fails loudly here.

import { describe, it, expect } from "vitest";
import {
  qualify,
  looksLikeDialablePhone,
  looksLikeUsableWhatsApp,
  isQualificationOwned,
  COMMERCIAL_STATES,
  QUALIFICATION_STATES,
  MARKETING_STATES,
} from "./_commercial-states.mjs";

describe("looksLikeDialablePhone", () => {
  it.each([
    ["+6281234567890", true],
    ["6281234567890",  true],
    ["081234567890",   true],
    ["+44 20 7946 0958", true],   // permissive on foreign +
  ])("%s → %s", (input, expected) => {
    expect(looksLikeDialablePhone(input)).toBe(expected);
  });

  it.each([
    [null, false],
    ["", false],
    ["not a phone", false],
    ["0000000", false],           // all same digit
    ["12345", false],             // too short
    ["12345678901234567", false], // too long
  ])("%s → %s", (input, expected) => {
    expect(looksLikeDialablePhone(input)).toBe(expected);
  });
});

describe("looksLikeUsableWhatsApp", () => {
  it.each([
    ["https://wa.me/6281234567890", true],
    ["wa.me/6281234567890", true],
    ["+6281234567890", true],
    ["6281234567890", true],
    ["081234567890", true],
    ["", false],
    [null, false],
    ["random string", false],
  ])("%s → %s", (input, expected) => {
    expect(looksLikeUsableWhatsApp(input)).toBe(expected);
  });
});

describe("state ownership", () => {
  it("qualification owns 4 states", () => {
    expect(QUALIFICATION_STATES).toEqual([
      "discovered", "qualified", "contactable", "marketing_ready",
    ]);
  });
  it("marketing owns 6 states", () => {
    expect(MARKETING_STATES).toEqual([
      "attempted", "engaged", "invited", "trial", "paid", "declined",
    ]);
  });
  it("qualification + marketing = 10", () => {
    expect(QUALIFICATION_STATES.length + MARKETING_STATES.length).toBe(10);
  });
  it("no overlap between the two sets", () => {
    const q = new Set(QUALIFICATION_STATES);
    for (const m of MARKETING_STATES) expect(q.has(m)).toBe(false);
  });
  it("isQualificationOwned matches", () => {
    expect(isQualificationOwned("discovered")).toBe(true);
    expect(isQualificationOwned("marketing_ready")).toBe(true);
    expect(isQualificationOwned("attempted")).toBe(false);
    expect(isQualificationOwned("paid")).toBe(false);
  });
});

describe("qualify · deterministic band computation", () => {
  const base = { business_name: null, website: null, phone: null, whatsapp_number: null, hero_image_url: null };

  it("empty row → discovered (no change from default)", () => {
    const r = qualify({ ...base, commercial_status: "discovered" });
    expect(r.newStatus).toBe("discovered");
    expect(r.changed).toBe(false);
    expect(r.reason.has_name).toBe(false);
  });

  it("name only → discovered (name alone isn't enough)", () => {
    const r = qualify({ ...base, business_name: "Gym A", commercial_status: "discovered" });
    expect(r.newStatus).toBe("discovered");
  });

  it("name + website → qualified", () => {
    const r = qualify({ ...base, business_name: "Gym A", website: "https://gymA.co", commercial_status: "discovered" });
    expect(r.newStatus).toBe("qualified");
    expect(r.changed).toBe(true);
    expect(r.reason.has_name).toBe(true);
    expect(r.reason.has_website).toBe(true);
  });

  it("name + phone → contactable (phone qualifies AND contactable)", () => {
    const r = qualify({ ...base, business_name: "Gym A", phone: "+6281234567890", commercial_status: "discovered" });
    expect(r.newStatus).toBe("contactable");
  });

  it("name + whatsapp → contactable", () => {
    const r = qualify({ ...base, business_name: "Salon B", whatsapp_number: "6281234567890", commercial_status: "discovered" });
    expect(r.newStatus).toBe("contactable");
  });

  it("name + phone + hero image → marketing_ready", () => {
    const r = qualify({
      ...base,
      business_name: "Gym A",
      phone: "+6281234567890",
      hero_image_url: "https://gyma.co/hero.jpg",
      commercial_status: "discovered",
    });
    expect(r.newStatus).toBe("marketing_ready");
    expect(r.reason.has_hero_image).toBe(true);
  });

  it("hero image alone does NOT promote past contactable (no phone/whatsapp)", () => {
    const r = qualify({
      ...base,
      business_name: "Gym A",
      website: "https://gyma.co",
      hero_image_url: "https://gyma.co/hero.jpg",
      commercial_status: "discovered",
    });
    expect(r.newStatus).toBe("qualified");   // has_name + has_website · no contact channel
  });

  it("website + phone + image → marketing_ready", () => {
    const r = qualify({
      business_name: "Dentist C",
      website: "https://dentistc.id",
      phone: "6281234567890",
      whatsapp_number: null,
      hero_image_url: "https://dentistc.id/team.jpg",
      commercial_status: "discovered",
    });
    expect(r.newStatus).toBe("marketing_ready");
  });

  it("idempotent · same input yields no-change on second run", () => {
    const input = {
      business_name: "Gym A",
      website: "https://gyma.co",
      phone: "+6281234567890",
      whatsapp_number: null,
      hero_image_url: "https://gyma.co/hero.jpg",
      commercial_status: "marketing_ready",
    };
    const r = qualify(input);
    expect(r.newStatus).toBe("marketing_ready");
    expect(r.changed).toBe(false);
  });

  it("never overwrites marketing workforce states", () => {
    for (const marketingState of MARKETING_STATES) {
      const r = qualify({
        business_name: "Gym A",
        website: "https://gyma.co",
        phone: "+6281234567890",
        whatsapp_number: null,
        hero_image_url: "https://gyma.co/hero.jpg",
        commercial_status: marketingState,
      });
      expect(r.changed).toBe(false);
      expect(r.newStatus).toBe(marketingState);
      expect(r.reason.skipped).toBe("marketing-owned");
    }
  });

  it("junk phone doesn't cause false contactable", () => {
    const r = qualify({
      ...base,
      business_name: "Gym A",
      phone: "not a phone",
      website: "https://gyma.co",
      commercial_status: "discovered",
    });
    expect(r.newStatus).toBe("qualified");   // has website, but no valid phone
    expect(r.reason.has_phone).toBe(false);
  });

  it("reason object always includes all 5 gates", () => {
    const r = qualify({ ...base, business_name: "X", commercial_status: "discovered" });
    for (const gate of ["has_name", "has_website", "has_phone", "has_whatsapp", "has_hero_image"]) {
      expect(r.reason).toHaveProperty(gate);
    }
  });
});

describe("COMMERCIAL_STATES · frozen contract", () => {
  it("exposes exactly the 10 named states", () => {
    expect(Object.keys(COMMERCIAL_STATES).sort()).toEqual([
      "ATTEMPTED", "CONTACTABLE", "DECLINED", "DISCOVERED", "ENGAGED",
      "INVITED", "MARKETING_READY", "PAID", "QUALIFIED", "TRIAL",
    ]);
  });
  it("is frozen (public contract)", () => {
    expect(Object.isFrozen(COMMERCIAL_STATES)).toBe(true);
  });
});
