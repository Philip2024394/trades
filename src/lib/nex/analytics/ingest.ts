// NEX Analytics · event ingest with incremental rollup increments
//
// One INSERT into nex.analytics_events + one UPSERT per active
// rollup scope (campaign, daily, monthly, country, provider, segment).
// Rollups are atomically incremented so concurrent ingest is safe.
//
// Rate columns (delivery_rate · open_rate · click_rate · ctor) are
// recomputed on every UPSERT so reads are constant-time.
//
// D6 · Optional async mode. When NEX_ANALYTICS_ROLLUP_ASYNC=1 is set,
// ingestEvent writes the raw event row synchronously (hot-path callers
// see fast completion) and enqueues one nex.analytics_rollup_queue
// row. The rollup + recompute work runs in the background worker at
// src/lib/nex/analytics/rollup-worker.ts, drained on cron-tick.
// Default (env unset or !== "1") preserves the pre-D6 synchronous
// behavior.

import { withClient } from "@/lib/nex/delivery/db";
import type { AnalyticsEvent, EventType } from "./types";
import { applyCanonicalEvent } from "@/lib/nex/compliance/engine";

// Column names on rollup tables that we increment per event type.
// unique_* columns are best-effort — first sighting of a
// (campaign · recipient · event_type) tuple counts as unique. Enforced
// via a small dedupe check when recipient_id is present.
const INCREMENTS: Record<EventType, string[]> = {
  queued:       ["sent"],
  delivered:    ["delivered"],
  deferred:     [],                                          // deferred = temporary block · doesn't move any counter
  opened:       ["opens"],
  clicked:      ["clicks"],
  bounced:      ["bounces"],
  complaint:    ["complaints"],
  unsubscribed: ["unsubscribes"],
  failed:       ["failed"],
  suppressed:   ["suppressed"],
};

// Which rollups a given event type touches (some tables don't need all events).
type RollupScope = "campaigns" | "daily" | "monthly" | "country" | "provider" | "segment";
const SCOPES_FOR: Record<EventType, RollupScope[]> = {
  queued:       ["campaigns","daily","monthly","country","provider","segment"],
  delivered:    ["campaigns","daily","monthly","country","provider","segment"],
  deferred:     ["provider"],
  opened:       ["campaigns","daily","monthly","country","provider","segment"],
  clicked:      ["campaigns","daily","monthly","country","provider","segment"],
  bounced:      ["campaigns","daily","monthly","country","provider","segment"],
  complaint:    ["campaigns","daily","monthly","provider"],
  unsubscribed: ["campaigns","daily","monthly","country","provider","segment"],
  failed:       ["campaigns","daily","monthly","provider"],
  suppressed:   ["campaigns","daily","monthly"],
};

export type IngestResult = { ok: true; event_id: string } | { ok: false; error: string };

/** D6 · true when the rollup work should be deferred to the background worker. */
export function isRollupAsync(): boolean {
  return process.env.NEX_ANALYTICS_ROLLUP_ASYNC === "1";
}

export async function ingestEvent(ev: AnalyticsEvent): Promise<IngestResult> {
  const r = await withClient(async (c) => {
    // Wave 3 · H4 · fail-closed activation gate for the async rollup path.
    // When NEX_ANALYTICS_ROLLUP_ASYNC=1 but migration 049 is missing, refuse
    // the whole event BEFORE any INSERT so the operator sees a clear
    // "migration 049 not applied" error instead of a cryptic 42P01 on the
    // downstream queue INSERT. When the flag is off, this is a no-op and
    // does not touch the 049 schema.
    // Lazy require avoids introducing a circular import between ingest.ts
    // (defines isRollupAsync) and rollup-gate.ts (imports isRollupAsync).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const gate = require("./rollup-gate") as typeof import("./rollup-gate");
    await gate.assertRollupAsyncReady(c);

    const insertRes = await c.query(
      `INSERT INTO nex.analytics_events
       (event_type, event_timestamp, campaign_id, recipient_id, segment_id, provider, country, domain,
        metadata, provider_message_id, user_agent, ip, link_url, latency_ms,
        conversion_value, revenue, attribution_window, journey_id, automation_id, experiment_id, variant_id)
       VALUES ($1, COALESCE($2::timestamptz, NOW()), $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING event_id`,
      [
        ev.event_type, ev.event_timestamp ?? null,
        ev.campaign_id ?? null, ev.recipient_id ?? null, ev.segment_id ?? null,
        ev.provider ?? null, ev.country ?? null, ev.domain ?? null,
        JSON.stringify(ev.metadata ?? {}),
        ev.provider_message_id ?? null, ev.user_agent ?? null, ev.ip ?? null,
        ev.link_url ?? null, ev.latency_ms ?? null,
        ev.conversion_value ?? null, ev.revenue ?? null, ev.attribution_window ?? null,
        ev.journey_id ?? null, ev.automation_id ?? null, ev.experiment_id ?? null, ev.variant_id ?? null,
      ],
    );
    const event_id = String((insertRes.rows[0] as { event_id: string }).event_id);

    if (isRollupAsync()) {
      // D6 · defer rollup work · rollup-worker will drain the queue on cron-tick.
      await c.query(
        `INSERT INTO nex.analytics_rollup_queue (event_id) VALUES ($1)`,
        [event_id],
      );
    } else {
      await applyRollupsForEvent(c, ev, event_id);
    }

    return event_id;
  });

  if (!r) return { ok: false, error: "storage_unreachable" };

  // Hand off to the Compliance Engine · one-way flow (doctrine Philip
  // 2026-08-08). Any error here is swallowed by the engine so analytics
  // ingest is never blocked by a compliance mutation failure.
  await applyCanonicalEvent(ev, r);

  return { ok: true, event_id: r };
}

