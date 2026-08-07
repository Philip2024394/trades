// NEX Journey Engine · command executor
//
// Translates a JourneyCommand into an existing-kernel side effect.
// This is the ONLY place in the Journeys subsystem that talks to the
// kernel · it never touches provider adapters, compliance, or contacts.
//
// For `enqueue_send_batch`: creates a one-off campaign (or reuses if
// the payload references one) and enqueues via the existing worker.
// The existing worker + expansion + compliance ratchet + provider
// adapter chain handles everything else, unmodified.

import { enqueueJob } from "@/lib/nex/delivery/queue";
import { withClient } from "@/lib/nex/delivery/db";
import type { JourneyCommand } from "../types";

export type CommandResult = { ok: true; detail?: Record<string, unknown> } | { ok: false; error: string };

export async function executeCommand(command: JourneyCommand): Promise<CommandResult> {
  switch (command.kind) {
    case "enqueue_send_batch":
      return execEnqueueSendBatch(command);
    case "complete":
      return { ok: true, detail: { note: "state marked complete · no side effect needed" } };
    case "stop":
      return { ok: true, detail: { reason: command.reason } };
  }
}

// SendCampaign · MVP approach:
//   The journey references a full campaign_id. We prime a one-recipient
//   snapshot row on nex.campaign_recipients for THIS contact and enqueue
//   a send_batch job. The existing worker + defense-in-depth compliance
//   + rate limiter + provider adapter chain handles the rest.
//
//   This preserves invariants #4 (compliance sole writer) and #6
//   (immutable snapshot) — we write only the recipient row for this
//   one journey-driven send, not the full segment expansion.
async function execEnqueueSendBatch(command: Extract<JourneyCommand, { kind: "enqueue_send_batch" }>): Promise<CommandResult> {
  const insertedRecipient = await withClient(async (c) => {
    // Fetch the contact so we can populate the recipient row with the
    // same shape the normal expansion path uses.
    const cRes = await c.query(
      `SELECT DISTINCT ON (contact_id) contact_id, name, company, canonical_email AS email, country, trade_categories,
              consent_marketing, never_contact, unsubscribe_at, compliance_state
       FROM nex.contacts WHERE contact_id = $1 AND deleted_at IS NULL
       ORDER BY contact_id, updated_at DESC LIMIT 1`,
      [command.contact_id],
    );
    if (cRes.rows.length === 0) return { ok: false as const, reason: "contact_not_found" };
    const row = cRes.rows[0];
    const email = row.email as string | null;
    if (!email) return { ok: false as const, reason: "contact_missing_email" };

    // Defense-in-depth: check compliance state · skip if not sendable
    const cs = String(row.compliance_state ?? "allowed");
    if (["suppressed_soft","suppressed_hard","unsubscribed","complaint","manual_block"].includes(cs)) {
      return { ok: false as const, reason: `compliance_${cs}` };
    }

    const trades = Array.isArray(row.trade_categories) ? row.trade_categories as string[] : [];
    const variables = {
      name:         (row.name as string | null) ?? "",
      company:      (row.company as string | null) ?? "",
      trade:        trades[0] ?? "",
      country:      (row.country as string | null) ?? "",
      email,
      current_year: String(new Date().getFullYear()),
    };

    // Insert the journey-driven recipient · ON CONFLICT DO NOTHING keeps
    // the snapshot immutable for the (campaign, contact) pair.
    await c.query(
      `INSERT INTO nex.campaign_recipients (campaign_id, contact_id, email, country, variables, send_status, scheduled_for)
       VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', NOW())
       ON CONFLICT (campaign_id, contact_id) DO NOTHING`,
      [command.campaign_id, command.contact_id, email, row.country ?? null, JSON.stringify(variables)],
    );

    // Ensure the campaign is in a state where send_batch runs.
    // If it's still draft/scheduled, transition it to 'sending' (journeys
    // treat the campaign as always-on).
    await c.query(
      `UPDATE nex.campaigns SET status = 'sending', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
       WHERE campaign_id = $1 AND status IN ('draft','ready_for_review','approved','scheduled')`,
      [command.campaign_id],
    );

    return { ok: true as const };
  });

  if (!insertedRecipient || !insertedRecipient.ok) {
    return { ok: false, error: `insert_recipient: ${insertedRecipient?.reason ?? "storage_unreachable"}` };
  }

  // Enqueue a send_batch job for the campaign · the existing worker
  // will drain the pending recipients (which now includes this contact).
  const job = await enqueueJob({
    job_type: "campaign.send_batch", campaign_id: command.campaign_id, priority: 80,
    payload: { source: "journey", ...command.payload },
  });
  if (!job) return { ok: false, error: "enqueue_failed" };
  return { ok: true, detail: { job_id: job.job_id } };
}
