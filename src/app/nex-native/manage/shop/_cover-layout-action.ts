"use server";

// src/app/nex-native/manage/shop/_cover-layout-action.ts
//
// Server action for the Cover template picker on /manage/shop.
// Scoped to its own file so _actions.ts stays untouched.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  COVER_LAYOUT_IDS,
  type CoverLayoutId,
} from "@/app/nex-native/cover/layout-ids";

function redirectToShopWithBanner(code: string, message: string): never {
  redirect(
    "/nex-native/manage/shop?e=" +
      code +
      "&m=" +
      encodeURIComponent(message),
  );
}

export async function updateBusinessCoverLayoutAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirectToShopWithBanner(
      "cover_layout_forbidden",
      "You don't own this shop",
    );
  }

  const raw = String(formData.get("cover_layout_id") ?? "").trim();
  if (!(COVER_LAYOUT_IDS as readonly string[]).includes(raw)) {
    redirectToShopWithBanner(
      "cover_layout_failed",
      `Unknown cover layout "${raw}"`,
    );
  }

  try {
    await businessService.updateCoverLayoutId(businessId, raw as CoverLayoutId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save cover layout";
    redirectToShopWithBanner("cover_layout_failed", msg);
  }

  revalidatePath("/nex-native/manage/shop");
  revalidatePath(`/nex-native/${business.slug}`);
  redirect("/nex-native/manage/shop?ok=cover_layout");
}
