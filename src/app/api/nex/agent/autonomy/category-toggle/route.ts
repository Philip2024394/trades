// src/app/api/nex/agent/autonomy/category-toggle/route.ts
//
// NEX Agent v1.5 · founder-only · activate or deactivate a pre-cleared category.
// POST { category_key, active: boolean, decided_by? }
// This is the ONLY way a pre-cleared category becomes active. Zero shortcuts.
// Every toggle recorded in nex_agent.decisions for audit.

import { NextResponse } from "next/server";
import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function POST(req: Request) {
  let body: { category_key?: string; active?: boolean; decided_by?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const category_key = String(body.category_key ?? "").trim();
  const active = Boolean(body.active);
  const decided_by = String(body.decided_by ?? "founder").slice(0, 60);
  if (!category_key) return NextResponse.json({ ok: false, error: "category_key_required" }, { status: 400 });

  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    const existing = (await c.query(`SELECT category_id, active FROM nex_agent.pre_cleared_categories WHERE category_key=$1`, [category_key])).rows[0];
    if (!existing) return NextResponse.json({ ok: false, error: "category_not_found" }, { status: 404 });
    if (existing.active === active) return NextResponse.json({ ok: true, unchanged: true, category_key, active });
    await c.query(`UPDATE nex_agent.pre_cleared_categories SET active=$1 WHERE category_key=$2`, [active, category_key]);
    await c.query(`INSERT INTO nex_agent.decisions (decision_kind, subject, rationale) VALUES ($1,$2,$3)`,
      ["category_toggle", category_key, `active=${active} by ${decided_by}`]);
    return NextResponse.json({ ok: true, category_key, active });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  } finally { try { await c.end(); } catch { /* ignore */ } }
}

export async function GET() {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    const r = await c.query(`SELECT category_id, category_key, category_label, description, max_files_changed, allowed_intent_kinds, allowed_path_prefixes, forbidden_path_prefixes, required_min_autonomy_tier, max_auto_applies_per_day, active FROM nex_agent.pre_cleared_categories ORDER BY category_key`);
    return NextResponse.json({ ok: true, categories: r.rows });
  } finally { try { await c.end(); } catch { /* ignore */ } }
}
