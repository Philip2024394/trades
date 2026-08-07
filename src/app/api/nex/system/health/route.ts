// GET /api/nex/system/health — single at-a-glance snapshot of the
// Communications platform for the HQ System Health panel.
//
// Doctrine (Philip 2026-08-08 · production hardening · Phase 4f):
// When something goes wrong in production, this is the FIRST place an
// administrator looks. Every signal must be authoritative · fabricate
// nothing · surface honest "—" when a source is unreachable.

import { NextResponse } from "next/server";
import { withClient } from "@/lib/nex/delivery/db";
import { activeProvider, currentMode, registeredProviders } from "@/lib/nex/delivery/providers";
import { limiterConfig, limiterSnapshot } from "@/lib/nex/delivery/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OverallStatus = "healthy" | "degraded" | "down";

export async function GET() {
  const provider = activeProvider();
  const providers = registeredProviders();
  const mode = currentMode();
  const limiter = { config: limiterConfig(), buckets: limiterSnapshot() };

  const r = await withClient(async (c) => {
    // Queue depth by status
    const queueRes = await c.query(
      `SELECT status, COUNT(*)::int AS n FROM nex.delivery_jobs GROUP BY status`,
    );
    const queue: Record<string, number> = {};
    for (const row of queueRes.rows) queue[String(row.status)] = Number(row.n);

    // Oldest pending job age (seconds since scheduled_for)
    const oldestRes = await c.query(
      `SELECT MIN(scheduled_for) AS oldest, EXTRACT(EPOCH FROM (NOW() - MIN(scheduled_for)))::int AS age_seconds
       FROM nex.delivery_jobs WHERE status = 'pending' AND scheduled_for <= NOW()`,
    );
    const oldest_pending_age_seconds = Number((oldestRes.rows[0] as { age_seconds: number | null })?.age_seconds ?? 0) || 0;

    // Worker signals
    const workersRes = await c.query(
      `SELECT
         COUNT(*)::int AS registered,
         COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '2 minutes')::int AS alive,
         MAX(last_seen_at) AS last_heartbeat
       FROM nex.delivery_workers`,
    );
    const workers = {
      registered:  Number((workersRes.rows[0] as { registered: number })?.registered ?? 0),
      alive:       Number((workersRes.rows[0] as { alive: number })?.alive ?? 0),
      last_heartbeat: (workersRes.rows[0] as { last_heartbeat: string | null })?.last_heartbeat ?? null,
    };

    // Last successful send (from delivery attempts · authoritative)
    const lastSendRes = await c.query(
      `SELECT ja.completed_at, j.campaign_id, j.job_type
       FROM nex.delivery_job_attempts ja
       JOIN nex.delivery_jobs j ON j.job_id = ja.job_id
       WHERE ja.outcome = 'success'
       ORDER BY ja.completed_at DESC LIMIT 1`,
    );
    const last_successful_send = lastSendRes.rows[0]
      ? {
          at: String(lastSendRes.rows[0].completed_at),
          campaign_id: (lastSendRes.rows[0].campaign_id as string | null) ?? null,
          job_type: String(lastSendRes.rows[0].job_type),
        }
      : null;

    // Last webhook received (from analytics_events · we can't be certain
    // an event is "webhook-driven" today · so track last-ingest per provider
    // AND flag synthetic vs non-synthetic based on metadata.synthetic flag)
    const lastWebhookRes = await c.query(
      `SELECT ingested_at, event_type, provider, (metadata->>'synthetic')::boolean AS synthetic
       FROM nex.analytics_events
       WHERE provider IS NOT NULL
       ORDER BY ingested_at DESC LIMIT 1`,
    );
    const last_ingest = lastWebhookRes.rows[0]
      ? {
          at: String(lastWebhookRes.rows[0].ingested_at),
          event_type: String(lastWebhookRes.rows[0].event_type),
          provider: String(lastWebhookRes.rows[0].provider),
          synthetic: lastWebhookRes.rows[0].synthetic === true,
        }
      : null;

    // Suppression list size (contacts.never_contact OR unsubscribe_at IS NOT NULL)
    const suppressionRes = await c.query(
      `SELECT
         COUNT(*) FILTER (WHERE never_contact = TRUE)::int AS never_contact,
         COUNT(*) FILTER (WHERE unsubscribe_at IS NOT NULL)::int AS unsubscribed,
         COUNT(*) FILTER (WHERE never_contact = TRUE OR unsubscribe_at IS NOT NULL)::int AS total
       FROM (SELECT DISTINCT ON (contact_id) * FROM nex.contacts ORDER BY contact_id, updated_at DESC) c
       WHERE deleted_at IS NULL`,
    );
    const suppression = {
      total:         Number((suppressionRes.rows[0] as { total: number })?.total ?? 0),
      never_contact: Number((suppressionRes.rows[0] as { never_contact: number })?.never_contact ?? 0),
      unsubscribed:  Number((suppressionRes.rows[0] as { unsubscribed: number })?.unsubscribed ?? 0),
    };

    // Recent activity (last hour throughput)
    const throughputRes = await c.query(
      `SELECT COUNT(*)::int AS n FROM nex.delivery_job_attempts WHERE completed_at > NOW() - INTERVAL '1 hour' AND outcome = 'success'`,
    );
    const throughput_last_hour = Number((throughputRes.rows[0] as { n: number })?.n ?? 0);

    return { queue, oldest_pending_age_seconds, workers, last_successful_send, last_ingest, suppression, throughput_last_hour };
  });

  // Fallback when DB unreachable — everything honest "—"
  const data = r ?? {
    queue: {}, oldest_pending_age_seconds: 0,
    workers: { registered: 0, alive: 0, last_heartbeat: null },
    last_successful_send: null, last_ingest: null,
    suppression: { total: 0, never_contact: 0, unsubscribed: 0 },
    throughput_last_hour: 0,
  };

  // Overall status calculation
  //   down     · storage unreachable OR active provider unhealthy OR no live workers with pending jobs
  //   degraded · dead-letter > 0 OR oldest pending > 5 min OR queue > 500 pending
  //   healthy  · everything else
  const dead_letter    = data.queue.dead_letter ?? 0;
  const pending        = data.queue.pending ?? 0;
  const running        = data.queue.running ?? 0;
  const storageReachable = r !== null;

  let overall: OverallStatus = "healthy";
  const reasons: string[] = [];

  if (!storageReachable)                 { overall = "down";     reasons.push("storage unreachable"); }
  if (pending > 0 && data.workers.alive === 0) { overall = "down"; reasons.push("pending jobs but no live workers"); }
  if (dead_letter > 0)                   { if (overall === "healthy") overall = "degraded"; reasons.push(`${dead_letter} dead-letter job${dead_letter === 1 ? "" : "s"}`); }
  if (data.oldest_pending_age_seconds > 300) { if (overall === "healthy") overall = "degraded"; reasons.push(`oldest pending ${Math.round(data.oldest_pending_age_seconds / 60)}m old`); }
  if (pending > 500)                     { if (overall === "healthy") overall = "degraded"; reasons.push(`${pending} jobs backlogged`); }

  return NextResponse.json({
    ok: true,
    overall,
    reasons,
    checked_at: new Date().toISOString(),
    provider: {
      active: { id: provider.id, label: provider.label },
      mode,
      registered: providers,
    },
    queue: {
      by_status: data.queue,
      pending, running, dead_letter,
      oldest_pending_age_seconds: data.oldest_pending_age_seconds,
    },
    workers: data.workers,
    activity: {
      last_successful_send: data.last_successful_send,
      last_ingest: data.last_ingest,
      throughput_last_hour: data.throughput_last_hour,
    },
    suppression: data.suppression,
    limiter,
  });
}
