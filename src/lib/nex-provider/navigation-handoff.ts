// src/lib/nex-provider/navigation-handoff.ts
//
// EXTERNAL NAVIGATION HANDOFF · pure URL composer.
//
// Doctrine anchors:
//   - Legal Boundary First (2026-08-23): NEX does not build turn-by-turn
//     navigation. NEX owns trip context + coordinates + evidence · the driver's
//     chosen navigation app handles routing.
//   - PDP compliance: NEX must not silently track the driver's chosen route
//     after handing off. Handoff carries an explicit disclaimer.
//   - Truth Invariant: valid coordinates only · invalid input rejected.
//
// This module produces deep-link URLs. Does NOT open the URL. Callers on the
// driver device open the URL themselves via their platform's URL scheme.

export type NavigationProvider = "google_maps" | "waze" | "apple_maps";

export interface NavigationHandoffInput {
  destinationLat: number;
  destinationLng: number;
  destinationLabel?: string | null;
  providers?: NavigationProvider[];   // default: google_maps + waze
}

export interface NavigationOption {
  provider: NavigationProvider;
  providerLabel: string;
  url: string;
}

export interface NavigationHandoffOK {
  status: "OK";
  options: NavigationOption[];
  disclaimer: string;
}

export interface NavigationHandoffRejected {
  status: "REJECTED";
  reason: "INVALID_LAT" | "INVALID_LNG";
  detail: string;
}

export type NavigationHandoffResult = NavigationHandoffOK | NavigationHandoffRejected;

const PROVIDER_LABEL: Record<NavigationProvider, string> = {
  google_maps: "Google Maps",
  waze: "Waze",
  apple_maps: "Apple Maps",
};

function coordValid(lat: number, lng: number): true | { key: "INVALID_LAT" | "INVALID_LNG"; detail: string } {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { key: "INVALID_LAT", detail: `lat=${lat}` };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { key: "INVALID_LNG", detail: `lng=${lng}` };
  return true;
}

function buildUrl(provider: NavigationProvider, lat: number, lng: number, label?: string | null): string {
  const l = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  switch (provider) {
    case "google_maps": {
      const url = new URL("https://www.google.com/maps/dir/");
      url.searchParams.set("api", "1");
      url.searchParams.set("destination", l);
      url.searchParams.set("travelmode", "driving");
      return url.toString();
    }
    case "waze":
      return `https://waze.com/ul?ll=${l}&navigate=yes`;
    case "apple_maps": {
      const url = new URL("https://maps.apple.com/");
      url.searchParams.set("daddr", l);
      if (label) url.searchParams.set("q", label);
      return url.toString();
    }
  }
}

export function composeNavigationHandoff(input: NavigationHandoffInput): NavigationHandoffResult {
  const valid = coordValid(input.destinationLat, input.destinationLng);
  if (valid !== true) {
    return { status: "REJECTED", reason: valid.key, detail: valid.detail };
  }

  const providers = input.providers && input.providers.length > 0
    ? input.providers
    : (["google_maps", "waze"] as NavigationProvider[]);

  const options: NavigationOption[] = providers.map((p) => ({
    provider: p,
    providerLabel: PROVIDER_LABEL[p],
    url: buildUrl(p, input.destinationLat, input.destinationLng, input.destinationLabel),
  }));

  return {
    status: "OK",
    options,
    disclaimer:
      "Turn-by-turn navigation is handled by the chosen third-party provider. NEX does not track the route the driver actually drives.",
  };
}
