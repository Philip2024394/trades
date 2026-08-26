// Focused tests for image extraction · Chief Architect 2026-08-27.
//
// Verifies extractFromHtml (via businessWebsiteSource.enrich behavior) picks
// images from own-site HTML in the correct priority order · resolves relative
// URLs · rejects non-http · schema.org only trusts business @type.

import { describe, it, expect, vi } from "vitest";
import { businessWebsiteSource } from "./business-website.mjs";

// Helper · wrap fetch with a hand-controlled HTML response
function mockFetchOnce(body, contentType = "text/html; charset=utf-8", ok = true, status = 200) {
  return vi.fn(async () => ({
    ok, status,
    headers: { get: (k) => (k.toLowerCase() === "content-type" ? contentType : null) },
    text: async () => body,
  }));
}

async function runEnrich(html, url = "https://example-restaurant.com/") {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetchOnce(html);
  try {
    const source = businessWebsiteSource();
    return await source.enrich({ record: { website: url }, config: {}, log: () => {} });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe("business-website · image extraction · priority order", () => {
  it("picks og:image:secure_url over og:image", async () => {
    const html = `
      <html><head>
        <meta property="og:image" content="http://example.com/plain.jpg">
        <meta property="og:image:secure_url" content="https://example.com/secure.jpg">
      </head></html>`;
    const gain = await runEnrich(html);
    expect(gain.image_url).toBe("https://example.com/secure.jpg");
    expect(gain.image_source_method).toBe("og:image:secure_url");
  });

  it("picks og:image when no secure_url present", async () => {
    const html = `<html><head><meta property="og:image" content="https://example.com/hero.png"></head></html>`;
    const gain = await runEnrich(html);
    expect(gain.image_url).toBe("https://example.com/hero.png");
    expect(gain.image_source_method).toBe("og:image");
  });

  it("handles reversed attribute order (content-first, property-second)", async () => {
    const html = `<html><head><meta content="https://example.com/reversed.jpg" property="og:image"></head></html>`;
    const gain = await runEnrich(html);
    expect(gain.image_url).toBe("https://example.com/reversed.jpg");
  });

  it("picks schema.org JSON-LD image when og:image absent · LocalBusiness type", async () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"Restaurant","image":"https://example.com/schema.jpg","name":"Test"}
        </script>
      </head></html>`;
    const gain = await runEnrich(html);
    expect(gain.image_url).toBe("https://example.com/schema.jpg");
    expect(gain.image_source_method).toBe("schema.org/JSON-LD");
  });

  it("schema.org image can be an object with url field", async () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type":"Hotel","image":{"@type":"ImageObject","url":"https://example.com/objimg.jpg"}}
        </script>
      </head></html>`;
    const gain = await runEnrich(html);
    expect(gain.image_url).toBe("https://example.com/objimg.jpg");
  });

  it("schema.org image can be an array · takes first valid", async () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type":"Restaurant","image":["https://example.com/first.jpg","https://example.com/second.jpg"]}
        </script>
      </head></html>`;
    const gain = await runEnrich(html);
    expect(gain.image_url).toBe("https://example.com/first.jpg");
  });

  it("schema.org · does NOT trust image from Person or Article @type", async () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type":"Article","image":"https://example.com/article-photo.jpg","headline":"News"}
        </script>
      </head></html>`;
    const gain = await runEnrich(html);
    expect(gain?.image_url).toBeUndefined();
  });

  it("falls back to apple-touch-icon when no og:image / schema.org", async () => {
    const html = `<html><head><link rel="apple-touch-icon" href="https://example.com/icon.png"></head></html>`;
    const gain = await runEnrich(html);
    expect(gain.image_url).toBe("https://example.com/icon.png");
    expect(gain.image_source_method).toBe("apple-touch-icon");
  });

  it("does not pick apple-touch-icon when og:image is present (og wins)", async () => {
    const html = `
      <html><head>
        <link rel="apple-touch-icon" href="https://example.com/icon.png">
        <meta property="og:image" content="https://example.com/hero.jpg">
      </head></html>`;
    const gain = await runEnrich(html);
    expect(gain.image_url).toBe("https://example.com/hero.jpg");
    expect(gain.image_source_method).toBe("og:image");
  });

  it("returns no image_url when nothing found", async () => {
    const html = `<html><head><title>No images here</title></head></html>`;
    const gain = await runEnrich(html);
    expect(gain?.image_url).toBeUndefined();
  });
});

describe("business-website · image extraction · URL resolution + safety", () => {
  it("resolves relative //cdn.example.com/img.jpg into full URL", async () => {
    const html = `<html><head><meta property="og:image" content="//cdn.example.com/hero.jpg"></head></html>`;
    const gain = await runEnrich(html, "https://example-restaurant.com/");
    expect(gain.image_url).toBe("https://cdn.example.com/hero.jpg");
  });

  it("resolves relative /img/hero.jpg against the page baseUrl", async () => {
    const html = `<html><head><meta property="og:image" content="/img/hero.jpg"></head></html>`;
    const gain = await runEnrich(html, "https://example-restaurant.com/menu");
    expect(gain.image_url).toBe("https://example-restaurant.com/img/hero.jpg");
  });

  it("rejects data: URLs (image_url stays undefined)", async () => {
    const html = `<html><head><meta property="og:image" content="data:image/png;base64,AAAA"></head></html>`;
    const gain = await runEnrich(html);
    expect(gain?.image_url).toBeUndefined();
  });

  it("rejects javascript: URLs", async () => {
    const html = `<html><head><meta property="og:image" content="javascript:alert(1)"></head></html>`;
    const gain = await runEnrich(html);
    expect(gain?.image_url).toBeUndefined();
  });

  it("rejects empty content", async () => {
    const html = `<html><head><meta property="og:image" content=""></head></html>`;
    const gain = await runEnrich(html);
    expect(gain?.image_url).toBeUndefined();
  });

  it("still returns whatsapp/phone/socials alongside the image", async () => {
    const html = `
      <html><head>
        <meta property="og:image" content="https://example.com/hero.jpg">
      </head><body>
        <a href="https://wa.me/6281234567890">WhatsApp</a>
        <a href="https://instagram.com/testrestaurant">Instagram</a>
      </body></html>`;
    const gain = await runEnrich(html);
    expect(gain.image_url).toBe("https://example.com/hero.jpg");
    expect(gain.image_source_method).toBe("og:image");
    expect(gain.whatsapp).toBe("+6281234567890");
    expect(gain.instagram).toBe("testrestaurant");
  });
});

describe("business-website · image extraction · never scrapes third-party sources (ADR-0022)", () => {
  it("does not extract images from GBP/Facebook/Instagram URLs passed as og:image (still allowed since it's what the OWN site declares · but source stays as own-site)", async () => {
    // If the business's own site declares an og:image hosted on a CDN,
    // that's fine. The doctrine forbids fetching from GBP/FB/IG directly.
    // We only fetch the OWN website URL.
    const html = `<html><head><meta property="og:image" content="https://scontent.cdninstagram.com/img.jpg"></head></html>`;
    const gain = await runEnrich(html);
    // We DO accept the URL (it's what the business's own site published) ·
    // downstream approval gate can flag if operator wants stricter policy.
    // The point of ADR-0022 is NEX doesn't scrape IG/FB directly · it doesn't
    // forbid the business's own site linking to IG-hosted media.
    expect(gain.image_url).toBe("https://scontent.cdninstagram.com/img.jpg");
    expect(gain.image_source_method).toBe("og:image");
  });
});
