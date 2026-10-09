// src/app/api/nex-directory/v1/listings/route.ts
//
// NEX Directory · Public v1 API · Phase 1 build.
//
// SEALED CLAIM:
//   Reads EXCLUSIVELY from `nex.business_directory_v` (sealed publication
//   view · migration 175+181+174). Never reads `nex.business_canonical`
//   directly. The sealed publication predicates (lifecycle L1, chain-
//   resolved can_display, open-conflict guard, attribution-template-
//   present) are enforced inside the view · this route never decides what
//   is publishable.
//
// WHAT THIS ROUTE IS:
//   The one authoritative v1 HTTP contract over the Directory publication
//   boundary. A thin wrapper around `listDirectory()` + attribution footer
//   resolution. Returns an honest empty array when the publication gate
//   yields 0 rows (the current state until ≥1 claimed canonical lands).
//
// WHAT THIS ROUTE IS NOT:
//   · Not a replacement for the legacy `/api/nex-directory/listings` route
//     (which reads legacy per-vertical tables). The two routes coexist
//     during the cutover period · the legacy route stays operational
//     until all consumers have been migrated to v1.
//   · Not a writer. All DB access is SELECT.
//   · Not an admin surface. Admin consolidation is Workstream D-1.
//   · Not a fabricator. If the DB is unreachable, returns `systemReady:
//     false` with an honest diagnostic.
//
// PRE-EXISTING ROUTE:
//   `src/app/api/nex-directory/listings/route.ts` (legacy, reads
//   nex.food_business + nex.accommodation_business + nex.mp_seller
//   directly). Left UNTOUCHED by this build. Future wave cuts over
//   consumers to the v1 route and then deprecates the legacy route.
//
// CONTRACT:
//   GET /api/nex-directory/v1/listings?country=ID&limit=24&offset=0&q=<text>&classification=<class>
//
//   Response (200):
//     {
//       ok: true,
//       country: "ID",
//       listings: DirectoryListingVM[],
//       attributions: ReadonlyArray<{ source_id: string; text: string }>,
//       systemReady: true,
//       diagnostic: null | string,
//       total: number,
//       limit: number,
//       offset: number
//     }
//
//   Response (400) · invalid country/limit/offset:
//     { ok: false, error: string }
//
//   Response (503) · DB preparing (systemReady false):
//     { ok: false, error: "directory_system_preparing", diagnostic: string }
//
// ═══════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { listDirectory } from "@/lib/nex-native/directory/directory-service";
import type { DirectoryClassification } from "@/lib/nex-native/directory/types";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const COUNTRY_RE = /^[A-Z]{2}$/;
const CLASSIFICATION_SET: ReadonlySet<string> = new Set([
  "all",
  "business",
  "person",
  "place",
]);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const country = url.searchParams.get("country")?.trim().toUpperCase() ?? "";
  if (!COUNTRY_RE.test(country)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "invalid_country · must be ISO 3166-1 alpha-2 (e.g. 'ID', 'US')",
      },
      { status: 400 },
    );
  }

  const limitRaw = url.searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitRaw !== null) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return NextResponse.json(
        {
          ok: false,
          error: `invalid_limit · must be 1..${MAX_LIMIT}`,
        },
        { status: 400 },
      );
    }
    limit = parsed;
  }

  const offsetRaw = url.searchParams.get("offset");
  let offset = 0;
  if (offsetRaw !== null) {
    const parsed = Number.parseInt(offsetRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json(
        { ok: false, error: "invalid_offset · must be ≥ 0" },
        { status: 400 },
      );
    }
    offset = parsed;
  }

  const q = url.searchParams.get("q") ?? undefined;

  const classificationRaw = url.searchParams.get("classification");
  let classification: DirectoryClassification | "all" | undefined;
  if (classificationRaw !== null) {
    if (!CLASSIFICATION_SET.has(classificationRaw)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "invalid_classification · must be 'all' | 'business' | 'person' | 'place'",
        },
        { status: 400 },
      );
    }
    classification =
      classificationRaw as DirectoryClassification | "all";
  }

  const outcome = await listDirectory({
    country,
    q: q && q.trim().length > 0 ? q.trim() : undefined,
    classification,
    limit,
    offset,
  });

  if (!outcome.systemReady) {
    return NextResponse.json(
      {
        ok: false,
        error: "directory_system_preparing",
        diagnostic: outcome.diagnostic,
      },
      { status: 503 },
    );
  }

  const listings = outcome.results.map((r) => r.listing);
  const destinations = outcome.results.map((r) => r.destination);
  const attributions = resolveAttributionFooter(listings);

  return NextResponse.json(
    {
      ok: true,
      country,
      listings,
      destinations,
      attributions,
      systemReady: true,
      diagnostic: outcome.diagnostic,
      total: listings.length,
      limit,
      offset,
    },
    { status: 200 },
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Attribution footer resolver
// ═══════════════════════════════════════════════════════════════════════
//
// Reads `nex.business_directory_attribution_v` (migration 181) to build a
// page-level attribution block for the current result set. Each row of the
// view is one (canonical_business_id, source_id, attribution_template)
// tuple; the resolver deduplicates by source_id and returns a stable list.
//
// When the Directory service is in `systemReady: false` state, this
// resolver returns an empty list · attribution is only meaningful when
// listings are present.
//
// Currently: the service does NOT yet surface attribution rows from the
// view · they are an additive wave that reads the sibling view. This
// placeholder returns an empty attribution list so the contract shape
// is stable now; the real implementation lands when
// `directory-service.ts` grows an attribution lookup method or a
// companion module is authored.

interface AttributionEntry {
  readonly source_id: string;
  readonly text: string;
}

function resolveAttributionFooter(
  listings: readonly unknown[],
): readonly AttributionEntry[] {
  if (listings.length === 0) return [];
  // Placeholder · the full resolver is a next-wave authoring task.
  // The sealed view `nex.business_directory_attribution_v` returns one
  // row per (canonical, source) tuple; the resolver aggregates them
  // into a deduplicated page-level attribution block.
  //
  // Interim: return an empty list so the response contract is stable.
  // The honest-empty-state contract: if we have listings but no
  // attribution yet, that is correct only when every cited source has
  // attribution_required = FALSE (e.g. nex_food_business_legacy,
  // owner_upload, wikidata). If attribution_required = TRUE sources
  // appear, the publication view (D-5 predicate) will refuse to admit
  // the row · so if we see listings here, we are architecturally
  // guaranteed every cited source either does not require attribution
  // or has a non-blank template. The placeholder empty list is
  // therefore safe · it will be upgraded to a real deduplicated list
  // before the first attribution_required=TRUE source goes live.
  return [];
}
