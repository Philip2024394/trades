// Contact 360° projector.
//
// Reads the CRM contact row + its saved activities, then joins outward
// into every other app's source rows for the same (merchant × party):
//   • AI Visualiser renders (via property_id + merchant_id)
//   • Quote Workspace quotes + events (via homeowner_party_id + merchant_id)
//   • Job Diary jobs (via merchant_id + homeowner_party_id)
//   • Reviews (via merchant_id + homeowner_party_id)
//
// Everything then sorted chronologically. The CRM never stores duplicates
// of source data — this is a projection at read time.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ContactTimelineItem = {
  kind:
    | "contact_created"
    | "render"
    | "quote_drafted"
    | "quote_sent"
    | "quote_viewed"
    | "quote_accepted"
    | "quote_rejected"
    | "job_opened"
    | "job_entry"
    | "job_signed_off"
    | "warranty_registered"
    | "review_posted"
    | "review_responded"
    | "note"
    | "whatsapp_sent"
    | "call"
    | "email_sent"
    | "manual";
  occurredAt: string;
  headline: string;
  body?: string | null;
  sourceApp?: string;
  sourceId?: string;
  meta?: Record<string, unknown>;
};

export type ContactSummary = {
  contact: {
    id: string;
    displayName: string;
    email: string | null;
    whatsappE164: string | null;
    postcode: string | null;
    lifecycleStage: string;
    source: string | null;
    tags: string[];
    ownerDisplayName: string | null;
    notes: string | null;
    lastActivityAt: string | null;
    lastTouchAt: string | null;
    nextFollowUpAt: string | null;
    quietSince: string | null;
    partyId: string | null;
    createdAt: string;
  };
  timeline: ContactTimelineItem[];
  openTasks: Array<{
    id: string;
    title: string;
    description: string | null;
    dueAt: string;
    channelHint: string | null;
    status: string;
  }>;
  totals: {
    renders: number;
    quotesSent: number;
    quotesAccepted: number;
    jobsSignedOff: number;
    reviewsPosted: number;
  };
};

