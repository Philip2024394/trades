// GET /api/hero-library?keywords=carpenter,site%20carpenter
//
// Server-side merchant-trade-keyword query. Uses supabaseLoader which
// falls back to the static JSON if Supabase is unavailable. This
// keeps the client-side app tiny (no library JSON shipped to browser
// once Supabase is populated).

import { NextResponse } from "next/server";
import { loadHeroLibraryForMerchant } from "@/lib/hero-swap/supabaseLoader";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kwParam = searchParams.get("keywords") ?? "";
  const keywords = kwParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (keywords.length === 0) {
    return NextResponse.json({ images: [] });
  }

  const images = await loadHeroLibraryForMerchant(keywords);
  return NextResponse.json({
    images,
    count: images.length,
    keywords
  });
}
