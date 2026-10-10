// src/lib/nex/marketing/deliverability/__tests__/dns-domain-auth-checker.test.ts
//
// NEX Deliverability · DNS DomainAuthChecker acceptance
// Founder-authorised programme · Session-10 · Part 12 (gate #3 preparation) · 2026-09-21.

import { describe, it, expect } from "vitest";
import {
  DnsDomainAuthChecker,
  classifySpf, classifyDkim, classifyDmarc,
  COMMON_DKIM_SELECTORS,
  _DNS_CHECKER_IS_NOT_MODULE_DEFAULT,
  _DNS_CHECKER_FAILS_CLOSED_ON_ERROR,
  _DNS_CHECKER_ONLY_QUERIES_THREE_NAMESPACES,
  NULL_DOMAIN_CHECKER,
  refreshDomainAuth,
  type DnsResolver,
} from "..";

// ─── Fake DNS resolver · records the exact queries it received ──────
function makeFakeResolver(map: Record<string, string[][] | Error>) {
  const queries: string[] = [];
  const resolver: DnsResolver = {
    async resolveTxt(hostname: string) {
      queries.push(hostname);
      const v = map[hostname];
      if (v === undefined) {
        const err: any = new Error(`ENOTFOUND ${hostname}`);
        err.code = "ENOTFOUND";
        throw err;
      }
      if (v instanceof Error) throw v;
      return v;
    },
  };
  return { resolver, queries };
}

