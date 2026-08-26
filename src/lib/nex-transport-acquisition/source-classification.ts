// src/lib/nex-transport-acquisition/source-classification.ts
//
// SOURCE CLASSIFICATION · enforces the Public-Contact-Only rule.
//
// Doctrine (CONSTITUTIONAL 2026-08-23):
//   NEX may only collect contact information when it is publicly advertised
//   for business/service contact. NEVER leaked · private · hacked · closed
//   groups · inferred · generated · scraped-behind-login.
//
// This module classifies a candidate source into ONE of the allowed
// nex.transport_source_kind values, OR rejects it as unknown_or_disallowed
// with a specific reason the operator can audit.
//
// The classification is intentionally CONSERVATIVE. When in doubt, REJECT.

import type { TransportSourceKind } from "./types";

export interface SourceClassificationInput {
  sourceUrl: string;
  /**
   * Optional operator-declared hint about what the source is. The classifier
   * still verifies it against URL heuristics · never blindly accepts a hint.
   */
  operatorHint?: TransportSourceKind;
  /**
   * Optional human note explaining WHY NEX believes the source is publicly
   * advertised (e.g. "public Google Maps business listing seen on 2026-08-23").
   * Required to be present + non-empty for other_public_business_source.
   */
  publicEvidenceNote?: string;
}

export interface SourceAccepted {
  status: "ACCEPTED";
  sourceKind: TransportSourceKind;   // never 'unknown_or_disallowed'
  reason: string;
}

export interface SourceRejected {
  status: "REJECTED";
  reason:
    | "EMPTY_OR_INVALID_URL"
    | "PRIVATE_OR_LEAKED_DATABASE"
    | "CLOSED_SOCIAL_GROUP"
    | "PRIVATE_PERSONAL_PROFILE"
    | "GENERATED_OR_PATTERN_INFERRED"
    | "REQUIRES_LOGIN_OR_PRIVATE"
    | "UNRECOGNISED_SOURCE"
    | "MISSING_PUBLIC_EVIDENCE_NOTE"
    | "OPERATOR_HINT_UNRECOGNISED";
  detail: string;
}

export type SourceClassification = SourceAccepted | SourceRejected;

// ── Explicit REJECT patterns (host / substring) ────────────────────────
// These are checked FIRST · a matching pattern → immediate REJECT even if a
// heuristic below would otherwise accept the URL.

const REJECT_HOST_PATTERNS: { pattern: RegExp; reason: SourceRejected["reason"]; detail: string }[] = [
  { pattern: /(^|\.)chat\.whatsapp\.com$/i, reason: "CLOSED_SOCIAL_GROUP", detail: "WhatsApp group invite is a closed group, not public business contact." },
  { pattern: /(pastebin|paste\.|leaked|hacked|breach|dump|combolist|db-leaks?)/i, reason: "PRIVATE_OR_LEAKED_DATABASE", detail: "URL/host suggests leaked/hacked database or paste dump." },
  { pattern: /(private-|internal-|intranet\.)/i, reason: "REQUIRES_LOGIN_OR_PRIVATE", detail: "URL/host suggests private/internal-only resource." },
];

