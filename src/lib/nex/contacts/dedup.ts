// NEX Contact Intelligence · duplicate detection
//
// Suggests candidate duplicate pairs · admin approves every merge.
// Auto-merge is never permitted. Three heuristics, ordered strongest first:
//
//   1. email_exact       · canonical_email match       · confidence 99
//   2. phone_exact       · canonical_phone match       · confidence 95
//   3. name_company_fuzzy · nameKey + companyKey match · confidence 60
//
// The registry runs these opportunistically at upsert time (finds an
// existing canonical record by email/phone) AND periodically as a batch
// (to catch name/company fuzzies added days apart).

import type { Contact, ContactDuplicateSuggestion } from "./types";
import { canonicalEmail, canonicalPhone, companyKey, nameKey } from "./identity";

export type MatchKind = ContactDuplicateSuggestion["match_kind"];

export type CandidateMatch = {
  kind: MatchKind;
  confidence: number;
  signal: string;
};

/**
 * Compare two canonical Contact rows.
 * Returns ALL matching signals found (a pair can match on both email and phone).
 */
export function detectMatches(a: Contact, b: Contact): CandidateMatch[] {
  const matches: CandidateMatch[] = [];
  const ea = a.canonical_email ?? canonicalEmail(a.email);
  const eb = b.canonical_email ?? canonicalEmail(b.email);
  if (ea && eb && ea === eb) matches.push({ kind: "email_exact", confidence: 99, signal: `email=${ea}` });

  const pa = a.canonical_phone ?? canonicalPhone(a.phone);
  const pb = b.canonical_phone ?? canonicalPhone(b.phone);
  if (pa && pb && pa === pb) matches.push({ kind: "phone_exact", confidence: 95, signal: `phone=${pa}` });

  const na = nameKey(a.name);
  const nb = nameKey(b.name);
  const ca = companyKey(a.company);
  const cb = companyKey(b.company);
  if (na && nb && na === nb && ca && cb && ca === cb) {
    matches.push({
      kind: "name_company_fuzzy",
      confidence: 60,
      signal: `name=${na} company=${ca}`,
    });
  }
  return matches;
}

/**
 * Deterministic ordered pair · used to satisfy the DB constraint
 * `contact_a < contact_b` (alphanumeric).
 */
export function orderedPair(a: string, b: string): { contact_a: string; contact_b: string } {
  return a < b ? { contact_a: a, contact_b: b } : { contact_a: b, contact_b: a };
}
