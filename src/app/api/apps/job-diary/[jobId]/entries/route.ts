// POST /api/apps/job-diary/[jobId]/entries
//
// Merchant adds an entry: check-in, photo (media_urls only for v1;
// upload endpoint below is a separate helper), note, milestone, snag,
// material_arrived, delay. Every entry fires a timeline event too.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { recordTimelineEvent, type TimelineVerb } from "@/lib/os/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set([
  "check_in",
  "photo",
  "note",
  "milestone",
  "snag",
  "material_arrived",
  "delay"
]);

const KIND_TO_VERB: Record<string, TimelineVerb> = {
  check_in: "job.checked_in",
  photo: "job.photo_added",
  milestone: "job.milestone_hit",
  snag: "job.snag_raised"
};

type Body = {
  kind?: unknown;
  headline?: unknown;
  body?: unknown;
  mediaUrls?: unknown;
  homeownerVisible?: unknown;
  locationLat?: unknown;
  locationLng?: unknown;
  authorDisplayName?: unknown;
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await ctx.params;
  const merchantId = await getMerchantIdFromRequest(null);
  if (!merchantId) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }
  const { data: job } = await supabaseAdmin
    .from("app_job_diary_jobs")
    .select("id, merchant_id, property_id, project_id, title, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.merchant_id !== merchantId) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  if (job.status === "signed_off" || job.status === "closed") {
    return NextResponse.json(
      { ok: false, error: "Job is closed." },
      { status: 409 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!KINDS.has(kind)) {
    return NextResponse.json(
      { ok: false, error: "Unknown entry kind." },
      { status: 400 }
    );
  }
  const headline =
    typeof body.headline === "string" ? body.headline.trim() : "";
  if (headline.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Headline is required." },
      { status: 400 }
    );
  }
  const bodyText = typeof body.body === "string" ? body.body : null;
  const mediaUrls = Array.isArray(body.mediaUrls)
    ? body.mediaUrls.filter((v): v is string => typeof v === "string")
    : [];
  const homeownerVisible = body.homeownerVisible === false ? false : true;
  const authorDisplayName =
    typeof body.authorDisplayName === "string"
      ? body.authorDisplayName
      : null;

  const { data: entry, error } = await supabaseAdmin
    .from("app_job_diary_entries")
    .insert({
      job_id: jobId,
      kind,
      headline,
      body: bodyText,
      media_urls: mediaUrls,
      author_business_listing_id: merchantId,
      author_display_name: authorDisplayName,
      homeowner_visible: homeownerVisible,
      location_lat:
        typeof body.locationLat === "number" ? body.locationLat : null,
      location_lng:
        typeof body.locationLng === "number" ? body.locationLng : null
    })
    .select("id")
    .single();
  if (error || !entry) {
    return NextResponse.json(
      { ok: false, error: "Could not add entry." },
      { status: 500 }
    );
  }

  // Auto-status transition: any entry on an 'open' job flips it to 'in_progress'
  if (job.status === "open") {
    await supabaseAdmin
      .from("app_job_diary_jobs")
      .update({
        status: "in_progress",
        actual_start_date: new Date().toISOString().slice(0, 10)
      })
      .eq("id", jobId);
  }

  // Timeline: only surface homeowner-visible entries + only for kinds
  // that map to a public verb
  const timelineVerb = KIND_TO_VERB[kind];
  if (timelineVerb && homeownerVisible) {
    await recordTimelineEvent({
      propertyId: job.property_id,
      projectId: job.project_id,
      actorBusinessListingId: merchantId,
      verb: timelineVerb,
      subjectType: "job_entry",
      subjectId: entry.id,
      headline,
      payload: {
        job_id: jobId,
        media_urls: mediaUrls.slice(0, 3)
      }
    });
  }

  return NextResponse.json({ ok: true, entryId: entry.id });
}
