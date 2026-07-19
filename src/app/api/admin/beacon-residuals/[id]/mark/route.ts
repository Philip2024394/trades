// GET/POST /api/admin/beacon-residuals/[id]/mark?status=<status>
//
// Flip a residual's outreach_status. Called from the admin dashboard
// row actions. Redirects back to /admin/beacon-residuals on GET.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["pending", "in_progress", "converted", "dropped"]);

async function handle(req: Request, params: Promise<{ id: string }>) {
  const { id } = await params;
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  if (!ALLOWED.has(status)) {
    return NextResponse.json({ ok: false, error: "invalid-status" }, { status: 400 });
  }
  const patch: Record<string, unknown> = { outreach_status: status };
  if (status === "in_progress" || status === "converted") {
    patch.outreach_at = new Date().toISOString();
  }
  const res = await supabaseAdmin
    .from("hammerex_beacon_admin_residuals")
    .update(patch)
    .eq("id", id);
  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }
  const back = new URL("/admin/beacon-residuals", req.url);
  return NextResponse.redirect(back);
}

export function GET(req: Request, ctx: { params: Promise<{ id: string }> })  { return handle(req, ctx.params); }
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { return handle(req, ctx.params); }
