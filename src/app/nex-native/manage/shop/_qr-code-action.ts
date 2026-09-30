"use server";

// src/app/nex-native/manage/shop/_qr-code-action.ts
//
// Server actions for the seller's payment QR upload on /manage/shop.
// Scoped file so _actions.ts stays untouched.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";

function redirectToShopWithBanner(code: string, message: string): never {
  redirect(
    "/nex-native/manage/shop?e=" +
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
    redirectToShopWithBanner(
      "qr_forbidden",
      "You don't own this shop",
    );
  }
  return { session, business };
}

export async function uploadBusinessQrCodeAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  await requireOwnedBusiness(businessId);

  const file = formData.get("qr_image");
  if (!(file instanceof File) || file.size === 0) {
    redirectToShopWithBanner(
      "qr_failed",
      "Pick a QR image (png / jpg / webp · 2MB max)",
    );
  }

  try {
    await businessService.uploadBusinessQrCode(
      businessId,
      file as File,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save QR image";
    redirectToShopWithBanner("qr_failed", msg);
  }

  revalidatePath("/nex-native/manage/shop");
  redirect("/nex-native/manage/shop?ok=qr");
}

export async function clearBusinessQrCodeAction(
  businessId: string,
): Promise<never> {
  await requireOwnedBusiness(businessId);
  try {
    await businessService.updateBusinessQrCodeUrl(businessId, null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not clear QR image";
    redirectToShopWithBanner("qr_failed", msg);
  }
  revalidatePath("/nex-native/manage/shop");
  redirect("/nex-native/manage/shop?ok=qr");
}
