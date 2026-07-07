// /site-office/apps/ai-visualiser — merchant dashboard for the AI
// Visualiser add-on.
//
// Shows: current plan, monthly quota, renders used, gauge, overage,
// installed catalogue scope, recent leads. From here the merchant
// picks their catalogue leaves and upgrades their plan.
//
// NOTE: merchant auth wiring is out of scope for this file — the
// merchantId is read from a signed cookie via getMerchantId(). For
// initial dev this falls back to a ?m= query param. Replace with the
// project's real merchant-session helper before production.

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { AiVisualiserMerchantPanel } from "./MerchantPanel";

export const dynamic = "force-dynamic";

export default async function AiVisualiserMerchantDashboard({
  searchParams
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const merchantId = await getMerchantIdFromRequest(sp.m || null);
  if (!merchantId) {
    redirect("/site-office?next=/site-office/apps/ai-visualiser");
  }

  const [credits, scope, leaves, leads, merchant] = await Promise.all([
    supabaseAdmin
      .from("app_ai_visualiser_credits")
      .select(
        "tier, monthly_quota, renders_used_this_period, overage_pence, overage_rate_pence, period_ends_at, is_active"
      )
      .eq("merchant_id", merchantId)
      .maybeSingle(),
    supabaseAdmin
      .from("app_ai_visualiser_catalogue_scope")
      .select("leaf_slug, product_count, is_enabled")
      .eq("merchant_id", merchantId),
    supabaseAdmin
      .from("ai_visualiser_taxonomy_leaves")
      .select("slug, trade_slug, display_name")
      .eq("is_active", true)
      .order("trade_slug"),
    supabaseAdmin
      .from("app_ai_visualiser_leads")
      .select(
        "id, homeowner_id, status, render_count, first_render_at, last_render_at, created_at, app_ai_visualiser_homeowners!inner(full_name, email, whatsapp_e164, postcode)"
      )
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, display_name, trading_name, primary_trade")
      .eq("id", merchantId)
      .maybeSingle()
  ]);

  // First-install auto-scope: if the merchant has no scope rows yet,
  // pre-tick every leaf whose trade_slug matches their primary_trade
  // so the UI doesn't greet them with 100 empty checkboxes.
  if (
    scope.data !== null &&
    scope.data.length === 0 &&
    merchant.data?.primary_trade
  ) {
    const primaryTrade = merchant.data.primary_trade;
    const defaults = (leaves.data || []).filter(
      (l) => l.trade_slug === primaryTrade
    );
    if (defaults.length > 0) {
      await supabaseAdmin.from("app_ai_visualiser_catalogue_scope").insert(
        defaults.map((l) => ({
          merchant_id: merchantId,
          leaf_slug: l.slug,
          is_enabled: true
        }))
      );
      scope.data = defaults.map((l) => ({
        leaf_slug: l.slug,
        product_count: 0,
        is_enabled: true
      }));
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <header className="mb-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          {merchant.data?.trading_name ||
            merchant.data?.display_name ||
            "Your business"}
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">AI Visualiser</h1>
        <p className="mt-1 text-[14px] text-neutral-600">
          Homeowners visualise their renovation on your Visualiser tile
          and land in your inbox — with contact details, design choices
          and a rendered preview.
        </p>
      </header>

      <AiVisualiserMerchantPanel
        merchantId={merchantId}
        primaryTrade={merchant.data?.primary_trade ?? null}
        credits={
          credits.data ?? {
            tier: "starter",
            monthly_quota: 100,
            renders_used_this_period: 0,
            overage_pence: 0,
            overage_rate_pence: 30,
            period_ends_at: null,
            is_active: false
          }
        }
        scope={
          (scope.data || []).map((r) => ({
            leaf_slug: r.leaf_slug,
            product_count: r.product_count,
            is_enabled: r.is_enabled
          }))
        }
        leaves={leaves.data || []}
        leads={
          (leads.data || []).map((r) => {
            const h = (
              r as unknown as {
                app_ai_visualiser_homeowners?: {
                  full_name: string;
                  email: string;
                  whatsapp_e164: string;
                  postcode: string;
                };
              }
            ).app_ai_visualiser_homeowners;
            return {
              id: r.id,
              homeowner_id: r.homeowner_id,
              status: r.status,
              render_count: r.render_count,
              created_at: r.created_at,
              last_render_at: r.last_render_at,
              full_name: h?.full_name || "—",
              email: h?.email || "—",
              whatsapp_e164: h?.whatsapp_e164 || "",
              postcode: h?.postcode || ""
            };
          })
        }
      />
    </div>
  );
}
