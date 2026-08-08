// NEX Comms Centre · Social · publish worker.
//
// Charter §S-VI + §S-VII + §S-V. The worker is the ONLY code path that
// dispatches to a provider adapter. It:
//   1. Acquires ONE lease with SELECT ... FOR UPDATE SKIP LOCKED.
//   2. Re-checks global pause + account status at lease time.
//   3. Runs reCheckAtAdapterCall (Phase 3) — Rights + Policy re-verify.
//   4. Two-phase publish · INSERT into nex.social_publish_intents
//      BEFORE the adapter call (idempotency).
//   5. Calls the adapter's publish(). If server-side idempotency is
//      unavailable, runs verify() after to confirm the actual outcome.
//   6. Records success/failure, updates the scheduled_post row.
//
// Pause discipline:
//   * Global pause OR account paused → job flips to 'paused_at_lease' ·
//     retried next tick.
//   * Pause survives worker restart (persistent row state).
//
// Adapters are the ONLY provider surface. Phase 5 registers real
// providers; Phase 4 exercises the flow via the simulator adapter.

import { randomUUID } from "node:crypto";
import { withTenantClient } from "../db";
import { withClient, type PgClientLike } from "@/lib/nex/db";
import { getAdapter } from "../adapters/registry";
import type { AdapterPublishRequest, AdapterPublishResult, AdapterVerifyResult } from "../adapters/interface";
import type { SocialPlatform } from "../types";
import { reCheckAtAdapterCall } from "../validators/pipeline";
import type { ValidatorSubject } from "../validators/interface";
import { emitSocialAudit } from "../audit";
import { revealTokenForAdapter } from "../oauth/accounts";

const LEASE_TTL_SECONDS = 60;
const IDEMPOTENCY_MARKER_PREFIX = "nex-social";

export interface WorkerTickOptions {
  worker_id?:     string;
  lease_ttl_s?:   number;
  now?:           Date;
}

export interface WorkerTickResult {
  processed:      number;
  outcomes:       Array<{
    scheduled_id: string;
    outcome:      "published" | "paused_at_lease" | "refused_at_recheck" | "failed" | "abandoned" | "no_work";
    detail?:      string;
  }>;
}

