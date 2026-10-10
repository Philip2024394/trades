// src/lib/nex-native/directory/owner-claim/draft-service.ts
//
// NEX Directory - Owner Claim - server-side draft store.
//
// WHAT THIS MODULE IS
//   - The thin pg wrapper around `nex.business_claim_draft` (migration
//     190). Reads + writes pre-claim owner drafts keyed by
//     (canonical_business_id, draft_fingerprint).
//   - Owns the sealed 7-state status machine:
//       draft -> contact_pending -> code_requested -> verified
//       any    -> abandoned | rejected | blocked
//   - Server-only. Must never be imported from a client component.
//
// WHAT THIS MODULE IS NOT
//   - Not a code issuer. The sealed `createClaim` / `verifyClaim` in
//     `src/lib/nex-native/claims/claim-service.ts` own that path and
//     write to `nex.business_claim` (migration 176). This module only
//     persists owner-authored business content + a lightweight contact
//     channel the sealed service consumes when it issues a code.
//   - Not an identity provider. The `fingerprint` arg is an opaque
//     per-browser id, same shape as the `nex_dir_visitor` cookie Agent
//     C's listing-chat flow uses. The sealed claim-service maps that to
//     a Supabase account_id when the owner is signed in.
//   - Not a logger of draft content. Per doctrine we log draft_id and
//     status transitions only; draft_json never surfaces in logs.
//   - Not a Supabase writer. The cross-DB owner link (nex_business
//     .canonical_business_id in Supabase) is deferred to the operator
//     runbook (docs/doctrine/owner-claim-architecture-complete-...).
//
// DOCTRINE
//   - pg withClient from `@/lib/nex/db`. Same pool the Directory
//     service uses. Returns null when NEX_POSTGRES_URL is unset so
//     dev-offline mode degrades gracefully.
//   - Fingerprint length is validated at the schema layer (migration
//     190 CHECK 8..128). We mirror that bound here to fail fast with
//     a typed reason rather than hitting the DB CHECK.
//   - All writes return void or structured result; callers decide what
//     to do with the state transition. The service NEVER throws for
//     "already in that state"; it is idempotent.

import "server-only";

import { withClient } from "@/lib/nex/db";
import { CLAIM_CHANNELS, type ClaimChannel } from "@/lib/nex-native/claims/claim-logic";
import type { OwnerClaimDraft } from "./types";

// =====================================================================
// Section 1 - Sealed status enum (mirrors migration 190 CHECK ck_bcd_status)
// =====================================================================

export const CLAIM_DRAFT_STATUSES = [
  "draft",
  "contact_pending",
  "code_requested",
  "verified",
  "abandoned",
  "rejected",
  "blocked",
] as const;
export type ClaimDraftStatus = typeof CLAIM_DRAFT_STATUSES[number];

export function isClaimDraftStatus(s: string): s is ClaimDraftStatus {
  return (CLAIM_DRAFT_STATUSES as readonly string[]).includes(s);
}

// =====================================================================
// Section 2 - Public row shape (what callers get back)
// =====================================================================

export interface OwnerClaimDraftRow {
  readonly draft_id: string;
  readonly canonical_business_id: string;
  readonly draft_fingerprint: string;
  readonly draft: OwnerClaimDraft;
  readonly contact_channel: ClaimChannel | null;
  readonly contact_destination: string | null;
  readonly status: ClaimDraftStatus;
  readonly status_reason: string | null;
  readonly last_touched_at: string;    // ISO
  readonly expires_at: string;         // ISO
  readonly created_at: string;         // ISO
}

// =====================================================================
// Section 3 - Argument guards (fingerprint shape mirrors migration 190 CHECK)
// =====================================================================

const MIN_FINGERPRINT_LEN = 8;
const MAX_FINGERPRINT_LEN = 128;
const MAX_DESTINATION_LEN = 160;

function assertFingerprint(fingerprint: string): void {
  if (
    typeof fingerprint !== "string"
    || fingerprint.length < MIN_FINGERPRINT_LEN
    || fingerprint.length > MAX_FINGERPRINT_LEN
  ) {
    throw new Error("draft_service.invalid_fingerprint");
  }
}

function assertCanonicalId(canonicalId: string): void {
  if (typeof canonicalId !== "string" || canonicalId.trim().length === 0) {
    throw new Error("draft_service.blank_canonical_id");
  }
}

// Light defensive sanitiser for the free-form contact_destination.
// Strips ASCII control characters (0x00-0x1F plus 0x7F DEL) but
// preserves spaces, dashes, dots, @, + which legitimate phone and
// email destinations need. Trims surrounding whitespace. Never
// truncates silently; out-of-bounds throws so the caller surfaces
// an honest error.
function stripControlChars(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) continue;
    out += input[i];
  }
  return out;
}

