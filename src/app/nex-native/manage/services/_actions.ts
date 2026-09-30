"use server";

// src/app/nex-native/manage/services/_actions.ts
//
// Server actions for the /manage/services seller editor.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  deleteService,
  insertService,
  listServices,
  reorderServices,
  updateService,
} from "@/lib/nex-native/service-list-service";

function bannerRedirect(code: string, message: string): never {
  redirect(
    `/nex-native/manage/services?e=${code}&m=${encodeURIComponent(message)}`,
  );
}

async function assertOwner(businessId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    bannerRedirect("services_forbidden", "You don't own this shop");
  }
}

export async function createServiceAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  await assertOwner(businessId);
  const name = ((formData.get("name") as string) ?? "").trim();
  const description = ((formData.get("description") as string) ?? "").trim();
  const fromPrice = ((formData.get("from_price") as string) ?? "").trim();
  if (name.length === 0) {
    bannerRedirect("services_no_name", "Service name is required");
  }
  try {
    await insertService({
      businessId,
      name,
      description,
      fromPrice,
    });
  } catch (e) {
    bannerRedirect(
      "services_create_failed",
      e instanceof Error ? e.message : "Create failed",
    );
  }
  revalidatePath("/nex-native/manage/services");
  redirect("/nex-native/manage/services?ok=1");
}

export async function updateServiceAction(
  businessId: string,
  serviceId: string,
  formData: FormData,
): Promise<never> {
  await assertOwner(businessId);
  const name = ((formData.get("name") as string) ?? "").trim();
  const description = ((formData.get("description") as string) ?? "").trim();
  const fromPrice = ((formData.get("from_price") as string) ?? "").trim();
  if (name.length === 0) {
    bannerRedirect("services_no_name", "Service name is required");
  }
  try {
    await updateService(serviceId, { name, description, fromPrice });
  } catch (e) {
    bannerRedirect(
      "services_update_failed",
      e instanceof Error ? e.message : "Save failed",
    );
  }
  revalidatePath("/nex-native/manage/services");
  redirect("/nex-native/manage/services?ok=1");
}

export async function deleteServiceAction(
  businessId: string,
  serviceId: string,
): Promise<never> {
  await assertOwner(businessId);
  try {
    await deleteService(serviceId);
  } catch (e) {
    bannerRedirect(
      "services_delete_failed",
      e instanceof Error ? e.message : "Delete failed",
    );
  }
  revalidatePath("/nex-native/manage/services");
  redirect("/nex-native/manage/services?ok=1");
}

export async function moveServiceAction(
  businessId: string,
  serviceId: string,
  direction: "up" | "down",
): Promise<never> {
  await assertOwner(businessId);
  try {
    const rows = await listServices(businessId);
    const idx = rows.findIndex((r) => r.id === serviceId);
    if (idx < 0) bannerRedirect("services_not_found", "Service not found");
    const nextIdx = direction === "up" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= rows.length) {
      redirect("/nex-native/manage/services?ok=1");
    }
    const nextOrder = [...rows];
    [nextOrder[idx], nextOrder[nextIdx]] = [nextOrder[nextIdx], nextOrder[idx]];
    await reorderServices(
      businessId,
      nextOrder.map((r) => r.id),
    );
  } catch (e) {
    bannerRedirect(
      "services_move_failed",
      e instanceof Error ? e.message : "Move failed",
    );
  }
  revalidatePath("/nex-native/manage/services");
  redirect("/nex-native/manage/services?ok=1");
}
