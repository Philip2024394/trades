// POST /api/authors/brains/[slug]/publish
//
// Author-submits their draft for review. This does NOT flip the Brain
// to `published` — that's the Merchant Advisory Panel's decision per
// Panel Charter §5. What this endpoint does:
//   1. Runs the full boot-audit via exportPackFromDrafts
//   2. Writes the JSON pack to disk (dev only) under _studio_exports/
//   3. Updates the manifest status draft → author_review (if DB present)
//
// The Panel takes it from here.

import type { NextRequest } from "next/server";
import { exportPackFromDrafts, writePackToDisk } from "@/lib/nex/brains/_studio";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, requireStudio } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requireStudio();
  if (!gate.ok) return gate.response;

  const { slug } = await ctx.params;
  const result = await exportPackFromDrafts(slug);
  if (!result.ok) return jsonError(result.reason, result.detail, 422);

  const disk = await writePackToDisk(slug, result.pack);

  // Best-effort status update. Missing table = fine, we just skip.
  try {
    await supabaseAdmin
      .from("hammerex_nex_brains")
      .update({ status: "author_review", last_reviewed_at: new Date().toISOString() })
      .eq("slug", slug)
      .eq("primary_author_id", gate.authorId);
  } catch {
    // Table missing or update failed — surfaced via preview if the
    // Author asks. Not a submission-blocker.
  }

  return jsonOk({
    submitted:            true,
    manifest:             result.loaded.manifest,
    files_written_local:  disk.written,
    note: "Draft submitted for Merchant Advisory Panel review per Panel Charter §5. Panel outcome will move status advisory_panel → published on approve_publish vote."
  });
}
