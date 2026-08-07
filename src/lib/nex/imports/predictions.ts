// NEX Data Import Wizard · duplicate + compliance predictions
//
// Reads the registry to answer, per incoming row: does a canonical contact
// already exist with this email or phone, and would this import trigger
// any compliance-ratchet warnings the admin should see BEFORE committing.

import { canonicalEmail, canonicalPhone } from "@/lib/nex/contacts/identity";
import type { ColumnMapping, ComplianceWarning, DuplicatePrediction } from "./types";
import { applyMappingToRow } from "./mapping";

type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  release: () => void;
};
type PgPoolLike = { connect: () => Promise<PgClientLike>; end: () => Promise<void> };

let poolPromise: Promise<PgPoolLike | null> | null = null;

async function getPool(): Promise<PgPoolLike | null> {
  if (poolPromise) return poolPromise;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { poolPromise = Promise.resolve(null); return poolPromise; }
  poolPromise = (async () => {
    let pg: unknown;
    try { pg = await import("pg" as string); } catch { return null; }
    const { Pool } = ((pg as { default?: unknown }).default ?? pg) as {
      Pool: new (c: { connectionString: string; max?: number; ssl?: { rejectUnauthorized: boolean } | boolean }) => PgPoolLike;
    };
    const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
    return new Pool({ connectionString: url, max: 5, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
  })();
  return poolPromise;
}

async function withClient<T>(fn: (c: PgClientLike) => Promise<T>): Promise<T | null> {
  const pool = await getPool();
  if (!pool) return null;
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}

export type PredictionsResult = {
  would_create: number;
  would_update: number;
  duplicate_predictions: DuplicatePrediction[];
  compliance_warnings: ComplianceWarning[];
};

/**
 * Batch-query the registry for every unique (email, phone) pair in the file
 * and produce per-row predictions. Registry unreachable → empty predictions
 * (admin still sees validation issues; the panel notes the missing predictions).
 */
export async function predictAgainstRegistry(
  header: string[],
  dataRows: string[][],
  mapping: ColumnMapping,
): Promise<PredictionsResult> {
  const empty: PredictionsResult = { would_create: 0, would_update: 0, duplicate_predictions: [], compliance_warnings: [] };

  type Incoming = {
    row_index: number;
    email: string | null;
    phone: string | null;
    ce: string | null;
    cp: string | null;
    consent_marketing_incoming: string | undefined;
  };

  const incoming: Incoming[] = [];
  const emailsToLookup = new Set<string>();
  const phonesToLookup = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const rowIndex = i + 1;
    const { mapped } = applyMappingToRow(header, dataRows[i], mapping);
    const email = mapped.email ?? null;
    const phone = mapped.phone ?? null;
    if (!email && !phone) continue;
    const ce = canonicalEmail(email);
    const cp = canonicalPhone(phone);
    if (!ce && !cp) continue;
    incoming.push({ row_index: rowIndex, email, phone, ce, cp, consent_marketing_incoming: undefined });
    if (ce) emailsToLookup.add(ce);
    if (cp) phonesToLookup.add(cp);
  }

  if (incoming.length === 0) return empty;

  const result = await withClient(async (client) => {
    // Latest-per-key canonical contacts matching any of the lookup keys.
    const byEmail = new Map<string, { contact_id: string; unsubscribe_at: string | null; never_contact: boolean; consent_marketing: boolean | null }>();
    const byPhone = new Map<string, { contact_id: string; unsubscribe_at: string | null; never_contact: boolean; consent_marketing: boolean | null }>();

    if (emailsToLookup.size > 0) {
      const emailParams = Array.from(emailsToLookup);
      const placeholders = emailParams.map((_, i) => `$${i + 1}`).join(",");
      const res = await client.query(
        `SELECT DISTINCT ON (contact_id) contact_id, canonical_email, unsubscribe_at, never_contact, consent_marketing
         FROM nex.contacts
         WHERE canonical_email = ANY(ARRAY[${placeholders}]) AND deleted_at IS NULL
         ORDER BY contact_id, updated_at DESC`,
        emailParams,
      );
      for (const r of res.rows) {
        byEmail.set(String(r.canonical_email), {
          contact_id: String(r.contact_id),
          unsubscribe_at: (r.unsubscribe_at as string | null) ?? null,
          never_contact: r.never_contact === true,
          consent_marketing: r.consent_marketing as boolean | null,
        });
      }
    }
    if (phonesToLookup.size > 0) {
      const phoneParams = Array.from(phonesToLookup);
      const placeholders = phoneParams.map((_, i) => `$${i + 1}`).join(",");
      const res = await client.query(
        `SELECT DISTINCT ON (contact_id) contact_id, canonical_phone, unsubscribe_at, never_contact, consent_marketing
         FROM nex.contacts
         WHERE canonical_phone = ANY(ARRAY[${placeholders}]) AND deleted_at IS NULL
         ORDER BY contact_id, updated_at DESC`,
        phoneParams,
      );
      for (const r of res.rows) {
        byPhone.set(String(r.canonical_phone), {
          contact_id: String(r.contact_id),
          unsubscribe_at: (r.unsubscribe_at as string | null) ?? null,
          never_contact: r.never_contact === true,
          consent_marketing: r.consent_marketing as boolean | null,
        });
      }
    }

    let wouldCreate = 0, wouldUpdate = 0;
    const dupPreds: DuplicatePrediction[] = [];
    const warnings: ComplianceWarning[] = [];

    for (const row of incoming) {
      const emailHit = row.ce ? byEmail.get(row.ce) : undefined;
      const phoneHit = !emailHit && row.cp ? byPhone.get(row.cp) : undefined;
      const hit = emailHit ?? phoneHit;

      if (!hit) {
        wouldCreate += 1;
        continue;
      }

      wouldUpdate += 1;
      dupPreds.push({
        row_index: row.row_index,
        email: row.email,
        phone: row.phone,
        existing_contact_id: hit.contact_id,
        match_kind: emailHit ? "email_exact" : "phone_exact",
      });

      // Compliance warnings — the ratchet always wins, but the admin should
      // know when their file DISAGREES with the registry.
      if (hit.unsubscribe_at) {
        warnings.push({
          row_index: row.row_index,
          code: "would_clear_unsubscribe",
          existing_state: { unsubscribe_at: hit.unsubscribe_at },
          incoming_state: { unsubscribe_at: null },
          ratchet_will_preserve_safer_state: true,
        });
      }
      if (hit.never_contact) {
        warnings.push({
          row_index: row.row_index,
          code: "would_clear_never_contact",
          existing_state: { never_contact: true },
          incoming_state: { never_contact: false },
          ratchet_will_preserve_safer_state: true,
        });
      }
      if (hit.consent_marketing === false) {
        warnings.push({
          row_index: row.row_index,
          code: "would_grant_marketing_after_revoke",
          existing_state: { consent_marketing: false },
          incoming_state: { consent_marketing: true },
          ratchet_will_preserve_safer_state: true,
        });
      }
    }

    return { would_create: wouldCreate, would_update: wouldUpdate, duplicate_predictions: dupPreds, compliance_warnings: warnings };
  });

  return result ?? empty;
}
