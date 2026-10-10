// src/lib/nex/aof/governors/source-cooldown.ts
//
// NEX Autonomous Operations Framework · Source cooldown state (DB-backed)
// Founder-authorised programme · 2026-09-22.
//
// Records/updates aof_source_cooldown rows. Provides an authoritative
// "is this source currently on cooldown?" answer that Source Intelligence
// consults before selecting a source. Cooldown never bypasses — expiry
// alone lifts it.

import type { PgClient, AofSourceCooldown, CooldownFailureKind } from "../types";
import { computeCooldownMs } from "./rate-governor";

function rowToCd(r: any): AofSourceCooldown {
  return {
    source_slug: r.source_slug,
    cooldown_until: r.cooldown_until,
    last_failure_kind: r.last_failure_kind,
    last_failure_at: r.last_failure_at,
    consecutive_failures: Number(r.consecutive_failures),
    applied_by_agent_id: r.applied_by_agent_id,
    metadata: r.metadata ?? {},
  };
}

export interface ApplyCooldownInput {
  readonly source_slug: string;
  readonly failure_kind: CooldownFailureKind;
  readonly agent_id?: string;
  readonly now?: Date;
  readonly metadata?: Record<string, unknown>;
}

export async function applyCooldown(client: PgClient, input: ApplyCooldownInput): Promise<AofSourceCooldown> {
  const now = input.now ?? new Date();
  // Read current row for escalation
  const cur = await client.query(
    `SELECT * FROM nex.aof_source_cooldown WHERE source_slug = $1 LIMIT 1`,
    [input.source_slug],
  );
  const prevConsec = cur.rowCount ? Number(cur.rows[0].consecutive_failures) : 0;
  const consec = prevConsec + 1;
  const ms = computeCooldownMs(input.failure_kind, consec);
  const until = new Date(now.getTime() + ms).toISOString();

  const res = await client.query(
    `INSERT INTO nex.aof_source_cooldown
       (source_slug, cooldown_until, last_failure_kind, last_failure_at,
        consecutive_failures, applied_by_agent_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (source_slug) DO UPDATE
       SET cooldown_until = EXCLUDED.cooldown_until,
           last_failure_kind = EXCLUDED.last_failure_kind,
           last_failure_at = EXCLUDED.last_failure_at,
           consecutive_failures = EXCLUDED.consecutive_failures,
           applied_by_agent_id = EXCLUDED.applied_by_agent_id,
           metadata = EXCLUDED.metadata
     RETURNING *`,
    [
      input.source_slug, until, input.failure_kind, now.toISOString(),
      consec, input.agent_id ?? null, JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rowToCd(res.rows[0]);
}

export async function clearCooldown(client: PgClient, source_slug: string): Promise<void> {
  await client.query(`DELETE FROM nex.aof_source_cooldown WHERE source_slug = $1`, [source_slug]);
}

export async function loadCooldown(client: PgClient, source_slug: string): Promise<AofSourceCooldown | null> {
  const res = await client.query(`SELECT * FROM nex.aof_source_cooldown WHERE source_slug = $1 LIMIT 1`, [source_slug]);
  return res.rowCount === 0 ? null : rowToCd(res.rows[0]);
}

export async function listActiveCooldowns(client: PgClient, now?: Date): Promise<ReadonlyArray<AofSourceCooldown>> {
  const t = (now ?? new Date()).toISOString();
  const res = await client.query(
    `SELECT * FROM nex.aof_source_cooldown WHERE cooldown_until > $1 ORDER BY cooldown_until ASC`,
    [t],
  );
  return res.rows.map(rowToCd);
}

export async function isSourceOnCooldown(client: PgClient, source_slug: string, now?: Date): Promise<{ on_cooldown: boolean; cooldown_until_ms: number | null; consecutive_failures: number }> {
  const cd = await loadCooldown(client, source_slug);
  if (!cd) return { on_cooldown: false, cooldown_until_ms: null, consecutive_failures: 0 };
  const t = now ?? new Date();
  const until = new Date(cd.cooldown_until).getTime();
  return { on_cooldown: until > t.getTime(), cooldown_until_ms: until, consecutive_failures: cd.consecutive_failures };
}

// On success · reset the consecutive_failures streak (but keep row for audit)
export async function recordSourceSuccess(client: PgClient, source_slug: string): Promise<void> {
  await client.query(
    `UPDATE nex.aof_source_cooldown
        SET consecutive_failures = 0,
            cooldown_until = now() - INTERVAL '1 second'
      WHERE source_slug = $1`,
    [source_slug],
  );
}
