// GET /api/authors/brains
//
// Returns every Brain the current Author has drafts for, plus any
// Brains they are explicitly assigned to. At V1 the assignment layer
// is thin — we surface whatever draft rows exist for this author.

import { listDraftsForBrain } from "@/lib/nex/brains/_studio";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonOk, requireStudio } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireStudio();
  if (!gate.ok) return gate.response;

  // Prefer DB: query brains where primary_author_id matches. Fall back
  // to scanning filesystem drafts if the brains table is missing.
  const brains: Array<{ slug: string; name?: string; status?: string; version?: string }> = [];

  let usedDb = false;
  try {
    const { data, error } = await supabaseAdmin
      .from("hammerex_nex_brains")
      .select("slug, name, status, version, primary_author_id")
      .eq("primary_author_id", gate.authorId);
    if (!error && Array.isArray(data)) {
      usedDb = true;
      for (const b of data) brains.push({ slug: b.slug, name: b.name, status: b.status, version: b.version });
    }
  } catch {
    // Table missing → fall through.
  }

  if (!usedDb) {
    // No DB registry available yet. Return whatever brain the studio
    // has drafts for locally.
    const scaffoldedSlugs = ["staircase"];
    for (const slug of scaffoldedSlugs) {
      const drafts = await listDraftsForBrain(slug);
      const mine   = drafts.filter((d) => d.author_id === gate.authorId);
      if (mine.length > 0) brains.push({ slug, status: "draft" });
    }
  }

  return jsonOk({ brains });
}
