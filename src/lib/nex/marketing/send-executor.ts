// src/lib/nex/marketing/send-executor.ts
//
// NEX Marketing · Stage 1.2 (Stage 5.5 lane-routed) · Send-queue executor
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a Accepted).
//
// **Role**: drains `nex.marketing_send_queue` and executes real sends through
// the existing email adapter registry. THREE LANES · ONE EXECUTOR.
//
// **Discipline** (all founder-locked):
//   • SKIP LOCKED claim pattern · multi-worker safe · row-level lease
//   • Wave 2 durability primitives · jitteredBackoff for retry timing
//   • Compliance re-check AT CLAIM TIME (opt_out / hard_bounced may have
//     changed between queue population and send)
//   • Every send attributed to campaign · contact · sender · provider · message-id
//   • Tracking pixel + click rewrites injected via injectTracking()
//   • Observed-open language preserved (never "read")
//   • Idempotent · retry with backoff · DLQ after MAX_ATTEMPTS
//   • Continuous operation · one bad row never stops the loop
//
// **Stage 5.5 lane-routing** (§5-§9):
//   • Reads campaign.metadata.lane · dispatches to lane-specific resolver
//   • AUTO lane: selectSender({lane:'auto', member_id:null}) · reserve/consume/release operating budget
//   • MEMBER lane: campaign.metadata.sender_id (pre-authorised) · executor does NOT touch
//     package accounting (Stage 4 does bulk reserve · executor only sends)
//   • FOUNDER lane: campaign.metadata.sender_id (pre-authorised) · no accounting
//   • Missing lane: existing default behaviour preserved (backward compat · §24)
//   • Cross-lane sender rejected at executor level regardless of UI (§7)
//
// **How to invoke**: `/api/cron/nex-marketing-send-tick` calls `tick()` on schedule.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/nex/db";
import { getEmail } from "@/lib/nex/email/registry";
import type { EmailMessage, SendResult } from "@/lib/nex/email/types";
import { jitteredBackoff, DEFAULT_BACKOFF } from "@/lib/nex/durability/backoff";
import { deriveIdempotencyKey } from "@/lib/nex/durability/idempotency-key";
import { injectTracking } from "./tracking-inject";
import { selectSender } from "./sender-pool/selection";
import { loadSenderById } from "./sender-pool/repository";
import { reserveBudget, consumeBudget, releaseBudget } from "./auto/operating-budget";

// ─── Config ─────────────────────────────────────────────────────────
export const DEFAULT_BATCH_SIZE = 25;
export const DEFAULT_LEASE_TTL_SECONDS = 120;
export const MAX_ATTEMPTS = 5;
export const RETRY_BACKOFF_BASE_MS = 5_000;
export const RETRY_BACKOFF_MAX_MS = 30 * 60_000;

// ─── Public API ─────────────────────────────────────────────────────
export interface TickInput {
  readonly worker_id: string;
  readonly batch_size?: number;
  readonly now?: () => Date;
  /** Injectable email adapter (tests) — defaults to registry-resolved. */
  readonly adapter_override?: { send(msg: EmailMessage): Promise<SendResult> };
}

export interface TickResult {
  readonly cycle_started_at: string;
  readonly cycle_finished_at: string;
  readonly worker_id: string;
  readonly claimed: number;
  readonly sent: number;
  readonly failed_transient: number;
  readonly failed_permanent: number;
  readonly skipped_compliance: number;
  readonly errors: ReadonlyArray<string>;
}

/** One executor tick · called from cron. Drains up to `batch_size` rows.
 *  Never throws · returns TickResult with error strings for diagnostics. */
