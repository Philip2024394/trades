// Customer snapshot builder — one call, one snapshot.
//
// Uses the existing CRM's loadContactSummary() for the base 360° view,
// then runs the four enrichers (preferences, opportunities, warranties,
// payments) in parallel. Errors from any enricher surface on
// snapshot.errors — never silently swallowed.
//
// Cached per (contactId, merchantId, hour). Merchants can't collide
// since merchantId is in the key.

import { computeRelationshipHealth } from "./health";
import { detectOpportunities } from "./enrichers/opportunities";
import { inferPreferences } from "./enrichers/preferences";
import { loadPaymentsOwed } from "./enrichers/payments";
import { loadWarranties } from "./enrichers/warranties";
import { resolveCustomer } from "./resolver";
import type {
  CustomerRef,
  CustomerResolveErr,
  CustomerSnapshot
} from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { snapshot: CustomerSnapshot; expiresAt: number }>();

export function _clearCxCache(): void { cache.clear(); }

export type BuildCustomerOptions = {
  merchantId:        string;
  merchantListingId: string;   // hammerex_trade_off_listings.id — for warranties/payments enrichers
  ref:               CustomerRef;
  now?:              Date;
  refresh?:          boolean;
};

export type BuildCustomerResult =
  | { ok: true;  snapshot: CustomerSnapshot }
  | { ok: false } & CustomerResolveErr;

export async function buildCustomerSnapshot(opts: BuildCustomerOptions): Promise<BuildCustomerResult> {
  const now = opts.now ?? new Date();
  const resolved = await resolveCustomer(opts.merchantId, opts.ref);
  if (!resolved.ok) return resolved;

  const hourKey  = now.toISOString().slice(0, 13);
  const cacheKey = `${resolved.contactId}|${opts.merchantId}|${hourKey}`;
  if (!opts.refresh) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now.getTime()) return { ok: true, snapshot: hit.snapshot };
  }

  const summary = resolved.summary;
  const partyId = summary.contact.partyId;

  const errors: CustomerSnapshot["errors"] = [];
  const [preferences, opportunities, warranties, payments_owed] = await Promise.all([
    tryEnricher("preferences",   () => Promise.resolve(inferPreferences(summary)),                                             errors),
    tryEnricher("opportunities", () => Promise.resolve(detectOpportunities(summary, now)),                                     errors),
    tryEnricher("warranties",    () => loadWarranties({ merchantListingId: opts.merchantListingId, partyId, now }),            errors),
    tryEnricher("payments",      () => loadPaymentsOwed({ merchantListingId: opts.merchantListingId, partyId, now }),          errors)
  ]);

  // Pull the customer's most recent review star-rating (if any) for
  // the health signal. Cheap — one row.
  const reviewStars = null;   // TODO: enrich once we surface the review star field per-customer

  const health = computeRelationshipHealth({
    summary,
    payments_owed: payments_owed ?? [],
    reviewStars,
    now
  });

  const snapshot: CustomerSnapshot = {
    contactId:      resolved.contactId,
    contact:        summary.contact,
    timeline:       summary.timeline,
    openTasks:      summary.openTasks,
    totals:         summary.totals,
    health,
    preferences:    preferences ?? [],
    opportunities:  opportunities ?? [],
    warranties:     warranties ?? [],
    payments_owed:  payments_owed ?? [],
    computed_at:    now.toISOString(),
    errors
  };

  cache.set(cacheKey, { snapshot, expiresAt: now.getTime() + CACHE_TTL_MS });
  return { ok: true, snapshot };
}

async function tryEnricher<T>(name: string, fn: () => Promise<T>, errors: CustomerSnapshot["errors"]): Promise<T | null> {
  try { return await fn(); }
  catch (err) {
    errors.push({ enricher: name, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
