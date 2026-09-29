// src/lib/nex-native/device-key-service.ts
//
// Bridge 74 · Server-side operations on nex_account_device_key.
// -------------------------------------------------------------
// The client generates the keypair and holds the private half. This
// module owns the public half — inserting new device rows, refreshing
// last_seen_at, and enumerating an account's active devices so a
// sender can fan-out ciphertext to every device.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export interface NexAccountDeviceKeyRow {
  id: NexUuid;
  account_id: NexUuid;
  device_id: string;
  public_key: string;
  created_at: string;
  last_seen_at: string;
}

/** Upsert this device's public key for the given account. Refreshes
 *  last_seen_at on every call so periodic sweeps can prune abandoned
 *  device rows. Public keys are immutable per (account_id, device_id) —
 *  clients treat re-upload as a heartbeat, not a rotation. Rotating
 *  means creating a new device row with a fresh device_id. */
export async function upsertDeviceKey(
  accountId: NexUuid,
  deviceId: string,
  publicKeyBase64: string,
): Promise<void> {
  const now = new Date().toISOString();
  // upsert on the composite key · Supabase supports onConflict via the
  // qualified column list, and the unique index on (account_id, device_id)
  // gives us the target.
  const { error } = await nexSupabaseAdmin
    .from("nex_account_device_key")
    .upsert(
      {
        account_id: accountId,
        device_id: deviceId,
        public_key: publicKeyBase64,
        last_seen_at: now,
      },
      { onConflict: "account_id,device_id" },
    );
  if (error) {
    throw new Error(
      `device-key-service.upsertDeviceKey: ${error.message}`,
    );
  }
}

/** All active public keys for an account. Callers should encrypt the
 *  same ciphertext once per row so every device the recipient owns can
 *  decrypt. Sorted by last_seen_at desc so recent devices win when a
 *  caller only wants the freshest. */
export async function listDeviceKeys(
  accountId: NexUuid,
): Promise<NexAccountDeviceKeyRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_device_key")
    .select("*")
    .eq("account_id", accountId)
    .order("last_seen_at", { ascending: false });
  if (error) {
    throw new Error(
      `device-key-service.listDeviceKeys: ${error.message}`,
    );
  }
  return (data as NexAccountDeviceKeyRow[]) ?? [];
}
