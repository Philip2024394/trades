// src/lib/nex-native/directory/owner-claim/actions.ts
//
// NEX Directory - Owner Claim - Server Actions.
//
// WHAT THIS MODULE IS
//   The compositional layer between the OwnerClaimForm (client) and
//   the three sealed subsystems that own the real work:
//
//     1. draft-service       (migration 190 - durable owner draft store)
//     2. claims/claim-service(migration 176 - universal claim code + verify)
//     3. listing-chat path   (sealed email send adapter via Agent C)
//
//   Nothing in this file duplicates logic that lives in a sealed
//   module. The server actions resolve the viewer id (same cookie
//   convention as Agent C's listing-chat flow), delegate persistence
//   to draft-service, delegate code issuance + verification to
//   claim-service, and surface honest reasons when a downstream
//   channel adapter does not yet exist (SMS / WhatsApp / phone).
//
// SEALED CONTRACT
//   - Email channel: works end-to-end via `sendOwnerInviteEmail` /
//     `tryResolveOwnerEmailFromListing`.
//   - SMS / WhatsApp / phone: the claim-service CAN mint a code but
//     NEX has no adapter to actually deliver it. The action returns
//     `{ ok: false, reason: "channel_adapter_not_implemented", channel }`
//     and transitions the draft to `blocked` so admins can follow up.
//     No fabricated success.
//   - The cross-DB owner link to Supabase nex_business is NOT written
//     here. The sealed `claimed_by_account_id` TEXT column accepts the
//     opaque `anon:<uuid>` fingerprint OR a resolved Supabase account
//     id; the completion runbook describes the operator-owned
//     Supabase migration that writes `nex_business.canonical_business_id`
//     separately.
//
// DOCTRINE
//   - Session identity resolved via `resolveNexAppSessionFromContext`
//     when the viewer is signed in; otherwise the `nex_dir_visitor`
//     cookie (Agent C convention) provides an `anon:<uuid>` fingerprint.
//   - All DB operations degrade gracefully when NEX_POSTGRES_URL is
//     unset (returns `db_unavailable`). We never silently succeed.
//   - Doctrine 7: NEVER return draft_json content inside a reason or
//     detail string. Reasons stay in a short sealed vocabulary.

"use server";

import { randomUUID } from "node:crypto";
import { cookies as nextCookies } from "next/headers";

import { Client } from "pg";

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  createClaim,
  verifyClaim,
} from "@/lib/nex-native/claims/claim-service";
import { CLAIM_CHANNELS, type ClaimChannel } from "@/lib/nex-native/claims/claim-logic";
import {
  tryResolveOwnerEmailFromListing,
} from "@/lib/nex/listing-chat";
import { sendOwnerInviteEmail } from "@/lib/nex/listing-chat/owner-invite";

import { validateClaimDraft } from "./schema";
import {
  loadDraft as serviceLoadDraft,
  saveDraft as serviceSaveDraft,
  updateContact as serviceUpdateContact,
  transitionStatus as serviceTransitionStatus,
  type OwnerClaimDraftRow,
} from "./draft-service";
import {
  CLAIM_CONTACT_CHANNELS,
  type OwnerClaimDraft,
  type ClaimContactChannel,
} from "./types";

// =====================================================================
// Section 1 - Shared constants + viewer resolver (Agent C convention)
// =====================================================================

/** Same cookie Agent C's listing-chat flow uses - preserves the single
 *  per-browser fingerprint so a user who chatted with the listing
 *  and then started a claim sees the same opaque id in both places. */
const VISITOR_COOKIE_NAME = "nex_dir_visitor";
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/** Which claim channels have a working send adapter today. Keep this
 *  in lock-step with the sealed `sendOwnerInviteEmail` path - any
 *  future SMS / WhatsApp adapter flips its entry to `true` here AND
 *  teaches `requestClaimCodeAction` to dispatch via the new adapter. */
const CHANNEL_ADAPTER_LIVE: Readonly<Record<ClaimChannel, boolean>> = {
  email: true,
  sms: false,
  whatsapp: false,
  phone: false,
} as const;

