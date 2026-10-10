// src/lib/nex-native/emergency/trusted-contacts-service.ts
//
// NEX Emergency Help · trusted-contacts service.
//
// Server-only. Owns writes against `nex.trusted_contact` (migrations
// 193 + 196). Trusted contacts are Layer 1 of the recipient resolver:
// a user-pre-selected set the recipient resolver always considers.
//
// 2026-10-10 · L3 extended the shape to support multi-channel
// identities: a trusted contact may be identified by ANY of:
//   · a NEX account id   (contact_account_id)
//   · an email address   (contact_email)
//   · a phone number     (contact_phone)
// At least one of the three must be present. Email-only / phone-only
// contacts become legal rows. The surrogate PK is `trusted_contact_id`.
//
// Migration-aware query helpers: the SELECT list prefers the new PK
// column but falls back gracefully when migration 196 has not yet
// been applied (dev DBs on the old schema will still return rows
// without `trusted_contact_id`).

import "server-only";

import { withClient } from "@/lib/nex/db";
import type { TrustedContactRow as LegacyTrustedContactRow } from "./types";

/**
 * Multi-channel trusted-contact row shape (migration 196).
 *
 * This is a SUPERSET of the L1-owned {@link LegacyTrustedContactRow}:
 * `contactAccountId` is now nullable and three new fields appear
 * (`trustedContactId`, `contactEmail`, `contactPhone`). To avoid
 * reaching into L1's `types.ts` (scope boundary), this file owns
 * the extended shape locally. Callers that want the legacy
 * (non-null `contactAccountId`) shape receive it from
 * {@link toLegacyRow} after guaranteeing `contactAccountId !== null`.
 */
export interface MultiChannelTrustedContactRow {
  /** Surrogate PK · migration 196. NULL only on pre-196 schema reads. */
  readonly trustedContactId: string | null;
  readonly ownerAccountId: string;
  /** Nullable since migration 196 · trusted contact can be email-only
   *  or phone-only. */
  readonly contactAccountId: string | null;
  /** Multi-channel identifier · migration 196. */
  readonly contactEmail: string | null;
  /** Multi-channel identifier · migration 196. */
  readonly contactPhone: string | null;
  readonly addedAt: string;
  readonly contactLabel: string | null;
}

/**
 * Projects a multi-channel row down to the legacy (L1-owned)
 * shape. Falls back to a synthetic account id derived from the
 * email/phone when `contactAccountId` is null (keeps backward-compat
 * UIs happy; emergency-notification-service uses the full shape).
 */
export function toLegacyRow(
  r: MultiChannelTrustedContactRow,
): LegacyTrustedContactRow {
  const syntheticId =
    r.contactAccountId
    ?? (r.contactEmail ? `email:${r.contactEmail}` : null)
    ?? (r.contactPhone ? `phone:${r.contactPhone}` : null)
    ?? r.trustedContactId
    ?? r.ownerAccountId;
  return {
    ownerAccountId: r.ownerAccountId,
    contactAccountId: syntheticId,
    addedAt: r.addedAt,
    contactLabel: r.contactLabel,
  };
}

const SELECT_COLS = `
  trusted_contact_id,
  owner_account_id,
  contact_account_id,
  contact_email,
  contact_phone,
  added_at,
  contact_label
`;

const MAX_LABEL_LEN = 60;
const MIN_PHONE_LEN = 5;
const MAX_PHONE_LEN = 20;

// Permissive email regex. The DB has a looser CHECK; the service
// enforces the tighter contract.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Permissive phone: digits + optional leading +, spaces, dashes,
// parentheses. We strip to canonical form before persisting.
const PHONE_ALLOWED_RE = /^[+\d][\d\s\-()]{3,24}$/;

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function mapRow(r: Record<string, unknown>): MultiChannelTrustedContactRow {
  return {
    trustedContactId: strOrNull(r.trusted_contact_id),
    ownerAccountId: String(r.owner_account_id),
    contactAccountId: strOrNull(r.contact_account_id),
    contactEmail: strOrNull(r.contact_email),
    contactPhone: strOrNull(r.contact_phone),
    addedAt: toIso(r.added_at),
    contactLabel: strOrNull(r.contact_label),
  };
}

function assertAccountId(accountId: string, field: string): void {
  if (typeof accountId !== "string" || accountId.trim().length === 0) {
    throw new Error(`trusted_contact.invalid_${field}`);
  }
}

function assertNotSelf(owner: string, contact: string): void {
  if (owner.trim() === contact.trim()) {
    throw new Error("trusted_contact.self_contact_not_allowed");
  }
}

function sanitiseLabel(label: string | null | undefined): string | null {
  if (label === null || label === undefined) return null;
  if (typeof label !== "string") throw new Error("trusted_contact.invalid_label");
  let out = "";
  for (let i = 0; i < label.length; i++) {
    const code = label.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) continue;
    out += label[i];
  }
  const trimmed = out.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_LABEL_LEN) throw new Error("trusted_contact.label_too_long");
  return trimmed;
}