// ── D6 · rollup work (extracted so the async worker can call the same code) ──
/** Run every rollup UPSERT + rate recompute for one already-inserted event.
 *  Called inline during ingest (sync mode) OR from rollup-worker (async mode). */
export async function applyRollupsForEvent(
  c: import("@/lib/nex/delivery/db").PgClientLike,
  ev: AnalyticsEvent,
  event_id: string,
): Promise<void> {
  const inc = INCREMENTS[ev.event_type] ?? [];
  const scopes = SCOPES_FOR[ev.event_type] ?? [];

  // Best-effort unique counter — check for prior same-type event by this recipient in this scope
  const isUniqueEligible = ev.recipient_id && (ev.event_type === "opened" || ev.event_type === "clicked");
  let firstTime = false;
  if (isUniqueEligible && ev.campaign_id) {
    const priorRes = await c.query(
      `SELECT 1 FROM nex.analytics_events
       WHERE campaign_id = $1 AND recipient_id = $2 AND event_type = $3 AND event_id <> $4
       LIMIT 1`,
      [ev.campaign_id, ev.recipient_id, ev.event_type, event_id],
    );
    firstTime = (priorRes.rows.length === 0);
  }
  const uniqueCol = ev.event_type === "opened" ? "unique_opens" : ev.event_type === "clicked" ? "unique_clicks" : null;
  const uniqueIncSql = (firstTime && uniqueCol) ? `, ${uniqueCol} = target.${uniqueCol} + 1` : "";

  for (const scope of scopes) {
    const cols = inc.map((c0) => `${c0} = target.${c0} + 1`).join(", ");
    const setClause = [cols, uniqueIncSql].filter(Boolean).join(" ");
    if (!setClause) continue;

    if (scope === "campaigns" && ev.campaign_id) {
      await upsertRollup(c, "nex.rollup_campaigns", "campaign_id", ev.campaign_id, inc, uniqueCol, firstTime, ev.event_timestamp);
    } else if (scope === "daily") {
      await upsertRollup(c, "nex.rollup_daily", "day", "DATE(COALESCE($1::timestamptz, NOW()))", inc, uniqueCol, firstTime, ev.event_timestamp, true);
    } else if (scope === "monthly") {
      await upsertRollup(c, "nex.rollup_monthly", "month", "DATE_TRUNC('month', COALESCE($1::timestamptz, NOW()))::date", inc, uniqueCol, firstTime, ev.event_timestamp, true);
    } else if (scope === "country" && ev.country) {
      await upsertRollup(c, "nex.rollup_country", "country", ev.country, inc, uniqueCol, firstTime, ev.event_timestamp);
    } else if (scope === "provider" && ev.provider) {
      await upsertRollup(c, "nex.rollup_provider", "provider", ev.provider, inc, uniqueCol, firstTime, ev.event_timestamp);
    } else if (scope === "segment" && ev.segment_id) {
      await upsertRollup(c, "nex.rollup_segment", "segment_id", ev.segment_id, inc, uniqueCol, firstTime, ev.event_timestamp);
    }
  }

  if (ev.campaign_id) await recomputeRates(c, "nex.rollup_campaigns", "campaign_id", ev.campaign_id);
  await recomputeRates(c, "nex.rollup_daily", "day", "DATE(COALESCE($$::timestamptz, NOW()))", ev.event_timestamp, true);
  await recomputeRates(c, "nex.rollup_monthly", "month", "DATE_TRUNC('month', COALESCE($$::timestamptz, NOW()))::date", ev.event_timestamp, true);
  if (ev.country)    await recomputeRates(c, "nex.rollup_country",  "country",  ev.country);
  if (ev.provider)   await recomputeRates(c, "nex.rollup_provider", "provider", ev.provider);
  if (ev.segment_id) await recomputeRates(c, "nex.rollup_segment",  "segment_id", ev.segment_id);
}

