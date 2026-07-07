// Products — merchant offer helpers.
//
// Constitution:
//   • Writes require merchant to hold the products.merchant entitlement.
//   • Every state change publishes an event.
//   • Uniqueness on (merchant × canonical × variant) — attempts to
//     duplicate return the existing offer with the new values applied.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { publish } from "@/lib/os/events";
import type { MerchantOffer, StockStatus } from "./types";

export type CreateOfferInput = {
  merchantId: string;
  canonicalProductId: string;
  variantId?: string | null;
  merchantSku?: string | null;
  pricePence: number;
  rrpPence?: number | null;
  vatRate?: number;
  stockStatus?: StockStatus;
  stockQuantity?: number | null;
  lowStockThreshold?: number | null;
  leadTimeDays?: number | null;
  deliveryOptions?: Array<{ zone: string; price_pence: number; eta_days: number }>;
  supplierBusinessId?: string | null;
  supplierRangeId?: string | null;
};

export async function upsertOffer(
  input: CreateOfferInput
): Promise<MerchantOffer> {
  // Uniqueness key: (merchant, canonical, variant). Match against
  // NULL variant explicitly since the SQL unique index uses COALESCE.
  const { data: existing } = await supabaseAdmin
    .from("app_products_merchant_offers")
    .select("id")
    .eq("merchant_id", input.merchantId)
    .eq("canonical_product_id", input.canonicalProductId)
    .is("variant_id", input.variantId ?? null)
    .maybeSingle();

  if (existing) {
    return await updateOfferInternal({
      offerId: existing.id as string,
      merchantId: input.merchantId,
      patch: {
        merchant_sku: input.merchantSku ?? null,
        price_pence: input.pricePence,
        rrp_pence: input.rrpPence ?? null,
        vat_rate: input.vatRate ?? 0.2,
        stock_status: input.stockStatus ?? "in_stock",
        stock_quantity: input.stockQuantity ?? null,
        low_stock_threshold: input.lowStockThreshold ?? null,
        lead_time_days: input.leadTimeDays ?? null,
        delivery_options: input.deliveryOptions ?? [],
        supplier_business_id: input.supplierBusinessId ?? null,
        supplier_range_id: input.supplierRangeId ?? null
      },
      eventVerb: "product.updated",
      dedupSuffix: "upserted"
    });
  }

  const { data, error } = await supabaseAdmin
    .from("app_products_merchant_offers")
    .insert({
      merchant_id: input.merchantId,
      canonical_product_id: input.canonicalProductId,
      variant_id: input.variantId ?? null,
      merchant_sku: input.merchantSku ?? null,
      price_pence: input.pricePence,
      rrp_pence: input.rrpPence ?? null,
      vat_rate: input.vatRate ?? 0.2,
      stock_status: input.stockStatus ?? "in_stock",
      stock_quantity: input.stockQuantity ?? null,
      low_stock_threshold: input.lowStockThreshold ?? null,
      lead_time_days: input.leadTimeDays ?? null,
      delivery_options: input.deliveryOptions ?? [],
      supplier_business_id: input.supplierBusinessId ?? null,
      supplier_range_id: input.supplierRangeId ?? null
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create offer: ${error?.message}`);
  }
  const offer = rowToOffer(data);

  await publish({
    eventType: "product.published",
    publisherApp: "products",
    dedupKey: `offer:${offer.id}:created`,
    actorBusinessId: input.merchantId,
    subjectType: "product_offer",
    subjectId: offer.id,
    payload: {
      canonical_product_id: input.canonicalProductId,
      price_pence: input.pricePence,
      stock_status: offer.stockStatus
    }
  });

  return offer;
}

export async function updateOfferPrice(input: {
  offerId: string;
  merchantId: string;
  pricePence: number;
  rrpPence?: number | null;
  promotion?: MerchantOffer["promotion"] | null;
}): Promise<MerchantOffer> {
  const { data: current } = await supabaseAdmin
    .from("app_products_merchant_offers")
    .select("price_pence, canonical_product_id")
    .eq("id", input.offerId)
    .eq("merchant_id", input.merchantId)
    .maybeSingle();
  if (!current) {
    throw new Error("Offer not found or not owned by merchant.");
  }
  const oldPrice = current.price_pence as number;

  const offer = await updateOfferInternal({
    offerId: input.offerId,
    merchantId: input.merchantId,
    patch: {
      price_pence: input.pricePence,
      rrp_pence: input.rrpPence ?? null,
      promotion: input.promotion ?? null
    },
    eventVerb: "product.price_changed",
    dedupSuffix: `price:${input.pricePence}`,
    payloadExtra: {
      old_price_pence: oldPrice,
      new_price_pence: input.pricePence,
      canonical_product_id: current.canonical_product_id
    }
  });
  return offer;
}

export async function updateOfferStock(input: {
  offerId: string;
  merchantId: string;
  stockStatus: StockStatus;
  stockQuantity?: number | null;
}): Promise<MerchantOffer> {
  const { data: current } = await supabaseAdmin
    .from("app_products_merchant_offers")
    .select("stock_status, low_stock_threshold, canonical_product_id")
    .eq("id", input.offerId)
    .eq("merchant_id", input.merchantId)
    .maybeSingle();
  if (!current) {
    throw new Error("Offer not found or not owned by merchant.");
  }

  const offer = await updateOfferInternal({
    offerId: input.offerId,
    merchantId: input.merchantId,
    patch: {
      stock_status: input.stockStatus,
      stock_quantity: input.stockQuantity ?? null
    },
    eventVerb: "product.updated",
    dedupSuffix: `stock:${input.stockStatus}:${input.stockQuantity ?? "n"}`,
    payloadExtra: {
      canonical_product_id: current.canonical_product_id,
      old_stock_status: current.stock_status,
      new_stock_status: input.stockStatus
    }
  });

  // Additionally publish product.stock_low when threshold is crossed
  if (
    input.stockStatus === "low" ||
    input.stockStatus === "out" ||
    (typeof input.stockQuantity === "number" &&
      typeof current.low_stock_threshold === "number" &&
      input.stockQuantity <= (current.low_stock_threshold as number))
  ) {
    await publish({
      eventType: "product.stock_low",
      publisherApp: "products",
      dedupKey: `offer:${input.offerId}:low:${input.stockStatus}`,
      actorBusinessId: input.merchantId,
      subjectType: "product_offer",
      subjectId: input.offerId,
      payload: {
        stock_status: input.stockStatus,
        stock_quantity: input.stockQuantity ?? null,
        threshold: current.low_stock_threshold
      }
    });
  }

  return offer;
}

export async function deactivateOffer(input: {
  offerId: string;
  merchantId: string;
}): Promise<void> {
  await supabaseAdmin
    .from("app_products_merchant_offers")
    .update({ is_active: false })
    .eq("id", input.offerId)
    .eq("merchant_id", input.merchantId);
  await publish({
    eventType: "product.withdrawn",
    publisherApp: "products",
    dedupKey: `offer:${input.offerId}:withdrawn`,
    actorBusinessId: input.merchantId,
    subjectType: "product_offer",
    subjectId: input.offerId
  });
}

// -------------------------------------------------------------------
// Internals
// -------------------------------------------------------------------
async function updateOfferInternal(input: {
  offerId: string;
  merchantId: string;
  patch: Record<string, unknown>;
  eventVerb:
    | "product.published"
    | "product.updated"
    | "product.withdrawn"
    | "product.price_changed"
    | "product.stock_low";
  dedupSuffix: string;
  payloadExtra?: Record<string, unknown>;
}): Promise<MerchantOffer> {
  const { data, error } = await supabaseAdmin
    .from("app_products_merchant_offers")
    .update(input.patch)
    .eq("id", input.offerId)
    .eq("merchant_id", input.merchantId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to update offer: ${error?.message}`);
  }
  const offer = rowToOffer(data);
  await publish({
    eventType: input.eventVerb,
    publisherApp: "products",
    dedupKey: `offer:${input.offerId}:${input.dedupSuffix}`,
    actorBusinessId: input.merchantId,
    subjectType: "product_offer",
    subjectId: input.offerId,
    payload: {
      ...(input.payloadExtra ?? {})
    }
  });
  return offer;
}

