// src/lib/nex/brain/interest/contactability.test.ts

import { describe, expect, it } from "vitest";
import { assessContactability, canInterestFireSend } from "./contactability";
import type { WorldRecord } from "../world-adapters/types";

function rec(overrides: Partial<WorldRecord> & Record<string, unknown>): WorldRecord {
  return {
    id: overrides.id ?? "#AC-2026-0000A",
    name: overrides.name ?? "Test Hotel",
    vertical: "accommodation",
    market: "ID",
    category: "hotel",
    claimStatus: overrides.claimStatus ?? "listed",
    verified: overrides.verified ?? false,
    latitude: 0,
    longitude: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-09-01T00:00:00Z" } as any,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("contactability · verified paths", () => {
  it("claimed + verified + phone present → VERIFIED_CONTACT · send enabled", () => {
    const r = rec({ claimStatus: "claimed", verified: true, phone: "+62 812 3456 7890" });
    const a = assessContactability(r);
    expect(a.state).toBe("VERIFIED_CONTACT");
    expect(a.interest_send_enabled).toBe(true);
    expect(canInterestFireSend(a)).toBe(true);
  });
  it("claimed + verified + whatsapp → VERIFIED_CONTACT", () => {
    const r = rec({ claimStatus: "claimed", verified: true, whatsapp: "+62 813 0000 0000" });
    const a = assessContactability(r);
    expect(a.state).toBe("VERIFIED_CONTACT");
  });
  it("claimed + verified + website → VERIFIED_CONTACT", () => {
    const r = rec({ claimStatus: "claimed", verified: true, website: "https://example.com" });
    const a = assessContactability(r);
    expect(a.state).toBe("VERIFIED_CONTACT");
  });
});

describe("contactability · present-but-unverified", () => {
  it("phone present but NOT claimed → NO_VERIFIED_CONTACT · send NOT enabled", () => {
    const r = rec({ phone: "+62 812 3456 7890" });
    const a = assessContactability(r);
    expect(a.state).toBe("NO_VERIFIED_CONTACT");
    expect(a.interest_send_enabled).toBe(false);
    expect(canInterestFireSend(a)).toBe(false);
    expect(a.reason).toContain("channels_present_but_unverified");
  });
  it("phone present + verified=true but NOT claimed → NO_VERIFIED_CONTACT", () => {
    // verified=true without claimStatus=claimed does NOT constitute
    // owner-verified · both required.
    const r = rec({ phone: "+62 812", verified: true, claimStatus: "listed" });
    const a = assessContactability(r);
    expect(a.state).toBe("NO_VERIFIED_CONTACT");
    expect(a.interest_send_enabled).toBe(false);
  });
});

describe("contactability · UNKNOWN_CONTACT", () => {
  it("no channels populated · no claim → UNKNOWN_CONTACT · send NOT enabled", () => {
    const r = rec({});
    const a = assessContactability(r);
    expect(a.state).toBe("UNKNOWN_CONTACT");
    expect(a.interest_send_enabled).toBe(false);
    expect(canInterestFireSend(a)).toBe(false);
    expect(a.reason).toBe("no_channels_populated");
  });
});

describe("contactability · channels breakdown", () => {
  it("channels array always contains all 4 channels", () => {
    const a = assessContactability(rec({}));
    expect(a.channels.length).toBe(4);
    expect(a.channels.map((c) => c.channel).sort()).toEqual(["email", "phone", "website", "whatsapp"]);
  });
  it("channel value preserved but never fabricated", () => {
    const a = assessContactability(rec({ phone: "+62 812" }));
    const phoneCh = a.channels.find((c) => c.channel === "phone");
    expect(phoneCh?.value).toBe("+62 812");
    const emailCh = a.channels.find((c) => c.channel === "email");
    expect(emailCh?.value).toBeUndefined();
    expect(emailCh?.present).toBe(false);
  });
});

describe("contactability · immutable rule §31", () => {
  it("NEVER enables send from present-but-unverified data (no fabrication path)", () => {
    // This is the hard rule of the slice · any test regression here
    // is a red flag.
    const scenarios = [
      { phone: "+62 812 3456 7890" },
      { whatsapp: "+62 813 0000 0000" },
      { website: "https://example.com" },
      { email: "test@example.com" },
      { phone: "+62 812", whatsapp: "+62 813" },
    ];
    for (const scenario of scenarios) {
      const a = assessContactability(rec(scenario));
      expect(a.interest_send_enabled).toBe(false);
    }
  });
});
