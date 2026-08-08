// NEX Comms Centre · Social · content generator (template-fill mode).
//
// Charter §S-III mode 1: template-fill.
//   Variables extracted from tenant data · no LLM-composed sentences.
//   Deterministic. Preferred default for launch.
//
// The generator NEVER performs claim classification or grounding
// validation. Those are the validator's job (§S-III: "Fact-checker
// MUST be a distinct model OR a distinct model+prompt combination").
// The generator produces a CandidatePost + explicit provenance; the
// grounding validator decides whether it can be published.

import { getBySourcePath, getSourceById, listEligibleSources } from "./sources";
import { getTemplate } from "./templates";
import type {
  ContentSource, ContentSourceKind, ContentTemplate,
  ProvenanceEntry, TemplateVariableSlot,
} from "./types";
import type { PgClientLike } from "@/lib/nex/db";
import type { TenantId } from "../types";

export interface GenerateFromTemplateInput {
  client:        PgClientLike;
  tenant_id:     TenantId;
  template_id:   string;
  platform:      string;
  source_pick?:  Partial<Record<ContentSourceKind, string>>;  // optional: force a particular source per kind
}

export type CandidatePost = {
  ok:              true;
  template_id:     string;
  platform:        string;
  caption:         string;
  hashtags:        string[];
  cta:             string | null;
  source_refs:     string[];
  provenance:      Record<string, ProvenanceEntry>;
} | {
  ok:              false;
  template_id:     string;
  error_class:     "missing_source" | "missing_field" | "unresolved_variable" | "template_not_found" | "template_inactive";
  detail:          string;
  variable?:       string;
};

// Regex for {{var}} · variable names are letters/digits/underscore.
const VAR_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

// Pick a source for a slot: caller-supplied pick wins · else first
// eligible source of the declared kind (deterministic order from lister).
async function pickSourceForSlot(
  client: PgClientLike,
  tenant_id: TenantId,
  slot: TemplateVariableSlot,
  pickOverride: Partial<Record<ContentSourceKind, string>> | undefined,
  cache: Map<ContentSourceKind, ContentSource[]>,
): Promise<ContentSource | null> {
  const override = pickOverride?.[slot.source_kind];
  if (override) {
    return await getSourceById(client, tenant_id, override);
  }
  if (!cache.has(slot.source_kind)) {
    cache.set(slot.source_kind, await listEligibleSources(client, tenant_id, slot.source_kind));
  }
  const list = cache.get(slot.source_kind)!;
  return list[0] ?? null;
}

function fillCaption(template: ContentTemplate, provenance: Record<string, ProvenanceEntry>): string {
  return template.body.replace(VAR_RE, (_full, name: string) => provenance[name]?.value ?? "");
}
function fillCTA(template: ContentTemplate, provenance: Record<string, ProvenanceEntry>): string | null {
  if (!template.cta_slot) return null;
  return template.cta_slot.template.replace(VAR_RE, (_full, name: string) => provenance[name]?.value ?? "");
}

export async function generateFromTemplate(input: GenerateFromTemplateInput): Promise<CandidatePost> {
  const template = await getTemplate(input.client, input.tenant_id, input.template_id);
  if (!template) return { ok: false, template_id: input.template_id, error_class: "template_not_found", detail: "no such template" };
  if (template.status !== "active") return { ok: false, template_id: input.template_id, error_class: "template_inactive", detail: `status=${template.status}` };

  const provenance: Record<string, ProvenanceEntry> = {};
  const source_ids = new Set<string>();
  const sourceCache = new Map<ContentSourceKind, ContentSource[]>();

  for (const slot of template.variable_slots) {
    const source = await pickSourceForSlot(input.client, input.tenant_id, slot, input.source_pick, sourceCache);
    if (!source) {
      if (slot.required) {
        return {
          ok: false, template_id: input.template_id,
          error_class: "missing_source",
          variable: slot.name,
          detail: `no eligible source of kind '${slot.source_kind}' for variable '${slot.name}'`,
        };
      }
      continue;
    }
    const value = getBySourcePath(source, slot.source_path);
    if (value === undefined || value === null || String(value).length === 0) {
      if (slot.required) {
        return {
          ok: false, template_id: input.template_id,
          error_class: "missing_field",
          variable: slot.name,
          detail: `source '${source.source_id}' lacks field '${slot.source_path}'`,
        };
      }
      continue;
    }
    provenance[slot.name] = {
      variable:    slot.name,
      source_id:   source.source_id,
      source_kind: source.kind,
      source_path: slot.source_path,
      value:       String(value),
    };
    source_ids.add(source.source_id);
  }

  // Any {{var}} in the body must have provenance or the template failed.
  const referenced: string[] = [];
  let mm: RegExpExecArray | null;
  const scan = new RegExp(VAR_RE.source, "g");
  while ((mm = scan.exec(template.body)) !== null) referenced.push(mm[1]);
  const missing = referenced.filter((v) => provenance[v] === undefined);
  if (missing.length > 0) {
    return {
      ok: false, template_id: input.template_id,
      error_class: "unresolved_variable",
      variable: missing[0],
      detail: `caption references {{${missing.join(", ")}}} without a source binding`,
    };
  }

  const caption  = fillCaption(template, provenance);
  const cta      = fillCTA(template, provenance);
  const hashtags = template.hashtags_slots.map((h) => h.tag);

  return {
    ok:            true,
    template_id:   input.template_id,
    platform:      input.platform,
    caption,
    hashtags,
    cta,
    source_refs:   Array.from(source_ids),
    provenance,
  };
}
