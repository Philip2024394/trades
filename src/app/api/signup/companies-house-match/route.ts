// GET /api/signup/companies-house-match?slug=<slug>
//
// Returns the top 3 Companies House matches for a proposed slug so the
// signup flow can offer a "we found your company — auto-verify?" step.
// Merchants who confirm a match get an automatic Verified badge and
// their public profile display name auto-fills from the CH record.
//
// Only fires for paid tiers (Canteen / Marketplace / Ultimate). Free
// tier doesn't get Verified anyway so we skip the CH lookup to avoid
// burning rate limits.
//
// Contract:
//   200 { matches: [{ companyName, companyNumber, status, address,
//                     dateOfCreation, similarity }, ...] }
//   200 { matches: [] }   ← no key, no matches, or below threshold

import { NextResponse } from "next/server";
import { searchCompanies, slugToQuery } from "@/lib/companiesHouse/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim().toLowerCase();
  if (slug.length < 3) {
    return NextResponse.json({ matches: [] });
  }

  const query = slugToQuery(slug);
  const matches = await searchCompanies(query, { limit: 3 });

  return NextResponse.json({ matches });
}