export function rowToOffer(row: Record<string, unknown>): MerchantOffer {
  return {
    id: row.id as string,
    merchantId: row.merchant_id as string,
    canonicalProductId: row.canonical_product_id as string,
    variantId: (row.variant_id as string) ?? null,
    merchantSku: (row.merchant_sku as string) ?? null,
    pricePence: row.price_pence as number,
    rrpPence: (row.rrp_pence as number) ?? null,
    vatRate: Number(row.vat_rate),
    stockStatus: row.stock_status as StockStatus,
    stockQuantity: (row.stock_quantity as number) ?? null,
    lowStockThreshold: (row.low_stock_threshold as number) ?? null,
    leadTimeDays: (row.lead_time_days as number) ?? null,
    deliveryOptions:
      (row.delivery_options as Array<{
        zone: string;
        price_pence: number;
        eta_days: number;
      }>) ?? [],
    localImageUrls: (row.local_image_urls as string[]) ?? [],
    localNotes: (row.local_notes as string) ?? null,
    isActive: Boolean(row.is_active),
    isFeatured: Boolean(row.is_featured),
    promotion: (row.promotion as MerchantOffer["promotion"]) ?? null,
    supplierBusinessId: (row.supplier_business_id as string) ?? null,
    supplierRangeId: (row.supplier_range_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}