/**
 * Resolve the viewer fingerprint. Two paths:
 *
 *   1. Signed-in NEX account - uses `nex_account.id` (UUID). This is
 *      the same id the sealed claim-service would stamp on
 *      `claimed_by_account_id` once the owner verifies.
 *
 *   2. Anonymous visitor - reads `nex_dir_visitor` cookie; if absent,
 *      mints a `crypto.randomUUID()` prefixed with `anon:` and sets
 *      the cookie httpOnly for 180 days. Mirrors Agent C's resolver.
 *
 * Returns a tuple of (fingerprint, isSignedIn, accountId|null). The
 * accountId is populated ONLY on the signed-in path.
 */
async function resolveFingerprint(): Promise<{
  readonly fingerprint: string;
  readonly isSignedIn: boolean;
  readonly accountId: string | null;
}> {
  const session = await resolveNexAppSessionFromContext();
  if (session?.account?.id) {
    return {
      fingerprint: session.account.id,
      isSignedIn: true,
      accountId: session.account.id,
    };
  }

  const store = await nextCookies();
  const existing = store.get(VISITOR_COOKIE_NAME)?.value;
  if (existing && existing.length >= 8 && existing.length <= 128) {
    return { fingerprint: existing, isSignedIn: false, accountId: null };
  }
  const minted = `anon:${randomUUID()}`;
  store.set(VISITOR_COOKIE_NAME, minted, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
  });
  return { fingerprint: minted, isSignedIn: false, accountId: null };
}

// =====================================================================
// Section 2 - Shared types
// =====================================================================

export type ClaimActionBlockerReason =
  | "blank_canonical_id"
  | "invalid_draft"
  | "invalid_channel"
  | "blank_destination"
  | "destination_too_long"
  | "canonical_not_found"
  | "canonical_already_claimed"
  | "draft_not_found"
  | "draft_wrong_status"
  | "owner_email_unresolved"
  | "channel_adapter_not_implemented"
  | "claim_service_failed"
  | "code_mismatch"
  | "attempts_exhausted"
  | "db_unavailable";

export interface ActionFailure<R extends string = ClaimActionBlockerReason> {
  readonly ok: false;
  readonly reason: R;
  readonly channel?: ClaimChannel;
  readonly detail?: string;
  readonly validation_errors?: readonly { path: string; message: string }[];
}

// ---------- loadDraftAction ----------

export interface LoadDraftActionResult {
  readonly ok: true;
  readonly draft: OwnerClaimDraft | null;
  readonly contact_channel: ClaimChannel | null;
  readonly contact_destination: string | null;
  readonly status: OwnerClaimDraftRow["status"] | null;
}

// ---------- saveDraftAction ----------

export interface SaveDraftActionArgs {
  readonly canonicalId: string;
  readonly draft: OwnerClaimDraft;
}
export interface SaveDraftActionResult {
  readonly ok: true;
  readonly draft_saved_at: string;
}

// ---------- updateContactAction ----------

export interface UpdateContactActionArgs {
  readonly canonicalId: string;
  readonly channel: ClaimContactChannel;
  readonly destination: string;
}
export interface UpdateContactActionResult {
  readonly ok: true;
}

// ---------- requestClaimCodeAction ----------

export interface RequestClaimCodeArgs {
  readonly canonicalId: string;
}
export interface RequestClaimCodeOk {
  readonly ok: true;
  readonly delivery_hint: string;
  readonly channel: ClaimChannel;
}

// ---------- verifyClaimCodeAction ----------

export interface VerifyClaimCodeArgs {
  readonly canonicalId: string;
  readonly code: string;
}
export interface VerifyClaimCodeOk {
  readonly ok: true;
  readonly listing_claimed: true;
}

// =====================================================================
// Section 3 - Lightweight canonical lookup (shared across actions)
// =====================================================================

/** Opens a one-shot pg Client (not the pool) because this file was
 *  already using `Client` for the canonical-exists probe and we keep
 *  the same shape for continuity. Returns null if NEX_POSTGRES_URL is
 *  unset so callers can surface `db_unavailable`. */
function connString(): string | null {
  return (
    process.env.NEX_CANONICAL_PG_URL
    ?? process.env.NEX_POSTGRES_URL
    ?? process.env.DATABASE_URL
    ?? null
  );
}

