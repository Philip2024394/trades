// Slice E — Generate preview (iframe body).
//
// Server-renders a composed home layout directly from URL params so it
// can be iframed by the interactive shell at /studio/generate. Same
// pattern as the blueprint preview page — no Studio chrome, full page,
// responsive Tailwind breakpoints activate on the iframe's own viewport.
//
// Query params:
//   ?trade=<slug>       required — the KG package to compose against
//   ?prompt=<text>      optional — used to seed hero copy hints
//   ?merchantName=...   optional — display name override
//   ?emergency=1        optional — force emergency-first hero
//   ?product=1          optional — force product-showroom hero

import { loadStudioSession } from "@/lib/studio/session";
import { StudioLiveShell } from "@/components/studio/StudioLiveShell";
import { ThemeProvider } from "@/components/studio/ThemeProvider";
import { DEFAULT_TOKENS } from "@/lib/studio/tokens";
import type { MerchantData } from "@/lib/studio/sectionTypes";
import { composeHomeLayout } from "@/lib/studio/generate/composeLayout";
import { buildLayoutFromSeeds } from "@/lib/studio/blueprints/buildLayout";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { packageForTrade } from "@/lib/knowledge";
import { suggestThemeForTrade } from "@/lib/studio/themePresets";

export const dynamic = "force-dynamic";

function buildPreviewMerchant(primaryTrade: string, merchantName?: string): MerchantData {
  return {
    merchantId: "generate-preview",
    slug: "generate-preview",
    merchantName: merchantName?.trim() || "Your business",
    city: "Your area",
    whatsappHref: null,
    brandName: merchantName?.trim() || "Your brand",
    domain: {},
    primaryTrade
  };
}

const TRADE_SLUG_SET = new Set(TRADE_OFF_TRADES.map((t) => t.slug));

export default async function GeneratePreviewPage({
  searchParams
}: {
  searchParams: Promise<{
    trade?: string;
    prompt?: string;
    merchantName?: string;
    emergency?: string;
    product?: string;
  }>;
}) {
  const session = await loadStudioSession();
  if (!session) return null;

  const sp = await searchParams;
  const tradeSlug = (sp.trade ?? "").trim();
  if (!tradeSlug || !TRADE_SLUG_SET.has(tradeSlug)) {
    return (
      <div className="p-6 text-sm text-neutral-700">
        <p className="font-bold">Missing or unknown trade slug.</p>
        <p className="mt-1 text-neutral-500">Add ?trade=&lt;slug&gt; to the URL.</p>
      </div>
    );
  }
  if (!packageForTrade(tradeSlug)) {
    return (
      <div className="p-6 text-sm text-neutral-700">
        <p className="font-bold">No Knowledge Graph package for &quot;{tradeSlug}&quot;.</p>
        <p className="mt-1 text-neutral-500">Section content would be empty. Register a KG package first.</p>
      </div>
    );
  }

  const themePresetId = suggestThemeForTrade(tradeSlug);
  const composed = composeHomeLayout({
    tradeSlug,
    prompt: sp.prompt,
    merchantName: sp.merchantName,
    emergencyFirst: sp.emergency === "1",
    productFirst: sp.product === "1",
    seed: `generate-preview:${session.brand.id}:${tradeSlug}`
  });

  const layout = await buildLayoutFromSeeds(composed.seeds, {
    assetContext: {
      industry: tradeSlug,
      style: themePresetId,
      seed: `generate-preview:${session.brand.id}:${tradeSlug}`
    }
  });

  const merchant = buildPreviewMerchant(tradeSlug, sp.merchantName);

  return (
    <ThemeProvider
      preset={themePresetId}
      className="min-h-screen bg-white text-neutral-900"
    >
      <StudioLiveShell layout={layout} tokens={DEFAULT_TOKENS} data={merchant} />
    </ThemeProvider>
  );
}
