// POST /api/studio/templates/register
//
// Editor saves a template here. Persistence is deferred to a Supabase
// table (studio_editor_templates) in a follow-up migration — for now
// the endpoint validates the payload + appends to
// scripts/editor-templates.json so the AI editor's template picker
// can consume the saved templates immediately.

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "scripts", "editor-templates.json");

type SavedTemplate = {
  templateNumber: number;
  name: string;
  description: string;
  brandId: string;
  canvas: unknown[];
  createdAt: string;
};

export async function POST(req: Request): Promise<Response> {
  let body: SavedTemplate;
  try {
    body = (await req.json()) as SavedTemplate;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  if (!body?.name || !Array.isArray(body.canvas)) {
    return NextResponse.json({ ok: false, error: "invalid-payload" }, { status: 400 });
  }

  try {
    let templates: SavedTemplate[] = [];
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, "utf8");
      const parsed = JSON.parse(raw) as { templates?: SavedTemplate[] };
      templates = Array.isArray(parsed.templates) ? parsed.templates : [];
    }
    // Dedup by templateNumber — same number replaces the old entry.
    templates = templates.filter((t) => t.templateNumber !== body.templateNumber);
    templates.push(body);
    fs.writeFileSync(FILE, JSON.stringify({ templates }, null, 2), "utf8");
    return NextResponse.json({ ok: true, count: templates.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
