// src/app/nex-native/directory/_directory-results.tsx
//
// NEX Directory · Phase A · Results list client component.
//
// What this component is
//   · The one authoritative client-side wrapper around the Directory
//     result cards. Server fetches the data; this component manages:
//       (a) opt-in geolocation state (viewer's current {lat, lng})
//       (b) rendering of each card with optional distance
//   · Server-side rendering (SSR) still produces the full result
//     list; the geolocation layer is additive and honest about
//     consent (no automatic prompt).
//
// Why client-side
//   · `navigator.geolocation.getCurrentPosition` is a browser API
//     and requires explicit user interaction (per modern browser
//     permission policy). A dedicated opt-in button makes the
//     consent explicit; distance appears only after the user grants.
//
// Honest states
//   · Location unknown (default) → distance absent on every card
//   · Location granted           → distance appears on cards whose
//                                  canonical row has coordinates
//   · Location denied            → non-crashing fallback; no
//                                  distance; one-time inline note

"use client";

import type * as React from "react";
import { useCallback, useState } from "react";
import { DirectoryCard } from "./_directory-card";
import type {
  DirectoryCoordinates,
  DirectoryDestination,
  DirectoryListingVM,
} from "@/lib/nex-native/directory";

const PALETTE = {
  surface: "#0E1526",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  borderSoft: "rgba(255,255,255,0.06)",
  orange: "#FF7200",
} as const;

export interface DirectoryResultsProps {
  readonly results: ReadonlyArray<{
    readonly listing: DirectoryListingVM;
    readonly destination: DirectoryDestination;
  }>;
  /** Signals that at least one listing has non-null coordinates ·
   *  the geolocation opt-in button only shows if there's a reason
   *  to enable distance. Avoids UI clutter in zero-coord states. */
  readonly anyListingHasCoords: boolean;
}

type GeoState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "granted"; coords: DirectoryCoordinates }
  | { kind: "denied" }
  | { kind: "unsupported" };

export function DirectoryResults(props: DirectoryResultsProps): React.ReactElement {
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

  return (
    <section
      aria-label="Directory results"
      data-nex-directory-results
      data-nex-directory-geo-state={geo.kind}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {props.anyListingHasCoords ? (
        <DistanceOptIn geo={geo} onEnable={requestLocation} />
      ) : null}
      {props.results.map(({ listing, destination }) => (
        <DirectoryCard
          key={listing.canonicalBusinessId}
          listing={listing}
          destination={destination}
          userCoords={userCoords}
        />
      ))}
    </section>
  );
}

function DistanceOptIn(props: {
  readonly geo: GeoState;
  readonly onEnable: () => void;
}): React.ReactElement {
  const { geo } = props;
  if (geo.kind === "granted") {
    return (
      <div
        data-nex-directory-distance-chip="granted"
        style={{
          background: PALETTE.cyanFaint,
          border: `1px solid ${PALETTE.cyan}`,
          color: PALETTE.cyan,
          padding: "8px 14px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 600,
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <GeoCheckGlyph />
        Distance shown from your location
      </div>
    );
  }
  if (geo.kind === "denied") {
    return (
      <div
        data-nex-directory-distance-chip="denied"
        style={{
          background: PALETTE.surface,
          border: `1px solid ${PALETTE.borderSoft}`,
          color: PALETTE.textMuted,
          padding: "8px 14px",
          borderRadius: 999,
          fontSize: 13,
          alignSelf: "flex-start",
        }}
      >
        Distance unavailable · browser denied location access
      </div>
    );
  }
  if (geo.kind === "unsupported") {
    return (
      <div
        data-nex-directory-distance-chip="unsupported"
        style={{
          background: PALETTE.surface,
          border: `1px solid ${PALETTE.borderSoft}`,
          color: PALETTE.textMuted,
          padding: "8px 14px",
          borderRadius: 999,
          fontSize: 13,
          alignSelf: "flex-start",
        }}
      >
        Distance unavailable · this browser has no location API
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={props.onEnable}
      disabled={geo.kind === "pending"}
      data-nex-directory-distance-opt-in
      data-nex-directory-geo-opt-in-state={geo.kind}
      style={{
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.cyan}`,
        color: PALETTE.cyan,
        padding: "8px 14px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        cursor: geo.kind === "pending" ? "progress" : "pointer",
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <GeoPinGlyph />
      {geo.kind === "pending" ? "Requesting location…" : "Show distances from me"}
    </button>
  );
}

function GeoPinGlyph(): React.ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s-6-5.6-6-10a6 6 0 1 1 12 0c0 4.4-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  );
}

function GeoCheckGlyph(): React.ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
