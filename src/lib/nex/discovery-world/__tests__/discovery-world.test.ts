// src/lib/nex/discovery-world/__tests__/discovery-world.test.ts
//
// NEX World Discovery · acceptance
// Founder-authorised programme · bounded wave 2026-09-21.

import { describe, it, expect } from "vitest";
import {
  ISO_3166_1, UN_MEMBER_COUNT, TOTAL_COUNTRY_COUNT,
  ACTIVE_STATUSES, ACTIVITY_TTL_SECONDS,
  _WORLD_DISCOVERY_BOUNDARY_NO_FAKE_ACTIVITY,
  _WORLD_DISCOVERY_BOUNDARY_FOUNDER_ONLY_EMAILS,
  type CountryStatus, type Region,
} from "..";

// ═══════════════════════════════════════════════════════════════════
// A · ISO 3166-1 seed integrity
// ═══════════════════════════════════════════════════════════════════
describe("World Discovery · (A) ISO 3166-1 seed", () => {
  it("(A1) every entry has 2-letter ISO · 3-letter ISO · numeric code · name · region · subregion", () => {
    for (const c of ISO_3166_1) {
      expect(c.iso_alpha_2.length).toBe(2);
      expect(c.iso_alpha_3.length).toBe(3);
      expect(c.numeric_code.length).toBeGreaterThanOrEqual(1);
      expect(c.name.length).toBeGreaterThan(0);
      expect(["Americas","Europe","Africa","Middle East","Asia","Oceania","Antarctica"]).toContain(c.region);
      expect(c.subregion.length).toBeGreaterThan(0);
    }
  });
  it("(A2) no duplicate ISO-alpha-2 codes", () => {
    const seen = new Set<string>();
    for (const c of ISO_3166_1) {
      expect(seen.has(c.iso_alpha_2)).toBe(false);
      seen.add(c.iso_alpha_2);
    }
  });
  it("(A3) UN-member count roughly matches expected ~193", () => {
    // Some UN observers (VA, PS) sit outside strict UN membership.
    expect(UN_MEMBER_COUNT).toBeGreaterThanOrEqual(190);
    expect(UN_MEMBER_COUNT).toBeLessThanOrEqual(195);
  });
  it("(A4) total country count sits in the 240s (ISO + observers + territories)", () => {
    expect(TOTAL_COUNTRY_COUNT).toBeGreaterThanOrEqual(230);
    expect(TOTAL_COUNTRY_COUNT).toBeLessThanOrEqual(260);
  });
  it("(A5) Asia is present with sizeable membership · Antarctica is a distinct region", () => {
    const byRegion = new Map<Region, number>();
    for (const c of ISO_3166_1) byRegion.set(c.region, (byRegion.get(c.region) ?? 0) + 1);
    expect(byRegion.get("Asia")).toBeGreaterThan(20);
    expect(byRegion.get("Antarctica")).toBe(1);
    expect(byRegion.get("Europe")).toBeGreaterThan(40);
    expect(byRegion.get("Africa")).toBeGreaterThan(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Governance / boundary markers
// ═══════════════════════════════════════════════════════════════════
describe("World Discovery · (B) governance markers", () => {
  it("(B1) active statuses are exactly the states that reflect real ongoing work", () => {
    expect(ACTIVE_STATUSES).toContain("crawling");
    expect(ACTIVE_STATUSES).toContain("processing");
    // Explicitly NOT active: idle · queued · zero_results · source_unavailable · completed · new_data · partial · blocked
    expect(ACTIVE_STATUSES).not.toContain("idle" as CountryStatus);
    expect(ACTIVE_STATUSES).not.toContain("queued" as CountryStatus);
    expect(ACTIVE_STATUSES).not.toContain("zero_results" as CountryStatus);
    expect(ACTIVE_STATUSES).not.toContain("source_unavailable" as CountryStatus);
  });
  it("(B2) activity TTL is finite · claims self-expire · no permanent fake activity", () => {
    expect(ACTIVITY_TTL_SECONDS).toBeGreaterThan(0);
    expect(ACTIVITY_TTL_SECONDS).toBeLessThan(3600);
  });
  it("(B3) boundary markers exported · verified by string identity", () => {
    expect(_WORLD_DISCOVERY_BOUNDARY_NO_FAKE_ACTIVITY).toBe("activity_from_db_state_only_no_animated_pulse");
    expect(_WORLD_DISCOVERY_BOUNDARY_FOUNDER_ONLY_EMAILS).toBe("email_evidence_gated_by_founder_auth_only");
  });
  it("(B4) module exports NO member-facing email endpoint", async () => {
    const mod = await import("..");
    expect((mod as any).loadEmailsForMember).toBeUndefined();
    expect((mod as any).exportBusinessEmails).toBeUndefined();
    expect((mod as any).downloadCountryAddresses).toBeUndefined();
    expect((mod as any).emailsForMemberByCountry).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Region taxonomy
// ═══════════════════════════════════════════════════════════════════
describe("World Discovery · (C) region taxonomy", () => {
  it("(C1) Asia-last belongs to programme policy · never a country-registry property", () => {
    // The country row does NOT have an 'asia_last' field · that would be a
    // categorical mistake. Asia-last is per-programme in policy_json.
    for (const c of ISO_3166_1) {
      expect((c as any).asia_last).toBeUndefined();
    }
  });
  it("(C2) key sovereign entities placed correctly (spot check)", () => {
    const iso = (code: string) => ISO_3166_1.find(c => c.iso_alpha_2 === code)!;
    expect(iso("GB").region).toBe("Europe");
    expect(iso("US").region).toBe("Americas");
    expect(iso("JP").region).toBe("Asia");
    expect(iso("SA").region).toBe("Middle East");
    expect(iso("EG").region).toBe("Africa");
    expect(iso("AU").region).toBe("Oceania");
    expect(iso("AQ").region).toBe("Antarctica");
  });
});