function sanitiseDestination(raw: string): string {
  if (typeof raw !== "string") {
    throw new Error("draft_service.invalid_destination");
  }
  const stripped = stripControlChars(raw).trim();
  if (stripped.length === 0 || stripped.length > MAX_DESTINATION_LEN) {
    throw new Error("draft_service.invalid_destination");
  }
  return stripped;
}

// =====================================================================
// Section 4 - Row mapping (DB row -> OwnerClaimDraftRow)
// =====================================================================

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}

function mapRow(r: Record<string, unknown>): OwnerClaimDraftRow {
  // Honest guard: `status` MUST be a known value. If an admin writes an
  // off-list value directly to the DB we surface it as the opaque string
  // via a cast. The CHECK on the table prevents this in practice but
  // we never silently coerce.
  const status = String(r.status ?? "");
  if (!isClaimDraftStatus(status)) {
    throw new Error(`draft_service.unknown_status:${status}`);
  }
  const channelRaw = r.contact_channel;
  const channel: ClaimChannel | null =
    channelRaw === null || channelRaw === undefined
      ? null
      : (CLAIM_CHANNELS as readonly string[]).includes(String(channelRaw))
          ? (String(channelRaw) as ClaimChannel)
          : null;
  return {
    draft_id: String(r.draft_id),
    canonical_business_id: String(r.canonical_business_id),
    draft_fingerprint: String(r.draft_fingerprint),
    // draft_json is stored as jsonb; pg returns it already-parsed.
    draft: (r.draft_json as OwnerClaimDraft),
    contact_channel: channel,
    contact_destination: r.contact_destination === null
      ? null
      : String(r.contact_destination),
    status,
    status_reason: r.status_reason === null ? null : String(r.status_reason),
    last_touched_at: toIso(r.last_touched_at),
    expires_at: toIso(r.expires_at),
    created_at: toIso(r.created_at),
  };
}

// =====================================================================
// Section 5 - loadDraft (hot-path read for the OwnerClaimForm)
// =====================================================================

