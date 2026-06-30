"use client";

// OpenStreetMap-based service-area map for a Trade Off profile.
// Renders the tradie's yard at lat/lng with:
//   - Up to 3 colour-coded concentric circles for delivery zones
//     (green = Zone 1 inner, yellow = Zone 2 mid, red = Zone 3 outer)
//   - A small coloured CircleMarker per service-postcode at its
//     outward-code centroid, label-tooltipped permanently so the
//     postcodes read at a glance ON the map (no separate chip list).
//
// Falls back to a single-circle render when `zones` isn't passed —
// preserves the existing `radiusMeters` API for callers that haven't
// been migrated to the zones model.

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  centroidOf,
  distanceToPostcodeKm,
  haversineKm,
  postcodesWithinRadius
} from "@/lib/ukPostcodeCentroids";

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
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
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

export type DeliveryZone = {
  /** 1 / 2 / 3 — drives colour + label. */
  idx: 1 | 2 | 3;
  /** Outer radius of the zone in km from the yard. */
  km: number;
  /** Optional price label rendered in the tooltip (e.g. "FREE" or "£15"). */
  priceLabel?: string;
};

const ZONE_COLORS: Record<1 | 2 | 3, string> = {
  1: "#10B981", // green — inner / free
  2: "#FFB300", // yellow — mid
  3: "#EF4444"  // red — outer
};

function assignZone(distKm: number, zones: DeliveryZone[]): DeliveryZone | null {
  for (const z of zones) {
    if (distKm <= z.km) return z;
  }
  return null;
}