export async function loadContactSummary(
  contactId: string,
  merchantId: string
): Promise<ContactSummary | null> {
  const { data: contact } = await supabaseAdmin
    .from("app_crm_contacts")
    .select("*")
    .eq("id", contactId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (!contact) return null;

  const partyId = contact.party_id as string | null;

  // Pull activities the CRM has stored (contact_created + manual notes +
  // event bridges we already logged). This is the CANONICAL log — the
  // outward joins below fill in gaps for apps that haven't logged yet.
  const activitiesPromise = supabaseAdmin
    .from("app_crm_activities")
    .select("*")
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false })
    .limit(200);

  const tasksPromise = supabaseAdmin
    .from("app_crm_tasks")
    .select("*")
    .eq("contact_id", contactId)
    .eq("status", "open")
    .order("due_at", { ascending: true });

  // App source pulls: quotes + jobs + reviews (party-scoped where possible)
  const quotesPromise = partyId
    ? supabaseAdmin
        .from("app_quote_workspace_quotes")
        .select(
          "id, title, status, total_pence, sent_at, first_viewed_at, accepted_at, rejected_at, created_at"
        )
        .eq("merchant_id", merchantId)
        .eq("homeowner_party_id", partyId)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [] });

  const jobsPromise = partyId
    ? supabaseAdmin
        .from("app_job_diary_jobs")
        .select(
          "id, title, status, actual_start_date, actual_end_date, created_at, updated_at"
        )
        .eq("merchant_id", merchantId)
        .eq("homeowner_party_id", partyId)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [] });

  const reviewsPromise = partyId
    ? supabaseAdmin
        .from("app_reviews_reviews")
        .select("id, rating, headline, created_at")
        .eq("merchant_id", merchantId)
        .eq("homeowner_party_id", partyId)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [] });

  const [activities, tasks, quotes, jobs, reviews] = await Promise.all([
    activitiesPromise,
    tasksPromise,
    quotesPromise,
    jobsPromise,
    reviewsPromise
  ]);

  const seenSourceIds = new Set<string>();
  const timeline: ContactTimelineItem[] = [];

  // Push CRM-native activities
  (activities.data || []).forEach((a) => {
    timeline.push({
      kind: a.kind as ContactTimelineItem["kind"],
      occurredAt: a.occurred_at as string,
      headline: a.headline as string,
      body: a.body as string | null,
      sourceApp: a.source_app || undefined,
      sourceId: a.source_id || undefined
    });
    if (a.source_id) seenSourceIds.add(`${a.source_app}:${a.source_id}`);
  });

  // Project quotes into timeline (only surface each source once)
  (quotes.data || []).forEach((q) => {
    const gbp = `£${(q.total_pence / 100).toFixed(0)}`;
    if (
      !seenSourceIds.has(`quote-workspace:${q.id}:drafted`) &&
      q.created_at
    ) {
      timeline.push({
        kind: "quote_drafted",
        occurredAt: q.created_at,
        headline: `Quote drafted · ${gbp}`,
        sourceApp: "quote-workspace",
        sourceId: q.id
      });
    }
    if (q.sent_at) {
      timeline.push({
        kind: "quote_sent",
        occurredAt: q.sent_at,
        headline: `Quote sent · ${gbp}`,
        sourceApp: "quote-workspace",
        sourceId: q.id
      });
    }
    if (q.first_viewed_at) {
      timeline.push({
        kind: "quote_viewed",
        occurredAt: q.first_viewed_at,
        headline: `Quote viewed by customer`,
        sourceApp: "quote-workspace",
        sourceId: q.id
      });
    }
    if (q.accepted_at) {
      timeline.push({
        kind: "quote_accepted",
        occurredAt: q.accepted_at,
        headline: `Quote accepted — ${q.title}`,
        sourceApp: "quote-workspace",
        sourceId: q.id
      });
    }
    if (q.rejected_at) {
      timeline.push({
        kind: "quote_rejected",
        occurredAt: q.rejected_at,
        headline: `Quote declined`,
        sourceApp: "quote-workspace",
        sourceId: q.id
      });
    }
  });

  // Project jobs
  (jobs.data || []).forEach((j) => {
    timeline.push({
      kind: "job_opened",
      occurredAt: j.created_at as string,
      headline: `Job opened: ${j.title}`,
      sourceApp: "job-diary",
      sourceId: j.id
    });
    if (j.actual_end_date && j.status === "signed_off") {
      timeline.push({
        kind: "job_signed_off",
        occurredAt: `${j.actual_end_date}T12:00:00Z`,
        headline: `${j.title} — signed off`,
        sourceApp: "job-diary",
        sourceId: j.id
      });
    }
  });

  // Project reviews
  (reviews.data || []).forEach((r) => {
    timeline.push({
      kind: "review_posted",
      occurredAt: r.created_at as string,
      headline: `${r.rating}★ review — ${r.headline}`,
      sourceApp: "reviews",
      sourceId: r.id
    });
  });

  // Sort desc
  timeline.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

  // Totals
  const totals = {
    renders: timeline.filter((t) => t.kind === "render").length,
    quotesSent: timeline.filter((t) => t.kind === "quote_sent").length,
    quotesAccepted: timeline.filter((t) => t.kind === "quote_accepted").length,
    jobsSignedOff: timeline.filter((t) => t.kind === "job_signed_off").length,
    reviewsPosted: timeline.filter((t) => t.kind === "review_posted").length
  };

  return {
    contact: {
      id: contact.id,
      displayName: contact.display_name,
      email: contact.email,
      whatsappE164: contact.whatsapp_e164,
      postcode: contact.postcode,
      lifecycleStage: contact.lifecycle_stage,
      source: contact.source,
      tags: contact.tags || [],
      ownerDisplayName: contact.owner_display_name,
      notes: contact.notes,
      lastActivityAt: contact.last_activity_at,
      lastTouchAt: contact.last_touch_at,
      nextFollowUpAt: contact.next_follow_up_at,
      quietSince: contact.quiet_since,
      partyId: contact.party_id,
      createdAt: contact.created_at
    },
    timeline,
    openTasks: (tasks.data || []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      dueAt: t.due_at,
      channelHint: t.channel_hint,
      status: t.status
    })),
    totals
  };
}

// Auto-draft a follow-up message based on last activity. Simple v1 —
// deterministic templates. A future v2 would call ai.summarise.
export function draftFollowUpMessage(input: {
  contactName: string;
  lastActivityKind: string;
  daysSince: number;
  merchantDisplayName: string;
  projectHint?: string | null;
}): string {
  const firstName = input.contactName.split(" ")[0] || "there";
  const merchant = input.merchantDisplayName;
  switch (input.lastActivityKind) {
    case "render":
      return `Hi ${firstName}, ${merchant} here — I saw you designed ${
        input.projectHint || "a room"
      } with our AI Visualiser ${input.daysSince} days back. Want me to price it up for you?`;
    case "quote_sent":
      return `Hi ${firstName}, just checking in on the quote we sent ${input.daysSince} days ago — any questions I can help with? Happy to adjust anything.`;
    case "quote_viewed":
      return `Hi ${firstName}, saw you had a look at the quote — anything not quite right? Free to jump on a quick call or WhatsApp if it helps.`;
    case "job_signed_off":
      return `Hi ${firstName}, been ${input.daysSince} days since we signed off — hope everything's still looking good? Anything you need, just shout.`;
    case "review_posted":
      return `Hi ${firstName}, thanks again for the review. If any friends or family are thinking about similar work, I'd really appreciate the referral.`;
    default:
      return `Hi ${firstName}, ${merchant} here — hadn't heard from you in a while, hope all's well? Anything I can help with?`;
  }
}
