// NEX Food · Layer 3 · claim service (shared library).
//
// Extracted from scripts/nex-food/claim.mjs so admin CLI and public API routes
// both call the same code path. Layer 3 adds two new entry paths:
//   · self_service_claim   — owner claims an existing discovered/listed listing
//   · self_service_register — owner registers a brand-new business
//
// Doctrine:
//   · project_nex_food_flywheel_over_scraping_2026_08_21 (owner-claim = pull side)
//   · project_nex_acquisition_machine_scheduled_agents_2026_08_21 (Gate 3 becomes
//     trivially true when owner supplies contact themselves at owner_verified)
//   · project_nex_should_know_not_ask_2026_08_21 (form fields minimum · never ask
//     for anything NEX can already infer)
//
// Trust hierarchy: source_import < nex_curated < admin_verified < owner_verified.
// This module writes owner_verified for every field the owner supplied at
// register-time, ONLY after successful OTP verify.

import type { Pool } from "pg";
import { randomInt } from "node:crypto";

export const CLAIM_CODE_LENGTH = 6;
export const CLAIM_CODE_TTL_MS = 10 * 60 * 1000;
export const CLAIM_CODE_MAX_ATTEMPTS = 5;

// Which claim_status values are valid entry points for a self-service claim.
// Widened from Phase 6 admin flow (listed/invited) to include discovered so
// newly-acquired records can be claimed directly by their owner without
// waiting for admin outreach — this is the flywheel's pull side.
export const CLAIMABLE_STATES = ["discovered", "listed", "invited"] as const;

// Fields the owner may supply at register/claim-start time. Anything not in
// this allowlist is IGNORED — never trust arbitrary client input.
export const OWNER_SUPPLIABLE_FIELDS = [
  "business_name",
  "category",
  "address",
  "district",
  "whatsapp_number",
  "phone",
  "website",
  "opening_information",
  "public_social_links",
] as const;
export type OwnerSuppliableField = typeof OWNER_SUPPLIABLE_FIELDS[number];

export type OwnerSuppliedData = Partial<Record<OwnerSuppliableField, unknown>>;
export type EntryPath = "admin_cli" | "self_service_claim" | "self_service_register";

export function generateClaimCode(): string {
  const digits: string[] = [];
  for (let i = 0; i < CLAIM_CODE_LENGTH; i++) digits.push(String(randomInt(0, 10)));
  return digits.join("");
}

export function computeExpiry(): Date {
  return new Date(Date.now() + CLAIM_CODE_TTL_MS);
}

function normaliseWhatsApp(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new Error("Invalid WhatsApp number");
  return "+" + digits;
}

