// Cron · every minute — drain pending + failed event deliveries.
//
// Reads os_event_deliveries where status IN ('pending','failed') AND
// next_attempt_at <= now(). For each row: rehydrates the event from
// os_event_log, calls attemptDelivery() which handles success + retry
// + dead-letter transitions.
//
// Bounded per-run (200 deliveries max) so a spike doesn't overrun the
// cron window. Vercel cron schedule: */1 * * * * (every minute).

import { NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron/authorise";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { attemptDelivery } from "@/lib/os/events";
import type { PublishedEvent, OsEventType } from "@/lib/os/events/types";

export const runtime = "nodejs";

const BATCH_SIZE = 200;

export async function GET(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { data: due, error: dueErr } = await supabaseAdmin
    .from("os_event_deliveries")
    .select(
      "id, event_id, subscriber_slug, os_event_log!inner(id, event_type, event_version, publisher_app, actor_party_id, actor_business_id, property_id, project_id, subject_type, subject_id, payload, occurred_at)"
    )
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (dueErr) {
    return NextResponse.json(
      { ok: false, error: dueErr.message },
      { status: 500 }
    );
  }

  let delivered = 0;
  let failed = 0;

  for (const row of due || []) {
    const eventJoin = (
      row as unknown as {
        os_event_log?:
          | Record<string, unknown>
          | Record<string, unknown>[];
      }
    ).os_event_log;
    const eventRow = Array.isArray(eventJoin) ? eventJoin[0] : eventJoin;
    if (!eventRow) continue;
    const event: PublishedEvent = {
      id: eventRow.id as string,
      eventType: eventRow.event_type as OsEventType,
      eventVersion: (eventRow.event_version as number) ?? 1,
      publisherApp: eventRow.publisher_app as string,
      actorPartyId: (eventRow.actor_party_id as string) ?? null,
      actorBusinessId: (eventRow.actor_business_id as string) ?? null,
      propertyId: (eventRow.property_id as string) ?? null,
      projectId: (eventRow.project_id as string) ?? null,
      subjectType: (eventRow.subject_type as string) ?? null,
      subjectId: (eventRow.subject_id as string) ?? null,
      payload: (eventRow.payload as Record<string, unknown>) ?? {},
      occurredAt: eventRow.occurred_at as string
    };
    const result = await attemptDelivery({
      deliveryId: row.id as string,
      subscriberSlug: row.subscriber_slug as string,
      event
    });
    if (result.ok) delivered += 1;
    else failed += 1;
  }

  return NextResponse.json({
    ok: true,
    scanned: due?.length ?? 0,
    delivered,
    failed
  });
}
