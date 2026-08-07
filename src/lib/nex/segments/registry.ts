// NEX Audience Engine · segment CRUD
//
// Reads/writes nex.contact_segments. Segments are DEFINITIONS, not
// materialised results · the count is always recomputed via preview().

import type { AudienceFilter, Segment, SegmentInput } from "./types";

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

function rowToSegment(r: Record<string, unknown>): Segment {
  return {
    segment_id: String(r.segment_id),
    name: String(r.name),
    description: (r.description as string | null) ?? null,
    filter: (r.filter as AudienceFilter) ?? {},
    created_by: (r.created_by as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    used_count: Number(r.used_count ?? 0),
    last_used_at: (r.last_used_at as string | null) ?? null,
  };
}

export async function listSegments(): Promise<Segment[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT * FROM nex.contact_segments WHERE archived_at IS NULL ORDER BY last_used_at DESC NULLS LAST, updated_at DESC LIMIT 200`,
    );
    return res.rows.map(rowToSegment);
  });
  return r ?? [];
}

export async function getSegment(id: string): Promise<Segment | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.contact_segments WHERE segment_id = $1 AND archived_at IS NULL`, [id]);
    return res.rows[0] ? rowToSegment(res.rows[0]) : null;
  });
  return r ?? null;
}

export async function createSegment(input: SegmentInput): Promise<Segment | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.contact_segments (name, description, filter, created_by)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING *`,
      [input.name, input.description ?? null, JSON.stringify(input.filter), input.created_by ?? null],
    );
    return res.rows[0] ? rowToSegment(res.rows[0]) : null;
  });
  return r;
}

export async function updateSegment(id: string, patch: Partial<SegmentInput>): Promise<Segment | null> {
  const r = await withClient(async (c) => {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.name !== undefined)        { params.push(patch.name);                          sets.push(`name = $${params.length}`); }
    if (patch.description !== undefined) { params.push(patch.description);                   sets.push(`description = $${params.length}`); }
    if (patch.filter !== undefined)      { params.push(JSON.stringify(patch.filter));        sets.push(`filter = $${params.length}::jsonb`); }
    if (sets.length === 0) return null;
    sets.push(`updated_at = NOW()`);
    params.push(id);
    const res = await c.query(`UPDATE nex.contact_segments SET ${sets.join(", ")} WHERE segment_id = $${params.length} AND archived_at IS NULL RETURNING *`, params);
    return res.rows[0] ? rowToSegment(res.rows[0]) : null;
  });
  return r;
}

export async function archiveSegment(id: string): Promise<boolean> {
  const r = await withClient(async (c) => {
    const res = await c.query(`UPDATE nex.contact_segments SET archived_at = NOW() WHERE segment_id = $1 AND archived_at IS NULL RETURNING segment_id`, [id]);
    return (res.rowCount ?? 0) > 0;
  });
  return r ?? false;
}

export async function bumpSegmentUsage(id: string): Promise<void> {
  await withClient(async (c) => {
    await c.query(`UPDATE nex.contact_segments SET used_count = used_count + 1, last_used_at = NOW() WHERE segment_id = $1`, [id]);
    return null;
  });
}