export async function loadDraft(args: {
  readonly canonicalId: string;
  readonly fingerprint: string;
}): Promise<OwnerClaimDraftRow | null> {
  assertCanonicalId(args.canonicalId);
  assertFingerprint(args.fingerprint);

  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT draft_id, canonical_business_id, draft_fingerprint,
              draft_json, contact_channel, contact_destination,
              status, status_reason,
              last_touched_at, expires_at, created_at
         FROM nex.business_claim_draft
        WHERE canonical_business_id = $1
          AND draft_fingerprint = $2
          AND expires_at > now()
        LIMIT 1`,
      [args.canonicalId.trim(), args.fingerprint],
    );
    if (r.rowCount !== 1) return null;
    return mapRow(r.rows[0]);
  });
  // withClient returns null if the pool isn't configured OR if the
  // callback returned null. Honest: no draft -> null is the correct
  // shape for the caller.
  return result ?? null;
}

// =====================================================================
// Section 6 - saveDraft (UPSERT the draft content, idempotent)
// =====================================================================

export async function saveDraft(args: {
  readonly canonicalId: string;
  readonly fingerprint: string;
  readonly draft: OwnerClaimDraft;
  /** Optional explicit status override; defaults to leaving current
   *  status intact on update, or 'draft' on first insert. */
  readonly status?: ClaimDraftStatus;
}): Promise<void> {
  assertCanonicalId(args.canonicalId);
  assertFingerprint(args.fingerprint);

  if (!args.draft || typeof args.draft !== "object" || !("kind" in args.draft)) {
    throw new Error("draft_service.invalid_draft_shape");
  }
  if (args.status && !isClaimDraftStatus(args.status)) {
    throw new Error(`draft_service.invalid_status:${args.status}`);
  }

  const result = await withClient(async (client) => {
    // UPSERT: insert fresh at status='draft', or update draft_json +
    // last_touched_at keeping existing status unless caller overrode.
    //
    // When status is supplied we honour it on both paths. When status
    // is omitted we leave the existing status alone on UPDATE and
    // default to 'draft' on INSERT (CHECK ck_bcd_status enforces).
    await client.query(
      `INSERT INTO nex.business_claim_draft (
         canonical_business_id, draft_fingerprint, draft_json, status
       ) VALUES ($1, $2, $3::jsonb, COALESCE($4, 'draft'))
       ON CONFLICT (canonical_business_id, draft_fingerprint) DO UPDATE
         SET draft_json       = EXCLUDED.draft_json,
             last_touched_at  = now(),
             status           = COALESCE($4, nex.business_claim_draft.status)`,
      [
        args.canonicalId.trim(),
        args.fingerprint,
        JSON.stringify(args.draft),
        args.status ?? null,
      ],
    );
    return true;
  });

  if (result === null) {
    // Pool unavailable; doctrine says fail loudly not silently.
    throw new Error("draft_service.db_unavailable");
  }
  // Doctrine 7: never log draft_json contents.
  logTransition(args.canonicalId, args.status ?? "draft", "saveDraft");
}

// =====================================================================
// Section 7 - updateContact (owner commits channel + destination)
// =====================================================================

export async function updateContact(args: {
  readonly canonicalId: string;
  readonly fingerprint: string;
  readonly channel: ClaimChannel;
  readonly destination: string;
}): Promise<void> {
  assertCanonicalId(args.canonicalId);
  assertFingerprint(args.fingerprint);
  if (!(CLAIM_CHANNELS as readonly string[]).includes(args.channel)) {
    throw new Error("draft_service.invalid_channel");
  }
  const sanitisedDestination = sanitiseDestination(args.destination);

  const result = await withClient(async (client) => {
    const r = await client.query(
      `UPDATE nex.business_claim_draft
          SET contact_channel     = $3,
              contact_destination = $4,
              status              = CASE
                                      WHEN status IN ('draft', 'contact_pending')
                                      THEN 'contact_pending'
                                      ELSE status
                                    END,
              last_touched_at     = now()
        WHERE canonical_business_id = $1
          AND draft_fingerprint     = $2
          AND expires_at > now()`,
      [
        args.canonicalId.trim(),
        args.fingerprint,
        args.channel,
        sanitisedDestination,
      ],
    );
    if (r.rowCount === 0) {
      throw new Error("draft_service.draft_not_found");
    }
    return true;
  });

  if (result === null) {
    throw new Error("draft_service.db_unavailable");
  }
  logTransition(args.canonicalId, "contact_pending", "updateContact");
}

// =====================================================================
// Section 8 - transitionStatus (explicit lifecycle step)
// =====================================================================

export async function transitionStatus(args: {
  readonly canonicalId: string;
  readonly fingerprint: string;
  readonly nextStatus: ClaimDraftStatus;
  readonly reason?: string;
}): Promise<void> {
  assertCanonicalId(args.canonicalId);
  assertFingerprint(args.fingerprint);
  if (!isClaimDraftStatus(args.nextStatus)) {
    throw new Error(`draft_service.invalid_status:${args.nextStatus}`);
  }
  const reason = args.reason
    ? args.reason.slice(0, 300)
    : null;

  const result = await withClient(async (client) => {
    const r = await client.query(
      `UPDATE nex.business_claim_draft
          SET status          = $3,
              status_reason   = $4,
              last_touched_at = now()
        WHERE canonical_business_id = $1
          AND draft_fingerprint     = $2`,
      [args.canonicalId.trim(), args.fingerprint, args.nextStatus, reason],
    );
    if (r.rowCount === 0) {
      throw new Error("draft_service.draft_not_found");
    }
    return true;
  });

  if (result === null) {
    throw new Error("draft_service.db_unavailable");
  }
  logTransition(args.canonicalId, args.nextStatus, "transitionStatus");
}

// =====================================================================
// Section 9 - listDraftsForCanonical (admin-only read)
// =====================================================================

/**
 * Lists all drafts for a given canonical. Intended for the admin
 * review surface (not authored here). The caller is responsible for
 * ensuring the viewer has admin scope; this function performs NO
 * authorisation check (it is a server-only module, not an API route).
 */
export async function listDraftsForCanonical(
  canonicalId: string,
): Promise<readonly OwnerClaimDraftRow[]> {
  assertCanonicalId(canonicalId);
  const rows = await withClient(async (client) => {
    const r = await client.query(
      `SELECT draft_id, canonical_business_id, draft_fingerprint,
              draft_json, contact_channel, contact_destination,
              status, status_reason,
              last_touched_at, expires_at, created_at
         FROM nex.business_claim_draft
        WHERE canonical_business_id = $1
        ORDER BY last_touched_at DESC`,
      [canonicalId.trim()],
    );
    return r.rows.map((row) => mapRow(row));
  });
  return rows ?? [];
}

// =====================================================================
// Section 10 - Transition logger (doctrine-compliant, NEVER logs draft_json)
// =====================================================================

function logTransition(
  canonicalId: string,
  status: string,
  op: string,
): void {
  // eslint-disable-next-line no-console
  console.log(
    `[owner-claim/draft-service] ${op} canonical=${canonicalId} status=${status}`,
  );
}