const REJECT_URL_KEYWORDS: { pattern: RegExp; reason: SourceRejected["reason"]; detail: string }[] = [
  { pattern: /\/leaked\//i,          reason: "PRIVATE_OR_LEAKED_DATABASE",     detail: "URL path contains 'leaked'." },
  { pattern: /\/breach\//i,          reason: "PRIVATE_OR_LEAKED_DATABASE",     detail: "URL path contains 'breach'." },
  { pattern: /\/dump\//i,            reason: "PRIVATE_OR_LEAKED_DATABASE",     detail: "URL path contains 'dump'." },
  { pattern: /\/scrape\//i,          reason: "PRIVATE_OR_LEAKED_DATABASE",     detail: "URL path contains 'scrape' (likely non-public aggregator)." },
];

// ── ACCEPT patterns (host / URL → sourceKind) ─────────────────────────
// The URL heuristic MUST agree with either the operatorHint or an operator-
// supplied publicEvidenceNote for other_public_business_source.

interface AcceptRule {
  pattern: RegExp;
  kind: TransportSourceKind;
  reason: string;
}

const ACCEPT_RULES: AcceptRule[] = [
  { pattern: /(^|\.)wa\.me$/i,                             kind: "public_whatsapp_business_link",         reason: "wa.me is a public WhatsApp business link" },
  { pattern: /api\.whatsapp\.com\/send/i,                  kind: "public_whatsapp_business_link",         reason: "api.whatsapp.com/send is a public WhatsApp business link" },
  { pattern: /(^|\.)maps\.google\.[a-z.]+$/i,              kind: "public_maps_listing",                   reason: "Google Maps public listing" },
  { pattern: /(^|\.)goo\.gl\/maps/i,                       kind: "public_maps_listing",                   reason: "Google Maps short-link" },
  { pattern: /(^|\.)facebook\.com$/i,                      kind: "public_facebook_business_page",         reason: "Public Facebook page" },
  { pattern: /(^|\.)instagram\.com$/i,                     kind: "public_instagram_business_profile",     reason: "Public Instagram profile" },
  { pattern: /(tokopedia|shopee|bukalapak|olx|jualo|lazada)\.co/i, kind: "public_marketplace_listing",     reason: "Public marketplace listing" },
  { pattern: /(loker|jobstreet|karir|linkedin)\.co/i,      kind: "public_recruitment_advertisement",      reason: "Public recruitment / jobs listing" },
];

function isProbableUrl(s: string): boolean {
  const t = s.trim();
  if (t.length === 0) return false;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try { new URL(withProto); return true; } catch { return false; }
}

function parseUrl(s: string): URL | null {
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try { return new URL(withProto); } catch { return null; }
}

const ALLOWED_KIND_VALUES: TransportSourceKind[] = [
  "public_business_website",
  "public_maps_listing",
  "public_business_directory",
  "public_transport_service_listing",
  "public_driver_service_website",
  "public_facebook_business_page",
  "public_instagram_business_profile",
  "public_whatsapp_business_link",
  "public_marketplace_listing",
  "public_recruitment_advertisement",
  "other_public_business_source",
];

/**
 * Classify a candidate source. Rejects when in doubt. Accepts only when the
 * URL matches one of the ACCEPT_RULES or the operator supplies a valid hint
 * (other than unknown_or_disallowed) plus a non-empty publicEvidenceNote for
 * the catch-all other_public_business_source case.
 */
export function classifyTransportSource(input: SourceClassificationInput): SourceClassification {
  if (!input.sourceUrl || !isProbableUrl(input.sourceUrl)) {
    return { status: "REJECTED", reason: "EMPTY_OR_INVALID_URL", detail: "sourceUrl is empty or not a URL" };
  }

  const url = parseUrl(input.sourceUrl)!;
  const host = url.hostname.toLowerCase();

  // 1. Explicit reject patterns (host)
  for (const r of REJECT_HOST_PATTERNS) {
    if (r.pattern.test(host)) return { status: "REJECTED", reason: r.reason, detail: r.detail };
  }

  // 2. Explicit reject patterns (path/keyword)
  const fullLower = input.sourceUrl.toLowerCase();
  for (const r of REJECT_URL_KEYWORDS) {
    if (r.pattern.test(fullLower)) return { status: "REJECTED", reason: r.reason, detail: r.detail };
  }

  // 3. Operator hint validation
  if (input.operatorHint) {
    if (!ALLOWED_KIND_VALUES.includes(input.operatorHint) || input.operatorHint === ("unknown_or_disallowed" as TransportSourceKind)) {
      return {
        status: "REJECTED",
        reason: "OPERATOR_HINT_UNRECOGNISED",
        detail: `operatorHint '${input.operatorHint}' is not an allowed public source kind`,
      };
    }
  }

  // 4. URL heuristic → automatic accept
  for (const rule of ACCEPT_RULES) {
    if (rule.pattern.test(host) || rule.pattern.test(fullLower)) {
      return { status: "ACCEPTED", sourceKind: rule.kind, reason: rule.reason };
    }
  }

  // 5. Operator hint fallback
  if (input.operatorHint) {
    if (input.operatorHint === "other_public_business_source") {
      if (!input.publicEvidenceNote || input.publicEvidenceNote.trim().length === 0) {
        return {
          status: "REJECTED",
          reason: "MISSING_PUBLIC_EVIDENCE_NOTE",
          detail: "other_public_business_source requires a non-empty publicEvidenceNote",
        };
      }
    }
    return {
      status: "ACCEPTED",
      sourceKind: input.operatorHint,
      reason: `accepted on operator hint '${input.operatorHint}'`,
    };
  }

  return {
    status: "REJECTED",
    reason: "UNRECOGNISED_SOURCE",
    detail: `Host '${host}' did not match an accept rule and no operatorHint was supplied.`,
  };
}
