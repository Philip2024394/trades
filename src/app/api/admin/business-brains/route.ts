// POST /api/admin/business-brains — create a new business + brain in one call
// DELETE /api/admin/business-brains?brainId=… — remove a business + all cascaded rows
//
// Admin-only. Reused by the "Add business" form on the dashboard.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateBody = {
  name?:            unknown;
  primary_domain?:  unknown;
  category_slug?:   unknown;
  sync_frequency?:  unknown;
  crawl_root_url?:  unknown;
};

export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: CreateBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const primaryDomainRaw = typeof body.primary_domain === "string" ? body.primary_domain.trim() : "";
  if (!name)           return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  if (!primaryDomainRaw) return NextResponse.json({ ok: false, error: "domain_required" }, { status: 400 });

  const primaryDomain = primaryDomainRaw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(primaryDomain)) {
    return NextResponse.json({ ok: false, error: "invalid_domain" }, { status: 400 });
  }

  const categorySlug = typeof body.category_slug === "string" ? body.category_slug.trim() || null : null;
  const syncFrequency = typeof body.sync_frequency === "string" &&
    ["manual", "hourly", "daily", "weekly", "monthly"].includes(body.sync_frequency)
      ? body.sync_frequency
      : "weekly";
  const crawlRootUrl = typeof body.crawl_root_url === "string" && body.crawl_root_url.trim()
    ? body.crawl_root_url.trim()
    : null;

  // Insert business (unique on primary_domain)
  const { data: biz, error: bizErr } = await supabaseAdmin
    .from("business_brain_businesses")
    .insert({ name, primary_domain: primaryDomain, category_slug: categorySlug })
    .select("id")
    .single();
  if (bizErr) {
    if (bizErr.code === "23505") {
      return NextResponse.json({ ok: false, error: "domain_already_registered" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: bizErr.message }, { status: 500 });
  }

  // Insert paired brain — nextSyncDueAt starts at now so cron picks it up on next tick
  const { data: brain, error: brainErr } = await supabaseAdmin
    .from("business_brains")
    .insert({
      business_id:      (biz as { id: string }).id,
      status:           "provisioning",
      sync_frequency:   syncFrequency,
      crawl_root_url:   crawlRootUrl,
      next_sync_due_at: new Date().toISOString()
    })
    .select("id")
    .single();
  if (brainErr) {
    return NextResponse.json({ ok: false, error: `brain_create_failed: ${brainErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    business_id: (biz as { id: string }).id,
    brain_id:    (brain as { id: string }).id
  });
}

export async function DELETE(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const brainId = new URL(req.url).searchParams.get("brainId");
  if (!brainId) return NextResponse.json({ ok: false, error: "brain_id_required" }, { status: 400 });

  // Look up business_id then cascade-delete the business (FKs handle the rest)
  const { data: brain } = await supabaseAdmin
    .from("business_brains").select("business_id").eq("id", brainId).maybeSingle();
  const businessId = (brain as { business_id: string } | null)?.business_id;
  if (!businessId) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const { error } = await supabaseAdmin.from("business_brain_businesses").delete().eq("id", businessId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
