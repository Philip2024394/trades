// POST /api/apps/ai-visualiser/leads/status
//
// Merchant flips the lead status. On 'quoted' we also copy the SD
// render URL into render_url_hd for every render tied to this lead
// (in the current wedge SD == HD because gpt-image-1 produces one
// resolution; when we add a higher-res render step we'll swap this
// for a re-render at 2048px).

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "new",
  "viewed",
  "contacted",
  "quoted",
  "won",
  "lost",
  "ignored"
]);

type Body = {
  merchantId?: unknown;
  homeownerId?: unknown;
  status?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const merchantId = await getMerchantIdFromRequest(
    typeof body.merchantId === "string" ? body.merchantId : null
  );
  if (!merchantId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const homeownerId = typeof body.homeownerId === "string" ? body.homeownerId.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!homeownerId || !ALLOWED.has(status)) {
    return NextResponse.json(
      { ok: false, error: "homeownerId + valid status required." },
      { status: 400 }
    );
  }

  // Verify this merchant owns the lead
  const { data: existing } = await supabaseAdmin
    .from("app_ai_visualiser_leads")
    .select("id, merchant_id")
    .eq("homeowner_id", homeownerId)
    .maybeSingle();
  if (!existing || existing.merchant_id !== merchantId) {
    return NextResponse.json(
      { ok: false, error: "Lead not found." },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = { status };
  if (status === "contacted") {
    updates.merchant_replied_at = new Date().toISOString();
  }

  await supabaseAdmin
    .from("app_ai_visualiser_leads")
    .update(updates)
    .eq("id", existing.id);

  // Unlock HD when quoted / won
  if (status === "quoted" || status === "won") {
    await supabaseAdmin
      .from("app_ai_visualiser_renders")
      .update({
        render_url_hd: null // signal: HD is now generated on-demand via /hd/[id]
      })
      .eq("homeowner_id", homeownerId)
      .eq("status", "complete");
  }

  return NextResponse.json({ ok: true });
}
