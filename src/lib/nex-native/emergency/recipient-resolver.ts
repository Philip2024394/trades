// src/lib/nex-native/emergency/recipient-resolver.ts
//
// NEX Emergency Help · 3-layer recipient resolver.
//
// Server-only. Given an incident, produce the ordered set of recipients
// that should receive the alert:
//
//   Layer 1 · trusted_contact  · owner-pre-selected (nex.trusted_contact)
//   Layer 2 · nearby_opted_in  · opted-in responders within radiusKm
//   Layer 3 · wider_community  · DISABLED in v1 by feature flag
//
// Doctrine:
//   · Never broadcast to all accounts. The resolver always returns a
//     bounded, honestly scoped set.
//   · Layer 2 distance is computed with the earth-radius haversine
//     formula against the opted-in responder's radius. v1 does not
//     persist responder coordinates on the opt-in table (privacy
//     surface deferred to live-mode phase), so the layer-2 ordering
//     reduces to the responder's own radius plus the requester's
//     geometry. The service surfaces each candidate's radius_km and
//     NEVER emits coordinates.
//   · Writes to `nex.incident_recipient` are idempotent per
//     (incident_id, recipient_account_id).
//   · The requester is never a recipient of their own incident.

import "server-only";

import { withClient } from "@/lib/nex/db";
import { isWiderCommunityLayerEnabled } from "./feature-flag";
import type { RecipientLayer, ResolvedRecipients } from "./types";

// =====================================================================
// Pure helpers (exported for testability).
// =====================================================================

const EARTH_RADIUS_KM = 6371;

/**
 * Default broadcast radius (km) for recipient resolution.
 *
 * Sealed 2026-10-10 at 10 km (prior default was 5 km, raised per
 * founder directive to widen the layer-2 opt-in pool). Operators can
 * override via the `NEX_EMERGENCY_DEFAULT_RADIUS_KM` env var; the
 * override is clamped to the resolver's valid range `[1, 25]` so
 * misconfiguration silently falls back to 10 rather than throwing at
 * call-time.
 *
 * This constant is NOT read inside `resolveRecipientsForIncident`
 * itself · the resolver still requires an explicit `radiusKm` in its
 * args (that keeps the service layer honest · a caller must always
 * declare what radius it is asking for). The constant is for upstream
 * callers (`actions.ts`, future service layers) that want a canonical
 * default.
 */
export const DEFAULT_RADIUS_KM: number = (() => {
  const raw = Number(process.env.NEX_EMERGENCY_DEFAULT_RADIUS_KM);
  return Number.isFinite(raw) && raw >= 1 && raw <= 25 ? raw : 10;
})();

