// Products — read helpers.
//
// One entry point per read pattern. Every other app that needs to
// resolve a product (AI Visualiser scope, Quote Workspace draft, Job
// Diary warranty registration) calls into this module — never a
// direct SELECT against os_products_* / app_products_*.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rowToCanonical } from "./canonical";
import { rowToOffer } from "./offers";
import type {
  CanonicalProduct,
  MerchantOffer,
  OfferListFilters,
  ProductWithOffers
} from "./types";

export async function findCanonicalById(
  id: string
): Promise<CanonicalProduct | null> {
  const { data } = await supabaseAdmin
    .from("os_products_canonical")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? rowToCanonical(data) : null;
}

export async function findCanonicalByGtin(
  gtin: string
): Promise<CanonicalProduct | null> {
  const { data } = await supabaseAdmin
    .from("os_products_canonical")
    .select("*")
    .eq("gtin", gtin)
    .eq("lifecycle_status", "active")
    .maybeSingle();
  return data ? rowToCanonical(data) : null;
}

export async function loadProductWithOffers(
  canonicalId: string,
  opts: { merchantId?: string } = {}
): Promise<ProductWithOffers | null> {
  const canonical = await findCanonicalById(canonicalId);
  if (!canonical) return null;

  const [variantsRes, offersRes] = await Promise.all([
    supabaseAdmin
      .from("os_products_variants")
      .select("*")
      .eq("canonical_product_id", canonicalId)
      .eq("lifecycle_status", "active"),
    (async () => {
      const q = supabaseAdmin
        .from("app_products_merchant_offers")
        .select("*")
        .eq("canonical_product_id", canonicalId)
        .eq("is_active", true);
      if (opts.merchantId) return q.eq("merchant_id", opts.merchantId);
      return q;
    })()
  ]);

  return {
    canonical,
    variants: (variantsRes.data || []).map((v) => ({
      id: v.id as string,
      canonicalProductId: v.canonical_product_id as string,
      variantAxes: (v.variant_axes as Record<string, string>) ?? {},
      gtin: (v.gtin as string) ?? null,
      mpn: (v.mpn as string) ?? null,
      nameSuffix: (v.name_suffix as string) ?? null,
      heroImageUrl: (v.hero_image_url as string) ?? null,
      imageUrls: (v.image_urls as string[]) ?? [],
      attributesDelta: (v.attributes_delta as Record<string, unknown>) ?? {},
      lifecycleStatus: v.lifecycle_status as CanonicalProduct["lifecycleStatus"]
    })),
    offers: (offersRes.data || []).map(rowToOffer)
  };
}

export async function listMerchantOffers(
  filters: OfferListFilters & { merchantId: string }
): Promise<Array<MerchantOffer & { canonical: CanonicalProduct }>> {
  let q = supabaseAdmin
    .from("app_products_merchant_offers")
    .select("*, os_products_canonical!inner(*)")
    .eq("merchant_id", filters.merchantId);
  if (filters.stockStatus) {
    q = Array.isArray(filters.stockStatus)
      ? q.in("stock_status", filters.stockStatus)
      : q.eq("stock_status", filters.stockStatus);
  }
  if (typeof filters.minPricePence === "number")
    q = q.gte("price_pence", filters.minPricePence);
  if (typeof filters.maxPricePence === "number")
    q = q.lte("price_pence", filters.maxPricePence);
  q = q.order("updated_at", { ascending: false });
  q = q.limit(filters.limit ?? 100);
  if (filters.offset) q = q.range(filters.offset, (filters.offset ?? 0) + (filters.limit ?? 100) - 1);
  const { data } = await q;
  return (data || []).map((r) => {
    const canonicalJoin = (
      r as unknown as {
        os_products_canonical?:
          | Record<string, unknown>
          | Record<string, unknown>[];
      }
    ).os_products_canonical;
    const canonicalRow = Array.isArray(canonicalJoin)
      ? canonicalJoin[0]
      : canonicalJoin;
    return {
      ...rowToOffer(r),
      canonical: rowToCanonical(canonicalRow as Record<string, unknown>)
    };
  });
}

/** Search across active canonical products by partial name / brand.
 *  Uses pg_trgm — cheap at v1 scale. At 10M+ SKUs migrate to
 *  Meilisearch / OpenSearch behind the same signature. */
export async function searchCanonicals(input: {
  q: string;
  limit?: number;
  taxonomyLeafSlug?: string | null;
  categoryPathPrefix?: string[];
}): Promise<CanonicalProduct[]> {
  const term = input.q.trim();
  if (term.length < 2) return [];
  let q = supabaseAdmin
    .from("os_products_canonical")
    .select("*")
    .eq("lifecycle_status", "active");
  if (input.taxonomyLeafSlug)
    q = q.eq("taxonomy_leaf_slug", input.taxonomyLeafSlug);
  if (input.categoryPathPrefix && input.categoryPathPrefix.length > 0)
    q = q.contains("category_path", input.categoryPathPrefix);
  // ilike for portability; pg_trgm index will accelerate real similarity
  q = q.ilike("name", `%${term}%`);
  q = q.limit(input.limit ?? 25);
  const { data } = await q;
  return (data || []).map(rowToCanonical);
}

/** Load a set of offers by their ids — used by Quote Workspace when
 *  drafting a BOM to pull fresh prices. */
export async function loadOffersByIds(
  ids: string[]
): Promise<Map<string, MerchantOffer & { canonical: CanonicalProduct }>> {
  const map = new Map<
    string,
    MerchantOffer & { canonical: CanonicalProduct }
  >();
  if (ids.length === 0) return map;
  const { data } = await supabaseAdmin
    .from("app_products_merchant_offers")
    .select("*, os_products_canonical!inner(*)")
    .in("id", ids);
  for (const row of data || []) {
    const canonicalJoin = (
      row as unknown as {
        os_products_canonical?:
          | Record<string, unknown>
          | Record<string, unknown>[];
      }
    ).os_products_canonical;
    const canonicalRow = Array.isArray(canonicalJoin)
      ? canonicalJoin[0]
      : canonicalJoin;
    map.set(row.id as string, {
      ...rowToOffer(row),
      canonical: rowToCanonical(canonicalRow as Record<string, unknown>)
    });
  }
  return map;
}