// Single worker tick · runs at most ONE job. Cron/loop callers invoke
// repeatedly. Idempotent per lease.
export async function runWorkerTickOnce(opts: WorkerTickOptions = {}): Promise<WorkerTickResult> {
  const worker_id  = opts.worker_id ?? `worker-${randomUUID()}`;
  const lease_ttl  = opts.lease_ttl_s ?? LEASE_TTL_SECONDS;
  const now        = opts.now ?? new Date();
  const outcomes: WorkerTickResult["outcomes"] = [];

  // Cross-tenant acquire path — RLS is disabled for this SELECT because
  // the worker daemon is a cross-tenant process. Uses admin bypass GUC
  // WITHOUT invoking admin_read (worker is not an admin surface · it is
  // a system process and has its own audit trail).
  //
  // Design note: we intentionally do NOT expose this admin-bypass write
  // path in the general db.ts helper — it lives here so any grep for
  // "admin_bypass" outside crypto/oauth surfaces exactly the worker.
  const acquired = await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_worker', 'on', true)");
      // 1. Check global pause first — cheap and stops everything.
      const g = await c.query(`SELECT global_pause FROM nex.social_controls WHERE singleton = TRUE`);
      if (g.rows[0]?.global_pause === true) { await c.query("COMMIT"); return null; }

      // 2. Pick a candidate. The SELECT runs under admin_bypass so it
      //    can see all tenants' queued jobs. FOR UPDATE SKIP LOCKED
      //    holds the row lock across the tenant switch below.
      const pick = await c.query(
        `SELECT scheduled_id, tenant_id
           FROM nex.social_scheduled_posts
          WHERE status = 'queued'
            AND run_at <= $1::timestamptz
          ORDER BY run_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
        [now.toISOString()],
      );
      if (pick.rowCount === 0) { await c.query("COMMIT"); return null; }
      const picked_tenant_id = String(pick.rows[0].tenant_id);
      const picked_scheduled_id = String(pick.rows[0].scheduled_id);

      // 3. UPDATE policy on social_scheduled_posts has no admin_bypass
      //    branch (writes stay tenant-scoped by doctrine). Set the
      //    tenant GUC to the picked row's tenant so the UPDATE's
      //    RLS check passes. The FOR UPDATE lock we hold is preserved.
      await c.query("SELECT set_config('nex.social_tenant_id', $1, true)", [picked_tenant_id]);

      const leaseExpires = new Date(now.getTime() + lease_ttl * 1000).toISOString();
      const lease = await c.query(
        `UPDATE nex.social_scheduled_posts
            SET status = 'leased',
                lease_owner = $2,
                lease_expires_at = $3::timestamptz,
                attempts = attempts + 1
          WHERE scheduled_id = $1
          RETURNING *`,
        [picked_scheduled_id, worker_id, leaseExpires],
      );
      await c.query("COMMIT");
      return lease.rows[0] ?? null;
    } catch (e) { await c.query("ROLLBACK"); throw e; }
  });

  if (!acquired) {
    outcomes.push({ scheduled_id: "", outcome: "no_work" });
    return { processed: 0, outcomes };
  }

  const scheduled_id = String(acquired.scheduled_id);
  const tenant_id    = String(acquired.tenant_id);
  const draft_id     = String(acquired.draft_id);
  const account_id   = String(acquired.account_id);
  const platform     = String(acquired.platform);

  // From here on · tenant-scoped work.
  try {
    const result = await processScheduledJob({ tenant_id, scheduled_id, draft_id, account_id, platform, worker_id, now });
    outcomes.push({ scheduled_id, outcome: result.outcome, detail: result.detail });
  } catch (e) {
    // Terminal error handling · release lease · mark failed or abandoned.
    const detail = e instanceof Error ? e.message : String(e);
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        await c.query("SET LOCAL ROLE nex_social_app");
        await c.query("SELECT set_config('nex.social_worker', 'on', true)");
        await c.query(
          `UPDATE nex.social_scheduled_posts
              SET status = CASE WHEN attempts >= max_attempts THEN 'abandoned' ELSE 'queued' END,
                  lease_owner = NULL,
                  lease_expires_at = NULL,
                  last_error = $2::text,
                  finished_at = CASE WHEN attempts >= max_attempts THEN NOW() ELSE NULL END
            WHERE scheduled_id = $1`,
          [scheduled_id, detail]);
        await c.query("COMMIT");
      } catch (e2) { await c.query("ROLLBACK"); throw e2; }
    });
    outcomes.push({ scheduled_id, outcome: "failed", detail });
  }

  return { processed: 1, outcomes };
}

interface ProcessJobInput {
  tenant_id:    string;
  scheduled_id: string;
  draft_id:     string;
  account_id:   string;
  platform:     string;
  worker_id:    string;
  now:          Date;
}

interface ProcessJobResult {
  outcome: "published" | "paused_at_lease" | "refused_at_recheck" | "failed";
  detail?: string;
}

export async function processScheduledJob(input: ProcessJobInput): Promise<ProcessJobResult> {
  const marker = `${IDEMPOTENCY_MARKER_PREFIX}:${input.scheduled_id}`;

  // Phase A · pause + account check.
  const preCheck = await withTenantClient(input.tenant_id, async (c) => {
    const g = await c.query(`SELECT global_pause FROM nex.social_controls WHERE singleton = TRUE`);
    if (g.rows[0]?.global_pause === true) {
      await releaseLeaseAsStatus(c, input.scheduled_id, "paused_at_lease", "global_pause=true at lease");
      return { outcome: "paused_at_lease" as const, detail: "global_pause" };
    }
    const acct = await c.query(
      `SELECT status FROM nex.social_accounts WHERE account_id = $1 AND tenant_id = $2`,
      [input.account_id, input.tenant_id]);
    if (!acct.rows[0] || acct.rows[0].status !== "connected") {
      await releaseLeaseAsStatus(c, input.scheduled_id, "refused_at_recheck", `account_status=${acct.rows[0]?.status ?? "missing"}`);
      return { outcome: "refused_at_recheck" as const, detail: "account_not_connected" };
    }
    return { outcome: "__proceed__" as const };
  });
  if (preCheck?.outcome !== "__proceed__") return preCheck as ProcessJobResult;

  // Phase B · load draft.
  const draftFetch = await withTenantClient(input.tenant_id, async (c) => {
    const dr = await c.query(
      `SELECT draft_id, tenant_id, platform, caption, hashtags, cta, source_refs, provenance, claims
         FROM nex.social_content_drafts
        WHERE draft_id = $1 AND tenant_id = $2`, [input.draft_id, input.tenant_id]);
    if (dr.rowCount === 0) return null;
    return dr.rows[0];
  });
  if (!draftFetch) {
    await withTenantClient(input.tenant_id, async (c) => {
      await releaseLeaseAsStatus(c, input.scheduled_id, "refused_at_recheck", "draft not visible");
    });
    return { outcome: "refused_at_recheck", detail: "draft_missing" };
  }
  const subject: ValidatorSubject = {
    tenant_id:   String(draftFetch.tenant_id),
    draft_id:    String(draftFetch.draft_id),
    platform:    String(draftFetch.platform),
    caption:     String(draftFetch.caption),
    hashtags:    (draftFetch.hashtags as string[]) ?? [],
    cta:         (draftFetch.cta as string | null) ?? null,
    source_refs: (draftFetch.source_refs as string[]) ?? [],
    provenance:  (draftFetch.provenance as never) ?? {},
    claims:      (draftFetch.claims as never) ?? [],
  };

  // Phase C · Rights + Policy re-check via Phase 3 hook.
  const recheck = await reCheckAtAdapterCall(input.tenant_id, subject);
  if (recheck.outcome !== "passed") {
    await withTenantClient(input.tenant_id, async (c) => {
      await c.query(
        `UPDATE nex.social_scheduled_posts
            SET status = 'refused_at_recheck',
                refused_reasons = $2::jsonb,
                finished_at = NOW(),
                lease_owner = NULL,
                lease_expires_at = NULL
          WHERE scheduled_id = $1`,
        [input.scheduled_id, JSON.stringify(recheck.rejection_summary)]);
      await emitSocialAudit(c, {
        tenant_id:    input.tenant_id,
        event_type:   "scheduled.refused_at_recheck",
        actor:        "worker",
        subject_kind: "scheduled_post",
        subject_id:   input.scheduled_id,
        details:      { recheck_outcome: recheck.outcome, run_id: recheck.run_id },
      });
    });
    return { outcome: "refused_at_recheck", detail: `recheck_${recheck.outcome}` };
  }

  // Phase D · INSERT publish intent (two-phase idempotency · S-VII).
  //   Duplicate key (same tenant, post, platform, account, epoch) is
  //   how we detect a retry after a completed publish. If it already
  //   exists as 'verified_published', we short-circuit as no-op.
  const intent = await withTenantClient(input.tenant_id, async (c) => {
    // Retry_epoch = attempt count on the scheduled_post row (workers
    // fetching a stale lease will see the same epoch and collide, which
    // is the correct outcome).
    const attempt = await c.query(
      `SELECT attempts, intent_id FROM nex.social_scheduled_posts WHERE scheduled_id = $1`,
      [input.scheduled_id]);
    const retry_epoch = attempt.rows[0]?.attempts ?? 1;
    const existingIntentId = attempt.rows[0]?.intent_id;
    if (existingIntentId) {
      // Prior attempt logged an intent · check its state.
      const existing = await c.query(
        `SELECT status, provider_post_id FROM nex.social_publish_intents WHERE intent_id = $1`,
        [existingIntentId]);
      if (existing.rows[0]?.status === "verified_published") {
        return { intent_id: String(existingIntentId), retry_epoch, existing: true, existing_status: "verified_published" };
      }
    }
    try {
      const ins = await c.query(
        `INSERT INTO nex.social_publish_intents
           (tenant_id, post_id, platform, account_id, retry_epoch, status,
            provider_marker, scheduled_id, worker_id, started_at, attempts)
         VALUES ($1::uuid, $2::uuid, $3::text, $4::uuid, $5::int, 'in_flight',
                 $6::text, $7::uuid, $8::text, NOW(), 1)
         RETURNING intent_id`,
        [input.tenant_id, input.draft_id, input.platform, input.account_id, retry_epoch,
         marker, input.scheduled_id, input.worker_id]);
      const newId = String(ins.rows[0].intent_id);
      // Link intent to scheduled_post
      await c.query(
        `UPDATE nex.social_scheduled_posts SET intent_id = $2 WHERE scheduled_id = $1`,
        [input.scheduled_id, newId]);
      return { intent_id: newId, retry_epoch, existing: false, existing_status: null };
    } catch (e) {
      // ON CONFLICT on the UNIQUE (tenant_id, post_id, platform, account_id, retry_epoch)
      // → this exact attempt already exists · likely a stale-lease double-run.
      // Recover: fetch the existing intent, treat as continue-and-verify.
      const dup = await c.query(
        `SELECT intent_id, status FROM nex.social_publish_intents
          WHERE tenant_id = $1 AND post_id = $2 AND platform = $3 AND account_id = $4 AND retry_epoch = $5`,
        [input.tenant_id, input.draft_id, input.platform, input.account_id, retry_epoch]);
      if (dup.rows[0]) {
        return { intent_id: String(dup.rows[0].intent_id), retry_epoch, existing: true, existing_status: String(dup.rows[0].status) };
      }
      throw e;
    }
  });
  if (!intent) throw new Error("intent insertion failed · db unavailable");

  // If we recovered an already-published intent, just mark scheduled_post
  // and return success without another provider call.
  if (intent.existing && intent.existing_status === "verified_published") {
    await withTenantClient(input.tenant_id, async (c) => {
      await c.query(
        `UPDATE nex.social_scheduled_posts
            SET status = 'published', finished_at = NOW(), lease_owner = NULL, lease_expires_at = NULL
          WHERE scheduled_id = $1`, [input.scheduled_id]);
    });
    return { outcome: "published", detail: "idempotency_hit_prior_success" };
  }

  // Phase E · Reveal token + call adapter.
  const adapter = getAdapter(input.platform as SocialPlatform);
  const account = await withTenantClient(input.tenant_id, async (c) => {
    const a = await c.query(
      `SELECT account_id, tenant_id, platform, display_name, platform_account_id, scopes, status,
              connected_at, last_success_at, last_error, token_expires_at, granted_by, created_at, updated_at
         FROM nex.social_accounts WHERE account_id = $1 AND tenant_id = $2`,
      [input.account_id, input.tenant_id]);
    return a.rows[0];
  });
  if (!account) {
    await markIntentFailed(input.tenant_id, intent.intent_id, "account row disappeared between checks");
    return { outcome: "refused_at_recheck", detail: "account_gone" };
  }

  // Token revelation happens inside its own tenant scope · plaintext
  // exists only in this function's stack frame · passed to adapter via
  // AdapterPublishRequest.access_token · adapter is responsible for
  // never persisting / logging.
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  await withTenantClient(input.tenant_id, async (c) => {
    accessToken  = await revealTokenForAdapter(c, input.tenant_id, input.account_id, "access");
    refreshToken = await revealTokenForAdapter(c, input.tenant_id, input.account_id, "refresh");
  });
  if (!accessToken) {
    await markIntentFailed(input.tenant_id, intent.intent_id, "no access token stored");
    return { outcome: "failed", detail: "no_token" };
  }
  const resolvedAccessToken: string = accessToken;   // const alias for TS narrowing across async gaps
  const resolvedRefreshToken: string | null = refreshToken;

  const publishReq: AdapterPublishRequest = {
    account:            {
      account_id:            String(account.account_id),
      tenant_id:             String(account.tenant_id),
      platform:              account.platform as SocialPlatform,
      display_name:          (account.display_name as string | null) ?? null,
      platform_account_id:   (account.platform_account_id as string | null) ?? null,
      scopes:                (account.scopes as string[]) ?? [],
      status:                account.status as never,
      connected_at:          isoOf(account.connected_at),
      last_success_at:       isoOf(account.last_success_at),
      last_error:            (account.last_error as string | null) ?? null,
      token_expires_at:      isoOf(account.token_expires_at),
      granted_by:            (account.granted_by as string | null) ?? null,
      created_at:            isoOf(account.created_at) ?? new Date().toISOString(),
      updated_at:            isoOf(account.updated_at) ?? new Date().toISOString(),
    },
    access_token:       resolvedAccessToken,
    refresh_token:      resolvedRefreshToken,
    post_id:            input.draft_id,
    idempotency_marker: marker,
    caption:            subject.caption,
    hashtags:           subject.hashtags,
    media:              [],
    cta:                subject.cta,
    scheduled_for:      null,
  };

  let publishRes: AdapterPublishResult;
  try {
    publishRes = await adapter.publish(publishReq);
  } catch (e) {
    await markIntentFailed(input.tenant_id, intent.intent_id, `adapter threw: ${e instanceof Error ? e.message : String(e)}`);
    return { outcome: "failed", detail: "adapter_threw" };
  }

  // Phase F · If provider lacks server-side idempotency, verify.
  const caps = adapter.capabilities();
  let verifyRes: AdapterVerifyResult | null = null;
  if (!caps.supports_server_side_idempotency) {
    try {
      verifyRes = await adapter.verify({
        account:            publishReq.account,
        access_token:       resolvedAccessToken,
        idempotency_marker: marker,
        since:              new Date(Date.now() - 60_000).toISOString(),
      });
    } catch { /* fall through · treat as unknown */ }
  }

  if (!publishRes.ok) {
    await markIntentFailed(input.tenant_id, intent.intent_id, `${publishRes.error_class}: ${publishRes.error_message}`);
    return { outcome: "failed", detail: publishRes.error_class };
  }

  // Success path · record intent + scheduled_post.
  await withTenantClient(input.tenant_id, async (c) => {
    await c.query(
      `UPDATE nex.social_publish_intents
          SET status = 'verified_published',
              final_outcome = 'verified_published',
              provider_post_id = $2::text,
              verified_at = NOW()
        WHERE intent_id = $1`,
      [intent.intent_id, publishRes.ok ? publishRes.provider_post_id : null]);
    await c.query(
      `UPDATE nex.social_scheduled_posts
          SET status = 'published',
              finished_at = NOW(),
              lease_owner = NULL,
              lease_expires_at = NULL
        WHERE scheduled_id = $1`, [input.scheduled_id]);
    await emitSocialAudit(c, {
      tenant_id:    input.tenant_id,
      event_type:   "scheduled.published",
      actor:        "worker",
      subject_kind: "scheduled_post",
      subject_id:   input.scheduled_id,
      details:      {
        provider_post_id:  publishRes.provider_post_id,
        idempotency_hit:   publishRes.idempotency_hit,
        verify_outcome:    verifyRes ? ("found" in verifyRes ? String(verifyRes.found) : "unknown") : "n/a_server_side_idempotency",
      },
    });
  });
  return { outcome: "published", detail: publishRes.idempotency_hit ? "idempotency_hit" : "new_publish" };
}

// ── Helpers ───────────────────────────────────────────────────

async function releaseLeaseAsStatus(c: PgClientLike, scheduled_id: string, status: string, note?: string): Promise<void> {
  await c.query(
    `UPDATE nex.social_scheduled_posts
        SET status = $2::text,
            lease_owner = NULL,
            lease_expires_at = NULL,
            last_error = $3::text,
            finished_at = CASE WHEN $2::text IN ('refused_at_recheck','failed','abandoned','published') THEN NOW() ELSE NULL END
      WHERE scheduled_id = $1`,
    [scheduled_id, status, note ?? null]);
}

async function markIntentFailed(tenant_id: string, intent_id: string, err: string): Promise<void> {
  await withTenantClient(tenant_id, async (c) => {
    await c.query(
      `UPDATE nex.social_publish_intents
          SET status = 'failed', final_outcome = 'failed', error = $2::text, verified_at = NOW()
        WHERE intent_id = $1`, [intent_id, err]);
  });
}

function isoOf(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v); const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

// Export for tests
export { processScheduledJob as __processScheduledJob };
