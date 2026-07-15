// GET /api/inspiration/browse?q=&seed=&offset=&limit=
//
// Powers the Site Interest endless scroll on /trade-off/search.
// Two modes based on whether a query is present:
//
//   • q present  → progressive broadening. Full-query matches
//                  first, then drop the last token, then the next,
//                  down to a single token. `offset` walks through
//                  the combined list so "loft ladder fit" flows
//                  into "loft ladder" → "ladder" → "loft" as the
//                  user keeps scrolling.
//
//   • q missing  → shuffled browse-all. `seed` picks the shuffle
//                  order (client picks a seed on first paint so
//                  every page-load feels fresh), `offset` walks
//                  through the shuffled window.
//
// Approved submissions are unioned in for both modes so trade-
// uploaded images flow into the same stream.

import { NextResponse } from "next/server";
import { heroesBrowseAll, heroesForQueryPaged } from "@/lib/heroLibrary";
import { approvedSubmissionsForQuery } from "@/lib/imageSubmissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query  = (url.searchParams.get("q") ?? "").trim();
  const seed   = Number(url.searchParams.get("seed") ?? "1");
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
  const limit  = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit") ?? "24")));

  const source = query
    ? heroesForQueryPaged(query, offset, limit)
    : heroesBrowseAll(Number.isFinite(seed) ? seed : 1, offset, limit);

  // On the first page (offset 0) with a query, also fold in any
  // approved trade submissions. On subsequent pages we skip them
  // because the submissions set is small — no point paging.
  let submissions: Array<{
    imageUrl:           string;
    subject:            string;
    keywords:           string[];
    submitterSlug:      string | null;
    submitterDisplay:   string | null;
    submitterAvatarUrl: string | null;
    sourceCanteenId:    string | null;
    sourcePostId:       string | null;
  }> = [];
  if (query && offset === 0) {
    const rows = await approvedSubmissionsForQuery(query, 20);
    submissions = rows.map((r) => ({
      imageUrl:           r.imageUrl,
      subject:            r.altText ?? r.keywords.join(", "),
      keywords:           r.keywords,
      submitterSlug:      r.submitterSlug,
      submitterDisplay:   r.submitterDisplay,
      submitterAvatarUrl: r.submitterAvatarUrl,
      sourceCanteenId:    r.sourceCanteenId,
      sourcePostId:       r.sourcePostId
    }));
  }

  return NextResponse.json({
    ok: true,
    curated: source.map((e) => ({
      imageUrl: e.image_url,
      subject:  e.subject,
      keywords: e.keywords_strict
    })),
    submissions,
    // hint to the client whether more results are likely on next
    // page — false when the underlying source returned less than
    // the requested limit.
    hasMore: source.length >= limit
  });
}
