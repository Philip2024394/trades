// Story arc loader.

import { createClient } from "@supabase/supabase-js";
import type { StoryArc, StoryArcEventRole, StoryArcStatus } from "./types";

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type Row = {
  id: string;
  merchant_id: string;
  natural_key: string | null;
  arc_type: string;
  status: StoryArcStatus;
  narrative: Record<string, unknown>;
  facets: Record<string, unknown>;
  starts_at: string;
  last_event_at: string;
  closed_at: string | null;
  auto_close_after_days: number;
  case_study_publication_ids: string[];
  case_study_feed_post_id: string | null;
  created_at: string;
  updated_at: string;
};

function rowToArc(row: Row): StoryArc {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    naturalKey: row.natural_key,
    arcType: row.arc_type as StoryArc["arcType"],
    status: row.status,
    narrative: row.narrative ?? {},
    facets: row.facets ?? {},
    startsAt: row.starts_at,
    lastEventAt: row.last_event_at,
    closedAt: row.closed_at,
    autoCloseAfterDays: row.auto_close_after_days,
    caseStudyPublicationIds: row.case_study_publication_ids ?? [],
    caseStudyFeedPostId: row.case_study_feed_post_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function findArcByNaturalKey(
  merchantId: string,
  naturalKey: string
): Promise<StoryArc | null> {
  const c = client();
  if (!c) return null;
  const { data } = await c
    .from("story_arcs")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("natural_key", naturalKey)
    .maybeSingle();
  if (!data) return null;
  return rowToArc(data as Row);
}

export async function findOpenArcForContext(input: {
  merchantId: string;
  trade?: string;
  postcode?: string;
  withinDays?: number;
}): Promise<StoryArc | null> {
  const c = client();
  if (!c) return null;
  if (!input.trade || !input.postcode) return null;
  const sinceIso = new Date(
    Date.now() - (input.withinDays ?? 21) * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data } = await c
    .from("story_arcs")
    .select("*")
    .eq("merchant_id", input.merchantId)
    .eq("status", "open")
    .gte("last_event_at", sinceIso)
    .contains("facets", { trade: input.trade, postcode: input.postcode.toUpperCase() })
    .order("last_event_at", { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return null;
  return rowToArc(data[0] as Row);
}

export async function createArc(input: {
  merchantId: string;
  naturalKey?: string;
  arcType?: StoryArc["arcType"];
  facets?: Record<string, unknown>;
}): Promise<StoryArc | null> {
  const c = client();
  if (!c) return null;
  const { data, error } = await c
    .from("story_arcs")
    .insert({
      merchant_id: input.merchantId,
      natural_key: input.naturalKey ?? null,
      arc_type: input.arcType ?? "project_progress",
      facets: input.facets ?? {},
      status: "open"
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return rowToArc(data as Row);
}

export async function attachEventToArc(
  arcId: string,
  eventId: string,
  role: StoryArcEventRole,
  eventOccurredAt: string,
  mergedFacets: Record<string, unknown>
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  // Attach (idempotent via PK).
  const { error: attachErr } = await c
    .from("story_arc_events")
    .upsert(
      { arc_id: arcId, event_id: eventId, role },
      { onConflict: "arc_id,event_id" }
    );
  if (attachErr) return false;
  // Update arc facets + last_event_at.
  const { error: updErr } = await c
    .from("story_arcs")
    .update({
      last_event_at: eventOccurredAt,
      facets: mergedFacets
    })
    .eq("id", arcId);
  return !updErr;
}

export async function loadArcEvents(arcId: string): Promise<
  Array<{ eventId: string; role: string; addedAt: string }>
> {
  const c = client();
  if (!c) return [];
  const { data } = await c
    .from("story_arc_events")
    .select("event_id, role, added_at")
    .eq("arc_id", arcId)
    .order("added_at", { ascending: true });
  return (data ?? []).map((r) => {
    const row = r as { event_id: string; role: string; added_at: string };
    return {
      eventId: row.event_id,
      role: row.role,
      addedAt: row.added_at
    };
  });
}

export async function markArcClosed(
  arcId: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c
    .from("story_arcs")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", arcId);
  return !error;
}

export async function loadArcById(arcId: string): Promise<StoryArc | null> {
  const c = client();
  if (!c) return null;
  const { data } = await c
    .from("story_arcs")
    .select("*")
    .eq("id", arcId)
    .maybeSingle();
  if (!data) return null;
  return rowToArc(data as Row);
}

export async function loadRecentArcs(
  merchantId: string,
  status?: StoryArcStatus,
  limit = 20
): Promise<StoryArc[]> {
  const c = client();
  if (!c) return [];
  let q = c
    .from("story_arcs")
    .select("*")
    .eq("merchant_id", merchantId);
  if (status) q = q.eq("status", status);
  const { data } = await q.order("last_event_at", { ascending: false }).limit(limit);
  return (data ?? []).map((r) => rowToArc(r as Row));
}
