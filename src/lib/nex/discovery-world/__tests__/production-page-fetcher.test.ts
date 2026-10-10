// src/lib/nex/discovery-world/__tests__/production-page-fetcher.test.ts
//
// NEX World-Proof · Production PageFetcher acceptance
// Founder-authorised programme · Session-19 · gate #1 · 2026-09-22.

import { describe, it, expect } from "vitest";
import {
  ProductionPageFetcher,
  _PRODUCTION_FETCHER_REQUIRES_ALLOWLIST_SIGNATURE,
  _PRODUCTION_FETCHER_REQUIRES_ACTIVATION_ENV,
  _PRODUCTION_FETCHER_ENFORCES_POLITENESS,
  _PRODUCTION_FETCHER_REDIRECTS_STAY_ON_ALLOWLIST,
  NULL_FETCHER,
  type AllowlistFile, type HttpClient,
} from "..";

const ALLOWLIST: AllowlistFile = {
  version: 1, signed_by: "founder", signed_at: "2026-09-22T00:00:00Z",
  allowed_hosts: [
    { host: "example.com", reason: "test host", max_bytes: 1000, min_interval_ms: 100 },
    { host: "www.example.com", reason: "test host w/ prefix", max_bytes: 1000, min_interval_ms: 100 },
  ],
};

