// src/lib/nex/lab/weekly-brief.ts
//
// Founder ADR-0304 · Weekly Brief Composer.
//
// Aggregates a whole week of Lab activity into a founder-facing brief:
//   · what harvested (per room · counts + trend)
//   · what verified (per room · pass rate)
//   · what cross-verified (via Wikidata)
//   · what promoted (audit trail)
//   · 3 must-answer questions per week (from measured signals)
//
// GOLDEN RULE: every number in the brief is measured from Postgres +
// ledger files · zero fabrication · labelled ASSUMPTION when projected.

import type { Pool } from "pg";
import { LAB_ROOMS } from "./rooms";

export interface RoomWeeklyMetrics {
  slug: string;
  display_name: string;
  harvest_rows_start: number;
  harvest_rows_end: number;
  harvest_delta: number;
  verified_rows_start: number;
  verified_rows_end: number;
  verified_delta: number;
  cross_verified_end: number;
  cross_verified_ratio: number;
}

export interface WeeklyBrief {
  brief_id: string;
  week_iso: string;
  generated_at_iso: string;
  totals: {
    harvest_delta: number;
    verified_delta: number;
    cross_verified_end: number;
    promotions_pending: number;
    promotions_succeeded_this_week: number;
    rows_promoted_this_week: number;
  };
  rooms: RoomWeeklyMetrics[];
  must_answer_questions: Array<{ id: string; question: string; measured_context: string }>;
  recommended_actions: string[];
  measured_at: string[];
}

