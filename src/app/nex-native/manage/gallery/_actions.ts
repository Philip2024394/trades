"use server";

// src/app/nex-native/manage/gallery/_actions.ts
//
// Server actions for the /manage/gallery seller editor. Every action
// authenticates the caller against the owning business before it
// touches gallery-image-service.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  deleteGalleryImage,
  reorderGalleryImages,
  updateGalleryImage,
  uploadGalleryImage,
} from "@/lib/nex-native/gallery-image-service";

function bannerRedirect(
  path: string,
  code: string,
  message: string,
): never {
  redirect(`${path}?e=${code}&m=${encodeURIComponent(message)}`);
}

async function assertOwner(businessId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    bannerRedirect(
      "/nex-native/manage/gallery",
      "gallery_forbidden",
      "You don't own this shop",
    );
  }
  return { session, business };
}

/** Upload a new image + create its gallery row. Caption + description
 *  default to empty strings so the seller can add them via inline
 *  save on the same page. */
export async function uploadGalleryImageAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  await assertOwner(businessId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    bannerRedirect(
      "/nex-native/manage/gallery",
      "gallery_no_file",
      "Pick an image to upload",
    );
  }
  const caption = ((formData.get("caption") as string) ?? "").trim();
  const longDescription = ((formData.get("long_description") as string) ?? "").trim();
  try {
    await uploadGalleryImage({
      businessId,
      file,
      caption,
      longDescription,
    });
  } catch (e) {
    bannerRedirect(
      "/nex-native/manage/gallery",
      "gallery_upload_failed",
      e instanceof Error ? e.message : "Upload failed",
    );
  }
  revalidatePath("/nex-native/manage/gallery");
  redirect("/nex-native/manage/gallery?ok=1");
}

/** Inline save for caption + long description on an existing row. */
export async function updateGalleryImageAction(
  businessId: string,
  imageId: string,
  formData: FormData,
): Promise<never> {
  await assertOwner(businessId);
  const caption = ((formData.get("caption") as string) ?? "").trim();
  const longDescription = ((formData.get("long_description") as string) ?? "").trim();
  try {
    await updateGalleryImage(imageId, {
      caption,
      longDescription,
    });
  } catch (e) {
    bannerRedirect(
      "/nex-native/manage/gallery",
      "gallery_update_failed",
      e instanceof Error ? e.message : "Save failed",
    );
  }
  revalidatePath("/nex-native/manage/gallery");
  redirect("/nex-native/manage/gallery?ok=1");
}

/** Delete a gallery row (and its underlying storage object). */
export async function deleteGalleryImageAction(
  businessId: string,
  imageId: string,
): Promise<never> {
  await assertOwner(businessId);
  try {
    await deleteGalleryImage(imageId);
  } catch (e) {
    bannerRedirect(
      "/nex-native/manage/gallery",
      "gallery_delete_failed",
      e instanceof Error ? e.message : "Delete failed",
    );
  }
  revalidatePath("/nex-native/manage/gallery");
  redirect("/nex-native/manage/gallery?ok=1");
}

/** Move a row up / down by one position. Reads current order, swaps
 *  with neighbour, writes back via reorderGalleryImages. */
export async function moveGalleryImageAction(
  businessId: string,
  imageId: string,
  direction: "up" | "down",
): Promise<never> {
  await assertOwner(businessId);
  try {
    const { listGalleryImages } = await import(
      "@/lib/nex-native/gallery-image-service"
    );
    const rows = await listGalleryImages(businessId);
    const idx = rows.findIndex((r) => r.id === imageId);
    if (idx < 0) {
      bannerRedirect(
        "/nex-native/manage/gallery",
        "gallery_not_found",
        "Image not found",
      );
    }
    const nextIdx = direction === "up" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= rows.length) {
      redirect("/nex-native/manage/gallery?ok=1");
    }
    const nextOrder = [...rows];
    [nextOrder[idx], nextOrder[nextIdx]] = [nextOrder[nextIdx], nextOrder[idx]];
    await reorderGalleryImages(
      businessId,
      nextOrder.map((r) => r.id),
    );
  } catch (e) {
    bannerRedirect(
      "/nex-native/manage/gallery",
      "gallery_move_failed",
      e instanceof Error ? e.message : "Move failed",
    );
  }
  revalidatePath("/nex-native/manage/gallery");
  redirect("/nex-native/manage/gallery?ok=1");
}
