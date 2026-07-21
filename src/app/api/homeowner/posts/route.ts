// POST /api/homeowner/posts — homeowner creates a new SiteBook post
//
// Body: {
//   projectId: string
//   title?: string
//   body: string (required)
//   kind?: 'update' | 'new-work' | 'question' | 'warranty' | 'completion'
//   visibility?: 'selected' | 'all-trades'
//   invitedListingIds?: string[]  // required when visibility='selected'
//   coverPhotoUrl?: string
// }

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { createPost } from "@/lib/homeowners/posts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PostKind, PostVisibility } from "@/lib/homeowners/types";
import { trackLiquidity } from "@/lib/analytics/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    projectId?: string;
    title?: string;
    body?: string;
    kind?: PostKind;
    visibility?: PostVisibility;
    invitedListingIds?: string[];
    coverPhotoUrl?: string;
  } | null;
  if (!body?.projectId) return NextResponse.json({ ok: false, error: "missing-project" }, { status: 400 });
  if (!body.body?.trim()) return NextResponse.json({ ok: false, error: "empty-body" },   { status: 400 });

  const res = await createPost({
    homeownerId:       homeowner.id,
    homeownerName:     homeowner.first_name || "Homeowner",
    projectId:         body.projectId,
    title:             body.title,
    body:              body.body,
    kind:              body.kind,
    visibility:        body.visibility,
    invitedListingIds: body.invitedListingIds,
    coverPhotoUrl:     body.coverPhotoUrl
  });

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });

  // Liquidity Engine · demand_created
  // Enrich with city for Coverage Map + city-slice dashboards.
  const projRes = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("address_city")
    .eq("id", body.projectId)
    .maybeSingle();
  const city = (projRes.data as { address_city: string | null } | null)?.address_city ?? homeowner.city ?? null;
  void trackLiquidity({
    slug:           "sitebook.post_created",
    product:        "sitebook",
    lifecycleStage: "demand_created",
    actorKind:      "homeowner",
    actorId:        homeowner.id,
    actorDisplay:   homeowner.first_name || "Homeowner",
    targetKind:     "sitebook_post",
    targetId:       res.post.id,
    city,
    metadata:       { visibility: body.visibility ?? "all-trades", kind: body.kind ?? "update" }
  });

  return NextResponse.json({ ok: true, postId: res.post.id });
}
