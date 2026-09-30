"use server";

// src/app/nex-native/manage/categories/_actions.ts
//
// Category Tabs · sealed 2026-09-30 · seller-side server actions for
// nex_product_section. Menu sections have their own actions in the
// legacy _actions.ts (Bridge 15b); products get this scoped module so
// the surface stays focused.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productSectionService from "@/lib/nex-native/product-section-service";
import { NexProductSectionError } from "@/lib/nex-native/product-section-service";
import * as productService from "@/lib/nex-native/product-service";

function redirectToCategoriesWithBanner(
  code: string,
  message: string,
): never {
  redirect(
    "/nex-native/manage/categories?e=" +
      code +
      "&m=" +
      encodeURIComponent(message),
  );
}

async function requireOwnedBusiness(businessId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirectToCategoriesWithBanner(
      "section_forbidden",
      "You don't own this shop",
    );
  }
  return { session, business };
}

async function requireOwnedSection(sectionId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const businesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  for (const b of businesses) {
    const sections = await productSectionService.listSectionsByBusiness(b.id);
    const hit = sections.find((s) => s.id === sectionId);
    if (hit) return { session, business: b, section: hit };
  }
  redirectToCategoriesWithBanner(
    "section_forbidden",
    "Category not found or not yours",
  );
}

export async function createProductSectionAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  await requireOwnedBusiness(businessId);
  const name = String(formData.get("name") ?? "");
  try {
    await productSectionService.createSection({
      business_id: businessId,
      name,
    });
  } catch (e) {
    const msg =
      e instanceof NexProductSectionError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Could not create category";
    redirectToCategoriesWithBanner("section_failed", msg);
  }
  revalidatePath("/nex-native/manage/categories");
  revalidatePath("/nex-native/manage/products");
  redirect("/nex-native/manage/categories?ok=1");
}

export async function renameProductSectionAction(
  sectionId: string,
  formData: FormData,
): Promise<never> {
  await requireOwnedSection(sectionId);
  const name = String(formData.get("name") ?? "");
  try {
    await productSectionService.updateSection(sectionId, { name });
  } catch (e) {
    const msg =
      e instanceof NexProductSectionError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Could not rename category";
    redirectToCategoriesWithBanner("section_failed", msg);
  }
  revalidatePath("/nex-native/manage/categories");
  redirect("/nex-native/manage/categories?ok=1");
}

export async function reorderProductSectionAction(
  sectionId: string,
  formData: FormData,
): Promise<never> {
  await requireOwnedSection(sectionId);
  const dir = String(formData.get("dir") ?? "");
  if (dir !== "up" && dir !== "down") {
    redirectToCategoriesWithBanner("section_failed", "Bad reorder direction");
  }
  const { business } = await requireOwnedSection(sectionId);
  const sections = await productSectionService.listSectionsByBusiness(
    business.id,
  );
  const idx = sections.findIndex((s) => s.id === sectionId);
  const swapWith = dir === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= sections.length) {
    redirect("/nex-native/manage/categories");
  }
  const a = sections[idx];
  const b = sections[swapWith];
  await productSectionService.updateSection(a.id, {
    sort_order: b.sort_order,
  });
  await productSectionService.updateSection(b.id, {
    sort_order: a.sort_order,
  });
  revalidatePath("/nex-native/manage/categories");
  redirect("/nex-native/manage/categories?ok=1");
}

export async function deleteProductSectionAction(
  sectionId: string,
  formData: FormData,
): Promise<never> {
  const { business } = await requireOwnedSection(sectionId);
  const reassignTo = String(formData.get("reassign_to") ?? "") || null;

  const counts = await productSectionService.countProductsPerSection(
    business.id,
  );
  const productsHere = counts.get(sectionId) ?? 0;

  if (productsHere === 0) {
    await productSectionService.deleteSection(sectionId);
  } else if (reassignTo === "__uncategorised__") {
    await productSectionService.reassignAndDelete(sectionId, null);
  } else if (reassignTo && reassignTo !== sectionId) {
    await productSectionService.reassignAndDelete(sectionId, reassignTo);
  } else {
    redirectToCategoriesWithBanner(
      "section_failed",
      "Choose where to move the products before deleting.",
    );
  }

  revalidatePath("/nex-native/manage/categories");
  revalidatePath("/nex-native/manage/products");
  redirect("/nex-native/manage/categories?ok=1");
}

/**
 * Inline autocomplete flow · used by the product editor.
 * If `name` is provided, ensures a section with that name exists (create-
 * or-find). If `section_id` is provided, that's used directly. Then
 * assigns the product to it.
 */
export async function assignProductToSectionAction(
  productId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const product = await productService.getProductById(productId);
  if (!product) {
    redirect(
      "/nex-native/manage/products?e=not_found&m=" +
        encodeURIComponent("Product not found"),
    );
  }
  const business = await businessService.getBusinessById(product.business_id);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/products?e=forbidden&m=" +
        encodeURIComponent("You don't own this product"),
    );
  }

  const sectionIdRaw = String(formData.get("section_id") ?? "");
  const nameRaw = String(formData.get("section_name") ?? "");

  try {
    let targetSectionId: string | null;
    if (sectionIdRaw === "__uncategorised__" || sectionIdRaw === "") {
      // Uncategorised choice from picker · unset section.
      targetSectionId = null;
    } else if (sectionIdRaw) {
      targetSectionId = sectionIdRaw;
    } else if (nameRaw.trim()) {
      const sec = await productSectionService.ensureSectionByName(
        business.id,
        nameRaw,
      );
      targetSectionId = sec.id;
    } else {
      targetSectionId = null;
    }
    await productSectionService.assignProductToSection(
      productId,
      targetSectionId,
    );
  } catch (e) {
    const msg =
      e instanceof NexProductSectionError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Could not assign category";
    redirect(
      `/nex-native/manage/products/${productId}?e=section_failed&m=` +
        encodeURIComponent(msg),
    );
  }

  revalidatePath("/nex-native/manage/categories");
  revalidatePath(`/nex-native/manage/products/${productId}`);
  redirect(`/nex-native/manage/products/${productId}?ok=1`);
}
