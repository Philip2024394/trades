// UK postcode centroid lookup — coordinates for outward-codes (the
// first half of a UK postcode, e.g. "HU1", "M16", "EH7").
//
// Two-layer fallback:
//   1. Specific outward-code centroids for the most common UK areas
//      (Hull, Manchester, Birmingham, London inner, etc.) — most
//      accurate.
//   2. Postcode AREA-letter centroid (e.g. "M" → Manchester city
//      centre) — used when the specific outward code isn't in the
//      dataset. Less precise but good enough for zone-level matching.
//
// For ground-truth precision (e.g. M61 = a specific suburb, not
// Manchester city centre), expand the OUTWARD_CENTROIDS map. The
// area-letter fallback is the safety net that ensures every UK
// postcode gets SOMEWHERE on the map.

export type Latlng = { lat: number; lng: number };

// Two-letter postcode AREA centroids (cities/regions) — fallback when
// a specific outward code isn't in OUTWARD_CENTROIDS. Coordinates are
// approximate city centres or area centroids from public sources.
export const AREA_CENTROIDS: Record<string, Latlng> = {
  // London
  E: { lat: 51.5346, lng: -0.0258 },     // East London
  EC: { lat: 51.515, lng: -0.0928 },     // City of London
  N: { lat: 51.5544, lng: -0.105 },      // North London
  NW: { lat: 51.5547, lng: -0.1944 },    // North-West London
  SE: { lat: 51.4811, lng: -0.0142 },    // South-East London
  SW: { lat: 51.4612, lng: -0.1567 },    // South-West London
  W: { lat: 51.5121, lng: -0.2197 },     // West London
  WC: { lat: 51.5197, lng: -0.1244 },    // West Central London

  // Major English cities
  M: { lat: 53.4808, lng: -2.2426 },     // Manchester
  B: { lat: 52.4862, lng: -1.8904 },     // Birmingham
  L: { lat: 53.4084, lng: -2.9916 },     // Liverpool
  LS: { lat: 53.8008, lng: -1.5491 },    // Leeds
  S: { lat: 53.3811, lng: -1.4701 },     // Sheffield
  NE: { lat: 54.9783, lng: -1.6178 },    // Newcastle upon Tyne
  BS: { lat: 51.4545, lng: -2.5879 },    // Bristol
  CV: { lat: 52.4068, lng: -1.5197 },    // Coventry
  CB: { lat: 52.2053, lng: 0.1218 },     // Cambridge
  OX: { lat: 51.752, lng: -1.2577 },     // Oxford
  NG: { lat: 52.9548, lng: -1.1581 },    // Nottingham
  LE: { lat: 52.6369, lng: -1.1398 },    // Leicester
  ST: { lat: 53.0027, lng: -2.1794 },    // Stoke-on-Trent
  DE: { lat: 52.9225, lng: -1.4746 },    // Derby
  WV: { lat: 52.5872, lng: -2.1287 },    // Wolverhampton
  WS: { lat: 52.5862, lng: -1.9829 },    // Walsall
  DY: { lat: 52.5125, lng: -2.0807 },    // Dudley
  WR: { lat: 52.192, lng: -2.221 },      // Worcester
  HR: { lat: 52.0567, lng: -2.7156 },    // Hereford
  GL: { lat: 51.8643, lng: -2.2381 },    // Gloucester
  SN: { lat: 51.5557, lng: -1.7797 },    // Swindon
  BA: { lat: 51.3811, lng: -2.359 },     // Bath
  TA: { lat: 51.0156, lng: -3.1067 },    // Taunton
  EX: { lat: 50.7184, lng: -3.5339 },    // Exeter
  PL: { lat: 50.3755, lng: -4.1427 },    // Plymouth
  TR: { lat: 50.2632, lng: -5.0511 },    // Truro
  TQ: { lat: 50.4621, lng: -3.5253 },    // Torquay
  DT: { lat: 50.7156, lng: -2.4368 },    // Dorchester
  BH: { lat: 50.7192, lng: -1.8808 },    // Bournemouth
  SO: { lat: 50.9097, lng: -1.4044 },    // Southampton
  PO: { lat: 50.8198, lng: -1.0879 },    // Portsmouth
  GU: { lat: 51.2362, lng: -0.5704 },    // Guildford
  RG: { lat: 51.4543, lng: -0.9781 },    // Reading
  SL: { lat: 51.5074, lng: -0.5959 },    // Slough
  HP: { lat: 51.7521, lng: -0.7558 },    // Hemel Hempstead
  AL: { lat: 51.749, lng: -0.336 },      // St Albans
  WD: { lat: 51.656, lng: -0.396 },      // Watford
  EN: { lat: 51.6523, lng: -0.0807 },    // Enfield
  HA: { lat: 51.5793, lng: -0.342 },     // Harrow
  IG: { lat: 51.559, lng: 0.0719 },      // Ilford
  RM: { lat: 51.5732, lng: 0.1832 },     // Romford
  DA: { lat: 51.4413, lng: 0.2138 },     // Dartford
  BR: { lat: 51.4053, lng: 0.0142 },     // Bromley
  CR: { lat: 51.3762, lng: -0.0982 },    // Croydon
  KT: { lat: 51.4119, lng: -0.3 },       // Kingston upon Thames
  SM: { lat: 51.3618, lng: -0.1945 },    // Sutton
  TW: { lat: 51.4453, lng: -0.3265 },    // Twickenham
  UB: { lat: 51.5126, lng: -0.4789 },    // Uxbridge
  CM: { lat: 51.7356, lng: 0.4685 },     // Chelmsford
  SS: { lat: 51.5459, lng: 0.7077 },     // Southend-on-Sea
  CO: { lat: 51.8959, lng: 0.8919 },     // Colchester
  IP: { lat: 52.0567, lng: 1.1482 },     // Ipswich
  NR: { lat: 52.6309, lng: 1.2974 },     // Norwich
  PE: { lat: 52.5695, lng: -0.2405 },    // Peterborough
  LN: { lat: 53.2307, lng: -0.5406 },    // Lincoln
  DN: { lat: 53.5228, lng: -1.1285 },    // Doncaster
  HD: { lat: 53.645, lng: -1.7796 },     // Huddersfield
  HX: { lat: 53.7227, lng: -1.8579 },    // Halifax
  BD: { lat: 53.795, lng: -1.7594 },     // Bradford
  WF: { lat: 53.6833, lng: -1.4977 },    // Wakefield
  YO: { lat: 53.9582, lng: -1.0805 },    // York
  HU: { lat: 53.7457, lng: -0.3367 },    // Hull
  HG: { lat: 53.9925, lng: -1.5366 },    // Harrogate
  TS: { lat: 54.575, lng: -1.235 },      // Teesside
  DL: { lat: 54.5234, lng: -1.5594 },    // Darlington
  SR: { lat: 54.9069, lng: -1.3838 },    // Sunderland
  DH: { lat: 54.7773, lng: -1.5849 },    // Durham
  CA: { lat: 54.8924, lng: -2.9325 },    // Carlisle
  LA: { lat: 54.0466, lng: -2.8007 },    // Lancaster
  PR: { lat: 53.7632, lng: -2.7031 },    // Preston
  BB: { lat: 53.747, lng: -2.4814 },     // Blackburn
  BL: { lat: 53.5779, lng: -2.4321 },    // Bolton
  OL: { lat: 53.5409, lng: -2.1114 },    // Oldham
  SK: { lat: 53.4083, lng: -2.1494 },    // Stockport
  WA: { lat: 53.39, lng: -2.5878 },      // Warrington
  WN: { lat: 53.5448, lng: -2.6318 },    // Wigan
  CH: { lat: 53.1934, lng: -2.8931 },    // Chester
  CW: { lat: 53.069, lng: -2.5189 },     // Crewe
  TF: { lat: 52.6776, lng: -2.4459 },    // Telford
  SY: { lat: 52.7079, lng: -2.7541 },    // Shrewsbury
  LD: { lat: 52.244, lng: -3.4055 },     // Llandrindod Wells (Mid Wales)
  LL: { lat: 53.224, lng: -4.1971 },     // Llandudno / North Wales
  SA: { lat: 51.6214, lng: -3.9436 },    // Swansea
  CF: { lat: 51.4816, lng: -3.1791 },    // Cardiff
  NP: { lat: 51.5842, lng: -2.9977 },    // Newport (Wales)
  TN: { lat: 51.1295, lng: 0.2632 },     // Tunbridge Wells
  ME: { lat: 51.388, lng: 0.5419 },      // Medway
  CT: { lat: 51.2802, lng: 1.0789 },     // Canterbury
  BN: { lat: 50.8225, lng: -0.1372 },    // Brighton
  RH: { lat: 51.1138, lng: -0.187 },     // Redhill
  MK: { lat: 52.0406, lng: -0.7594 },    // Milton Keynes
  LU: { lat: 51.879, lng: -0.4167 },     // Luton
  NN: { lat: 52.2405, lng: -0.9027 },    // Northampton

  // Scotland
  EH: { lat: 55.9533, lng: -3.1883 },    // Edinburgh
  G: { lat: 55.8642, lng: -4.2518 },     // Glasgow
  PA: { lat: 55.8456, lng: -4.4239 },    // Paisley
  ML: { lat: 55.7773, lng: -3.9919 },    // Motherwell
  KA: { lat: 55.6117, lng: -4.6699 },    // Kilmarnock
  KY: { lat: 56.1165, lng: -3.1366 },    // Kirkcaldy
  FK: { lat: 56.0019, lng: -3.7839 },    // Falkirk
  AB: { lat: 57.1497, lng: -2.0943 },    // Aberdeen
  DD: { lat: 56.462, lng: -2.9707 },     // Dundee
  IV: { lat: 57.4778, lng: -4.224 },     // Inverness
  PH: { lat: 56.395, lng: -3.4308 },     // Perth
  TD: { lat: 55.6, lng: -2.6 },          // Galashiels (Scottish Borders)
  DG: { lat: 55.0709, lng: -3.6055 },    // Dumfries
  HS: { lat: 57.8743, lng: -7.0287 },    // Outer Hebrides
  ZE: { lat: 60.1546, lng: -1.1483 },    // Shetland
  KW: { lat: 58.4413, lng: -3.0931 },    // Kirkwall (Orkney + Caithness)

  // Northern Ireland
  BT: { lat: 54.5973, lng: -5.9301 },    // Belfast

  // Channel Islands
  GY: { lat: 49.4658, lng: -2.5853 },    // Guernsey
  JE: { lat: 49.2144, lng: -2.1313 },    // Jersey
  IM: { lat: 54.2361, lng: -4.5481 }     // Isle of Man
};

