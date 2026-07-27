// GET /api/admin/nex-tag/queue
//
// Returns the queue of manifest rows that need human tagging.
// Sort order (highest priority first):
//   1. Rows with primary_brain = null (unclassified)
//   2. Rows without human_tags AND with score < 60 (thin coverage)
//   3. Rows without human_tags in any brain
//   4. Everything else (skip — already tagged)
//
// Query params:
//   ?limit=N    max rows to return (default 200, max 2000)
//   ?after=URL  cursor for pagination (returns rows after this URL in sort order)

import { NextResponse, type NextRequest } from "next/server";
import { readManifestSnapshot } from "@/lib/nex/images/manifestWriter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get("limit") ?? "200")));
  const after = url.searchParams.get("after");

  const manifest = await readManifestSnapshot();
  const allRows = Object.entries(manifest.images);

  type QueueRow = {
    url: string;
    priority: number;
    primary_brain: string | null;
    score: number | null;
    band: string | null;
    has_description: boolean;
    already_tagged: boolean;
    description_preview: string | null;
    existing_human_tags?: unknown;
  };

  const rows: QueueRow[] = allRows
    // Skip rows already marked "not a staircase" — human decision, don't re-serve
    .filter(([, r]) => !(r as Record<string, unknown>).not_a_staircase)
    .map(([u, r]) => {
    const row = r as Record<string, unknown>;
    const alreadyTagged =
      // Either the old structured human_tags object OR the new human_description string
      (!!row.human_tags && typeof row.human_tags === "object") ||
      (typeof row.human_description === "string" && row.human_description.trim().length > 0);
    const primary_brain =
      typeof row.primary_brain === "string" ? row.primary_brain : null;
    const score =
      row.master_image_score &&
      typeof (row.master_image_score as { master_score?: unknown }).master_score === "number"
        ? ((row.master_image_score as { master_score: number }).master_score)
        : null;
    const band =
      typeof row.knowledge_band_label === "string" ? row.knowledge_band_label : null;
    const description =
      typeof row.description === "string" ? row.description : "";
    const has_description = description.trim().length > 0;

    // Priority: 0 = highest (do first), 100 = lowest (skip)
    let priority = 50;
    if (alreadyTagged) priority = 100; // skip
    else if (!primary_brain) priority = 0; // most urgent
    else if (score !== null && score < 60) priority = 10;
    else if (!has_description) priority = 20;
    else priority = 30;

    return {
      url: u,
      priority,
      primary_brain,
      score,
      band,
      has_description,
      already_tagged: alreadyTagged,
      description_preview: has_description ? description.slice(0, 120) : null,
      existing_human_tags: alreadyTagged ? row.human_tags : undefined,
    };
  });

  // Sort: priority ascending, then URL for deterministic order
  rows.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.url.localeCompare(b.url);
  });

  // Filter out already-tagged unless explicitly requested via ?include=all
  const includeAll = url.searchParams.get("include") === "all";
  const filtered = includeAll ? rows : rows.filter((r) => !r.already_tagged);

  // Cursor pagination
  let start = 0;
  if (after) {
    const idx = filtered.findIndex((r) => r.url === after);
    if (idx >= 0) start = idx + 1;
  }
  const page = filtered.slice(start, start + limit);

  return NextResponse.json({
    ok: true,
    total_rows: allRows.length,
    total_untagged: filtered.length,
    returned: page.length,
    has_more: start + limit < filtered.length,
    next_cursor: page.length > 0 ? page[page.length - 1].url : null,
    images: page,
  });
}