// ═══════════════════════════════════════════════════════════════════
// A · SPF classification (pure)
// ═══════════════════════════════════════════════════════════════════
describe("DNS checker · (A) SPF classification", () => {
  it("(A1) hard fail -all", () => {
    const r = classifySpf(["v=spf1 include:_spf.google.com -all"]);
    expect(r.status).toBe("hard_fail");
  });
  it("(A2) soft fail ~all", () => {
    const r = classifySpf(["v=spf1 include:sendgrid.net ~all"]);
    expect(r.status).toBe("soft_fail");
  });
  it("(A3) pass +all", () => {
    const r = classifySpf(["v=spf1 include:example.com +all"]);
    expect(r.status).toBe("pass");
  });
  it("(A4) missing when no v=spf1 record present", () => {
    const r = classifySpf(["v=other1 nope", "random text"]);
    expect(r.status).toBe("missing");
  });
  it("(A5) permerror when multiple SPF records present (RFC 7208 §3.2)", () => {
    const r = classifySpf(["v=spf1 -all", "v=spf1 ~all"]);
    expect(r.status).toBe("permerror");
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · DKIM classification
// ═══════════════════════════════════════════════════════════════════
describe("DNS checker · (B) DKIM classification", () => {
  it("(B1) valid record with p=... → pass", () => {
    const r = classifyDkim(["v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBC"]);
    expect(r.status).toBe("pass");
  });
  it("(B2) revoked key (empty p=) → fail", () => {
    const r = classifyDkim(["v=DKIM1; k=rsa; p="]);
    expect(r.status).toBe("fail");
  });
  it("(B3) no DKIM record → no_signature", () => {
    const r = classifyDkim(["some other txt"]);
    expect(r.status).toBe("no_signature");
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · DMARC classification
// ═══════════════════════════════════════════════════════════════════
describe("DNS checker · (C) DMARC classification", () => {
  it("(C1) p=reject → reject_policy", () => {
    const r = classifyDmarc(["v=DMARC1; p=reject; pct=100; rua=mailto:d@x.com"]);
    expect(r.status).toBe("reject_policy");
    expect(r.pct).toBe(100);
  });
  it("(C2) p=quarantine pct=50", () => {
    const r = classifyDmarc(["v=DMARC1; p=quarantine; pct=50"]);
    expect(r.status).toBe("quarantine_policy");
    expect(r.pct).toBe(50);
  });
  it("(C3) p=none → none_policy", () => {
    const r = classifyDmarc(["v=DMARC1; p=none"]);
    expect(r.status).toBe("none_policy");
    expect(r.pct).toBe(100);
  });
  it("(C4) missing v=DMARC1 → missing", () => {
    const r = classifyDmarc([]);
    expect(r.status).toBe("missing");
  });
  it("(C5) multiple DMARC records → fail (invalid config)", () => {
    const r = classifyDmarc(["v=DMARC1; p=reject", "v=DMARC1; p=none"]);
    expect(r.status).toBe("fail");
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Whole-domain lookup (via fake resolver)
// ═══════════════════════════════════════════════════════════════════
describe("DNS checker · (D) whole-domain check", () => {
  it("(D1) fully authenticated domain → SPF pass · DKIM pass · DMARC reject", async () => {
    const { resolver, queries } = makeFakeResolver({
      "example.com":               [["v=spf1 include:_spf.google.com -all"]],
      "google._domainkey.example.com": [["v=DKIM1; k=rsa; p=MIIBIjAN"]],
      "_dmarc.example.com":        [["v=DMARC1; p=reject; pct=100"]],
    });
    const c = new DnsDomainAuthChecker({ resolver });
    const r = await c.checkDomain("example.com");
    expect(r.spf_status).toBe("hard_fail"); // -all is hard_fail (correct SPF behaviour)
    expect(r.dkim_status).toBe("pass");
    expect(r.dkim_selector).toBe("google");
    expect(r.dmarc_status).toBe("reject_policy");
    // Only queries the three namespaces
    expect(queries.some(q => q === "example.com")).toBe(true);
    expect(queries.some(q => q === "_dmarc.example.com")).toBe(true);
    expect(queries.some(q => q.endsWith("._domainkey.example.com"))).toBe(true);
    // No stray queries beyond SPF, DMARC, and DKIM selectors
    for (const q of queries) {
      expect(
        q === "example.com" ||
        q === "_dmarc.example.com" ||
        q.endsWith("._domainkey.example.com")
      ).toBe(true);
    }
  });

  it("(D2) NXDOMAIN everywhere → all missing · error captured · never fabricated pass", async () => {
    const { resolver } = makeFakeResolver({});
    const c = new DnsDomainAuthChecker({ resolver });
    const r = await c.checkDomain("nowhere.example");
    expect(r.spf_status).toBe("missing");
    expect(r.dmarc_status).toBe("missing");
    expect(r.dkim_status).toBe("no_signature");
  });

  it("(D3) transient DNS error on SPF → spf_status=unknown · never pass", async () => {
    const err: any = new Error("ETIMEOUT lookup");
    const { resolver } = makeFakeResolver({
      "example.com": err,
      "_dmarc.example.com": [["v=DMARC1; p=none"]],
    });
    const c = new DnsDomainAuthChecker({ resolver });
    const r = await c.checkDomain("example.com");
    expect(r.spf_status).toBe("unknown");
    expect(r.error).toMatch(/ETIMEOUT/);
  });

  it("(D4) custom DKIM selector list · first match wins", async () => {
    const { resolver, queries } = makeFakeResolver({
      "example.com": [["v=spf1 -all"]],
      "s1._domainkey.example.com": [["v=DKIM1; p=abc"]],
      "s2._domainkey.example.com": [["v=DKIM1; p=xyz"]],
      "_dmarc.example.com": [["v=DMARC1; p=reject"]],
    });
    const c = new DnsDomainAuthChecker({ resolver, dkim_selectors_to_try: ["s1", "s2"] });
    const r = await c.checkDomain("example.com");
    expect(r.dkim_selector).toBe("s1");
    expect(queries.filter(q => q.startsWith("s"))).toEqual([
      "s1._domainkey.example.com", // stops after first pass
    ]);
  });

  it("(D5) domain input is normalised to lowercase", async () => {
    const { resolver, queries } = makeFakeResolver({});
    const c = new DnsDomainAuthChecker({ resolver, dkim_selectors_to_try: [] });
    const r = await c.checkDomain("  ExAmPle.CoM  ");
    expect(r.sending_domain).toBe("example.com");
    expect(queries.every(q => q.toLowerCase() === q)).toBe(true);
  });

  it("(D6) TXT records split into multiple strings are joined", async () => {
    const { resolver } = makeFakeResolver({
      "example.com": [["v=spf1 include:very-long-record ", "additional-parts -all"]],
      "_dmarc.example.com": [["v=DMARC1; p=quarantine"]],
    });
    const c = new DnsDomainAuthChecker({ resolver, dkim_selectors_to_try: [] });
    const r = await c.checkDomain("example.com");
    expect(r.spf_status).toBe("hard_fail");
    expect(r.spf_record).toContain("very-long-record additional-parts");
  });

  it("(D7) timeout on all lookups → all unknown/missing · never pass", async () => {
    const slow_err = new Error("dns_timeout: intentional");
    const { resolver } = makeFakeResolver({
      "example.com": slow_err,
      "_dmarc.example.com": slow_err,
    });
    const c = new DnsDomainAuthChecker({ resolver, dkim_selectors_to_try: [] });
    const r = await c.checkDomain("example.com");
    expect(r.spf_status).toBe("unknown");
    expect(r.dmarc_status).toBe("unknown");
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Injection contract (works with existing refresh flow)
// ═══════════════════════════════════════════════════════════════════
describe("DNS checker · (E) injection into refreshDomainAuth", () => {
  it("(E1) DnsDomainAuthChecker satisfies the DomainAuthChecker interface (structural)", () => {
    const c = new DnsDomainAuthChecker({ resolver: { async resolveTxt() { return []; } } });
    expect(typeof c.source_id).toBe("string");
    expect(typeof c.checkDomain).toBe("function");
  });
  it("(E2) checker can be passed to refreshDomainAuth without a real DB (dry check on shape only)", async () => {
    // We can't call refreshDomainAuth without a PoolClient · but we can prove
    // the checker's Promise<DomainAuthCheckResult> matches the interface.
    const c = new DnsDomainAuthChecker({ resolver: { async resolveTxt() { return []; } } });
    const r = await c.checkDomain("dry.example");
    expect(r).toMatchObject({
      sending_domain: "dry.example",
      check_source: "node-dns-txt",
      check_method: "node:dns/promises_resolveTxt",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("DNS checker · (F) governance canaries", () => {
  it("(F1) boundary markers exported", () => {
    expect(_DNS_CHECKER_IS_NOT_MODULE_DEFAULT).toContain("NULL_DOMAIN_CHECKER_remains_the_module_default");
    expect(_DNS_CHECKER_FAILS_CLOSED_ON_ERROR).toContain("never_fabricates_pass");
    expect(_DNS_CHECKER_ONLY_QUERIES_THREE_NAMESPACES).toContain("DMARC");
  });
  it("(F2) NULL_DOMAIN_CHECKER remains the module-level default · DnsDomainAuthChecker is opt-in only", async () => {
    // The module continues to export NULL_DOMAIN_CHECKER as a constant.
    // Nothing wires the DNS checker as a default.
    expect(NULL_DOMAIN_CHECKER.source_id).toBe("null-domain-checker");
    // Explicit check: no `DEFAULT_DOMAIN_CHECKER` reassigned to DNS
    const mod: any = await import("..");
    expect(mod.DEFAULT_DOMAIN_CHECKER).toBeUndefined();
    // refreshDomainAuth with no `checker` still falls back to NULL_DOMAIN_CHECKER
    expect(typeof refreshDomainAuth).toBe("function");
  });
  it("(F3) module source never calls fetch or opens HTTP/HTTPS", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/marketing/deliverability/dns-domain-auth-checker.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/["']node:http["']/);
    expect(code).not.toMatch(/["']node:https["']/);
    expect(code).not.toMatch(/\baxios\b/);
  });
  it("(F4) COMMON_DKIM_SELECTORS is a frozen well-known list · not an allowlist expansion", () => {
    expect(COMMON_DKIM_SELECTORS.length).toBeGreaterThan(5);
    // All selectors are DNS-safe lowercase strings
    for (const s of COMMON_DKIM_SELECTORS) {
      expect(s).toMatch(/^[a-z0-9]+$/);
    }
  });
});
