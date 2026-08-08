// NEX Comms Centre · Social · content pipeline orchestrator.
//
// Threads: sources → template → generator → grounding validator →
//   nex.social_content_drafts row.
//
// This is the entry point API routes call. It never publishes; that's
// Phase 4. It just produces a draft with an explicit grounding_state.
//
// Charter §S-III enforcement summary:
//   * Fact-checker (grounding validator) is a separate module ·
//     imported here alongside the generator.
//   * Time-of-check gap: the generator lists eligible sources, and the
//     grounding validator classifies the FULL rendered candidate ·
//     both steps run within the SAME withTenantClient transaction so
//     source data cannot change between them.
//   * Fail-closed: any generator error → draft in state='rejected'.
//     Any hard-blocked or review-required claim → draft rejected.

import { withTenantClient } from "../db";
import { generateFromTemplate, type CandidatePost } from "./generator";
import { validateGrounding, validateProvenanceIntegrity } from "./grounding";
import type { PgClientLike } from "@/lib/nex/db";
import type { TenantId } from "../types";
import type { ContentDraft, ProvenanceEntry, RejectionReason } from "./types";

export interface GenerateAndGroundInput {
  tenant_id:    TenantId;
  template_id:  string;
  platform:     string;
  created_by:   string;
  source_pick?: Record<string, string>;   // optional source overrides per kind
}

export interface GenerateAndGroundResult {
  draft: ContentDraft;
}

export async function generateAndGround(input: GenerateAndGroundInput): Promise<GenerateAndGroundResult> {
  const draft = await withTenantClient(input.tenant_id, async (c) => {
    const candidate = await generateFromTemplate({
      client:      c,
      tenant_id:   input.tenant_id,
      template_id: input.template_id,
      platform:    input.platform,
      source_pick: input.source_pick as never,
    });
    if (!candidate.ok) {
      return await persistDraft(c, {
        tenant_id:         input.tenant_id,
        template_id:       input.template_id,
        platform:          input.platform,
        caption:           "",
        hashtags:          [],
        cta:               null,
        source_refs:       [],
        claims:            [],
        provenance:        {},
        grounding_state:   "rejected",
        rejection_reasons: [{
          code:     "generator_" + candidate.error_class,
          detail:   candidate.detail,
          variable: candidate.variable,
        }],
        created_by:        input.created_by,
      });
    }

    // Additional integrity check on provenance shape.
    const integrity = validateProvenanceIntegrity(candidate.provenance);
    if (!integrity.ok) {
      return await persistDraft(c, {
        tenant_id:         input.tenant_id,
        template_id:       input.template_id,
        platform:          input.platform,
        caption:           candidate.caption,
        hashtags:          candidate.hashtags,
        cta:               candidate.cta,
        source_refs:       candidate.source_refs,
        claims:            [],
        provenance:        candidate.provenance,
        grounding_state:   "rejected",
        rejection_reasons: [{ code: "provenance_integrity_failed", detail: `missing bindings: ${integrity.missing.join(",")}` }],
        created_by:        input.created_by,
      });
    }

    // Grounding validation.
    const grounding = validateGrounding(candidate);
    return await persistDraft(c, {
      tenant_id:         input.tenant_id,
      template_id:       input.template_id,
      platform:          input.platform,
      caption:           candidate.caption,
      hashtags:          candidate.hashtags,
      cta:               candidate.cta,
      source_refs:       candidate.source_refs,
      claims:            grounding.claims,
      provenance:        candidate.provenance,
      grounding_state:   grounding.grounding_state,
      rejection_reasons: grounding.rejection_reasons,
      created_by:        input.created_by,
    });
  });
  if (!draft) throw new Error("generateAndGround: db unavailable");
  return { draft };
}

// ── DB persistence helpers ─────────────────────────────────────

interface PersistArgs {
  tenant_id:         TenantId;
  template_id:       string;
  platform:          string;
  caption:           string;
  hashtags:          string[];
  cta:               string | null;
  source_refs:       string[];
  claims:            Array<Record<string, unknown>>;
  provenance:        Record<string, ProvenanceEntry>;
  grounding_state:   "pending" | "grounded" | "rejected";
  rejection_reasons: RejectionReason[];
  created_by:        string;
}

async function persistDraft(c: PgClientLike, a: PersistArgs): Promise<ContentDraft> {
  const r = await c.query(
    `INSERT INTO nex.social_content_drafts
       (tenant_id, template_id, generation_mode, platform, caption, hashtags, cta,
        source_refs, claims, provenance, grounding_state, rejection_reasons, created_by)
     VALUES ($1,$2,'template_fill',$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11::jsonb,$12)
     RETURNING draft_id, created_at, updated_at`,
    [
      a.tenant_id, a.template_id, a.platform, a.caption, a.hashtags, a.cta,
      a.source_refs, JSON.stringify(a.claims), JSON.stringify(a.provenance),
      a.grounding_state, JSON.stringify(a.rejection_reasons), a.created_by,
    ],
  );
  const row = r.rows[0];
  return {
    draft_id:          String(row.draft_id),
    tenant_id:         a.tenant_id,
    template_id:       a.template_id,
    generation_mode:   "template_fill",
    platform:          a.platform,
    caption:           a.caption,
    hashtags:          a.hashtags,
    cta:               a.cta,
    source_refs:       a.source_refs,
    claims:            a.claims as never,
    provenance:        a.provenance,
    grounding_state:   a.grounding_state,
    rejection_reasons: a.rejection_reasons,
    created_by:        a.created_by,
    created_at:        row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at:        row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export async function listDrafts(tenant_id: TenantId, limit = 50): Promise<ContentDraft[]> {
  const rows = await withTenantClient(tenant_id, async (c) => {
    const r = await c.query(
      `SELECT * FROM nex.social_content_drafts
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [tenant_id, limit],
    );
    return r.rows;
  });
  return (rows ?? []).map((r) => ({
    draft_id:          String(r.draft_id),
    tenant_id:         String(r.tenant_id),
    template_id:       (r.template_id as string | null) ?? null,
    generation_mode:   r.generation_mode as ContentDraft["generation_mode"],
    platform:          String(r.platform),
    caption:           String(r.caption),
    hashtags:          (r.hashtags as string[]) ?? [],
    cta:               (r.cta as string | null) ?? null,
    source_refs:       (r.source_refs as string[]) ?? [],
    claims:            (r.claims as ContentDraft["claims"]) ?? [],
    provenance:        (r.provenance as Record<string, ProvenanceEntry>) ?? {},
    grounding_state:   r.grounding_state as ContentDraft["grounding_state"],
    rejection_reasons: (r.rejection_reasons as RejectionReason[]) ?? [],
    created_by:        String(r.created_by),
    created_at:        r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at:        r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  }));
}
