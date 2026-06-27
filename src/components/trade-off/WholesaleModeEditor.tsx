"use client";

// WholesaleModeEditor — top-level shell for the Wholesale Mode add-on
// dashboard. Stacks four sections:
//   1. Yard origin (address + postcode + lat/lng + fudge + VAT)
//   2. Delivery zones (free radius + banded distance pricing)
//   3. Bulk tiers per product (collapsible per-product editor)
//   4. (Inline tip strip — links back to Shop Mode for product CRUD)
//
// The product list comes from the parent server shell so we don't
// re-fetch on mount. The bulk-tier editor for each product writes
// through /api/trade-off/products/upsert (same endpoint Shop Mode
// uses).

import { useMemo, useState } from "react";
import type {
  HammerexTradeOffListing,
  HammerexXratedProduct,
  HammerexXratedWholesaleZone
} from "@/lib/supabase";
import { YardOriginEditor } from "./YardOriginEditor";
import { WholesaleZonesEditor } from "./WholesaleZonesEditor";
import { BulkTiersPanel } from "./BulkTiersPanel";

export function WholesaleModeEditor({
  slug,
  editToken,
  listing,
  initialZone,
  initialProducts
}: {
  slug: string;
  editToken: string;
  listing: HammerexTradeOffListing;
  initialZone: HammerexXratedWholesaleZone | null;
  initialProducts: HammerexXratedProduct[];
}) {
  // Lifted "allow pickup" — yard editor owns the persistence path, the
  // zones editor mirrors it as a courtesy toggle so the dashboard reads
  // consistently. We don't fire a save on toggle here — the yard editor
  // batches it into its own save call.
  const [allowPickup, setAllowPickup] = useState<boolean>(listing.wholesale_allow_pickup ?? false);

  const products = useMemo(
    () => initialProducts.filter((p) => (p.kind ?? "product") === "product"),
    [initialProducts]
  );

  return (
    <div className="space-y-6">
      <YardOriginEditor
        slug={slug}
        editToken={editToken}
        initial={{
          address: listing.wholesale_origin_address ?? "",
          postcode: listing.wholesale_origin_postcode ?? "",
          lat: listing.wholesale_origin_lat ?? null,
          lng: listing.wholesale_origin_lng ?? null,
          distance_fudge: String(listing.wholesale_distance_fudge ?? 1.4),
          allow_pickup: listing.wholesale_allow_pickup ?? false,
          currency: listing.wholesale_currency ?? "GBP",
          prices_ex_vat: listing.wholesale_prices_ex_vat ?? true
        }}
        onAllowPickupChange={setAllowPickup}
      />

      <WholesaleZonesEditor
        slug={slug}
        editToken={editToken}
        initialZone={initialZone}
        allowPickup={allowPickup}
        onAllowPickupChange={setAllowPickup}
      />

      <BulkTiersPanel
        slug={slug}
        editToken={editToken}
        initialProducts={products}
      />
    </div>
  );
}
