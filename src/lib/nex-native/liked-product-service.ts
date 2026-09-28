// src/lib/nex-native/liked-product-service.ts
//
// Bridge 18 · Liked products service. Wraps nex_liked_product
// (migration 074) · idempotent toggle + read helpers.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid, NexTimestamp, NexProductRow, NexBusinessRow } from "./types";

export interface NexLikedProductRow {
  id: NexUuid;
  liker_account_id: NexUuid;
  product_id: NexUuid;
  liked_at: NexTimestamp;
}

/** Idempotent · returns the like row whether it existed or was just
 *  inserted. Safe to call from a "toggle to liked" path. */
export async function likeProduct(
  likerAccountId: NexUuid,
  productId: NexUuid,
): Promise<NexLikedProductRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_liked_product")
    .upsert(
      { liker_account_id: likerAccountId, product_id: productId },
      { onConflict: "liker_account_id,product_id", ignoreDuplicates: false },
    )
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `liked-product-service.likeProduct: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexLikedProductRow;
}

/** Idempotent · returns true whether or not a row was removed. */
export async function unlikeProduct(
  likerAccountId: NexUuid,
  productId: NexUuid,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_liked_product")
    .delete()
    .eq("liker_account_id", likerAccountId)
    .eq("product_id", productId);
  if (error) {
    throw new Error(`liked-product-service.unlikeProduct: ${error.message}`);
  }
}

/** Delete N liked rows by id · used by the bulk-delete tick-box flow
 *  on /nex-native/liked. Owner-check is done by callers before
 *  invoking this. */
export async function deleteLikedRowsByIds(
  likerAccountId: NexUuid,
  ids: NexUuid[],
): Promise<number> {
  if (!ids || ids.length === 0) return 0;
  const { error, count } = await nexSupabaseAdmin
    .from("nex_liked_product")
    .delete({ count: "exact" })
    .eq("liker_account_id", likerAccountId)
    .in("id", ids);
  if (error) {
    throw new Error(
      `liked-product-service.deleteLikedRowsByIds: ${error.message}`,
    );
  }
  return count ?? 0;
}

/** True when the viewer has liked this product. */
export async function isLikedByViewer(
  likerAccountId: NexUuid,
  productId: NexUuid,
): Promise<boolean> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_liked_product")
    .select("*", { count: "exact", head: true })
    .eq("liker_account_id", likerAccountId)
    .eq("product_id", productId);
  if (error) {
    throw new Error(`liked-product-service.isLikedByViewer: ${error.message}`);
  }
  return (count ?? 0) > 0;
}

export interface LikedProductBundle {
  liked_id: NexUuid;
  liked_at: NexTimestamp;
  product: NexProductRow;
  business: NexBusinessRow;
}

/** Full liked collection joined with product + business rows so the
 *  /nex-native/liked page can render everything in one hit. Sorted
 *  by most-recently-liked first. */
export async function listLikedForViewer(
  likerAccountId: NexUuid,
): Promise<LikedProductBundle[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_liked_product")
    .select("id, liked_at, product:nex_product(*, business:nex_business(*))")
    .eq("liker_account_id", likerAccountId)
    .order("liked_at", { ascending: false });
  if (error) {
    throw new Error(`liked-product-service.listLikedForViewer: ${error.message}`);
  }
  const rows =
    (data as unknown as Array<{
      id: NexUuid;
      liked_at: NexTimestamp;
      product: NexProductRow & { business: NexBusinessRow };
    }>) ?? [];
  return rows
    .filter((r) => r.product && r.product.business)
    .map((r) => ({
      liked_id: r.id,
      liked_at: r.liked_at,
      product: r.product,
      business: r.product.business,
    }));
}
