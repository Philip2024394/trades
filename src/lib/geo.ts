// Geo helpers for /api/trade-off/track-view. Reads ISO country + city
// from cookies set by middleware or live request headers
// (Vercel `x-vercel-ip-country`, Cloudflare `cf-ipcountry`).

export const HX_COUNTRY_COOKIE = "hx_country";
export const HX_CITY_COOKIE = "hx_city";

export function getCountryFromRequest(
  headers: Headers,
  cookies: { get(name: string): { value: string } | undefined }
): string | null {
  const cookied = cookies.get(HX_COUNTRY_COOKIE)?.value;
  if (cookied) return cookied.toUpperCase();
  const fromVercel = headers.get("x-vercel-ip-country");
  if (fromVercel) return fromVercel.toUpperCase();
  const fromCloudflare = headers.get("cf-ipcountry");
  if (fromCloudflare) return fromCloudflare.toUpperCase();
  return null;
}

function decode(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getCityFromRequest(
  headers: Headers,
  cookies: { get(name: string): { value: string } | undefined }
): string | null {
  const cookied = cookies.get(HX_CITY_COOKIE)?.value;
  if (cookied) return cookied;
  return decode(headers.get("x-vercel-ip-city") || headers.get("cf-ipcity"));
}