export function TradeAreaMap({
  lat,
  lng,
  city,
  servicePostcodes,
  zones,
  merchantName,
  enableLocationPicker = true,
  accentColor = "#FFD400",
  radiusMeters = 5000,
  height = 260
}: {
  lat: number | null;
  lng: number | null;
  city: string;
  servicePostcodes: string[];
  /** Up to 3 delivery zones. When provided, replaces the single
   *  accent-circle render with 3 colour-coded concentric circles +
   *  postcode markers coloured by zone. */
  zones?: DeliveryZone[];
  /** Merchant display name. When provided + zones are configured,
   *  renders a "{name} delivery zones" header above the toggle row. */
  merchantName?: string;
  /** When true (default) + zones set, renders the location-picker
   *  panel beneath the zone buttons so customers can self-qualify. */
  enableLocationPicker?: boolean;
  /** Legacy single-circle fallback colour. Only used when `zones` is
   *  omitted. */
  accentColor?: string;
  /** Legacy single-circle radius. Only used when `zones` is omitted. */
  radiusMeters?: number;
  height?: number;
}) {
  void city;

  useFixLeafletDefaultIcon();

  const center = useMemo<[number, number] | null>(() => {
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }, [lat, lng]);

  // Pre-compute postcode → zone assignments for marker rendering.
  //
  // Two-source strategy:
  //   1. Auto-discovery — every UK outward code within the outer
  //      zone radius is pulled from postcodesWithinRadius() so the
  //      merchant doesn't have to maintain a service_postcodes list.
  //   2. Plus any explicit `service_postcodes` the merchant has
  //      declared (legacy fallback; deduped against the auto-list).
  type PCEntry = {
    code: string;
    lat: number;
    lng: number;
    zone: DeliveryZone | null;
  };
  const postcodeEntries = useMemo<PCEntry[]>(() => {
    if (!center || !zones || zones.length === 0) return [];
    const sortedZones = [...zones].sort((a, b) => a.km - b.km);
    const maxKm = Math.max(...zones.map((z) => z.km));
    const yardLatLng = { lat: center[0], lng: center[1] };

    const seen = new Set<string>();
    const out: PCEntry[] = [];

    // 1. Auto-discovered codes within the outer zone radius.
    for (const code of postcodesWithinRadius(yardLatLng, maxKm)) {
      if (seen.has(code)) continue;
      const c = centroidOf(code);
      if (!c) continue;
      const dist = haversineKm(yardLatLng, c);
      seen.add(code);
      out.push({ code, lat: c.lat, lng: c.lng, zone: assignZone(dist, sortedZones) });
    }

    // 2. Any explicit merchant-declared codes (legacy fallback) that
    //    didn't already get included by auto-discovery.
    for (const raw of servicePostcodes) {
      const c = centroidOf(raw);
      if (!c) continue;
      const clean = raw.trim().toUpperCase().replace(/\s+/g, "");
      if (seen.has(clean)) continue;
      const dist = distanceToPostcodeKm(yardLatLng, raw);
      if (dist === null) continue;
      seen.add(clean);
      out.push({ code: clean, lat: c.lat, lng: c.lng, zone: assignZone(dist, sortedZones) });
    }

    return out;
  }, [center, servicePostcodes, zones]);

  // Auto-fit zoom for zoned mode so all 3 rings + markers are visible.
  const zoom = useMemo(() => {
    if (!zones || zones.length === 0) return 11;
    const maxKm = Math.max(...zones.map((z) => z.km));
    if (maxKm >= 30) return 10;
    if (maxKm >= 20) return 11;
    if (maxKm >= 10) return 12;
    return 13;
  }, [zones]);

  // Zone visibility — all three zones visible by default. Customer
  // can toggle any combination on/off via the buttons under the map
  // to isolate a single zone's rings + postcode markers at a time.
  const [zoneVisible, setZoneVisible] = useState<Record<1 | 2 | 3, boolean>>({
    1: true,
    2: true,
    3: true
  });

  // Customer self-locator state — geolocation OR postcode lookup feeds
  // a single { lat, lng, label } object. When set, we add a blue pin
  // to the map + auto-narrow the visible zones to just the matched one.
  const [customer, setCustomer] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [postcode, setPostcode] = useState("");
  const [picking, setPicking] = useState<"geo" | "postcode" | null>(null);
  const [pickErr, setPickErr] = useState<string | null>(null);

  // Distance from yard to customer (when set) + matched zone.
  const customerDistanceKm = useMemo<number | null>(() => {
    if (!customer || !center) return null;
    return haversineKm(
      { lat: center[0], lng: center[1] },
      { lat: customer.lat, lng: customer.lng }
    );
  }, [customer, center]);

  const customerZone = useMemo<DeliveryZone | null>(() => {
    if (customerDistanceKm === null || !zones || zones.length === 0) return null;
    const sorted = [...zones].sort((a, b) => a.km - b.km);
    return assignZone(customerDistanceKm, sorted);
  }, [customerDistanceKm, zones]);

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPickErr("Geolocation isn't available in this browser.");
      return;
    }
    setPicking("geo");
    setPickErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomer({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Your location"
        });
        setPicking(null);
      },
      () => {
        setPickErr("Couldn't read your location — enter your postcode instead.");
        setPicking(null);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  function checkPostcode() {
    const clean = postcode.trim().toUpperCase().replace(/\s+/g, "");
    if (!clean) {
      setPickErr("Type a postcode first.");
      return;
    }
    // Try matching the full string against our centroid lookup; if no
    // hit, fall back to just the outward code (the letters + first
    // digits, before any inward space/digit pair).
    const c = centroidOf(clean) ?? centroidOf(clean.slice(0, -3));
    if (!c) {
      setPickErr(
        `We don't recognise that postcode in our lookup. Try the outward code (e.g. HU5).`
      );
      return;
    }
    setCustomer({ lat: c.lat, lng: c.lng, label: clean });
    setPickErr(null);
  }

  function clearCustomer() {
    setCustomer(null);
    setPickErr(null);
    setPostcode("");
  }

  if (!center) return null;

  const hasZones = Array.isArray(zones) && zones.length > 0;
  const sortedZones = hasZones
    ? [...(zones as DeliveryZone[])].sort((a, b) => b.km - a.km) // outer → inner so inner draws on top
    : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-line bg-brand-surface">
      <div style={{ height: `${height}px` }} className="w-full">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
          attributionControl
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {hasZones ? (
            <>
              {sortedZones
                .filter((z) => zoneVisible[z.idx])
                .map((z) => {
                  const color = ZONE_COLORS[z.idx];
                  const isInner = z.idx === 1;
                  return (
                    <Circle
                      key={`zone-${z.idx}`}
                      center={center}
                      radius={z.km * 1000}
                      pathOptions={{
                        color,
                        weight: isInner ? 3 : 2,
                        fillColor: color,
                        fillOpacity: isInner ? 0.18 : 0.08,
                        dashArray: isInner ? undefined : "6 6"
                      }}
                    />
                  );
                })}
              {postcodeEntries
                .filter((p) => !p.zone || zoneVisible[p.zone.idx])
                .map((p) => {
                  const color = p.zone ? ZONE_COLORS[p.zone.idx] : "#737373";
                  const zoneLabel = p.zone
                    ? `Zone ${p.zone.idx}${
                        p.zone.priceLabel ? ` — ${p.zone.priceLabel}` : ""
                      }`
                    : "Out of zone";
                  return (
                    <CircleMarker
                      key={`pc-${p.code}`}
                      center={[p.lat, p.lng]}
                      radius={6}
                      pathOptions={{
                        color: "#0A0A0A",
                        weight: 1,
                        fillColor: color,
                        fillOpacity: 1
                      }}
                    >
                      <Tooltip
                        permanent
                        direction="top"
                        offset={[0, -6]}
                        opacity={0.95}
                        className="!rounded-md !border-0 !bg-neutral-900 !px-1.5 !py-0.5 !text-[11px] !font-extrabold !text-white !shadow"
                      >
                        <span className="block">
                          {p.code}
                        </span>
                        <span className="block text-[10px] font-bold opacity-80">
                          {zoneLabel}
                        </span>
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
            </>
          ) : (
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
          )}

          <Marker position={center} />

          {customer && (
            <CircleMarker
              center={[customer.lat, customer.lng]}
              radius={9}
              pathOptions={{
                color: "#0A0A0A",
                weight: 2,
                fillColor: "#3B82F6",
                fillOpacity: 1
              }}
            >
              <Tooltip
                permanent
                direction="top"
                offset={[0, -8]}
                opacity={0.95}
                className="!rounded-md !border-0 !bg-blue-600 !px-1.5 !py-0.5 !text-[11px] !font-extrabold !text-white !shadow"
              >
                <span className="block">{customer.label}</span>
              </Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
      </div>

      {hasZones && (() => {
        // Render only buttons for zones the merchant has actually
        // configured — gracefully handles 1, 2, or 3-zone setups.
        const configured = [1, 2, 3]
          .map((i) => sortedZones.find((zz) => zz.idx === i))
          .filter((z): z is DeliveryZone => Boolean(z));
        if (configured.length === 0) return null;
        // Grid columns adapt to zone count: 1 = single block, 2 = two
        // wide, 3 = standard three-up.
        const gridCols =
          configured.length === 1
            ? "grid-cols-1"
            : configured.length === 2
              ? "grid-cols-2"
              : "grid-cols-3";
        const subLabels = ["Inner", "Mid", "Outer"];
        const multiZoneCopy =
          "Tap a zone to hide it. Mix and match to see exactly which postcodes sit in each delivery zone — and what each one costs.";
        const singleZoneCopy =
          "This merchant runs a single delivery zone. Tap the button to hide or show its area on the map.";
        return (
          <div className="border-t border-neutral-200 bg-white p-3">
            {merchantName && (
              <p className="mb-1 text-[13px] font-extrabold text-neutral-900 sm:text-base">
                {merchantName} delivery zones
              </p>
            )}
            <p className="mb-2.5 text-[11px] leading-snug text-neutral-600 sm:text-[13px]">
              {configured.length === 1 ? singleZoneCopy : multiZoneCopy}
            </p>
            <div className={`grid gap-2 ${gridCols}`}>
              {configured.map((z) => {
                const color = ZONE_COLORS[z.idx];
                const isOn = zoneVisible[z.idx];
                const isCustomerZone = customerZone?.idx === z.idx;
                return (
                  <button
                    key={`btn-${z.idx}`}
                    type="button"
                    onClick={() =>
                      setZoneVisible((v) => ({ ...v, [z.idx]: !v[z.idx] }))
                    }
                    className={`flex flex-col items-start gap-0.5 rounded-lg border-2 px-3 py-2 text-left transition ${
                      isOn ? "bg-white shadow-sm" : "bg-neutral-100"
                    } ${isCustomerZone ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
                    style={{
                      borderColor: isOn ? color : "rgb(229 229 229)",
                      opacity: isOn ? 1 : 0.55
                    }}
                    aria-pressed={isOn}
                    aria-label={`${isOn ? "Hide" : "Show"} Zone ${z.idx} on the map`}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-neutral-900">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: color }}
                      />
                      Zone {z.idx}
                      {configured.length > 1 && (
                        <span className="text-[11px] font-bold text-neutral-500">
                          · {subLabels[z.idx - 1]}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-neutral-600">
                      Up to {z.km}km {z.priceLabel ? `· ${z.priceLabel}` : ""}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-500">
                      {isOn ? "On" : "Off"}
                      {isCustomerZone && (
                        <span className="ml-1 text-blue-600">· You</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {enableLocationPicker && (
              <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
                  Where are you delivering to?
                </p>
                {!customer ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={useMyLocation}
                      disabled={picking !== null}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ background: "#FFB300" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 2v3" />
                        <path d="M12 19v3" />
                        <path d="M2 12h3" />
                        <path d="M19 12h3" />
                        <circle cx="12" cy="12" r="6" />
                        <circle cx="12" cy="12" r="2" fill="currentColor" />
                      </svg>
                      {picking === "geo" ? "Reading…" : "Use my location"}
                    </button>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={postcode}
                        maxLength={12}
                        onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                        placeholder="Or enter postcode (HU5)"
                        className="block h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-bold uppercase tracking-widest text-neutral-900 outline-none focus:border-[#FFB300]"
                      />
                      <button
                        type="button"
                        onClick={checkPostcode}
                        className="inline-flex h-10 shrink-0 items-center rounded-lg px-3 text-[13px] font-extrabold text-neutral-900 transition active:scale-[0.98]"
                        style={{ background: "#FFB300" }}
                      >
                        Check
                      </button>
                    </div>
                    {pickErr && (
                      <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700">
                        {pickErr}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {customerZone ? (
                      <div
                        className="rounded-md border-2 p-2.5"
                        style={{
                          borderColor: ZONE_COLORS[customerZone.idx],
                          background: `${ZONE_COLORS[customerZone.idx]}11`
                        }}
                      >
                        <p
                          className="flex items-center gap-1.5 text-[13px] font-extrabold"
                          style={{ color: ZONE_COLORS[customerZone.idx] }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          Yes &mdash; you&rsquo;re in the{" "}
                          {customerZone.idx === 1
                            ? "GREEN"
                            : customerZone.idx === 2
                              ? "YELLOW"
                              : "RED"}{" "}
                          zone (Zone {customerZone.idx})
                        </p>
                        <p className="mt-1 text-[13px] font-bold text-neutral-900">
                          {customerZone.priceLabel
                            ? `${customerZone.priceLabel} delivery`
                            : `Up to ${customerZone.km}km from yard`}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-600">
                          {customer.label} ·{" "}
                          {customerDistanceKm?.toFixed(1) ?? "?"}km from yard
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-md border-2 border-orange-300 bg-orange-50 p-2.5">
                        <p className="text-[13px] font-extrabold text-orange-900">
                          Outside our delivery zones
                        </p>
                        <p className="mt-0.5 text-[11px] text-orange-800">
                          {customer.label} ·{" "}
                          {customerDistanceKm?.toFixed(1) ?? "?"}km from yard.
                          Message us for a custom quote.
                        </p>
                      </div>
                    )}
                    <p className="text-[10px] text-neutral-500">
                      Final delivery price confirmed at checkout based on
                      your full postcode.{" "}
                      <button
                        type="button"
                        onClick={clearCustomer}
                        className="font-bold text-neutral-700 underline-offset-2 hover:underline"
                      >
                        Change location
                      </button>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default TradeAreaMap;
