"use client";

// DistanceBadge — top-left pill on the PDP gallery showing the buyer's
// distance to the tradesperson's listing in kilometres. UK Xrated Trades
// is a km-first platform.
//
// Behaviour:
//   1. On mount, read `xrated_geo` from localStorage. If the cache is
//      <24h old, use it immediately — no geolocation prompt.
//   2. Otherwise call navigator.geolocation.getCurrentPosition with a
//      10s timeout + low accuracy (cheaper, no GPS warm-up). On success
//      cache + display.
//   3. On denied / error / no geolocation API, fall back to "📍 {city}".
//   4. If listing has no lat/lng, render "📍 {city}" without prompting.
//
// Visual: small black/70 + backdrop-blur pill, 13px white bold copy with
// a 50% opacity loading state while we wait for the API.

import { useEffect, useState } from "react";

type Props = {
  listingLat: number | null;
  listingLng: number | null;
  city: string;
};

type CachedGeo = {
  lat: number;
  lng: number;
  ts: number;
};

const STORAGE_KEY = "xrated_geo";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatKm(km: number): string {
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

function readCache(): CachedGeo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedGeo;
    if (
      typeof parsed.lat !== "number" ||
      typeof parsed.lng !== "number" ||
      typeof parsed.ts !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lng: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lat, lng, ts: Date.now() })
    );
  } catch {
    // Storage may be disabled (private mode / quota); silent fail.
  }
}

export function DistanceBadge({ listingLat, listingLng, city }: Props) {
  const hasListingGeo =
    typeof listingLat === "number" && typeof listingLng === "number";
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "distance"; km: number }
    | { phase: "city" }
  >(() => (hasListingGeo ? { phase: "loading" } : { phase: "city" }));

  useEffect(() => {
    if (!hasListingGeo) {
      setState({ phase: "city" });
      return;
    }
    const cached = readCache();
    if (cached) {
      const km = haversineKm(
        cached.lat,
        cached.lng,
        listingLat as number,
        listingLng as number
      );
      setState({ phase: "distance", km });
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !("geolocation" in navigator)
    ) {
      setState({ phase: "city" });
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const { latitude, longitude } = pos.coords;
        writeCache(latitude, longitude);
        const km = haversineKm(
          latitude,
          longitude,
          listingLat as number,
          listingLng as number
        );
        setState({ phase: "distance", km });
      },
      () => {
        if (cancelled) return;
        setState({ phase: "city" });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 }
    );
    return () => {
      cancelled = true;
    };
  }, [hasListingGeo, listingLat, listingLng]);

  const label =
    state.phase === "distance"
      ? formatKm(state.km)
      : state.phase === "loading"
      ? city
      : city;

  return (
    <div
      className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[13px] font-bold text-white backdrop-blur"
      style={{
        opacity: state.phase === "loading" ? 0.5 : 1,
        transition: "opacity 200ms ease"
      }}
      aria-live="polite"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      {label}
    </div>
  );
}

export default DistanceBadge;
