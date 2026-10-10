"use server";

// src/app/nex-native/manage/products/_actions.ts
//
// Bridge 66 · Seller product-list stock-status toggle.
// ----------------------------------------------------
// Co-located with the /manage/products list page so it lives in the
// same routing bundle. Keeps the /nex-native root _actions.ts free
// of Bridge 66 code so parallel edits there don't collide.
//
// Verifies the caller owns the product's business before mutating.
// Revalidates the products page + the buyer-facing shop landing so
// both surfaces reflect the new stock state on the next fetch.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import {
  NEX_PRODUCT_STOCK_STATUSES,
  type NexProductStockStatus,
} from "@/lib/nex-native/types";

function redirectWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/manage/products?${qs.toString()}`);
}

/**
 * Toggle a product between "in_stock" (available) and "sold_out".
 * Reads product_id + next_status from FormData. Verifies the caller
 * owns the product's business before writing. Always redirects back
 * to /nex-native/manage/products with a success/error banner.
 */
export async function toggleProductStockAction(
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in");
  }

  const productId = String(formData.get("product_id") ?? "").trim();
  const rawNext = String(formData.get("next_status") ?? "").trim();

  if (!productId) {
    redirectWithBanner("missing_product_id", "product id required");
  }
  if (!NEX_PRODUCT_STOCK_STATUSES.includes(rawNext as NexProductStockStatus)) {
    redirectWithBanner(
      "invalid_stock_status",
      `unknown stock status '${rawNext}'`,
    );
  }
  const nextStatus = rawNext as NexProductStockStatus;

  const product = await productService.getProductById(productId);
  if (!product) {
    redirectWithBanner("product_not_found", "product not found");
  }

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    redirectWithBanner(
      "not_owner",
      "you do not own this product's business",
    );
  }

  try {
    await productService.updateProductStockStatus(productId, nextStatus);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectWithBanner("stock_status_update_failed", msg);
  }

  revalidatePath("/nex-native/manage/products");
  const business = owned.find((b) => b.id === product.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);

  const label =
    nextStatus === "sold_out"
      ? `${product.name} · marked sold out`
      : `${product.name} · marked available`;
  redirectWithBanner("stock_status_updated", label);
}
