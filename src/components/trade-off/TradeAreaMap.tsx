"use client";

// OpenStreetMap-based service-area map for a Trade Off profile.
// Renders a tile map at the tradie's geocoded coordinates with a marker
// and a soft 5km circle. If lat/lng are missing, returns null — the
// existing postcode chips remain as the fallback.
//
// Map components are imported dynamically so react-leaflet (which touches
// `window`) doesn't blow up under SSR.

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import "leaflet/dist/leaflet.css";

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

// Leaflet ships its default marker as a JS image reference computed from
// the page URL, which 404s under bundlers that don't expose the package's
// `dist/images/` directory. Repoint the icon URLs at the unpkg CDN so the
// marker actually renders. Runs once on the client only.
function useFixLeafletDefaultIcon() {
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled) return;
      const proto = (L.Icon.Default.prototype as unknown) as {
        _getIconUrl?: unknown;
      };
      delete proto._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
}

export function TradeAreaMap({
  lat,
  lng,
  city,
  servicePostcodes,
  accentColor = "#FFD400",
  radiusMeters = 5000,
  height = 260
}: {
  lat: number | null;
  lng: number | null;
  city: string;
  servicePostcodes: string[];
  /** Override the area-circle colour. Defaults to the brand yellow used
   *  by the Standard-tier profile; the dedicated Services subpage passes
   *  red so the catchment reads at a glance. */
  accentColor?: string;
  /** Catchment radius in metres. Default 5km. */
  radiusMeters?: number;
  /** Map height in px. Default 260; the Services subpage uses a larger
   *  canvas for hero-level prominence. */
  height?: number;
}) {
  // Silence unused-prop warnings — kept on the API so the parent can pass
  // the full context without TypeScript complaining later.
  void city;
  void servicePostcodes;

  useFixLeafletDefaultIcon();

  const center = useMemo<[number, number] | null>(() => {
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }, [lat, lng]);

  if (!center) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-line bg-brand-surface">
      <div style={{ height: `${height}px` }} className="w-full">
        <MapContainer
          center={center}
          zoom={11}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
          attributionControl
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Circle
            center={center}
            radius={radiusMeters}
            pathOptions={{
              color: accentColor,
              weight: 2,
              fillColor: accentColor,
              fillOpacity: 0.22
            }}
          />
          <Marker position={center} />
        </MapContainer>
      </div>
    </div>
  );
}

export default TradeAreaMap;
