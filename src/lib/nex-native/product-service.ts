// src/lib/nex-native/product-service.ts
//
// product-service · CRUD on nex_product.
//
// Doctrine:
//   · Identity Doctrine · business_id UUID FK to nex_business
//   · Anti-fabrication · price/currency come from real inputs · never invent
//   · No fourth product architecture · this is the ONLY NEX product table

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type {
  NexProductInsert,
  NexProductRow,
  NexProductStatus,
  NexProductStockStatus,
  NexUuid,
} from "./types";
import { NEX_PRODUCT_STOCK_STATUSES } from "./types";

/**
 * Update product stock_status · null clears back to "no claim" · value must
 * be one of NEX_PRODUCT_STOCK_STATUSES. Storage untouched on rejection.
 */
export async function updateProductStockStatus(
  id: NexUuid,
  stockStatus: NexProductStockStatus | null
): Promise<NexProductRow> {
  if (stockStatus !== null && !NEX_PRODUCT_STOCK_STATUSES.includes(stockStatus)) {
    throw new Error(
      `product-service.updateProductStockStatus: unknown stock_status '${stockStatus}' · allowed: ${NEX_PRODUCT_STOCK_STATUSES.join(", ")}`
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ stock_status: stockStatus })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductStockStatus: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** SKU shape must match DB CHECK on nex_product.sku (migration 030). */
export const NEX_PRODUCT_SKU_PATTERN = /^[A-Za-z0-9._-]{1,50}$/;

/** Update a product's SKU · empty/whitespace clears to null · pattern-checked
 *  · uniqueness is enforced by the partial unique index (migration 030) which
 *  surfaces as a duplicate-key error on save. */
export async function updateProductSku(
  id: NexUuid,
  sku: string | null,
): Promise<NexProductRow> {
  let normalised: string | null = null;
  if (sku !== null && sku !== undefined) {
    const trimmed = sku.trim();
    if (trimmed.length > 0) {
      if (!NEX_PRODUCT_SKU_PATTERN.test(trimmed)) {
        throw new Error(
          `product-service.updateProductSku: invalid shape · must match ${NEX_PRODUCT_SKU_PATTERN.source}`
        );
      }
      normalised = trimmed;
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ sku: normalised })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductSku: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

// ---------------------------------------------------------------------------
// Slice 6c · Product variants MVP
// ---------------------------------------------------------------------------
import type { NexProductVariantInsert, NexProductVariantRow } from "./types";

export const NEX_PRODUCT_VARIANT_NAME_MAX = 200 as const;
export const NEX_PRODUCT_VARIANT_NAME_MIN = 1 as const;

/** Create a new variant on a product. Trims name · validates length + optional price. */
export async function createVariant(input: NexProductVariantInsert): Promise<NexProductVariantRow> {
  const name = input.name.trim();
  if (name.length < NEX_PRODUCT_VARIANT_NAME_MIN || name.length > NEX_PRODUCT_VARIANT_NAME_MAX) {
    throw new Error(
      `product-service.createVariant: name must be ${NEX_PRODUCT_VARIANT_NAME_MIN}..${NEX_PRODUCT_VARIANT_NAME_MAX} chars`,
    );
  }
  let pricePence: number | null = null;
  if (input.price_pence !== undefined && input.price_pence !== null) {
    if (!Number.isInteger(input.price_pence) || input.price_pence < 0) {
      throw new Error("product-service.createVariant: price_pence must be a non-negative integer");
    }
    pricePence = input.price_pence;
  }
  const position = input.position ?? 0;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_variant")
    .insert({
      product_id: input.product_id,
      name,
      price_pence: pricePence,
      position,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`product-service.createVariant: ${error?.message ?? "no row returned"}`);
  }
  return data as NexProductVariantRow;
}

/** List variants for a product, ordered by position then created_at. */
export async function listVariants(productId: NexUuid): Promise<NexProductVariantRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_variant")
    .select("*")
    .eq("product_id", productId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`product-service.listVariants: ${error.message}`);
  return (data as NexProductVariantRow[]) ?? [];
}

/** Partial-update a variant (name / price / position). Trims name. */
export async function updateVariant(
  id: NexUuid,
  patch: { name?: string; price_pence?: number | null; position?: number },
): Promise<NexProductVariantRow> {
  const update: Record<string, string | number | null> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < NEX_PRODUCT_VARIANT_NAME_MIN || name.length > NEX_PRODUCT_VARIANT_NAME_MAX) {
      throw new Error(
        `product-service.updateVariant: name must be ${NEX_PRODUCT_VARIANT_NAME_MIN}..${NEX_PRODUCT_VARIANT_NAME_MAX} chars`,
      );
    }
    update.name = name;
  }
  if (patch.price_pence !== undefined) {
    if (patch.price_pence === null) {
      update.price_pence = null;
    } else {
      if (!Number.isInteger(patch.price_pence) || patch.price_pence < 0) {
        throw new Error("product-service.updateVariant: price_pence must be a non-negative integer");
      }
      update.price_pence = patch.price_pence;
    }
  }
  if (patch.position !== undefined) {
    if (!Number.isInteger(patch.position) || patch.position < 0) {
      throw new Error("product-service.updateVariant: position must be a non-negative integer");
    }
    update.position = patch.position;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_variant")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`product-service.updateVariant: ${error?.message ?? "no row returned"}`);
  }
  return data as NexProductVariantRow;
}

