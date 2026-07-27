// POST /api/admin/image-tagger/score
//
// Returns the MASTER IMAGE SCORE for a description WITHOUT saving.
// Used by the tagger UI to show a live circular score ring on each
// card as the admin types — so they see when a description crosses
// the ≥70 intelligence-gate threshold per ADR-0033 Rule #7.
//
// Same formula as the save endpoint + Global Intelligence Pipeline.

import { NextResponse } from "next/server";
import { parseWithInheritance } from "@/lib/nex/images/knowledgeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let payload: { description?: string; master_ai_prompt?: string | null };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const description = (payload.description ?? "").trim();
  if (description.length < 20) {
    // Too thin to score — return 0 with a hint
    return NextResponse.json({
      ok: true,
      master_score: 0,
      band: "poor",
      passes_gate: false,
      primary_brain: null,
      collection_memberships: [],
      breakdown: {
        image_intelligence: 0,
        collection_intelligence: 0,
        relationship_intelligence: 0,
        future_intelligence: 0,
        creative_intelligence: 0,
      },
      hint: "Description too short to score — needs at least 20 characters.",
    });
  }

  const { knowledge } = await parseWithInheritance({
    master_description: description,
    master_ai_prompt: payload.master_ai_prompt ?? null,
  });

  // Same formula as save endpoint + pipeline
  const dnaScalarFields = [
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
  const image_intelligence = Math.round(
    (dnaScalarFields.filter(Boolean).length / 12) * 20
  );

  const memberships = knowledge.collection_memberships ?? [];
  const collection_intelligence = Math.min(
    20,
    memberships.length * 3 + (memberships.length > 0 ? 5 : 0)
  );

  const relationship_intelligence = Math.min(
    20,
    (knowledge.family_tree?.children?.length ?? 0) * 4 +
      (knowledge.family_tree?.parent_url ? 4 : 0) +
      (knowledge.material_journey ? 4 : 0)
  );

  const promptOK =
    knowledge.master_ai_prompt && knowledge.master_ai_prompt.length > 80 ? 8 : 0;
  const lockedOK =
    (knowledge.locked_attributes?.must_keep?.length ?? 0) > 0 ? 4 : 0;
  const canBecomeOK = Math.min(6, knowledge.can_become?.length ?? 0);
  const journeyOK = knowledge.material_journey ? 2 : 0;
  const future_intelligence = promptOK + lockedOK + canBecomeOK + journeyOK;

  const creative_intelligence = Math.min(
    20,
    (knowledge.can_become?.length ?? 0) * 3
  );

  const master_score =
    image_intelligence +
    collection_intelligence +
    relationship_intelligence +
    future_intelligence +
    creative_intelligence;

  const band =
    master_score >= 90
      ? "excellent"
      : master_score >= 70
      ? "good"
      : master_score >= 50
      ? "marginal"
      : "poor";

  const passes_gate = master_score >= 70 && knowledge.primary_brain !== null;

  return NextResponse.json({
    ok: true,
    master_score,
    band,
    passes_gate,
    primary_brain: knowledge.primary_brain,
    collection_memberships: memberships,
    breakdown: {
      image_intelligence,
      collection_intelligence,
      relationship_intelligence,
      future_intelligence,
      creative_intelligence,
    },
  });
}
