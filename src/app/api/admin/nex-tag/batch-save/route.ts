// POST /api/admin/nex-tag/batch-save
//
// Accepts an array of tag actions and applies them in a SINGLE atomic
// manifest write. Two action types per row:
//
//   { url, human_description }   — human authored the description that
//                                  NEX should process into structured
//                                  knowledge (brain routing · DNA ·
//                                  MASTER IMAGE SCORE etc.). Text passes
//                                  through the same parseWithInheritance
//                                  pipeline as any other save.
//
//   { url, not_a_staircase: true } — human confirms the image is NOT a
//                                    staircase subject. Row is marked
//                                    excluded from every staircase brain
//                                    query. primary_brain set to null.
//                                    Row stays in manifest for record.
//
// One backup per batch. One disk write per batch. Human input trumps
// the classifier — verified_by_human: true is set on every row touched.

import { NextResponse, type NextRequest } from "next/server";
import {
  withManifestWrite,
  type ManifestFile,
} from "@/lib/nex/images/manifestWriter";
import { parseWithInheritance } from "@/lib/nex/images/knowledgeParser";
import { enrichHumanDescription } from "@/lib/nex/images/textEnricher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StaircaseKind = "full" | "component" | "related";

type IncomingTag = {
  url?: unknown;
  human_description?: unknown;
  staircase_kind?: unknown;
  not_a_staircase?: unknown;
  tagged_by?: unknown;
};

type CleanTag = {
  url: string;
  action: "describe" | "not_a_staircase";
  human_description?: string;
  staircase_kind?: StaircaseKind;
  tagged_by: string;
};

const MAX_DESC_LEN = 5000;
const VALID_KINDS: StaircaseKind[] = ["full", "component", "related"];

function normalise(t: IncomingTag): CleanTag | { reject: string } {
  if (typeof t.url !== "string" || !t.url.startsWith("http")) {
    return { reject: "invalid_url" };
  }
  const tagged_by =
    typeof t.tagged_by === "string" && t.tagged_by.trim().length > 0
      ? t.tagged_by.slice(0, 200)
      : "philip";

  if (t.not_a_staircase === true) {
    return { url: t.url, action: "not_a_staircase", tagged_by };
  }

  if (typeof t.human_description === "string" || VALID_KINDS.includes(t.staircase_kind as StaircaseKind)) {
    const desc = typeof t.human_description === "string"
      ? t.human_description.trim().slice(0, MAX_DESC_LEN)
      : "";
    const kind = VALID_KINDS.includes(t.staircase_kind as StaircaseKind)
      ? (t.staircase_kind as StaircaseKind)
      : "full"; // default to "full" if operator sent only description
    if (desc.length === 0 && !kind) {
      return { reject: "empty_or_invalid_tag" };
    }
    return { url: t.url, action: "describe", human_description: desc, staircase_kind: kind, tagged_by };
  }

  return { reject: "empty_or_invalid_tag" };
}

