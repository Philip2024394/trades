// NEX Comms Centre · Social · HQ network-wide analytics.
//
// Charter §0 Boundary 2: HQ analytics use pre-aggregated per-tenant
// metrics · with k-anonymity floor (k=5 per approved A1) on any
// dimensioned aggregate. Dimensions with fewer than k contributing
// tenants are SUPPRESSED so a single-tenant slice can't be re-identified.
//
// Phase 7 computes rollups on demand from existing tables. Materialised
// rollups (nex.social_tenant_rollups) are a later optimisation when
// listing performance requires it.

import { withClient } from "@/lib/nex/db";

const K_ANONYMITY_FLOOR = 5;

export interface NetworkOverview {
  tenants: {
    total:            number;
    by_kind:          Record<string, number>;
    by_status:        Record<string, number>;
  };
  accounts_by_platform: Array<{ platform: string; count: number }>;   // k-suppressed
  jobs_by_status:       Array<{ status: string; count: number }>;
  jobs_last_24h:        number;
  jobs_last_7d:         number;
  validator_runs_last_24h: {
    passed: number; rejected: number; failed_closed: number;
  };
  k_anonymity_floor: number;
  computed_at: string;
}

export interface NetworkOverviewInput {
  admin_user_id: string;
  reason:        string;
}

// Records ONE admin audit row per overview call.
export async function computeNetworkOverview(input: NetworkOverviewInput): Promise<NetworkOverview> {
  const now = new Date().toISOString();
  return (await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
      // Audit the read
      await c.query(
        `SELECT nex.social_admin_read($1::text, gen_random_uuid()::uuid, 'audit_event_summary', $2::text)`,
        [input.admin_user_id, `network_overview:${input.reason}`],
      );

      // Tenants
      const tByKind = await c.query(`SELECT kind, COUNT(*)::int AS n FROM nex.social_tenants GROUP BY kind`);
      const tByStatus = await c.query(`SELECT status, COUNT(*)::int AS n FROM nex.social_tenants GROUP BY status`);
      const totalTenants = await c.query(`SELECT COUNT(*)::int AS n FROM nex.social_tenants`);
      const byKind:   Record<string, number> = {}; for (const r of tByKind.rows)   byKind[String(r.kind)] = Number(r.n);
      const byStatus: Record<string, number> = {}; for (const r of tByStatus.rows) byStatus[String(r.status)] = Number(r.n);

      // Accounts by platform · k-anonymised: exclude platforms with fewer
      // than K unique tenants contributing accounts.
      const acctPlatforms = await c.query(
        `SELECT platform,
                COUNT(*)::int                                  AS row_count,
                COUNT(DISTINCT tenant_id)::int                 AS distinct_tenants
           FROM nex.social_accounts
          GROUP BY platform
          ORDER BY platform`);
      const accounts_by_platform: NetworkOverview["accounts_by_platform"] =
        acctPlatforms.rows
          .filter((r) => Number(r.distinct_tenants) >= K_ANONYMITY_FLOOR)
          .map((r) => ({ platform: String(r.platform), count: Number(r.row_count) }));

      // Jobs
      const jobsByStatus = await c.query(
        `SELECT status, COUNT(*)::int AS n FROM nex.social_scheduled_posts GROUP BY status`);
      const jobs24h = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex.social_scheduled_posts WHERE enqueued_at >= NOW() - INTERVAL '1 day'`);
      const jobs7d  = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex.social_scheduled_posts WHERE enqueued_at >= NOW() - INTERVAL '7 days'`);
      const jobs_by_status = jobsByStatus.rows.map((r) => ({ status: String(r.status), count: Number(r.n) }));

      // Validator runs (last 24h)
      const vrun = await c.query(
        `SELECT outcome, COUNT(*)::int AS n
           FROM nex.social_validator_runs
          WHERE started_at >= NOW() - INTERVAL '1 day'
          GROUP BY outcome`);
      const v: NetworkOverview["validator_runs_last_24h"] = { passed: 0, rejected: 0, failed_closed: 0 };
      for (const r of vrun.rows) {
        if (r.outcome === "passed")        v.passed        = Number(r.n);
        if (r.outcome === "rejected")      v.rejected      = Number(r.n);
        if (r.outcome === "failed_closed") v.failed_closed = Number(r.n);
      }

      await c.query("COMMIT");
      return {
        tenants: { total: totalTenants.rows[0].n, by_kind: byKind, by_status: byStatus },
        accounts_by_platform,
        jobs_by_status,
        jobs_last_24h: jobs24h.rows[0].n,
        jobs_last_7d:  jobs7d.rows[0].n,
        validator_runs_last_24h: v,
        k_anonymity_floor: K_ANONYMITY_FLOOR,
        computed_at: now,
      };
    } catch (e) { await c.query("ROLLBACK"); throw e; }
  }))!;
}

// Adapter registry status (which real providers registered · read-only,
// no admin bypass needed since it's process-local state).
export interface AdapterStatus {
  platform: string;
  registered: boolean;
  supports_pkce: boolean;
  supports_refresh_tokens: boolean;
  supports_server_side_idempotency: boolean;
  caption_max_chars: number;
  hashtags_max: number;
}

export async function adapterStatus(): Promise<AdapterStatus[]> {
  const { listRegisteredPlatforms, getAdapter } = await import("../adapters/registry");
  const registered = new Set(listRegisteredPlatforms());
  const all = ["facebook","instagram","linkedin","tiktok","google_business","simulator"];
  return all.map((p) => {
    if (!registered.has(p as never)) {
      return { platform: p, registered: false, supports_pkce: false, supports_refresh_tokens: false,
               supports_server_side_idempotency: false, caption_max_chars: 0, hashtags_max: 0 };
    }
    const a = getAdapter(p as never);
    const c = a.capabilities();
    const ac = a.authCapabilities();
    return {
      platform: p, registered: true,
      supports_pkce: ac.supports_pkce,
      supports_refresh_tokens: ac.supports_refresh_tokens,
      supports_server_side_idempotency: c.supports_server_side_idempotency,
      caption_max_chars: c.caption_max_chars,
      hashtags_max: c.hashtags_max,
    };
  });
}
