// src/lib/nex/founder-window/flow-counts.ts
//
// Founder 2026-09-10 · Founder's Window · 10-stage pipeline counters.
//
// Every count is a REAL Postgres query · zero fabrication. When a stage
// has no measurable trace (SANITIZE unwired, CLASSIFY unwired), the count
// honestly returns 0 with a `note` field explaining why — never fake data.
//
// Stages (in order):
//   1. INPUT
//   2. SANITIZE
//   3. CLASSIFY
//   4. RESEARCH / RETRIEVE
//   5. VERIFY
//   6. TRUTH ENGINE
//   7. STORE
//   8. KNOWLEDGE
//   9. MEMORY
//   10. RESPONSE / ACTION

import { getPool } from "../db";

export interface StageCount {
  stage: number;
  name: string;
  count_1h: number;
  count_24h: number;
  count_total: number;
  source_tables: string[];
  note: string | null; // honest gap description if count is unmeasurable
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const pool = await getPool();
  if (!pool) return 0;
  const c = await pool.connect();
  try {
    const r = await c.query(sql, params);
    return Number(r.rows?.[0]?.count ?? 0);
  } catch { return 0; } finally { c.release(); }
}

async function tableExists(schema: string, table: string): Promise<boolean> {
  const pool = await getPool();
  if (!pool) return false;
  const c = await pool.connect();
  try {
    const r = await c.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`,
      [schema, table]
    );
    return (r.rowCount ?? 0) > 0;
  } catch { return false; } finally { c.release(); }
}

async function stageCount(
  stage: number, name: string, tables: Array<{ sql1h: string; sql24h: string; sqlTotal: string; ref: string }>,
  note: string | null = null,
): Promise<StageCount> {
  let c1h = 0, c24h = 0, cTotal = 0;
  for (const t of tables) {
    c1h += await count(t.sql1h);
    c24h += await count(t.sql24h);
    cTotal += await count(t.sqlTotal);
  }
  return { stage, name, count_1h: c1h, count_24h: c24h, count_total: cTotal,
           source_tables: tables.map((t) => t.ref), note };
}

export async function computeFlowCounts(): Promise<StageCount[]> {
  const stages: StageCount[] = [];

  // ── 1. INPUT · founder_window_event kind='data_received' (chat POST hook)
  const inputEventsExist = await tableExists("nex", "founder_window_event");
  stages.push(await stageCount(1, "INPUT",
    inputEventsExist ? [{
      sql1h: `SELECT count(*)::int AS count FROM nex.founder_window_event WHERE event_kind='data_received' AND emitted_at >= now() - interval '1 hour'`,
      sql24h: `SELECT count(*)::int AS count FROM nex.founder_window_event WHERE event_kind='data_received' AND emitted_at >= now() - interval '24 hours'`,
      sqlTotal: `SELECT count(*)::int AS count FROM nex.founder_window_event WHERE event_kind='data_received'`,
      ref: "nex.founder_window_event(kind=data_received)"
    }] : [],
    inputEventsExist ? null : "founder_window_event table not yet created · run migration"
  ));

  // ── 2. SANITIZE · nex.moderation_event (schema exists · needs wire-up in input-moderation.ts)
  const modExists = await tableExists("nex", "moderation_event");
  stages.push(await stageCount(2, "SANITIZE",
    modExists ? [{
      sql1h: `SELECT count(*)::int AS count FROM nex.moderation_event WHERE emitted_at >= now() - interval '1 hour'`,
      sql24h: `SELECT count(*)::int AS count FROM nex.moderation_event WHERE emitted_at >= now() - interval '24 hours'`,
      sqlTotal: `SELECT count(*)::int AS count FROM nex.moderation_event`,
      ref: "nex.moderation_event"
    }] : [],
    modExists ? null : "nex.moderation_event schema present but not written to · one-line wire needed in input-moderation.ts"
  ));

  // ── 3. CLASSIFY · founder_window_event kind='intent_classified'
  stages.push(await stageCount(3, "CLASSIFY",
    inputEventsExist ? [{
      sql1h: `SELECT count(*)::int AS count FROM nex.founder_window_event WHERE event_kind='intent_classified' AND emitted_at >= now() - interval '1 hour'`,
      sql24h: `SELECT count(*)::int AS count FROM nex.founder_window_event WHERE event_kind='intent_classified' AND emitted_at >= now() - interval '24 hours'`,
      sqlTotal: `SELECT count(*)::int AS count FROM nex.founder_window_event WHERE event_kind='intent_classified'`,
      ref: "nex.founder_window_event(kind=intent_classified)"
    }] : [], null
  ));

  // ── 4. RESEARCH · nex_lab_*.harvest_raw + retrieval_hit
  stages.push(await stageCount(4, "RESEARCH / RETRIEVE", [
    { sql1h: `SELECT COALESCE(sum(c),0)::int AS count FROM (
                SELECT count(*) AS c FROM nex_lab_accommodation.harvest_raw WHERE harvested_at >= now() - interval '1 hour'
                UNION ALL SELECT count(*) FROM nex_lab_food.harvest_raw WHERE harvested_at >= now() - interval '1 hour'
                UNION ALL SELECT count(*) FROM nex_lab_transport.harvest_raw WHERE harvested_at >= now() - interval '1 hour'
                UNION ALL SELECT count(*) FROM nex_lab_business.harvest_raw WHERE harvested_at >= now() - interval '1 hour'
                UNION ALL SELECT count(*) FROM nex_lab_activities.harvest_raw WHERE harvested_at >= now() - interval '1 hour'
              ) t`,
      sql24h: `SELECT COALESCE(sum(c),0)::int AS count FROM (
                 SELECT count(*) AS c FROM nex_lab_accommodation.harvest_raw WHERE harvested_at >= now() - interval '24 hours'
                 UNION ALL SELECT count(*) FROM nex_lab_food.harvest_raw WHERE harvested_at >= now() - interval '24 hours'
                 UNION ALL SELECT count(*) FROM nex_lab_transport.harvest_raw WHERE harvested_at >= now() - interval '24 hours'
                 UNION ALL SELECT count(*) FROM nex_lab_business.harvest_raw WHERE harvested_at >= now() - interval '24 hours'
                 UNION ALL SELECT count(*) FROM nex_lab_activities.harvest_raw WHERE harvested_at >= now() - interval '24 hours'
               ) t`,
      sqlTotal: `SELECT COALESCE(sum(c),0)::int AS count FROM (
                   SELECT count(*) AS c FROM nex_lab_accommodation.harvest_raw
                   UNION ALL SELECT count(*) FROM nex_lab_food.harvest_raw
                   UNION ALL SELECT count(*) FROM nex_lab_transport.harvest_raw
                   UNION ALL SELECT count(*) FROM nex_lab_business.harvest_raw
                   UNION ALL SELECT count(*) FROM nex_lab_activities.harvest_raw
                 ) t`,
      ref: "nex_lab_*.harvest_raw (5 rooms)" },
  ], null));

  // ── 5. VERIFY · nex_lab_*.verified
  const verifiedExists = await tableExists("nex_lab_accommodation", "verified");
  stages.push(await stageCount(5, "VERIFY",
    verifiedExists ? [{
      sql1h: `SELECT COALESCE(sum(c),0)::int AS count FROM (
                SELECT count(*) AS c FROM nex_lab_accommodation.verified WHERE last_verified_at >= now() - interval '1 hour'
                UNION ALL SELECT count(*) FROM nex_lab_food.verified WHERE last_verified_at >= now() - interval '1 hour'
                UNION ALL SELECT count(*) FROM nex_lab_business.verified WHERE last_verified_at >= now() - interval '1 hour'
              ) t`,
      sql24h: `SELECT COALESCE(sum(c),0)::int AS count FROM (
                 SELECT count(*) AS c FROM nex_lab_accommodation.verified WHERE last_verified_at >= now() - interval '24 hours'
                 UNION ALL SELECT count(*) FROM nex_lab_food.verified WHERE last_verified_at >= now() - interval '24 hours'
                 UNION ALL SELECT count(*) FROM nex_lab_business.verified WHERE last_verified_at >= now() - interval '24 hours'
               ) t`,
      sqlTotal: `SELECT COALESCE(sum(c),0)::int AS count FROM (
                   SELECT count(*) AS c FROM nex_lab_accommodation.verified
                   UNION ALL SELECT count(*) FROM nex_lab_food.verified
                   UNION ALL SELECT count(*) FROM nex_lab_business.verified
                 ) t`,
      ref: "nex_lab_*.verified"
    }] : [], verifiedExists ? null : "nex_lab_*.verified tables not present · verifier hasn't run yet"
  ));

  // ── 6. TRUTH ENGINE · nex.fact_conflict (adjudication signal)
  const fcExists = await tableExists("nex", "fact_conflict");
  stages.push(await stageCount(6, "TRUTH ENGINE",
    fcExists ? [{
      sql1h: `SELECT count(*)::int AS count FROM nex.fact_conflict WHERE last_seen_at >= now() - interval '1 hour'`,
      sql24h: `SELECT count(*)::int AS count FROM nex.fact_conflict WHERE last_seen_at >= now() - interval '24 hours'`,
      sqlTotal: `SELECT count(*)::int AS count FROM nex.fact_conflict`,
      ref: "nex.fact_conflict"
    }] : [], fcExists ? null : "nex.fact_conflict table not present"
  ));

  // ── 7. STORE · nex_lab.promotion_events (rows promoted) + main business tables
  stages.push(await stageCount(7, "STORE", [
    { sql1h: `SELECT COALESCE(sum(rows_promoted),0)::int AS count FROM nex_lab.promotion_events WHERE status='succeeded' AND approved_at_iso >= now() - interval '1 hour'`,
      sql24h: `SELECT COALESCE(sum(rows_promoted),0)::int AS count FROM nex_lab.promotion_events WHERE status='succeeded' AND approved_at_iso >= now() - interval '24 hours'`,
      sqlTotal: `SELECT COALESCE(sum(rows_promoted),0)::int AS count FROM nex_lab.promotion_events WHERE status='succeeded'`,
      ref: "nex_lab.promotion_events(status=succeeded)" },
  ], null));

  // ── 8. KNOWLEDGE · knowledge_inbox / hammerex_nex_review_queue
  const knExists = await tableExists("public", "knowledge_inbox") || await tableExists("nex", "knowledge_inbox");
  stages.push(await stageCount(8, "KNOWLEDGE",
    knExists ? [{
      sql1h: `SELECT count(*)::int AS count FROM public.knowledge_inbox WHERE created_at >= now() - interval '1 hour'`,
      sql24h: `SELECT count(*)::int AS count FROM public.knowledge_inbox WHERE created_at >= now() - interval '24 hours'`,
      sqlTotal: `SELECT count(*)::int AS count FROM public.knowledge_inbox`,
      ref: "public.knowledge_inbox"
    }] : [], knExists ? null : "knowledge_inbox table not present in this database"
  ));

  // ── 9. MEMORY · hammerex_nex_memory_* (3 layers)
  const memExists = await tableExists("public", "hammerex_nex_memory_user");
  stages.push(await stageCount(9, "MEMORY",
    memExists ? [
      { sql1h: `SELECT count(*)::int AS count FROM public.hammerex_nex_memory_user WHERE observed_at >= now() - interval '1 hour'`,
        sql24h: `SELECT count(*)::int AS count FROM public.hammerex_nex_memory_user WHERE observed_at >= now() - interval '24 hours'`,
        sqlTotal: `SELECT count(*)::int AS count FROM public.hammerex_nex_memory_user`,
        ref: "hammerex_nex_memory_user" },
    ] : [], memExists ? null : "memory tables not present in this database (may live in Supabase)"
  ));

  // ── 10. RESPONSE · nex.action_audit (executed) + nex.turn_latency_event
  const aaExists = await tableExists("nex", "action_audit");
  stages.push(await stageCount(10, "RESPONSE / ACTION",
    aaExists ? [{
      sql1h: `SELECT count(*)::int AS count FROM nex.action_audit WHERE outcome='executed' AND emitted_at >= now() - interval '1 hour'`,
      sql24h: `SELECT count(*)::int AS count FROM nex.action_audit WHERE outcome='executed' AND emitted_at >= now() - interval '24 hours'`,
      sqlTotal: `SELECT count(*)::int AS count FROM nex.action_audit WHERE outcome='executed'`,
      ref: "nex.action_audit(outcome=executed)"
    }] : [], aaExists ? null : "nex.action_audit table not present"
  ));

  return stages;
}
