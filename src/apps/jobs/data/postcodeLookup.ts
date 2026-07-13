// Mock UK postcode lookup for fixture-mode demo.
//
// In production this hits GetAddress.io / Loqate / Ideal Postcodes /
// Ordnance Survey Places. For the demo, hard-coded fixtures for a few
// UK postcodes cover the common test cases.
//
// Real API contract (GetAddress.io style):
//   GET https://api.getAddress.io/find/{postcode}?api-key=XXX
//   → { addresses: string[] }

export type PostcodeAddress = {
  buildingLabel: string;       // "47 Elm Street" or "Flat 1, 51 Elm Street"
  street: string;
  town: string;
  postcode: string;
  latLng?: { lat: number; lng: number };
};

const FIXTURE_LOOKUP: Record<string, PostcodeAddress[]> = {
  "M202AB": [
    { buildingLabel: "47 Elm Street",           street: "Elm Street",   town: "Withington, Manchester", postcode: "M20 2AB", latLng: { lat: 53.4340, lng: -2.2410 } },
    { buildingLabel: "49 Elm Street",           street: "Elm Street",   town: "Withington, Manchester", postcode: "M20 2AB", latLng: { lat: 53.4341, lng: -2.2411 } },
    { buildingLabel: "Flat 1, 51 Elm Street",   street: "Elm Street",   town: "Withington, Manchester", postcode: "M20 2AB", latLng: { lat: 53.4342, lng: -2.2412 } },
    { buildingLabel: "Flat 2, 51 Elm Street",   street: "Elm Street",   town: "Withington, Manchester", postcode: "M20 2AB", latLng: { lat: 53.4342, lng: -2.2412 } },
    { buildingLabel: "The Oaks, Elm Grove",     street: "Elm Grove",    town: "Withington, Manchester", postcode: "M20 2AB", latLng: { lat: 53.4344, lng: -2.2415 } }
  ],
  "LS113PN": [
    { buildingLabel: "8 Beeston Road",          street: "Beeston Road", town: "Beeston, Leeds",         postcode: "LS11 3PN", latLng: { lat: 53.7715, lng: -1.5610 } },
    { buildingLabel: "10 Beeston Road",         street: "Beeston Road", town: "Beeston, Leeds",         postcode: "LS11 3PN", latLng: { lat: 53.7716, lng: -1.5611 } },
    { buildingLabel: "12 Beeston Road",         street: "Beeston Road", town: "Beeston, Leeds",         postcode: "LS11 3PN", latLng: { lat: 53.7717, lng: -1.5612 } }
  ],
  "M212TB": [
    { buildingLabel: "Parkside Cafe, 3 High Ln", street: "High Lane",   town: "Chorlton, Manchester",   postcode: "M21 2TB", latLng: { lat: 53.4450, lng: -2.2740 } },
    { buildingLabel: "1 High Lane",              street: "High Lane",   town: "Chorlton, Manchester",   postcode: "M21 2TB", latLng: { lat: 53.4451, lng: -2.2741 } }
  ]
};

/**
 * Normalise a postcode string (strip whitespace, uppercase) — matches
 * both `M20 2AB` and `m202ab` to the same key.
 */
function normalisePostcode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/** UK postcode regex (loose form — accepts standard formats). */
export const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function isValidUkPostcode(input: string): boolean {
  return UK_POSTCODE_REGEX.test(input.trim());
}

/**
 * Simulate an API lookup. Real API is async, so return a promise even
 * though the fixture is synchronous — makes the swap-in trivial.
 */
export async function lookupPostcode(input: string): Promise<PostcodeAddress[]> {
  await new Promise((r) => setTimeout(r, 320)); // simulate network
  const key = normalisePostcode(input);
  return FIXTURE_LOOKUP[key] ?? [];
}
