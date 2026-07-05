// postcodes.io client — free, no-auth UK postcode lookup.
//
// Docs: https://postcodes.io — Ordnance Survey Code-Point Open dataset,
// updated monthly, no rate limiting for reasonable web-app use.
//
// We use two endpoints:
//   /postcodes/{postcode}  — full postcode (e.g. "NR1 2AB")
//   /outcodes/{outcode}    — area only  (e.g. "NR1")
//
// Both return {longitude, latitude}. Falls back to outcode if the full
// postcode is invalid — better UX for merchants who only stored an
// outward code as their coverage centre.

export type PostcodePoint = {
  postcode: string;
  outcode: string;
  latitude: number;
  longitude: number;
  region?: string;
};

const POSTCODES_IO = "https://api.postcodes.io";

const OUTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?$/;
const FULL_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/;

function normalise(pc: string): string {
  return pc.replace(/\s+/g, "").toUpperCase();
}

export async function lookupPostcode(
  raw: string
): Promise<PostcodePoint | null> {
  const clean = normalise(raw);
  if (!clean) return null;

  // Full postcode
  if (FULL_RE.test(clean)) {
    try {
      const res = await fetch(
        `${POSTCODES_IO}/postcodes/${encodeURIComponent(clean)}`
      );
      if (res.ok) {
        const json = (await res.json()) as {
          result?: {
            postcode: string;
            outcode: string;
            latitude: number;
            longitude: number;
            region?: string;
          };
        };
        if (json.result) {
          return {
            postcode: json.result.postcode,
            outcode: json.result.outcode,
            latitude: json.result.latitude,
            longitude: json.result.longitude,
            region: json.result.region
          };
        }
      }
    } catch {
      // fall through
    }
  }

  // Outcode fallback (e.g. "NR1")
  const outcode = clean.slice(0, clean.length - 3) || clean;
  if (OUTCODE_RE.test(outcode)) {
    try {
      const res = await fetch(
        `${POSTCODES_IO}/outcodes/${encodeURIComponent(outcode)}`
      );
      if (res.ok) {
        const json = (await res.json()) as {
          result?: {
            outcode: string;
            latitude: number;
            longitude: number;
          };
        };
        if (json.result) {
          return {
            postcode: json.result.outcode,
            outcode: json.result.outcode,
            latitude: json.result.latitude,
            longitude: json.result.longitude
          };
        }
      }
    } catch {
      // fall through
    }
  }

  return null;
}
