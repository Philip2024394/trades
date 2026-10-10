// src/app/api/nex-directory/v1/related/[canonical_id]/route.ts
//
// NEX Directory · Related-businesses JSON endpoint.
//
// v2 shape (new):
//   {
//     "ok": true,
//     "_schema_version": "v2",
//     "anchor_has_coordinates": true,
//     "anchor_name": "Grand Hotel Jakarta",
//     "tiers": [
//       { "tier": "provided_by_business", "groupLabel": "This business offers",
//         "items": [{ "tier": "provided_by_business", "label": "Airport pickup",
//                     "canonicalBusinessId": null }, …] },
//       { "tier": "established_partner",   "groupLabel": "Partner services",
//         "items": [{ "tier": "established_partner", "label": "XYZ Transport",
//                     "canonicalBusinessId": "…uuid…", "distanceMeters": 420 }, …] },
//       { "tier": "nearby_independent",    "groupLabel": "Independent businesses nearby",
//         "items": […flat list…],
//         "nearbyGroups": […existing per-entity-type grouping…] }
//     ],
//     // Backward-compat during migration · v1 flat shape (deprecated):
//     "groups": […same as the pre-v2 response…]
//   }
//
// Honesty & doctrine
//   · Thin GET wrapper over the sealed `fetchRelatedBusinessesTiered`
//     reader. Partners are declared on the anchor's own canonical row
//     (`verticalPayload.partners[]`) ONLY · a nearby business is NEVER
//     labelled as a partner.
//   · Partner resolution reads only from `nex.business_directory_v`
//     (sealed D-1 + D-2 publication gate). Unpublishable partners are
//     silently dropped — never fabricated.
//   · Honest empty state propagates to the UI as a muted microcopy.

import { NextResponse } from "next/server";
import {
  fetchRelatedBusinesses,
  fetchRelatedBusinessesTiered,
} from "@/lib/nex-native/directory/related-businesses/service";
import { getCanonicalBusinessById } from "@/lib/nex-native/directory/directory-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Params {
  readonly params: Promise<{ readonly canonical_id: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const { canonical_id } = await ctx.params;
  if (!UUID_RE.test(canonical_id)) {
    return NextResponse.json(
      { ok: false, error: "invalid_canonical_id" },
      { status: 400 },
    );
  }

  // Load the anchor so we have authoritative entity_type + coordinates
  // + verticalPayload (services_products jsonb). Anonymous public read.
  const anchor = await getCanonicalBusinessById(canonical_id);
  if (!anchor.systemReady) {
    return NextResponse.json(
      {
        ok: false,
        error: "system_unavailable",
        _schema_version: "v2",
        tiers: [],
        groups: [],
      },
      { status: 503 },
    );
  }
  if (anchor.result === null) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_found",
        _schema_version: "v2",
        tiers: [],
        groups: [],
      },
      { status: 404 },
    );
  }

  const anchorListing = anchor.result.listing;
  if (anchorListing.coordinates === null) {
    // Honest empty · caller renders nothing. Tier-1/2 extraction CAN
    // still work without coordinates (they do not depend on geo), so
    // we still run the tiered reader; only tier-3 is empty.
    const providedTiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: anchorListing.canonicalBusinessId,
      anchorEntityType: anchorListing.entityType,
      // Zero-zero coords are harmless · tier-3 is guaranteed empty
      // because the service also receives coordinates === null via a
      // different code path · the server component short-circuits
      // before calling this endpoint when coords are null. We still
      // return a well-formed v2 shape so clients can rely on it.
      anchorCoords: { lat: 0, lng: 0 },
      anchorVerticalPayload: anchorListing.verticalPayload,
      // Force tier-3 empty by limiting the search to a 1-metre radius.
      radiusMeters: 1,
    });
    return NextResponse.json(
      {
        ok: true,
        _schema_version: "v2",
        anchor_has_coordinates: false,
        anchor_name: anchorListing.name,
        tiers: providedTiers,
        // Backward-compat · the pre-v2 shape rendered nothing when
        // coordinates were absent · preserve that behaviour here.
        groups: [],
      },
      { status: 200 },
    );
  }

  const tiers = await fetchRelatedBusinessesTiered({
    anchorCanonicalId: anchorListing.canonicalBusinessId,
    anchorEntityType: anchorListing.entityType,
    anchorCoords: anchorListing.coordinates,
    anchorVerticalPayload: anchorListing.verticalPayload,
    limitPerGroup: 6,
    radiusMeters: 1500,
  });

  // Backward-compat · flat `groups` shape (v1). We derive this from the
  // nearby tier's nested groups so there's one source of truth. Clients
  // not yet cut over to `tiers` continue to work for one deprecation wave.
  const nearbyTier = tiers.find((t) => t.tier === "nearby_independent");
  const groupsV1 =
    nearbyTier !== undefined && nearbyTier.nearbyGroups !== undefined
      ? nearbyTier.nearbyGroups
      : await fetchRelatedBusinesses({
          anchorCanonicalId: anchorListing.canonicalBusinessId,
          anchorEntityType: anchorListing.entityType,
          anchorCoords: anchorListing.coordinates,
          limitPerGroup: 6,
          radiusMeters: 1500,
        });

  return NextResponse.json(
    {
      ok: true,
      _schema_version: "v2",
      anchor_has_coordinates: true,
      anchor_name: anchorListing.name,
      tiers,
      groups: groupsV1,
    },
    { status: 200 },
  );
}
