// src/lib/nex-native/__tests__/claim-templates.test.ts
//
// Pure tests for the claim outreach templates. No I/O.

import { describe, expect, test } from "vitest";
import {
  renderClaim,
  renderEmailClaim,
  renderPhoneCallScript,
  renderSmsClaim,
  renderWhatsAppClaim,
  type ClaimTemplateInputs,
} from "../claims/claim-templates";

const INPUTS: ClaimTemplateInputs = {
  business_name: "Ronde Mak Pari",
  claim_code: "123456",
  claim_url: "https://nex.app/claim/abc-123",
  public_listing_ref: "FL-2026-RMP01",
  expires_minutes: 10,
  city: "Yogyakarta",
};

describe("renderWhatsAppClaim", () => {
  test("id includes business name, code, url, ref, and city", () => {
    const t = renderWhatsAppClaim(INPUTS, "id");
    expect(t.channel).toBe("whatsapp");
    expect(t.subject).toBeNull();
    expect(t.body_text).toContain("Ronde Mak Pari");
    expect(t.body_text).toContain("*123456*");
    expect(t.body_text).toContain("https://nex.app/claim/abc-123");
    expect(t.body_text).toContain("FL-2026-RMP01");
    expect(t.body_text).toContain("Yogyakarta");
    expect(t.body_text).toContain("10 menit");
    expect(t.body_text).toMatch(/STOP/);
    expect(t.body_html).toBeNull();
  });

  test("en version uses English copy", () => {
    const t = renderWhatsAppClaim(INPUTS, "en");
    expect(t.body_text).toContain("Hi Ronde Mak Pari");
    expect(t.body_text).toContain("in Yogyakarta");
    expect(t.body_text).toContain("Reference: FL-2026-RMP01");
    expect(t.body_text).toMatch(/STOP/);
  });

  test("omits city gracefully when null", () => {
    const t = renderWhatsAppClaim({ ...INPUTS, city: null }, "id");
    expect(t.body_text).not.toContain("di Yogyakarta");
    expect(t.body_text).toContain("Ronde Mak Pari");
  });
});

describe("renderEmailClaim", () => {
  test("has subject, text + html, English", () => {
    const t = renderEmailClaim(INPUTS, "en");
    expect(t.subject).toContain("Claim");
    expect(t.subject).toContain("FL-2026-RMP01");
    expect(t.body_text).toContain("    123456");
    expect(t.body_text).toContain("Claim your business");
    expect(t.body_html).toContain("<!doctype html>");
    expect(t.body_html).toContain("123456");
    expect(t.body_html).toContain("letter-spacing:4px");
  });

  test("Indonesian version uses ID copy", () => {
    const t = renderEmailClaim(INPUTS, "id");
    expect(t.subject).toContain("Klaim bisnis Anda");
    expect(t.body_text).toContain("direktori bisnis Indonesia");
    expect(t.body_text).toContain("    123456");
  });

  test("escapes HTML in business name", () => {
    const malicious = { ...INPUTS, business_name: "<script>alert(1)</script>" };
    const t = renderEmailClaim(malicious, "en");
    expect(t.body_html).not.toContain("<script>");
    expect(t.body_html).toContain("&lt;script&gt;");
  });
});

describe("renderSmsClaim", () => {
  test("fits reasonable SMS length (both languages under 320 chars)", () => {
    const en = renderSmsClaim(INPUTS, "en");
    const id = renderSmsClaim(INPUTS, "id");
    expect(en.body_text.length).toBeLessThanOrEqual(320);
    expect(id.body_text.length).toBeLessThanOrEqual(320);
    expect(en.body_text).toContain("123456");
    expect(id.body_text).toContain("123456");
  });

  test("subject/html are null", () => {
    const t = renderSmsClaim(INPUTS, "en");
    expect(t.subject).toBeNull();
    expect(t.body_html).toBeNull();
  });
});

describe("renderPhoneCallScript", () => {
  test("has call bracket markers for human reader", () => {
    const t = renderPhoneCallScript(INPUTS, "en");
    expect(t.body_text).toMatch(/\[Call to .+\]/);
    expect(t.body_text).toMatch(/\[If yes:/);
    expect(t.body_text).toMatch(/\[If no:/);
    expect(t.body_text).toContain("Verification code: 123456");
  });
});

describe("renderClaim · dispatcher", () => {
  test.each(["whatsapp", "email", "sms", "phone"] as const)(
    "dispatches channel '%s' to the correct renderer",
    (channel) => {
      const t = renderClaim(channel, INPUTS, "en");
      expect(t.channel).toBe(channel);
    },
  );
});
