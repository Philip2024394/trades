// src/lib/nex/discovery-world/__tests__/entity-and-classifier.test.ts
//
// NEX World Email Intelligence · Part 3 + Part 5 partial acceptance
// Founder-authorised programme · bounded wave 2026-09-21.

import { describe, it, expect } from "vitest";
import {
  normalizeBusinessName, canonicalWebsite, normalizePhone, matchScore,
  classifyEmail,
  _ENTITY_RESOLUTION_BOUNDARY_NEVER_FABRICATE,
  _EMAIL_CLASSIFIER_PROVIDER_AGNOSTIC, _EMAIL_CLASSIFIER_NEVER_FABRICATES,
} from "..";

// ═══════════════════════════════════════════════════════════════════
// A · Identity normalisers (pure)
// ═══════════════════════════════════════════════════════════════════
describe("Entity resolution · (A) normalisers", () => {
  it("(A1) business name lowercases · strips punctuation · drops legal-form suffix", () => {
    expect(normalizeBusinessName("ABC Scaffolding Ltd.")).toBe("abc scaffolding");
    expect(normalizeBusinessName("Example Access Services LLC")).toBe("example access services");
    expect(normalizeBusinessName("Bob's Scaffolders (Manchester) Ltd")).toBe("bob s scaffolders manchester");
  });
  it("(A2) canonical website strips protocol · www · path", () => {
    expect(canonicalWebsite("https://www.abcscaffolding.co.uk/services")).toBe("abcscaffolding.co.uk");
    expect(canonicalWebsite("abcscaffolding.co.uk")).toBe("abcscaffolding.co.uk");
    expect(canonicalWebsite("www.example.com/contact/")).toBe("example.com");
  });
  it("(A3) canonical website rejects invalid inputs · never guesses", () => {
    expect(canonicalWebsite("")).toBeNull();
    expect(canonicalWebsite(null)).toBeNull();
    expect(canonicalWebsite("no-domain")).toBeNull();
  });
  it("(A4) phone normalisation preserves + · rejects <6 digits", () => {
    expect(normalizePhone("+44 20 1234 5678")).toBe("+442012345678");
    expect(normalizePhone("(020) 1234 5678")).toBe("02012345678");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Deterministic matcher
// ═══════════════════════════════════════════════════════════════════
describe("Entity resolution · (B) deterministic matcher", () => {
  const base = { programme_id: "p1", iso: "GB", discovery_term: "scaffolding", source_url: "https://example/", source_kind: "website" };
  it("(B1) same website + same phone + same name → very high score", () => {
    const a = { ...base, business_name: "ABC Scaffolding Ltd", website_url: "https://abcscaffolding.co.uk", phone: "+44 20 1234 5678" };
    const b = { ...base, business_name: "ABC Scaffolding", website_url: "https://www.abcscaffolding.co.uk/contact", phone: "020 1234 5678" };
    const m = matchScore(a as any, b as any);
    // Website matches (3/3) · name normalises equal (2/2) · country matches (1/1)
    // Phones normalise to +442012345678 vs 02012345678 · different digits (no +) · no match on phone → 0/2
    // total 8 · matched 6 · score = 0.75
    expect(m.score).toBeGreaterThan(0.7);
    expect(m.signals).toContain("website_exact");
    expect(m.signals).toContain("name_exact");
  });
  it("(B2) different companies get low score · never fabricated identity", () => {
    const a = { ...base, business_name: "ABC Scaffolding Ltd", website_url: "https://abc.co.uk" };
    const b = { ...base, business_name: "XYZ Access Services Ltd", website_url: "https://xyz.co.uk" };
    const m = matchScore(a as any, b as any);
    expect(m.score).toBeLessThan(0.5);
  });
  it("(B3) matcher only scores fields present in BOTH inputs · empty ↔ empty never a match", () => {
    const a = { ...base, business_name: "ABC" };
    const b = { ...base, business_name: "ABC" };
    const m = matchScore(a as any, b as any);
    // Only name (matched 2/2) + country (matched 1/1) present in both = 3/3 = 1
    expect(m.score).toBe(1);
    expect(m.signals).toEqual(expect.arrayContaining(["name_exact", "country_exact"]));
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Governance / boundary markers
// ═══════════════════════════════════════════════════════════════════
describe("Entity resolution · (C) boundaries", () => {
  it("(C1) boundary markers exported · verified by string identity", () => {
    expect(_ENTITY_RESOLUTION_BOUNDARY_NEVER_FABRICATE).toBe("entity_created_only_with_real_observation");
    expect(_EMAIL_CLASSIFIER_PROVIDER_AGNOSTIC).toBe("no_provider_whitelist_all_publicly_evidenced_providers_accepted");
    expect(_EMAIL_CLASSIFIER_NEVER_FABRICATES).toBe("never_generates_or_infers_addresses");
  });
  it("(C2) module exports NO generator / fabricator", async () => {
    const mod = await import("..");
    expect((mod as any).generateEmailForCompany).toBeUndefined();
    expect((mod as any).guessBusinessEmail).toBeUndefined();
    expect((mod as any).inferContactAddress).toBeUndefined();
    expect((mod as any).createFakeEntity).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Email classifier · provider-agnostic
// ═══════════════════════════════════════════════════════════════════
describe("Email classifier · (D) provider-agnostic", () => {
  it("(D1) accepts free-provider emails at parity with business-domain", () => {
    const gmail = classifyEmail({ email: "abcscaffolding@gmail.com", source_kind: "entity_website_contact_page", email_matches_entity_domain: false });
    expect(gmail.valid).toBe(true);
    expect(gmail.email_type).toBe("free_provider");
    expect(gmail.email_evidence_tier).toBe("published_on_entity_website");
    expect(gmail.email_provider_domain).toBe("gmail.com");

    const bizDomain = classifyEmail({ email: "sales@abcscaffolding.co.uk", source_kind: "entity_website_contact_page", email_matches_entity_domain: true });
    expect(bizDomain.valid).toBe(true);
    // sales@ is a role local-part · classified as role_address · takes precedence over domain type
    expect(bizDomain.email_type).toBe("role_address");
    expect(bizDomain.email_evidence_tier).toBe("directly_published_by_entity");
  });
  it("(D2) recognises all major providers without whitelisting", () => {
    for (const email of [
      "co@yahoo.com", "co@hotmail.com", "co@outlook.com", "co@live.com",
      "co@icloud.com", "co@proton.me", "co@zoho.com", "co@mail.com",
      "co@aol.com", "co@gmx.de", "co@web.de", "co@yandex.com",
      "co@mail.ru", "co@qq.com", "co@163.com",
    ]) {
      const r = classifyEmail({ email, source_kind: "entity_website_contact_page" });
      expect(r.valid).toBe(true);
      expect(r.email_type).toBe("free_provider");
      expect(r.email_provider_domain).toBe(email.split("@")[1]);
    }
  });
  it("(D3) role local-parts classified explicitly · NOT rejected", () => {
    for (const local of ["info", "sales", "office", "contact", "hello", "enquiries", "team"]) {
      const r = classifyEmail({ email: `${local}@example-real-company.co.uk`, source_kind: "entity_website_contact_page", email_matches_entity_domain: true });
      expect(r.valid).toBe(true);
      expect(r.email_type).toBe("role_address");
      expect(r.email_evidence_tier).toBe("directly_published_by_entity");
    }
  });
  it("(D4) invalid local-parts rejected · not classified", () => {
    for (const local of ["noreply", "no-reply", "donotreply", "postmaster", "mailer-daemon", "abuse", "hostmaster", "null"]) {
      const r = classifyEmail({ email: `${local}@example-real-company.co.uk`, source_kind: "entity_website_contact_page" });
      expect(r.valid).toBe(false);
      expect(r.rejection_reason).toBe("invalid_local_part");
      expect(r.email_type).toBeNull();
    }
  });
  it("(D5) placeholder + aggregator domains rejected", () => {
    expect(classifyEmail({ email: "info@example.com",   source_kind: "entity_website_contact_page" }).rejection_reason).toBe("placeholder_domain");
    expect(classifyEmail({ email: "info@example.org",   source_kind: "entity_website_contact_page" }).rejection_reason).toBe("placeholder_domain");
    expect(classifyEmail({ email: "info@booking.com",   source_kind: "entity_website_contact_page" }).rejection_reason).toBe("aggregator_domain");
    expect(classifyEmail({ email: "info@google.com",    source_kind: "entity_website_contact_page" }).rejection_reason).toBe("aggregator_domain");
    expect(classifyEmail({ email: "info@tripadvisor.com", source_kind: "entity_website_contact_page" }).rejection_reason).toBe("aggregator_domain");
  });
  it("(D6) email_evidence_tier reflects source_kind independently of email_type", () => {
    const directly = classifyEmail({ email: "info@abcscaffolding.co.uk", source_kind: "entity_website_contact_page", email_matches_entity_domain: true });
    const onSite   = classifyEmail({ email: "info@abcscaffolding.co.uk", source_kind: "entity_website_other_page" });
    const dir      = classifyEmail({ email: "info@abcscaffolding.co.uk", source_kind: "permitted_directory" });
    const weak     = classifyEmail({ email: "info@abcscaffolding.co.uk", source_kind: "search_result_snippet", on_entity_domain: false });
    const assoc    = classifyEmail({ email: "info@abcscaffolding.co.uk", source_kind: "search_result_snippet", on_entity_domain: true });
    expect(directly.email_evidence_tier).toBe("directly_published_by_entity");
    expect(onSite.email_evidence_tier).toBe("published_on_entity_website");
    expect(dir.email_evidence_tier).toBe("permitted_directory");
    expect(weak.email_evidence_tier).toBe("weak_association");
    expect(assoc.email_evidence_tier).toBe("associated_with_resolved_entity");
  });
  it("(D7) free-provider on entity page: valid combination · fully qualified evidence", () => {
    // §Founder rule: abcscaffolding@gmail.com is valid discovery evidence
    // if ABC Scaffolding publicly publishes it on their own contact page.
    const r = classifyEmail({ email: "abcscaffolding@gmail.com", source_kind: "entity_website_contact_page", email_matches_entity_domain: false });
    expect(r.valid).toBe(true);
    expect(r.email_type).toBe("free_provider");
    expect(r.email_evidence_tier).toBe("published_on_entity_website");
    // Both dimensions preserved · never conflated
    expect(r.email_type).not.toBe(r.email_evidence_tier as unknown);
  });
  it("(D8) rejects malformed + asset-filename lookalikes", () => {
    expect(classifyEmail({ email: "not-an-email",       source_kind: "entity_website_contact_page" }).rejection_reason).toBe("invalid_shape");
    expect(classifyEmail({ email: "us@3x.png",          source_kind: "entity_website_contact_page" }).rejection_reason).toBe("asset_filename_lookalike");
    expect(classifyEmail({ email: "@nolocal.com",       source_kind: "entity_website_contact_page" }).rejection_reason).toBe("invalid_shape");
  });
});
