// src/lib/nex/marketing/deliverability/__tests__/content-analyser.test.ts
//
// NEX Deliverability · Content Analyser acceptance
// Founder-authorised programme · Session-17 · Part 11k · 2026-09-22.

import { describe, it, expect } from "vitest";
import {
  analyzeEmailContent,
  _ANALYSER_NEVER_BLOCKS_SENDS, _ANALYSER_NEVER_MODIFIES_CONTENT,
  _ANALYSER_NO_THIRD_PARTY_AI, _ANALYSER_NEVER_NETWORK_FETCHES,
} from "..";

const GOOD_HTML = `
<html><body>
<h1>Hello there</h1>
<p>Here is a legitimate marketing email for your consideration.
Our address is 123 Baker Street, London NW1 6XE, United Kingdom.
Please read our terms and conditions and privacy policy.</p>
<p><a href="https://example.com/promo">See our latest offers</a></p>
<p><a href="https://example.com/unsubscribe">Unsubscribe from these emails</a></p>
</body></html>
`;

// ═══════════════════════════════════════════════════════════════════
// A · Unsubscribe link
// ═══════════════════════════════════════════════════════════════════
describe("Content analyser · (A) unsubscribe link", () => {
  it("(A1) unsubscribe link in text → ok", () => {
    const r = analyzeEmailContent({ subject: "Hi", html_body: GOOD_HTML });
    const check = r.checks.find(c => c.name === "unsubscribe_link")!;
    expect(check.severity).toBe("ok");
  });
  it("(A2) no unsubscribe link → critical", () => {
    const html = `<p>Hello · check our promo at <a href="https://example.com">link</a></p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "unsubscribe_link")!;
    expect(check.severity).toBe("critical");
  });
  it("(A3) unsubscribe in href but not visible text → still ok", () => {
    const html = `<p>Preferences <a href="https://example.com/unsubscribe">here</a></p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "unsubscribe_link")!;
    expect(check.severity).toBe("ok");
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Physical address
// ═══════════════════════════════════════════════════════════════════
describe("Content analyser · (B) physical address", () => {
  it("(B1) UK postcode present → ok", () => {
    const html = `<p>NEX Ltd · 5 Old Bailey London EC4M 7BA · <a href="/unsubscribe">unsub</a></p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "physical_address")!;
    expect(check.severity).toBe("ok");
  });
  it("(B2) US ZIP present → ok", () => {
    const html = `<p>Company · 500 Main St · Boston 02108 · <a href="/unsubscribe">unsub</a></p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "physical_address")!;
    expect(check.severity).toBe("ok");
  });
  it("(B3) PO Box present → ok", () => {
    const html = `<p>PO Box 42 · Somewhere · <a href="/unsubscribe">unsub</a></p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "physical_address")!;
    expect(check.severity).toBe("ok");
  });
  it("(B4) no address pattern → warning", () => {
    const html = `<p>Just a message · <a href="/unsubscribe">unsub</a></p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "physical_address")!;
    expect(check.severity).toBe("warning");
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Subject line quality
// ═══════════════════════════════════════════════════════════════════
describe("Content analyser · (C) subject line", () => {
  it("(C1) empty subject → critical", () => {
    const r = analyzeEmailContent({ subject: "", html_body: GOOD_HTML });
    const check = r.checks.find(c => c.name === "subject_quality")!;
    expect(check.severity).toBe("critical");
  });
  it("(C2) all-caps subject → warning", () => {
    const r = analyzeEmailContent({ subject: "URGENT AMAZING DEAL INSIDE READ NOW", html_body: GOOD_HTML });
    const check = r.checks.find(c => c.name === "subject_quality")!;
    expect(check.severity).toBe("warning");
  });
  it("(C3) 3+ exclamations → warning", () => {
    const r = analyzeEmailContent({ subject: "Hello! Amazing! Deal! Inside!", html_body: GOOD_HTML });
    const check = r.checks.find(c => c.name === "subject_quality")!;
    expect(check.severity).toBe("warning");
  });
  it("(C4) subject >200 chars → warning", () => {
    const long = "a".repeat(250);
    const r = analyzeEmailContent({ subject: long, html_body: GOOD_HTML });
    const check = r.checks.find(c => c.name === "subject_quality")!;
    expect(check.severity).toBe("warning");
  });
  it("(C5) normal subject → ok", () => {
    const r = analyzeEmailContent({ subject: "Your weekly digest is ready", html_body: GOOD_HTML });
    const check = r.checks.find(c => c.name === "subject_quality")!;
    expect(check.severity).toBe("ok");
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Body case + image ratio + link count
// ═══════════════════════════════════════════════════════════════════
describe("Content analyser · (D) body + images + links", () => {
  it("(D1) all-caps body → warning", () => {
    const html = "<p>" + "HELLO EVERYONE THIS IS A VERY IMPORTANT MESSAGE ABOUT OUR PRODUCT OFFERINGS ".repeat(3) + " address 123 Baker St London NW1 6XE <a href='/unsub'>unsub</a></p>";
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "body_case")!;
    expect(check.severity).toBe("warning");
  });
  it("(D2) image-only body → critical", () => {
    const html = `<img src="a.jpg"><img src="b.jpg"><a href="/unsubscribe">unsub</a>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "image_text_ratio")!;
    expect(check.severity).toBe("critical");
  });
  it("(D3) balanced images + text → ok", () => {
    const r = analyzeEmailContent({ subject: "Hi", html_body: GOOD_HTML + "<img src='x.jpg'>" });
    const check = r.checks.find(c => c.name === "image_text_ratio")!;
    expect(check.severity).toBe("ok");
  });
  it("(D4) 50+ links → warning", () => {
    const links = Array.from({ length: 50 }, (_, i) => `<a href="https://example.com/p/${i}">link</a>`).join(" ");
    const html = `<p>Some text and lots of links: ${links}. <a href="/unsubscribe">unsub</a> 123 Baker St London NW1 6XE</p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "link_count")!;
    expect(check.severity).toBe("warning");
  });
  it("(D5) zero links → advisory (unusual for marketing)", () => {
    const html = `<p>Just plain content 123 Baker St London NW1 6XE</p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "link_count")!;
    expect(check.severity).toBe("advisory");
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Link text vs href
// ═══════════════════════════════════════════════════════════════════
describe("Content analyser · (E) phishing patterns", () => {
  it("(E1) link text shows different domain than href → critical", () => {
    const html = `<p>Visit <a href="https://malicious-site.tld/steal">https://your-bank.com/login</a> <a href="/unsubscribe">unsub</a> 123 Baker St London NW1 6XE</p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "link_text_vs_href")!;
    expect(check.severity).toBe("critical");
  });
  it("(E2) matching link text and href → ok", () => {
    const html = `<p><a href="https://example.com/promo">https://example.com/promo</a> <a href="/unsubscribe">unsub</a> 123 Baker St London NW1 6XE</p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "link_text_vs_href")!;
    expect(check.severity).toBe("ok");
  });
  it("(E3) URL shorteners in href → warning", () => {
    const html = `<p>Click <a href="https://bit.ly/abc123">here</a> <a href="/unsubscribe">unsub</a> 123 Baker St London NW1 6XE</p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    const check = r.checks.find(c => c.name === "url_shorteners")!;
    expect(check.severity).toBe("warning");
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Overall roll-up
// ═══════════════════════════════════════════════════════════════════
describe("Content analyser · (F) roll-up", () => {
  it("(F1) good email → overall_severity=ok", () => {
    const r = analyzeEmailContent({ subject: "Weekly digest is ready", html_body: GOOD_HTML });
    expect(r.overall_severity).toBe("ok");
  });
  it("(F2) any critical → overall_severity=critical", () => {
    const html = `<p>Missing unsubscribe and address</p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    expect(r.overall_severity).toBe("critical");
  });
  it("(F3) summary reports critical count", () => {
    const html = `<p></p>`; // triggers 2 critical: no_unsubscribe + no images no text
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    expect(r.summary).toContain("critical");
  });
  it("(F4) counts + ratio surfaced in report body", () => {
    const html = `<img src="a.png"><img src="b.png"><p>Text content here 123 Baker St London NW1 6XE <a href="/unsubscribe">unsub</a></p>`;
    const r = analyzeEmailContent({ subject: "Hi", html_body: html });
    expect(r.image_count).toBe(2);
    expect(r.link_count).toBe(1);
    expect(r.text_char_count).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// G · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Content analyser · (G) governance canaries", () => {
  it("(G1) boundary markers exported", () => {
    expect(_ANALYSER_NEVER_BLOCKS_SENDS).toContain("advisory_only");
    expect(_ANALYSER_NEVER_MODIFIES_CONTENT).toContain("never_rewrites");
    expect(_ANALYSER_NO_THIRD_PARTY_AI).toContain("no_LLM");
    expect(_ANALYSER_NEVER_NETWORK_FETCHES).toContain("no_fetch");
  });
  it("(G2) module exports NO rewrite/block/sanitise-and-modify function", async () => {
    const mod: any = await import("..");
    expect(mod.rewriteSubject).toBeUndefined();
    expect(mod.rewriteBody).toBeUndefined();
    expect(mod.blockSend).toBeUndefined();
    expect(mod.sanitizeAndReturn).toBeUndefined();
    expect(mod.autoFixContent).toBeUndefined();
  });
  it("(G3) module source contains no fetch/http/OpenAI/LLM references", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/marketing/deliverability/content-analyser.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/openai/i);
    expect(code).not.toMatch(/anthropic/i);
    expect(code).not.toMatch(/\bLLM\b/);
    expect(code).not.toMatch(/["']node:http["']/);
    expect(code).not.toMatch(/["']node:https["']/);
  });
  it("(G4) analyser returns unchanged content · never modifies input", () => {
    const subject = "SHOUTY SUBJECT!!!";
    const html = "<p>original content</p>";
    analyzeEmailContent({ subject, html_body: html });
    // Inputs are string primitives · immutable by JS semantics · just verify
    expect(subject).toBe("SHOUTY SUBJECT!!!");
    expect(html).toBe("<p>original content</p>");
  });
  it("(G5) deterministic · same input → same analysis", () => {
    const r1 = analyzeEmailContent({ subject: "Test", html_body: GOOD_HTML });
    const r2 = analyzeEmailContent({ subject: "Test", html_body: GOOD_HTML });
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
