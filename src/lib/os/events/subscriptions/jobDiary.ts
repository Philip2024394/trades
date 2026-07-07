// Job Diary event subscriptions.
//
// Job Diary auto-opens a job when quote.accepted fires. Before the
// Event Bus, this was an inline call from the quote/accept route into
// the Job Diary helper — a violation. Now it's a proper subscription.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { openJobFromAcceptedQuote } from "@/lib/job-diary/openJob";
import { register } from "../registry";

register({
  subscriberSlug: "job-diary.on_quote_accepted",
  eventType: "quote.accepted",
  handler: async (event) => {
    const quoteId = event.subjectId;
    const projectId = event.projectId;
    const propertyId = event.propertyId;
    const merchantId = event.actorBusinessId;
    const title =
      (event.payload.quote_title as string) ||
      (event.payload.title as string) ||
      "Job";
    if (!quoteId || !projectId || !propertyId || !merchantId) {
      return { ok: false, error: "missing-context", retryable: false };
    }
    // Look up homeowner ids from the quote so warranty registration
    // (later) can bind them. Non-fatal if missing.
    const { data: quote } = await supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("homeowner_id, homeowner_party_id")
      .eq("id", quoteId)
      .maybeSingle();
    await openJobFromAcceptedQuote({
      quoteId,
      projectId,
      propertyId,
      merchantId,
      homeownerId: quote?.homeowner_id ?? null,
      homeownerPartyId: quote?.homeowner_party_id ?? null,
      title
    });
    return { ok: true };
  }
});
