// POST /api/admin/nex-tag/score-preview
//
// Lightweight scoring endpoint. Runs the same intelligence pipeline
// as batch-save (parseWithInheritance + MASTER IMAGE SCORE) but does
// NOT touch the manifest. Client uses this for live "score as you type"
// feedback so operator sees the impact of each phrase in their
// description.
//
// Response shape mirrors what the row would receive if the description
// were saved — score / band / brain / dna field fill / collections /
// derived component counts.

import { NextResponse, type NextRequest } from "next/server";
import { parseWithInheritance, knowledgeBandFromScore, knowledgeBandLabel } from "@/lib/nex/images/knowledgeParser";
import { enrichHumanDescription } from "@/lib/nex/images/textEnricher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StaircaseKind = "full" | "component" | "related";
const VALID_KINDS: StaircaseKind[] = ["full", "component", "related"];

export async function POST(req: NextRequest) {
  let payload: { description?: unknown; staircase_kind?: unknown };
  try { payload = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const text = typeof payload.description === "string" ? payload.description.trim() : "";
  const kind = VALID_KINDS.includes(payload.staircase_kind as StaircaseKind)
    ? (payload.staircase_kind as StaircaseKind)
    : "full";

  if (text.length === 0) {
    return NextResponse.json({
      ok: true,
      empty: true,
      score: 0,
      band: "visual",
      band_label: "Visual Knowledge",
      brain: null,
      dna_filled: 0,
      collections: 0,
    });
  }

  // Enrich BEFORE scoring — so the live preview shows the score the row
  // will actually receive on save, not the score of the raw shorthand.
  const enrichment = enrichHumanDescription(text, kind);

  const kindPrefix =
    kind === "component" ? "Staircase component reference. "
    : kind === "related" ? "Staircase-related (workshop / process / context / material) reference. "
    : "Staircase full design reference. ";
  const combined = kindPrefix + enrichment.enriched;

  const { knowledge } = await parseWithInheritance({
    master_description: combined,
    master_ai_prompt: null,
  });

  const dnaFields = [
    knowledge.image_dna.STYLE.primary,
    knowledge.image_dna.STYLE.secondary,
    knowledge.image_dna.STYLE.photographic,
    knowledge.image_dna.CAMERA.view,
    knowledge.image_dna.CAMERA.orientation,
    knowledge.image_dna.CAMERA.height,
    knowledge.image_dna.MATERIALS.primary,
    knowledge.image_dna.MATERIALS.secondary,
    knowledge.image_dna.LIGHTING.primary,
    knowledge.image_dna.QUALITY.realism,
    knowledge.image_dna.QUALITY.rendering,
    knowledge.image_dna.SETTING.primary,
  ];
  const dnaFilled = dnaFields.filter(Boolean).length;
  const image_intelligence = Math.round((dnaFilled / 12) * 20);
  const memberships = knowledge.collection_memberships ?? [];
  const collection_intelligence = Math.min(20, memberships.length * 3 + (memberships.length > 0 ? 5 : 0));
  const relationship_intelligence = Math.min(
    20,
    (knowledge.family_tree?.children?.length ?? 0) * 4 +
      (knowledge.family_tree?.parent_url ? 4 : 0) +
      (knowledge.material_journey ? 4 : 0)
  );
  const promptOK = knowledge.master_ai_prompt && knowledge.master_ai_prompt.length > 80 ? 8 : 0;
  const lockedOK = (knowledge.locked_attributes?.must_keep?.length ?? 0) > 0 ? 4 : 0;
  const canBecomeOK = Math.min(6, knowledge.can_become?.length ?? 0);
  const journeyOK = knowledge.material_journey ? 2 : 0;
  const future_intelligence = promptOK + lockedOK + canBecomeOK + journeyOK;
  const creative_intelligence = Math.min(20, (knowledge.can_become?.length ?? 0) * 3);
  const master_score =
    image_intelligence + collection_intelligence + relationship_intelligence + future_intelligence + creative_intelligence;

  const band = knowledgeBandFromScore(master_score);
  const band_label = knowledgeBandLabel(band);

  return NextResponse.json({
    ok: true,
    empty: false,
    score: master_score,
    band,
    band_label,
    brain: knowledge.primary_brain,
    dna_filled: dnaFilled,
    dna_max: 12,
    collections: memberships.length,
    axes: {
      image: image_intelligence,
      collection: collection_intelligence,
      relationship: relationship_intelligence,
      future: future_intelligence,
      creative: creative_intelligence,
    },
    enrichment: {
      original: enrichment.original,
      enriched: enrichment.enriched,
      corrections: enrichment.corrections,
      added_facts: enrichment.added_facts,
    },
  });
}
