// Xrated Trades — Services subpage body.
//
// Renders the focused services view: the OpenStreetMap canvas with
// 3 colour-coded delivery zones + auto-discovered postcodes within
// range + a customer location picker. Nothing else — no service-list
// chips, no video, no pricing carousel, no recent work, no reviews.
// Customer who's already decided "where do you deliver?" gets a
// single clean page.

import { TradeAreaMap } from "@/components/trade-off/TradeAreaMap";

export function ServicesPageBody({
  displayName,
  city,
  servicePostcodes,
  lat,
  lng
}: {
  displayName: string;
  city: string;
  servicePostcodes: string[];
  lat: number | null;
  lng: number | null;
}) {
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  return (
    <section className="w-full px-4 pb-8 pt-8 sm:px-6">
      <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
        Delivery & zones
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Where {displayName.split(" ")[0]} delivers. Tap a postcode marker
        on the map to see which delivery zone it sits in.
      </p>

      <div className="mt-4">
        {hasCoords ? (
          <TradeAreaMap
            lat={lat}
            lng={lng}
            city={city}
            servicePostcodes={servicePostcodes}
            merchantName={displayName}
            height={420}
            zones={[
              { idx: 1, km: 5, priceLabel: "FREE" },
              { idx: 2, km: 15, priceLabel: "£15" },
              { idx: 3, km: 30, priceLabel: "£40" }
            ]}
          />
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-xs text-neutral-500">
            Map coordinates not yet set for this profile.
          </div>
        )}
      </div>
    </section>
  );
}
