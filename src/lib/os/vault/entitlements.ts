// OS — Property Vault entitlements.
//
// Resolves what a homeowner party is currently entitled to based on
// their active homeowner subscriptions. Reads the derived cache
// (os_homeowner_entitlements) — populated by the Stripe webhook when
// subscriptions change.
//
// Never queries Stripe directly. Never mutates entitlements here —
// this file is read-only.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type VaultTier = "none" | "basic" | "lifetime" | "trial";

export type VaultEntitlements = {
  vaultActive: boolean;
  vaultTier: VaultTier;
  storageIncludedBytes: number;
  storageAddonBytes: number;
  storageTotalBytes: number;
  videoEnabled: boolean;
  bundleExportEnabled: boolean;
  shareGrantsMax: number;
  passportTransferable: boolean;
  activePlanKeys: string[];
};

const FREE_TIER_ENTITLEMENTS: VaultEntitlements = {
  vaultActive: false,
  vaultTier: "none",
  storageIncludedBytes: 524_288_000, // 500 MB baseline
  storageAddonBytes: 0,
  storageTotalBytes: 524_288_000,
  videoEnabled: false,
  bundleExportEnabled: true,          // free tier gets manual bundle
  shareGrantsMax: 3,
  passportTransferable: false,
  activePlanKeys: []
};

export async function loadVaultEntitlements(
  partyId: string
): Promise<VaultEntitlements> {
  const { data, error } = await supabaseAdmin
    .from("os_homeowner_entitlements")
    .select("*")
    .eq("party_id", partyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return FREE_TIER_ENTITLEMENTS;

  const included = Number(data.storage_included_bytes) || 0;
  const addon = Number(data.storage_addon_bytes) || 0;

  return {
    vaultActive: Boolean(data.vault_active),
    vaultTier: (data.vault_tier as VaultTier) || "none",
    storageIncludedBytes: included,
    storageAddonBytes: addon,
    storageTotalBytes: included + addon,
    videoEnabled: Boolean(data.video_enabled),
    bundleExportEnabled: Boolean(data.bundle_export_enabled),
    shareGrantsMax: Number(data.share_grants_max) || 0,
    passportTransferable: Boolean(data.passport_transferable),
    activePlanKeys: Array.isArray(data.active_plan_keys)
      ? (data.active_plan_keys as string[])
      : []
  };
}

export type StorageUsage = {
  documentBytes: number;
  videoBytes: number;
  photoBytes: number;
  totalBytes: number;
  overquota: boolean;
  overquotaSince: string | null;
  percentUsed: number;
};

export async function loadStorageUsage(
  partyId: string,
  entitlements?: VaultEntitlements
): Promise<StorageUsage> {
  const { data } = await supabaseAdmin
    .from("os_storage_quotas")
    .select("*")
    .eq("party_id", partyId)
    .maybeSingle();

  const ent = entitlements ?? (await loadVaultEntitlements(partyId));
  const totalBytes = Number(data?.used_total_bytes) || 0;

  return {
    documentBytes: Number(data?.used_document_bytes) || 0,
    videoBytes: Number(data?.used_video_bytes) || 0,
    photoBytes: Number(data?.used_photo_bytes) || 0,
    totalBytes,
    overquota: Boolean(data?.overquota_since),
    overquotaSince: data?.overquota_since ?? null,
    percentUsed:
      ent.storageTotalBytes > 0
        ? Math.min(100, Math.round((totalBytes / ent.storageTotalBytes) * 100))
        : 0
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes < 1024 * 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
}