export async function tick(input: TickInput): Promise<TickResult> {
  const now_fn = input.now ?? (() => new Date());
  const started = now_fn();
  const batch_size = input.batch_size ?? DEFAULT_BATCH_SIZE;
  const errors: string[] = [];

  let claimed = 0;
  let sent = 0;
  let failed_transient = 0;
  let failed_permanent = 0;
  let skipped_compliance = 0;

  const pool = await getPool();
  if (!pool) {
    errors.push("pool_unavailable");
    return finalise(started, now_fn(), input.worker_id, claimed, sent, failed_transient, failed_permanent, skipped_compliance, errors);
  }

  const client = await pool.connect();
  try {
    // ─── Claim next batch via SKIP LOCKED ────────────────────────
    const claims = await claimBatch(client, input.worker_id, batch_size);
    claimed = claims.length;
    if (claimed === 0) {
      return finalise(started, now_fn(), input.worker_id, claimed, sent, failed_transient, failed_permanent, skipped_compliance, errors);
    }

    // ─── Process each claim independently ───────────────────────
    for (const row of claims) {
      try {
        const outcome = await processClaim(client, row, input, now_fn);
        switch (outcome.kind) {
          case "sent":                 sent += 1; break;
          case "failed_transient":     failed_transient += 1; break;
          case "failed_permanent":     failed_permanent += 1; break;
          case "skipped_compliance":   skipped_compliance += 1; break;
        }
      } catch (e) {
        // Isolation: one bad row never stops the loop (founder-locked)
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`queue_id=${row.queue_id}: ${msg}`);
        // Return the row to pending so a later tick can retry
        try {
          await client.query(
            `UPDATE nex.marketing_send_queue
               SET status='pending', claimed_at=NULL, claimed_by=NULL, next_attempt_at=$1
             WHERE queue_id=$2`,
            [computeNextAttempt(row.attempts, now_fn), row.queue_id]
          );
        } catch { /* best-effort · will be reclaimed by lease-expiry sweep */ }
      }
    }
  } finally {
    client.release();
  }

  return finalise(started, now_fn(), input.worker_id, claimed, sent, failed_transient, failed_permanent, skipped_compliance, errors);
}

// ─── Internals ──────────────────────────────────────────────────────
interface ClaimedRow {
  queue_id: string;
  campaign_id: string;
  contact_id: string;
  email: string;
  attempts: number;
}

async function claimBatch(client: PoolClient, worker_id: string, limit: number): Promise<ReadonlyArray<ClaimedRow>> {
  // Single UPDATE ... FROM (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING pattern
  const res = await client.query<{ queue_id: string; campaign_id: string; contact_id: string; email: string; attempts: number }>(
    `UPDATE nex.marketing_send_queue q
        SET status='claimed', claimed_at=now(), claimed_by=$1
      WHERE q.queue_id IN (
        SELECT queue_id FROM nex.marketing_send_queue
         WHERE status='pending' AND next_attempt_at <= now()
         ORDER BY next_attempt_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED
      )
      RETURNING q.queue_id, q.campaign_id, q.contact_id, q.email, q.attempts`,
    [worker_id, limit]
  );
  return res.rows;
}

type ProcessOutcome =
  | { kind: "sent"; provider_message_id: string }
  | { kind: "failed_transient"; reason: string }
  | { kind: "failed_permanent"; reason: string }
  | { kind: "skipped_compliance"; reason: string };