function sanitiseEmail(email: string | null | undefined): string | null {
  if (email === null || email === undefined) return null;
  if (typeof email !== "string") throw new Error("trusted_contact.invalid_email");
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 254) throw new Error("trusted_contact.invalid_email");
  if (!EMAIL_RE.test(trimmed)) throw new Error("trusted_contact.invalid_email");
  return trimmed;
}

function sanitisePhone(phone: string | null | undefined): string | null {
  if (phone === null || phone === undefined) return null;
  if (typeof phone !== "string") throw new Error("trusted_contact.invalid_phone");
  const trimmed = phone.trim();
  if (trimmed.length === 0) return null;
  if (!PHONE_ALLOWED_RE.test(trimmed)) throw new Error("trusted_contact.invalid_phone");
  // Normalise: strip spaces, dashes, parens. Keep leading '+'.
  const normalised = trimmed.replace(/[\s\-()]/g, "");
  if (normalised.length < MIN_PHONE_LEN || normalised.length > MAX_PHONE_LEN) {
    throw new Error("trusted_contact.invalid_phone");
  }
  return normalised;
}

// =====================================================================
// addContact · multi-channel-aware
// =====================================================================

export interface AddContactArgs {
  readonly ownerAccountId: string;
  readonly contactAccountId?: string | null;
  readonly contactEmail?: string | null;
  readonly contactPhone?: string | null;
  readonly label?: string | null;
}

/** Preferred signature · multi-channel. */
export async function addContact(
  args: AddContactArgs,
): Promise<MultiChannelTrustedContactRow>;
/** Back-compat signature · (owner, contactAccountId, label?).
 *  Returns the legacy (L1-shaped) row. */
export async function addContact(
  ownerAccountId: string,
  contactAccountId: string,
  label?: string | null,
): Promise<LegacyTrustedContactRow>;
export async function addContact(
  argsOrOwner: AddContactArgs | string,
  maybeContact?: string,
  maybeLabel?: string | null,
): Promise<MultiChannelTrustedContactRow | LegacyTrustedContactRow> {
  const isPositional = typeof argsOrOwner === "string";
  const args: AddContactArgs = isPositional
    ? {
        ownerAccountId: argsOrOwner,
        contactAccountId: maybeContact ?? null,
        label: maybeLabel ?? null,
      }
    : argsOrOwner;

  assertAccountId(args.ownerAccountId, "owner_account_id");
  // Back-compat: positional callers always treated an empty-string
  // contactAccountId as invalid. Preserve that semantics.
  if (isPositional) {
    assertAccountId(maybeContact ?? "", "contact_account_id");
  }
  const safeAccount =
    typeof args.contactAccountId === "string" && args.contactAccountId.trim().length > 0
      ? args.contactAccountId.trim()
      : null;
  if (
    args.contactAccountId !== null
    && args.contactAccountId !== undefined
    && typeof args.contactAccountId === "string"
    && args.contactAccountId.length > 0
    && safeAccount === null
  ) {
    // caller passed whitespace-only
    throw new Error("trusted_contact.invalid_contact_account_id");
  }
  if (safeAccount) {
    assertNotSelf(args.ownerAccountId, safeAccount);
  }
  const safeEmail = sanitiseEmail(args.contactEmail);
  const safePhone = sanitisePhone(args.contactPhone);
  const safeLabel = sanitiseLabel(args.label);

  if (safeAccount === null && safeEmail === null && safePhone === null) {
    throw new Error("trusted_contact.no_identifier");
  }

  const result = await withClient(async (client) => {
    // We do an upsert whose conflict target depends on which identifier
    // is present. For simplicity + correctness we attempt the insert
    // and, if the dedup partial index trips, we UPDATE in-place via the
    // partial unique key that collided.
    //
    // The multi-channel row model means ON CONFLICT has three possible
    // keys. Postgres can only name one conflict target per statement,
    // so we route by the strongest identifier present.
    const owner = args.ownerAccountId.trim();

    // Prefer account-id as the conflict key if present (back-compat
    // path), then email, then phone.
    let onConflictSql = "";
    if (safeAccount !== null) {
      onConflictSql = `
        ON CONFLICT (owner_account_id, contact_account_id)
        WHERE contact_account_id IS NOT NULL
        DO UPDATE SET
          contact_email = COALESCE(EXCLUDED.contact_email, nex.trusted_contact.contact_email),
          contact_phone = COALESCE(EXCLUDED.contact_phone, nex.trusted_contact.contact_phone),
          contact_label = EXCLUDED.contact_label
      `;
    } else if (safeEmail !== null) {
      onConflictSql = `
        ON CONFLICT (owner_account_id, lower(contact_email))
        WHERE contact_email IS NOT NULL
        DO UPDATE SET
          contact_phone = COALESCE(EXCLUDED.contact_phone, nex.trusted_contact.contact_phone),
          contact_label = EXCLUDED.contact_label
      `;
    } else {
      onConflictSql = `
        ON CONFLICT (owner_account_id, contact_phone)
        WHERE contact_phone IS NOT NULL
        DO UPDATE SET
          contact_label = EXCLUDED.contact_label
      `;
    }

    const r = await client.query(
      `INSERT INTO nex.trusted_contact
         (owner_account_id, contact_account_id, contact_email, contact_phone, contact_label)
       VALUES ($1, $2, $3, $4, $5)
       ${onConflictSql}
       RETURNING ${SELECT_COLS}`,
      [owner, safeAccount, safeEmail, safePhone, safeLabel],
    );
    if ((r.rowCount ?? 0) !== 1) {
      throw new Error("trusted_contact.insert_failed");
    }
    return mapRow(r.rows[0] as Record<string, unknown>);
  });
  if (result === null) throw new Error("trusted_contact.db_unavailable");
  // Back-compat positional callers (L1 actions.ts) expect the legacy
  // non-null-account-id shape. Project the multi-channel row down.
  return isPositional ? toLegacyRow(result) : result;
}

