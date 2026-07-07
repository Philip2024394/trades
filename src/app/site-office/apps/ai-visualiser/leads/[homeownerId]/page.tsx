// /site-office/apps/ai-visualiser/leads/[homeownerId]
//
// Merchant lead detail. Shows contact, all renders, status controls.
// "Quoted" flips render_url_hd to be downloadable by the homeowner
// via /api/apps/ai-visualiser/hd/[renderId] (signed URL).

import { redirect, notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { LeadDetailPanel } from "./LeadDetailPanel";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ homeownerId: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const [{ homeownerId }, sp] = await Promise.all([params, searchParams]);
  const merchantId = await getMerchantIdFromRequest(sp.m || null);
  if (!merchantId) {
    redirect("/site-office?next=/site-office/apps/ai-visualiser");
  }

  const [homeownerRes, leadRes, rendersRes] = await Promise.all([
    supabaseAdmin
      .from("app_ai_visualiser_homeowners")
      .select(
        "id, full_name, email, whatsapp_e164, home_phone, postcode, created_at, merchant_id"
      )
      .eq("id", homeownerId)
      .maybeSingle(),
    supabaseAdmin
      .from("app_ai_visualiser_leads")
      .select(
        "id, status, render_count, bom_summary, first_render_at, last_render_at, merchant_notified_at, merchant_first_viewed_at, merchant_replied_at"
      )
      .eq("homeowner_id", homeownerId)
      .maybeSingle(),
    supabaseAdmin
      .from("app_ai_visualiser_renders")
      .select(
        "id, leaf_slug, source_photo_url, render_url, render_url_hd, prompt_json, status, was_cache_hit, created_at, completed_at"
      )
      .eq("homeowner_id", homeownerId)
      .order("created_at", { ascending: false })
  ]);

  if (!homeownerRes.data) notFound();
  if (homeownerRes.data.merchant_id !== merchantId) {
    // Lead belongs to a different merchant — refuse.
    redirect("/site-office/apps/ai-visualiser");
  }

  // Mark first viewed once
  if (leadRes.data && !leadRes.data.merchant_first_viewed_at) {
    await supabaseAdmin
      .from("app_ai_visualiser_leads")
      .update({
        merchant_first_viewed_at: new Date().toISOString(),
        status: leadRes.data.status === "new" ? "viewed" : leadRes.data.status
      })
      .eq("id", leadRes.data.id);
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <LeadDetailPanel
        merchantId={merchantId}
        homeowner={homeownerRes.data}
        lead={leadRes.data}
        renders={(rendersRes.data || []).map((r) => ({
          id: r.id,
          leaf_slug: r.leaf_slug,
          source_photo_url: r.source_photo_url,
          render_url: r.render_url,
          render_url_hd: r.render_url_hd,
          status: r.status,
          was_cache_hit: r.was_cache_hit,
          created_at: r.created_at,
          completed_at: r.completed_at,
          prompt_json: r.prompt_json as Record<string, unknown>
        }))}
      />
    </div>
  );
}
