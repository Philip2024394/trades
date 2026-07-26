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
// WRITE EXECUTORS — Phase 7 · Increment 3
// ═══════════════════════════════════════════════════════════════════
//
// Every write follows the 6-step contract:
//   1. Merchant request  →  (endpoint-level session gate)
//   2. Signed session    →  (contextLoader)
//   3. Merchant context  →  ctx passed in
//   4. Ownership verify  →  each executor re-checks the target row
//   5. Draft creation    →  lifecycle_status='draft' forced
//   6. Audit event       →  persisted via tool_calls JSONB on message row
//
// Rules encoded here:
//   - No executor accepts merchant_id / publisher_business_id from input.
//     Both come from ctx only — NEX cannot spoof either value.
//   - No executor writes lifecycle_status='active' directly. Only
//     executePublishProduct with confirm=true transitions state.
//   - Every text field passes through guardrails.checkFields BEFORE
//     storage. Rejections return guardrail_blocked=true so NEX can
//     surface the plain-language reason to the merchant.

import { checkFields } from "./guardrails";
import { publish as publishEvent } from "@/lib/os/events";
import {
  generateAndSaveBanner,
  type GenerateBannerInput,
} from "./bannerGenerator";
import type { BannerVisualStyle, MerchantAssistantBanner } from "./types";

/** slug helper: brand-slug/name-slug pattern per canonical schema. */
function makeSlug(brandName: string, name: string): string {
  const kebab = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `${kebab(brandName)}/${kebab(name)}`;
}

// ─── create_product_draft ─────────────────────────────────────────

export type CreateProductDraftInput = {
  name: string;
  brand_name: string;
  description?: string;
  category_path?: string[];
  price_pence: number;
  tags?: string[];
  hero_image_url?: string;
};

export type CreateProductDraftResult = {
  canonical_id: string;
  offer_id: string;
  name: string;
  brand_name: string;
  slug: string;
  price_pence: number;
  lifecycle_status: "draft";
};

export async function executeCreateProductDraft(
  ctx: MerchantContext,
  input: CreateProductDraftInput
): Promise<ToolExecutionResult<CreateProductDraftResult>> {
  // Input validation
  if (!input.name?.trim() || !input.brand_name?.trim()) {
    return { ok: false, error: "name and brand_name are required" };
  }
  if (!Number.isFinite(input.price_pence) || input.price_pence < 0) {
    return { ok: false, error: "price_pence must be a non-negative integer" };
  }

  // Guardrails on every text field BEFORE storage
  const g = checkFields(
    {
      name: input.name,
      brand_name: input.brand_name,
      description: input.description ?? null,
    },
    {
      // TODO Increment 6: read real credentials + trading-since from
      // hammerex_trade_off_listings.years_in_trade / start_year. For now
      // pass empty so all certification claims are blocked (safest default).
      merchantCredentials: [],
    }
  );
  if (!g.ok) {
    return {
      ok: false,
      error: g.reason,
      guardrail_blocked: true,
      guardrail_reason: g.reason,
    };
  }

  const slug = makeSlug(input.brand_name, input.name);

  // Step 5 · draft creation — INSERT canonical as draft
  const { data: canonical, error: canonicalError } = await supabaseAdmin
    .from("os_products_canonical")
    .insert({
      publisher_business_id: ctx.merchantId, // forced from ctx, NEVER from input
      brand_name: input.brand_name,
      name: input.name,
      slug,
      description: input.description ?? null,
      category_path: input.category_path ?? [],
      attributes: {},
      hero_image_url: input.hero_image_url ?? null,
      image_urls: input.hero_image_url ? [input.hero_image_url] : [],
      documents: [],
      lifecycle_status: "draft",
      nex_draft_source: "nex_merchant_assistant",
    })
    .select("id, name, brand_name, slug")
    .single();

  if (canonicalError || !canonical) {
    return {
      ok: false,
      error: `Could not create canonical draft: ${canonicalError?.message ?? "unknown"}`,
    };
  }

  // Corresponding merchant offer, also draft-flagged via source column
  const { data: offer, error: offerError } = await supabaseAdmin
    .from("app_products_merchant_offers")
    .insert({
      merchant_id: ctx.merchantId, // forced from ctx
      canonical_product_id: canonical.id,
      price_pence: input.price_pence,
      stock_status: "in_stock",
      is_active: false, // draft: offer stays inactive until publish
      nex_draft_source: "nex_merchant_assistant",
    })
    .select("id")
    .single();

  if (offerError || !offer) {
    return {
      ok: false,
      error: `Canonical created but offer failed: ${offerError?.message ?? "unknown"}`,
    };
  }

  return {
    ok: true,
    data: {
      canonical_id: canonical.id as string,
      offer_id: offer.id as string,
      name: canonical.name as string,
      brand_name: canonical.brand_name as string,
      slug: canonical.slug as string,
      price_pence: input.price_pence,
      lifecycle_status: "draft",
    },
  };
}

