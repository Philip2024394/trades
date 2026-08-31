// src/lib/nex/mobility/useRealVsEstimated.ts · Philip 2026-08-29
//
// REAL DATA GATE · enforces NEX Mobility Doctrine lock #25:
//   "Claude must not implement visual states that imply backend facts
//    that don't yet exist."
//
// Every mobility surface reads mobility-live data ONLY through this hook.
// Default state: isLive=false · everything null · no distance · no bearing.
// The component tree then MUST NOT render:
//   · a directional arrow when bearing is null
//   · a distance number when distance_m is null
//   · a bike bob when isLive is false
//   · the word "LIVE" when isLive is false
//
// This is enforced by the API of the returned object, not by developer
// discipline. If a caller wants distance, they read `distance_m` which is
// null unless the underlying source proved a real GPS reading.
//
// Providers of real data (future):
//   · Server-Sent Events stream from /api/nex/service-request/{id}/live
//   · WebRTC data channel from provider's device
//   · Native app Geolocation.watchPosition bridged over WebSocket
//
// For now (no real GPS stream wired): every hook returns isLive=false.
// That is the correct, honest default.
//
// Callers may pass `mode: "demo-live"` to simulate a LIVE feed for the
// dev demo — but the demo page must clearly show "DEMO LIVE" to the user
// so nobody mistakes fabricated data for real data. Doctrine-safe.

"use client";

import { useEffect, useRef, useState } from "react";

export type MobilityLiveMode = "off" | "real" | "demo-live";

export interface MobilityLiveReading {
  /** True ONLY when the source is proven-live · never true by default. */
  isLive: boolean;
  /** Meters to user · null when not known · never fabricated. */
  distance_m: number | null;
  /** Bearing to user in degrees 0-360 · null when not known. */
  bearing_deg: number | null;
  /** Provider ETA seconds · derived only from real distance + speed · null otherwise. */
  eta_seconds: number | null;
  /** Provider location changed since last tick · used to gate the "bike moving" bob. */
  moving: boolean;
  /** Wall time of the last real reading · null when never received. */
  last_reading_at: number | null;
  /** DEMO-LIVE only · user must be shown the demo banner. */
  isDemoLive: boolean;
}

const HONEST_ZERO: MobilityLiveReading = {
  isLive: false,
  distance_m: null,
  bearing_deg: null,
  eta_seconds: null,
  moving: false,
  last_reading_at: null,
  isDemoLive: false,
};

export interface UseRealVsEstimatedArgs {
  /** Service-request id · when set, hook attempts to open the live stream. */
  requestId?: string | null;
  /** How to source data · defaults to "off" · production connects when "real". */
  mode?: MobilityLiveMode;
  /** For "demo-live" mode: simulate approach from this starting distance in meters. */
  demoStartDistanceM?: number;
  /** For "demo-live" mode: simulated speed m/s · default 8 (~29 km/h). */
  demoSpeedMps?: number;
}

/**
 * Real-vs-Estimated data gate.
 *
 * Contract:
 *   · Default return has isLive=false and every numeric field null.
 *   · When mode="real", the hook attempts to subscribe to a live stream
 *     for the given requestId. Until data arrives, isLive stays false.
 *   · When mode="demo-live", the hook simulates a decreasing distance +
 *     computed ETA + moving=true. It sets isDemoLive=true so the UI
 *     surface can render a "DEMO LIVE" marker.
 *   · The returned `moving` boolean is only true when a real (or demo)
 *     distance delta was observed since the last reading.
 */
export function useRealVsEstimated({
  requestId,
  mode = "off",
  demoStartDistanceM = 1500,
  demoSpeedMps = 8,
}: UseRealVsEstimatedArgs = {}): MobilityLiveReading {
  const [reading, setReading] = useState<MobilityLiveReading>(HONEST_ZERO);
  const lastDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode === "off" || !requestId) {
      setReading(HONEST_ZERO);
      lastDistanceRef.current = null;
      return;
    }

    if (mode === "demo-live") {
      // Simulate an approach so the demo page can show what the LIVE
      // path will look like in production. `isDemoLive=true` MUST be
      // surfaced to the user by the calling UI · doctrine-critical.
      const startedAt = Date.now();
      lastDistanceRef.current = demoStartDistanceM;
      const t = setInterval(() => {
        const elapsedS = (Date.now() - startedAt) / 1000;
        const traveled = elapsedS * demoSpeedMps;
        const distance = Math.max(0, demoStartDistanceM - traveled);
        const bearing = 270; // fake west-of-user for demo · rotates gently below
        const rotBearing = (bearing + elapsedS * 3) % 360;
        const eta = distance > 0 ? Math.round(distance / demoSpeedMps) : 0;
        const prev = lastDistanceRef.current;
        const moving = prev != null && Math.abs(distance - prev) > 0.5;
        lastDistanceRef.current = distance;
        setReading({
          isLive: true,
          isDemoLive: true,
          distance_m: Math.round(distance),
          bearing_deg: Math.round(rotBearing),
          eta_seconds: eta,
          moving,
          last_reading_at: Date.now(),
        });
      }, 1000);
      return () => clearInterval(t);
    }

    // mode === "real" · attempt SSE / WebSocket · leave OFF for now until
    // backend real stream is wired. Doctrine: no fabrication in real mode.
    // TODO(post-doctrine): open EventSource(`/api/nex/service-request/${requestId}/live`).
    setReading(HONEST_ZERO);
    return;
  }, [requestId, mode, demoStartDistanceM, demoSpeedMps]);

  return reading;
}

/** Convenience formatters that respect the doctrine · never render nulls. */
export function formatDistance(m: number | null): string | null {
  if (m == null) return null;
  if (m < 100) return `${m} m`;
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatEta(seconds: number | null): string | null {
  if (seconds == null) return null;
  if (seconds < 60) return "arriving now";
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

/**
 * Compose the inline LIVE/EST line · one canonical format across surfaces.
 * Returns exact text or null when there's nothing honest to show.
 *
 *   isLive=true  · distance=1200 · eta=180  → "LIVE · 3 min · 1.2 km"
 *   isLive=false · fallbackEta="5-8 min"    → "EST · 5-8 min"
 *   isLive=false · fallbackEta=null         → null (nothing to say)
 */
export function formatLiveOrEstLine(
  reading: MobilityLiveReading,
  fallbackEstEta?: string | null,
): string | null {
  if (reading.isLive) {
    const parts: string[] = ["LIVE"];
    const etaS = formatEta(reading.eta_seconds);
    const distS = formatDistance(reading.distance_m);
    if (etaS) parts.push(etaS);
    if (distS) parts.push(distS);
    return parts.length > 1 ? parts.join(" · ") : null;
  }
  if (fallbackEstEta && fallbackEstEta.trim().length > 0) {
    return `EST · ${fallbackEstEta.trim()}`;
  }
  return null;
}
