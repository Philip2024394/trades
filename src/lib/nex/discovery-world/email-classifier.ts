// src/lib/nex/discovery-world/email-classifier.ts
//
// NEX World Email Intelligence · Part 5 partial · Email classification
// Founder-authorised programme · bounded wave 2026-09-21.
//
// PROVIDER-AGNOSTIC · never whitelists any provider.
// Classifies each email along TWO independent dimensions:
//   1 · email_type          — structural (business_domain / free_provider / role_address / personal_looking / unknown)
//   2 · email_evidence_tier — provenance strength (directly_published / on_website / directory / associated / weak / unverified)
//
// Both dimensions are recorded · never conflated. A free-provider mailbox on
// a business's own contact page is `free_provider × directly_published_by_entity`
// and is fully valid public business contact evidence.

export type EmailType =
  | "business_domain"
  | "free_provider"
  | "role_address"
  | "personal_looking"
  | "unknown";

export type EmailEvidenceTier =
  | "directly_published_by_entity"
  | "published_on_entity_website"
  | "permitted_directory"
  | "associated_with_resolved_entity"
  | "weak_association"
  | "unverified";

// Free-provider domain list · NOT a REJECT list · NOT a WHITELIST · it is used
// ONLY to classify email_type. Any email from any provider is accepted; the
// provider is metadata about the mailbox, not a qualification.
const FREE_PROVIDER_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.uk", "yahoo.co.jp", "yahoo.fr", "yahoo.de", "yahoo.es", "yahoo.it", "yahoo.ca", "yahoo.com.au", "yahoo.com.br", "yahoo.co.in",
  "hotmail.com", "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.it", "hotmail.es",
  "outlook.com", "outlook.co.uk", "outlook.fr", "outlook.de", "outlook.jp",
  "live.com", "live.co.uk", "live.fr", "live.de",
  "msn.com",
  "icloud.com", "me.com", "mac.com",
  "proton.me", "protonmail.com", "pm.me",
  "zoho.com", "zohomail.com",
  "mail.com",
  "aol.com", "aim.com",
  "gmx.com", "gmx.de", "gmx.net",
  "web.de", "t-online.de",
  "yandex.com", "yandex.ru",
  "mail.ru", "bk.ru", "inbox.ru", "list.ru",
  "qq.com", "163.com", "126.com", "sina.com", "sina.cn",
  "naver.com", "daum.net", "hanmail.net",
  "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "laposte.net",
  "libero.it", "virgilio.it", "tin.it", "alice.it",
  "bt-internet.com", "btinternet.com", "sky.com", "talktalk.net", "virginmedia.com",
  "bigpond.com", "bigpond.net.au", "optusnet.com.au", "iinet.net.au",
  "shaw.ca", "rogers.com", "sympatico.ca",
  "telstra.com", "tpg.com.au",
]);

// Role-address local-part prefixes (before @) · these are legit business
// contact endpoints (info@, sales@, office@, contact@, hello@) BUT their
// character is different from a named person. Never rejected — always
// classified so downstream systems can treat them appropriately.
const ROLE_LOCAL_PARTS = new Set([
  "info", "sales", "office", "contact", "hello", "hi", "team", "support", "help", "enquiries", "enquiry",
  "inquiries", "inquiry", "marketing", "press", "media", "pr", "hr", "jobs", "careers", "recruitment",
  "accounts", "billing", "finance", "orders", "bookings", "reservations", "reception", "front-desk",
  "admin", "general", "mail", "email", "message", "customerservice", "customercare", "care",
]);

// Blocked local-part patterns · NOT publish endpoints · always rejected outright.
const INVALID_LOCAL_RX = /^(?:noreply|no-reply|donotreply|do-not-reply|postmaster|mailer-daemon|abuse|hostmaster|null|unknown)$/i;

// Aggregator/OTA domain-block list · marketing to these is never permitted.
const AGGREGATOR_DOMAINS = new Set([
  "booking.com", "expedia.com", "agoda.com", "hotels.com", "airbnb.com",
  "traveloka.com", "tiket.com", "trivago.com", "priceline.com",
  "google.com", "facebook.com", "meta.com", "instagram.com", "whatsapp.com",
  "yelp.com", "tripadvisor.com", "foursquare.com",
]);

