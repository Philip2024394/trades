// GET  /api/admin/brains/[slug]/drafts               — list all drafts for a brain (all authors)
// POST /api/admin/brains/[slug]/drafts               — get-or-create the current author's draft
//
// Draft rows are unique per (brain_slug, author_id) per the schema, so POST
// is idempotent: if a draft already exists for this author, we return it.

import { NextResponse, type NextRequest } from "next/server";
import {
  brainSupabase,
  brainSupabaseAvailable,
  getBrainBySlug,
  getBrainDraft,
  getCurrentBrainVersion,
} from "@/lib/nex/brains/_supabase";
import { withBrainWrite } from "@/lib/nex/brains/_writer";
import { BRAIN_EVENT_TYPES } from "@/lib/nex/brains/_living_types";
import { extractActor } from "@/lib/nex/brains/_actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{1,63}$/;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!brainSupabaseAvailable()) return json503();
  const { slug } = await params;
  if (!SLUG_REGEX.test(slug)) return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });

  const sb = brainSupabase()!;
  const { data, error } = await sb
    .from("hammerex_nex_brain_drafts")
    .select("id, brain_slug, author_id, proposed_semver, status, submitted_at, reviewed_at, reviewed_by, review_notes, created_at, updated_at")
    .eq("brain_slug", slug)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, drafts: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!brainSupabaseAvailable()) return json503();
  const { slug } = await params;
  if (!SLUG_REGEX.test(slug)) return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });

  // F1 · Real authentication
  const actorResult = await extractActor(req);
  if (!actorResult.ok) return NextResponse.json({ ok: false, error: actorResult.error }, { status: actorResult.status });
  const actor = actorResult.actor;

  const brain = await getBrainBySlug(slug);
  if (!brain) return NextResponse.json({ ok: false, error: "brain_not_found" }, { status: 404 });

  // Idempotent: if this author already has a draft, return it.
  const existing = await getBrainDraft(slug, actor.actor_id);
  if (existing) return NextResponse.json({ ok: true, draft: existing, created: false });

  // Seed the draft from the current published version (if any).
  const baseVersion = await getCurrentBrainVersion(slug);
  const seededManifest = baseVersion?.manifest_json ?? { name: brain.display_name, version: "0.1.0" };
  const seededModules = baseVersion?.modules_json ?? {};

  const sb = brainSupabase()!;

  const draftId = await withBrainWrite<string>(
    {
      ...actor,
      brain_slug: slug,
      entity_type: "brain_draft",
      entity_id: slug,
    },
    async () => {
      const { data, error } = await sb
        .from("hammerex_nex_brain_drafts")
        .insert({
          brain_slug: slug,
          author_id: actor.actor_id,
          based_on_version_id: baseVersion?.id ?? null,
          proposed_semver: null,
          manifest_json: seededManifest,
          modules_json: seededModules,
          status: "editing",
          metadata: { seeded_from_version_semver: baseVersion?.version_semver ?? null },
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const id = (data as { id: string }).id;
      return {
        return_value: id,
        event: {
          event_type: BRAIN_EVENT_TYPES.DRAFT_SAVED,
          after_json: { draft_id: id, based_on: baseVersion?.version_semver ?? null },
          metadata: { seeded: true },
        },
      };
    }
  );

  // Return the full row we just created.
  const { data: created } = await sb.from("hammerex_nex_brain_drafts").select("*").eq("id", draftId).single();
  return NextResponse.json({ ok: true, draft: created, created: true }, { status: 201 });
}

function json503() {
  return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 503 });
}
