// POST /api/authors/brains/[slug]/preview
//
// Builds a BrainPack from the Author's current drafts, boots it through
// the substrate loader, returns a preview summary. No permanent write.

import type { NextRequest } from "next/server";
import { exportPackFromDrafts } from "@/lib/nex/brains/_studio";
import { jsonError, jsonOk, requireStudio } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requireStudio();
  if (!gate.ok) return gate.response;
  const { slug } = await ctx.params;

  const result = await exportPackFromDrafts(slug);
  if (!result.ok) return jsonError(result.reason, result.detail, 422);

  const b = result.loaded;
  return jsonOk({
    manifest: b.manifest,
    counts: {
      craft_facts:            b.craft.facts.length,
      craft_glossary:         b.craft.glossary.length,
      regulations:            b.regulations.regulations.length,
      regulation_rules:       b.regulations.rules.length,
      materials:              b.materials.materials.length,
      workflow_playbooks:     b.workflow.playbooks.length,
      defects:                b.defects.defects.length,
      pricing_rules:          b.pricing_model.rules.length
    }
  });
}
