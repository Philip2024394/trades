// Best-effort geocoding for Trade Off listings via OpenStreetMap Nominatim.
// We use the (free) public endpoint with the required User-Agent header.
// Always returns { lat, lng } | null — never throws into the caller. The
// create/update API routes call this and silently leave coords null if
// geocoding fails or returns nothing.

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "Hammerex Trade Off (hammerexdirect.com)";

export async function geocodeListing(input: {
  postcode_prefix: string | null;
  city: string;
  country: string;
}): Promise<{ lat: number; lng: number } | null> {
  const parts = [input.postcode_prefix, input.city, input.country]
    .map((x) => (x ?? "").toString().trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const q = parts.join(", ");

  const url = `${NOMINATIM}?${new URLSearchParams({
    q,
    format: "json",
    limit: "1"
  }).toString()}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      // Nominatim's TOS expects throttled use; we cache the response for
      // a day at the edge to be polite.
      next: { revalidate: 86400 }
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (!Array.isArray(body) || body.length === 0) return null;
    const first = body[0];
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch (err) {
    console.warn("[tradeOffGeocode] nominatim failed:", err);
    return null;
  }
}
