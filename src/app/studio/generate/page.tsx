// Slice E — Landing page: describe app + pick trade → preview.
//
// This is THE loop: the merchant types what they want, picks (or lets
// us detect) their trade, and gets a rendered app back in the preview
// iframe. Composition + KG resolution happen server-side at
// /studio/generate/preview.
//
// Auth: cookie-based Studio session. Trade selector is the full
// TRADE_OFF_TRADES list — the deterministic composer needs a valid
// slug.

import { redirect } from "next/navigation";
import { loadStudioSession } from "@/lib/studio/session";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { GenerateLanding } from "./_client";

export const dynamic = "force-dynamic";

const TRADE_SLUG_SET = new Set(TRADE_OFF_TRADES.map((t) => t.slug));

export default async function StudioGeneratePage({
  searchParams
}: {
  searchParams: Promise<{ prompt?: string; trade?: string; merchantName?: string }>;
}) {
  const session = await loadStudioSession();
  if (!session) redirect("/studio");

  const sp = await searchParams;
  const initialPrompt = typeof sp.prompt === "string" ? sp.prompt : "";
  const initialTrade =
    typeof sp.trade === "string" && TRADE_SLUG_SET.has(sp.trade) ? sp.trade : "";
  const initialMerchantName =
    typeof sp.merchantName === "string" ? sp.merchantName : "";

  return (
    <GenerateLanding
      trades={TRADE_OFF_TRADES.map((t) => ({ slug: t.slug, label: t.label }))}
      initialPrompt={initialPrompt}
      initialTrade={initialTrade}
      initialMerchantName={initialMerchantName}
    />
  );
}
