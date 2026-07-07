// GET /api/apps/ai-visualiser/leaf/[slug]
// Returns the taxonomy leaf detail (display name + option arrays) so
// the DesignTree can be populated on the client.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const { data, error } = await supabaseAdmin
    .from("ai_visualiser_taxonomy_leaves")
    .select(
      "slug, display_name, render_style_options, render_material_options, render_colour_options, render_hardware_options"
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, leaf: data });
}
