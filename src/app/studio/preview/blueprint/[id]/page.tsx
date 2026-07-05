// Blueprint iframe preview page.
//
// Renders a blueprint's built layout in ISOLATION — no Studio chrome,
// no shell, no header. Wrapped by BlueprintPreviewSlideover in an
// <iframe> so responsive Tailwind breakpoints (sm/md/lg) trigger based
// on the iframe's viewport width (375 / 768 / 1280) rather than the
// desktop window width.
//
// Auth: cookie-based Studio session, same as the rest of /studio/*.
// Blueprint id + optional ?page query.

import { notFound } from "next/navigation";
import { loadStudioSession } from "@/lib/studio/session";
import { blueprintRegistry } from "@/lib/studio/blueprints";
import { buildLayoutFromSeeds } from "@/lib/studio/blueprints/buildLayout";
import type { BlueprintSectionSeed } from "@/lib/studio/blueprints";
import { StudioLiveShell } from "@/components/studio/StudioLiveShell";
import { ThemeProvider } from "@/components/studio/ThemeProvider";
import { suggestThemeForTrade } from "@/lib/studio/themePresets";
import { DEFAULT_TOKENS } from "@/lib/studio/tokens";
import type { MerchantData } from "@/lib/studio/sectionTypes";
// Side-effect: register every blueprint before the registry lookup runs.
import "@/lib/studio/blueprints";

export const dynamic = "force-dynamic";

// Placeholder merchant used inside the iframe — identical semantics to
// the slideover's PREVIEW_MERCHANT. Section renderers fall back to
// config-provided defaults where fields are blank; the primaryTrade is
// pulled from the blueprint's canonical trade so Knowledge-Graph-bound
// sections resolve trade-specific defaults (services, FAQs, etc.).
function buildPreviewMerchant(primaryTrade?: string): MerchantData {
  return {
    merchantId: "preview",
    slug: "preview",
    merchantName: "Your business",
    city: "Your area",
    whatsappHref: null,
    brandName: "Your brand",
    domain: {},
    primaryTrade
  };
}

export default async function BlueprintPreviewIframePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await loadStudioSession();
  if (!session) return null;

  const { id } = await params;
  const { page } = await searchParams;
  const pageId = page ?? "home";

  const manifest = blueprintRegistry.get(id);
  if (!manifest) return notFound();

  const seeds =
    (manifest.layout as Record<string, BlueprintSectionSeed[]>)[pageId] ??
    manifest.layout.home;

  // Canonical trade = first slug in the manifest's `trades` array.
  const canonicalTrade = manifest.trades[0];
  const previewMerchant = buildPreviewMerchant(canonicalTrade);

  // Auto-suggest the theme preset for this trade so the preview renders
  // with the appropriate font pair + radius + spacing rhythm.
  const themePreset = suggestThemeForTrade(canonicalTrade);

  const layout = await buildLayoutFromSeeds(seeds, {
    heroPool: pageId === "home" ? manifest.heroPool : undefined,
    // Asset library resolves images from the pool based on trade + style.
    // Deterministic seed uses blueprint id so previews are stable — the
    // same blueprint always previews with the same photo, but two
    // different merchants installing the same blueprint get different
    // rolls at install time (see the install route).
    assetContext: {
      industry: canonicalTrade,
      style: themePreset,
      seed: `preview:${id}`
    }
  });

  return (
    <ThemeProvider
      preset={themePreset}
      className="min-h-screen bg-white text-neutral-900"
    >
      <StudioLiveShell
        layout={layout}
        tokens={DEFAULT_TOKENS}
        data={previewMerchant}
      />
    </ThemeProvider>
  );
}
