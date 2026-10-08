// src/app/nex-native/directory/[id]/_detail-distance.tsx
//
// NEX Directory · Phase A · Detail-page distance chip.
//
// What this is
//   · The client sub-component that lets a visitor opt in to showing
//     distance from them to the one canonical listing on this page.
//     Mirrors the opt-in pattern of the list page's DistanceOptIn ·
//     the geolocation prompt is NEVER automatic.
//
// Honest states
//   · idle         → "Location Unconfirmed" + "Show distance from me" button
//   · pending      → "Requesting location…"
//   · granted + coords on listing → "<N.N km> away"
//   · granted + no coords on listing → "Location Unconfirmed"
//     (we have the viewer's location but not the business's · honest)
//   · denied       → "Location Unconfirmed" + a short, honest note
//   · unsupported  → "Location Unconfirmed" + a short, honest note
//
// What this is NOT
//   · Not a fabricator. If coords are missing on either side, the chip
//     label is the honest "Location Unconfirmed" status · not a
//     fabricated distance, not a city-centre fallback, not an IP guess.

"use client";

import type * as React from "react";
import { useCallback, useState } from "react";
import type { DirectoryCoordinates } from "@/lib/nex-native/directory";
import { formatKmDistance, haversineKmOrNull } from "../_distance";

const PALETTE = {
  surface: "#0E1526",
  surfaceHi: "#182540",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  borderSoft: "rgba(255,255,255,0.06)",
} as const;

type GeoState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "granted"; coords: DirectoryCoordinates }
  | { kind: "denied" }
  | { kind: "unsupported" };

export interface DetailDistanceChipProps {
  readonly listingCoords: DirectoryCoordinates | null;
}

export function DetailDistanceChip(
  props: DetailDistanceChipProps,
): React.ReactElement {
  const { listingCoords } = props;
  const [geo, setGeo] = useState<GeoState>({ kind: "idle" });

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ kind: "unsupported" });
      return;
    }
    setGeo({ kind: "pending" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          kind: "granted",
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
        });
      },
      () => {
        setGeo({ kind: "denied" });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  const userCoords = geo.kind === "granted" ? geo.coords : null;
  const distanceKm = haversineKmOrNull(userCoords, listingCoords);
  const distanceLabel =
    distanceKm === null ? null : formatKmDistance(distanceKm);
  const chipKind: "known" | "unconfirmed" =
    distanceLabel !== null ? "known" : "unconfirmed";

  return (
    <div
      data-nex-directory-detail-distance
      data-nex-directory-detail-distance-kind={chipKind}
      data-nex-directory-detail-distance-geo-state={geo.kind}
      style={{
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <span
        aria-label={
          chipKind === "known"
            ? `${distanceLabel} away`
            : "Distance from you is unavailable because location has not been shared or this listing has no coordinates"
        }
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: chipKind === "known" ? PALETTE.cyan : PALETTE.textSoft,
          padding: "6px 12px",
          borderRadius: 999,
          border: `1px solid ${chipKind === "known" ? PALETTE.cyan : PALETTE.borderSoft}`,
          background:
            chipKind === "known" ? PALETTE.cyanFaint : "transparent",
        }}
      >
        {chipKind === "known"
          ? `${distanceLabel} away`
          : "Location Unconfirmed"}
      </span>
      {geo.kind === "idle" ? (
        <button
          type="button"
          onClick={requestLocation}
          data-nex-directory-detail-distance-opt-in
          style={{
            background: "transparent",
            border: `1px solid ${PALETTE.cyan}`,
            color: PALETTE.cyan,
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Show distance from me
        </button>
      ) : null}
      {geo.kind === "pending" ? (
        <span
          style={{
            fontSize: 12.5,
            color: PALETTE.textMuted,
          }}
        >
          Requesting location…
        </span>
      ) : null}
      {geo.kind === "denied" ? (
        <span
          style={{
            fontSize: 12.5,
            color: PALETTE.textMuted,
          }}
        >
          Browser denied location access
        </span>
      ) : null}
      {geo.kind === "unsupported" ? (
        <span
          style={{
            fontSize: 12.5,
            color: PALETTE.textMuted,
          }}
        >
          This browser has no location API
        </span>
      ) : null}
    </div>
  );
}
