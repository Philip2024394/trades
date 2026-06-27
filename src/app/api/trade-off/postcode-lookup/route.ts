// GET /api/trade-off/postcode-lookup?postcode=NN12+9XY
// Proxies postcodes.io (free, no key, UK only). Server-side 24h cache
// keeps us inside their fair-use bracket and absorbs repeat hits on
// the same postcode from the customer + dashboard.
//
// Response: { ok: true, lat, lng, town, country, postcode } |
//           { ok: false, error: "not_found" | "invalid" | "upstream" }

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
// 24h cache — postcode geometry doesn't change inside a day.
export const revalidate = 86_400;

const POSTCODE_RE = /^[A-Z0-9 ]{2,10}$/;

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = s(url.searchParams.get("postcode"))
    .toUpperCase()
    .replace(/\s+/g, " ");

  if (!raw || !POSTCODE_RE.test(raw)) {
    return NextResponse.json(
      { ok: false, error: "invalid" },
      { status: 400 }
    );
  }

  const encoded = encodeURIComponent(raw);
  const lookup = `https://api.postcodes.io/postcodes/${encoded}`;

  let res: Response;
  try {
    res = await fetch(lookup, {
      // Hit Next.js fetch cache for a full day.
      next: { revalidate: 86_400 }
    });
  } catch (err) {
    console.error("[postcode-lookup] fetch failed:", err);
    return NextResponse.json(
      { ok: false, error: "upstream" },
      { status: 502 }
    );
  }

  if (res.status === 404) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: "upstream" },
      { status: 502 }
    );
  }

  type PostcodesIoOk = {
    status: number;
    result?: {
      postcode?: string;
      latitude?: number;
      longitude?: number;
      admin_district?: string | null;
      admin_ward?: string | null;
      parish?: string | null;
      country?: string | null;
      region?: string | null;
    };
  };

  let body: PostcodesIoOk;
  try {
    body = (await res.json()) as PostcodesIoOk;
  } catch {
    return NextResponse.json(
      { ok: false, error: "upstream" },
      { status: 502 }
    );
  }

  const r = body.result;
  if (!r || typeof r.latitude !== "number" || typeof r.longitude !== "number") {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    postcode: r.postcode ?? raw,
    lat: r.latitude,
    lng: r.longitude,
    town: r.admin_district ?? r.parish ?? null,
    country: r.country ?? null
  });
}
