// src/lib/nex/aof/dedup.ts
//
// NEX Autonomous Operations Framework · Cross-source identity + dedup
// Founder-authorised Wave F · 2026-09-22.
//
// A business discovered by multiple legitimate sources must not
// automatically become multiple businesses.
//
// Before inserting a new candidate:
//   1. Normalise identity keys (canonical_website preferred · fallback to
//      country_iso + normalised business_name)
//   2. Look up existing candidate by those keys
//   3. If a matching candidate exists AND its source_slug differs from
//      the current source: record a `rediscovery` decision event in
//      `nex.aof_agent_event` (preserving the additional discovery source
//      as provenance) and RETURN a "rediscovery" result — do NOT insert
//      a new candidate row
//   4. If no match: caller proceeds with the normal insertBusinessCandidate
//
// This preserves the existing evidence pipeline (walker → extractor →
// evidence) untouched · a rediscovered business already has its walk
// state and evidence rows keyed to its existing candidate_id.

import type { PgClient } from "./types";
import { logAgentEvent } from "./lifecycle";

export interface CrossSourceIdentityInput {
  readonly country_iso: string;
  readonly business_name: string;
  readonly website_url: string | null;
}

export interface CrossSourceLookupResult {
  readonly existing_candidate_id: string | null;
  readonly existing_source_slug: string | null;
  readonly matched_on: "canonical_website" | "country_iso_and_name" | null;
}

// Deterministic normalisation for business_name identity match
export function normaliseBusinessName(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/\s*[·|,\-–—]\s*.*$/g, "")            // strip anything after separators
    .replace(/\b(gmbh|ag|ltd|limited|inc|llc|s\.?a\.?|s\.?l\.?|srl|spa|bv|nv|ab|as|kg|kft|oy|co|company|corp|plc)\b\.?/gi, "")
    .replace(/[^a-z0-9]+/g, " ")                    // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalHost(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch { return null; }
}

export async function lookupExistingCandidate(client: PgClient, input: CrossSourceIdentityInput): Promise<CrossSourceLookupResult> {
  const canon = canonicalHost(input.website_url);
  // First priority: canonical_website match (strong identity)
  if (canon) {
    const r = await client.query(
      `SELECT candidate_id, source_slug FROM nex.harvest_business_candidate
        WHERE website_url IS NOT NULL
          AND (
            regexp_replace(lower(regexp_replace(website_url, '^https?://', '')), '^www\\.', '')
              LIKE $1 || '%'
            OR regexp_replace(lower(regexp_replace(website_url, '^https?://', '')), '^www\\.', '/')
              LIKE $1 || '/%'
          )
        LIMIT 1`,
      [canon],
    );
    if ((r.rowCount ?? 0) > 0) {
      return { existing_candidate_id: r.rows[0].candidate_id, existing_source_slug: r.rows[0].source_slug, matched_on: "canonical_website" };
    }
  }
  // Second priority: (country_iso + normalised business_name)
  const nameKey = normaliseBusinessName(input.business_name);
  if (nameKey.length >= 3) {
    const r2 = await client.query(
      `SELECT candidate_id, source_slug, business_name FROM nex.harvest_business_candidate
        WHERE country_iso = $1
          AND lower(business_name) = lower($2)
        LIMIT 1`,
      [input.country_iso, input.business_name],
    );
    if ((r2.rowCount ?? 0) > 0) {
      return { existing_candidate_id: r2.rows[0].candidate_id, existing_source_slug: r2.rows[0].source_slug, matched_on: "country_iso_and_name" };
    }
  }
  return { existing_candidate_id: null, existing_source_slug: null, matched_on: null };
}

export interface RediscoveryInput {
  readonly agent_id: string;
  readonly cycle_id?: string;
  readonly existing_candidate_id: string;
  readonly existing_source_slug: string;
  readonly new_source_slug: string;
  readonly new_external_ref: string;
  readonly matched_on: "canonical_website" | "country_iso_and_name";
  readonly country_iso: string;
  readonly business_name: string;
  readonly website_url: string | null;
}

export async function recordRediscovery(client: PgClient, input: RediscoveryInput): Promise<void> {
  await logAgentEvent(client, {
    agent_id: input.agent_id,
    event_kind: "decision",
    cycle_id: input.cycle_id ?? null,
    payload: {
      op: "cross_source_rediscovery",
      existing_candidate_id: input.existing_candidate_id,
      existing_source_slug: input.existing_source_slug,
      new_source_slug: input.new_source_slug,
      new_external_ref: input.new_external_ref,
      matched_on: input.matched_on,
      country_iso: input.country_iso,
      business_name: input.business_name,
      website_url: input.website_url,
    },
  });
}

// ─── Doctrine locks ─────────────────────────────────────────────────
export const _DEDUP_CANONICAL_WEBSITE_FIRST =
  "canonical_host_of_website_url_is_the_primary_identity_key_when_present";
export const _DEDUP_NAME_MATCH_REQUIRES_COUNTRY =
  "name_only_matches_are_country_scoped_never_global";
export const _DEDUP_REDISCOVERY_LOGS_NEVER_INSERTS_DUPLICATE =
  "rediscovery_writes_to_aof_agent_event_never_creates_second_candidate_row";
