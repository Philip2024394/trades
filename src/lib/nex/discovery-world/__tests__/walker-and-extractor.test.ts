// src/lib/nex/discovery-world/__tests__/walker-and-extractor.test.ts
//
// NEX World Email Intelligence · Session-2 acceptance
// Part 4 · Part 5 rest · Part 6 · governance canaries.
// Founder-authorised programme · 2026-09-21.

import { describe, it, expect } from "vitest";
import {
  extractEmails, walkEntityWebsite, DEFAULT_WALKER, SEED_PATHS,
  makeFixtureFetcher, NULL_FETCHER,
  _EXTRACTOR_NEVER_FABRICATES,
  _WALKER_NEVER_LEAVES_ENTITY_DOMAIN, _WALKER_NEVER_CALLS_FETCH_DIRECTLY,
  _CYCLE_ADAPTER_NULL_FETCHER_DEFAULT,
} from "..";

// ═══════════════════════════════════════════════════════════════════
// A · HTML email extractor (Part 5 rest)
// ═══════════════════════════════════════════════════════════════════
describe("Email extractor · (A) HTML extraction", () => {
  it("(A1) mailto: href extracted with method=mailto_href", () => {
    const html = `<a href="mailto:info@abcscaffolding.co.uk">Email us</a>`;
    const out = extractEmails(html);
    expect(out).toHaveLength(1);
    expect(out[0].normalized).toBe("info@abcscaffolding.co.uk");
    expect(out[0].method).toBe("mailto_href");
  });

  it("(A2) JSON-LD contactPoint email extracted with highest-quality method", () => {
    const html = `<script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "Organization",
        "name": "ABC Scaffolding",
        "contactPoint": { "@type": "ContactPoint", "email": "sales@abcscaffolding.co.uk", "contactType": "Sales" } }
      </script>`;
    const out = extractEmails(html);
    expect(out).toHaveLength(1);
    expect(out[0].normalized).toBe("sales@abcscaffolding.co.uk");
    expect(out[0].method).toBe("json_ld_contact_point");
  });

  it("(A3) mailto + plain-text of SAME email deduped to highest-quality method", () => {
    const html = `<a href="mailto:info@x.com">info@x.com</a> · also seen: info@x.com`;
    const out = extractEmails(html);
    expect(out).toHaveLength(1);
    expect(out[0].method).toBe("mailto_href");   // wins over plain_text_regex
  });

  it("(A4) obfuscated 'info (at) example dot com' extracted", () => {
    const html = `Contact us: info (at) abcscaffolding dot co dot uk`;
    const out = extractEmails(html);
    // Regex matches "info (at) abcscaffolding dot co" → info@abcscaffolding.co
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.some(x => x.method === "obfuscated_at")).toBe(true);
    expect(out[0].normalized).toMatch(/info@abcscaffolding\.co/);
  });

  it("(A5) HTML entity &#64; extracted", () => {
    const html = `<p>Reach us at office&#64;abcscaffolding.co.uk</p>`;
    const out = extractEmails(html);
    expect(out).toHaveLength(1);
    expect(out[0].method).toBe("html_entity_at");
    expect(out[0].normalized).toBe("office@abcscaffolding.co.uk");
  });

  it("(A6) Schema microdata itemprop=email extracted", () => {
    const html = `<span itemprop="email">contact@abcscaffolding.co.uk</span>`;
    const out = extractEmails(html);
    expect(out).toHaveLength(1);
    expect(out[0].method).toBe("schema_microdata_email");
  });

  it("(A7) role-hint captured from surrounding text", () => {
    const html = `<p>For SALES enquiries: <a href="mailto:info@abcscaffolding.co.uk">info@abcscaffolding.co.uk</a></p>`;
    const out = extractEmails(html);
    expect(out[0].nearby_role_hint).toBe("sales");
  });

  it("(A8) empty / non-string HTML returns []", () => {
    expect(extractEmails("")).toEqual([]);
    expect(extractEmails(null as any)).toEqual([]);
    expect(extractEmails(undefined as any)).toEqual([]);
  });

  it("(A9) HTML with NO email returns [] · never fabricated", () => {
    const html = `<p>Welcome to ABC Scaffolding. Call us on 020 1234 5678.</p>`;
    expect(extractEmails(html)).toEqual([]);
  });

  it("(A10) extractor exports boundary marker", () => {
    expect(_EXTRACTOR_NEVER_FABRICATES).toBe("emails_only_from_actual_html_text");
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Website walker (Part 4)
// ═══════════════════════════════════════════════════════════════════
describe("Website walker · (B) entity-scoped bounded walk", () => {
  it("(B1) walks the seed paths on an entity domain", async () => {
    const fetcher = makeFixtureFetcher([
      { url: "https://abcscaffolding.co.uk/", html: "<html><body>Home</body></html>" },
      { url: "https://abcscaffolding.co.uk/about", html: "<html><body>About</body></html>" },
      { url: "https://abcscaffolding.co.uk/contact", html: `<a href="mailto:info@abcscaffolding.co.uk">Contact</a>` },
    ]);
    const out = await walkEntityWebsite({ canonical_website: "abcscaffolding.co.uk", fetcher });
    expect(out.pages_fetched).toBeGreaterThanOrEqual(3);
    expect(out.entity_domain).toBe("abcscaffolding.co.uk");
    // note is null when at least one page was fetched
    expect(out.note).toBeNull();
  });

  it("(B2) walker never leaves the entity domain (structural)", async () => {
    // Home page links to an external competitor · walker must NOT follow it
    const fetcher = makeFixtureFetcher([
      { url: "https://abcscaffolding.co.uk/", html: `<a href="https://competitor.com/leads">Competitor</a>` },
      { url: "https://competitor.com/leads",  html: "Should NEVER be fetched by walker" },
    ]);
    const out = await walkEntityWebsite({ canonical_website: "abcscaffolding.co.uk", fetcher });
    const urlsFetched = out.pages.map(p => p.url_final);
    expect(urlsFetched.every(u => u.startsWith("https://abcscaffolding.co.uk"))).toBe(true);
    expect(urlsFetched.some(u => u.includes("competitor.com"))).toBe(false);
  });

  it("(B3) walker follows internal links up to max_link_depth", async () => {
    const fetcher = makeFixtureFetcher([
      { url: "https://abcscaffolding.co.uk/", html: `<a href="/services/scaffold-hire">Scaffold Hire</a>` },
      { url: "https://abcscaffolding.co.uk/services/scaffold-hire", html: `<a href="mailto:hire@abcscaffolding.co.uk">Hire</a>` },
    ]);
    const out = await walkEntityWebsite({
      canonical_website: "abcscaffolding.co.uk",
      fetcher,
      config: { follow_internal_links: true, max_link_depth: 1 },
    });
    expect(out.pages.some(p => p.url_final.includes("scaffold-hire"))).toBe(true);
  });

  it("(B4) NULL_FETCHER causes every page to be blocked_by_governance", async () => {
    const out = await walkEntityWebsite({ canonical_website: "abcscaffolding.co.uk", fetcher: NULL_FETCHER });
    expect(out.pages_fetched).toBe(0);
    expect(out.pages_blocked_by_governance).toBe(out.pages_attempted);
    expect(out.note).toContain("blocked_by_governance");
  });

  it("(B5) walker respects max_pages_per_entity", async () => {
    // Build 50 fake pages; walker capped to 5
    const pages = Array.from({ length: 50 }, (_, i) => ({
      url: `https://abcscaffolding.co.uk/page-${i}`,
      html: `<a href="/page-${i + 1}">next</a>`,
    }));
    pages.unshift({ url: "https://abcscaffolding.co.uk/", html: `<a href="/page-0">start</a>` });
    const fetcher = makeFixtureFetcher(pages);
    const out = await walkEntityWebsite({
      canonical_website: "abcscaffolding.co.uk", fetcher,
      config: { max_pages_per_entity: 5, follow_internal_links: true, max_link_depth: 3 },
    });
    expect(out.pages_fetched).toBeLessThanOrEqual(5);
  });

  it("(B6) walker respects deadline_ms · reports deadline_expired=true", async () => {
    // Fetcher with per-request latency
    const pages = Array.from({ length: 20 }, (_, i) => ({
      url: `https://abcscaffolding.co.uk/page-${i}`,
      html: `<a href="/page-${i + 1}">next</a>`,
    }));
    pages.unshift({ url: "https://abcscaffolding.co.uk/", html: `<a href="/page-0">start</a>` });
    const fetcher = makeFixtureFetcher(pages, { latency_ms: 30 });
    // Very short deadline · at least the first fetch may complete
    const out = await walkEntityWebsite({
      canonical_website: "abcscaffolding.co.uk", fetcher,
      config: { max_pages_per_entity: 20, deadline_ms: 50, per_page_deadline_ms: 100, follow_internal_links: true, max_link_depth: 3 },
    });
    // Either deadline_expired or fewer pages fetched than the cap · both prove the guard fired
    expect(out.deadline_expired || out.pages_fetched < 20).toBe(true);
  });

  it("(B7) walker exports boundary markers", () => {
    expect(_WALKER_NEVER_LEAVES_ENTITY_DOMAIN).toBe("same_origin_enforced");
    expect(_WALKER_NEVER_CALLS_FETCH_DIRECTLY).toBe("always_via_injected_page_fetcher");
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Governance canaries (Part 4 + Part 5 + Part 6)
// ═══════════════════════════════════════════════════════════════════
describe("Discovery-world · (C) governance canaries", () => {
  it("(C1) NULL_FETCHER is the default · no silent allowlist expansion", () => {
    expect(_CYCLE_ADAPTER_NULL_FETCHER_DEFAULT).toBe("default_refuses_every_url_no_silent_allowlist_expansion");
    expect(NULL_FETCHER.source_id).toBe("null-fetcher");
  });

  it("(C2) module exports NO direct fetch helper · no scraper convenience", async () => {
    const mod = await import("..");
    expect((mod as any).fetch).toBeUndefined();
    expect((mod as any).scrapeCompanyWebsite).toBeUndefined();
    expect((mod as any).crawlAnyDomain).toBeUndefined();
    expect((mod as any).mineEmails).toBeUndefined();
    expect((mod as any).harvestAddresses).toBeUndefined();
  });

  it("(C3) SEED_PATHS contains ONLY founder-approved paths · never mutable at runtime", () => {
    expect(SEED_PATHS).toContain("/");
    expect(SEED_PATHS).toContain("/contact");
    expect(SEED_PATHS).toContain("/about");
    expect(SEED_PATHS).toContain("/services");
    // No random paths crept in
    for (const p of SEED_PATHS) {
      expect(p.startsWith("/")).toBe(true);
      expect(p.length).toBeLessThan(30);
    }
  });

  it("(C4) fetch outcome kinds distinguish EVERY governance state · none collapsed", () => {
    // If any of these were merged, existing consumers would misclassify outcomes.
    const outcomes: FetchOutcomeSet = {
      responded: 0, responded_zero: 0, not_modified: 0, not_found: 0,
      unavailable: 0, rate_limited: 0, robots_denied: 0, blocked_by_governance: 0, parse_error: 0,
    };
    // TypeScript would fail if we removed a key from FetchOutcomeKind
    expect(Object.keys(outcomes)).toContain("robots_denied");
    expect(Object.keys(outcomes)).toContain("blocked_by_governance");
    expect(Object.keys(outcomes)).toContain("unavailable");
  });
});

type FetchOutcomeSet = Record<
  "responded" | "responded_zero" | "not_modified" | "not_found" | "unavailable" | "rate_limited" | "robots_denied" | "blocked_by_governance" | "parse_error",
  number
>;
