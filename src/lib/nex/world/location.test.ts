// Location resolver — priority chain + pure helpers.

import { describe, it, expect, vi, beforeEach } from "vitest";

let merchantRow: { country?: string | null; city?: string | null; postcode_prefix?: string | null } | null = null;
let projectRow:  { address_city?: string | null; address_postcode?: string | null } | null = null;
let contactRow:  { postcode?: string | null } | null = null;

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from(table: string) {
      const b = {
        select: () => b,
        eq:     () => b,
        maybeSingle: async () => {
          if (table === "hammerex_trade_off_listings") return { data: merchantRow };
          if (table === "hammerex_sitebook_projects")  return { data: projectRow };
          if (table === "app_crm_contacts")            return { data: contactRow };
          return { data: null };
        }
      };
      return b;
    }
  }
}));

import { countryFromPostcode, normaliseCountry, resolveLocation } from "./location";

beforeEach(() => { merchantRow = null; projectRow = null; contactRow = null; });

describe("normaliseCountry", () => {
  it("normalises UK/IE/AU/US aliases", () => {
    expect(normaliseCountry("United Kingdom")).toBe("UK");
    expect(normaliseCountry("Ireland")).toBe("IE");
    expect(normaliseCountry("Australia")).toBe("AU");
    expect(normaliseCountry("United States")).toBe("US");
  });
  it("returns 'unknown' when nothing matches", () => {
    expect(normaliseCountry("Atlantis")).toBe("unknown");
    expect(normaliseCountry(null)).toBe("unknown");
  });
});

describe("countryFromPostcode", () => {
  it("recognises UK postcodes", () => {
    expect(countryFromPostcode("M25 1AB")).toBe("UK");
    expect(countryFromPostcode("SW1A0AA")).toBe("UK");
    expect(countryFromPostcode("EC1")).toBe("UK");
  });
  it("recognises IE Eircodes", () => {
    expect(countryFromPostcode("D02 XW69")).toBe("IE");
  });
  it("returns 'unknown' for unrecognised", () => {
    expect(countryFromPostcode("12345")).toBe("unknown");
    expect(countryFromPostcode(null)).toBe("unknown");
  });
});

describe("resolveLocation — priority chain", () => {
  it("PRIORITY 0 — explicit override wins over everything", async () => {
    merchantRow = { country: "United States" };
    const loc = await resolveLocation({ merchantSlug: "phil", override: { country: "AU" } });
    expect(loc.country).toBe("AU");
    expect(loc.source).toBe("merchant_setting");
  });

  it("PRIORITY 1 — merchant listing country", async () => {
    merchantRow = { country: "Ireland", city: "Dublin" };
    const loc = await resolveLocation({ merchantSlug: "phil" });
    expect(loc.country).toBe("IE");
    expect(loc.source).toBe("merchant_setting");
    expect(loc.city).toBe("Dublin");
  });

  it("PRIORITY 2 — project postcode when merchant blank", async () => {
    merchantRow = null;
    projectRow = { address_postcode: "M25 1AB", address_city: "Manchester" };
    const loc = await resolveLocation({ merchantSlug: "phil", projectId: "p1" });
    expect(loc.country).toBe("UK");
    expect(loc.source).toBe("active_project");
    expect(loc.city).toBe("Manchester");
  });

  it("PRIORITY 3 — customer contact postcode when merchant + project blank", async () => {
    contactRow = { postcode: "D02 XW69" };
    const loc = await resolveLocation({ contactId: "c1" });
    expect(loc.country).toBe("IE");
    expect(loc.source).toBe("customer");
  });

  it("PRIORITY 4 — device", async () => {
    const loc = await resolveLocation({ device: { country: "Australia" } });
    expect(loc.country).toBe("AU");
    expect(loc.source).toBe("device");
  });

  it("PRIORITY 5 — IP fallback", async () => {
    const loc = await resolveLocation({ ip_country: "United States" });
    expect(loc.country).toBe("US");
    expect(loc.source).toBe("ip_fallback");
  });

  it("PRIORITY 6 — engine default when no signal at all", async () => {
    const loc = await resolveLocation({});
    expect(loc.country).toBe("unknown");
    expect(loc.source).toBe("engine_default");
    expect(loc.reason.toLowerCase()).toContain("set your country");
  });
});
