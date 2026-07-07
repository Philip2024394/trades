// Storefront add-on hydrator.
//
// Called from /trade/[slug] (Module 21 render path) BEFORE
// MerchantData is handed to StudioLiveShell. Populates two well-known
// slots on `data.domain`:
//
//   data.domain.addonsEnabled: Record<slug, boolean>
//   data.domain.addons: Record<slug, unknown>   ← per-addon payload
//
// Each add-on wrapper in `sections/addons/*.tsx` reads its own slot via
// the adapter helpers. Adding a new add-on wrapper adds one hydrator
// case here — if a wrapper needs data the hydrator doesn't provide, it
// renders its placeholder in edit mode and nothing in published mode.
//
// Optimisation: we only hydrate add-ons whose section instance appears
// in the layout. A merchant with 20 add-ons enabled but a layout using
// only 2 pays for exactly 2 hydrations.

import type { HammerexTradeOffListing } from "@/lib/supabase";
import type { StudioLayoutJson } from "./schema";
import { isAddonEnabled } from "@/lib/xratedAddons";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ADDON_ID_PREFIX = "addon.";

export type AddonDomainPayload = {
  addonsEnabled: Record<string, boolean>;
  addons: Record<string, unknown>;
};

/** Return the set of addon slugs referenced by a layout. Sections
 *  registered as `addon.<slug>` contribute their slug; any other
 *  section id is ignored. */
export function collectAddonSlugsFromLayout(
  layout: StudioLayoutJson
): string[] {
  const slugs = new Set<string>();
  for (const section of layout.sections) {
    if (section.key.startsWith(ADDON_ID_PREFIX)) {
      slugs.add(section.key.slice(ADDON_ID_PREFIX.length));
    }
  }
  return Array.from(slugs);
}

/** Hydrate the addon domain payload for a listing's published layout.
 *  Never throws — an unresolved add-on quietly leaves its slot empty
 *  and the wrapper's placeholder handles the void. */
export async function hydrateAddonDomain(
  listing: HammerexTradeOffListing,
  layout: StudioLayoutJson
): Promise<AddonDomainPayload> {
  const slugs = collectAddonSlugsFromLayout(layout);
  const addonsEnabled: Record<string, boolean> = {};
  const addons: Record<string, unknown> = {};

  for (const slug of slugs) {
    addonsEnabled[slug] = isAddonEnabled(listing, slug);
    switch (slug) {
      case "meet_the_team": {
        const members = listing.team_members ?? [];
        addons[slug] = { members };
        break;
      }
      case "newsletter": {
        addons[slug] = { enabled: true };
        break;
      }
      case "trade_connections": {
        // Full carousel data (cards) is per-PDP — home pages get an
        // empty cards array so the wrapper skips rendering silently.
        // The PDP hydrator (product-page route) will populate the real
        // cards when that page-level probe lands.
        addons[slug] = { cards: [], productSlug: "" };
        break;
      }
      case "ai_visualiser": {
        // Load the merchant's ticked catalogue leaves so the tile can
        // render its trade-specific copy + so the flow knows what to
        // pass to the design tree. If no leaves are ticked the tile
        // won't render — the wrapper handles the empty scope silently.
        const { data: scopeRows } = await supabaseAdmin
          .from("app_ai_visualiser_catalogue_scope")
          .select(
            "leaf_slug, ai_visualiser_taxonomy_leaves!inner(display_name, synonyms)"
          )
          .eq("merchant_id", listing.id)
          .eq("is_enabled", true);
        type LeafJoin = { display_name: string; synonyms: string[] };
        const scope = (scopeRows || []).map((r) => {
          const rawLeaf = (
            r as unknown as {
              ai_visualiser_taxonomy_leaves?: LeafJoin | LeafJoin[];
            }
          ).ai_visualiser_taxonomy_leaves;
          const leaf = Array.isArray(rawLeaf) ? rawLeaf[0] : rawLeaf;
          return {
            slug: r.leaf_slug as string,
            display_name: leaf?.display_name ?? r.leaf_slug,
            synonyms: leaf?.synonyms ?? []
          };
        });
        addons[slug] = {
          merchantId: listing.id,
          merchantDisplayName:
            listing.trading_name || listing.display_name || "us",
          scope,
          primaryLeafSlug: scope[0]?.slug ?? null
        };
        break;
      }
      default:
        // Unknown addon slug in the layout — leave slot empty so the
        // wrapper's placeholder handles it.
        break;
    }
  }

  return { addonsEnabled, addons };
}