function mockHttp(overrides: Partial<Parameters<HttpClient["request"]>[0] extends any ? { status?: number; body?: string; final_url?: string; headers?: Record<string,string>; truncated?: boolean } : any> = {}): HttpClient {
  return {
    async request({ url, max_bytes }) {
      return {
        status: overrides.status ?? 200,
        final_url: overrides.final_url ?? url,
        headers: overrides.headers ?? { "content-type": "text/html" },
        body_bytes: (overrides.body ?? "<html><body>ok</body></html>").length,
        body_text: overrides.body ?? "<html><body>ok</body></html>",
        truncated: overrides.truncated ?? false,
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// A · Activation gate
// ═══════════════════════════════════════════════════════════════════
describe("Production PageFetcher · (A) activation gate", () => {
  it("(A1) gate off → blocked_by_governance for every URL", async () => {
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env: {} as any });
    const r = await f.fetchPage({ url: "https://example.com/page" });
    expect(r.kind).toBe("blocked_by_governance");
    expect(r.note).toContain("NEX_PAGE_FETCHER_ACTIVATION");
  });
  it("(A2) gate NOT exactly 'on' (true/1/yes) → still blocked", async () => {
    for (const v of ["true", "1", "yes", "ON", "On"]) {
      const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env: { NEX_PAGE_FETCHER_ACTIVATION: v } as any });
      const r = await f.fetchPage({ url: "https://example.com/page" });
      expect(r.kind).toBe("blocked_by_governance");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Allowlist gate
// ═══════════════════════════════════════════════════════════════════
describe("Production PageFetcher · (B) allowlist gate", () => {
  const env = { NEX_PAGE_FETCHER_ACTIVATION: "on" } as any;
  it("(B1) host NOT on allowlist → blocked_by_governance", async () => {
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env, http_client: mockHttp() });
    const r = await f.fetchPage({ url: "https://malicious.example.tld/steal" });
    expect(r.kind).toBe("blocked_by_governance");
    expect(r.note).toContain("not on Founder-signed allowlist");
  });
  it("(B2) host ON allowlist + gate on → fetch proceeds", async () => {
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env, http_client: mockHttp() });
    const r = await f.fetchPage({ url: "https://example.com/page" });
    expect(r.kind).toBe("responded");
  });
  it("(B3) invalid URL → blocked_by_governance", async () => {
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env, http_client: mockHttp() });
    const r = await f.fetchPage({ url: "not-a-url" });
    expect(r.kind).toBe("blocked_by_governance");
  });
  it("(B4) non-http protocol → blocked_by_governance", async () => {
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env, http_client: mockHttp() });
    const r = await f.fetchPage({ url: "ftp://example.com/x" });
    expect(r.kind).toBe("blocked_by_governance");
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Politeness (min-interval per host)
// ═══════════════════════════════════════════════════════════════════
describe("Production PageFetcher · (C) politeness", () => {
  const env = { NEX_PAGE_FETCHER_ACTIVATION: "on" } as any;
  it("(C1) two rapid fetches to same host · second returns rate_limited", async () => {
    let t = 1_000_000;
    const clock = () => t;
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env, http_client: mockHttp(), clock });
    const r1 = await f.fetchPage({ url: "https://example.com/a" });
    expect(r1.kind).toBe("responded");
    t += 50; // less than min_interval_ms=100
    const r2 = await f.fetchPage({ url: "https://example.com/b" });
    expect(r2.kind).toBe("rate_limited");
  });
  it("(C2) fetch after min_interval elapsed · second succeeds", async () => {
    let t = 1_000_000;
    const clock = () => t;
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env, http_client: mockHttp(), clock });
    await f.fetchPage({ url: "https://example.com/a" });
    t += 200;
    const r = await f.fetchPage({ url: "https://example.com/b" });
    expect(r.kind).toBe("responded");
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · robots.txt gate
// ═══════════════════════════════════════════════════════════════════
describe("Production PageFetcher · (D) robots.txt", () => {
  const env = { NEX_PAGE_FETCHER_ACTIVATION: "on" } as any;
  it("(D1) robots disallow → robots_denied", async () => {
    const f = new ProductionPageFetcher({
      allowlist: ALLOWLIST, env, http_client: mockHttp(),
      robots_checker: async () => false,
    });
    const r = await f.fetchPage({ url: "https://example.com/private" });
    expect(r.kind).toBe("robots_denied");
  });
  it("(D2) robots allow → fetch proceeds", async () => {
    const f = new ProductionPageFetcher({
      allowlist: ALLOWLIST, env, http_client: mockHttp(),
      robots_checker: async () => true,
    });
    const r = await f.fetchPage({ url: "https://example.com/public" });
    expect(r.kind).toBe("responded");
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Response outcomes
// ═══════════════════════════════════════════════════════════════════
describe("Production PageFetcher · (E) response outcomes", () => {
  const env = { NEX_PAGE_FETCHER_ACTIVATION: "on" } as any;
  it("(E1) 200 empty body → responded_zero", async () => {
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env, http_client: mockHttp({ status: 200, body: "" }) });
    const r = await f.fetchPage({ url: "https://example.com/empty" });
    expect(r.kind).toBe("responded_zero");
  });
  it("(E2) 304 → not_modified", async () => {
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env, http_client: mockHttp({ status: 304, body: "" }) });
    const r = await f.fetchPage({ url: "https://example.com/x", if_none_match: "abc" });
    expect(r.kind).toBe("not_modified");
  });
  it("(E3) 404 → not_found", async () => {
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env, http_client: mockHttp({ status: 404, body: "" }) });
    const r = await f.fetchPage({ url: "https://example.com/missing" });
    expect(r.kind).toBe("not_found");
  });
  it("(E4) 429 → rate_limited", async () => {
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env, http_client: mockHttp({ status: 429, body: "" }) });
    const r = await f.fetchPage({ url: "https://example.com/x" });
    expect(r.kind).toBe("rate_limited");
  });
  it("(E5) 5xx → unavailable", async () => {
    const f = new ProductionPageFetcher({ allowlist: ALLOWLIST, env, http_client: mockHttp({ status: 503, body: "" }) });
    const r = await f.fetchPage({ url: "https://example.com/x" });
    expect(r.kind).toBe("unavailable");
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Redirect out of allowlist
// ═══════════════════════════════════════════════════════════════════
describe("Production PageFetcher · (F) redirect gate", () => {
  const env = { NEX_PAGE_FETCHER_ACTIVATION: "on" } as any;
  it("(F1) redirect to non-allowlisted host → blocked_by_governance", async () => {
    const f = new ProductionPageFetcher({
      allowlist: ALLOWLIST, env,
      http_client: mockHttp({ status: 200, body: "ok", final_url: "https://redirect-target.tld/y" }),
    });
    const r = await f.fetchPage({ url: "https://example.com/x" });
    expect(r.kind).toBe("blocked_by_governance");
    expect(r.note).toContain("redirect");
  });
  it("(F2) redirect within allowlist (subdomain listed) → responded", async () => {
    const f = new ProductionPageFetcher({
      allowlist: ALLOWLIST, env,
      http_client: mockHttp({ status: 200, body: "ok", final_url: "https://www.example.com/y" }),
    });
    const r = await f.fetchPage({ url: "https://example.com/x" });
    expect(r.kind).toBe("responded");
  });
});

// ═══════════════════════════════════════════════════════════════════
// G · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Production PageFetcher · (G) governance canaries", () => {
  it("(G1) boundary markers exported", () => {
    expect(_PRODUCTION_FETCHER_REQUIRES_ALLOWLIST_SIGNATURE).toContain("founder_signed_allowlist");
    expect(_PRODUCTION_FETCHER_REQUIRES_ACTIVATION_ENV).toContain("NEX_PAGE_FETCHER_ACTIVATION");
    expect(_PRODUCTION_FETCHER_ENFORCES_POLITENESS).toContain("min_interval");
    expect(_PRODUCTION_FETCHER_REDIRECTS_STAY_ON_ALLOWLIST).toContain("blocked_by_governance");
  });
  it("(G2) NULL_FETCHER remains the module default · this class is opt-in only", () => {
    expect(NULL_FETCHER.source_id).toBe("null-fetcher");
  });
  it("(G3) module exports NO expandAllowlist / bypassGovernance / addHost function", async () => {
    const mod: any = await import("..");
    expect(mod.expandAllowlist).toBeUndefined();
    expect(mod.bypassGovernance).toBeUndefined();
    expect(mod.addAllowedHost).toBeUndefined();
    expect(mod.forceFetch).toBeUndefined();
    expect(mod.disableRobots).toBeUndefined();
  });
});
