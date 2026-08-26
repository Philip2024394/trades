// src/lib/nex-transport-acquisition/facebook-public-provider.test.ts
//
// Bright-line tests: provider NEVER makes a real request without full config.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkFacebookProviderConfig, runFacebookPublicProvider } from "./facebook-public-provider";
import { generateQueries, queriesForProvider } from "./query-universe";

const ENV_KEYS = [
  "NEX_FACEBOOK_PROVIDER_ENABLED",
  "NEX_FACEBOOK_APP_ID",
  "NEX_FACEBOOK_APP_SECRET",
  "NEX_FACEBOOK_ACCESS_TOKEN",
];

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

beforeEach(clearEnv);
afterEach(clearEnv);

describe("Facebook provider · default OFF (never scrapes without full config)", () => {
  it("with no env vars → NOT_CONFIGURED (lists all 4 missing)", () => {
    const c = checkFacebookProviderConfig();
    expect(c.status).toBe("NOT_CONFIGURED");
    if (c.status === "NOT_CONFIGURED") {
      expect(c.missing.length).toBe(4);
      expect(c.detail).toMatch(/honest silence/i);
    }
  });

  it("with enabled=true but no APP_ID → still NOT_CONFIGURED", () => {
    process.env.NEX_FACEBOOK_PROVIDER_ENABLED = "true";
    const c = checkFacebookProviderConfig();
    expect(c.status).toBe("NOT_CONFIGURED");
    if (c.status === "NOT_CONFIGURED") {
      expect(c.missing.some((m) => m.includes("NEX_FACEBOOK_APP_ID"))).toBe(true);
    }
  });

  it("with enabled=true + APP_ID + APP_SECRET but no ACCESS_TOKEN → NOT_CONFIGURED", () => {
    process.env.NEX_FACEBOOK_PROVIDER_ENABLED = "true";
    process.env.NEX_FACEBOOK_APP_ID = "fake-app-id";
    process.env.NEX_FACEBOOK_APP_SECRET = "fake-app-secret";
    const c = checkFacebookProviderConfig();
    expect(c.status).toBe("NOT_CONFIGURED");
  });
});

describe("Facebook provider · when fully env-configured but no app-review", () => {
  it("returns REFUSED / META_APP_REVIEW_REQUIRED · never fabricates results", async () => {
    process.env.NEX_FACEBOOK_PROVIDER_ENABLED = "true";
    process.env.NEX_FACEBOOK_APP_ID = "fake-app-id";
    process.env.NEX_FACEBOOK_APP_SECRET = "fake-app-secret";
    process.env.NEX_FACEBOOK_ACCESS_TOKEN = "fake-token";
    const r = await runFacebookPublicProvider({
      queries: queriesForProvider("facebook_public", generateQueries()),
      jurisdictionHint: "ID/DIY/Yogyakarta",
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") {
      expect(r.reason).toBe("META_APP_REVIEW_REQUIRED");
      expect(r.detail).toMatch(/app-review approval/i);
    }
  });
});

describe("Facebook provider · runFacebookPublicProvider with no config", () => {
  it("returns NOT_CONFIGURED · does not attempt any network call", async () => {
    const r = await runFacebookPublicProvider({
      queries: queriesForProvider("facebook_public", generateQueries()),
      jurisdictionHint: "ID/DIY/Yogyakarta",
    });
    expect(r.status).toBe("NOT_CONFIGURED");
  });
});
