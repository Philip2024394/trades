// /apps — public App Warehouse.
//
// Browse by trade, filter by category, free/paid split.
//
// Every merchant on the platform gets the free-tier apps bundled with
// their £14.99/mo. Pro apps are paid add-ons. This page is the shop-
// front — merchants land here, filter by their trade, see what's
// available, and install with one click (from Studio).

import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { AppWarehouseBrowser } from "@/components/apps/AppWarehouseBrowser";

export const dynamic = "force-dynamic";

export default async function AppWarehousePage({
  searchParams
}: {
  searchParams: Promise<{ trade?: string; category?: string; tier?: "free" | "pro" }>;
}) {
  const sp = await searchParams;
  return (
    <AppWarehouseBrowser
      trades={TRADE_OFF_TRADES.map((t) => ({ slug: t.slug, label: t.label }))}
      initialTrade={typeof sp.trade === "string" ? sp.trade : ""}
      initialCategory={typeof sp.category === "string" ? sp.category : ""}
      initialTier={sp.tier ?? ""}
    />
  );
}
