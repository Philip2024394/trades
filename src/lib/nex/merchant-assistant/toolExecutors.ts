// NEX Merchant Assistant — server-side tool executors.
//
// NEX proposes a tool call → this file runs it. Every executor:
//   1. Re-validates merchant ownership (defence-in-depth beyond RLS
//      and beyond the endpoint's session check).
//   2. Calls existing Products app helpers (never bypasses them).
//   3. Runs generated text through guardrails.ts before storage.
//   4. Returns a ToolExecutionResult<T> — stable contract regardless
//      of tool.
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Section 11
// Reference: src/lib/products/read.ts · listMerchantOffers /
//            loadProductWithOffers
//
// Phase 7 · Increment 2 ships READ-ONLY executors:
//   list_products   - returns merchant's products
//   preview_change  - returns a customer-view preview of a draft
//
// Write executors (create_product_draft, update_product_field,
// publish_product, archive_product, generate_banner) land in
// Increment 3 with full ownership + guardrail wiring.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  listMerchantOffers,
  loadProductWithOffers,
  findCanonicalById,
} from "@/lib/products/read";
import type { MerchantContext, ToolExecutionResult } from "./types";

// ═══════════════════════════════════════════════════════════════════
// list_products
// ═══════════════════════════════════════════════════════════════════

export type ListProductsInput = {
  query?: string;
  lifecycle_status?: "draft" | "active" | "legacy" | "withdrawn";
  limit?: number;
};

export type ListProductsRow = {
  offer_id: string;
  canonical_product_id: string;
  name: string;
  brand_name: string;
  price_pence: number;
  stock_status: string;
  lifecycle_status: string;
  hero_image_url: string | null;
  updated_at: string;
};

export async function executeListProducts(
  ctx: MerchantContext,
  input: ListProductsInput
): Promise<ToolExecutionResult<ListProductsRow[]>> {
  const limit = Math.min(input.limit ?? 20, 100);

  const offers = await listMerchantOffers({
    merchantId: ctx.merchantId,
    q: input.query,
    limit,
  });

  if (!offers || offers.length === 0) {
    return { ok: true, data: [] };
  }

  // Batch-load canonicals for the returned offers so we can enrich
  // with brand name + hero image without N+1 SELECTs
  const canonicalIds = Array.from(
    new Set(offers.map((o) => o.canonicalProductId))
  );
  const { data: canonicalsRaw } = await supabaseAdmin
    .from("os_products_canonical")
    .select("id, name, brand_name, hero_image_url, lifecycle_status")
    .in("id", canonicalIds);

  const canonicalById = new Map(
    (canonicalsRaw ?? []).map((c) => [c.id as string, c])
  );

  let rows: ListProductsRow[] = offers.map((o) => {
    const canonical = canonicalById.get(o.canonicalProductId);
    return {
      offer_id: o.id,
      canonical_product_id: o.canonicalProductId,
      name: (canonical?.name as string) ?? "(unknown product)",
      brand_name: (canonical?.brand_name as string) ?? "",
      price_pence: o.pricePence,
      stock_status: o.stockStatus,
      lifecycle_status:
        (canonical?.lifecycle_status as string) ?? "unknown",
      hero_image_url: (canonical?.hero_image_url as string) ?? null,
      updated_at: o.updatedAt,
    };
  });

  if (input.lifecycle_status) {
    rows = rows.filter((r) => r.lifecycle_status === input.lifecycle_status);
  }

  return { ok: true, data: rows };
}

// ═══════════════════════════════════════════════════════════════════
// preview_change
// ═══════════════════════════════════════════════════════════════════

export type PreviewChangeInput = {
  product_id: string;
};

export type PreviewChangeResult = {
  product_id: string;
  name: string;
  brand_name: string;
  description: string | null;
  category_path: string[];
  hero_image_url: string | null;
  lifecycle_status: string;
  offers_summary: Array<{
    merchant_id: string;
    price_pence: number;
    stock_status: string;
    is_active: boolean;
    is_this_merchant: boolean;
  }>;
  visible_on_centre: boolean;
};

export async function executePreviewChange(
  ctx: MerchantContext,
  input: PreviewChangeInput
): Promise<ToolExecutionResult<PreviewChangeResult>> {
  const canonical = await findCanonicalById(input.product_id);
  if (!canonical) {
    return { ok: false, error: "Product not found." };
  }

  // Ownership re-check: at least one active or draft offer for this
  // canonical must belong to the calling merchant. Otherwise this
  // product is not theirs to preview.
  const bundle = await loadProductWithOffers(input.product_id, {
    merchantId: ctx.merchantId,
  });
  const merchantOwnsAtLeastOneOffer =
    !!bundle && bundle.offers.some((o) => o.merchantId === ctx.merchantId);

  if (!merchantOwnsAtLeastOneOffer) {
    return {
      ok: false,
      error:
        "You do not have any offers on this product. Preview is scoped to products you own or offer.",
    };
  }

  // Load all offers on this canonical to give the merchant a market
  // view (own vs competing offers, without exposing competitor pricing
  // strategy — we return everyone's offer at a summary level).
  const allBundle = await loadProductWithOffers(input.product_id);
  const offersSummary =
    allBundle?.offers.map((o) => ({
      merchant_id: o.merchantId,
      price_pence: o.pricePence,
      stock_status: o.stockStatus,
      is_active: o.isActive,
      is_this_merchant: o.merchantId === ctx.merchantId,
    })) ?? [];

  return {
    ok: true,
    data: {
      product_id: canonical.id,
      name: canonical.name,
      brand_name: canonical.brandName,
      description: canonical.description,
      category_path: canonical.categoryPath,
      hero_image_url: canonical.heroImageUrl,
      lifecycle_status: canonical.lifecycleStatus,
      offers_summary: offersSummary,
      visible_on_centre: canonical.lifecycleStatus === "active",
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Dispatch table — the API endpoint hands the raw tool_use block here
// ═══════════════════════════════════════════════════════════════════

/** Runs a tool call from NEX. Returns a serialisable result the
 *  endpoint feeds back as tool_result content. Unknown tool names and
 *  write tools (not shipped in Increment 2) return an error result. */
export async function runTool(
  ctx: MerchantContext,
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case "list_products":
      return executeListProducts(ctx, input as ListProductsInput);
    case "preview_change":
      return executePreviewChange(ctx, input as PreviewChangeInput);

    // Write tools land in Increment 3
    case "create_product_draft":
    case "update_product_field":
    case "generate_banner":
    case "publish_product":
    case "archive_product":
      return {
        ok: false,
        error: `Tool "${toolName}" is not yet enabled. Write actions ship in Phase 7 Increment 3.`,
      };

    default:
      return { ok: false, error: `Unknown tool: ${toolName}` };
  }
}
