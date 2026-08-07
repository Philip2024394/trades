// NEX Journey Engine · execution registry for SendCampaignAndWait
//
// One row per (journey_state, campaign) dispatched via SendCampaignAndWait.
// UNIQUE(journey_state_id) enforces the idempotency rule (Philip's #3):
// one journey state = one campaign execution.

import { withClient } from "@/lib/nex/delivery/db";

export type ExecutionStatus = "in_flight" | "completed" | "failed_permanent" | "timed_out";

export type CampaignExecution = {
  execution_id: string;
  journey_state_id: string;
  journey_id: string;
  journey_slug: string;
  journey_version: number;
  node_id: string;
  campaign_id: string;
  contact_id: string;
  status: ExecutionStatus;
  dispatched_at: string;
  completed_at: string | null;
  timed_out_at: string | null;
  last_checked_at: string;
  poll_count: number;
  last_recipient_status: string | null;
  outcome_reason: string | null;
  metadata: Record<string, unknown>;
};

/**
 * Create a new execution row. UNIQUE(journey_state_id) prevents
 * duplicates · if a race caused two ticks to fire concurrently, the
 * second returns null and callers must fall through to poll semantics.
 */
export async function createExecution(input: {
  journey_state_id: string; journey_id: string; journey_slug: string; journey_version: number;
  node_id: string; campaign_id: string; contact_id: string;
}): Promise<CampaignExecution | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.journey_campaign_executions
       (journey_state_id, journey_id, journey_slug, journey_version, node_id, campaign_id, contact_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (journey_state_id) DO NOTHING
       RETURNING *`,
      [input.journey_state_id, input.journey_id, input.journey_slug, input.journey_version, input.node_id, input.campaign_id, input.contact_id],
    );
    return res.rows[0] ? rowToExecution(res.rows[0]) : null;
  });
  return r;
}

export async function getExecutionForState(journey_state_id: string): Promise<CampaignExecution | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.journey_campaign_executions WHERE journey_state_id = $1`, [journey_state_id]);
    return res.rows[0] ? rowToExecution(res.rows[0]) : null;
  });
  return r ?? null;
}

/**
 * Read the canonical recipient status for THIS execution's
 * (campaign_id, contact_id). Never reads from a provider · charter
 * §11 rule (also Philip's 5.1.4 boundary rule).
 */
export async function getRecipientStatusForExecution(exec: CampaignExecution): Promise<string> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT send_status FROM nex.campaign_recipients WHERE campaign_id = $1 AND contact_id = $2 LIMIT 1`,
      [exec.campaign_id, exec.contact_id],
    );
    return res.rows[0] ? String(res.rows[0].send_status) : "not_yet_snapshot";
  });
  return r ?? "unreachable";
}

export async function bumpPollAndUpdate(execution_id: string, last_recipient_status: string): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `UPDATE nex.journey_campaign_executions
       SET poll_count = poll_count + 1, last_checked_at = NOW(), last_recipient_status = $1
       WHERE execution_id = $2`,
      [last_recipient_status, execution_id],
    );
    return null;
  });
}

export async function markExecutionCompleted(execution_id: string, status: ExecutionStatus, outcome_reason: string | null): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `UPDATE nex.journey_campaign_executions
       SET status = $1, completed_at = COALESCE(completed_at, NOW()),
           timed_out_at = CASE WHEN $1 = 'timed_out' THEN NOW() ELSE timed_out_at END,
           outcome_reason = $2, last_checked_at = NOW()
       WHERE execution_id = $3`,
      [status, outcome_reason ?? null, execution_id],
    );
    return null;
  });
}

function rowToExecution(r: Record<string, unknown>): CampaignExecution {
  return {
    execution_id: String(r.execution_id),
    journey_state_id: String(r.journey_state_id),
    journey_id: String(r.journey_id),
    journey_slug: String(r.journey_slug),
    journey_version: Number(r.journey_version),
    node_id: String(r.node_id),
    campaign_id: String(r.campaign_id),
    contact_id: String(r.contact_id),
    status: r.status as ExecutionStatus,
    dispatched_at: String(r.dispatched_at),
    completed_at: (r.completed_at as string | null) ?? null,
    timed_out_at: (r.timed_out_at as string | null) ?? null,
    last_checked_at: String(r.last_checked_at),
    poll_count: Number(r.poll_count ?? 0),
    last_recipient_status: (r.last_recipient_status as string | null) ?? null,
    outcome_reason: (r.outcome_reason as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  };
}
