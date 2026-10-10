// src/lib/nex/marketing/__tests__/tracking-inject.test.ts
//
// NEX Marketing · Stage 1.3 acceptance
// Pure string-transformation tests · no DB · no network.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { injectTracking } from "../tracking-inject";

const CAMPAIGN = "camp-abc-123";
const CONTACT = "contact-xyz-456";

describe("Wave Email Marketing · Stage 1.3 · tracking injection", () => {
  const original_secret = process.env.NEX_MARKETING_UNSUB_SECRET;
  const original_base = process.env.NEX_MARKETING_BASE_URL;

  beforeEach(() => {
    process.env.NEX_MARKETING_UNSUB_SECRET = "test-secret-that-is-long-enough-for-hmac";
    process.env.NEX_MARKETING_BASE_URL = "https://test.nex.local";
  });

  afterEach(() => {
    process.env.NEX_MARKETING_UNSUB_SECRET = original_secret;
    process.env.NEX_MARKETING_BASE_URL = original_base;
  });

  it("(1) injects an observed-open pixel BEFORE </body>", () => {
    const html = `<html><body><p>Hello</p></body></html>`;
    const out = injectTracking({ html, campaign_id: CAMPAIGN, contact_id: CONTACT });
    expect(out.html).toContain(`<img src="https://test.nex.local/api/nex/marketing/pixel/${encodeURIComponent(CAMPAIGN)}?c=${encodeURIComponent(CONTACT)}"`);
    expect(out.html).toContain("width=\"1\" height=\"1\"");
    expect(out.html).toContain("aria-hidden=\"true\"");
    // Pixel must appear BEFORE </body>
    const pixel_idx = out.html.indexOf("<img");
    const body_close_idx = out.html.indexOf("</body>");
    expect(pixel_idx).toBeGreaterThan(0);
    expect(pixel_idx).toBeLessThan(body_close_idx);
  });

  it("(2) rewrites every http/https anchor href through the click tracker", () => {
    const html = `<a href="https://example.com/product">Buy</a> and <a href="http://another.com/x">Read</a>`;
    const out = injectTracking({ html, campaign_id: CAMPAIGN, contact_id: CONTACT });
    expect(out.links_rewritten).toBe(2);
    expect(out.html).toContain(`https://test.nex.local/api/nex/marketing/click/${encodeURIComponent(CAMPAIGN)}`);
    expect(out.html).not.toContain(`href="https://example.com/product"`);
    // The `t=` param carries the original URL · HTML-escaped inside the href attribute
    // (browsers require `&` → `&amp;` inside attribute values · this is correct behaviour)
    expect(out.html).toContain(`t=${encodeURIComponent("https://example.com/product")}`);
    // HMAC signature attached · matches either &s= or &amp;s= (both are valid HTML)
    expect(out.html).toMatch(/(?:&|&amp;)s=[a-f0-9]{24}/);
  });

  it("(3) does NOT rewrite mailto: · tel: · javascript: · fragment · already-tracked links", () => {
    const html = [
      `<a href="mailto:info@example.com">mail</a>`,
      `<a href="tel:+441234567890">phone</a>`,
      `<a href="javascript:alert(1)">bad</a>`,
      `<a href="#top">jump</a>`,
      `<a href="https://test.nex.local/api/nex/marketing/click/x">already tracked</a>`,
      `<a href="https://test.nex.local/api/nex/marketing/unsubscribe">unsub</a>`,
    ].join(" ");
    const out = injectTracking({ html, campaign_id: CAMPAIGN, contact_id: CONTACT });
    expect(out.links_rewritten).toBe(0);
    expect(out.html).toContain(`mailto:info@example.com`);
    expect(out.html).toContain(`tel:+441234567890`);
    expect(out.html).toContain(`javascript:alert(1)`);
    expect(out.html).toContain(`#top`);
    // The one already pointing at the click route stays put
    expect(out.html).toContain(`/api/nex/marketing/click/x`);
  });

  it("(4) produces a valid List-Unsubscribe header (RFC 8058 · one-click)", () => {
    const html = `<body>x</body>`;
    const out = injectTracking({ html, campaign_id: CAMPAIGN, contact_id: CONTACT });
    // Must contain a URL AND a mailto per RFC 8058 recommendations
    expect(out.list_unsubscribe_header).toContain("<https://test.nex.local/api/nex/marketing/unsubscribe");
    expect(out.list_unsubscribe_header).toContain(`c=${encodeURIComponent(CAMPAIGN)}`);
    expect(out.list_unsubscribe_header).toContain(`u=${encodeURIComponent(CONTACT)}`);
    expect(out.list_unsubscribe_header).toMatch(/s=[a-f0-9]{32}/);
    expect(out.list_unsubscribe_header).toContain(", <mailto:unsubscribe@test.nex.local?subject=unsubscribe>");
  });

  it("(5) appends pixel at end of document if no </body> tag exists", () => {
    const html = `<p>Bare snippet with no body wrapper</p>`;
    const out = injectTracking({ html, campaign_id: CAMPAIGN, contact_id: CONTACT });
    expect(out.html).toContain(`<p>Bare snippet with no body wrapper</p>`);
    expect(out.html).toContain("<img");
    // Pixel should come AFTER the paragraph
    expect(out.html.indexOf("<img")).toBeGreaterThan(out.html.indexOf("</p>"));
  });

  it("(6) HMAC signatures are deterministic for the same input · different for different inputs", () => {
    const html = `<a href="https://example.com/a">a</a>`;
    const out1 = injectTracking({ html, campaign_id: CAMPAIGN, contact_id: CONTACT });
    const out2 = injectTracking({ html, campaign_id: CAMPAIGN, contact_id: CONTACT });
    const out3 = injectTracking({ html, campaign_id: CAMPAIGN, contact_id: "different-contact" });
    expect(out1.html).toBe(out2.html);   // same input → same output
    expect(out1.html).not.toBe(out3.html); // different contact → different signature
  });

  it("(7) safely encodes URLs in pixel src attribute · no XSS via campaign_id", () => {
    const html = `<body>x</body>`;
    const out = injectTracking({
      html,
      campaign_id: `cam"><script>alert(1)</script>`,
      contact_id: CONTACT,
    });
    // Dangerous chars must NOT appear raw · either URL-encoded (%3C · %22) or HTML-escaped (&lt; · &quot;) is acceptable
    expect(out.html).not.toContain(`<script>alert(1)</script>`);
    expect(out.html).not.toContain(`cam"><script>`);
    // URL-encoding (via encodeURIComponent on path segment) is the actual defence here
    expect(out.html).toContain("%3Cscript%3E");  // < and > URL-encoded
    expect(out.html).toContain("%22");            // " URL-encoded
  });

  it("(8) preserves the original HTML structure · pixel + rewrites are additive", () => {
    const html = `<html><head><title>x</title></head><body><h1>Hi</h1><p><a href="https://x.com">link</a></p></body></html>`;
    const out = injectTracking({ html, campaign_id: CAMPAIGN, contact_id: CONTACT });
    expect(out.html).toContain("<title>x</title>");
    expect(out.html).toContain("<h1>Hi</h1>");
    expect(out.html).toContain("</body>");
    expect(out.html).toContain("</html>");
  });

  it("(9) with tracking secret ABSENT · sig falls back to 'unsigned' · no throw", () => {
    delete process.env.NEX_MARKETING_UNSUB_SECRET;
    delete process.env.NEX_LAB_PROMOTION_SECRET;
    const html = `<a href="https://x.com">x</a>`;
    const out = injectTracking({ html, campaign_id: CAMPAIGN, contact_id: CONTACT });
    // In HTML attribute · & is escaped to &amp; · both patterns accepted
    expect(out.html).toMatch(/(?:&|&amp;)s=unsigned/);
    expect(out.list_unsubscribe_header).toContain("s=unsigned");
  });

  it("(10) observed-open pixel URL includes optional email parameter when provided", () => {
    const html = `<body>x</body>`;
    const out = injectTracking({
      html,
      campaign_id: CAMPAIGN,
      contact_id: CONTACT,
      email: "user@example.com",
    });
    // Attribute values HTML-escape the & separator
    expect(out.html).toMatch(new RegExp(`(?:&|&amp;)e=${encodeURIComponent("user@example.com").replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`));
  });
});
