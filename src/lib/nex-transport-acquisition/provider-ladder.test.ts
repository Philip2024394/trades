// src/lib/nex-transport-acquisition/provider-ladder.test.ts

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PROVIDER_LADDER, describeProviderLadder, individualDriverSlots } from "./provider-ladder";

const ENV_KEYS = [
  "NEX_FACEBOOK_PROVIDER_ENABLED",
  "NEX_FACEBOOK_APP_ID",
  "NEX_FACEBOOK_APP_SECRET",
  "NEX_FACEBOOK_ACCESS_TOKEN",
  "NEX_GOOGLE_PLACES_ENABLED",
  "NEX_GOOGLE_PLACES_API_KEY",
];

function clearEnv() { for (const k of ENV_KEYS) delete process.env[k]; }
beforeEach(clearEnv);
afterEach(clearEnv);

describe("Provider ladder · structure", () => {
  it("declares at least six ordered slots · every id unique", () => {
    expect(PROVIDER_LADDER.length).toBeGreaterThanOrEqual(6);
    const ids = PROVIDER_LADDER.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every slot is publicOnly=true (constitutional)", () => {
    for (const slot of PROVIDER_LADDER) expect(slot.publicOnly).toBe(true);
  });

  it("ladder positions are strictly ascending after sort", () => {
    const rows = describeProviderLadder();
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].ladderPosition).toBeGreaterThan(rows[i - 1].ladderPosition);
    }
  });
});

describe("Provider ladder · honest default status", () => {
  it("nominatim + overpass are READY (already integrated)", () => {
    const rows = describeProviderLadder();
    expect(rows.find((r) => r.id === "nominatim")?.status).toBe("READY");
    expect(rows.find((r) => r.id === "overpass")?.status).toBe("READY");
  });

  it("facebook is GATED_ENV in default (unconfigured) state", () => {
    const rows = describeProviderLadder();
    const fb = rows.find((r) => r.id === "facebook_public")!;
    expect(fb.status).toBe("GATED_ENV");
    expect(fb.missing).toContain("NEX_FACEBOOK_PROVIDER_ENABLED=true");
    expect(fb.missing).toContain("NEX_FACEBOOK_APP_ID");
    expect(fb.missing).toContain("NEX_FACEBOOK_APP_SECRET");
    expect(fb.missing).toContain("NEX_FACEBOOK_ACCESS_TOKEN");
  });

  it("google_places is NOT_YET_INTEGRATED in default state", () => {
    const rows = describeProviderLadder();
    expect(rows.find((r) => r.id === "google_places")?.status).toBe("NOT_YET_INTEGRATED");
  });

  it("public_recruitment_advertisement slot is reserved (NOT_YET_INTEGRATED)", () => {
    const rows = describeProviderLadder();
    expect(rows.find((r) => r.id === "public_recruitment_advertisement")?.status).toBe("NOT_YET_INTEGRATED");
  });
});

describe("Provider ladder · env transitions", () => {
  it("facebook moves to GATED_APPROVAL when all 4 env vars are set", () => {
    process.env.NEX_FACEBOOK_PROVIDER_ENABLED = "true";
    process.env.NEX_FACEBOOK_APP_ID           = "app-id";
    process.env.NEX_FACEBOOK_APP_SECRET       = "app-secret";
    process.env.NEX_FACEBOOK_ACCESS_TOKEN     = "token";
    const rows = describeProviderLadder();
    const fb = rows.find((r) => r.id === "facebook_public")!;
    expect(fb.status).toBe("GATED_APPROVAL");
    expect(fb.note).toMatch(/app-review/);
  });

  it("google_places moves to GATED_APPROVAL when env vars are set (implementation deferred)", () => {
    process.env.NEX_GOOGLE_PLACES_ENABLED = "true";
    process.env.NEX_GOOGLE_PLACES_API_KEY = "key";
    const rows = describeProviderLadder();
    expect(rows.find((r) => r.id === "google_places")?.status).toBe("GATED_APPROVAL");
  });
});

describe("Provider ladder · individual-driver focus", () => {
  it("individualDriverSlots() surfaces the slots best able to reach individual drivers", () => {
    const rows = individualDriverSlots();
    const ids = rows.map((r) => r.id);
    // Facebook + directory + recruitment posts are the individual-driver slots
    expect(ids).toContain("facebook_public");
    expect(ids).toContain("public_directory_indonesia");
    expect(ids).toContain("public_recruitment_advertisement");
    // Nominatim + Overpass alone will not find individual drivers
    expect(ids).not.toContain("nominatim");
    expect(ids).not.toContain("overpass");
  });
});
