// src/app/api/nex/lab/ideas/[id]/approve/route.ts
//
// Founder 2026-09-10 · Innovation Room · approve one idea + return engineering brief.
// POST body: { decided_by?: string }
// Action: sets status='approved', decided_at=now(), decided_by=<>, copied_at=now().
// Response: the full engineering brief text so the caller can copy-paste to an engineer.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadPg() { try { return (await import("pg")).Client; } catch { return null; } }
function readPgUrl() {
  return process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let decided_by = "founder";
  try { const body = await req.json(); if (body?.decided_by) decided_by = String(body.decided_by); } catch { /* empty body ok */ }
  const Client = await loadPg();
  if (!Client) return NextResponse.json({ ok: false, error: "pg_module_missing" }, { status: 500 });
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    const existing = (await c.query(`SELECT * FROM nex_lab.innovation_ideas WHERE idea_id=$1`, [id])).rows[0];
    if (!existing) return NextResponse.json({ ok: false, error: "idea_not_found" }, { status: 404 });
    if (existing.status === "shipped") return NextResponse.json({ ok: false, error: "already_shipped" }, { status: 409 });
    await c.query(
      `UPDATE nex_lab.innovation_ideas
       SET status='approved', decided_at=now(), decided_by=$1, copied_at=now()
       WHERE idea_id=$2`,
      [decided_by, id],
    );
    // Compose the paste-ready engineer brief
    const brief = [
      `# ENGINEERING BRIEF · ${existing.title}`,
      ``,
      `**Category:** ${existing.category}    **Difficulty:** ${existing.difficulty}    **User value:** ${existing.user_value}`,
      `**Idea ID:** ${existing.idea_id}    **Approved by:** ${decided_by}    **Approved:** ${new Date().toISOString()}`,
      ``,
      `## User need`,
      existing.user_need,
      ``,
      `## What to build`,
      existing.description,
      ``,
      `## Why it's missing today`,
      existing.why_missing,
      ``,
      `## Evidence & references`,
      Array.isArray(existing.evidence_refs) ? existing.evidence_refs.join(", ") : JSON.stringify(existing.evidence_refs),
      ``,
      `## Engineering brief`,
      existing.engineering_brief,
      ``,
      `## Doctrine constraints (must respect)`,
      `- ADR-0022: no third-party image copy at any tier`,
      `- ADR-0023: seed rows always \`status=listed · claimed=false · verified=false · visibility=public\``,
      `- ADR-0003: no commission · no lead sale · fixed subscription only`,
      `- ADR-0028/0033: preserve knowledge · isolate brains · confidence <70 → save fails`,
      ``,
      `## Delivery checklist`,
      `- [ ] Implementation lands in the codebase (file paths above)`,
      `- [ ] One-line summary comment at top of every new file`,
      `- [ ] Update \`docs/features/index.md\` if a new feature area`,
      `- [ ] Type-check + lint pass`,
      `- [ ] Manual test in dev server before reporting complete`,
      `- [ ] After ship: \`UPDATE nex_lab.innovation_ideas SET status='shipped' WHERE idea_id='${existing.idea_id}';\``,
    ].join("\n");
    return NextResponse.json({ ok: true, idea_id: id, brief });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `pg:${String((err as Error).message).slice(0, 200)}` }, { status: 500 });
  } finally { try { await c.end(); } catch { /* ignore */ } }
}
