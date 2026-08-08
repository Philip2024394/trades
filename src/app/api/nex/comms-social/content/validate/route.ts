// POST /api/nex/comms-social/content/validate
// Runs the safety validator pipeline against an existing draft OR an
// ad-hoc subject. Persists a nex.social_validator_runs row and updates
// the draft's validator_run_id when applicable.
//
// Body variants:
//   { tenant_id, draft_id }                              -> validate draft
//   { tenant_id, subject: {...ValidatorSubject shape} }  -> ad-hoc

import { NextResponse } from "next/server";
import { withTenantClient } from "@/lib/nex/comms-social/db";
import { runValidatorPipeline } from "@/lib/nex/comms-social/validators/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: { tenant_id?: string; draft_id?: string; subject?: never };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.tenant_id) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });

  try {
    if (body.draft_id) {
      // Load the draft (tenant-scoped) and build the subject from it.
      const draft = await withTenantClient(body.tenant_id, async (c) => {
        const r = await c.query(
          `SELECT draft_id, tenant_id, platform, caption, hashtags, cta, source_refs, provenance, claims
             FROM nex.social_content_drafts
            WHERE draft_id = $1 AND tenant_id = $2`,
          [body.draft_id, body.tenant_id]);
        return r.rows[0] ?? null;
      });
      if (!draft) return NextResponse.json({ ok: false, error: "draft_not_found" }, { status: 404 });
      const run = await runValidatorPipeline({
        tenant_id:   body.tenant_id,
        subject_kind: "draft",
        subject: {
          tenant_id:   String(draft.tenant_id),
          draft_id:    String(draft.draft_id),
          platform:    String(draft.platform),
          caption:     String(draft.caption),
          hashtags:    (draft.hashtags as string[]) ?? [],
          cta:         (draft.cta as string | null) ?? null,
          source_refs: (draft.source_refs as string[]) ?? [],
          provenance:  (draft.provenance as never) ?? {},
          claims:      (draft.claims as never) ?? [],
        },
      });
      return NextResponse.json({ ok: true, run });
    }
    if (body.subject) {
      const run = await runValidatorPipeline({
        tenant_id:    body.tenant_id,
        subject_kind: "ad_hoc",
        subject:      body.subject,
      });
      return NextResponse.json({ ok: true, run });
    }
    return NextResponse.json({ ok: false, error: "draft_id or subject required" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