function sanitiseOwnerData(input: unknown): OwnerSuppliedData {
  if (!input || typeof input !== "object") return {};
  const src = input as Record<string, unknown>;
  const out: OwnerSuppliedData = {};
  for (const key of OWNER_SUPPLIABLE_FIELDS) {
    if (src[key] !== undefined && src[key] !== null && src[key] !== "") {
      out[key] = src[key];
    }
  }
  if (out.whatsapp_number) {
    out.whatsapp_number = normaliseWhatsApp(String(out.whatsapp_number));
  }
  return out;
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function crockfordSuffix(n: number): string {
  const digits: string[] = [];
  for (let i = 0; i < 5; i++) { digits.unshift(CROCKFORD[n & 31] ?? "0"); n >>>= 5; }
  return digits.join("");
}

// ── request a claim code (self-service or admin) ─────────────────────────────

export interface RequestCodeOptions {
  pool: Pool;
  businessRef: string;
  entryPath: EntryPath;
  actor: string;                 // 'owner:self_service' | 'admin:philip' | etc.
  language?: "id" | "en";
  ownerData?: OwnerSuppliedData; // captured, promoted only after verify
  destination?: string;          // override destination WhatsApp/phone
}

export interface RequestCodeResult {
  ok: true;
  claimCodeId: string;
  destination: string;
  expiresAt: Date;
  devPlaintextCode: string | null; // populated only in dev-mode
}

export async function requestClaimCode(opts: RequestCodeOptions): Promise<RequestCodeResult> {
  const { pool, businessRef, entryPath, actor, ownerData } = opts;

  const bizQ = await pool.query(
    `SELECT public_listing_ref, business_name, claim_status,
            whatsapp_number, phone
     FROM nex.food_business WHERE public_listing_ref = $1`,
    [businessRef]
  );
  if (bizQ.rowCount === 0) throw new Error(`No business ref=${businessRef}`);
  const b = bizQ.rows[0];
  if (!CLAIMABLE_STATES.includes(b.claim_status)) {
    throw new Error(`Cannot claim · current claim_status=${b.claim_status} (must be one of: ${CLAIMABLE_STATES.join(", ")})`);
  }

  // Destination priority: owner-supplied WhatsApp (from ownerData) > existing
  // whatsapp_number > existing phone. Self-service flows will always supply
  // WhatsApp (that's the whole point). Admin flow uses existing.
  const suppliedWA = typeof ownerData?.whatsapp_number === "string" ? ownerData.whatsapp_number : null;
  const destination = opts.destination ?? suppliedWA ?? b.whatsapp_number ?? b.phone;
  if (!destination) throw new Error(`No WhatsApp/phone destination available for ${businessRef}`);

  // Invalidate previous active codes
  await pool.query(
    `UPDATE nex.food_claim_code
     SET invalidated_at = now(), invalidated_reason = 'superseded_by_new_request'
     WHERE business_ref = $1 AND consumed_at IS NULL AND invalidated_at IS NULL`,
    [businessRef]
  );

  const code = generateClaimCode();
  const expiresAt = computeExpiry();
  const sanitised = ownerData ? sanitiseOwnerData(ownerData) : null;

  const ins = await pool.query(
    `INSERT INTO nex.food_claim_code
       (business_ref, code_hash, destination, channel, requested_by,
        expires_at, pending_owner_data, entry_path)
     VALUES ($1, crypt($2, gen_salt('bf')), $3, 'whatsapp', $4, $5, $6, $7)
     RETURNING claim_code_id`,
    [businessRef, code, destination, actor, expiresAt,
     sanitised ? JSON.stringify(sanitised) : null, entryPath]
  );

  const devMode = process.env.NEX_FOOD_DEV_SHOW_OTP === "true";
  if (devMode) {
    console.log(`[NEX_FOOD_DEV_SHOW_OTP] claim code for ${businessRef}: ${code} (expires ${expiresAt.toISOString()})`);
  }

  return {
    ok: true,
    claimCodeId: ins.rows[0].claim_code_id,
    destination,
    expiresAt,
    devPlaintextCode: devMode ? code : null,
  };
}

// ── register a brand-new business, then request a code against owner WA ─────

export interface RegisterNewBusinessOptions {
  pool: Pool;
  ownerData: OwnerSuppliedData & { business_name: string; category: string; whatsapp_number: string };
  actor: string;
}

export interface RegisterNewBusinessResult extends RequestCodeResult {
  publicListingRef: string;
  businessName: string;
}

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function computeDedupeHash(o: { name: string; address?: string; phone?: string }) {
  const nameNorm = normaliseName(o.name);
  const addrNorm = normaliseName(o.address ?? "");
  const phoneTail = String(o.phone ?? "").replace(/\D+/g, "").slice(-6);
  return [nameNorm, addrNorm, phoneTail, "", ""].join("|");
}

export async function registerNewBusiness(opts: RegisterNewBusinessOptions): Promise<RegisterNewBusinessResult> {
  const { pool, ownerData, actor } = opts;
  if (!ownerData.business_name) throw new Error("business_name required");
  if (!ownerData.category) throw new Error("category required");
  if (!ownerData.whatsapp_number) throw new Error("whatsapp_number required");

  const sanitised = sanitiseOwnerData(ownerData) as typeof ownerData;

  // Assign next public_listing_ref (Crockford Base32 · continues sequence)
  const yr = String(new Date().getUTCFullYear());
  const maxR = await pool.query(
    `SELECT public_listing_ref FROM nex.food_business
     WHERE public_listing_ref LIKE $1 ORDER BY public_listing_ref DESC LIMIT 1`,
    [`#FL-${yr}-%`]
  );
  let nextCounter = 1;
  if (maxR.rowCount && maxR.rowCount > 0) {
    const suffix = maxR.rows[0].public_listing_ref.split("-").at(-1) as string;
    let n = 0;
    for (const c of suffix) { const v = CROCKFORD.indexOf(c); if (v < 0) { n = 0; break; } n = (n << 5) + v; }
    nextCounter = n + 1;
  }
  const publicRef = `#FL-${yr}-${crockfordSuffix(nextCounter)}`;

  const dedupeHash = computeDedupeHash({
    name: sanitised.business_name!,
    address: sanitised.address as string | undefined,
    phone: (sanitised.phone ?? sanitised.whatsapp_number) as string | undefined,
  });

  // Insert at claim_status='listed' (pending owner verify) · owner_status='contacted'
  // (owner initiated · not yet verified). We DO NOT write the supplied fields
  // to owner_verified provenance here — that happens on verify success only.
  // The record's typed columns get the owner-supplied values so /food renders
  // something useful immediately, but with source='self_service_register' so
  // an audit knows these are OWNER-CLAIMED-BUT-NOT-YET-VERIFIED.
  await pool.query(
    `INSERT INTO nex.food_business (
       public_listing_ref, business_name, category, address, district, city,
       whatsapp_number, phone, website,
       opening_information, public_social_links,
       source, source_ingested_at, source_licence_terms,
       dedupe_hash, claim_status, owner_status, created_by
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       'self_service_register', now(),
       'owner-supplied · not yet OTP-verified',
       $12, 'listed', 'contacted', $13
     )`,
    [
      publicRef,
      sanitised.business_name,
      sanitised.category,
      sanitised.address ?? null,
      sanitised.district ?? null,
      "Yogyakarta",
      sanitised.whatsapp_number,
      sanitised.phone ?? null,
      sanitised.website ?? null,
      sanitised.opening_information ? JSON.stringify(sanitised.opening_information) : null,
      sanitised.public_social_links ? JSON.stringify(sanitised.public_social_links) : null,
      dedupeHash,
      actor,
    ]
  );

  // Immediately issue claim code
  const codeResult = await requestClaimCode({
    pool, businessRef: publicRef, entryPath: "self_service_register",
    actor, ownerData: sanitised,
  });

  return {
    ...codeResult,
    publicListingRef: publicRef,
    businessName: sanitised.business_name!,
  };
}

// ── verify a claim code + promote owner-supplied fields ─────────────────────

export interface VerifyClaimCodeOptions {
  pool: Pool;
  businessRef: string;
  code: string;
}

export interface VerifyClaimCodeResult {
  ok: true;
  publicListingRef: string;
  businessName: string;
  promotedFields: string[];
}

export async function verifyClaimCode(opts: VerifyClaimCodeOptions): Promise<VerifyClaimCodeResult> {
  const { pool, businessRef, code } = opts;
  if (!/^\d{6}$/.test(code)) throw new Error("invalid code format · must be 6 digits");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const codeQ = await client.query(
      `SELECT claim_code_id, expires_at, attempt_count, pending_owner_data, entry_path
       FROM nex.food_claim_code
       WHERE business_ref = $1 AND consumed_at IS NULL AND invalidated_at IS NULL
       ORDER BY requested_at DESC LIMIT 1
       FOR UPDATE`,
      [businessRef]
    );
    if (codeQ.rowCount === 0) throw new Error("No active claim code · request a new one");
    const c = codeQ.rows[0];

    if (new Date(c.expires_at) < new Date()) {
      await client.query(
        `UPDATE nex.food_claim_code SET invalidated_at = now(), invalidated_reason = 'expired'
         WHERE claim_code_id = $1`, [c.claim_code_id]
      );
      throw new Error("Code expired · request a new one");
    }
    if (c.attempt_count >= CLAIM_CODE_MAX_ATTEMPTS) {
      await client.query(
        `UPDATE nex.food_claim_code SET invalidated_at = now(), invalidated_reason = 'attempt_limit'
         WHERE claim_code_id = $1`, [c.claim_code_id]
      );
      throw new Error("Too many attempts · request a new code");
    }

    const match = await client.query(
      `SELECT code_hash = crypt($1, code_hash) AS matched FROM nex.food_claim_code WHERE claim_code_id = $2`,
      [code, c.claim_code_id]
    );
    const matched = match.rows[0]?.matched === true;
    await client.query(
      `UPDATE nex.food_claim_code SET attempt_count = attempt_count + 1 WHERE claim_code_id = $1`,
      [c.claim_code_id]
    );
    if (!matched) {
      const remaining = CLAIM_CODE_MAX_ATTEMPTS - (c.attempt_count + 1);
      await client.query("COMMIT");
      throw new Error(`Code incorrect · ${remaining} attempt(s) remaining`);
    }

    // Success · consume + flip
    await client.query(
      `UPDATE nex.food_claim_code SET consumed_at = now() WHERE claim_code_id = $1`,
      [c.claim_code_id]
    );
    // Freshness doctrine (Philip 2026-08-21): owner OTP verification is the
    // STRONGEST evidence a business is currently operating (owner responded
    // in real time via WhatsApp). Update last_verified_at + verification_source
    // so this record enters FRESH freshness band immediately.
    const updated = await client.query(
      `UPDATE nex.food_business
       SET claim_status = 'claimed',
           owner_status = 'verified',
           last_verified_at = now(),
           verification_source = 'owner_otp'
       WHERE public_listing_ref = $1
       RETURNING business_name, public_listing_ref`,
      [businessRef]
    );

    // Promote every owner-supplied field to owner_verified provenance.
    // Skip if already owner_verified (never overwrite highest trust layer).
    const promoted: string[] = [];
    const pending = c.pending_owner_data as OwnerSuppliedData | null;
    if (pending && typeof pending === "object") {
      for (const [field, value] of Object.entries(pending)) {
        if (!OWNER_SUPPLIABLE_FIELDS.includes(field as OwnerSuppliableField)) continue;
        if (value === null || value === undefined || value === "") continue;
        const wr = await client.query(
          `INSERT INTO nex.food_business_field_provenance
             (business_ref, field_name, trust_layer, written_at, written_by, source_reference)
           VALUES ($1, $2, 'owner_verified', now(), $3, $4)
           ON CONFLICT (business_ref, field_name) DO UPDATE
             SET trust_layer = EXCLUDED.trust_layer,
                 written_at = EXCLUDED.written_at,
                 written_by = EXCLUDED.written_by,
                 source_reference = EXCLUDED.source_reference
             WHERE nex.food_business_field_provenance.trust_layer <> 'owner_verified'`,
          [businessRef, field, `claim:${c.entry_path}:${c.claim_code_id}`, `claim_code/${c.claim_code_id}`]
        );
        if (wr.rowCount && wr.rowCount > 0) promoted.push(field);
      }
    }

    await client.query("COMMIT");
    return {
      ok: true,
      publicListingRef: updated.rows[0].public_listing_ref,
      businessName: updated.rows[0].business_name,
      promotedFields: promoted,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
