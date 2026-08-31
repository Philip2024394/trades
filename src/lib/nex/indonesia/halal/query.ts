// Halal-aware query surface.
//
// Gives the retrieval layer + answer engine a clean primitive for
// halal-sensitive user asks. Never fabricates certification. Every
// return value carries the halal state + provenance the user should
// see.
//
// Usage:
//   findHalalRestaurants(entities, { area: "Yogyakarta", requireCertified: true })
//   describeHalalStatus(entity)

import type { EntityRecord } from "../data/types";
import type { HalalCertification, HalalStatus } from "./types";
import { HALAL_USER_PHRASES } from "./types";

/** Extract the halal certification from an entity. Convention:
 *  attributes.halal is where the pipeline stores it. */
export function getHalalCertification(entity: EntityRecord): HalalCertification | undefined {
  const a = entity.attributes?.halal;
  if (!a || typeof a !== "object") return undefined;
  return a as HalalCertification;
}

/** Produce the user-facing phrase for a business's halal state. */
export function describeHalalStatus(entity: EntityRecord): string {
  const cert = getHalalCertification(entity);
  if (!cert) return HALAL_USER_PHRASES.unknown({} as HalalCertification);
  return HALAL_USER_PHRASES[cert.status](cert);
}

export type HalalQueryOptions = {
  /** Region / regency / neighbourhood filter (case-insensitive contains). */
  area?: string;
  /** Only return records that meet this bar. */
  requireCertified?: boolean;
  /** Also include "claimed" (default false · stricter is safer). */
  includeClaimed?: boolean;
  /** Only records freshness-verified in the last N days. */
  verifiedWithinDays?: number;
  limit?: number;
};

export type HalalHit = {
  entity: EntityRecord;
  certification: HalalCertification;
  phrase: string;
};

/** Filter a business-entity list by halal state. */
export function findHalalRestaurants(entities: EntityRecord[], opts: HalalQueryOptions = {}): HalalHit[] {
  const now = Date.now();
  const cutoff = opts.verifiedWithinDays ? now - opts.verifiedWithinDays * 86_400_000 : 0;
  const results: HalalHit[] = [];

  for (const e of entities) {
    if (e.kind !== "business") continue;
    const cert = getHalalCertification(e);
    if (!cert) continue;

    const stateOk = opts.requireCertified
      ? cert.status === "certified" || (!!opts.includeClaimed && cert.status === "claimed")
      : cert.status !== "not_halal" && cert.status !== "unknown";
    if (!stateOk) continue;

    if (opts.area) {
      const a = opts.area.toLowerCase();
      const hasArea =
        e.geo?.regency?.toLowerCase().includes(a) ||
        e.geo?.province?.toLowerCase().includes(a) ||
        e.geo?.district?.toLowerCase().includes(a) ||
        e.geo?.neighborhood?.toLowerCase().includes(a) ||
        e.name.toLowerCase().includes(a);
      if (!hasArea) continue;
    }

    if (cutoff > 0 && new Date(cert.verifiedAt).getTime() < cutoff) continue;

    results.push({ entity: e, certification: cert, phrase: describeHalalStatus(e) });
    if (opts.limit && results.length >= opts.limit) break;
  }
  return results;
}

/** Attach or update the halal certification attribute on an entity.
 *  Returns a new EntityRecord (functional style · never mutates). */
export function withHalalCertification(entity: EntityRecord, cert: HalalCertification): EntityRecord {
  return {
    ...entity,
    attributes: {
      ...(entity.attributes ?? {}),
      halal: cert,
    },
  };
}

/** Convenience: summary counts by halal status across a corpus. */
export function halalStatusCounts(entities: EntityRecord[]): Record<HalalStatus | "not_scored", number> {
  const out: Record<HalalStatus | "not_scored", number> = {
    certified: 0, claimed: 0, not_halal: 0, unknown: 0, not_scored: 0,
  };
  for (const e of entities) {
    if (e.kind !== "business") continue;
    const cert = getHalalCertification(e);
    if (!cert) { out.not_scored += 1; continue; }
    out[cert.status] += 1;
  }
  return out;
}
