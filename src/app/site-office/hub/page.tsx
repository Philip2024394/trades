// /site-office/hub — the merchant's daily runway. Not another app
// dashboard — a synthesis surface that answers three questions in
// five seconds: what's on fire? / what earns me money today? / what
// should I do next?
//
// Reads from os_business_hub_snapshots (cached projection). Every
// counter-affecting event invalidates the cache via the business-hub
// subscriber. If cache is stale/missing, live aggregator runs and
// writes back.

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantId } from "@/lib/os/merchantSession";
import { loadHubSnapshotWithCache } from "@/lib/os/hub/cache";
import { BusinessHub } from "./BusinessHub";

export const dynamic = "force-dynamic";

export default async function BusinessHubPage() {
  const merchantId = await getMerchantId();
  if (!merchantId) {
    redirect("/site-office?next=/site-office/hub");
  }
  const [cached, merchant] = await Promise.all([
    loadHubSnapshotWithCache(merchantId),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("display_name, trading_name, primary_trade, city")
      .eq("id", merchantId)
      .maybeSingle()
  ]);

  return (
    <BusinessHub
      merchantName={
        merchant.data?.trading_name ||
        merchant.data?.display_name ||
        "Your business"
      }
      primaryTrade={merchant.data?.primary_trade || null}
      city={merchant.data?.city || null}
      snapshot={cached.snapshot}
      recommendations={cached.recommendations}
    />
  );
}