// ─── update_product_field ─────────────────────────────────────────

export type UpdateProductFieldInput = {
  product_id: string;
  field:
    | "name"
    | "description"
    | "price_pence"
    | "tags"
    | "hero_image_url"
    | "category_path"
    | "stock_status"
    | "stock_quantity";
  value: unknown;
};

export async function executeUpdateProductField(
  ctx: MerchantContext,
  input: UpdateProductFieldInput
): Promise<ToolExecutionResult<{ product_id: string; field: string }>> {
  if (!input.product_id) {
    return { ok: false, error: "product_id is required" };
  }

  // Step 4 · ownership verification
  const canonical = await findCanonicalById(input.product_id);
  if (!canonical) return { ok: false, error: "Product not found." };
  if (canonical.publisherBusinessId !== ctx.merchantId) {
    return {
      ok: false,
      error: "You can only edit products you own.",
    };
  }

  // Text-field guardrails
  if (
    (input.field === "name" || input.field === "description") &&
    typeof input.value === "string"
  ) {
    const g = checkFields({ [input.field]: input.value } as Record<string, string>, {
      merchantCredentials: [],
    });
    if (!g.ok) {
      return {
        ok: false,
        error: g.reason,
        guardrail_blocked: true,
        guardrail_reason: g.reason,
      };
    }
  }

  // Route updates: canonical vs offer
  const canonicalFields = new Set([
    "name",
    "description",
    "hero_image_url",
    "category_path",
  ]);
  const offerFields = new Set(["price_pence", "stock_status", "stock_quantity"]);

  if (canonicalFields.has(input.field)) {
    const patch: Record<string, unknown> = {};
    patch[input.field] = input.value;
    const { error } = await supabaseAdmin
      .from("os_products_canonical")
      .update(patch)
      .eq("id", input.product_id)
      .eq("publisher_business_id", ctx.merchantId); // ownership re-check at SQL level
    if (error) {
      return { ok: false, error: `Update failed: ${error.message}` };
    }
    return { ok: true, data: { product_id: input.product_id, field: input.field } };
  }

  if (offerFields.has(input.field)) {
    const { error } = await supabaseAdmin
      .from("app_products_merchant_offers")
      .update({ [input.field]: input.value })
      .eq("canonical_product_id", input.product_id)
      .eq("merchant_id", ctx.merchantId); // ownership re-check at SQL level
    if (error) {
      return { ok: false, error: `Update failed: ${error.message}` };
    }
    return { ok: true, data: { product_id: input.product_id, field: input.field } };
  }

  return { ok: false, error: `Field "${input.field}" is not updatable.` };
}

// ─── publish_product ──────────────────────────────────────────────

export type PublishProductInput = {
  product_id: string;
  confirm: boolean;
};

