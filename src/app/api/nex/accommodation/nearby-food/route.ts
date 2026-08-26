// src/app/api/nex/accommodation/nearby-food/route.ts
//
// PART B (2026-08-24) · Nearby-food lookup for the Accommodation Details slider.
//
// Given lat/lng · returns up to 6 real nex.food_business rows within ~3km
// using haversine · every distance is real · never fabricated.

import { NextResponse } from "next/server";
import { loadNearbyFood } from "@/lib/nex-accommodation/list-businesses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat + lng required" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "lat/lng out of range" }, { status: 400 });
  }
  try {
    const rows = await loadNearbyFood({ lat, lng, maxKm: 3, limit: 6 });
    return NextResponse.json({ rows });
  } catch (e) {
    console.error("nearby-food query failed:", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
