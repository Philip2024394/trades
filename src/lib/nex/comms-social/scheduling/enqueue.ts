// NEX Comms Centre · Social · scheduling · enqueue path.
//
// Charter §S-VI · one-way pipeline: UI/API code never dispatches to
// adapters. It inserts a row into nex.social_scheduled_posts. The
// Phase 4 worker acquires leases and dispatches.
//
// Enqueue rules:
//   * draft must exist for the tenant AND have grounding_state='grounded'
//     (Phase 2 output that also cleared Phase 3 validators)
//   * account must exist AND status='connected'
//   * global pause is checked here too (early rejection is friendlier)
//     but the worker RE-CHECKS at lease acquisition (the definitive
//     stop point)

import type { PgClientLike } from "@/lib/nex/db";
import type { TenantId } from "../types";
import { emitSocialAudit } from "../audit";

export interface EnqueueInput {
  client:      PgClientLike;
  tenant_id:   TenantId;
  draft_id:    string;
  account_id:  string;
  platform:    string;
  run_at:      string;               // ISO
  enqueued_by: string;
  max_attempts?: number;
}

export type EnqueueResult =
  | { ok: true;  scheduled_id: string; status: "queued" }
  | { ok: false; error_class: "draft_not_found" | "draft_not_grounded" | "account_not_found" | "account_not_connected" | "globally_paused"; detail: string };

export async function enqueuePublish(input: EnqueueInput): Promise<EnqueueResult> {
  // 1. Verify draft is grounded for this tenant.
  const draftRow = await input.client.query(
    `SELECT draft_id, grounding_state FROM nex.social_content_drafts
      WHERE draft_id = $1 AND tenant_id = $2`,
    [input.draft_id, input.tenant_id]);
  if (draftRow.rowCount === 0) return { ok: false, error_class: "draft_not_found", detail: `draft ${input.draft_id} not visible to tenant` };
  if (draftRow.rows[0].grounding_state !== "grounded") {
    return { ok: false, error_class: "draft_not_grounded", detail: `draft is ${draftRow.rows[0].grounding_state}` };
  }

  // 2. Verify account is connected.
  const accountRow = await input.client.query(
    `SELECT account_id, status FROM nex.social_accounts
      WHERE account_id = $1 AND tenant_id = $2`,
    [input.account_id, input.tenant_id]);
  if (accountRow.rowCount === 0) return { ok: false, error_class: "account_not_found", detail: `account ${input.account_id} not visible to tenant` };
  if (accountRow.rows[0].status !== "connected") {
    return { ok: false, error_class: "account_not_connected", detail: `account status=${accountRow.rows[0].status}` };
  }

  // 3. Early global-pause check (worker re-checks at lease).
  const ctrl = await input.client.query(`SELECT global_pause FROM nex.social_controls WHERE singleton = TRUE`);
  if (ctrl.rows[0]?.global_pause === true) {
    return { ok: false, error_class: "globally_paused", detail: "global_pause=true · enqueue blocked" };
  }

  const inserted = await input.client.query(
    `INSERT INTO nex.social_scheduled_posts
       (tenant_id, draft_id, account_id, platform, run_at, max_attempts, enqueued_by, status)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::text, $5::timestamptz, $6, $7::text, 'queued')
     RETURNING scheduled_id`,
    [input.tenant_id, input.draft_id, input.account_id, input.platform, input.run_at, input.max_attempts ?? 3, input.enqueued_by],
  );
  const scheduled_id = String(inserted.rows[0].scheduled_id);

  await emitSocialAudit(input.client, {
    tenant_id:    input.tenant_id,
    event_type:   "scheduled.enqueued",
    actor:        `user:${input.enqueued_by}`,
    subject_kind: "scheduled_post",
    subject_id:   scheduled_id,
    details:      { draft_id: input.draft_id, account_id: input.account_id, platform: input.platform, run_at: input.run_at },
  });

  return { ok: true, scheduled_id, status: "queued" };
}