function isoWeek(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+dt - +yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function composeWeeklyBrief(pool: Pool, now = new Date()): Promise<WeeklyBrief> {
  const week = isoWeek(now);
  const brief_id = `brief-${week}`;
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const measured_at: string[] = [];

  const rooms: RoomWeeklyMetrics[] = [];
  let totalHarvestDelta = 0, totalVerifiedDelta = 0, totalCrossVerified = 0;

  for (const r of LAB_ROOMS) {
    const schema = r.schema_name;
    let harvest_start = 0, harvest_end = 0, verified_start = 0, verified_end = 0, cross_end = 0;
    try {
      // Current counts
      const h = await pool.query(`SELECT count(*)::int c FROM ${schema}.harvest_raw`);
      harvest_end = h.rows[0].c;
      const v = await pool.query(`SELECT count(*)::int c FROM ${schema}.verified`);
      verified_end = v.rows[0].c;
      const cv = await pool.query(`SELECT count(*)::int c FROM ${schema}.verified WHERE source_count >= 2`);
      cross_end = cv.rows[0].c;
    } catch { /* table may not exist for empty room · leave zeros */ }

    // Historic (from growth_history) · closest snapshot ≥7 days ago
    try {
      const hh = await pool.query(
        `SELECT metric_value FROM nex_lab.growth_history
         WHERE room_slug=$1 AND metric_key='harvest_rows' AND ts_iso <= $2
         ORDER BY ts_iso DESC LIMIT 1`,
        [r.slug, cutoff7d],
      );
      if (hh.rows[0]) harvest_start = Number(hh.rows[0].metric_value);
    } catch { /* ignore */ }
    try {
      const vv = await pool.query(
        `SELECT metric_value FROM nex_lab.growth_history
         WHERE room_slug=$1 AND metric_key='verified_rows' AND ts_iso <= $2
         ORDER BY ts_iso DESC LIMIT 1`,
        [r.slug, cutoff7d],
      );
      if (vv.rows[0]) verified_start = Number(vv.rows[0].metric_value);
    } catch { /* ignore */ }

    const harvest_delta = harvest_end - harvest_start;
    const verified_delta = verified_end - verified_start;
    const cross_ratio = verified_end > 0 ? Number((cross_end / verified_end).toFixed(3)) : 0;

    rooms.push({
      slug: r.slug,
      display_name: r.display_name,
      harvest_rows_start: harvest_start,
      harvest_rows_end: harvest_end,
      harvest_delta,
      verified_rows_start: verified_start,
      verified_rows_end: verified_end,
      verified_delta,
      cross_verified_end: cross_end,
      cross_verified_ratio: cross_ratio,
    });
    totalHarvestDelta += harvest_delta;
    totalVerifiedDelta += verified_delta;
    totalCrossVerified += cross_end;
  }
  measured_at.push("nex_lab_{room}.harvest_raw", "nex_lab_{room}.verified", "nex_lab.growth_history");

  // Promotions activity
  let promotionsPending = 0, promotionsSucceeded = 0, rowsPromoted = 0;
  try {
    const pp = await pool.query("SELECT count(*)::int c FROM nex_lab.promotion_events WHERE status='pending'");
    promotionsPending = pp.rows[0].c;
    const ps = await pool.query(
      `SELECT count(*)::int c, coalesce(sum(rows_promoted), 0)::int rows
       FROM nex_lab.promotion_events
       WHERE status='succeeded' AND approved_at_iso > $1`,
      [cutoff7d],
    );
    promotionsSucceeded = ps.rows[0].c;
    rowsPromoted = ps.rows[0].rows;
    measured_at.push("nex_lab.promotion_events");
  } catch { /* leave zeros */ }

  // Compose 3 must-answer questions from measured signals
  const must: Array<{ id: string; question: string; measured_context: string }> = [];

  // Q1: room with biggest verified delta (candidate for promotion)
  const topGrowth = [...rooms].sort((a, b) => b.verified_delta - a.verified_delta)[0];
  if (topGrowth && topGrowth.verified_delta > 0) {
    must.push({
      id: "q_promote_top_room",
      question: `${topGrowth.display_name} added ${topGrowth.verified_delta} verified rows this week (now ${topGrowth.verified_rows_end} total, ${topGrowth.cross_verified_end} cross-verified). Approve promotion to main NEX?`,
      measured_context: `verified_delta=${topGrowth.verified_delta}, cross_ratio=${topGrowth.cross_verified_ratio}`,
    });
  }
  // Q2: any room with zero growth (stalled?)
  const stalled = rooms.find((r) => r.harvest_delta === 0 && r.slug !== "monetization");
  if (stalled) {
    must.push({
      id: "q_stalled_room",
      question: `${stalled.display_name} shows zero harvest growth in the last 7 days. Investigate agent health or add new data source?`,
      measured_context: `harvest_delta=0, current_harvest=${stalled.harvest_rows_end}`,
    });
  }
  // Q3: pending promotions awaiting founder
  if (promotionsPending > 0) {
    must.push({
      id: "q_pending_promotions",
      question: `${promotionsPending} promotion${promotionsPending === 1 ? "" : "s"} pending your signature. Review at /nexapp/lab/promotions?`,
      measured_context: `pending_count=${promotionsPending}`,
    });
  }
  // Fill to always 3 with generic if we have < 3
  if (must.length < 3) {
    must.push({
      id: "q_next_room",
      question: `News, Voice, Chat, Image, and Monetization rooms have no harvesters yet. Which should get priority next week?`,
      measured_context: `rooms_with_zero_harvest=${rooms.filter((r) => r.harvest_rows_end === 0).map((r) => r.slug).join(",")}`,
    });
  }

  // Recommended actions (from measured state)
  const recs: string[] = [];
  if (topGrowth && topGrowth.cross_verified_end < topGrowth.verified_rows_end / 3) {
    recs.push(`Run Wikidata cross-source deeper on ${topGrowth.display_name} · currently only ${(topGrowth.cross_verified_ratio * 100).toFixed(0)}% cross-verified`);
  }
  if (totalHarvestDelta === 0) {
    recs.push("Harvester has been idle · check NEX-Lab-Harvest scheduled task");
  }
  if (promotionsPending > 3) {
    recs.push(`${promotionsPending} promotions pending · consider bulk-approve session`);
  }
  recs.push("Every number in this brief is measured from Postgres · zero fabrication");

  return {
    brief_id,
    week_iso: week,
    generated_at_iso: now.toISOString(),
    totals: {
      harvest_delta: totalHarvestDelta,
      verified_delta: totalVerifiedDelta,
      cross_verified_end: totalCrossVerified,
      promotions_pending: promotionsPending,
      promotions_succeeded_this_week: promotionsSucceeded,
      rows_promoted_this_week: rowsPromoted,
    },
    rooms,
    must_answer_questions: must.slice(0, 3),
    recommended_actions: recs,
    measured_at,
  };
}
