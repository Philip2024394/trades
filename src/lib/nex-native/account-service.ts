// src/lib/nex-native/account-service.ts
//
// account-service · NEX identity anchor operations.
// Every downstream service resolves accounts through here.
//
// Doctrine:
//   · Identity Doctrine · nex_account.id UUID is the anchor · phone/email
//     never used as relationship keys post-signup
//   · Honest Baseline · fail loudly if the account is missing · never
//     silently create a fake row to keep code moving

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type {
  NexAccountInsert,
  NexAccountRow,
  NexChatTheme,
  NexUuid,
} from "./types";
import { NEX_CHAT_THEMES } from "./types";

/** Read one account by NEX UUID · null when not found. */
export async function getAccountById(id: NexUuid): Promise<NexAccountRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`account-service.getAccountById(${id}): ${error.message}`);
  return (data as NexAccountRow) ?? null;
}

/** Read one account by public nex_handle · null when not found. Handle
 *  format is validated app-side (^nex-[0-9]{5,}$) before the query. */
export async function getAccountByNexHandle(handle: string): Promise<NexAccountRow | null> {
  if (typeof handle !== "string" || !/^nex-[0-9]{5,}$/.test(handle)) {
    return null;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("*")
    .eq("nex_handle", handle)
    .maybeSingle();
  if (error) throw new Error(`account-service.getAccountByNexHandle: ${error.message}`);
  return (data as NexAccountRow) ?? null;
}

/** Read one account by supabase auth user id. Nullable — some accounts
 *  are anonymous (future). */
export async function getAccountBySupabaseUserId(
  supabaseUserId: NexUuid
): Promise<NexAccountRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("*")
    .eq("supabase_user_id", supabaseUserId)
    .maybeSingle();
  if (error) throw new Error(`account-service.getAccountBySupabaseUserId: ${error.message}`);
  return (data as NexAccountRow) ?? null;
}

/** Create a new account. Returns the created row · never fabricates on error.
 *  Allocates the public nex_handle in the same call so callers never see
 *  an account without one. Phone fields (Slice 1b · migration 024) are
 *  attributes only · never used as relationship keys. */
export async function createAccount(input: NexAccountInsert): Promise<NexAccountRow> {
  // Validate phone shape defensively (DB CHECK also enforces).
  const cc = input.phone_country_code ?? null;
  const nn = input.phone_national_number ?? null;
  if (cc !== null && !/^\+[0-9]{1,4}$/.test(cc)) {
    throw new Error(
      `account-service.createAccount: phone_country_code must match ^\\+[0-9]{1,4}$ · got ${cc.slice(0, 16)}`
    );
  }
  if (nn !== null && !/^[0-9]{5,15}$/.test(nn)) {
    throw new Error(
      `account-service.createAccount: phone_national_number must match ^[0-9]{5,15}$ · got ${nn.slice(0, 16)}`
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .insert({
      supabase_user_id: input.supabase_user_id ?? null,
      display_name: input.display_name,
      phone_country_code: cc,
      phone_national_number: nn,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `account-service.createAccount: ${error?.message ?? "no row returned"}`
    );
  }
  const row = data as NexAccountRow;
  if (!row.nex_handle) {
    return await ensureNexHandle(row.id);
  }
  return row;
}

/**
 * Allocate + attach a public nex_handle to an account · idempotent.
 * Returns the fully-hydrated row (with the handle). Uses the migration-013
 * SECURITY DEFINER RPC `nex_allocate_handle` so counter access is
 * serialised at the database.
 *
 * If the account already has a handle · the RPC returns it unchanged.
 * If not · the next sequential value is claimed.
 */
/**
 * Update the account's chat theme preference. `null` clears back to default.
 * Value MUST be one of NEX_CHAT_THEMES · rejected app-side before hitting
 * the DB CHECK. Storage untouched on rejection.
 */
export async function updateChatTheme(
  accountId: NexUuid,
  theme: NexChatTheme | null
): Promise<NexAccountRow> {
  if (theme !== null && !NEX_CHAT_THEMES.includes(theme)) {
    throw new Error(
      `account-service.updateChatTheme: unknown theme '${theme}' · allowed: ${NEX_CHAT_THEMES.join(", ")}`
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({ chat_theme: theme })
    .eq("id", accountId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `account-service.updateChatTheme(${accountId}): ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexAccountRow;
}

export async function ensureNexHandle(accountId: NexUuid): Promise<NexAccountRow> {
  const rpc = await nexSupabaseAdmin.rpc("nex_allocate_handle", {
    p_account_id: accountId,
  });
  if (rpc.error) {
    throw new Error(
      `account-service.ensureNexHandle(${accountId}): ${rpc.error.message}`
    );
  }
  const handle = typeof rpc.data === "string" ? rpc.data : null;
  if (!handle) {
    throw new Error(
      `account-service.ensureNexHandle(${accountId}): allocator returned no handle`
    );
  }
  const row = await getAccountById(accountId);
  if (!row) {
    throw new Error(
      `account-service.ensureNexHandle(${accountId}): account vanished after allocation`
    );
  }
  return row;
}
