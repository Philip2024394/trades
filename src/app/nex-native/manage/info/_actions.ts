"use server";

// src/app/nex-native/manage/info/_actions.ts
//
// Server action for the /manage/info seller edit page. Scoped so the
// fragile _actions.ts is untouched.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  getInfoPages,
  updateInfoPages,
} from "@/lib/nex-native/info-pages-service";
import {
  NEX_INFO_MAX_CUSTOM_BUTTONS,
  NEX_INFO_MAX_FAQ_ITEMS,
  NEX_INFO_PAGE_KEYS,
  type NexInfoCustomButton,
  type NexInfoFaqItem,
  type NexInfoPageKey,
  type NexInfoPagesJson,
} from "@/lib/nex-native/info-pages";

function redirectToInfoWithBanner(code: string, message: string): never {
  redirect(
    "/nex-native/manage/info?e=" +
      code +
      "&m=" +
      encodeURIComponent(message),
  );
}

export async function updateInfoPagesAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirectToInfoWithBanner(
      "info_forbidden",
      "You don't own this shop",
    );
  }

  const existing = (await getInfoPages(businessId)) ?? {};

  // ── Enabled flags ──
  const enabled: Partial<Record<NexInfoPageKey, boolean>> = {
    ...(existing.enabled ?? {}),
  };
  for (const key of NEX_INFO_PAGE_KEYS) {
    // Checkbox absent → false. Checkbox present with value → true.
    enabled[key] = formData.get(`enabled__${key}`) === "on";
  }

  // ── Free-text fields ──
  const readText = (k: string): string | null => {
    const v = formData.get(k);
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  };

  // ── Custom buttons ──
  // Form encodes each row as:
  //   custom__<idx>__id
  //   custom__<idx>__enabled  ("on" or missing)
  //   custom__<idx>__icon
  //   custom__<idx>__label
  //   custom__<idx>__body
  //   custom__<idx>__image_url
  //   custom__<idx>__external_url
  const customButtons: NexInfoCustomButton[] = [];
  for (let i = 0; i < NEX_INFO_MAX_CUSTOM_BUTTONS; i++) {
    const label = readText(`custom__${i}__label`);
    if (!label) continue; // row unfilled · skip
    const raw: NexInfoCustomButton = {
      id: readText(`custom__${i}__id`) ?? `cb_${Date.now()}_${i}`,
      enabled: formData.get(`custom__${i}__enabled`) === "on",
      icon: readText(`custom__${i}__icon`) ?? "✨",
      label,
      body: readText(`custom__${i}__body`) ?? "",
      image_url: readText(`custom__${i}__image_url`),
      external_url: readText(`custom__${i}__external_url`),
    };
    customButtons.push(raw);
  }

  // ── FAQ items ──
  // Each row encoded as: faq__<idx>__id / faq__<idx>__enabled /
  //                     faq__<idx>__question / faq__<idx>__answer
  const faqItems: NexInfoFaqItem[] = [];
  for (let i = 0; i < NEX_INFO_MAX_FAQ_ITEMS; i++) {
    const question = readText(`faq__${i}__question`);
    if (!question) continue;
    faqItems.push({
      id: readText(`faq__${i}__id`) ?? `faq_${Date.now()}_${i}`,
      enabled: formData.get(`faq__${i}__enabled`) === "on",
      question,
      answer: readText(`faq__${i}__answer`) ?? "",
    });
  }

  const next: NexInfoPagesJson = {
    enabled,
    delivery_details: readText("delivery_details"),
    custom_orders: readText("custom_orders"),
    services_scope: readText("services_scope"),
    custom_buttons: customButtons,
    faq_items: faqItems,
  };

  try {
    await updateInfoPages(businessId, next);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save info pages";
    redirectToInfoWithBanner("info_failed", msg);
  }

  revalidatePath("/nex-native/manage/info");
  redirect("/nex-native/manage/info?ok=1");
}