// Placeholder/example domains · never real contacts.
const PLACEHOLDER_DOMAINS = new Set([
  "example.com", "example.org", "example.net", "test", "localhost", "sample.com",
]);

// Asset-filename extensions that appear in accidentally-scraped strings.
const FAKE_TLD_RX = /\.(?:png|jpg|jpeg|gif|svg|webp|mp4|pdf|woff2?|ttf|otf|ico|css|js|json|xml|zip)$/i;

// ─── Public classifier ─────────────────────────────────────────────
export interface EmailClassificationInput {
  readonly email: string;
  /** Where the email appeared. Used to derive `email_evidence_tier`. */
  readonly source_kind: "entity_website_contact_page" | "entity_website_other_page" | "permitted_directory" | "search_result_snippet" | "unverified";
  /** Whether the email was found on a page belonging to the resolved entity's canonical domain. */
  readonly on_entity_domain?: boolean;
  /** Whether the email uses the resolved entity's canonical domain. */
  readonly email_matches_entity_domain?: boolean;
}

export interface EmailClassification {
  readonly valid: boolean;
  readonly rejection_reason: string | null;
  readonly normalized_email: string | null;
  readonly local_part: string | null;
  readonly domain: string | null;
  readonly email_type: EmailType | null;
  readonly email_evidence_tier: EmailEvidenceTier | null;
  readonly email_provider_domain: string | null;
}

/** Deterministic classification. Never contacts a network. Never fabricates. */
export function classifyEmail(input: EmailClassificationInput): EmailClassification {
  const raw = String(input.email ?? "").trim().toLowerCase();
  const reject = (reason: string): EmailClassification => ({
    valid: false, rejection_reason: reason,
    normalized_email: null, local_part: null, domain: null,
    email_type: null, email_evidence_tier: null, email_provider_domain: null,
  });

  if (!raw || raw.length < 5 || raw.length > 254) return reject("invalid_shape");
  if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(raw)) return reject("invalid_shape");
  if (FAKE_TLD_RX.test(raw)) return reject("asset_filename_lookalike");
  const [local, domain] = raw.split("@");
  if (INVALID_LOCAL_RX.test(local)) return reject("invalid_local_part");
  if (PLACEHOLDER_DOMAINS.has(domain)) return reject("placeholder_domain");
  if (AGGREGATOR_DOMAINS.has(domain)) return reject("aggregator_domain");

  // ── email_type classification (provider-agnostic) ──
  let email_type: EmailType;
  if (ROLE_LOCAL_PARTS.has(local)) email_type = "role_address";
  else if (FREE_PROVIDER_DOMAINS.has(domain)) email_type = "free_provider";
  else if (domain.split(".").length >= 2) email_type = "business_domain";
  else email_type = "unknown";

  // Refinement: a `role_address` on a business_domain remains `role_address`
  // (the local-part signal is stronger). A `role_address` on a free_provider
  // (e.g. info@gmail.com — unlikely but possible) remains `role_address` too.

  // ── email_evidence_tier derivation (provenance strength) ──
  let tier: EmailEvidenceTier;
  switch (input.source_kind) {
    case "entity_website_contact_page":
      tier = input.email_matches_entity_domain
        ? "directly_published_by_entity"
        : "published_on_entity_website";
      break;
    case "entity_website_other_page":
      tier = "published_on_entity_website";
      break;
    case "permitted_directory":
      tier = "permitted_directory";
      break;
    case "search_result_snippet":
      tier = input.on_entity_domain ? "associated_with_resolved_entity" : "weak_association";
      break;
    default:
      tier = "unverified";
  }

  return {
    valid: true,
    rejection_reason: null,
    normalized_email: raw,
    local_part: local,
    domain,
    email_type,
    email_evidence_tier: tier,
    email_provider_domain: domain,
  };
}

// Structural boundary markers · verified in acceptance tests
export const _EMAIL_CLASSIFIER_PROVIDER_AGNOSTIC = "no_provider_whitelist_all_publicly_evidenced_providers_accepted";
export const _EMAIL_CLASSIFIER_NEVER_FABRICATES = "never_generates_or_infers_addresses";
