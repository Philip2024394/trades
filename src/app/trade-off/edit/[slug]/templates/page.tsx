// /trade-off/edit/[slug]/templates — Merchant mobile app template picker.
//
// Server-loads the template catalogue + the merchant's currently
// applied template, then hands off to the client shell which renders
// each template inside an iPhone frame with a live preview of a
// reference canteen (Template 1 = Mike Watson's uk-kitchen-fitters).

import type { Metadata } from "next";
import { TemplatesShell } from "./TemplatesShell";
import { loadMerchantPalette } from "@/lib/paletteTokens.server";
import { listAppTemplates } from "@/lib/appTemplates";
import { canteenBySlugFromDb } from "@/lib/canteens.server";
import { loadFeedTileLibrary } from "@/lib/canteenFeedTileLibrary.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Choose your palette | Thenetworkers",
  robots: { index: false, follow: false }
};

export default async function TemplatesPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Load the merchant's own canteen so the picker can render a
  // "Your canteen" strip at the top showing THEIR data + current
  // template + View app + Go Live CTAs.
  const [palette, templates, myCanteen, feedTileLibrary] = await Promise.all([
    loadMerchantPalette(slug),
    listAppTemplates(),
    canteenBySlugFromDb(slug),
    loadFeedTileLibrary()
  ]);
  return (
    <TemplatesShell
      slug={slug}
      appliedPaletteSlug={palette.slug}
      templates={templates}
      feedTileLibrary={feedTileLibrary}
      myCanteen={myCanteen ? {
        slug:             myCanteen.slug,
        name:             myCanteen.name,
        tradeSlug:        myCanteen.tradeSlug ?? null,
        headerBgUrl:      myCanteen.headerBgUrl,
        templateSlug:     myCanteen.templateSlug ?? "template-1-chalk",
        paletteSlug:      myCanteen.paletteSlug ?? palette.slug,
        themeMode:        myCanteen.themeMode ?? "light",
        paletteIntensity: myCanteen.paletteIntensity ?? "standard",
        heroShade:        myCanteen.heroShade ?? 100,
        feedTileColor:    myCanteen.feedTileColor ?? null,
        feedTileImageUrl: myCanteen.feedTileImageUrl ?? null,
        baseHue:          myCanteen.baseHue ?? null,
        lightness:        myCanteen.lightness ?? null,
        feedTileHue:      myCanteen.feedTileHue ?? null,
        feedTileLightness: myCanteen.feedTileLightness ?? null
      } : null}
    />
  );
}
