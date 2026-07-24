// GET /api/authors/brains/[slug]/stats
//
// Returns Brain growth stats for the current Author's Brain. Real
// signal only — placeholders for concepts not yet in the substrate
// are surfaced as `null` so the caller renders them honestly.

import { computeBrainStats } from "@/lib/nex/brains/_studio/_stats";
import { jsonOk, requireStudio } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requireStudio();
  if (!gate.ok) return gate.response;
  const { slug } = await ctx.params;

  const stats = await computeBrainStats(slug);
  return jsonOk({ stats });
}
