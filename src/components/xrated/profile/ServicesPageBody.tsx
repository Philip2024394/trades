// Xrated Trades — Services subpage body.
//
// Renders the focused services view: a real OpenStreetMap canvas with a
// red catchment circle at the top, every service the tradesperson lists
// below. Nothing else — no video, no pricing carousel, no recent work,
// no reviews. Customer who's already decided "I want to know what +
// where" gets a single clean page.

import { TradeIcon } from "@/lib/tradeIcons";
import { TradeAreaMap } from "@/components/trade-off/TradeAreaMap";

export function ServicesPageBody({
  displayName,
  city,
  servicePostcodes,
  services,
  lat,
  lng
}: {
  displayName: string;
  city: string;
  servicePostcodes: string[];
  services: string[];
  lat: number | null;
  lng: number | null;
}) {
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  const visiblePostcodes = servicePostcodes.slice(0, 18);
  const overflow = servicePostcodes.length - visiblePostcodes.length;

  return (
    <section className="w-full px-4 pb-8 pt-8 sm:px-6">
      <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
        Services & area
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Everything {displayName.split(" ")[0]} covers, and where.
      </p>

      <div className="mt-4">
        {hasCoords ? (
          <TradeAreaMap
            lat={lat}
            lng={lng}
            city={city}
            servicePostcodes={servicePostcodes}
            accentColor="#DC2626"
            radiusMeters={5000}
            height={420}
          />
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-xs text-neutral-500">
            Map coordinates not yet set for this profile — coverage area chips
            below.
          </div>
        )}
      </div>

      {visiblePostcodes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {visiblePostcodes.map((p) => (
            <li key={p}>
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-900">
                {p}
              </span>
            </li>
          ))}
          {overflow > 0 && (
            <li>
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-500">
                +{overflow} more
              </span>
            </li>
          )}
        </ul>
      )}

      {services.length > 0 && (
        <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li
              key={s}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
                <span className="h-5 w-5">
                  <TradeIcon name={s} />
                </span>
              </span>
              <span className="text-sm font-semibold text-neutral-900">{s}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

