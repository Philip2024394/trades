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
// YardOriginEditor import removed — location controls now live inline
// inside WholesaleZonesEditor's live-preview block.
// BulkTiersPanel removed from the delivery page per request — bulk
// pricing is product pricing, not delivery. Lives on its own sub-page
// at /trade-off/edit/<slug>/bulk-tiers from here on.
import { WholesaleZonesEditor } from "./WholesaleZonesEditor";
import { WholesaleFreeDeliveryPicker } from "./WholesaleFreeDeliveryPicker";

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

  // YardOriginEditor render removed per request — location setting is
  // now inline in the WholesaleZonesEditor live-preview block. Distance
  // fudge factor, currency picker, listing-level prices_ex_vat toggle
  // are deferred until per-zone VAT lands. We still pass the saved yard
  // coordinates + address to the zones editor so its inline location
  // form can preserve other fields when it saves.
  return (
    <div className="space-y-6">
      <WholesaleZonesEditor
        slug={slug}
        editToken={editToken}
        initialZone={initialZone}
        yardLat={listing.wholesale_origin_lat ?? null}
        yardLng={listing.wholesale_origin_lng ?? null}
        yardPostcode={listing.wholesale_origin_postcode ?? ""}
        yardAddress={listing.wholesale_origin_address ?? ""}
        yardDistanceFudge={listing.wholesale_distance_fudge ?? 1.4}
        yardCurrency={listing.wholesale_currency ?? "GBP"}
        yardPricesExVat={listing.wholesale_prices_ex_vat ?? true}
        yardPickupFrom={listing.wholesale_pickup_from ?? null}
        yardPickupTo={listing.wholesale_pickup_to ?? null}
        yardCity={listing.city ?? ""}
        merchantName={listing.display_name ?? ""}
        allowPickup={allowPickup}
        onAllowPickupChange={setAllowPickup}
      />

      <WholesaleFreeDeliveryPicker
        slug={slug}
        editToken={editToken}
        initialProducts={products}
      />
    </div>
  );
}
