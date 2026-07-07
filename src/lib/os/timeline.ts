// OS Foundation — Home Timeline event recorder.
//
// Every module that does something meaningful on a property writes a
// timeline event through this helper. The timeline is immutable and
// additive — never updated, never deleted (except via a full-purge
// GDPR delete).
//
// Idempotency: passing the same (verb, subjectId) pair will be caught
// by the unique index and returns the existing row instead of erroring.
// This lets writers be careless about retries.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type TimelineVerb =
  // Property lifecycle
  | "property.created"
  | "property.claimed"
  | "property.verified"
  | "property.transferred"
  // Project lifecycle
  | "project.opened"
  | "project.specced"
  | "project.quoted"
  | "project.accepted"
  | "project.installed"
  | "project.signed_off"
  | "project.closed"
  // Render
  | "render.completed"
  // Quote / order / warranty
  | "quote.drafted"
  | "quote.sent"
  | "quote.viewed"
  | "quote.accepted"
  | "quote.rejected"
  | "quote.expired"
  | "order.placed"
  | "order.delivered"
  | "warranty.registered"
  | "warranty.claimed"
  | "warranty.expired"
  // Job Diary
  | "job.opened"
  | "job.checked_in"
  | "job.photo_added"
  | "job.milestone_hit"
  | "job.snag_raised"
  // Documents + reviews
  | "document.added"
  | "review.posted"
  | "review.requested";

export type TimelineSubjectType =
  | "property"
  | "project"
  | "specification"
  | "render"
  | "quote"
  | "order"
  | "warranty"
  | "document"
  | "review"
  | "job"
  | "job_entry";

export type TimelineEventInput = {
  propertyId: string;
  actorPartyId?: string | null;
  actorBusinessListingId?: string | null;
  projectId?: string | null;
  verb: TimelineVerb;
  subjectType: TimelineSubjectType;
  subjectId?: string | null;
  headline: string;
  payload?: Record<string, unknown>;
  occurredAt?: string; // ISO
};

export type TimelineEventRecord = {
  id: string;
  property_id: string;
  project_id: string | null;
  actor_party_id: string | null;
  actor_business_listing_id: string | null;
  verb: string;
  subject_type: string;
  subject_id: string | null;
  headline: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
};

export async function recordTimelineEvent(
  input: TimelineEventInput
): Promise<TimelineEventRecord | null> {
  const row = {
    property_id: input.propertyId,
    project_id: input.projectId ?? null,
    actor_party_id: input.actorPartyId ?? null,
    actor_business_listing_id: input.actorBusinessListingId ?? null,
    verb: input.verb,
    subject_type: input.subjectType,
    subject_id: input.subjectId ?? null,
    headline: input.headline,
    payload: input.payload ?? {},
    occurred_at: input.occurredAt ?? new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from("os_home_timeline_events")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    // Idempotency: if the unique (verb, subject_id) constraint fires,
    // return the existing row instead of throwing.
    if (
      error.code === "23505" && // unique_violation
      input.subjectId
    ) {
      const { data: existing } = await supabaseAdmin
        .from("os_home_timeline_events")
        .select("*")
        .eq("verb", input.verb)
        .eq("subject_id", input.subjectId)
        .maybeSingle();
      return (existing as TimelineEventRecord) ?? null;
    }
    console.error("[os.timeline] failed to record event", error);
    return null;
  }
  return data as TimelineEventRecord;
}

export async function loadTimeline(
  propertyId: string,
  opts: { limit?: number } = {}
): Promise<TimelineEventRecord[]> {
  const { data } = await supabaseAdmin
    .from("os_home_timeline_events")
    .select("*")
    .eq("property_id", propertyId)
    .order("occurred_at", { ascending: false })
    .limit(opts.limit ?? 200);
  return (data as TimelineEventRecord[]) || [];
}
