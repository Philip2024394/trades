// GET/PUT/DELETE /api/nex/composer/templates/{id}
import { NextResponse } from "next/server";
import { archiveTemplate, getTemplate, updateTemplate } from "@/lib/nex/composer/templates_registry";
import type { TemplateInput } from "@/lib/nex/composer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = await getTemplate(id);
  if (!t) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, template: t });
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Partial<TemplateInput>;
  try { body = await request.json() as Partial<TemplateInput>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const t = await updateTemplate(id, body);
  if (!t) return NextResponse.json({ ok: false, error: "not_found_or_seed_readonly" }, { status: 404 });
  return NextResponse.json({ ok: true, template: t });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = await archiveTemplate(id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
