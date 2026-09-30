"use server";

// src/app/nex-native/manage/shop/_shipping-scope-action.ts
//
// Server action for the shipping-scope picker on /manage/shop.
// Scoped to its own file so the fragile _actions.ts (5800+ lines with
// pre-existing type quirks) isn't touched.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  NEX_SHIPPING_SCOPES,
  updateShippingScope,
  type NexShippingScope,
} from "@/lib/nex-native/business-service";

export async function updateBusinessShippingScopeAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/shop?e=shipping_forbidden&m=" +
        encodeURIComponent("You don't own this shop"),
    );
  }

  const raw = String(formData.get("shipping_scope") ?? "").trim();
  let scope: NexShippingScope | null = null;
  if (raw !== "" && raw !== "__unset__") {
    if (!(NEX_SHIPPING_SCOPES as readonly string[]).includes(raw)) {
      redirect(
        "/nex-native/manage/shop?e=shipping_failed&m=" +
          encodeURIComponent(`Unknown shipping scope "${raw}"`),
      );
    }
    scope = raw as NexShippingScope;
  }

  try {
    await updateShippingScope(businessId, scope);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save shipping scope";
    redirect(
      "/nex-native/manage/shop?e=shipping_failed&m=" +
        encodeURIComponent(msg),
    );
  }

  revalidatePath("/nex-native/manage/shop");
  redirect("/nex-native/manage/shop?ok=shipping");
}
