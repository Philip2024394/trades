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
  NexAccountTier,
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
      // Sealed 2026-10-01 · every brand-new NEX account arrives in
      // the Joker theme (theme-0 · the sealed launch theme). Picker
      // at /nex-native/settings/theme can still change it later.
      chat_theme: input.chat_theme ?? "theme-0",
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
 * Value must be a live row id in nex_chat_theme (source of truth · the
 * old NEX_CHAT_THEMES static list was frozen at 5 themes and blocked
 * every catalogue-registered theme like theme-1, aurora, sunset,
 * pink-dream). We now validate against the DB and only fall back to
 * the static list when the catalogue lookup fails (never lets the
 * user set a totally-unknown value).
 */
export async function updateChatTheme(
  accountId: NexUuid,
  theme: string | null
): Promise<NexAccountRow> {
  if (theme !== null) {
    let allowed = false;
    try {
      const { data: row, error } = await nexSupabaseAdmin
        .from("nex_chat_theme")
        .select("id,is_active")
        .eq("id", theme)
        .maybeSingle();
      if (!error && row && row.is_active) allowed = true;
    } catch {
      // fall through to static allow-list
    }
    if (!allowed && !(NEX_CHAT_THEMES as readonly string[]).includes(theme)) {
      throw new Error(
        `account-service.updateChatTheme: unknown theme '${theme}'`,
      );
    }
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

/** Bridge 16d · update the account's persisted locale preference.
 *  Validated against the canonical set (id | en) · anything else
 *  throws so we can't accidentally write junk. */
export async function updateAccountLocale(
  accountId: NexUuid,
  locale: "id" | "en" | null,
): Promise<NexAccountRow> {
  if (locale !== null && locale !== "id" && locale !== "en") {
    throw new Error(
      `account-service.updateAccountLocale: invalid locale '${locale}'`,
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({ locale })
    .eq("id", accountId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `account-service.updateAccountLocale(${accountId}): ${error?.message ?? "no row"}`,
    );
  }
  return data as NexAccountRow;
}

// ---------------------------------------------------------------------------
// Tier helpers · migration 046 · Indonesia launch package doctrine
// (sealed 2026-09-27 · see CLAUDE.md "NEX PACKAGE DOCTRINE")
// ---------------------------------------------------------------------------

/** Return the effective package tier for an account.
 *
 *  This is the lazy-downgrade helper: if `tier === "bisnis"` but the
 *  subscription has already lapsed (`bisnis_expires_at < now()`), we
 *  treat the account as Gratis for feature-gate purposes without
 *  needing a scheduled job to write the demotion back to the row.
 *  Admin flows can still see the raw `tier` when displaying subscription
 *  history; this helper is what every feature gate should call.
 *
 *  `pro` accounts are also lapsable via the same field in phase 2 · for
 *  MVP `pro` is defined but unused.
 */
/** Bridge 56g · the 7-day trial window length in milliseconds ·
 *  used to compute expiry from themes_trial_used_at in JS. */
const THEMES_TRIAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function effectiveTier(
  account: Pick<
    NexAccountRow,
    "tier" | "bisnis_expires_at" | "themes_trial_used_at"
  >,
): NexAccountTier {
  // Bridge 56g · one-shot 7-day premium-theme trial grants full
  // Bisnis-tier feature access while the window is active. Once the
  // trial expires (used_at + 7 days <= now) the buyer lapses back
  // to whatever their paid tier gate resolves to below.
  if (isThemesTrialActive(account)) return "bisnis";
  if (account.tier === "gratis") return "gratis";
  const expires = account.bisnis_expires_at;
  if (!expires) return account.tier; // no expiry set · treat as current
  if (new Date(expires).getTime() < Date.now()) return "gratis";
  return account.tier;
}

/** Convenience predicate for the common feature-gate case. */
export function isBisnisOrPro(
  account: Pick<
    NexAccountRow,
    "tier" | "bisnis_expires_at" | "themes_trial_used_at"
  >,
): boolean {
  const t = effectiveTier(account);
  return t === "bisnis" || t === "pro";
}

/** Bridge 56g · has this account already consumed its lifetime
 *  7-day premium-theme trial? True once themes_trial_used_at is
 *  set · never resets. Used to hide "Try 7 days free" pills. */
export function hasUsedThemesTrial(
  account: Pick<NexAccountRow, "themes_trial_used_at">,
): boolean {
  return !!account.themes_trial_used_at;
}

/** Bridge 56g · is the account currently inside the 7-day trial
 *  window? Computed = themes_trial_used_at + 7 days > now(). */
export function isThemesTrialActive(
  account: Pick<NexAccountRow, "themes_trial_used_at">,
): boolean {
  if (!account.themes_trial_used_at) return false;
  const startMs = new Date(account.themes_trial_used_at).getTime();
  if (!Number.isFinite(startMs)) return false;
  return startMs + THEMES_TRIAL_WINDOW_MS > Date.now();
}

/** Bridge 56g · returns the trial expiry timestamp (ISO) when the
 *  trial is currently active, or null otherwise. Used by callers
 *  that want to show "N days left" to the buyer. */
export function themesTrialExpiresAt(
  account: Pick<NexAccountRow, "themes_trial_used_at">,
): string | null {
  if (!account.themes_trial_used_at) return null;
  const startMs = new Date(account.themes_trial_used_at).getTime();
  if (!Number.isFinite(startMs)) return null;
  return new Date(startMs + THEMES_TRIAL_WINDOW_MS).toISOString();
}

/** Bridge 56g · start the one-shot 7-day premium-theme trial for
 *  this account. Idempotent — returns { ok:false, reason:'already_used' }
 *  if the account has ever activated a trial. On success, sets
 *  themes_trial_used_at + themes_trial_package_id and returns the
 *  computed expiry so callers can surface it to the user. */
export async function startThemesTrial(
  accountId: NexUuid,
  packageId: string,
): Promise<
  | { ok: true; trialUsedAt: string; trialExpiresAt: string }
  | { ok: false; reason: "already_used" | "not_found" }
> {
  const current = await nexSupabaseAdmin
    .from("nex_account")
    .select("themes_trial_used_at")
    .eq("id", accountId)
    .maybeSingle();
  if (current.error) {
    throw new Error(
      `account-service.startThemesTrial(${accountId}): ${current.error.message}`,
    );
  }
  if (!current.data) return { ok: false, reason: "not_found" };
  if (current.data.themes_trial_used_at) {
    return { ok: false, reason: "already_used" };
  }
  const nowIso = new Date().toISOString();
  const cleanPackageId = packageId.trim().slice(0, 40);
  const patch = await nexSupabaseAdmin
    .from("nex_account")
    .update({
      themes_trial_used_at: nowIso,
      themes_trial_package_id: cleanPackageId,
    })
    .eq("id", accountId)
    .is("themes_trial_used_at", null)
    .select("themes_trial_used_at")
    .maybeSingle();
  if (patch.error) {
    throw new Error(
      `account-service.startThemesTrial(${accountId}): ${patch.error.message}`,
    );
  }
  if (!patch.data) return { ok: false, reason: "already_used" };
  const usedAt = patch.data.themes_trial_used_at as string;
  const expiresAt = new Date(
    new Date(usedAt).getTime() + THEMES_TRIAL_WINDOW_MS,
  ).toISOString();
  return { ok: true, trialUsedAt: usedAt, trialExpiresAt: expiresAt };
}
