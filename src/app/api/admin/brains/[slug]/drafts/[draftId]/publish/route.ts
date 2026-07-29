// POST /api/admin/brains/[slug]/drafts/[draftId]/publish
//
// Mint a new immutable version from an APPROVED draft and set
// brains.current_version_id to point at it. This is where "draft"
// becomes "the brain everyone uses."
//
// Guardrails (all critical-path fixes locked by Philip 2026-07-28):
//   • F1 · Real authentication (extractActor now enforces allowlist + secret)
//   • Publish Module Acceptance Test — every check must pass or skip; no fails allowed
//   • F7 · Runtime cache invalidation immediately after pointer flip
//     so "published" means "live" from the next ask endpoint call
//
// Existing guardrails preserved:
//   • draft must be status=approved
//   • new semver must be > current published semver (if any)
//   • version semver must not already exist
//   • writes hammerex_nex_brain_versions row · updates brains pointer ·
//     marks draft `metadata.published_as_version_id` · leaves the draft
//     row intact (never delete per ADR-0037)

import { NextResponse, type NextRequest } from "next/server";
import {
  brainSupabase,
  brainSupabaseAvailable,
  getBrainBySlug,
  getCurrentBrainVersion,
} from "@/lib/nex/brains/_supabase";
import { withBrainWrite } from "@/lib/nex/brains/_writer";
import { BRAIN_EVENT_TYPES, type BrainDraftRow } from "@/lib/nex/brains/_living_types";
import { bumpPatch, compareSemver } from "@/lib/nex/brains/_actor";
import { runPublishAcceptanceTest } from "@/lib/nex/brains/_publish_acceptance";
import { brainCache } from "@/lib/nex/brains/_runtime_cache";
import {
  requireAuth,
  requireBrainPermission,
  requireMFA,
  toErrorResponse,
} from "@/lib/nex/brains/_route_guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_RUNTIME_VERSION = "1.0";
const BRAIN_API_VERSION = "1.0";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string; draftId: string }> }) {
  if (!brainSupabaseAvailable()) return json503();

  const { slug, draftId } = await params;

  // D1 Turn 3 · centralised guards
  let actor: { actor_id: string; actor_role: "author" | "reviewer" | "admin" | "system" | "runtime" };
  try {
    const user = await requireAuth();
    requireBrainPermission(user, slug, "publish");
    await requireMFA(user, "publish", draftId);
    actor = { actor_id: user.email, actor_role: user.nex_user.role };
  } catch (err) {
    return toErrorResponse(err);
  }
  const sb = brainSupabase()!;

  const { data: current, error: readErr } = await sb
    .from("hammerex_nex_brain_drafts").select("*").eq("brain_slug", slug).eq("id", draftId).maybeSingle();
  if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ ok: false, error: "draft_not_found" }, { status: 404 });

  const draft = current as BrainDraftRow;
  if (draft.status !== "approved") {
    return NextResponse.json({ ok: false, error: "not_approved", status: draft.status }, { status: 409 });
  }

  const brain = await getBrainBySlug(slug);
  if (!brain) return NextResponse.json({ ok: false, error: "brain_not_found" }, { status: 404 });

  // Publish Module Acceptance Test — gate before any state change
  const acceptance = await runPublishAcceptanceTest(draft, brain, actor);
  if (!acceptance.pass) {
    return NextResponse.json({
      ok: false,
      error: "acceptance_test_failed",
      acceptance,
      message: "Publish blocked. Resolve failing checks and retry.",
    }, { status: 409 });
  }

  const existingCurrent = await getCurrentBrainVersion(slug);
  const proposed = draft.proposed_semver ?? (existingCurrent ? bumpPatch(existingCurrent.version_semver) : "1.0.0");

  if (existingCurrent && compareSemver(proposed, existingCurrent.version_semver) !== 1) {
    return NextResponse.json({
      ok: false,
      error: "semver_not_greater",
      proposed,
      current: existingCurrent.version_semver,
    }, { status: 409 });
  }

  const { data: clash } = await sb
    .from("hammerex_nex_brain_versions")
    .select("id").eq("brain_slug", slug).eq("version_semver", proposed).maybeSingle();
  if (clash) {
    return NextResponse.json({ ok: false, error: "version_already_exists", version_semver: proposed }, { status: 409 });
  }

  const newVersionId = await withBrainWrite<string>(
    { ...actor, brain_slug: slug, entity_type: "brain_version", entity_id: slug },
    async () => {
      const now = new Date().toISOString();

      const { data: inserted, error: insErr } = await sb
        .from("hammerex_nex_brain_versions")
        .insert({
          brain_slug: slug,
          version_semver: proposed,
          manifest_json: draft.manifest_json,
          modules_json:  draft.modules_json,
          authored_by:   draft.author_id,
          authored_at:   draft.created_at,
          published_at:  now,
          published_by:  actor.actor_id,
          brain_api_version:       BRAIN_API_VERSION,
          minimum_runtime_version: NEX_RUNTIME_VERSION,
          current_runtime_version: NEX_RUNTIME_VERSION,
          portable: true,
          metadata: {
            source_draft_id: draftId,
            acceptance_result: acceptance,
          },
        })
        .select("id")
        .single();
      if (insErr) throw new Error(`insert version: ${insErr.message}`);
      const versionId = (inserted as { id: string }).id;

      const { error: brainErr } = await sb
        .from("hammerex_nex_brains")
        .update({ current_version_id: versionId })
        .eq("slug", slug);
      if (brainErr) throw new Error(`update brains pointer: ${brainErr.message}`);

      // Superseded pointer on the prior version (if any).
      if (existingCurrent) {
        await sb
          .from("hammerex_nex_brain_versions")
          .update({ superseded_by: versionId })
          .eq("id", existingCurrent.id);
      }

      // Mark draft as consumed but keep the row (ADR-0037 never-delete).
      await sb
        .from("hammerex_nex_brain_drafts")
        .update({
          metadata: { ...(draft.metadata ?? {}), published_as_version_id: versionId },
        })
        .eq("id", draftId);

      return {
        return_value: versionId,
        event: {
          event_type: BRAIN_EVENT_TYPES.VERSION_PUBLISHED,
          before_json: existingCurrent ? { previous_version_id: existingCurrent.id, previous_semver: existingCurrent.version_semver } : null,
          after_json:  { new_version_id: versionId, new_semver: proposed, from_draft_id: draftId },
          metadata:    { source_draft_id: draftId, acceptance_summary: acceptance.summary },
        },
      };
    }
  );

  // F7 · Runtime cache invalidation — "published" means "live" immediately.
  brainCache.invalidate(slug);

  const { data: created } = await sb.from("hammerex_nex_brain_versions").select("*").eq("id", newVersionId).single();
  return NextResponse.json({
    ok: true,
    version: created,
    published_semver: proposed,
    acceptance,
    cache_invalidated: true,
  }, { status: 201 });
}

function json503() {
  return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 503 });
}
