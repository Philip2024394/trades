// /site-office/apps/job-diary/[jobId] — job detail: entries feed + add-entry
// composer + sign-off flow.

import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { JobDetail } from "./JobDetail";

export const dynamic = "force-dynamic";

export default async function JobDiaryDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const [{ jobId }, sp] = await Promise.all([params, searchParams]);
  const merchantId = await getMerchantIdFromRequest(sp.m || null);
  if (!merchantId) {
    redirect(`/site-office?next=/site-office/apps/job-diary/${jobId}`);
  }

  const { data: job } = await supabaseAdmin
    .from("app_job_diary_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.merchant_id !== merchantId) notFound();

  const [entriesRes, homeownerRes, signoffRes, quoteRes] = await Promise.all([
    supabaseAdmin
      .from("app_job_diary_entries")
      .select("*")
      .eq("job_id", jobId)
      .order("occurred_at", { ascending: false }),
    job.homeowner_id
      ? supabaseAdmin
          .from("app_ai_visualiser_homeowners")
          .select("full_name, whatsapp_e164, postcode")
          .eq("id", job.homeowner_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("app_job_diary_signoffs")
      .select("*")
      .eq("job_id", jobId)
      .maybeSingle(),
    job.quote_id
      ? supabaseAdmin
          .from("app_quote_workspace_quotes")
          .select("title, total_pence")
          .eq("id", job.quote_id)
          .maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <JobDetail
        job={{
          id: job.id,
          title: job.title,
          status: job.status,
          progress: job.progress_percent,
          actualStartDate: job.actual_start_date,
          actualEndDate: job.actual_end_date
        }}
        entries={(entriesRes.data || []).map((e) => ({
          id: e.id,
          kind: e.kind,
          headline: e.headline,
          body: e.body,
          mediaUrls: e.media_urls || [],
          occurredAt: e.occurred_at,
          homeownerVisible: e.homeowner_visible
        }))}
        homeowner={homeownerRes.data}
        signoff={signoffRes.data}
        quote={quoteRes.data}
      />
    </div>
  );
}