async function processClaim(
  client: PoolClient,
  row: ClaimedRow,
  input: TickInput,
  now_fn: () => Date,
): Promise<ProcessOutcome> {
  // ─── 1 · Re-check compliance state (may have changed since queue) ─
  const opt_out_check = await client.query<{ opt_out: boolean; hard_bounced: boolean; complaint_count: number }>(
    `SELECT opt_out, hard_bounced, complaint_count
       FROM nex.marketing_contact WHERE contact_id=$1`,
    [row.contact_id]
  );
  const c_row = opt_out_check.rows[0];
  if (!c_row) {
    await markPermanentFailure(client, row.queue_id, "contact_not_found");
    return { kind: "failed_permanent", reason: "contact_not_found" };
  }
  if (c_row.opt_out) {
    await client.query(
      `UPDATE nex.marketing_send_queue SET status='skipped_opt_out', sent_at=now() WHERE queue_id=$1`,
      [row.queue_id]
    );
    return { kind: "skipped_compliance", reason: "opt_out" };
  }
  if (c_row.hard_bounced) {
    await client.query(
      `UPDATE nex.marketing_send_queue SET status='skipped_bounced', sent_at=now() WHERE queue_id=$1`,
      [row.queue_id]
    );
    return { kind: "skipped_compliance", reason: "hard_bounced" };
  }

  // ─── 2 · Load campaign + template + metadata (Stage 5.5: lane routing) ─
  const camp = await client.query<{
    campaign_id: string;
    template_id: string;
    subject_line: string;
    from_email: string;
    from_name: string;
    reply_to: string | null;
    html_compiled: string;
    text_fallback: string;
    variables: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
  }>(
    `SELECT c.campaign_id, c.metadata, t.template_id, t.subject_line, t.from_email, t.from_name,
            t.reply_to, t.html_compiled, t.text_fallback, t.variables
       FROM nex.marketing_campaign c
       JOIN nex.marketing_template t ON t.template_id = c.template_id
      WHERE c.campaign_id=$1`,
    [row.campaign_id]
  );
  const camp_row = camp.rows[0];
  if (!camp_row) {
    await markPermanentFailure(client, row.queue_id, "campaign_or_template_missing");
    return { kind: "failed_permanent", reason: "campaign_or_template_missing" };
  }

  // ─── 2b · Lane resolution + sender ownership check (§5-§9) ─────
  const lane_outcome = await resolveLaneAndSender(client, camp_row, row.contact_id, row.queue_id, row.attempts);
  if (lane_outcome.kind === "refused") {
    await markPermanentFailure(client, row.queue_id, `lane_refused:${lane_outcome.reason}`);
    return { kind: "failed_permanent", reason: `lane_refused:${lane_outcome.reason}` };
  }
  if (lane_outcome.kind === "deferred") {
    // Sender/capacity/budget not currently available · return to pending
    const next_at = computeNextAttempt(row.attempts, now_fn);
    await client.query(
      `UPDATE nex.marketing_send_queue
          SET status='pending', claimed_at=NULL, claimed_by=NULL, next_attempt_at=$1, error=$2
        WHERE queue_id=$3`,
      [next_at, `deferred:${lane_outcome.reason}`.slice(0, 500), row.queue_id]
    );
    return { kind: "failed_transient", reason: `deferred:${lane_outcome.reason}` };
  }
  const resolved = lane_outcome;   // { kind: "resolved", lane, from_email, from_name, budget_attribution? }

  // ─── 3 · Inject tracking · pixel + click rewrites ────────────
  const tracked = injectTracking({
    html: camp_row.html_compiled,
    campaign_id: row.campaign_id,
    contact_id: row.contact_id,
  });

  // ─── 4 · Assemble EmailMessage · derive idempotency key ─────
  const idempotency_key = deriveIdempotencyKey({
    workflow_id: "marketing-send",
    activity_name: `send_${camp_row.campaign_id.slice(0, 8)}`,
    attempt_id: `${row.queue_id}#${row.attempts + 1}`,
  });

  const message: EmailMessage = {
    from: { address: resolved.from_email, name: resolved.from_name || undefined },
    to: [{ address: row.email }],
    reply_to: camp_row.reply_to || undefined,
    subject: camp_row.subject_line,
    html: tracked.html,
    text: camp_row.text_fallback,
    kind: "marketing",
    campaign_id: row.campaign_id,
    headers: {
      "X-Entity-Ref-ID": idempotency_key,
      "X-NEX-Lane": resolved.lane,
      "List-Unsubscribe": tracked.list_unsubscribe_header,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };

  // ─── 5 · Send via adapter registry ──────────────────────────
  const adapter = input.adapter_override ?? getEmail();
  const send_result = await adapter.send(message);

  if (send_result.ok) {
    // ─── 6a · Mark sent · write immutable log · update counters ─
    await client.query(
      `UPDATE nex.marketing_send_queue
          SET status='sent', sent_at=now(), esp_message_id=$1
        WHERE queue_id=$2`,
      [send_result.provider_message_id, row.queue_id]
    );
    await client.query(
      `INSERT INTO nex.marketing_send_log (campaign_id, contact_id, email, esp, esp_message_id, status)
       VALUES ($1, $2, $3, $4, $5, 'accepted')`,
      [row.campaign_id, row.contact_id, row.email, send_result.provider, send_result.provider_message_id]
    );
    await client.query(
      `UPDATE nex.marketing_campaign SET send_count = send_count + 1 WHERE campaign_id=$1`,
      [row.campaign_id]
    );
    await client.query(
      `UPDATE nex.marketing_contact
          SET send_count = send_count + 1, last_sent_at = now()
        WHERE contact_id=$1`,
      [row.contact_id]
    );
    // ─── 6a.1 · AUTO lane: consume operating budget reservation ─
    if (resolved.lane === "auto" && resolved.budget_attribution_id) {
      await consumeBudget(client, resolved.budget_attribution_id, "system:executor").catch(() => { /* audit-only · executor never fails send if consume fails */ });
    }
    return { kind: "sent", provider_message_id: send_result.provider_message_id };
  } else {
    // ─── 6b · Failure · retry or DLQ ────────────────────────────
    const next_attempts = row.attempts + 1;
    if (send_result.retryable && next_attempts < MAX_ATTEMPTS) {
      const next_at = computeNextAttempt(next_attempts, now_fn);
      await client.query(
        `UPDATE nex.marketing_send_queue
            SET status='pending', attempts=$1, claimed_at=NULL, claimed_by=NULL,
                next_attempt_at=$2, error=$3
          WHERE queue_id=$4`,
        [next_attempts, next_at, send_result.reason.slice(0, 500), row.queue_id]
      );
      // Log the failed attempt too (rejected) so audit shows all attempts
      await client.query(
        `INSERT INTO nex.marketing_send_log (campaign_id, contact_id, email, esp, status, status_detail)
         VALUES ($1, $2, $3, $4, 'rejected', $5)`,
        [row.campaign_id, row.contact_id, row.email, send_result.provider, `transient · attempt ${next_attempts}/${MAX_ATTEMPTS} · ${send_result.reason.slice(0, 200)}`]
      );
      return { kind: "failed_transient", reason: send_result.reason };
    } else {
      // Permanent failure or attempts exhausted → DLQ (status='failed')
      await client.query(
        `UPDATE nex.marketing_send_queue
            SET status='failed', attempts=$1, error=$2
          WHERE queue_id=$3`,
        [next_attempts, send_result.reason.slice(0, 500), row.queue_id]
      );
      await client.query(
        `INSERT INTO nex.marketing_send_log (campaign_id, contact_id, email, esp, status, status_detail)
         VALUES ($1, $2, $3, $4, 'rejected', $5)`,
        [row.campaign_id, row.contact_id, row.email, send_result.provider, `permanent · attempts=${next_attempts} · ${send_result.reason.slice(0, 200)}`]
      );
      await client.query(
        `UPDATE nex.marketing_campaign SET fail_count = fail_count + 1 WHERE campaign_id=$1`,
        [row.campaign_id]
      );
      // ─── 6b.1 · AUTO lane: release operating budget reservation ─
      if (resolved.lane === "auto" && resolved.budget_attribution_id) {
        await releaseBudget(client, resolved.budget_attribution_id, `permanent_failure:${send_result.reason.slice(0, 80)}`, "system:executor").catch(() => { /* audit-only */ });
      }
      return { kind: "failed_permanent", reason: send_result.reason };
    }
  }
}

// ─── Stage 5.5 · Lane resolution + sender ownership + AUTO accounting ─
type LaneResolution =
  | { kind: "resolved"; lane: "auto" | "member" | "founder" | "unknown"; from_email: string; from_name: string | null; budget_attribution_id?: string }
  | { kind: "refused"; reason: string }
  | { kind: "deferred"; reason: string };

async function resolveLaneAndSender(
  client: PoolClient,
  camp_row: { campaign_id: string; from_email: string; from_name: string; metadata: Record<string, unknown> | null },
  contact_id: string,
  queue_id: string,
  attempts: number,
): Promise<LaneResolution> {
  const md = camp_row.metadata ?? {};
  const lane_raw = String((md as any).lane ?? "").toLowerCase();
  const stored_sender_id = ((md as any).sender_id ?? null) as string | null;

  // Missing lane · backward-compat · use existing template.from_email
  if (!lane_raw || lane_raw === "unknown") {
    return { kind: "resolved", lane: "unknown", from_email: camp_row.from_email, from_name: camp_row.from_name };
  }

  if (lane_raw === "member" || lane_raw === "founder") {
    if (!stored_sender_id) return { kind: "refused", reason: `${lane_raw}_missing_sender_id` };
    const sender = await loadSenderById(client, stored_sender_id);
    if (!sender) return { kind: "refused", reason: "sender_not_found" };
    if (sender.lane !== lane_raw) return { kind: "refused", reason: `sender_lane_mismatch:campaign=${lane_raw}_sender=${sender.lane}` };
    if (sender.authentication_state !== "verified") return { kind: "deferred", reason: `sender_unverified:${sender.authentication_state}` };
    const sendable = new Set(["healthy", "limited", "warning"]);
    if (!sendable.has(sender.health_state)) return { kind: "deferred", reason: `sender_unhealthy:${sender.health_state}` };
    // MEMBER lane preserves Stage 4 aggregate-reservation model (§24 backward compat).
    // FOUNDER lane has no accounting (§35).
    return { kind: "resolved", lane: lane_raw as "member" | "founder", from_email: sender.email, from_name: sender.display_name };
  }

  if (lane_raw === "auto") {
    // §6 · never use template.from_email as sender authority. Select via Stage 2.
    const selection = await selectSender(client, { lane: "auto", member_id: null, need: 1 });
    if (selection.kind !== "selected") {
      return { kind: "deferred", reason: `auto_sender_${selection.reason}` };
    }
    if (selection.sender.lane !== "auto") {
      return { kind: "refused", reason: `auto_sender_lane_leak:${selection.sender.lane}` };
    }
    // §8 · reserve operating budget · idempotent by (budget, campaign, contact, queue, attempt)
    const budget_id = ((md as any).budget_id ?? null) as string | null;
    if (!budget_id) return { kind: "refused", reason: "auto_campaign_missing_budget_id" };
    const outcome = await reserveBudget(client, {
      budget_id,
      campaign_id: camp_row.campaign_id,
      contact_id,
      queue_id,
      attempt_id: attempts + 1,
      units: 1,
      actor: "system:executor",
    });
    if (outcome.kind === "capacity_exhausted") return { kind: "deferred", reason: "auto_budget_exhausted" };
    if (outcome.kind === "budget_not_active") return { kind: "deferred", reason: `auto_budget_${outcome.status}` };
    if (outcome.kind === "budget_not_found") return { kind: "refused", reason: "auto_budget_not_found" };
    const attribution_id = outcome.attribution.attribution_id;
    return {
      kind: "resolved",
      lane: "auto",
      from_email: selection.sender.email,
      from_name: selection.sender.display_name,
      budget_attribution_id: attribution_id,
    };
  }

  return { kind: "refused", reason: `unknown_lane:${lane_raw}` };
}

async function markPermanentFailure(client: PoolClient, queue_id: string, reason: string): Promise<void> {
  await client.query(
    `UPDATE nex.marketing_send_queue SET status='failed', error=$1 WHERE queue_id=$2`,
    [reason.slice(0, 500), queue_id]
  );
}

function computeNextAttempt(attempts: number, now_fn: () => Date): Date {
  const delay_ms = jitteredBackoff(attempts, {
    ...DEFAULT_BACKOFF,
    base_ms: RETRY_BACKOFF_BASE_MS,
    cap_ms: RETRY_BACKOFF_MAX_MS,
  });
  return new Date(now_fn().getTime() + delay_ms);
}

function finalise(
  started: Date, ended: Date, worker_id: string,
  claimed: number, sent: number,
  failed_transient: number, failed_permanent: number,
  skipped_compliance: number, errors: string[],
): TickResult {
  return {
    cycle_started_at: started.toISOString(),
    cycle_finished_at: ended.toISOString(),
    worker_id,
    claimed,
    sent,
    failed_transient,
    failed_permanent,
    skipped_compliance,
    errors,
  };
}