type CanonicalLookup =
  | { readonly ok: true; readonly lifecycle_state: string; readonly name: string }
  | { readonly ok: false; readonly reason: "canonical_not_found" | "db_unavailable"; readonly detail?: string };

async function lookupCanonical(canonicalId: string): Promise<CanonicalLookup> {
  const conn = connString();
  if (!conn) {
    return {
      ok: false,
      reason: "db_unavailable",
      detail: "No NEX Postgres connection string on server.",
    };
  }
  const client = new Client({ connectionString: conn });
  try {
    await client.connect();
    const r = await client.query(
      `SELECT lifecycle_state, name_canonical
         FROM nex.business_canonical
        WHERE canonical_business_id = $1`,
      [canonicalId.trim()],
    );
    if (r.rowCount !== 1) {
      return { ok: false, reason: "canonical_not_found" };
    }
    return {
      ok: true,
      lifecycle_state: String(r.rows[0].lifecycle_state),
      name: String(r.rows[0].name_canonical ?? ""),
    };
  } catch (e) {
    return {
      ok: false,
      reason: "db_unavailable",
      detail: ((e instanceof Error) ? e.message : String(e)).replace(conn, "<redacted>"),
    };
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

// =====================================================================
// Section 4 - loadDraftAction (resume from the server-side store)
// =====================================================================

export async function loadDraftAction(
  args: { readonly canonicalId: string },
): Promise<LoadDraftActionResult | ActionFailure> {
  if (!args.canonicalId || args.canonicalId.trim().length === 0) {
    return { ok: false, reason: "blank_canonical_id" };
  }
  try {
    const { fingerprint } = await resolveFingerprint();
    const row = await serviceLoadDraft({
      canonicalId: args.canonicalId,
      fingerprint,
    });
    if (!row) {
      return {
        ok: true,
        draft: null,
        contact_channel: null,
        contact_destination: null,
        status: null,
      };
    }
    return {
      ok: true,
      draft: row.draft,
      contact_channel: row.contact_channel,
      contact_destination: row.contact_destination,
      status: row.status,
    };
  } catch (e) {
    const msg = (e instanceof Error) ? e.message : String(e);
    if (msg.includes("db_unavailable")) {
      return { ok: false, reason: "db_unavailable" };
    }
    return { ok: false, reason: "db_unavailable", detail: msg };
  }
}

// =====================================================================
// Section 5 - saveDraftAction (replaces the cross_db_write_path stub)
// =====================================================================

export async function saveDraftAction(
  args: SaveDraftActionArgs,
): Promise<SaveDraftActionResult | ActionFailure> {
  if (!args.canonicalId || args.canonicalId.trim().length === 0) {
    return { ok: false, reason: "blank_canonical_id" };
  }
  const validated = validateClaimDraft(args.draft);
  if (!validated.ok) {
    return {
      ok: false,
      reason: "invalid_draft",
      validation_errors: validated.errors.map((e) => ({
        path: e.path,
        message: e.message,
      })),
    };
  }
  const canonical = await lookupCanonical(args.canonicalId);
  if (!canonical.ok) {
    return { ok: false, reason: canonical.reason, detail: canonical.detail };
  }
  if (canonical.lifecycle_state === "OWNER_CLAIMED") {
    return { ok: false, reason: "canonical_already_claimed" };
  }

  try {
    const { fingerprint } = await resolveFingerprint();
    await serviceSaveDraft({
      canonicalId: args.canonicalId,
      fingerprint,
      draft: args.draft,
    });
    return { ok: true, draft_saved_at: new Date().toISOString() };
  } catch (e) {
    const msg = (e instanceof Error) ? e.message : String(e);
    if (msg.includes("db_unavailable")) {
      return { ok: false, reason: "db_unavailable" };
    }
    return { ok: false, reason: "db_unavailable", detail: msg };
  }
}

// =====================================================================
// Section 6 - updateContactAction (write channel + destination)
// =====================================================================

export async function updateContactAction(
  args: UpdateContactActionArgs,
): Promise<UpdateContactActionResult | ActionFailure> {
  if (!args.canonicalId || args.canonicalId.trim().length === 0) {
    return { ok: false, reason: "blank_canonical_id" };
  }
  if (!(CLAIM_CONTACT_CHANNELS as readonly string[]).includes(args.channel)) {
    return { ok: false, reason: "invalid_channel" };
  }
  const trimmed = typeof args.destination === "string" ? args.destination.trim() : "";
  if (trimmed.length === 0) {
    return { ok: false, reason: "blank_destination" };
  }
  if (trimmed.length > 160) {
    return { ok: false, reason: "destination_too_long" };
  }

  try {
    const { fingerprint } = await resolveFingerprint();
    await serviceUpdateContact({
      canonicalId: args.canonicalId,
      fingerprint,
      channel: args.channel as ClaimChannel,
      destination: trimmed,
    });
    return { ok: true };
  } catch (e) {
    const msg = (e instanceof Error) ? e.message : String(e);
    if (msg.includes("draft_not_found")) {
      return { ok: false, reason: "draft_not_found" };
    }
    if (msg.includes("invalid_destination")) {
      return { ok: false, reason: "blank_destination" };
    }
    if (msg.includes("db_unavailable")) {
      return { ok: false, reason: "db_unavailable" };
    }
    return { ok: false, reason: "db_unavailable", detail: msg };
  }
}

// =====================================================================
// Section 7 - requestClaimCodeAction (sealed claim-service + email adapter)
// =====================================================================

export async function requestClaimCodeAction(
  args: RequestClaimCodeArgs,
): Promise<RequestClaimCodeOk | ActionFailure> {
  if (!args.canonicalId || args.canonicalId.trim().length === 0) {
    return { ok: false, reason: "blank_canonical_id" };
  }

  const { fingerprint, accountId } = await resolveFingerprint();
  const draftRow = await serviceLoadDraft({
    canonicalId: args.canonicalId,
    fingerprint,
  });
  if (!draftRow) {
    return { ok: false, reason: "draft_not_found" };
  }
  // Only drafts with contact details committed may issue a code.
  // Verified / code_requested are allowed to re-send (idempotent-retry
  // in sealed claim-service supersedes the previous code).
  if (
    draftRow.status !== "contact_pending"
    && draftRow.status !== "code_requested"
  ) {
    return { ok: false, reason: "draft_wrong_status" };
  }
  if (!draftRow.contact_channel || !draftRow.contact_destination) {
    return { ok: false, reason: "blank_destination" };
  }

  const canonical = await lookupCanonical(args.canonicalId);
  if (!canonical.ok) {
    return { ok: false, reason: canonical.reason, detail: canonical.detail };
  }
  if (canonical.lifecycle_state === "OWNER_CLAIMED") {
    return { ok: false, reason: "canonical_already_claimed" };
  }

  const channel = draftRow.contact_channel;
  // HONEST BLOCKER: only email has a working send adapter in this
  // scope. SMS / WhatsApp / phone are deferred to the operator
  // runbook until a channel adapter lands.
  if (!CHANNEL_ADAPTER_LIVE[channel]) {
    try {
      await serviceTransitionStatus({
        canonicalId: args.canonicalId,
        fingerprint,
        nextStatus: "blocked",
        reason: `channel_adapter_not_implemented:${channel}`,
      });
    } catch { /* best-effort; the honest reason returns regardless */ }
    return {
      ok: false,
      reason: "channel_adapter_not_implemented",
      channel,
    };
  }

  const conn = connString();
  if (!conn) {
    return { ok: false, reason: "db_unavailable" };
  }

  // Resolve the owner's destination email. Prefer the owner-authored
  // destination (owner typed it in step 2); fall back to the listing's
  // registered email if present. If both are absent we fail honestly.
  let destinationEmail: string | null = draftRow.contact_destination;
  if (!destinationEmail || !isPlausibleEmail(destinationEmail)) {
    // Try the sealed resolver via canonical listing_ref.
    try {
      destinationEmail = await tryResolveOwnerEmailFromListing(
        `canonical:${args.canonicalId.trim()}`,
      );
    } catch {
      destinationEmail = null;
    }
  }
  if (!destinationEmail) {
    return { ok: false, reason: "owner_email_unresolved" };
  }

  // Mint the code via the sealed claim-service. The `requested_by`
  // argument is the fingerprint OR the signed-in account id (the
  // sealed service treats it as opaque text). The sealed service
  // SUPERSEDES any prior PENDING claim atomically.
  const create = await createClaim({
    canonical_business_id: args.canonicalId.trim(),
    claim_channel: channel,
    destination: destinationEmail,
    requested_by: accountId ?? fingerprint,
    connectionString: conn,
  });
  if (!create.ok) {
    return {
      ok: false,
      reason: "claim_service_failed",
      detail: create.reason,
    };
  }

  // Dispatch the code via the sealed email adapter. We author a
  // listing_ref string compatible with the sealed owner-invite path.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL
    ?? process.env.NEX_PUBLIC_BASE_URL
    ?? "http://localhost:3008";
  try {
    await sendOwnerInviteEmail({
      thread_id: create.claim_id,
      listing_ref: `canonical:${args.canonicalId.trim()}`,
      listing_business_name: canonical.name || "your business",
      owner_email: destinationEmail,
      first_message_body:
        `Your 6-digit NEX Directory claim code is: ${create.plaintext_code}\n\n`
        + `Enter it on the claim page to verify ownership. The code expires in 10 minutes.`,
      base_url: baseUrl,
    });
  } catch (e) {
    const detail = (e instanceof Error) ? e.message : String(e);
    return {
      ok: false,
      reason: "claim_service_failed",
      detail: detail.slice(0, 200),
    };
  }

  // Flip draft status to code_requested. We tolerate a benign error
  // here because the sealed claim-service already holds the auth
  // record; the UX stays correct via the next verify call.
  try {
    await serviceTransitionStatus({
      canonicalId: args.canonicalId,
      fingerprint,
      nextStatus: "code_requested",
    });
  } catch { /* ignore */ }

  return {
    ok: true,
    channel,
    delivery_hint: `A 6-digit code was sent to ${maskEmail(destinationEmail)}`,
  };
}

function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Mask the local part of an email for user-facing display:
 *    owner@example.com -> o****r@example.com */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 2) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  return `${local[0]}${"*".repeat(Math.max(local.length - 2, 1))}${local[local.length - 1]}${domain}`;
}

