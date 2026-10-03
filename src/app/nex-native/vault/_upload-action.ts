// src/app/nex-native/vault/_upload-action.ts
//
// Stage 6 · Upload Server Action.
// Accepts a FormData blob + category (+ optional folder_path) and
// writes the metadata row AND the bucket object. Session-scoped.
// Reject conditions:
//   · no session → redirect to sign-in
//   · missing/invalid category
//   · zero-byte file
//   · file > hard byte cap (100 MB · adjustable per founder decision)
//   · metadata insert fails → bucket not touched
//   · bucket upload fails → metadata row rolled back

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as vaultFileService from "@/lib/nex-native/vault-file-service";
import type { VaultFileCategory } from "@/lib/nex-native/vault-file-service";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB · founder revisit if needed
const VALID: ReadonlySet<VaultFileCategory> = new Set(
  vaultFileService.VAULT_FILE_CATEGORIES,
);

export async function uploadVaultFileAction(
  formData: FormData,
): Promise<{ ok: true; fileId: string } | { ok: false; reason: string }> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in?next=/nex-native/vault/home");

  const file = formData.get("file");
  const category = String(formData.get("category") ?? "") as VaultFileCategory;
  const folderPath = String(formData.get("folder_path") ?? "").trim() || null;

  if (!(file instanceof File)) {
    return { ok: false, reason: "No file provided" };
  }
  if (!VALID.has(category)) {
    return { ok: false, reason: "Invalid room / category" };
  }
  if (file.size === 0) {
    return { ok: false, reason: "File is empty" };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      reason: `File is too large (max ${Math.floor(MAX_BYTES / (1024 * 1024))} MB in Stage 6)`,
    };
  }

  // Insert metadata first so we have a committed id for the deterministic
  // bucket path. If upload fails, we rollback the metadata row.
  let row: Awaited<ReturnType<typeof vaultFileService.insertVaultFileMetadata>>;
  try {
    row = await vaultFileService.insertVaultFileMetadata({
      accountId: session.account.id,
      category,
      displayName: file.name,
      mimeType: file.type || "application/octet-stream",
      byteSize: file.size,
      folderPath,
    });
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }

  try {
    await vaultFileService.uploadVaultFileBytes(
      session.account.id,
      row.id,
      file,
      row.mime_type,
    );
  } catch (err) {
    // Rollback metadata.
    try {
      await vaultFileService.deleteVaultFile(session.account.id, row.id);
    } catch {
      /* best-effort */
    }
    return { ok: false, reason: `Upload failed · ${(err as Error).message}` };
  }

  // Revalidate the destination room + home so the new file appears.
  revalidatePath(`/nex-native/vault/home/${category}`);
  revalidatePath("/nex-native/vault/home");
  return { ok: true, fileId: row.id };
}

export async function deleteVaultFileAction(
  fileId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) redirect("/nex-native/sign-in");
    await vaultFileService.deleteVaultFile(session.account.id, fileId);
    revalidatePath("/nex-native/vault/home");
    for (const cat of vaultFileService.VAULT_FILE_CATEGORIES) {
      revalidatePath(`/nex-native/vault/home/${cat}`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}
