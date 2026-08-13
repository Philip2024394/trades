// POST /api/nex/refacing/cases/[rf_id]/select-direction
//
// SEE UI · Step 4 · LOCK · customer taps "Choose this direction" in the
// SEE comparison view.
//
// Body:
//   {
//     "direction":              "safe-centre" | "warm-character" | "stretch-statement" | "custom",
//     "hero_image_id":          string,   // must exist in images_v3[]
//     "suggested_name":         string,
//     "reason_for_existing":    string,
//     "key_materials_description": string,
//     "reference_image_ids":    string[]  // every element MUST be in images_v3[]
//   }
//
// Server-side · we look up the hero_image_id in images_v3[] and derive
// canonical_profile_ids · style · mood · material_composition from the
// real library entry. This means the client cannot spoof any of these
// downstream-critical fields.
//
// composition_provenance[] is populated from material_composition[].
// Every component_selection carries the hero_image_id as its provenance
// anchor (Phase A · side-by-side presentation · single hero per direction).
//
// PR-13 · no price field is ever accepted or emitted.
// PR-16 · confidence markers survive the read + write path.
// PR-18 · validators reject Cases whose composition_provenance doesn't
//         cover every claimed component_role · run at write time by
//         validateRefacingCase in case-store.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readCaseWithToken, updateCase, CaseNotFoundError, CaseValidationError } from "@/lib/nex/refacing/case-store";
import { loadImagesV3 } from "@/lib/nex/refacing/manifest";
import type {
  DesignDirection,
  SelectedDesign,
  RequestedWorkArea,
} from "@/lib/nex/refacing/case-schema";
import type { ComponentRole } from "@/lib/nex/refacing/image-schema";
import type { CompositionProvenance } from "@/lib/nex/refacing/provenance";
import { extractToken, parseJsonBody } from "@/lib/nex/refacing/_route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  direction?: DesignDirection;
  hero_image_id?: string;
  suggested_name?: string;
  reason_for_existing?: string;
  key_materials_description?: string;
  reference_image_ids?: string[];
};

const VALID_DIRECTIONS: DesignDirection[] = [
  "safe-centre",
  "warm-character",
  "stretch-statement",
  "custom",
];

/**
 * Map a component_role that appears in a design's material_composition
 * to the customer-facing requested_work "area" enum.
 * Multiple roles can collapse into one area (baluster + newel + handrail
 * → "balustrade").
 */
function areaForRole(role: ComponentRole): RequestedWorkArea | null {
  const map: Record<ComponentRole, RequestedWorkArea | null> = {
    baluster:         "balustrade",
    newel:            "newels",
    handrail:         "handrail",
    tread:            "treads",
    riser:            "risers",
    stringer:         "stringers",
    whole_staircase:  null,
    step_unit:        null,
    feature_step:     null,
    material_swatch:  null,
    in_situ_room:     null,
    detail_joinery:   null,
  };
  return map[role];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ rf_id: string }> }
) {
  const { rf_id } = await params;
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 401 });
  }

  const parsed = await parseJsonBody<Body>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  // ── Body validation ──
  const direction = body.direction as DesignDirection;
  if (!VALID_DIRECTIONS.includes(direction)) {
    return NextResponse.json(
      { ok: false, error: "invalid_direction", detail: "direction must be one of safe-centre / warm-character / stretch-statement / custom" },
      { status: 400 }
    );
  }
  const heroId = typeof body.hero_image_id === "string" ? body.hero_image_id : "";
  if (!heroId) {
    return NextResponse.json({ ok: false, error: "hero_image_id_required" }, { status: 400 });
  }

  try {
    const current = await readCaseWithToken(rf_id, token);
    if (current.status !== "CONCEPT_READY" && current.status !== "DESIGN_SELECTED") {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_status_transition",
          detail: `Case must have seen directions (CONCEPT_READY) · current status is ${current.status}`,
        },
        { status: 409 }
      );
    }

    // ── Server-side hero lookup · we NEVER trust the client for
    //     canonical_profile_ids / style / mood / material_composition.
    const library = await loadImagesV3();
    const hero = library.find((e) => e.image_id === heroId);
    if (!hero) {
      // PR-18 · claimed hero must be in the library.
      return NextResponse.json(
        {
          ok: false,
          error: "pr18_provenance",
          detail: `hero_image_id '${heroId}' is not in the reference library`,
        },
        { status: 422 }
      );
    }

    // ── Compose reference_image_ids server-side · client's optional
    //     reference_image_ids[] must be a subset of library entries.
    const additionalRefs = Array.isArray(body.reference_image_ids)
      ? body.reference_image_ids.filter((id) => typeof id === "string")
      : [];
    const knownIds = new Set(library.map((e) => e.image_id));
    const untrackable = additionalRefs.filter((id) => !knownIds.has(id));
    if (untrackable.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "pr18_provenance",
          detail: `reference_image_ids contains ${untrackable.length} entries not in the reference library`,
        },
        { status: 422 }
      );
    }
    const reference_image_ids = Array.from(new Set([heroId, ...additionalRefs]));

    // ── Derive component_selections from hero's material_composition ──
    const composition = hero.material_composition ?? [];
    const component_selections = composition.map((mc) => ({
      component_role: mc.component_role,
      image_id: heroId,
      notes: undefined,
    }));
    // If the hero has no material_composition (thin metadata), fall back to a
    // whole-staircase selection · at minimum the design has one traceable
    // component (whole_staircase itself).
    if (component_selections.length === 0) {
      component_selections.push({
        component_role: "whole_staircase",
        image_id: heroId,
        notes: undefined,
      });
    }

    // ── Build composition_provenance per PR-18 ──
    const composition_provenance: CompositionProvenance = component_selections.map((cs) => ({
      component_role: cs.component_role,
      image_id: cs.image_id,
      source: "reference_library" as const,
    }));

    // ── Derive requested_work.areas from the component roles ──
    const areaSet = new Set<RequestedWorkArea>();
    for (const cs of component_selections) {
      const area = areaForRole(cs.component_role);
      if (area) areaSet.add(area);
    }
    const requested_work = {
      areas: Array.from(areaSet),
      quote_requirement: "supply_plus_installation" as const,
    };

    // ── Build the SelectedDesign ──
    const selected_design: SelectedDesign = {
      direction,
      name: typeof body.suggested_name === "string" ? body.suggested_name : (hero.alt || "Refacing design"),
      reason_for_existing:
        typeof body.reason_for_existing === "string" ? body.reason_for_existing : "",
      key_materials_description:
        typeof body.key_materials_description === "string" ? body.key_materials_description : (hero.sub_material ?? ""),
      canonical_profile_ids: hero.canonical_profile_ids ?? [],
      canonical_profile_ids_confidence: hero.canonical_profile_ids_confidence ?? "unknown",
      style: hero.style ?? [],
      mood: hero.mood ?? [],
      material_composition: composition,
      reference_image_ids,
      component_selections,
    };

    const updated = await updateCase(
      rf_id,
      (c) => ({
        ...c,
        selected_design,
        composition_provenance,
        requested_work,
      }),
      "DESIGN_SELECTED"
    );

    return NextResponse.json({ ok: true, case: updated });
  } catch (err) {
    if (err instanceof CaseNotFoundError) {
      return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
    }
    if (err instanceof CaseValidationError) {
      return NextResponse.json(
        { ok: false, error: err.reason, detail: err.detail },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
