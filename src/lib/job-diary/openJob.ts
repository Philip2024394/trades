// Auto-opens a Job Diary job when quote.accepted fires. Called from
// the quote/[token]/accept route. Idempotent — repeated calls with the
// same quote return the existing job.
//
// This will become an event-bus subscription once the shared Event Bus
// primitive lands in core; until then it's an inline call.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordTimelineEvent } from "@/lib/os/timeline";

export type OpenJobInput = {
  quoteId: string;
  projectId: string;
  propertyId: string;
  merchantId: string;
  homeownerId?: string | null;
  homeownerPartyId?: string | null;
  title: string;
};

export type OpenJobResult = { jobId: string; created: boolean };

export async function openJobFromAcceptedQuote(
  input: OpenJobInput
): Promise<OpenJobResult> {
  const { data: existing } = await supabaseAdmin
    .from("app_job_diary_jobs")
    .select("id")
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (existing) return { jobId: existing.id, created: false };

  const { data: job, error } = await supabaseAdmin
    .from("app_job_diary_jobs")
    .insert({
      project_id: input.projectId,
      property_id: input.propertyId,
      merchant_id: input.merchantId,
      quote_id: input.quoteId,
      homeowner_id: input.homeownerId ?? null,
      homeowner_party_id: input.homeownerPartyId ?? null,
      title: input.title,
      status: "open" as const
    })
    .select("id")
    .single();
  if (error || !job) {
    throw new Error(`Failed to open job: ${error?.message}`);
  }

  // First diary entry — auto-generated milestone
  await supabaseAdmin.from("app_job_diary_entries").insert({
    job_id: job.id,
    kind: "milestone" as const,
    headline: "Job opened",
    body: "Your quote was accepted. We'll be in touch to schedule the survey and start date.",
    author_business_listing_id: input.merchantId
  });

  await recordTimelineEvent({
    propertyId: input.propertyId,
    projectId: input.projectId,
    actorBusinessListingId: input.merchantId,
    verb: "job.opened",
    subjectType: "job",
    subjectId: job.id,
    headline: `Job opened: ${input.title}`
  });

  return { jobId: job.id, created: true };
}