// =====================================================================
// Section 8 - verifyClaimCodeAction (sealed verifyClaim + status flip)
// =====================================================================

export async function verifyClaimCodeAction(
  args: VerifyClaimCodeArgs,
): Promise<VerifyClaimCodeOk | ActionFailure> {
  if (!args.canonicalId || args.canonicalId.trim().length === 0) {
    return { ok: false, reason: "blank_canonical_id" };
  }
  const code = typeof args.code === "string" ? args.code.trim() : "";
  if (code.length !== 6) {
    return { ok: false, reason: "code_mismatch" };
  }

  const { fingerprint, accountId } = await resolveFingerprint();
  const draftRow = await serviceLoadDraft({
    canonicalId: args.canonicalId,
    fingerprint,
  });
  if (!draftRow) {
    return { ok: false, reason: "draft_not_found" };
  }
  if (
    draftRow.status !== "code_requested"
    && draftRow.status !== "contact_pending"
  ) {
    return { ok: false, reason: "draft_wrong_status" };
  }

  const conn = connString();
  if (!conn) {
    return { ok: false, reason: "db_unavailable" };
  }

  // Load the latest PENDING claim for this canonical (claim-service
  // insert supersedes prior PENDING via its own txn). We identify
  // the claim_id by querying the sealed table directly for the one
  // row the service created; this is a read-only probe.
  const client = new Client({ connectionString: conn });
  let claimId: string | null = null;
  try {
    await client.connect();
    const r = await client.query(
      `SELECT claim_id
         FROM nex.business_claim
        WHERE canonical_business_id = $1
          AND state = 'PENDING'
        ORDER BY requested_at DESC
        LIMIT 1`,
      [args.canonicalId.trim()],
    );
    if (r.rowCount === 1) claimId = String(r.rows[0].claim_id);
  } catch (e) {
    const detail = ((e instanceof Error) ? e.message : String(e)).slice(0, 200);
    return { ok: false, reason: "db_unavailable", detail };
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
  if (!claimId) {
    return { ok: false, reason: "draft_wrong_status" };
  }

  const verify = await verifyClaim({
    claim_id: claimId,
    supplied_plaintext_code: code,
    account_id_asserting_claim: accountId ?? fingerprint,
    connectionString: conn,
  });

  if (verify.ok) {
    try {
      await serviceTransitionStatus({
        canonicalId: args.canonicalId,
        fingerprint,
        nextStatus: "verified",
      });
    } catch { /* ignore - the sealed claim-service already flipped canonical */ }
    return { ok: true, listing_claimed: true };
  }

  // Verification failed. The sealed service already incremented
  // attempt_count AND auto-expired on the 5th wrong try. We just
  // report the honest reason + optionally flip the draft to blocked
  // when the claim is exhausted.
  if (verify.reason === "reject_attempts_exhausted") {
    try {
      await serviceTransitionStatus({
        canonicalId: args.canonicalId,
        fingerprint,
        nextStatus: "blocked",
        reason: "attempts_exhausted",
      });
    } catch { /* ignore */ }
    return { ok: false, reason: "attempts_exhausted" };
  }
  if (verify.reason === "reject_wrong_code") {
    return { ok: false, reason: "code_mismatch" };
  }
  return {
    ok: false,
    reason: "claim_service_failed",
    detail: verify.reason,
  };
}

// =====================================================================
// Section 9 - Legacy export (preserved for the OwnerClaimForm skeleton)
// =====================================================================
//
// The prior wave's OwnerClaimForm imported `requestClaimCodeAction`
// with a different signature. We keep an alias with the new args and
// a legacy adapter so form migration can be surgical.

export interface LegacyRequestClaimCodeArgs {
  readonly canonicalId: string;
  readonly channel: ClaimContactChannel;
  readonly destination: string;
  readonly draft: OwnerClaimDraft;
}

export type LegacyRequestClaimCodeResult =
  | {
      readonly ok: true;
      readonly claim_id: string;
      readonly expires_at: string;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "invalid_draft"
        | "invalid_channel"
        | "blank_destination"
        | "blank_canonical_id"
        | "canonical_not_found"
        | "canonical_already_claimed"
        | "db_unavailable"
        | "channel_adapter_not_implemented"
        | "owner_email_unresolved"
        | "claim_service_failed"
        | "draft_not_found"
        | "draft_wrong_status";
      readonly draft_saved_at?: string;
      readonly validation_errors?: readonly { path: string; message: string }[];
      readonly detail?: string;
      readonly channel?: ClaimChannel;
    };

/**
 * Legacy adapter preserved so existing callers (OwnerClaimForm pre-
 * migration) can call a single server action that:
 *   1. saveDraft (persistent)
 *   2. updateContact (channel + destination)
 *   3. requestClaimCode (sealed service + email adapter)
 *
 * New callers should use the dedicated three-step actions above so
 * each UI step surfaces its own result shape.
 */
export async function legacyIssueClaimCodeAction(
  args: LegacyRequestClaimCodeArgs,
): Promise<LegacyRequestClaimCodeResult> {
  const save = await saveDraftAction({
    canonicalId: args.canonicalId,
    draft: args.draft,
  });
  if (!save.ok) {
    return {
      ok: false,
      reason: save.reason as LegacyRequestClaimCodeResult extends { reason: infer R } ? R : never,
      validation_errors: save.validation_errors,
      detail: save.detail,
    };
  }

  const contact = await updateContactAction({
    canonicalId: args.canonicalId,
    channel: args.channel,
    destination: args.destination,
  });
  if (!contact.ok) {
    return {
      ok: false,
      reason: contact.reason as LegacyRequestClaimCodeResult extends { reason: infer R } ? R : never,
      detail: contact.detail,
      draft_saved_at: save.draft_saved_at,
    };
  }

  const code = await requestClaimCodeAction({ canonicalId: args.canonicalId });
  if (!code.ok) {
    return {
      ok: false,
      reason: code.reason as LegacyRequestClaimCodeResult extends { reason: infer R } ? R : never,
      channel: code.channel,
      detail: code.detail,
      draft_saved_at: save.draft_saved_at,
    };
  }
  // No synthetic claim_id for legacy callers - we don't surface the
  // sealed claim id through the legacy shape to avoid tempting a
  // caller to re-use it.
  return {
    ok: true,
    claim_id: "",
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}
