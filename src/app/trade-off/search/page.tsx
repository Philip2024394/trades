// /trade-off/search — Two-tab platform search.
//
// Serves the primary discovery flow: a homeowner types "loft ladders"
// or "garden design" and picks between:
//   • Trades tab       → directory of real canteens matching the query
//   • Site Interest tab → masonry wall of hero-library images
//                        for that query, each with a "find trades
//                        nearest to me" chip below.
//
// Server-loads BOTH tabs so tab switching is instant. Reads
// `?q={query}&city={city}&tab={trades|inspiration}` search params —
// the same shape LandingSearchBar already submits.
//
// The hero-library.json is the corpus for Inspiration; MOCK_CANTEENS
// for Trades. Both are step-1 wiring; real-DB queries and per-image
// admin curation are follow-up passes.

import type { Metadata } from "next";
import { heroesForQuery, heroesBrowseAll, type HeroEntry } from "@/lib/heroLibrary";
import { searchCanteens, type Canteen } from "@/lib/canteens";
import { approvedSubmissionsForQuery, enrichSubmissionSources } from "@/lib/imageSubmissions";
import { beforeAftersForQuery } from "@/lib/beforeAfterLibrary";
import { featuredTradesForCategory } from "@/lib/featuredPlacements";
import { BRAND } from "@/lib/seo";
import { SearchShell, type InspirationImage } from "./SearchShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Search trades and Site Interest | ${BRAND.name}`,
  description:
    "Find a trade near you or scroll Site Interest — a wall of real project photos from working trades — to spark your next project.",
  robots: { index: true, follow: true }
};

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; city?: string; tab?: string }>;
}) {
  const { q, city, tab } = await searchParams;
  const query = (q ?? "").trim();
  const cityHint = (city ?? "").trim();
  // Tab default: Trades when a query is present (homeowners search a
  // service provider first per Philip's UX ruling 2026-07-15), but
  // Site Interest when there's NO query — the browse-all feed of
  // photos is a better first paint than an empty Trades tab.
  const defaultTab: "trades" | "inspiration" = query ? "trades" : "inspiration";
  const initialTab: "trades" | "inspiration" =
    tab === "inspiration" ? "inspiration"
    : tab === "trades"     ? "trades"
    : defaultTab;

  // Load both tabs concurrently. Trades = MOCK_CANTEENS for now;
  // Inspiration = union of curated hero-library.json entries +
  // approved trade submissions from hammerex_image_submissions. Union
  // is deduped by image_url so a trade re-submitting an image already
  // in the curated pool doesn't render twice.
  // With no query, render a shuffled browse-all feed of the full
  // curated library so the Site Interest landing has content
  // instead of an empty state. Endless scroll on the client keeps
  // requesting seed+offset windows from /api/inspiration/browse.
  // Trades tab intentionally stays empty on no-query landing —
  // trades directory without a search is a different UX (see /find).
  const browseSeed = Math.floor(Date.now() / 1000) % 100000; // fresh per request
  const initialCuratedForBrowse = query ? [] : heroesBrowseAll(browseSeed, 0, 24);

  const [rawTrades, curatedInspiration, approvedSubmissions, transformations, featured] = await Promise.all([
    Promise.resolve(query ? searchCanteens(query, cityHint) : ([] as Canteen[])),
    Promise.resolve(query ? heroesForQuery(query) : (initialCuratedForBrowse as HeroEntry[])),
    query ? approvedSubmissionsForQuery(query) : Promise.resolve([]),
    Promise.resolve(query ? beforeAftersForQuery(query, 6) : []),
    query ? featuredTradesForCategory(query) : Promise.resolve([])
  ]);

  // Featured Placement boost — active paid slots for this query
  // category surface at the top of the Trades tab. Trade slugs
  // matching an active placement are pulled to the front and marked
  // so the shell can render a "Featured" badge on the card.
  const featuredSlugs = new Set(featured.map((p) => p.tradeSlug));
  const featuredTrades = rawTrades.filter((c) => featuredSlugs.has(c.hostSlug));
  const otherTrades    = rawTrades.filter((c) => !featuredSlugs.has(c.hostSlug));
  const trades = [...featuredTrades, ...otherTrades];

  // Normalise both sources into the shared InspirationImage shape
  // the shell renders. Curated entries win on dedupe so their richer
  // metadata (subject, keywords, sibling group) stays intact.
  //
  // Trade submissions also get enriched: batch-lookup their source
  // canteen slug + source post reply_count so the credit chip can
  // link to the trade's canteen and the "View comments" button can
  // show the true count (or hide when zero). Two batched queries
  // regardless of page size.
  const sources = await enrichSubmissionSources({
    canteenIds: approvedSubmissions.map((s) => s.sourceCanteenId).filter((x): x is string => Boolean(x)),
    postIds:    approvedSubmissions.map((s) => s.sourcePostId).filter((x): x is string => Boolean(x))
  });

  const seen = new Set<string>();
  const inspiration: InspirationImage[] = [];
  for (const c of curatedInspiration) {
    if (seen.has(c.image_url)) continue;
    seen.add(c.image_url);
    inspiration.push({
      source:              "curated",
      imageUrl:            c.image_url,
      subject:             c.subject,
      keywords:            c.keywords_strict,
      submitterSlug:       null,
      submitterDisplay:    null,
      submitterAvatarUrl:  null,
      sourceCanteenId:     null,
      sourceCanteenSlug:   null,
      sourcePostId:        null,
      sourcePostReplyCount:0,
      materials:           []
    });
  }
  for (const s of approvedSubmissions) {
    if (seen.has(s.imageUrl)) continue;
    seen.add(s.imageUrl);
    const canteenMeta = s.sourceCanteenId ? sources.canteens[s.sourceCanteenId] : null;
    const replyCount  = s.sourcePostId ? (sources.posts[s.sourcePostId] ?? 0) : 0;
    inspiration.push({
      source:              "submission",
      imageUrl:            s.imageUrl,
      subject:             s.altText ?? s.keywords.join(", "),
      keywords:            s.keywords,
      submitterSlug:       s.submitterSlug,
      submitterDisplay:    s.submitterDisplay,
      submitterAvatarUrl:  s.submitterAvatarUrl,
      sourceCanteenId:     s.sourceCanteenId,
      sourceCanteenSlug:   canteenMeta?.slug ?? null,
      sourcePostId:        s.sourcePostId,
      sourcePostReplyCount:replyCount,
      materials:           s.materials
    });
  }

  // Structured data for Google Images — each Site Interest image
  // becomes an ImageObject in a graph so Google indexes them under
  // the query (e.g. "loft ladder installation"). ContentUrl is the
  // ImageKit source (not the watermarked variant — Google prefers
  // the highest-quality source), and licence + creditText tie the
  // image back to the platform. Guarded on inspiration.length so we
  // don't emit an empty graph on landing / empty searches.
  const jsonLd = inspiration.length > 0
    ? {
        "@context": "https://schema.org",
        "@graph": inspiration.slice(0, 24).map((img) => ({
          "@type": "ImageObject",
          contentUrl:  img.imageUrl,
          thumbnailUrl:img.imageUrl,
          name:        img.subject,
          description: img.subject,
          keywords:    img.keywords.join(", "),
          creditText:  img.submitterDisplay ?? "Thenetworkers",
          creator: {
            "@type": img.submitterDisplay ? "Person" : "Organization",
            name:    img.submitterDisplay ?? "Thenetworkers"
          },
          license:     "https://thenetworkers.app/legal/image-license",
          acquireLicensePage: "https://thenetworkers.app/legal/image-license"
        }))
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <SearchShell
        query={query}
        city={cityHint}
        initialTab={initialTab}
        trades={trades}
        inspiration={inspiration}
        transformations={transformations}
        browseSeed={browseSeed}
        featuredTradeSlugs={Array.from(featuredSlugs)}
      />
    </>
  );
}
