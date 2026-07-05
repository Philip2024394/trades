// PublicView — customer-facing rendering of the delivery config.
// Shows the map with owner's applied toggles + zone-price legend +
// optional directions bar.

"use client";

import { DELIVERY_ZONE_COLOURS, DELIVERY_ZONE_LABEL, formatZonePrice } from "../logic";
import type { DeliveryConfig } from "../logic";
import { DeliveryMap } from "./DeliveryMap";
import { DirectionsBar } from "./DirectionsBar";

export type PublicViewProps = {
  config: DeliveryConfig;
  mapHeightPx?: number;
};

export function PublicView({ config, mapHeightPx = 320 }: PublicViewProps) {
  return (
    <div className="flex flex-col gap-2">
      <DeliveryMap config={config} heightPx={mapHeightPx} />

      {config.show_directions_bar ? (
        <DirectionsBar
          ownerLat={config.owner_lat}
          ownerLng={config.owner_lng}
          ownerLabel={config.owner_label}
        />
      ) : null}

      {config.show_zones ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {[...config.zones]
            .sort((a, b) => a.radius_km - b.radius_km)
            .map((z) => {
              const c = DELIVERY_ZONE_COLOURS[z.color];
              return (
                <div
                  key={z.color}
                  className="flex items-center gap-1.5 rounded-full border bg-white px-2 py-1"
                  style={{ borderColor: c.stroke }}
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: c.stroke }}
                    aria-hidden
                  />
                  <span className="text-[11px] font-semibold text-neutral-900">
                    {DELIVERY_ZONE_LABEL[z.color]}
                  </span>
                  <span className="text-[11px] text-neutral-600">
                    · up to {z.radius_km} km
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      z.free ? "text-emerald-700" : "text-neutral-900"
                    }`}
                  >
                    · {formatZonePrice(z)}
                  </span>
                </div>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}
