// GET/POST /api/nex/composer/templates — list + create
import { NextResponse } from "next/server";
import { createTemplate, ensureSeedTemplates, listTemplates } from "@/lib/nex/composer/templates_registry";
import type { TemplateInput } from "@/lib/nex/composer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeedTemplates();
  return NextResponse.json({ ok: true, templates: await listTemplates() });
}

export async function POST(request: Request) {
  let body: Partial<TemplateInput>;
  try { body = await request.json() as Partial<TemplateInput>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.name)              return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  if (!Array.isArray(body.blocks)) return NextResponse.json({ ok: false, error: "blocks[] required" }, { status: 400 });
  const t = await createTemplate(body as TemplateInput);
  if (!t) return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, template: t });
}
