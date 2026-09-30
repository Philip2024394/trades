"use server";

// src/app/nex-native/manage/profession/_actions.ts
//
// Bridge Profession-E · sealed 2026-09-30 · server action for the
// /manage/profession picker.
//
// CRITICAL INVARIANT (founder-locked): setting or changing profession
// MUST NOT modify any other column on nex_business. This action only
// writes profession_id · never touches cover_layout_id, description,
// info_pages, or any seller-configured content. A profession CHANGE
// updates the SUGGESTED defaults · owners see the new suggestions on
// /manage/shop and can accept them explicitly.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { setBusinessProfession } from "@/lib/nex-native/terminology-service";

function bannerRedirect(code: string, message: string): never {
  redirect(
    `/nex-native/manage/profession?e=${code}&m=${encodeURIComponent(message)}`,
  );
}

async function assertOwner(businessId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    bannerRedirect("profession_forbidden", "You don't own this shop");
  }
}

export async function setBusinessProfessionAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  await assertOwner(businessId);
  const raw = ((formData.get("profession_id") as string) ?? "").trim();
  const professionId = raw.length === 0 ? null : raw;
  try {
    await setBusinessProfession(businessId, professionId);
  } catch (e) {
    bannerRedirect(
      "profession_save_failed",
      e instanceof Error ? e.message : "Save failed",
    );
  }
  revalidatePath("/nex-native/manage/profession");
  revalidatePath("/nex-native/manage/shop");
  redirect("/nex-native/manage/profession?ok=1");
}
