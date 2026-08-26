// src/lib/nex-driver/navigation-handoff.test.ts

import { describe, it, expect } from "vitest";
import { composeNavigationHandoff } from "./navigation-handoff";

const YIA = { lat: -7.9020, lng: 110.0524 };

describe("Navigation handoff · produces provider URLs for valid coordinates", () => {
  it("default providers = google_maps + waze", () => {
    const r = composeNavigationHandoff({ destinationLat: YIA.lat, destinationLng: YIA.lng });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.options.map((o) => o.provider)).toEqual(["google_maps", "waze"]);
    }
  });

  it("Google Maps URL uses api=1 + destination query with driving mode", () => {
    const r = composeNavigationHandoff({
      destinationLat: YIA.lat,
      destinationLng: YIA.lng,
      providers: ["google_maps"],
    });
    if (r.status === "OK") {
      const url = new URL(r.options[0].url);
      expect(url.hostname).toBe("www.google.com");
      expect(url.pathname).toContain("/maps/dir/");
      expect(url.searchParams.get("api")).toBe("1");
      expect(url.searchParams.get("destination")).toMatch(/^-7\.902000,110\.052400$/);
      expect(url.searchParams.get("travelmode")).toBe("driving");
    }
  });

  it("Waze URL encodes ll + navigate=yes", () => {
    const r = composeNavigationHandoff({
      destinationLat: YIA.lat,
      destinationLng: YIA.lng,
      providers: ["waze"],
    });
    if (r.status === "OK") {
      expect(r.options[0].url).toBe("https://waze.com/ul?ll=-7.902000,110.052400&navigate=yes");
    }
  });

  it("Apple Maps URL uses daddr + optional label", () => {
    const r = composeNavigationHandoff({
      destinationLat: YIA.lat,
      destinationLng: YIA.lng,
      destinationLabel: "Yogyakarta Airport",
      providers: ["apple_maps"],
    });
    if (r.status === "OK") {
      const url = new URL(r.options[0].url);
      expect(url.hostname).toBe("maps.apple.com");
      expect(url.searchParams.get("daddr")).toMatch(/^-7\.902000,110\.052400$/);
      expect(url.searchParams.get("q")).toBe("Yogyakarta Airport");
    }
  });

  it("always includes an explicit disclaimer about NEX not tracking driver route", () => {
    const r = composeNavigationHandoff({ destinationLat: YIA.lat, destinationLng: YIA.lng });
    if (r.status === "OK") {
      expect(r.disclaimer.toLowerCase()).toMatch(/does not track/);
      expect(r.disclaimer.toLowerCase()).toMatch(/third-party/);
    }
  });
});

describe("Navigation handoff · rejects invalid coordinates", () => {
  it("lat > 90 → REJECTED / INVALID_LAT", () => {
    const r = composeNavigationHandoff({ destinationLat: 95, destinationLng: 0 });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("INVALID_LAT");
  });

  it("lat < -90 → REJECTED / INVALID_LAT", () => {
    const r = composeNavigationHandoff({ destinationLat: -95, destinationLng: 0 });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("INVALID_LAT");
  });

  it("lng > 180 → REJECTED / INVALID_LNG", () => {
    const r = composeNavigationHandoff({ destinationLat: 0, destinationLng: 200 });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("INVALID_LNG");
  });

  it("NaN lat → REJECTED / INVALID_LAT", () => {
    const r = composeNavigationHandoff({ destinationLat: Number.NaN, destinationLng: 0 });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("INVALID_LAT");
  });

  it("Infinity lng → REJECTED / INVALID_LNG", () => {
    const r = composeNavigationHandoff({ destinationLat: 0, destinationLng: Number.POSITIVE_INFINITY });
    expect(r.status).toBe("REJECTED");
    if (r.status === "REJECTED") expect(r.reason).toBe("INVALID_LNG");
  });
});
