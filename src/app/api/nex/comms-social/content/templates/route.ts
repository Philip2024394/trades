// POST /api/nex/comms-social/content/templates · upsert a template
// GET  /api/nex/comms-social/content/templates?tenant_id=&kind=
import { NextResponse } from "next/server";
import { withTenantClient } from "@/lib/nex/comms-social/db";
import { listTemplates, upsertContentTemplate } from "@/lib/nex/comms-social/content/templates";
import type { TemplateCTASlot, TemplateHashtagSlot, TemplateKind, TemplateVariableSlot } from "@/lib/nex/comms-social/content/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    tenant_id?: string | null; slug?: string; kind?: TemplateKind;
    body?: string; variable_slots?: TemplateVariableSlot[];
    hashtags_slots?: TemplateHashtagSlot[]; cta_slot?: TemplateCTASlot | null;
    min_source_refs?: number; status?: "draft" | "active" | "retired";
  };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.tenant_id || !body.slug || !body.kind || !body.body || !Array.isArray(body.variable_slots)) {
    return NextResponse.json({ ok: false, error: "tenant_id + slug + kind + body + variable_slots required" }, { status: 400 });
  }
  const t = await withTenantClient(body.tenant_id, async (c) =>
    await upsertContentTemplate({
      client: c, tenant_id: body.tenant_id!, slug: body.slug!, kind: body.kind!,
      body: body.body!, variable_slots: body.variable_slots!,
      hashtags_slots: body.hashtags_slots, cta_slot: body.cta_slot,
      min_source_refs: body.min_source_refs, status: body.status,
    }));
  return NextResponse.json({ ok: true, template: t });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenant_id = url.searchParams.get("tenant_id");
  if (!tenant_id) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const kind = url.searchParams.get("kind") as TemplateKind | null;
  const templates = await withTenantClient(tenant_id, async (c) =>
    await listTemplates(c, tenant_id, kind ?? undefined));
  return NextResponse.json({ ok: true, templates: templates ?? [] });
}
