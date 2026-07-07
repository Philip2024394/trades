// POST /api/apps/job-diary/[jobId]/signoff
//
// The single biggest state transition in the OS. In one call:
//   1. Insert an app_job_diary_signoffs row
//   2. Flip job.status → signed_off + set actual_end_date
//   3. Flip project.status → signed_off (via os helper)
//   4. Register warranties against every material line on the accepted quote
//   5. Fire the review-request email (Reviews app #004)
//   6. Fire a job.milestone_hit + project.signed_off timeline event chain

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { recordTimelineEvent } from "@/lib/os/timeline";
import { updateProjectStatus } from "@/lib/os/projects";
import { registerWarrantiesForJob } from "@/lib/job-diary/registerWarranties";
import { publish } from "@/lib/os/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  customerSignatureName?: unknown;
  merchantSignatureName?: unknown;
  photos?: unknown;
  notes?: unknown;
  warrantyYears?: unknown;
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
    .select(
      "id, project_id, property_id, merchant_id, quote_id, homeowner_id, homeowner_party_id, title, status"
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.merchant_id !== merchantId) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  if (job.status === "signed_off") {
    return NextResponse.json({ ok: true, alreadySignedOff: true });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const customerSignatureName =
    typeof body.customerSignatureName === "string"
      ? body.customerSignatureName.trim()
      : null;
  const merchantSignatureName =
    typeof body.merchantSignatureName === "string"
      ? body.merchantSignatureName.trim()
      : null;
  const photos = Array.isArray(body.photos)
    ? body.photos.filter((v): v is string => typeof v === "string")
    : [];
  const notes = typeof body.notes === "string" ? body.notes : null;
  const warrantyYears =
    typeof body.warrantyYears === "number" ? body.warrantyYears : undefined;

  const now = new Date();
  const nowIso = now.toISOString();
  const todayIso = now.toISOString().slice(0, 10);

  // 1. Sign-off record
  const { data: signoff } = await supabaseAdmin
    .from("app_job_diary_signoffs")
    .insert({
      job_id: jobId,
      merchant_id: merchantId,
      homeowner_party_id: job.homeowner_party_id,
      customer_signature_name: customerSignatureName,
      customer_signature_captured_at: customerSignatureName ? nowIso : null,
      merchant_signature_name: merchantSignatureName,
      merchant_signature_captured_at: merchantSignatureName ? nowIso : null,
      photos,
      notes
    })
    .select("id")
    .single();

  // 2. Job status
  await supabaseAdmin
    .from("app_job_diary_jobs")
    .update({
      status: "signed_off",
      progress_percent: 100,
      actual_end_date: todayIso
    })
    .eq("id", jobId);

  // 4. Warranties
  const warranties = await registerWarrantiesForJob({
    jobId,
    quoteId: job.quote_id,
    propertyId: job.property_id,
    projectId: job.project_id,
    merchantId,
    ownerPartyId: job.homeowner_party_id,
    defaultYears: warrantyYears
  });

  // Update signoff row with count
  if (signoff && warranties.registeredCount > 0) {
    await supabaseAdmin
      .from("app_job_diary_signoffs")
      .update({ warranties_registered_count: warranties.registeredCount })
      .eq("id", signoff.id);
  }

  // 3. Project → signed_off (this also records project.signed_off on the timeline)
  await updateProjectStatus({
    projectId: job.project_id,
    status: "signed_off",
    actorBusinessListingId: merchantId
  });

  // 5. Publish job.signed_off — Reviews + CRM subscribers do the rest.
  await recordTimelineEvent({
    propertyId: job.property_id,
    projectId: job.project_id,
    actorBusinessListingId: merchantId,
    verb: "job.milestone_hit",
    subjectType: "job",
    subjectId: jobId,
    headline: `${job.title} — signed off`,
    payload: {
      photos_count: photos.length,
      warranties_registered: warranties.registeredCount
    }
  });

  await supabaseAdmin
    .from("app_job_diary_signoffs")
    .update({ review_requested_at: nowIso })
    .eq("job_id", jobId);

  await publish({
    eventType: "job.signed_off",
    publisherApp: "job-diary",
    dedupKey: `signoff:${jobId}`,
    actorBusinessId: merchantId,
    actorPartyId: job.homeowner_party_id,
    propertyId: job.property_id,
    projectId: job.project_id,
    subjectType: "job",
    subjectId: jobId,
    payload: {
      title: job.title,
      photos_count: photos.length,
      warranties_registered: warranties.registeredCount
    }
  });

  return NextResponse.json({
    ok: true,
    warrantiesRegistered: warranties.registeredCount
  });
}