/** Haversine great-circle distance between two WGS84 points, in km. */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Deduplicate and preserve order. */
export function uniq(xs: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

/** Remove the requester from a candidate set and clamp to maxN. */
export function finaliseLayer(
  requesterAccountId: string,
  candidates: readonly string[],
  maxN: number,
): string[] {
  const trimmed = uniq(candidates).filter((id) => id !== requesterAccountId);
  if (trimmed.length <= maxN) return trimmed;
  return trimmed.slice(0, maxN);
}

// =====================================================================
// Public API
// =====================================================================

export interface ResolveArgs {
  readonly incidentId: string;
  readonly locationLat: number | null;
  readonly locationLng: number | null;
  readonly requesterAccountId: string;
  readonly maxTrustedContacts: number;
  readonly maxNearbyOptIns: number;
  readonly radiusKm: number;
}

export async function resolveRecipientsForIncident(
  args: ResolveArgs,
): Promise<ResolvedRecipients> {
  if (typeof args.requesterAccountId !== "string" || args.requesterAccountId.trim().length === 0) {
    throw new Error("recipient_resolver.invalid_requester");
  }
  if (!Number.isFinite(args.maxTrustedContacts) || args.maxTrustedContacts < 0) {
    throw new Error("recipient_resolver.invalid_max_trusted");
  }
  if (!Number.isFinite(args.maxNearbyOptIns) || args.maxNearbyOptIns < 0) {
    throw new Error("recipient_resolver.invalid_max_nearby");
  }
  if (!Number.isFinite(args.radiusKm) || args.radiusKm < 1 || args.radiusKm > 25) {
    throw new Error("recipient_resolver.invalid_radius");
  }

  const requester = args.requesterAccountId.trim();

  // Layer 1 · trusted contacts (ignore location entirely).
  const layer1Raw = await withClient(async (client) => {
    const r = await client.query(
      `SELECT contact_account_id
         FROM nex.trusted_contact
        WHERE owner_account_id = $1
        ORDER BY added_at DESC`,
      [requester],
    );
    return r.rows.map((row) => String(row.contact_account_id));
  });
  const layer1 = finaliseLayer(requester, layer1Raw ?? [], args.maxTrustedContacts);

  // Layer 2 · opted-in responders. If the requester did not share a
  // location at all, we cannot meaningfully bound this layer, so we
  // return an empty layer-2 (resolver stays honest).
  let layer2: string[] = [];
  if (
    args.locationLat !== null
    && args.locationLng !== null
    && Number.isFinite(args.locationLat)
    && Number.isFinite(args.locationLng)
  ) {
    const layer2Raw = await withClient(async (client) => {
      const r = await client.query(
        `SELECT account_id, radius_km
           FROM nex.emergency_responder_optin
          WHERE simulated = TRUE
            AND account_id <> $1
          ORDER BY opted_in_at DESC
          LIMIT $2`,
        // Pull up to 10x maxNearbyOptIns candidates to let the resolver
        // sort/filter in-process. The real geo-filter stays honest in
        // v1 because responder coordinates aren't persisted yet; the
        // candidate list is purely "simulated responders in the pilot
        // pool who have declared radius >= requested radius".
        [requester, Math.max(1, args.maxNearbyOptIns * 10)],
      );
      // Honest honest: in v1 we do NOT have responder coordinates in
      // the opt-in row, so we return the pool as-is (filtered by
      // simulated=TRUE). Layer-2 ordering falls back to opted_in_at
      // DESC (freshest opt-ins first).
      return r.rows.map((row) => ({
        accountId: String(row.account_id),
        radiusKm: Number(row.radius_km),
      }));
    });
    const candidates = (layer2Raw ?? [])
      // Keep only responders whose declared radius covers the request.
      .filter((c) => c.radiusKm >= args.radiusKm)
      .map((c) => c.accountId);
    layer2 = finaliseLayer(requester, candidates, args.maxNearbyOptIns);
  }

  // Trusted contacts take precedence; dedupe layer-2 against layer-1.
  const layer1Set = new Set(layer1);
  layer2 = layer2.filter((id) => !layer1Set.has(id));

  return {
    layer1,
    layer2,
    layer3Available: isWiderCommunityLayerEnabled(),
  };
}

/**
 * Writes incident_recipient rows for the given layer-1 / layer-2 ids.
 * Idempotent per (incident_id, recipient_account_id).
 *
 * Returns the number of rows inserted (duplicates are skipped by the
 * UNIQUE constraint via ON CONFLICT DO NOTHING).
 */
export async function writeRecipientRows(
  incidentId: string,
  layer1: readonly string[],
  layer2: readonly string[],
): Promise<number> {
  if (typeof incidentId !== "string" || incidentId.trim().length === 0) {
    throw new Error("recipient_resolver.invalid_incident_id");
  }

  const rows: Array<{ accountId: string; layer: RecipientLayer }> = [];
  for (const id of uniq(layer1)) {
    rows.push({ accountId: id, layer: "trusted_contact" });
  }
  const layer1Set = new Set(layer1);
  for (const id of uniq(layer2)) {
    if (layer1Set.has(id)) continue;
    rows.push({ accountId: id, layer: "nearby_opted_in" });
  }

  if (rows.length === 0) return 0;

  const result = await withClient(async (client) => {
    // Multi-row INSERT with placeholders so the server plan is a
    // single statement. Rows: ($1, $2, $3), ($1, $4, $5), ...
    const params: unknown[] = [incidentId.trim()];
    const valuesSql: string[] = [];
    rows.forEach((r, i) => {
      const base = i * 2 + 2;
      params.push(r.accountId, r.layer);
      valuesSql.push(`($1, $${base}, $${base + 1})`);
    });
    const r = await client.query(
      `INSERT INTO nex.incident_recipient (incident_id, recipient_account_id, layer)
       VALUES ${valuesSql.join(", ")}
       ON CONFLICT (incident_id, recipient_account_id) DO NOTHING`,
      params,
    );
    return r.rowCount ?? 0;
  });
  return result ?? 0;
}
