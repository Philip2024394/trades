// Best-effort geo lookup for the phone-number country picker.
// Reads the ISO-2 country code from common edge / CDN headers in this
// order: Vercel → Cloudflare → fetch-header chain. Falls back to "GB"
// (Xrated's home market) so the picker always has a sensible default.
//
// No external API call — keeps the form fast and avoids leaking the
// signup IP to a third party.

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const h = req.headers;
  const country =
    h.get("x-vercel-ip-country") ||
    h.get("cf-ipcountry") ||
    h.get("x-country-code") ||
    "GB";
  // Vercel returns "XX" for unknown / VPN — normalise back to UK.
  const iso2 = /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : "GB";
  return NextResponse.json({ ok: true, iso2 });
}
