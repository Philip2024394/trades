// NEX Comms Centre · Social · content template CRUD.
//
// Templates carry typed variable slots that bind to (source_kind,
// source_path). Phase 2 uses template-fill mode exclusively; the
// LLM-composed mode declared in Charter §S-III lands in Phase 3.

import type { PgClientLike } from "@/lib/nex/db";
import type { TenantId } from "../types";
import type {
  ContentTemplate, TemplateCTASlot, TemplateHashtagSlot,
  TemplateKind, TemplateVariableSlot,
} from "./types";

function isoOf(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v); const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

function rowToTemplate(r: Record<string, unknown>): ContentTemplate {
  return {
    template_id:     String(r.template_id),
    tenant_id:       (r.tenant_id as string | null) ?? null,
    slug:            String(r.slug),
    kind:            r.kind as TemplateKind,
    body:            String(r.body),
    variable_slots:  (r.variable_slots as TemplateVariableSlot[]) ?? [],
    hashtags_slots:  (r.hashtags_slots as TemplateHashtagSlot[]) ?? [],
    cta_slot:        (r.cta_slot as TemplateCTASlot | null) ?? null,
    min_source_refs: Number(r.min_source_refs ?? 1),
    status:          r.status as ContentTemplate["status"],
    created_at:      isoOf(r.created_at) ?? new Date().toISOString(),
    updated_at:      isoOf(r.updated_at) ?? new Date().toISOString(),
  };
}

export interface UpsertTemplateInput {
  client:          PgClientLike;
  tenant_id:       TenantId | null;
  slug:            string;
  kind:            TemplateKind;
  body:            string;
  variable_slots:  TemplateVariableSlot[];
  hashtags_slots?: TemplateHashtagSlot[];
  cta_slot?:       TemplateCTASlot | null;
  min_source_refs?: number;
  status?:         ContentTemplate["status"];
}

export async function upsertContentTemplate(input: UpsertTemplateInput): Promise<ContentTemplate> {
  const r = await input.client.query(
    `INSERT INTO nex.social_content_templates
       (tenant_id, slug, kind, body, variable_slots, hashtags_slots, cta_slot, min_source_refs, status)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9)
     ON CONFLICT (tenant_id, slug) DO UPDATE
       SET kind = EXCLUDED.kind,
           body = EXCLUDED.body,
           variable_slots = EXCLUDED.variable_slots,
           hashtags_slots = EXCLUDED.hashtags_slots,
           cta_slot = EXCLUDED.cta_slot,
           min_source_refs = EXCLUDED.min_source_refs,
           status = EXCLUDED.status,
           updated_at = NOW()
     RETURNING *`,
    [
      input.tenant_id, input.slug, input.kind, input.body,
      JSON.stringify(input.variable_slots),
      JSON.stringify(input.hashtags_slots ?? []),
      input.cta_slot ? JSON.stringify(input.cta_slot) : null,
      input.min_source_refs ?? 1,
      input.status ?? "active",
    ],
  );
  return rowToTemplate(r.rows[0]);
}

export async function getTemplate(
  client: PgClientLike,
  tenant_id: TenantId,
  template_id: string,
): Promise<ContentTemplate | null> {
  // RLS allows tenant to read own OR Nex-owned (tenant_id IS NULL).
  const r = await client.query(
    `SELECT * FROM nex.social_content_templates
      WHERE template_id = $1
        AND (tenant_id = $2 OR tenant_id IS NULL)`,
    [template_id, tenant_id],
  );
  return r.rows[0] ? rowToTemplate(r.rows[0]) : null;
}

export async function listTemplates(
  client: PgClientLike,
  tenant_id: TenantId,
  kind?: TemplateKind,
): Promise<ContentTemplate[]> {
  const params: unknown[] = [tenant_id];
  let sql = `SELECT * FROM nex.social_content_templates
              WHERE (tenant_id = $1 OR tenant_id IS NULL)
                AND status = 'active'`;
  if (kind) { params.push(kind); sql += ` AND kind = $${params.length}`; }
  sql += ` ORDER BY kind, slug`;
  const r = await client.query(sql, params);
  return r.rows.map(rowToTemplate);
}
