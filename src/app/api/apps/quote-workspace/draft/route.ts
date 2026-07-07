// POST /api/apps/quote-workspace/draft
//
// Merchant clicks "Draft quote" against a render → we look up the render's
// project + specification + homeowner + property and hand off to the
// draftQuoteFromSpec helper. Idempotency: if a draft already exists for
// this merchant + specification, we return it instead of creating a new one.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { draftQuoteFromSpec } from "@/lib/quote-workspace/draftFromSpec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  merchantId?: unknown;
  renderId?: unknown;
  projectId?: unknown;
  specificationId?: unknown;
  homeownerId?: unknown;
  labourEstimatePence?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const posted =
    typeof body.merchantId === "string" ? body.merchantId.trim() : null;
  const merchantId = await getMerchantIdFromRequest(posted);
  if (!merchantId) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }

  const renderId =
    typeof body.renderId === "string" ? body.renderId.trim() : "";

  let projectId =
    typeof body.projectId === "string" ? body.projectId.trim() : "";
  let specificationId =
    typeof body.specificationId === "string" ? body.specificationId.trim() : "";
  let homeownerId =
    typeof body.homeownerId === "string" ? body.homeownerId.trim() : "";
  let propertyId = "";
  let homeownerPartyId: string | null = null;

  // If a renderId is supplied, hydrate every foreign key from it — this
  // is the common path when merchant taps "Draft quote" on a lead.
  if (renderId) {
    const { data: render } = await supabaseAdmin
      .from("app_ai_visualiser_renders")
      .select(
        "project_id, specification_id, homeowner_id, merchant_id, app_ai_visualiser_homeowners!inner(property_id, party_id)"
      )
      .eq("id", renderId)
      .maybeSingle();
    if (!render) {
      return NextResponse.json(
        { ok: false, error: "Render not found." },
        { status: 404 }
      );
    }
    if (render.merchant_id !== merchantId) {
      return NextResponse.json(
        { ok: false, error: "Render belongs to a different merchant." },
        { status: 403 }
      );
    }
    projectId = projectId || (render.project_id as string) || "";
    specificationId =
      specificationId || (render.specification_id as string) || "";
    homeownerId = homeownerId || (render.homeowner_id as string) || "";
    const home = (
      render as unknown as {
        app_ai_visualiser_homeowners?:
          | { property_id: string; party_id: string | null }
          | { property_id: string; party_id: string | null }[];
      }
    ).app_ai_visualiser_homeowners;
    const homeObj = Array.isArray(home) ? home[0] : home;
    propertyId = homeObj?.property_id || "";
    homeownerPartyId = homeObj?.party_id ?? null;
  }

  if (!projectId || !propertyId) {
    return NextResponse.json(
      { ok: false, error: "Missing project or property context." },
      { status: 400 }
    );
  }

  // Idempotency — one draft per (merchant, specification) unless the
  // caller explicitly wants a new revision.
  if (specificationId) {
    const { data: existingDraft } = await supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("id, share_token, materials_pence, labour_pence, vat_pence, total_pence")
      .eq("merchant_id", merchantId)
      .eq("specification_id", specificationId)
      .eq("status", "draft")
      .limit(1)
      .maybeSingle();
    if (existingDraft) {
      return NextResponse.json({
        ok: true,
        reused: true,
        quote: {
          id: existingDraft.id,
          shareToken: existingDraft.share_token,
          materialsPence: existingDraft.materials_pence,
          labourPence: existingDraft.labour_pence,
          vatPence: existingDraft.vat_pence,
          totalPence: existingDraft.total_pence
        }
      });
    }
  }

  const labourEstimate =
    typeof body.labourEstimatePence === "number"
      ? body.labourEstimatePence
      : undefined;

  try {
    const draft = await draftQuoteFromSpec({
      merchantId,
      projectId,
      specificationId: specificationId || null,
      homeownerId: homeownerId || null,
      homeownerPartyId,
      propertyId,
      labourEstimatePence: labourEstimate
    });
    return NextResponse.json({ ok: true, quote: draft });
  } catch (err) {
    console.error("[quote-workspace] draft failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not draft the quote." },
      { status: 500 }
    );
  }
}
