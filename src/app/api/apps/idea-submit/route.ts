// POST /api/apps/idea-submit
//
// Receives merchant app-idea submissions from the warehouse LiveStrip.
// Persists to scripts/app-ideas.json so Philip can review them without
// hitting a database dependency. A follow-up migration will move this
// to Supabase; for now the file store keeps the feature shippable.

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "scripts", "app-ideas.json");

type Submission = {
  trade?: string;
  problem?: string;
  dream?: string;
  contact?: string;
};

type StoredIdea = Submission & {
  id: string;
  submittedAt: string;
};

export async function POST(req: Request): Promise<Response> {
  let body: Submission;
  try {
    body = (await req.json()) as Submission;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const problem = (body.problem ?? "").trim();
  const dream = (body.dream ?? "").trim();
  if (problem.length < 5 || dream.length < 5) {
    return NextResponse.json({ ok: false, error: "problem-and-dream-required" }, { status: 400 });
  }

  const entry: StoredIdea = {
    id: `idea_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    trade: (body.trade ?? "").trim() || undefined,
    problem,
    dream,
    contact: (body.contact ?? "").trim() || undefined,
    submittedAt: new Date().toISOString()
  };

  try {
    let ideas: StoredIdea[] = [];
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, "utf8");
      const parsed = JSON.parse(raw) as { ideas?: StoredIdea[] };
      ideas = Array.isArray(parsed.ideas) ? parsed.ideas : [];
    }
    ideas.push(entry);
    fs.writeFileSync(FILE, JSON.stringify({ ideas }, null, 2), "utf8");
    return NextResponse.json({ ok: true, id: entry.id, count: ideas.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
