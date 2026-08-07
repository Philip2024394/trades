// NEX Delivery Engine · worker pipeline
//
// tick() =
//   1. heartbeat this worker
//   2. lease the next job (SKIP LOCKED)
//   3. dispatch by job_type:
//        campaign.expand     → build recipient snapshot, enqueue send batches
//        campaign.send_batch → send N recipients via active provider adapter
//        campaign.finalise   → check if all recipients done, transition campaign
//   4. record attempt + complete/fail with backoff
//
// The single entry point is `tick()` — call it from a cron, a Node
// interval, or the manual /api/nex/delivery/tick endpoint. This
// architecture is single-worker friendly today but multi-worker safe
// (SKIP LOCKED + lease TTL) from day one.

import os from "os";
import { withClient } from "./db";
import { emitDeliveryEvent } from "./audit";
import { activeProvider, currentMode } from "./providers";
import { backoffFor } from "./retry";
import { tryAcquireSendSlot } from "./limiter";
import { claimNextRecipients, expandCampaign, recordRecipientSend } from "./expansion";
import { completeJob, enqueueJob, failJob, leaseNextJob, recordAttempt } from "./queue";
import { getCampaign, transitionCampaignStatus } from "@/lib/nex/campaigns/registry";
import { interpolate } from "@/lib/nex/composer/variables";
import { ingestEvent } from "@/lib/nex/analytics/ingest";
import { simulateEngagementFor } from "@/lib/nex/analytics/simulator";

const WORKER_ID = `${os.hostname().slice(0, 30)}-${process.pid}`;
const BATCH_SIZE = 25;
const SEND_BATCH_ATTEMPTS = 3;