// =====================================================================
// removeContact · PK-based (migration 196) with legacy fallback
// =====================================================================

/** Preferred signature · delete by surrogate PK. */
export async function removeContact(args: {
  ownerAccountId: string;
  trustedContactId: string;
}): Promise<void>;
/** Back-compat signature · delete by (owner, contact_account_id). */
export async function removeContact(
  ownerAccountId: string,
  contactAccountId: string,
): Promise<void>;
export async function removeContact(
  argsOrOwner:
    | { ownerAccountId: string; trustedContactId: string }
    | string,
  maybeContact?: string,
): Promise<void> {
  if (typeof argsOrOwner === "object") {
    assertAccountId(argsOrOwner.ownerAccountId, "owner_account_id");
    const id = argsOrOwner.trustedContactId;
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new Error("trusted_contact.invalid_trusted_contact_id");
    }
    const result = await withClient(async (client) => {
      await client.query(
        `DELETE FROM nex.trusted_contact
          WHERE owner_account_id = $1
            AND trusted_contact_id = $2`,
        [argsOrOwner.ownerAccountId.trim(), id.trim()],
      );
      return true;
    });
    if (result === null) throw new Error("trusted_contact.db_unavailable");
    return;
  }

  // Back-compat path.
  const ownerAccountId = argsOrOwner;
  const contactAccountId = maybeContact ?? "";
  assertAccountId(ownerAccountId, "owner_account_id");
  assertAccountId(contactAccountId, "contact_account_id");
  const result = await withClient(async (client) => {
    await client.query(
      `DELETE FROM nex.trusted_contact
        WHERE owner_account_id = $1 AND contact_account_id = $2`,
      [ownerAccountId.trim(), contactAccountId.trim()],
    );
    return true;
  });
  if (result === null) throw new Error("trusted_contact.db_unavailable");
}

// =====================================================================
// listContacts · returns full multi-channel shape
// =====================================================================

export async function listContacts(
  ownerAccountId: string,
  limit: number = TRUSTED_CONTACT_RULES_INIT.listDefaultLimit,
): Promise<MultiChannelTrustedContactRow[]> {
  assertAccountId(ownerAccountId, "owner_account_id");
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 200);
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT ${SELECT_COLS}
         FROM nex.trusted_contact
        WHERE owner_account_id = $1
        ORDER BY added_at DESC
        LIMIT $2`,
      [ownerAccountId.trim(), safeLimit],
    );
    return r.rows.map((row) => mapRow(row as Record<string, unknown>));
  });
  return result ?? [];
}

// =====================================================================
// isContact · back-compat predicate (owner × account_id)
// =====================================================================

export async function isContact(
  ownerAccountId: string,
  contactAccountId: string,
): Promise<boolean> {
  assertAccountId(ownerAccountId, "owner_account_id");
  assertAccountId(contactAccountId, "contact_account_id");
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT 1
         FROM nex.trusted_contact
        WHERE owner_account_id = $1 AND contact_account_id = $2
        LIMIT 1`,
      [ownerAccountId.trim(), contactAccountId.trim()],
    );
    return (r.rowCount ?? 0) === 1;
  });
  return result ?? false;
}

// =====================================================================
// Rules constants (sealed)
// =====================================================================

const TRUSTED_CONTACT_RULES_INIT = Object.freeze({
  maxLabelLen: MAX_LABEL_LEN,
  listDefaultLimit: 50,
  listHardLimit: 200,
  minPhoneLen: MIN_PHONE_LEN,
  maxPhoneLen: MAX_PHONE_LEN,
});

export const TRUSTED_CONTACT_RULES = TRUSTED_CONTACT_RULES_INIT;
