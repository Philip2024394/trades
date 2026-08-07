// NEX Data Import Wizard · mapping profile CRUD
//
// Reads / writes nex.import_mappings via a direct pg pool. Reused across
// wizard runs so admins don't re-map "Mailchimp Export" every month.

import type { ColumnMapping, FileFormat, MappingProfile, MappingProfileInput } from "./types";

type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
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
    return new Pool({ connectionString: url, max: 3, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
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

function rowToProfile(r: Record<string, unknown>): MappingProfile {
  return {
    profile_id: String(r.profile_id),
    label: String(r.label),
    description: (r.description as string | null) ?? null,
    header_signature: String(r.header_signature),
    mapping: (r.mapping as ColumnMapping) ?? {},
    format_hint: (r.format_hint as FileFormat | null) ?? null,
    created_by: (r.created_by as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    used_count: Number(r.used_count ?? 0),
    last_used_at: (r.last_used_at as string | null) ?? null,
  };
}

export async function listMappingProfiles(): Promise<MappingProfile[]> {
  const result = await withClient(async (c) => {
    const res = await c.query(
      `SELECT * FROM nex.import_mappings WHERE archived_at IS NULL ORDER BY last_used_at DESC NULLS LAST, updated_at DESC LIMIT 200`,
    );
    return res.rows.map(rowToProfile);
  });
  return result ?? [];
}

export async function suggestMappingProfile(headerSignature: string): Promise<MappingProfile | null> {
  const result = await withClient(async (c) => {
    const res = await c.query(
      `SELECT * FROM nex.import_mappings WHERE archived_at IS NULL AND header_signature = $1 ORDER BY last_used_at DESC NULLS LAST LIMIT 1`,
      [headerSignature],
    );
    return res.rows[0] ? rowToProfile(res.rows[0]) : null;
  });
  return result ?? null;
}

export async function createMappingProfile(input: MappingProfileInput): Promise<MappingProfile | null> {
  const result = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.import_mappings (label, description, header_signature, mapping, format_hint, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING *`,
      [
        input.label,
        input.description ?? null,
        input.header_signature,
        JSON.stringify(input.mapping),
        input.format_hint ?? null,
        input.created_by ?? null,
      ],
    );
    return res.rows[0] ? rowToProfile(res.rows[0]) : null;
  });
  return result;
}

export async function bumpProfileUsage(profileId: string): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `UPDATE nex.import_mappings SET used_count = used_count + 1, last_used_at = NOW(), updated_at = NOW() WHERE profile_id = $1`,
      [profileId],
    );
    return null;
  });
}
