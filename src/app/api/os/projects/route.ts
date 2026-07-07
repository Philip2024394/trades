// POST /api/os/projects
//
// Homeowner starts a new project on their property. e.g. "Bathroom
// renovation." Optional leaf slug pre-binds to the AI Visualiser
// taxonomy.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { findOrCreateProject } from "@/lib/os/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  propertyId?: unknown;
  title?: unknown;
  leafSlug?: unknown;
  budgetLow?: unknown;
  budgetHigh?: unknown;
};

export async function POST(req: NextRequest) {
  const party = await loadHomeownerSession();
  if (!party) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const propertyId =
    typeof body.propertyId === "string" ? body.propertyId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const leafSlug =
    typeof body.leafSlug === "string" && body.leafSlug.trim().length > 0
      ? body.leafSlug.trim()
      : null;
  if (!propertyId || title.length < 2) {
    return NextResponse.json(
      { ok: false, error: "propertyId and title required." },
      { status: 400 }
    );
  }

  // Verify the caller owns/occupies this property
  const { data: claim } = await supabaseAdmin
    .from("os_property_claims")
    .select("id")
    .eq("property_id", propertyId)
    .eq("party_id", party.id)
    .is("revoked_at", null)
    .maybeSingle();
  if (!claim) {
    return NextResponse.json(
      { ok: false, error: "Property not found." },
      { status: 404 }
    );
  }

  const project = await findOrCreateProject({
    propertyId,
    primaryPartyId: party.id,
    title,
    leafSlug
  });

  // Optional budget hints
  if (
    typeof body.budgetLow === "number" ||
    typeof body.budgetHigh === "number"
  ) {
    await supabaseAdmin
      .from("os_projects")
      .update({
        budget_pence_low:
          typeof body.budgetLow === "number" ? body.budgetLow : null,
        budget_pence_high:
          typeof body.budgetHigh === "number" ? body.budgetHigh : null
      })
      .eq("id", project.id);
  }

  return NextResponse.json({
    ok: true,
    project: {
      id: project.id,
      title: project.title,
      leafSlug: project.leaf_slug,
      status: project.status
    }
  });
}
