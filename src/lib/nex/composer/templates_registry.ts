// NEX Composer · template CRUD + seed bootstrap + Mission Control metrics

import type { Block, EmailTemplate, TemplateCategory, TemplateInput } from "./types";
import { SEED_TEMPLATES, seedAsTemplates } from "./seed_templates";

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

function rowToTemplate(r: Record<string, unknown>): EmailTemplate {
  return {
    template_id: String(r.template_id),
    name: String(r.name),
    category: (r.category as TemplateCategory) ?? "other",
    description: (r.description as string | null) ?? null,
    subject: (r.subject as string | null) ?? null,
    preview_text: (r.preview_text as string | null) ?? null,
    blocks: (r.blocks as Block[]) ?? [],
    is_seed: r.is_seed === true,
    is_draft: r.is_draft === true,
    created_by: (r.created_by as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    used_count: Number(r.used_count ?? 0),
    last_used_at: (r.last_used_at as string | null) ?? null,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────
export async function listTemplates(): Promise<EmailTemplate[]> {
  const dbRows = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.email_templates WHERE archived_at IS NULL ORDER BY is_seed ASC, last_used_at DESC NULLS LAST, updated_at DESC`);
    return res.rows.map(rowToTemplate);
  });
  if (!dbRows) return seedAsTemplates(); // DB unreachable · still return seeds so UI works
  if (dbRows.length === 0) return seedAsTemplates(); // bootstrap not yet run
  return dbRows;
}

export async function getTemplate(id: string): Promise<EmailTemplate | null> {
  // Seed lookup by prefix
  if (id.startsWith("seed-")) {
    const idx = Number(id.slice(5)) - 1;
    return seedAsTemplates()[idx] ?? null;
  }
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.email_templates WHERE template_id = $1 AND archived_at IS NULL`, [id]);
    return res.rows[0] ? rowToTemplate(res.rows[0]) : null;
  });
  return r ?? null;
}

