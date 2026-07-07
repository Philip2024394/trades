// POST /api/story-arcs/sweep-idle
//
// Closes story arcs that have been idle beyond their auto_close_after_days
// window. Intended to run on a cron (Vercel scheduled function or
// Supabase Edge Function). For MVP it's a manual endpoint.
//
// For each closed arc: composes a case study and emits a synthetic
// milestone_reached event so all downstream projections fire.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { composeCaseStudy } from "@/lib/story-arcs/caseStudyComposer";
import {
  loadArcEvents,
  markArcClosed
} from "@/lib/story-arcs/loader";
import type { StoryArc } from "@/lib/story-arcs/types";
import { emitEvent } from "@/lib/events/emit";

export const runtime = "nodejs";

type Body = { merchantId?: string; olderThanDays?: number };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "supabase_unavailable" },
      { status: 503 }
    );
  }
  const c = createClient(url, key, { auth: { persistSession: false } });
  const cutoffDays = body?.olderThanDays ?? 21;
  const cutoffIso = new Date(
    Date.now() - cutoffDays * 24 * 60 * 60 * 1000
  ).toISOString();

  let query = c
    .from("story_arcs")
    .select("*")
    .eq("status", "open")
    .lte("last_event_at", cutoffIso);
  if (body?.merchantId) query = query.eq("merchant_id", body.merchantId);
  const { data } = await query;
  const arcs = (data ?? []) as Array<{
    id: string;
    merchant_id: string;
    natural_key: string | null;
    arc_type: string;
    status: "open" | "closed" | "archived" | "expired";
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
  }>;

  const closed: Array<{ arcId: string; hadCaseStudy: boolean }> = [];
  for (const row of arcs) {
    const arc: StoryArc = {
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
    const events = await loadArcEvents(arc.id);
    if (events.length === 0) {
      await markArcClosed(arc.id);
      closed.push({ arcId: arc.id, hadCaseStudy: false });
      continue;
    }
    const caseStudy = await composeCaseStudy(arc, events.map((e) => e.eventId));
    await markArcClosed(arc.id);
    let hadCaseStudy = false;
    if (caseStudy) {
      await emitEvent({
        merchantId: arc.merchantId,
        eventType: "milestone_reached",
        payload: {
          milestone_kind: "case_study",
          trade: caseStudy.facets.trade,
          service: caseStudy.facets.service,
          materials: caseStudy.facets.materials,
          postcode: caseStudy.facets.postcode,
          photo_urls: caseStudy.photo_urls,
          consent_state: "granted",
          case_study: {
            arc_id: arc.id,
            headline: caseStudy.headline,
            intro: caseStudy.intro,
            middle: caseStudy.middle,
            outro: caseStudy.outro,
            channel_hints: caseStudy.channel_hints
          }
        },
        source: "arc_auto_close",
        idempotencyKey: `case-study-${arc.id}`
      });
      hadCaseStudy = true;
    }
    closed.push({ arcId: arc.id, hadCaseStudy });
  }

  return NextResponse.json({
    closed: closed.length,
    cutoffDays,
    arcs: closed
  });
}
