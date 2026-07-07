// Reviews event subscriptions.
//
// Reviews app fires the review-request email when job.signed_off
// occurs. Historically this was an inline call from the sign-off route.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendReviewRequest } from "@/lib/reviews/sendReviewRequest";
import { register } from "../registry";

register({
  subscriberSlug: "reviews.on_job_signed_off",
  eventType: "job.signed_off",
  handler: async (event) => {
    const jobId = event.subjectId;
    const projectId = event.projectId;
    const propertyId = event.propertyId;
    const merchantId = event.actorBusinessId;
    if (!jobId || !projectId || !propertyId || !merchantId) {
      return { ok: false, error: "missing-context", retryable: false };
    }
    // The job row carries homeowner ids we need for the email.
    const { data: job } = await supabaseAdmin
      .from("app_job_diary_jobs")
      .select("homeowner_id, homeowner_party_id")
      .eq("id", jobId)
      .maybeSingle();
    await sendReviewRequest({
      jobId,
      projectId,
      propertyId,
      merchantId,
      homeownerId: job?.homeowner_id ?? null,
      homeownerPartyId: job?.homeowner_party_id ?? null
    });
    return { ok: true };
  }
});