export async function createTemplate(input: TemplateInput): Promise<EmailTemplate | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.email_templates (name, category, description, subject, preview_text, blocks, is_draft, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING *`,
      [
        input.name, input.category ?? "other", input.description ?? null, input.subject ?? null,
        input.preview_text ?? null, JSON.stringify(input.blocks ?? []),
        input.is_draft ?? false, input.created_by ?? null,
      ],
    );
    return res.rows[0] ? rowToTemplate(res.rows[0]) : null;
  });
  return r;
}

export async function updateTemplate(id: string, patch: Partial<TemplateInput>): Promise<EmailTemplate | null> {
  if (id.startsWith("seed-")) return null;                       // seeds are read-only
  const r = await withClient(async (c) => {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.name         !== undefined) { params.push(patch.name);                             sets.push(`name = $${params.length}`); }
    if (patch.category     !== undefined) { params.push(patch.category);                         sets.push(`category = $${params.length}`); }
    if (patch.description  !== undefined) { params.push(patch.description);                      sets.push(`description = $${params.length}`); }
    if (patch.subject      !== undefined) { params.push(patch.subject);                          sets.push(`subject = $${params.length}`); }
    if (patch.preview_text !== undefined) { params.push(patch.preview_text);                     sets.push(`preview_text = $${params.length}`); }
    if (patch.blocks       !== undefined) { params.push(JSON.stringify(patch.blocks));           sets.push(`blocks = $${params.length}::jsonb`); }
    if (patch.is_draft     !== undefined) { params.push(patch.is_draft);                         sets.push(`is_draft = $${params.length}`); }
    if (sets.length === 0) return null;
    sets.push(`updated_at = NOW()`);
    params.push(id);
    const res = await c.query(`UPDATE nex.email_templates SET ${sets.join(", ")} WHERE template_id = $${params.length} AND is_seed = FALSE AND archived_at IS NULL RETURNING *`, params);
    return res.rows[0] ? rowToTemplate(res.rows[0]) : null;
  });
  return r;
}

export async function archiveTemplate(id: string): Promise<boolean> {
  if (id.startsWith("seed-")) return false;
  const r = await withClient(async (c) => {
    const res = await c.query(`UPDATE nex.email_templates SET archived_at = NOW() WHERE template_id = $1 AND is_seed = FALSE AND archived_at IS NULL RETURNING template_id`, [id]);
    return (res.rowCount ?? 0) > 0;
  });
  return r ?? false;
}

export async function bumpTemplateUsage(id: string): Promise<void> {
  if (id.startsWith("seed-")) return;
  await withClient(async (c) => {
    await c.query(`UPDATE nex.email_templates SET used_count = used_count + 1, last_used_at = NOW() WHERE template_id = $1`, [id]);
    return null;
  });
}

// ── Mission Control metrics ────────────────────────────────────────
export type ComposerMetrics = {
  total_templates: number;
  seed_templates: number;
  user_templates: number;
  draft_templates: number;
  most_used: { template_id: string; name: string; used_count: number } | null;
  variables_used: Array<{ name: string; count: number }>;
  ai_assisted_campaigns: number;
  templates_by_category: Record<string, number>;
};

export async function getComposerMetrics(): Promise<ComposerMetrics> {
  const seedCount = SEED_TEMPLATES.length;
  const r = await withClient(async (c) => {
    const totalRes  = await c.query(`SELECT COUNT(*)::int AS n FROM nex.email_templates WHERE archived_at IS NULL`);
    const draftRes  = await c.query(`SELECT COUNT(*)::int AS n FROM nex.email_templates WHERE is_draft = TRUE AND archived_at IS NULL`);
    const userRes   = await c.query(`SELECT COUNT(*)::int AS n FROM nex.email_templates WHERE is_seed = FALSE AND archived_at IS NULL`);
    const mostRes   = await c.query(`SELECT template_id, name, used_count FROM nex.email_templates WHERE archived_at IS NULL ORDER BY used_count DESC LIMIT 1`);
    const catRes    = await c.query(`SELECT category, COUNT(*)::int AS n FROM nex.email_templates WHERE archived_at IS NULL GROUP BY category`);
    const aiRes     = await c.query(`SELECT COUNT(*)::int AS n FROM nex.events WHERE event_type = 'composer.ai_assist_used'`).catch(() => ({ rows: [{ n: 0 }] as Record<string, unknown>[] }));

    return {
      total_templates: Number((totalRes.rows[0] as { n: number }).n) || seedCount,
      seed_templates: seedCount,
      user_templates: Number((userRes.rows[0] as { n: number }).n),
      draft_templates: Number((draftRes.rows[0] as { n: number }).n),
      most_used: mostRes.rows[0] ? {
        template_id: String(mostRes.rows[0].template_id),
        name: String(mostRes.rows[0].name),
        used_count: Number(mostRes.rows[0].used_count),
      } : null,
      ai_assisted_campaigns: Number((aiRes.rows[0] as { n: number }).n),
      templates_by_category: Object.fromEntries(catRes.rows.map((row) => [String(row.category), Number(row.n)])),
    };
  });
  const base: ComposerMetrics = {
    total_templates: seedCount, seed_templates: seedCount, user_templates: 0, draft_templates: 0,
    most_used: null, variables_used: [], ai_assisted_campaigns: 0, templates_by_category: {},
  };
  if (!r) return base;

  // Variables used · scan all non-archived templates' blocks + subjects
  const varCounts = await withClient(async (c) => {
    const res = await c.query(`SELECT blocks::text || ' ' || COALESCE(subject,'') || ' ' || COALESCE(preview_text,'') AS combined FROM nex.email_templates WHERE archived_at IS NULL`);
    const counts = new Map<string, number>();
    for (const row of res.rows) {
      const s = String(row.combined ?? "");
      const re = /\{\{\s*([a-z_]+)\s*\}\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s)) !== null) counts.set(m[1].toLowerCase(), (counts.get(m[1].toLowerCase()) ?? 0) + 1);
    }
    return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }) ?? [];

  return { ...r, variables_used: varCounts };
}

// ── Bootstrap · idempotent · call once per process ────────────────
let bootstrapDone = false;
export async function ensureSeedTemplates(): Promise<void> {
  if (bootstrapDone) return;
  bootstrapDone = true;
  await withClient(async (c) => {
    for (const s of SEED_TEMPLATES) {
      await c.query(
        `INSERT INTO nex.email_templates (name, category, description, subject, preview_text, blocks, is_seed, created_by)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb, TRUE, 'nex-seed')
         ON CONFLICT DO NOTHING`,
        [s.name, s.category, s.description, s.subject, s.preview_text, JSON.stringify(s.blocks)],
      );
    }
    return null;
  });
}
