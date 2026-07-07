// /site-office/apps/quote-workspace — merchant quote pipeline.

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { QuotePipeline } from "./QuotePipeline";

export const dynamic = "force-dynamic";

export default async function QuoteWorkspaceMerchantPage({
  searchParams
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const merchantId = await getMerchantIdFromRequest(sp.m || null);
  if (!merchantId) {
    redirect("/site-office?next=/site-office/apps/quote-workspace");
  }

  // Leads without a quote yet — pull from renders that haven't been
  // quoted yet. Shows as "Ready to quote" column.
  const [quotesRes, unquotedRendersRes, merchantRes] = await Promise.all([
    supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select(
        "id, title, status, total_pence, sent_at, first_viewed_at, accepted_at, rejected_at, created_at, updated_at, expires_at, homeowner_id"
      )
      .eq("merchant_id", merchantId)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("app_ai_visualiser_renders")
      .select(
        "id, project_id, specification_id, leaf_slug, render_url, source_photo_url, created_at, homeowner_id, app_ai_visualiser_homeowners!inner(full_name, postcode)"
      )
      .eq("merchant_id", merchantId)
      .eq("status", "complete")
      .not("specification_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("display_name, trading_name")
      .eq("id", merchantId)
      .maybeSingle()
  ]);

  const quotes = quotesRes.data || [];
  const homeownerIds = Array.from(
    new Set(quotes.map((q) => q.homeowner_id).filter((v): v is string => Boolean(v)))
  );
  const { data: homeowners } = homeownerIds.length
    ? await supabaseAdmin
        .from("app_ai_visualiser_homeowners")
        .select("id, full_name, postcode")
        .in("id", homeownerIds)
    : { data: [] };
  const homeownerMap = new Map(
    (homeowners || []).map((h) => [h.id, h])
  );

  // De-dupe: any render with a spec that already has a quote should not
  // show as "Ready to quote."
  const quotedSpecIds = new Set(
    quotes.map((q) => (q as unknown as { specification_id?: string }).specification_id).filter(Boolean) as string[]
  );

  const unquoted = (unquotedRendersRes.data || [])
    .filter((r) => !quotedSpecIds.has(r.specification_id as string))
    .slice(0, 20)
    .map((r) => {
      const hoJoin = (
        r as unknown as {
          app_ai_visualiser_homeowners?: { full_name: string; postcode: string } | { full_name: string; postcode: string }[];
        }
      ).app_ai_visualiser_homeowners;
      const ho = Array.isArray(hoJoin) ? hoJoin[0] : hoJoin;
      return {
        renderId: r.id,
        projectId: r.project_id,
        specificationId: r.specification_id,
        leafSlug: r.leaf_slug,
        renderUrl: r.render_url,
        homeownerId: r.homeowner_id,
        homeownerName: ho?.full_name || "Homeowner",
        postcode: ho?.postcode || ""
      };
    });

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <header className="mb-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          {merchantRes.data?.trading_name ||
            merchantRes.data?.display_name ||
            "Your business"}
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Quote Workspace</h1>
        <p className="mt-1 text-[14px] text-neutral-600">
          Every render becomes a draftable quote. Send in one tap. Track
          sent → viewed → accepted → rejected without spreadsheets.
        </p>
      </header>

      <QuotePipeline
        readyToQuote={unquoted}
        quotes={quotes.map((q) => ({
          id: q.id,
          title: q.title,
          status: q.status,
          totalPence: q.total_pence,
          sentAt: q.sent_at,
          firstViewedAt: q.first_viewed_at,
          acceptedAt: q.accepted_at,
          rejectedAt: q.rejected_at,
          expiresAt: q.expires_at,
          updatedAt: q.updated_at,
          homeownerName:
            (q.homeowner_id && homeownerMap.get(q.homeowner_id)?.full_name) || "—",
          postcode:
            (q.homeowner_id && homeownerMap.get(q.homeowner_id)?.postcode) || ""
        }))}
      />
    </div>
  );
}
