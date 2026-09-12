// src/app/api/nex/lab/ideas/route.ts
//
// Founder 2026-09-10 · Innovation Room · GET list of ideas.
// Query params: ?status=proposed (default) | approved | shipped | rejected | all
// Never fabricates · reads directly from nex_lab.innovation_ideas.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IdeaRow {
  idea_id: string;
  created_at: string;
  generated_by_agent: string;
  category: string;
  title: string;
  user_need: string;
  description: string;
  why_missing: string;
  evidence_refs: unknown;
  engineering_brief: string;
  difficulty: string;
  user_value: string;
  status: string;
  decided_at: string | null;
  decided_by: string | null;
  copied_at: string | null;
}

async function loadPg() { try { return (await import("pg")).Client; } catch { return null; } }
function readPgUrl() {
  return process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "proposed";
  const Client = await loadPg();
  if (!Client) return NextResponse.json({ ideas: [], error: "pg_module_missing" }, { status: 200 });
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    const q = status === "all"
      ? await c.query(`SELECT * FROM nex_lab.innovation_ideas ORDER BY created_at DESC LIMIT 200`)
      : await c.query(`SELECT * FROM nex_lab.innovation_ideas WHERE status=$1 ORDER BY created_at DESC LIMIT 200`, [status]);
    const ideas: IdeaRow[] = q.rows.map((r: any) => ({
      idea_id: r.idea_id,
      created_at: r.created_at.toISOString(),
      generated_by_agent: r.generated_by_agent,
      category: r.category,
      title: r.title,
      user_need: r.user_need,
      description: r.description,
      why_missing: r.why_missing,
      evidence_refs: r.evidence_refs,
      engineering_brief: r.engineering_brief,
      difficulty: r.difficulty,
      user_value: r.user_value,
      status: r.status,
      decided_at: r.decided_at ? r.decided_at.toISOString() : null,
      decided_by: r.decided_by,
      copied_at: r.copied_at ? r.copied_at.toISOString() : null,
    }));
    // Counts per status for the header
    const counts = await c.query(`SELECT status, count(*)::int c FROM nex_lab.innovation_ideas GROUP BY status`);
    const counts_by_status: Record<string, number> = {};
    for (const r of counts.rows) counts_by_status[r.status] = r.c;
    return NextResponse.json({ ideas, counts_by_status, filter_status: status }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ideas: [], error: `pg:${String((err as Error).message).slice(0, 120)}` }, { status: 200 });
  } finally { try { await c.end(); } catch { /* ignore */ } }
}
