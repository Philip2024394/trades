// src/lib/nex-native/webauthn-service.ts
//
// NEX WebAuthn platform-authenticator storage service (server-only).
// -------------------------------------------------------------------------
// This is the storage side of the NEX face-scan flow. Actual verification
// of registration/attestation and assertion signatures is delegated to
// @simplewebauthn/server in the API routes; this module only persists
// credentials (public keys, counters, transports, labels) keyed to a
// nex_account UUID.
//
// The animated ring + camera preview is UI branding on top of a standard
// W3C WebAuthn ceremony. We never see the user's face; only opaque
// credential material.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexTimestamp, NexUuid } from "./types";

export interface NexWebauthnCredentialRow {
  id: NexUuid;
  account_id: NexUuid;
  credential_id: string;         // base64url
  credential_public_key: string; // base64url of COSE key
  counter: number;
  transports: string[] | null;
  device_label: string | null;
  created_at: NexTimestamp;
  last_used_at: NexTimestamp | null;
}

export interface SaveCredentialInput {
  account_id: NexUuid;
  credential_id: string;
  credential_public_key: string;
  counter: number;
  transports?: string[] | null;
  device_label?: string | null;
}

/** Insert a new credential. Throws on unique-collision (credential ID
 *  already registered to another account). */
export async function saveCredential(
  input: SaveCredentialInput,
): Promise<NexWebauthnCredentialRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_webauthn_credential")
    .insert({
      account_id: input.account_id,
      credential_id: input.credential_id,
      credential_public_key: input.credential_public_key,
      counter: input.counter,
      transports: input.transports ?? null,
      device_label: input.device_label ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `webauthn-service.saveCredential: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexWebauthnCredentialRow;
}

/** Look up one credential by its opaque credential_id (base64url). */
export async function getCredentialById(
  credentialId: string,
): Promise<NexWebauthnCredentialRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_webauthn_credential")
    .select("*")
    .eq("credential_id", credentialId)
    .maybeSingle();
  if (error) {
    throw new Error(`webauthn-service.getCredentialById: ${error.message}`);
  }
  return (data as NexWebauthnCredentialRow) ?? null;
}

/** List every credential registered to a given account. */
export async function listCredentialsForAccount(
  accountId: NexUuid,
): Promise<NexWebauthnCredentialRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_webauthn_credential")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`webauthn-service.listCredentialsForAccount: ${error.message}`);
  }
  return (data as NexWebauthnCredentialRow[]) ?? [];
}

/** Update counter + last_used_at after a successful assertion. */
export async function markCredentialUsed(
  credentialId: string,
  newCounter: number,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_webauthn_credential")
    .update({
      counter: newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("credential_id", credentialId);
  if (error) {
    throw new Error(`webauthn-service.markCredentialUsed: ${error.message}`);
  }
}

/** Phase 1.0 Security · owner-scoped revoke. Deletes the credential ONLY
 *  if it belongs to the supplied account. Returns true when a row was
 *  deleted · false when no matching credential exists for this owner
 *  (silent · caller treats as idempotent). */
export async function revokeCredentialForOwner(
  credentialId: string,
  ownerAccountId: NexUuid,
): Promise<boolean> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_webauthn_credential")
    .delete()
    .eq("credential_id", credentialId)
    .eq("account_id", ownerAccountId)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`webauthn-service.revokeCredentialForOwner: ${error.message}`);
  }
  return !!data?.id;
}

/** Phase 1.0 Security · owner-scoped rename of a credential's device
 *  label. Trims + truncates to 80 chars (matches the DB CHECK). Returns
 *  true when the row was updated · false when no matching credential
 *  exists for this owner. */
export async function renameCredentialForOwner(
  credentialId: string,
  ownerAccountId: NexUuid,
  newLabel: string,
): Promise<boolean> {
  const trimmed = newLabel.trim().slice(0, 80);
  if (trimmed.length === 0) {
    throw new Error("webauthn-service.renameCredentialForOwner: label required");
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_webauthn_credential")
    .update({ device_label: trimmed })
    .eq("credential_id", credentialId)
    .eq("account_id", ownerAccountId)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`webauthn-service.renameCredentialForOwner: ${error.message}`);
  }
  return !!data?.id;
}
