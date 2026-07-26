// NEX Centre — read helpers that turn the canonical product tables +
// merchant identity + banner overlay into the flat CentreFeedItem
// shape the NEX Centre feed and centre-search consume.
//
// V1 read model: query-time JOIN via supabaseAdmin. Cheap at the
// current data volume; if the feed grows past ~10k active products we
// promote to a materialised view refreshed on product.published event.
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Amendment
// Reference: docs/architecture/NEX_MASTER_DATA_FLOW_ARCHITECTURE.md

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { centroidOf, haversineKm } from "@/lib/ukPostcodeCentroids";
import type { CentreFeedFilters, CentreFeedItem } from "./types";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

/** List every product currently visible on the NEX Centre. Applies
 *  merchant opt-out (nex_centre_visible=false hides the product),
 *  optional filters (query / category / postcode / price), and
 *  proximity ranking when a postcode is supplied. */
export async function listCentreFeedItems(
  filters: CentreFeedFilters = {}
): Promise<CentreFeedItem[]> {
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(filters.offset ?? 0, 0);

  // Step 1: pull active offers with their canonical + merchant joined
  // and the nex_centre_visible flag honoured.
  let offersQuery = supabaseAdmin
    .from("app_products_merchant_offers")
    .select(
      `
      id,
      merchant_id,
      canonical_product_id,
      price_pence,
      vat_rate,
      stock_status,
      is_active,
      is_featured,
      nex_centre_visible,
      nex_centre_tile_layout,
      created_at,
      updated_at
      `
    )
    .eq("is_active", true)
    .eq("nex_centre_visible", true)
    .range(offset, offset + limit - 1);

  if (filters.min_price_pence !== undefined) {
    offersQuery = offersQuery.gte("price_pence", filters.min_price_pence);
  }
  if (filters.max_price_pence !== undefined) {
    offersQuery = offersQuery.lte("price_pence", filters.max_price_pence);
  }

  const { data: offers } = await offersQuery;
  if (!offers || offers.length === 0) return [];

  const canonicalIds = Array.from(
    new Set(offers.map((o) => o.canonical_product_id as string))
  );
  const merchantIds = Array.from(new Set(offers.map((o) => o.merchant_id as string)));
  const offerIds = offers.map((o) => o.id as string);

  const [canonicalsRes, merchantsRes, bannersRes] = await Promise.all([
    supabaseAdmin
      .from("os_products_canonical")
      .select(
        "id, name, brand_name, slug, description, category_path, hero_image_url, lifecycle_status, published_at"
      )
      .in("id", canonicalIds)
      .eq("lifecycle_status", "active"),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(
        "id, slug, display_name, city, postcode_prefix, lat, lng, status"
      )
      .in("id", merchantIds)
      .eq("status", "live"),
    supabaseAdmin
      .from("app_nex_merchant_assistant_banners")
      .select("offer_id, headline, visual_style, is_active")
      .in("offer_id", offerIds)
      .eq("is_active", true),
  ]);

  const canonicalById = new Map(
    (canonicalsRes.data ?? []).map((c) => [c.id as string, c])
  );
  const merchantById = new Map(
    (merchantsRes.data ?? []).map((m) => [m.id as string, m])
  );
  const bannerByOfferId = new Map(
    (bannersRes.data ?? []).map((b) => [b.offer_id as string, b])
  );

  // Resolve the user's postcode centroid once for proximity ranking
  const userCentroid = filters.postcode
    ? centroidOf(filters.postcode)
    : null;

  let items: CentreFeedItem[] = offers
    .map((o) => {
      const canonical = canonicalById.get(o.canonical_product_id as string);
      const merchant = merchantById.get(o.merchant_id as string);
      if (!canonical || !merchant) return null; // canonical inactive or merchant offline

      const merchantLat = merchant.lat as number | null;
      const merchantLng = merchant.lng as number | null;
      const distanceKm =
        userCentroid && merchantLat != null && merchantLng != null
          ? haversineKm(userCentroid, { lat: merchantLat, lng: merchantLng })
          : null;

      const banner = bannerByOfferId.get(o.id as string);

      const item: CentreFeedItem = {
        kind: "product",
        offer_id: o.id as string,
        canonical_id: canonical.id as string,
        name: canonical.name as string,
        brand_name: canonical.brand_name as string,
        slug: canonical.slug as string,
        description: (canonical.description as string) ?? null,
        price_pence: o.price_pence as number,
        vat_rate: (o.vat_rate as number) ?? 0.2,
        stock_status: o.stock_status as string,
        hero_image_url: (canonical.hero_image_url as string) ?? null,
        category_path: (canonical.category_path as string[]) ?? [],
        merchant_id: o.merchant_id as string,
        merchant_slug: (merchant.slug as string) ?? null,
        merchant_display_name: (merchant.display_name as string) ?? null,
        merchant_city: (merchant.city as string) ?? null,
        merchant_postcode_prefix:
          (merchant.postcode_prefix as string) ?? null,
        merchant_lat: merchantLat,
        merchant_lng: merchantLng,
        distance_km: distanceKm,
        region_match_score:
          distanceKm != null ? Math.max(0, 100 - Math.round(distanceKm)) : null,
        is_promoted: (o.is_featured as boolean) === true,
        active_banner_headline: (banner?.headline as string) ?? null,
        active_banner_visual_style: (banner?.visual_style as string) ?? null,
        published_at: (canonical.published_at as string) ?? null,
      };
      return item;
    })
    .filter((x): x is CentreFeedItem => x !== null);

  // Category filter (substring match on any category_path segment)
  if (filters.category) {
    const c = filters.category.toLowerCase();
    items = items.filter((i) =>
      i.category_path.some((seg) => seg.toLowerCase().includes(c))
    );
  }

  // Query filter (name / brand / description substring)
  if (filters.query) {
    const q = filters.query.toLowerCase();
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.brand_name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q)
    );
  }

  // Ranking:
  //   - Promoted first
  //   - Then by proximity if postcode supplied
  //   - Then most recently published
  items.sort((a, b) => {
    if (a.is_promoted !== b.is_promoted) return a.is_promoted ? -1 : 1;
    if (userCentroid && a.distance_km != null && b.distance_km != null) {
      return a.distance_km - b.distance_km;
    }
    return (b.published_at ?? "").localeCompare(a.published_at ?? "");
  });

  return items;
}
