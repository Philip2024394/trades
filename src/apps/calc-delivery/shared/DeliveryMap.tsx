// DeliveryMap — Leaflet map with owner pin + optional zone rings +
// optional approximate-location fuzzy ring.
//
// Follows the same pattern as src/components/trade-off/TradeAreaMap.tsx
// — all Leaflet imports dynamic-loaded, the default icon fixed on
// mount to avoid the "grey square" bug in Webpack/Turbopack builds.

"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import {
  APPROXIMATE_RADIUS_M,
  DELIVERY_ZONE_COLOURS
} from "../logic";
import type { DeliveryConfig } from "../logic";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Circle = dynamic(
  () => import("react-leaflet").then((m) => m.Circle),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("react-leaflet").then((m) => m.Tooltip),
  { ssr: false }
);

function useFixLeafletDefaultIcon() {
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled) return;
      const proto = L.Icon.Default.prototype as unknown as {
        _getIconUrl?: unknown;
      };
      delete proto._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png"
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
}

export type DeliveryMapProps = {
  config: DeliveryConfig;
  heightPx?: number;
};

export function DeliveryMap({ config, heightPx = 320 }: DeliveryMapProps) {
  useFixLeafletDefaultIcon();

  const center = useMemo<[number, number]>(
    () => [config.owner_lat, config.owner_lng],
    [config.owner_lat, config.owner_lng]
  );

  // Auto-fit zoom so the biggest visible ring fits. If zones off, use
  // an approximate default around the pin.
  const zoom = useMemo(() => {
    if (!config.show_zones) return config.approximate_location ? 14 : 15;
    const maxRadius = Math.max(...config.zones.map((z) => z.radius_km));
    if (maxRadius <= 3) return 13;
    if (maxRadius <= 8) return 11;
    if (maxRadius <= 15) return 10;
    if (maxRadius <= 30) return 9;
    return 8;
  }, [config.show_zones, config.approximate_location, config.zones]);

  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-neutral-200"
      style={{ height: heightPx }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
        // Force a fresh mount when the center changes materially so the
        // map re-centres cleanly. (Leaflet's initialCenter is only
        // read once per mount.)
        key={`${center[0].toFixed(3)}-${center[1].toFixed(3)}-${zoom}`}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />

        {/* Approximate-location fuzzy ring */}
        {config.approximate_location ? (
          <Circle
            center={center}
            radius={APPROXIMATE_RADIUS_M}
            pathOptions={{
              color: "#dc2626",
              weight: 2,
              fillColor: "#ef4444",
              fillOpacity: 0.15,
              dashArray: "6 4"
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -4]}>
              Approximate area (~500 m)
            </Tooltip>
          </Circle>
        ) : (
          <Marker position={center}>
            <Tooltip permanent direction="top" offset={[0, -20]}>
              {config.owner_label || "Owner location"}
            </Tooltip>
          </Marker>
        )}

        {/* Delivery-zone rings */}
        {config.show_zones
          ? [...config.zones]
              // Draw largest first so the smaller rings are visible on top
              .sort((a, b) => b.radius_km - a.radius_km)
              .map((z) => {
                const c = DELIVERY_ZONE_COLOURS[z.color];
                return (
                  <Circle
                    key={z.color}
                    center={center}
                    radius={z.radius_km * 1000}
                    pathOptions={{
                      color: c.stroke,
                      weight: 2,
                      fillColor: c.fill,
                      fillOpacity: 0.35
                    }}
                  />
                );
              })
          : null}
      </MapContainer>
    </div>
  );
}
