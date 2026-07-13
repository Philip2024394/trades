// POST /api/apps/ai-visualiser/leads/promote
//
// Called when the homeowner taps "Send to merchant" on the render
// viewer. Marks the lead as hot ('contacted' status) and re-notifies
// the merchant with the current design. Idempotent — safe to call
// multiple times, only sends one email per render.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMerchantLeadEmail } from "@/lib/ai-visualiser/notifyMerchant";
import { summariseChoices } from "@/lib/ai-visualiser/promptBuilder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = { renderId?: unknown };

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const renderId = typeof body.renderId === "string" ? body.renderId.trim() : "";
  if (!renderId) {
    return NextResponse.json(
      { ok: false, error: "renderId required" },
      { status: 400 }
    );
  }

  const { data: render, error } = await supabaseAdmin
    .from("app_ai_visualiser_renders")
    .select(
      "id, merchant_id, homeowner_id, leaf_slug, render_url, prompt_json, ai_visualiser_taxonomy_leaves:leaf_slug!inner(display_name, render_style_options, render_material_options, render_colour_options, render_hardware_options)"
    )
    .eq("id", renderId)
    .maybeSingle();

  if (error || !render) {
    return NextResponse.json(
      { ok: false, error: "Render not found." },
      { status: 404 }
    );
  }

  const { data: homeowner } = await supabaseAdmin
    .from("app_ai_visualiser_homeowners")
    .select("full_name, email, whatsapp_e164, home_phone, postcode")
    .eq("id", render.homeowner_id)
    .maybeSingle();
  const { data: merchant } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("email, display_name, trading_name")
    .eq("id", render.merchant_id)
    .maybeSingle();

  if (!homeowner || !merchant?.email) {
    return NextResponse.json(
      { ok: false, error: "Missing homeowner or merchant contact." },
      { status: 404 }
    );
  }

  const leaf = (
    render as unknown as {
      ai_visualiser_taxonomy_leaves?: {
        display_name: string;
        render_style_options: Array<{ key: string; label: string }>;
        render_material_options: Array<{ key: string; label: string }>;
        render_colour_options: Array<{ key: string; label: string; hex?: string }>;
        render_hardware_options: Array<{ key: string; label: string }>;
      };
    }
  ).ai_visualiser_taxonomy_leaves;
  const prompt = render.prompt_json as {
    style?: string;
    material?: string;
    colour?: string;
    hardware?: string[];
  };
  const styleOpt = leaf?.render_style_options.find((o) => o.key === prompt.style);
  const materialOpt = leaf?.render_material_options.find(
    (o) => o.key === prompt.material
  );
  const colourOpt = leaf?.render_colour_options.find((o) => o.key === prompt.colour);
  const hardware = (prompt.hardware || [])
    .map((k) => leaf?.render_hardware_options.find((o) => o.key === k))
    .filter((h): h is { key: string; label: string } => Boolean(h));

  const designSummary =
    styleOpt && materialOpt && colourOpt
      ? summariseChoices({
          style: styleOpt,
          material: materialOpt,
          colour: colourOpt,
          hardware
        })
      : "Design details in dashboard";

  await supabaseAdmin
    .from("app_ai_visualiser_leads")
    .update({
      status: "contacted",
      hottest_render_id: renderId,
      merchant_notified_at: new Date().toISOString()
    })
    .eq("homeowner_id", render.homeowner_id);

  void sendMerchantLeadEmail({
    merchantEmail: merchant.email,
    merchantDisplayName:
      merchant.trading_name || merchant.display_name || "there",
    homeowner: {
      fullName: homeowner.full_name,
      email: homeowner.email,
      whatsappE164: homeowner.whatsapp_e164,
      homePhone: homeowner.home_phone,
      postcode: homeowner.postcode
    },
    leafDisplayName: leaf?.display_name || render.leaf_slug,
    designSummary,
    renderThumbUrl: render.render_url || undefined,
    dashboardLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://thenetworkers.app"}/dashboard/leads/${render.homeowner_id}`,
    isFirstContact: false
  });

  return NextResponse.json({ ok: true });
}
