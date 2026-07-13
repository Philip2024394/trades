// Distance helpers — used by "Nearest to Me" sort on the marketplace
// category page and by the Trade Notebook's nearest-merchant matcher.
//
// We keep a small dictionary of UK city → coordinates so the fixture
// data (which uses `homeCity` strings) can be geo-resolved without
// pulling a full geocoder. In production this would be replaced by a
// server-side geocode + the merchant record storing its own lat/lng.

export type LatLng = { lat: number; lng: number };

const CITY_COORDS: Record<string, LatLng> = {
  Manchester: { lat: 53.4808, lng: -2.2426 },
  Leeds:      { lat: 53.8008, lng: -1.5491 },
  Glasgow:    { lat: 55.8642, lng: -4.2518 },
  Brighton:   { lat: 50.8225, lng: -0.1372 },
  London:     { lat: 51.5074, lng: -0.1278 },
  Birmingham: { lat: 52.4862, lng: -1.8904 },
  Liverpool:  { lat: 53.4084, lng: -2.9916 },
  Bristol:    { lat: 51.4545, lng: -2.5879 },
  Cardiff:    { lat: 51.4816, lng: -3.1791 },
  Edinburgh:  { lat: 55.9533, lng: -3.1883 },
  Newcastle:  { lat: 54.9783, lng: -1.6178 },
  Sheffield:  { lat: 53.3811, lng: -1.4701 }
};

export function cityToLatLng(city: string): LatLng | undefined {
  return CITY_COORDS[city];
}

/** Great-circle distance in statute miles (haversine). */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R_MI = 3958.7613;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function milesBetweenCities(a: string, b: string): number | undefined {
  const ac = cityToLatLng(a);
  const bc = cityToLatLng(b);
  if (!ac || !bc) return undefined;
  return haversineMiles(ac, bc);
}

export function formatMiles(miles: number): string {
  if (miles < 1) return "<1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