export async function executePublishProduct(
  ctx: MerchantContext,
  input: PublishProductInput
): Promise<ToolExecutionResult<{ product_id: string; lifecycle_status: "active" }>> {
  if (!input.confirm) {
    return {
      ok: false,
      error:
        "Publish requires explicit merchant confirmation. NEX must ask the merchant 'shall I publish this?' and receive a yes before calling with confirm=true.",
    };
  }

  // Step 4 · ownership verification
  const canonical = await findCanonicalById(input.product_id);
  if (!canonical) return { ok: false, error: "Product not found." };
  if (canonical.publisherBusinessId !== ctx.merchantId) {
    return {
      ok: false,
      error: "You can only publish products you own.",
    };
  }

  const now = new Date().toISOString();

  // Transition canonical to active
  const { error: canonicalError } = await supabaseAdmin
    .from("os_products_canonical")
    .update({ lifecycle_status: "active", published_at: now })
    .eq("id", input.product_id)
    .eq("publisher_business_id", ctx.merchantId);
  if (canonicalError) {
    return { ok: false, error: `Publish failed: ${canonicalError.message}` };
  }

  // Activate all merchant offers on this canonical for the caller
  await supabaseAdmin
    .from("app_products_merchant_offers")
    .update({ is_active: true })
    .eq("canonical_product_id", input.product_id)
    .eq("merchant_id", ctx.merchantId);

  // Fire the platform product.published event so downstream apps
  // (NEX Centre feed, search index, supplier matching) pick it up
  try {
    await publishEvent({
      eventType: "product.published",
      publisherApp: "products",
      dedupKey: `nex-ma:${input.product_id}:${now}`,
      actorBusinessId: ctx.merchantId,
      subjectType: "product",
      subjectId: input.product_id,
      payload: {
        brand: canonical.brandName,
        name: canonical.name,
        source: "nex_merchant_assistant",
      },
    });
  } catch {
    // Event bus failure should not block the publish itself — the state
    // change is authoritative. Log elsewhere in a later increment.
  }

  return {
    ok: true,
    data: { product_id: input.product_id, lifecycle_status: "active" },
  };
}

// ─── archive_product ──────────────────────────────────────────────

export type ArchiveProductInput = {
  product_id: string;
  confirm: boolean;
};

export async function executeArchiveProduct(
  ctx: MerchantContext,
  input: ArchiveProductInput
): Promise<ToolExecutionResult<{ product_id: string; lifecycle_status: "withdrawn" }>> {
  if (!input.confirm) {
    return {
      ok: false,
      error: "Archive requires explicit merchant confirmation.",
    };
  }

  const canonical = await findCanonicalById(input.product_id);
  if (!canonical) return { ok: false, error: "Product not found." };
  if (canonical.publisherBusinessId !== ctx.merchantId) {
    return { ok: false, error: "You can only archive products you own." };
  }

  const now = new Date().toISOString();
  const { error: canonicalError } = await supabaseAdmin
    .from("os_products_canonical")
    .update({ lifecycle_status: "withdrawn", withdrawn_at: now })
    .eq("id", input.product_id)
    .eq("publisher_business_id", ctx.merchantId);
  if (canonicalError) {
    return { ok: false, error: `Archive failed: ${canonicalError.message}` };
  }

  await supabaseAdmin
    .from("app_products_merchant_offers")
    .update({ is_active: false })
    .eq("canonical_product_id", input.product_id)
    .eq("merchant_id", ctx.merchantId);

  try {
    await publishEvent({
      eventType: "product.withdrawn",
      publisherApp: "products",
      dedupKey: `nex-ma-archive:${input.product_id}:${now}`,
      actorBusinessId: ctx.merchantId,
      subjectType: "product",
      subjectId: input.product_id,
      payload: {
        brand: canonical.brandName,
        name: canonical.name,
        source: "nex_merchant_assistant",
      },
    });
  } catch {
    // Same as publish — event failure does not block the state change.
  }

  return {
    ok: true,
    data: { product_id: input.product_id, lifecycle_status: "withdrawn" },
  };
}

// ─── generate_banner ──────────────────────────────────────────────

export type GenerateBannerToolInput = {
  offer_id: string;
  visual_style?: BannerVisualStyle;
  angle?: string;
};