/** Delete a variant. Idempotent · missing row is a no-op. */
export async function deleteVariant(id: NexUuid): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_product_variant")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`product-service.deleteVariant: ${error.message}`);
}

/** Get one variant by id · null when not found. */
export async function getVariantById(id: NexUuid): Promise<NexProductVariantRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_variant")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`product-service.getVariantById: ${error.message}`);
  return (data as NexProductVariantRow | null) ?? null;
}

/** Read one product by NEX UUID · null when not found. */
export async function getProductById(id: NexUuid): Promise<NexProductRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`product-service.getProductById: ${error.message}`);
  return (data as NexProductRow) ?? null;
}

/** List every product for a given business · optionally filtered by status. */
export async function listProductsByBusiness(
  businessId: NexUuid,
  status?: NexProductStatus
): Promise<NexProductRow[]> {
  let q = nexSupabaseAdmin.from("nex_product").select("*").eq("business_id", businessId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`product-service.listProductsByBusiness: ${error.message}`);
  return (data as NexProductRow[]) ?? [];
}

/** Create a new product. Fails if business doesn't exist (FK). */
export async function createProduct(input: NexProductInsert): Promise<NexProductRow> {
  // Tier gate · Gratis owners capped at 10 live/draft products per business.
  // Migration 046 · Indonesia launch package doctrine 2026-09-27.
  await (await import("./tier-gate")).assertCanCreateProduct(input.business_id);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .insert({
      business_id: input.business_id,
      name: input.name,
      description: input.description ?? null,
      image_url: input.image_url ?? null,
      gallery_urls: input.gallery_urls && input.gallery_urls.length > 0 ? input.gallery_urls : null,
      tags: input.tags && input.tags.length > 0 ? input.tags : null,
      stock_status: input.stock_status ?? null,
      price_pence: input.price_pence,
      currency: input.currency,
      status: input.status ?? "draft",
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.createProduct: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

const GALLERY_MAX_ENTRIES = 10;
const GALLERY_URL_MAX_CHARS = 1024;
const TAG_MAX_ENTRIES = 20;
const TAG_MAX_CHARS = 40;
/** Slug-style tag pattern: lowercase alphanumeric + hyphens · 1..40 chars ·
 *  no leading or trailing hyphen. Deliberately narrow so search + display
 *  behave consistently. */
const TAG_PATTERN = /^[a-z0-9]([-a-z0-9]{0,38}[a-z0-9])?$/;

/**
 * Update the optional tags array · normalises + validates · idempotent.
 *   · lowercased and trimmed
 *   · dedup case-insensitive after normalisation, preserving first-seen order
 *   · each tag must match TAG_PATTERN
 *   · array size ≤ 20 (matches DB CHECK)
 * Empty array (or all whitespace) normalises to NULL · never a fabricated
 * placeholder tag. Prior storage untouched on any rejection.
 */
export async function updateProductTags(
  id: NexUuid,
  tags: string[] | null
): Promise<NexProductRow> {
  let value: string[] | null;
  if (tags === null) {
    value = null;
  } else {
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of tags) {
      if (typeof raw !== "string") continue;
      const t = raw.trim().toLowerCase();
      if (t.length === 0) continue;
      if (t.length > TAG_MAX_CHARS) {
        throw new Error(
          `product-service.updateProductTags: tag '${t.slice(0, 20)}…' exceeds ${TAG_MAX_CHARS} chars`
        );
      }
      if (!TAG_PATTERN.test(t)) {
        throw new Error(
          `product-service.updateProductTags: tag '${t}' must match ^[a-z0-9]([-a-z0-9]{0,38}[a-z0-9])?$ · lowercase alphanumeric + hyphens · no leading/trailing hyphen`
        );
      }
      if (seen.has(t)) continue;
      seen.add(t);
      cleaned.push(t);
    }
    if (cleaned.length === 0) {
      value = null;
    } else if (cleaned.length > TAG_MAX_ENTRIES) {
      throw new Error(
        `product-service.updateProductTags: max ${TAG_MAX_ENTRIES} tags · got ${cleaned.length}`
      );
    } else {
      value = cleaned;
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ tags: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductTags: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/**
 * Update the optional gallery array. Empty array is normalised to NULL
 * (no fabricated placeholder). Each URL must:
 *   · start with http:// or https://
 *   · be ≤ 1024 chars
 * Whole array must be ≤ 10 entries. Any violation throws · prior storage
 * untouched. Idempotent.
 */
export async function updateProductGalleryUrls(
  id: NexUuid,
  urls: string[] | null
): Promise<NexProductRow> {
  let value: string[] | null;
  if (urls === null) {
    value = null;
  } else {
    // Trim + drop empties before checking length so callers may supply loose input
    const cleaned = urls.map((u) => (typeof u === "string" ? u.trim() : ""))
      .filter((u) => u.length > 0);
    if (cleaned.length === 0) {
      value = null;
    } else {
      if (cleaned.length > GALLERY_MAX_ENTRIES) {
        throw new Error(
          `product-service.updateProductGalleryUrls: max ${GALLERY_MAX_ENTRIES} entries · got ${cleaned.length}`
        );
      }
      for (let i = 0; i < cleaned.length; i++) {
        const u = cleaned[i]!;
        if (u.length > GALLERY_URL_MAX_CHARS) {
          throw new Error(
            `product-service.updateProductGalleryUrls: entry ${i} exceeds ${GALLERY_URL_MAX_CHARS} chars`
          );
        }
        if (!/^https?:\/\//i.test(u)) {
          throw new Error(
            `product-service.updateProductGalleryUrls: entry ${i} must start with http:// or https:// · got ${u.slice(0, 32)}…`
          );
        }
      }
      value = cleaned;
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ gallery_urls: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductGalleryUrls: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** Update product image URL · nullable · http/https prefix required · trimmed by caller.
 *  Empty string is normalised to NULL. Cap at 1024 chars (mirrors migration 015 CHECK). */
export async function updateProductImageUrl(
  id: NexUuid,
  imageUrl: string | null
): Promise<NexProductRow> {
  let value: string | null = imageUrl;
  if (typeof value === "string") {
    value = value.trim();
    if (value.length === 0) value = null;
    else if (value.length > 1024) {
      throw new Error(
        `product-service.updateProductImageUrl: image_url max 1024 chars · got ${value.length}`
      );
    } else if (!/^https?:\/\//i.test(value)) {
      throw new Error(
        `product-service.updateProductImageUrl: image_url must start with http:// or https:// · got ${value.slice(0, 32)}…`
      );
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ image_url: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductImageUrl: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** Update product status (draft → live → archived). Other fields are
 *  intentionally NOT updatable here · commercial-fact edits go through a
 *  separate governance path when needed. */
export async function updateProductStatus(
  id: NexUuid,
  status: NexProductStatus
): Promise<NexProductRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductStatus: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** Update product description · nullable · trimmed by the caller.
 *  Storage-layer contract: max 2000 chars (soft cap enforced here to
 *  match the manage UI · database column is unbounded text). Empty
 *  string is normalised to NULL. */
export async function updateProductDescription(
  id: NexUuid,
  description: string | null
): Promise<NexProductRow> {
  let value: string | null = description;
  if (typeof value === "string") {
    value = value.trim();
    if (value.length === 0) value = null;
    else if (value.length > 2000) {
      throw new Error(
        `product-service.updateProductDescription: description max 2000 chars · got ${value.length}`
      );
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ description: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductDescription: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}

/** Update product price (integer pence · never float). Callers must
 *  validate the pence value upstream (positive · to the penny) · this
 *  helper enforces only the storage-layer contract (positive integer). */
export async function updateProductPrice(
  id: NexUuid,
  pricePence: number
): Promise<NexProductRow> {
  if (!Number.isInteger(pricePence) || pricePence <= 0) {
    throw new Error(
      `product-service.updateProductPrice: price_pence must be a positive integer · got ${pricePence}`
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ price_pence: pricePence })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-service.updateProductPrice: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexProductRow;
}
