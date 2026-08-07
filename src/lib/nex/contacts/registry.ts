// NEX Contact Intelligence · registry
//
// The identity spine. Every source-importer, every Email Runtime send,
// every CRM read, every Marketing filter goes through here. Do NOT
// insert into nex.contacts directly · use registry.upsert(...) so the
// canonical identity + source history + dedup gate are enforced.
//
// Doctrine: constitution_nex_contact_intelligence_registry_2026_08_07.md

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import type {
  Contact, ContactOverview, ContactSource, ContactUpsertInput, UpsertResult,
} from "./types";
import { canonicalEmail, canonicalPhone } from "./identity";

// ── Read paths (Postgres-native via `pg` for aggregates the storage
//    interface doesn't expose yet). Storage-layer save() writes go
//    through the abstraction; complex analytical reads use a direct
//    pool. Doctrine note: pulling pg via dynamic import keeps this
//    file safe to type-check even if `pg` isn't installed · same
//    pattern as the postgres storage adapter.

type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  release: () => void;
};
type PgPoolLike = { connect: () => Promise<PgClientLike>; end: () => Promise<void> };

let poolPromise: Promise<PgPoolLike | null> | null = null;

async function getPool(): Promise<PgPoolLike | null> {
  if (poolPromise) return poolPromise;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    poolPromise = Promise.resolve(null);
    return poolPromise;
  }
  poolPromise = (async () => {
    let pg: unknown;
    try {
      pg = await import("pg" as string);
    } catch {
      return null;
    }
    const { Pool } = ((pg as { default?: unknown }).default ?? pg) as {
      Pool: new (c: { connectionString: string; max?: number; ssl?: { rejectUnauthorized: boolean } | boolean }) => PgPoolLike;
    };
    const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
    return new Pool({
      connectionString: url,
      max: 5,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
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

// ── Upsert · the single entry point for source-importers ─────────
//
// Match order:
//   1. canonical_email exact
//   2. canonical_phone exact
//   3. (no match) → new contact
//
// A hit collapses into the existing contact (updated_at bumped · source
// row appended). A miss creates a new canonical row. Both cases write a
// nex.contact_sources row so the origin is preserved forever.

async function findByCanonical(email: string | null, phone: string | null): Promise<Contact | null> {
  return withClient(async (client) => {
    // Search for latest snapshot per contact_id matching either identifier.
    const params: string[] = [];
    const wheres: string[] = [];
    if (email) { params.push(email); wheres.push(`canonical_email = $${params.length}`); }
    if (phone) { params.push(phone); wheres.push(`canonical_phone = $${params.length}`); }
    if (wheres.length === 0) return null;

    const sql = `
      SELECT DISTINCT ON (contact_id) *
      FROM nex.contacts
      WHERE (${wheres.join(" OR ")}) AND deleted_at IS NULL
      ORDER BY contact_id, updated_at DESC
      LIMIT 1
    `;
    const res = await client.query(sql, params);
    return (res.rows[0] as unknown as Contact | undefined) ?? null;
  }).then((r) => r ?? null);
}

export async function upsertContact(input: ContactUpsertInput): Promise<UpsertResult> {
  const email = canonicalEmail(input.email);
  const phone = canonicalPhone(input.phone);
  if (!email && !phone) {
    throw new Error("[nex-contacts] upsert requires at least one of: email, phone");
  }

  const existing = await findByCanonical(email, phone);
  const contactId = existing?.contact_id ?? randomUUID();
  const created = !existing;
  const matchedBy: UpsertResult["matched_by"] = existing
    ? (email && existing.canonical_email === email ? "email" : "phone")
    : undefined;

  // Compliance ratchet · doctrine: "compliance state is one-way toward safety."
  // Once TRUE, never_contact stays true. Once set, unsubscribe_at is kept
  // (even if a later source shows the contact as active). Once FALSE,
  // consent_marketing / consent_transactional stay false until admin
  // explicitly re-grants. This is the core safety invariant every
  // connector inherits automatically.
  const ratchetNeverContact = (existing?.never_contact === true) || (input.never_contact === true) || false;
  const ratchetUnsubAt = existing?.unsubscribe_at ?? input.unsubscribe_at ?? null;
  const ratchetMarketing =
    (existing?.consent_marketing === false || input.consent_marketing === false)
      ? false
      : (input.consent_marketing ?? existing?.consent_marketing ?? null);
  const ratchetTransactional =
    (existing?.consent_transactional === false || input.consent_transactional === false)
      ? false
      : (input.consent_transactional ?? existing?.consent_transactional ?? null);

  // Merge existing snapshot fields with the incoming input · every new
  // upsert becomes a new snapshot with the CURRENT best-known state.
  const now = new Date().toISOString();
  const snapshot = {
    contact_id: contactId,
    email: input.email ?? existing?.email ?? null,
    canonical_email: email ?? existing?.canonical_email ?? null,
    phone: input.phone ?? existing?.phone ?? null,
    canonical_phone: phone ?? existing?.canonical_phone ?? null,
    name: input.name ?? existing?.name ?? null,
    company: input.company ?? existing?.company ?? null,
    country: input.country ?? existing?.country ?? null,
    region: input.region ?? existing?.region ?? null,
    languages: input.languages ?? existing?.languages ?? [],
    trade_categories: input.trade_categories ?? existing?.trade_categories ?? [],
    tags: input.tags ?? existing?.tags ?? [],
    kind: existing?.kind ?? null,
    source: input.source.type,
    source_ref: input.source.ref ?? null,
    consent_marketing: ratchetMarketing,
    consent_transactional: ratchetTransactional,
    consent_source: input.consent_source ?? existing?.consent_source ?? null,
    attributes: { ...(existing?.attributes ?? {}), ...(input.attributes ?? {}) },
    lifecycle_stage: input.lifecycle_stage ?? existing?.lifecycle_stage ?? null,
    first_seen_at: existing?.first_seen_at ?? now,
    last_seen_at: now,
    linked_business_id: input.linked_business_id ?? existing?.linked_business_id ?? null,
    updated_at: now,
    business_id: input.business_id ?? existing?.business_id ?? null,
    never_contact: ratchetNeverContact,
    unsubscribe_at: ratchetUnsubAt,
    last_contacted_at: existing?.last_contacted_at ?? null,
    preferred_channels: input.preferred_channels ?? existing?.preferred_channels ?? [],
    deleted_at: null,
  };

  const store = getStorage();
  await store.save(COLLECTIONS.contacts, snapshot);

  // Source row: idempotent on (source_type, source_ref) when ref is set —
  // re-syncs UPDATE the existing row's sync fields rather than creating
  // duplicate history. Rows without a source_ref (one-off touchpoints)
  // always INSERT.
  const syncStatus = input.source.metadata && (input.source.metadata as { sync_status?: string }).sync_status;
  const syncError = input.source.metadata && (input.source.metadata as { sync_error?: string }).sync_error;
  await withClient(async (client) => {
    if (input.source.ref) {
      await client.query(
        `INSERT INTO nex.contact_sources
           (source_row_id, contact_id, source_type, source_ref, source_metadata, business_id, synchronised_at, sync_status, sync_error)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5, NOW(), $6, $7)
         ON CONFLICT (source_type, source_ref) WHERE source_ref IS NOT NULL
         DO UPDATE SET
           source_metadata = EXCLUDED.source_metadata,
           synchronised_at = EXCLUDED.synchronised_at,
           sync_status     = EXCLUDED.sync_status,
           sync_error      = EXCLUDED.sync_error`,
        [contactId, input.source.type, input.source.ref, JSON.stringify(input.source.metadata ?? {}), input.business_id ?? null, syncStatus ?? "ok", syncError ?? null],
      );
    } else {
      await client.query(
        `INSERT INTO nex.contact_sources
           (source_row_id, contact_id, source_type, source_ref, source_metadata, business_id, synchronised_at, sync_status, sync_error)
         VALUES (gen_random_uuid(), $1, $2, NULL, $3::jsonb, $4, NOW(), $5, $6)`,
        [contactId, input.source.type, JSON.stringify(input.source.metadata ?? {}), input.business_id ?? null, syncStatus ?? "ok", syncError ?? null],
      );
    }
  });

  return { contact_id: contactId, created, matched_by: matchedBy };
}

// ── Aggregate overview for Mission Control ─────────────────────────

export async function getOverview(): Promise<ContactOverview> {
  const empty: ContactOverview = {
    total_contacts: 0,
    by_source: [], by_country: [], by_lifecycle: [],
    by_consent: {
      marketing_yes: 0, marketing_no: 0, marketing_unknown: 0,
      transactional_yes: 0, transactional_no: 0, transactional_unknown: 0,
      never_contact: 0, unsubscribed: 0,
    },
    top_tags: [], duplicates_pending: 0, merges_all_time: 0,
    recently_added: [], recently_contacted: [], growth: [],
    generated_at: new Date().toISOString(),
  };

  const result = await withClient(async (client) => {
    // Canonical rows = latest snapshot per contact_id · deleted excluded.
    // Build a CTE we reuse.
    const canonicalCte = `
      WITH canonical AS (
        SELECT DISTINCT ON (contact_id) *
        FROM nex.contacts
        WHERE deleted_at IS NULL
        ORDER BY contact_id, updated_at DESC
      )
    `;

    const [total, bySource, byCountry, byLifecycle, consent, tags, dupCount, mergeCount, recentlyAdded, recentlyContacted, growth] = await Promise.all([
      client.query(`${canonicalCte} SELECT COUNT(*)::int AS n FROM canonical`),
      client.query(`
        SELECT source_type, COUNT(DISTINCT contact_id)::int AS n
        FROM nex.contact_sources
        GROUP BY source_type
        ORDER BY n DESC
      `),
      client.query(`${canonicalCte} SELECT country, COUNT(*)::int AS n FROM canonical WHERE country IS NOT NULL GROUP BY country ORDER BY n DESC LIMIT 30`),
      client.query(`${canonicalCte} SELECT lifecycle_stage, COUNT(*)::int AS n FROM canonical WHERE lifecycle_stage IS NOT NULL GROUP BY lifecycle_stage ORDER BY n DESC`),
      client.query(`${canonicalCte}
        SELECT
          COUNT(*) FILTER (WHERE consent_marketing = TRUE)::int    AS m_yes,
          COUNT(*) FILTER (WHERE consent_marketing = FALSE)::int   AS m_no,
          COUNT(*) FILTER (WHERE consent_marketing IS NULL)::int   AS m_unk,
          COUNT(*) FILTER (WHERE consent_transactional = TRUE)::int  AS t_yes,
          COUNT(*) FILTER (WHERE consent_transactional = FALSE)::int AS t_no,
          COUNT(*) FILTER (WHERE consent_transactional IS NULL)::int AS t_unk,
          COUNT(*) FILTER (WHERE never_contact = TRUE)::int         AS never,
          COUNT(*) FILTER (WHERE unsubscribe_at IS NOT NULL)::int   AS unsub
        FROM canonical
      `),
      client.query(`${canonicalCte}
        SELECT tag, COUNT(*)::int AS n
        FROM canonical, LATERAL jsonb_array_elements_text(tags) AS tag
        GROUP BY tag
        ORDER BY n DESC
        LIMIT 20
      `),
      client.query(`SELECT COUNT(*)::int AS n FROM nex.contact_duplicate_suggestions WHERE decision IS NULL OR decision = 'pending'`),
      client.query(`SELECT COUNT(*)::int AS n FROM nex.contact_merges WHERE reversed_at IS NULL`),
      client.query(`${canonicalCte}
        SELECT contact_id, name, email, source, first_seen_at
        FROM canonical
        ORDER BY first_seen_at DESC NULLS LAST
        LIMIT 10
      `),
      client.query(`${canonicalCte}
        SELECT contact_id, name, email, last_contacted_at
        FROM canonical
        WHERE last_contacted_at IS NOT NULL
        ORDER BY last_contacted_at DESC
        LIMIT 10
      `),
      client.query(`${canonicalCte}
        SELECT to_char(date_trunc('day', first_seen_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS added
        FROM canonical
        WHERE first_seen_at >= NOW() - INTERVAL '30 days'
        GROUP BY day
        ORDER BY day
      `),
    ]);

    const consentRow = consent.rows[0] as Record<string, number> | undefined;

    return {
      total_contacts: Number(total.rows[0]?.n ?? 0),
      by_source: bySource.rows.map((r) => ({ source_type: String(r.source_type), count: Number(r.n) })),
      by_country: byCountry.rows.map((r) => ({ country: String(r.country), count: Number(r.n) })),
      by_lifecycle: byLifecycle.rows.map((r) => ({ lifecycle_stage: String(r.lifecycle_stage), count: Number(r.n) })),
      by_consent: {
        marketing_yes: Number(consentRow?.m_yes ?? 0),
        marketing_no: Number(consentRow?.m_no ?? 0),
        marketing_unknown: Number(consentRow?.m_unk ?? 0),
        transactional_yes: Number(consentRow?.t_yes ?? 0),
        transactional_no: Number(consentRow?.t_no ?? 0),
        transactional_unknown: Number(consentRow?.t_unk ?? 0),
        never_contact: Number(consentRow?.never ?? 0),
        unsubscribed: Number(consentRow?.unsub ?? 0),
      },
      top_tags: tags.rows.map((r) => ({ tag: String(r.tag), count: Number(r.n) })),
      duplicates_pending: Number(dupCount.rows[0]?.n ?? 0),
      merges_all_time: Number(mergeCount.rows[0]?.n ?? 0),
      recently_added: recentlyAdded.rows.map((r) => ({
        contact_id: String(r.contact_id),
        name: (r.name as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        source: (r.source as string | null) ?? null,
        first_seen_at: (r.first_seen_at as string | null) ?? null,
      })),
      recently_contacted: recentlyContacted.rows.map((r) => ({
        contact_id: String(r.contact_id),
        name: (r.name as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        last_contacted_at: (r.last_contacted_at as string | null) ?? null,
      })),
      growth: growth.rows.map((r) => ({ day: String(r.day), added: Number(r.added) })),
      generated_at: new Date().toISOString(),
    };
  });

  return result ?? empty;
}

// ── List / query · basic pagination for the explorer ──────────────

export type ListFilter = {
  search?: string;                                        // matches name / email / company (case-insensitive)
  country?: string;
  lifecycle_stage?: string;
  consent_marketing?: boolean;
  never_contact?: boolean;
  limit?: number;                                         // default 50 · max 500
  offset?: number;
};

export async function listContacts(filter: ListFilter = {}): Promise<{ total: number; rows: Contact[] }> {
  const emptyResult = { total: 0, rows: [] as Contact[] };
  const result = await withClient(async (client) => {
    const limit = Math.min(Math.max(1, filter.limit ?? 50), 500);
    const offset = Math.max(0, filter.offset ?? 0);
    const wheres: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];
    if (filter.search) {
      params.push(`%${filter.search.toLowerCase()}%`);
      wheres.push(`(LOWER(COALESCE(name, '')) LIKE $${params.length} OR LOWER(COALESCE(email, '')) LIKE $${params.length} OR LOWER(COALESCE(company, '')) LIKE $${params.length})`);
    }
    if (filter.country) { params.push(filter.country); wheres.push(`country = $${params.length}`); }
    if (filter.lifecycle_stage) { params.push(filter.lifecycle_stage); wheres.push(`lifecycle_stage = $${params.length}`); }
    if (typeof filter.consent_marketing === "boolean") { params.push(filter.consent_marketing); wheres.push(`consent_marketing = $${params.length}`); }
    if (typeof filter.never_contact === "boolean") { params.push(filter.never_contact); wheres.push(`never_contact = $${params.length}`); }

    const canonicalWhere = wheres.join(" AND ");
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS n FROM (
         SELECT DISTINCT ON (contact_id) *
         FROM nex.contacts
         WHERE ${canonicalWhere}
         ORDER BY contact_id, updated_at DESC
       ) AS c`,
      params,
    );
    params.push(limit); params.push(offset);
    const rowsRes = await client.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (contact_id) *
         FROM nex.contacts
         WHERE ${canonicalWhere}
         ORDER BY contact_id, updated_at DESC
       ) AS c
       ORDER BY updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      total: Number(countRes.rows[0]?.n ?? 0),
      rows: rowsRes.rows as unknown as Contact[],
    };
  });
  return result ?? emptyResult;
}

// ── Health probe ─────────────────────────────────────────────────

export async function isContactRegistryHealthy(): Promise<{ healthy: boolean; detail: string }> {
  const pool = await getPool();
  if (!pool) return { healthy: false, detail: "NEX_POSTGRES_URL not set · registry needs Postgres for aggregate reads" };
  const ok = await withClient(async (c) => {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'nex' AND table_name IN ('contacts', 'contact_sources', 'contact_merges', 'contact_duplicate_suggestions')`);
    const n = Number(r.rows[0]?.n ?? 0);
    if (n < 4) throw new Error(`only ${n}/4 required nex.contact* tables present · run: npm run nex:apply-storage-schema`);
    return true;
  }).catch((err) => err instanceof Error ? err.message : String(err));
  if (ok === true) return { healthy: true, detail: "4/4 registry tables present" };
  return { healthy: false, detail: typeof ok === "string" ? ok : "unknown" };
}