// ── worker heartbeat ──────────────────────────────────────────────
async function heartbeat(): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO nex.delivery_workers (worker_id, hostname, mode, last_seen_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (worker_id) DO UPDATE SET last_seen_at = NOW(), mode = EXCLUDED.mode`,
      [WORKER_ID, os.hostname(), currentMode()],
    );
    return null;
  });
}

async function bumpProcessed(failed: boolean): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      failed
        ? `UPDATE nex.delivery_workers SET jobs_failed = jobs_failed + 1, last_seen_at = NOW() WHERE worker_id = $1`
        : `UPDATE nex.delivery_workers SET jobs_processed = jobs_processed + 1, last_seen_at = NOW() WHERE worker_id = $1`,
      [WORKER_ID],
    );
    return null;
  });
}

// ── the tick ──────────────────────────────────────────────────────
export type TickResult =
  | { picked: false; reason: string }
  | { picked: true; job_id: string; job_type: string; outcome: "success" | "transient_failure" | "permanent_failure"; detail?: Record<string, unknown> };

export async function tick(): Promise<TickResult> {
  await heartbeat();
  const job = await leaseNextJob(WORKER_ID);
  if (!job) return { picked: false, reason: "no runnable job" };

  const t0 = Date.now();
  try {
    let detail: Record<string, unknown> = {};
    if (job.job_type === "campaign.expand") {
      detail = await runExpand(job.campaign_id!);
    } else if (job.job_type === "campaign.send_batch") {
      detail = await runSendBatch(job.campaign_id!, job.payload);
    } else if (job.job_type === "campaign.finalise") {
      detail = await runFinalise(job.campaign_id!);
    }

    const latency = Date.now() - t0;
    await completeJob(job.job_id, detail);
    await recordAttempt({ job_id: job.job_id, attempt_no: job.attempts, worker_id: WORKER_ID, outcome: "success", latency_ms: latency, detail });
    await bumpProcessed(false);
    return { picked: true, job_id: job.job_id, job_type: job.job_type, outcome: "success", detail };
  } catch (err) {
    const latency = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    const permanent = /permanent/i.test(msg);
    await failJob(job.job_id, msg, { permanent, backoffMs: backoffFor(job.attempts) });
    await recordAttempt({ job_id: job.job_id, attempt_no: job.attempts, worker_id: WORKER_ID, outcome: permanent ? "permanent_failure" : "transient_failure", latency_ms: latency, error: msg });
    await bumpProcessed(true);
    if (job.attempts >= job.max_attempts) await emitDeliveryEvent("delivery.job_dead_letter", { job_id: job.job_id, job_type: job.job_type, error: msg }, job.campaign_id ?? undefined);
    return { picked: true, job_id: job.job_id, job_type: job.job_type, outcome: permanent ? "permanent_failure" : "transient_failure", detail: { error: msg } };
  }
}

/** Run tick() until no runnable job or maxTicks reached · returns a summary. */
export async function tickBatch(maxTicks = 10): Promise<Array<TickResult>> {
  const results: TickResult[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const r = await tick();
    results.push(r);
    if (!r.picked) break;
  }
  return results;
}

// ── job handlers ──────────────────────────────────────────────────
async function runExpand(campaign_id: string): Promise<Record<string, unknown>> {
  await emitDeliveryEvent("delivery.queue_built", { stage: "expand.start" }, campaign_id);
  const result = await expandCampaign(campaign_id);
  if (!result) throw new Error("campaign not found (permanent)");

  // Move campaign into 'sending' state if we have any pending recipients,
  // otherwise straight to completed (nothing to send · all suppressed).
  const campaign = await getCampaign(campaign_id);
  if (!campaign) throw new Error("campaign vanished mid-expand (permanent)");

  const pending = result.inserted - result.suppressed - result.skipped_window;
  if (campaign.status === "scheduled") {
    // Always walk into 'sending' — even for zero-recipient campaigns —
    // so the finalise handler can transition to 'completed' cleanly.
    await transitionCampaignStatus(campaign_id, "sending");
  }
  if (pending > 0) {
    await enqueueJob({ job_type: "campaign.send_batch", campaign_id, priority: 90 });
  } else {
    // Nothing to send · finalise straight away.
    await enqueueJob({ job_type: "campaign.finalise", campaign_id, priority: 90 });
  }

  await emitDeliveryEvent("delivery.queue_built", { stage: "expand.done", ...result }, campaign_id);
  return { ...result };
}

async function runSendBatch(campaign_id: string, _payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const campaign = await getCampaign(campaign_id);
  if (!campaign) throw new Error("campaign not found (permanent)");
  if (campaign.status !== "sending") return { skipped: true, campaign_status: campaign.status };

  const provider = activeProvider();
  const recipients = await claimNextRecipients(campaign_id, BATCH_SIZE);

  await emitDeliveryEvent("delivery.batch_started", { count: recipients.length, provider: provider.id }, campaign_id);

  if (recipients.length === 0) {
    // Nothing pending right now — schedule a finalise to check whether
    // everything is done or whether skipped_window rows will come due.
    await enqueueJob({ job_type: "campaign.finalise", campaign_id, priority: 90, scheduled_for: new Date(Date.now() + 30_000).toISOString() });
    return { sent: 0, failed: 0, batch_empty: true };
  }

  let sent = 0, failed = 0;
  for (const r of recipients as Array<{ contact_id: string; email: string; variables: Record<string, string> }>) {
    // Rate-limit acquisition · if scope refuses, requeue immediate follow-up
    const slot = tryAcquireSendSlot(provider.id, r.email);
    if (!slot.ok) {
      await enqueueJob({
        job_type: "campaign.send_batch", campaign_id, priority: 90,
        scheduled_for: new Date(Date.now() + Math.max(200, slot.retry_after_ms)).toISOString(),
        payload: { rate_limit_scope: slot.scope, retry_after_ms: slot.retry_after_ms },
      });
      return { sent, failed, requeued_for_rate_limit: slot.scope, retry_after_ms: slot.retry_after_ms };
    }

    const variables = { ...r.variables, unsubscribe_link: buildUnsubscribeUrl(campaign_id, r.contact_id) };
    const html = interpolate(campaign.body_html ?? "", variables, { resolveUnsubscribe: true });
    const text = interpolate(campaign.body_text ?? "", variables, { resolveUnsubscribe: true });
    const subject = interpolate(campaign.subject ?? "", variables);

    try {
      const res = await provider.send({
        from:     campaign.sender_from ?? "no-reply@example.com",
        reply_to: campaign.sender_reply_to ?? undefined,
        to:       r.email,
        subject,
        html,
        text,
        campaign_id,
        recipient_contact_id: r.contact_id,
      });
      if (res.ok) {
        sent++;
        await recordRecipientSend({ campaign_id, contact_id: r.contact_id, ok: true, provider: provider.id, provider_message_id: res.provider_message_id, latency_ms: res.latency_ms });
        await emitDeliveryEvent("delivery.recipient_sent", { contact_id: r.contact_id, provider: provider.id, provider_message_id: res.provider_message_id, latency_ms: res.latency_ms }, campaign_id);

        // Analytics · canonical event stream ("queued" fires at the moment
        // the send call succeeds · downstream events arrive via provider
        // webhooks OR — in simulation mode — via simulateEngagementFor).
        const domain = (r.email.split("@")[1] ?? "unknown").toLowerCase();
        const segment_id = campaign.segment_ids[0] ?? null;
        await ingestEvent({
          event_type: "queued", campaign_id, recipient_id: r.contact_id, segment_id,
          provider: provider.id, country: campaign_country_for(r), domain,
          provider_message_id: res.provider_message_id, latency_ms: res.latency_ms,
          metadata: { batch: true },
        });
        if (provider.id === "simulator") {
          await simulateEngagementFor({
            campaign_id, recipient_id: r.contact_id, segment_id,
            email: r.email, country: campaign_country_for(r),
            provider_message_id: res.provider_message_id,
          });
        }
      } else {
        if (res.retriable) {
          // Honour provider retry-after when present (Retry-After header · SES ThrottlingException · SG 429 etc)
          const retryAfterMs = res.retry_after_ms ?? undefined;
          await recordRecipientSend({ campaign_id, contact_id: r.contact_id, ok: false, provider: provider.id, latency_ms: res.latency_ms, error: res.error });
          await emitDeliveryEvent("delivery.recipient_failed", { contact_id: r.contact_id, provider: provider.id, error: res.error, retriable: true, retry_after_ms: retryAfterMs }, campaign_id);
        } else {
          failed++;
          await recordRecipientSend({ campaign_id, contact_id: r.contact_id, ok: false, permanent: true, provider: provider.id, latency_ms: res.latency_ms, error: res.error });
          await emitDeliveryEvent("delivery.recipient_failed", { contact_id: r.contact_id, provider: provider.id, error: res.error, retriable: false }, campaign_id);
        }
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      await recordRecipientSend({ campaign_id, contact_id: r.contact_id, ok: false, permanent: false, provider: provider.id, latency_ms: 0, error: msg });
      await emitDeliveryEvent("delivery.recipient_failed", { contact_id: r.contact_id, provider: provider.id, error: msg, exception: true }, campaign_id);
    }
  }

  // Update campaign send_stats
  await withClient(async (c) => {
    await c.query(
      `UPDATE nex.campaigns
       SET send_stats = COALESCE(send_stats, '{}'::jsonb) ||
         jsonb_build_object(
           'attempted', COALESCE((send_stats->>'attempted')::int, 0) + $1,
           'sent',      COALESCE((send_stats->>'sent')::int, 0) + $2,
           'failed',    COALESCE((send_stats->>'failed')::int, 0) + $3
         ),
         updated_at = NOW()
       WHERE campaign_id = $4`,
      [recipients.length, sent, failed, campaign_id],
    );
    return null;
  });

  // Queue the next batch (or finalise) · always follow-up so the pipeline drains
  await enqueueJob({ job_type: "campaign.send_batch", campaign_id, priority: 90, scheduled_for: new Date(Date.now() + 250).toISOString() });

  await emitDeliveryEvent("delivery.batch_completed", { batch_size: recipients.length, sent, failed }, campaign_id);
  return { batch_size: recipients.length, sent, failed };
}

async function runFinalise(campaign_id: string): Promise<Record<string, unknown>> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT
         COUNT(*)::int AS total,
         SUM(CASE WHEN send_status = 'pending'         THEN 1 ELSE 0 END)::int AS pending,
         SUM(CASE WHEN send_status = 'sent'            THEN 1 ELSE 0 END)::int AS sent,
         SUM(CASE WHEN send_status = 'failed'          THEN 1 ELSE 0 END)::int AS failed,
         SUM(CASE WHEN send_status = 'suppressed'      THEN 1 ELSE 0 END)::int AS suppressed,
         SUM(CASE WHEN send_status = 'skipped_window'  THEN 1 ELSE 0 END)::int AS skipped_window,
         COUNT(*) FILTER (WHERE send_status = 'skipped_window' AND (scheduled_for IS NULL OR scheduled_for <= NOW()))::int AS window_now_open
       FROM nex.campaign_recipients WHERE campaign_id = $1`,
      [campaign_id],
    );
    return res.rows[0] as Record<string, number>;
  });
  const totals = r ?? { total: 0, pending: 0, sent: 0, failed: 0, suppressed: 0, skipped_window: 0, window_now_open: 0 };

  // Reopen skipped_window rows whose scheduled_for is now past — move to pending
  if ((totals.window_now_open ?? 0) > 0) {
    await withClient(async (c) => {
      await c.query(
        `UPDATE nex.campaign_recipients SET send_status = 'pending' WHERE campaign_id = $1 AND send_status = 'skipped_window' AND scheduled_for <= NOW()`,
        [campaign_id],
      );
      return null;
    });
    await enqueueJob({ job_type: "campaign.send_batch", campaign_id, priority: 90 });
    return { ...totals, action: "reopened_skipped_window" };
  }

  // Complete if nothing pending or window-scheduled
  const stillRunning = (totals.pending ?? 0) > 0 || (totals.skipped_window ?? 0) > 0;
  if (!stillRunning) {
    const campaign = await getCampaign(campaign_id);
    if (campaign && campaign.status === "sending") {
      await transitionCampaignStatus(campaign_id, "completed");
      await emitDeliveryEvent("delivery.campaign_completed", totals, campaign_id);
    }
    return { ...totals, action: "campaign_completed" };
  }

  // Still pending — schedule another finalise pass shortly
  await enqueueJob({ job_type: "campaign.finalise", campaign_id, priority: 95, scheduled_for: new Date(Date.now() + 15_000).toISOString() });
  return { ...totals, action: "still_pending_reschedule" };
}

// The recipient row carries country in variables but we don't add it to
// the typed row above · this small helper reads it back safely.
function campaign_country_for(r: { variables?: Record<string, string> }): string | null {
  const v = r.variables ?? {};
  return v.country ?? null;
}

function buildUnsubscribeUrl(campaign_id: string, contact_id: string): string {
  const base = process.env.NEX_PUBLIC_URL ?? process.env.NEXT_PUBLIC_HAMMEREX_SITE_URL ?? "https://thenetworkers.app";
  return `${base.replace(/\/$/, "")}/u/${encodeURIComponent(contact_id)}?c=${encodeURIComponent(campaign_id)}`;
}

// ── Public helper for auto-enqueue on scheduled ───────────────────
export async function scheduleCampaignForDelivery(campaign_id: string): Promise<void> {
  const c = await getCampaign(campaign_id);
  if (!c) return;
  await emitDeliveryEvent("delivery.campaign_scheduled", { scheduled_at: c.scheduled_at ?? null, provider: activeProvider().id, mode: currentMode() }, campaign_id);
  await enqueueJob({
    job_type: "campaign.expand", campaign_id, priority: 80,
    scheduled_for: c.scheduled_at ?? new Date().toISOString(),
  });
}