// Full UK outward-code centroid dataset — 2,856 entries covering every
// active UK postcode district from AB10 (Aberdeen) to ZE3 (Shetland).
// Sourced from the public domain Gibbs/uk-postcodes dataset and bundled
// as a static JSON (~100 KB raw, ~30 KB gzipped). Regenerate via
// scripts/build-uk-outcodes.mjs against an updated CSV.
//
// This replaces the previous 20-entry HU-only override — every UK
// merchant now gets pin-accurate zone-display dots, not a single
// area-letter fallback.
import { UK_OUTWARD_CODES } from "./ukOutwardCodesData";

export const OUTWARD_CENTROIDS: Record<string, Latlng> = UK_OUTWARD_CODES;

/** Back-compat alias — keep so existing callers still work. */
export const UK_POSTCODE_CENTROIDS: Record<string, Latlng> = OUTWARD_CENTROIDS;

export function haversineKm(a: Latlng, b: Latlng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Strip a postcode down to its outward-code prefix (the letters +
 *  digits before any inward space). */
function outwardCode(raw: string): string {
  const clean = raw.trim().toUpperCase().replace(/\s+/g, "");
  // Inward code is 3 chars at the end (e.g. "1AA"). If the input
  // contains a full postcode, slice off the last 3. Otherwise it's
  // already an outward.
  return clean.length > 4 ? clean.slice(0, clean.length - 3) : clean;
}

/** Extract the leading letters of an outward code (e.g. "EH7" → "EH"). */
function areaLetters(outward: string): string {
  const m = outward.match(/^([A-Z]+)/);
  return m ? m[1] : "";
}

/** Look up a postcode centroid. Tries the specific outward-code map
 *  first, then falls back to the area-letter centroid so every UK
 *  postcode lands SOMEWHERE on the map. */
export function centroidOf(rawCode: string): Latlng | null {
  const outward = outwardCode(rawCode);
  if (OUTWARD_CENTROIDS[outward]) return OUTWARD_CENTROIDS[outward];
  const area = areaLetters(outward);
  if (area && AREA_CENTROIDS[area]) return AREA_CENTROIDS[area];
  return null;
}

/** Distance from a yard to a postcode centroid, in km. */
export function distanceToPostcodeKm(
  yard: Latlng,
  rawCode: string
): number | null {
  const c = centroidOf(rawCode);
  if (!c) return null;
  return haversineKm(yard, c);
}

/** Find every UK postcode AREA whose centroid falls within `maxKm`
 *  of the yard. Returns area letters only (e.g. ["HU", "DN", "YO"])
 *  — for full outward-code precision, expand OUTWARD_CENTROIDS.
 *
 *  Used by the customer-side zone display so the merchant doesn't
 *  have to maintain a service_postcodes list — they just set their
 *  yard lat/lng + zone radii, and we discover everything within range. */
export function postcodesWithinRadius(
  yard: Latlng,
  maxKm: number
): string[] {
  const out: string[] = [];
  for (const [code, centroid] of Object.entries(OUTWARD_CENTROIDS)) {
    if (haversineKm(yard, centroid) <= maxKm) out.push(code);
  }
  // If no outward-code matches (rare), fall back to area-level centroids.
  if (out.length === 0) {
    for (const [area, centroid] of Object.entries(AREA_CENTROIDS)) {
      if (haversineKm(yard, centroid) <= maxKm) out.push(area);
    }
  }
  return out;
}