export async function POST(req: NextRequest) {
  let payload: { tags?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!payload || !Array.isArray(payload.tags)) {
    return NextResponse.json({ ok: false, error: "tags_must_be_array" }, { status: 400 });
  }
  const raw = payload.tags as IncomingTag[];
  if (raw.length === 0) return NextResponse.json({ ok: true, saved: 0, rejected: [] });
  if (raw.length > 500) {
    return NextResponse.json({ ok: false, error: "batch_too_large_max_500" }, { status: 400 });
  }

  const cleaned: CleanTag[] = [];
  const rejected: Array<{ url: string; reason: string }> = [];
  for (const t of raw) {
    const r = normalise(t);
    if ("reject" in r) {
      rejected.push({ url: String(t.url ?? "(missing url)"), reason: r.reject });
    } else {
      cleaned.push(r);
    }
  }
  if (cleaned.length === 0) return NextResponse.json({ ok: true, saved: 0, rejected });

  const { result, backup_path } = await withManifestWrite(
    async (manifest: ManifestFile) => {
      let described = 0;
      let excluded = 0;
      const per_row: Array<{
        url: string;
        action: "describe" | "not_a_staircase";
        score?: number;
        band?: string;
        brain?: string | null;
        staircase_kind?: StaircaseKind;
      }> = [];
      for (const t of cleaned) {
        const existing = manifest.images[t.url] ?? {};

        if (t.action === "not_a_staircase") {
          (existing as { not_a_staircase?: boolean }).not_a_staircase = true;
          (existing as { primary_brain?: string | null }).primary_brain = null;
          (existing as { verified_by_human?: boolean }).verified_by_human = true;
          (existing as { human_tagged_at?: string }).human_tagged_at = new Date().toISOString();
          (existing as { human_tagged_by?: string }).human_tagged_by = t.tagged_by;
          manifest.images[t.url] = existing;
          excluded++;
          per_row.push({ url: t.url, action: "not_a_staircase", brain: null });
          continue;
        }

        // action === "describe" — enrich the human input (Level B) then run
        // the intelligence pipeline on the enriched version.
        const rawDesc = t.human_description ?? "";
        const kind: StaircaseKind = t.staircase_kind ?? "full";

        // Step 1 — spelling + grammar + shorthand expansion + safe context
        const enrichment = enrichHumanDescription(rawDesc, kind);

        // Step 2 — prepend kind hint for classifier certainty
        const kindPrefix =
          kind === "component" ? "Staircase component reference. "
          : kind === "related" ? "Staircase-related (workshop / process / context / material) reference. "
          : "Staircase full design reference. ";
        const combinedDescription = enrichment.enriched.length > 0
          ? kindPrefix + enrichment.enriched
          : kindPrefix + "(no additional detail supplied)";

        const priorMasterAi =
          typeof existing.master_ai_prompt === "string" ? existing.master_ai_prompt : null;
        const priorOriginal =
          typeof existing.original_prompt === "string" ? existing.original_prompt : null;

        const { knowledge } = await parseWithInheritance({
          master_description: combinedDescription,
          master_ai_prompt: priorMasterAi ?? priorOriginal,
        });

        // Score the row the same way the save endpoint does (ADR-0032 · 5-axis)
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
        const collectionMemberships = knowledge.collection_memberships ?? [];
        const collection_intelligence = Math.min(
          20,
          collectionMemberships.length * 3 + (collectionMemberships.length > 0 ? 5 : 0)
        );
        const relationship_intelligence = Math.min(
          20,
          (knowledge.family_tree?.children?.length ?? 0) * 4 +
            (knowledge.family_tree?.parent_url ? 4 : 0) +
            (knowledge.material_journey ? 4 : 0)
        );
        const promptOK =
          knowledge.master_ai_prompt && knowledge.master_ai_prompt.length > 80 ? 8 : 0;
        const lockedOK = (knowledge.locked_attributes?.must_keep?.length ?? 0) > 0 ? 4 : 0;
        const canBecomeOK = Math.min(6, knowledge.can_become?.length ?? 0);
        const journeyOK = knowledge.material_journey ? 2 : 0;
        const future_intelligence = promptOK + lockedOK + canBecomeOK + journeyOK;
        const creative_intelligence = Math.min(20, (knowledge.can_become?.length ?? 0) * 3);
        const master_score =
          image_intelligence +
          collection_intelligence +
          relationship_intelligence +
          future_intelligence +
          creative_intelligence;
        const { knowledgeBandFromScore, knowledgeBandLabel } = await import(
          "@/lib/nex/images/knowledgeParser"
        );
        const knowledge_band = knowledgeBandFromScore(master_score);
        const knowledge_band_label = knowledgeBandLabel(knowledge_band);

        // Preserve family_tree.children[] across saves — Rule #14
        const priorFamilyTree =
          (existing as { family_tree?: unknown }).family_tree ?? knowledge.family_tree;

        // Human-authored description REPLACES the description field so
        // retrieval reads the verified text. The original AI-generated
        // description is preserved under `pre_human_description` for audit.
        if (typeof existing.description === "string" && existing.description.length > 0) {
          (existing as { pre_human_description?: string }).pre_human_description =
            existing.description as string;
        }

        // Preserve full audit trail — raw · enriched · what NEX added / fixed
        (existing as { human_description_raw?: string }).human_description_raw = rawDesc;
        (existing as { human_description?: string }).human_description = enrichment.enriched;
        (existing as { enrichment_corrections?: string[] }).enrichment_corrections = enrichment.corrections;
        (existing as { enrichment_added_facts?: string[] }).enrichment_added_facts = enrichment.added_facts;
        (existing as { staircase_kind?: StaircaseKind }).staircase_kind = kind;
        (existing as { description?: string }).description = knowledge.master_description;
        (existing as { master_ai_prompt?: string }).master_ai_prompt = knowledge.master_ai_prompt;
        (existing as { image_dna?: unknown }).image_dna = knowledge.image_dna;
        (existing as { ai_intent?: unknown }).ai_intent = knowledge.ai_intent;
        (existing as { locked_attributes?: unknown }).locked_attributes =
          knowledge.locked_attributes;
        (existing as { objects?: unknown }).objects = knowledge.objects;
        (existing as { image_type?: string }).image_type = knowledge.image_type;
        (existing as { image_purpose?: unknown }).image_purpose = knowledge.image_purpose;
        (existing as { can_become?: string[] }).can_become = knowledge.can_become;
        (existing as { collection_id?: string }).collection_id = knowledge.collection_id;
        (existing as { family_tree?: unknown }).family_tree = priorFamilyTree;
        (existing as { primary_brain?: string | null }).primary_brain = knowledge.primary_brain;
        (existing as { collection_memberships?: string[] }).collection_memberships =
          knowledge.collection_memberships;
        (existing as { master_image_score?: unknown }).master_image_score = {
          image_intelligence,
          collection_intelligence,
          relationship_intelligence,
          future_intelligence,
          creative_intelligence,
          master_score,
        };
        (existing as { knowledge_band?: string }).knowledge_band = knowledge_band;
        (existing as { knowledge_band_label?: string }).knowledge_band_label =
          knowledge_band_label;
        (existing as { verified_by_human?: boolean }).verified_by_human = true;
        (existing as { human_tagged_at?: string }).human_tagged_at = new Date().toISOString();
        (existing as { human_tagged_by?: string }).human_tagged_by = t.tagged_by;
        // Clear the not_a_staircase flag if the human is now describing it as one
        (existing as { not_a_staircase?: boolean }).not_a_staircase = false;

        manifest.images[t.url] = existing;
        described++;
        per_row.push({
          url: t.url,
          action: "describe",
          score: master_score,
          band: knowledge_band_label,
          brain: knowledge.primary_brain,
          staircase_kind: kind,
        });
      }
      return { described, excluded, per_row };
    }
  );

  return NextResponse.json({
    ok: true,
    saved: result.described + result.excluded,
    described: result.described,
    excluded: result.excluded,
    per_row: result.per_row,
    rejected,
    backup_path,
  });
}
