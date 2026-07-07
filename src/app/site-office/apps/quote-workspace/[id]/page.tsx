// /site-office/apps/quote-workspace/[id] — merchant quote editor.
//
// Draft: full edit. Sent/viewed: header patches only (title/notes),
// items locked (regenerate a new draft to change items).

import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { QuoteEditor } from "./QuoteEditor";

export const dynamic = "force-dynamic";

export default async function QuoteEditorPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const merchantId = await getMerchantIdFromRequest(sp.m || null);
  if (!merchantId) {
    redirect(`/site-office?next=/site-office/apps/quote-workspace/${id}`);
  }

  const { data: quote } = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!quote || quote.merchant_id !== merchantId) notFound();

  const [itemsRes, projectRes, homeownerRes, renderRes] = await Promise.all([
    supabaseAdmin
      .from("app_quote_workspace_quote_items")
      .select("*")
      .eq("quote_id", id)
      .order("position"),
    supabaseAdmin
      .from("os_projects")
      .select("title, leaf_slug")
      .eq("id", quote.project_id)
      .maybeSingle(),
    quote.homeowner_id
      ? supabaseAdmin
          .from("app_ai_visualiser_homeowners")
          .select("full_name, email, whatsapp_e164, postcode")
          .eq("id", quote.homeowner_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    quote.specification_id
      ? supabaseAdmin
          .from("app_ai_visualiser_renders")
          .select("render_url, source_photo_url")
          .eq("specification_id", quote.specification_id)
          .eq("status", "complete")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <QuoteEditor
        quote={{
          id: quote.id,
          title: quote.title,
          status: quote.status,
          shareToken: quote.share_token,
          notes: quote.notes,
          timelineEstimate: quote.timeline_estimate,
          depositPence: quote.deposit_pence,
          materialsPence: quote.materials_pence,
          labourPence: quote.labour_pence,
          discountPence: quote.discount_pence,
          vatPence: quote.vat_pence,
          totalPence: quote.total_pence,
          expiresAt: quote.expires_at,
          sentChannel: quote.sent_channel
        }}
        items={(itemsRes.data || []).map((i) => ({
          position: i.position,
          kind: i.kind,
          label: i.label,
          description: i.description,
          qty: Number(i.qty),
          unit: i.unit,
          unit_price_pence: i.unit_price_pence,
          total_pence: i.total_pence
        }))}
        project={projectRes.data}
        homeowner={homeownerRes.data}
        render={renderRes.data}
      />
    </div>
  );
}