// ── Helpers ────────────────────────────────────────────────────────
async function upsertRollup(
  c: import("@/lib/nex/delivery/db").PgClientLike,
  table: string, keyCol: string, keyValueOrExpr: string,
  inc: string[], uniqueCol: string | null, firstTime: boolean,
  eventTimestamp: string | null | undefined,
  keyIsExpression = false,
): Promise<void> {
  const setPieces = inc.map((col) => `${col} = ${table.split(".")[1]}.${col} + 1`);
  if (uniqueCol && firstTime) setPieces.push(`${uniqueCol} = ${table.split(".")[1]}.${uniqueCol} + 1`);
  setPieces.push(`last_event_at = NOW()`);
  setPieces.push(`updated_at = NOW()`);

  const initialInc = Object.fromEntries(inc.map((c0) => [c0, 1]));
  if (uniqueCol && firstTime) initialInc[uniqueCol] = 1;

  const initCols = Object.keys(initialInc);
  const initVals = initCols.map((_, i) => `$${i + 2}`);

  if (keyIsExpression) {
    const cleanSet = setPieces.filter((s) => !s.includes("last_event_at")).join(", ");
    await c.query(
      `INSERT INTO ${table} (${keyCol}${initCols.length > 0 ? ", " + initCols.join(", ") : ""}, updated_at)
       VALUES (${keyValueOrExpr.replace("$1", "$1")}${initCols.length > 0 ? ", " + initCols.map((_, i) => `$${i + 2}`).join(", ") : ""}, NOW())
       ON CONFLICT (${keyCol}) DO UPDATE SET ${cleanSet}`,
      [eventTimestamp ?? null, ...initCols.map((k) => initialInc[k])],
    );
  } else {
    // Support last_event_at only on rollup_campaigns (which has that column)
    const hasLastEvent = table.endsWith("rollup_campaigns");
    const setFinal = hasLastEvent ? setPieces.join(", ") : setPieces.filter((s) => !s.includes("last_event_at")).join(", ");
    await c.query(
      `INSERT INTO ${table} (${keyCol}${initCols.length > 0 ? ", " + initCols.join(", ") : ""}${hasLastEvent ? ", first_event_at, last_event_at" : ""}, updated_at)
       VALUES ($1${initCols.length > 0 ? ", " + initVals.join(", ") : ""}${hasLastEvent ? ", NOW(), NOW()" : ""}, NOW())
       ON CONFLICT (${keyCol}) DO UPDATE SET ${setFinal}`,
      [keyValueOrExpr, ...initCols.map((k) => initialInc[k])],
    );
  }
}

async function recomputeRates(
  c: import("@/lib/nex/delivery/db").PgClientLike,
  table: string, keyCol: string, keyValueOrExpr: string,
  eventTimestamp?: string | null, keyIsExpression = false,
): Promise<void> {
  // sent-denominated rates use `sent` where present, else `delivered`
  const denomSent = "GREATEST(sent, 1)";
  const denomDelivered = "GREATEST(delivered, 1)";
  const denomOpens = "GREATEST(opens, 1)";
  const sql = `
    UPDATE ${table} SET
      delivery_rate = ROUND((delivered::numeric * 100) / ${denomSent}, 2),
      open_rate     = ROUND((opens::numeric     * 100) / ${denomDelivered}, 2),
      click_rate    = ROUND((clicks::numeric    * 100) / ${denomDelivered}, 2),
      ctor          = ROUND((clicks::numeric    * 100) / ${denomOpens}, 2)
    WHERE ${keyCol} = ${keyIsExpression ? keyValueOrExpr.replace("$$", "$1") : "$1"}
  `.replace(/\bctor\b\s*=\s*.*$/m, (match) => {
    // provider/country tables don't have ctor column · avoid updating it
    const hasCtor = table.endsWith("rollup_campaigns") || table.endsWith("rollup_daily") || table.endsWith("rollup_monthly") || table.endsWith("rollup_segment");
    return hasCtor ? match : match.replace(/,\s*ctor\s*=[^,]+/, "");
  });

  // Some rollup tables don't have all rate columns · avoid failing.
  const cleanedSql = hasNoUniqueCols(table) ? sql.replace(/,\s*ctor\s*=\s*[^\n]+/m, "") : sql;

  try {
    await c.query(cleanedSql.trim(), [keyIsExpression ? (eventTimestamp ?? null) : keyValueOrExpr]);
  } catch {
    // Some tables (rollup_country · rollup_provider) don't carry ctor.
    // Retry without ctor if the first pass fails on that column.
    const stripped = cleanedSql.replace(/,\s*ctor\s*=\s*[^\n]+/m, "").trim();
    if (stripped !== cleanedSql.trim()) {
      try { await c.query(stripped, [keyIsExpression ? (eventTimestamp ?? null) : keyValueOrExpr]); } catch { /* swallow */ }
    }
  }
}

function hasNoUniqueCols(table: string): boolean {
  return table.endsWith("rollup_country") || table.endsWith("rollup_provider");
}