export async function executeGenerateBanner(
  ctx: MerchantContext,
  input: GenerateBannerToolInput
): Promise<ToolExecutionResult<MerchantAssistantBanner>> {
  if (!input.offer_id) {
    return { ok: false, error: "offer_id is required" };
  }

  // Load offer + verify ownership + get canonical for product context
  const { data: offer } = await supabaseAdmin
    .from("app_products_merchant_offers")
    .select("id, merchant_id, canonical_product_id, price_pence")
    .eq("id", input.offer_id)
    .maybeSingle();

  if (!offer) return { ok: false, error: "Offer not found." };
  if ((offer.merchant_id as string) !== ctx.merchantId) {
    return { ok: false, error: "You can only generate banners for your own offers." };
  }

  const canonical = await findCanonicalById(offer.canonical_product_id as string);
  if (!canonical) {
    return { ok: false, error: "Could not load the linked product." };
  }

  // Compose + persist a new draft banner version
  const generatorInput: GenerateBannerInput = {
    offerId: input.offer_id,
    visualStyle: input.visual_style,
    angle: input.angle,
  };

  const result = await generateAndSaveBanner(ctx, generatorInput, {
    productName: canonical.name,
    brandName: canonical.brandName,
    description: canonical.description,
    pricePence: offer.price_pence as number,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      guardrail_blocked: result.guardrail_blocked,
      guardrail_reason: result.guardrail_reason,
    };
  }

  return { ok: true, data: result.banner };
}

// ═══════════════════════════════════════════════════════════════════
// Dispatch table — the API endpoint hands the raw tool_use block here
// ═══════════════════════════════════════════════════════════════════

/** Runs a tool call from NEX. Returns a serialisable result the
 *  endpoint feeds back as tool_result content. Unknown tool names
 *  return an error result. All write tools re-check ownership. */
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
    case "create_product_draft":
      return executeCreateProductDraft(ctx, input as CreateProductDraftInput);
    case "update_product_field":
      return executeUpdateProductField(ctx, input as UpdateProductFieldInput);
    case "publish_product":
      return executePublishProduct(ctx, input as PublishProductInput);
    case "archive_product":
      return executeArchiveProduct(ctx, input as ArchiveProductInput);
    case "generate_banner":
      return executeGenerateBanner(ctx, input as GenerateBannerToolInput);
    case "update_contact_preferences":
      return executeUpdateContactPreferences(ctx, input as UpdateContactPreferencesInput);

    default:
      return { ok: false, error: `Unknown tool: ${toolName}` };
  }
}

// ─── update_contact_preferences ───────────────────────────────────

export type UpdateContactPreferencesInput = {
  show_whatsapp?: boolean;
  show_email?: boolean;
  show_phone?: boolean;
  show_website?: boolean;
};

export async function executeUpdateContactPreferences(
  ctx: MerchantContext,
  input: UpdateContactPreferencesInput
): Promise<
  ToolExecutionResult<{
    show_whatsapp: boolean;
    show_email: boolean;
    show_phone: boolean;
    show_website: boolean;
  }>
> {
  const patch: Record<string, boolean> = {};
  if (typeof input.show_whatsapp === "boolean") patch.nex_show_whatsapp = input.show_whatsapp;
  if (typeof input.show_email === "boolean") patch.nex_show_email = input.show_email;
  if (typeof input.show_phone === "boolean") patch.nex_show_phone = input.show_phone;
  if (typeof input.show_website === "boolean") patch.nex_show_website = input.show_website;

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      error: "At least one contact preference (show_whatsapp / show_email / show_phone / show_website) must be supplied.",
    };
  }

  // SQL-level ownership re-check via .eq() on id === ctx.merchantId
  const { error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(patch)
    .eq("id", ctx.merchantId);

  if (error) {
    return { ok: false, error: `Could not update contact preferences: ${error.message}` };
  }

  // Re-read the current state so NEX can confirm to the merchant
  const { data: after } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("nex_show_whatsapp, nex_show_email, nex_show_phone, nex_show_website")
    .eq("id", ctx.merchantId)
    .maybeSingle();

  return {
    ok: true,
    data: {
      show_whatsapp: (after?.nex_show_whatsapp as boolean) ?? true,
      show_email: (after?.nex_show_email as boolean) ?? true,
      show_phone: (after?.nex_show_phone as boolean) ?? false,
      show_website: (after?.nex_show_website as boolean) ?? true,
    },
  };
}
