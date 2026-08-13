// POST /api/nex/refacing/cases/[rf_id]/save-direction
//
// SEE UI · Save & Share (spec §E.3) · appends a direction to
// case.saved_directions[] without committing (compare: select-direction
// which is the terminal LOCK commit).
//
// Body:
//   {
//     "direction":                "safe-centre" | "warm-character" | "stretch-statement" | "custom",
//     "name":                     string,
//     "reason_for_existing":      string,
//     "key_materials_description": string,
//     "reference_image_ids":      string[]
//   }
//
// Idempotency: if the same set of reference_image_ids is already saved,
// the entry is not duplicated.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readCaseWithToken, updateCase, CaseNotFoundError, CaseValidationError } from "@/lib/nex/refacing/case-store";
import { loadImagesV3 } from "@/lib/nex/refacing/manifest";
import type { DesignDirection } from "@/lib/nex/refacing/case-schema";
import { extractToken, parseJsonBody } from "@/lib/nex/refacing/_route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  direction?: DesignDirection;
  name?: string;
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

  const direction = body.direction as DesignDirection;
  if (!VALID_DIRECTIONS.includes(direction)) {
    return NextResponse.json({ ok: false, error: "invalid_direction" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.slice(0, 120) : "";
  const reason = typeof body.reason_for_existing === "string" ? body.reason_for_existing.slice(0, 240) : "";
  const materials = typeof body.key_materials_description === "string" ? body.key_materials_description.slice(0, 240) : "";
  const refs = Array.isArray(body.reference_image_ids)
    ? body.reference_image_ids.filter((v): v is string => typeof v === "string")
    : [];
  if (!name || refs.length === 0) {
    return NextResponse.json(
      { ok: false, error: "name_and_references_required" },
      { status: 400 }
    );
  }

  try {
    const current = await readCaseWithToken(rf_id, token);

    // Validate all reference_image_ids exist in the library (soft PR-18 for
    // saved-directions · they aren't a committed composition but they must
    // still trace to real library entries so the Member could review them).
    const library = await loadImagesV3();
    const knownIds = new Set(library.map((e) => e.image_id));
    const untrackable = refs.filter((id) => !knownIds.has(id));
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

    const saved_at = new Date().toISOString();
    const key = refs.slice().sort().join("|");

    const updated = await updateCase(rf_id, (c) => {
      const existing = c.saved_directions ?? [];
      // Idempotency check on reference-set.
      const alreadySaved = existing.some((e) => {
        const eKey = e.reference_image_ids.slice().sort().join("|");
        return eKey === key;
      });
      if (alreadySaved) return c;
      return {
        ...c,
        saved_directions: [
          ...existing,
          {
            direction,
            name,
            reason_for_existing: reason,
            key_materials_description: materials,
            reference_image_ids: refs,
            saved_at,
          },
        ],
      };
    });

    return NextResponse.json({
      ok: true,
      case: updated,
      saved_count: updated.saved_directions?.length ?? 0,
    });
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
