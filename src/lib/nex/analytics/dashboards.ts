// NEX Analytics · dashboard read helpers
//
// Executive KPIs · trend series · campaign funnel · country/domain
// splits · segment engagement scoring. Reads from rollup tables
// (constant time) with `analytics_events` used only for timeline series.

import { withClient } from "@/lib/nex/delivery/db";

export type KpiTile = { key: string; label: string; value: number | string; hint?: string };

export type ExecutiveDashboard = {
  today: {
    campaigns: number;
    sent: number;
    delivery_rate: number | null;
    open_rate: number | null;
    click_rate: number | null;
    bounce_rate: number | null;
    unsubscribe_rate: number | null;
  };
  live: {
    active_workers: number;
    queue_depth: number;
    dead_letter: number;
    next_scheduled_at: string | null;
  };
  latency: {
    avg_send_ms: number | null;
    avg_queue_wait_ms: number | null;
  };
  trends: {
    emails_per_hour: Array<{ hour: string; sent: number; opens: number; clicks: number }>;
    daily: Array<{ day: string; sent: number; delivered: number; opens: number; clicks: number; bounces: number; unsubscribes: number }>;
    queue_depth: Array<{ minute: string; depth: number }>;
    delivery_latency: Array<{ hour: string; avg_ms: number }>;
  };
};

export async function executiveDashboard(): Promise<ExecutiveDashboard> {
  const r = await withClient(async (c) => {
    // TODAY (UTC day for consistency)
    const today = new Date().toISOString().slice(0, 10);
    const todayRes = await c.query(
      `SELECT sent, delivered, opens, clicks, bounces, unsubscribes, delivery_rate, open_rate, click_rate
       FROM nex.rollup_daily WHERE day = $1`, [today],
    );
    const t = todayRes.rows[0] ?? { sent: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0, unsubscribes: 0 };
    const campaignsTodayRes = await c.query(
      `SELECT COUNT(DISTINCT campaign_id)::int AS n
       FROM nex.analytics_events
       WHERE event_timestamp >= (NOW()::date) AND event_timestamp < (NOW()::date + INTERVAL '1 day')`,
    );
    const campaigns_today = Number((campaignsTodayRes.rows[0] as { n: number })?.n ?? 0);

    // LIVE (from delivery engine)
    const liveRes = await c.query(
      `SELECT
         (SELECT COUNT(*)::int FROM nex.delivery_workers WHERE last_seen_at > NOW() - INTERVAL '2 minutes') AS live_workers,
         (SELECT COUNT(*)::int FROM nex.delivery_jobs WHERE status IN ('pending','running')) AS queue_depth,
         (SELECT COUNT(*)::int FROM nex.delivery_jobs WHERE status = 'dead_letter') AS dead_letter,
         (SELECT MIN(scheduled_for) FROM nex.delivery_jobs WHERE status = 'pending') AS next_scheduled_at`,
    );
    const live = liveRes.rows[0] ?? { live_workers: 0, queue_depth: 0, dead_letter: 0, next_scheduled_at: null };

    // LATENCY (last 24h)
    const latRes = await c.query(
      `SELECT
         AVG(latency_ms)::int AS avg_send_ms
       FROM nex.analytics_events
       WHERE event_type = 'delivered' AND ingested_at > NOW() - INTERVAL '24 hours'`,
    );
    const avg_send_ms = Number((latRes.rows[0] as { avg_send_ms: number | null })?.avg_send_ms ?? 0) || null;

    const queueLatRes = await c.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (started_at - scheduled_for)) * 1000)::int AS avg_ms
       FROM nex.delivery_jobs
       WHERE started_at IS NOT NULL AND scheduled_for IS NOT NULL AND started_at > NOW() - INTERVAL '24 hours'`,
    );
    const avg_queue_wait_ms = Number((queueLatRes.rows[0] as { avg_ms: number | null })?.avg_ms ?? 0) || null;

    // TRENDS · emails per hour (last 24h)
    const perHourRes = await c.query(
      `SELECT
         date_trunc('hour', event_timestamp)::text AS hour,
         SUM(CASE WHEN event_type = 'queued'    THEN 1 ELSE 0 END)::int AS sent,
         SUM(CASE WHEN event_type = 'opened'    THEN 1 ELSE 0 END)::int AS opens,
         SUM(CASE WHEN event_type = 'clicked'   THEN 1 ELSE 0 END)::int AS clicks
       FROM nex.analytics_events
       WHERE event_timestamp > NOW() - INTERVAL '24 hours'
       GROUP BY 1 ORDER BY 1 ASC`,
    );

    // TRENDS · daily (last 30d)
    const dailyRes = await c.query(
      `SELECT day::text AS day, sent, delivered, opens, clicks, bounces, unsubscribes
       FROM nex.rollup_daily WHERE day > CURRENT_DATE - INTERVAL '30 days' ORDER BY day ASC`,
    );

    // TRENDS · queue depth (last 60 min sampled by rounding job snapshots · MVP: current depth only)
    const queueSeriesRes = await c.query(
      `SELECT date_trunc('minute', updated_at)::text AS minute,
              COUNT(*) FILTER (WHERE status IN ('pending','running'))::int AS depth
       FROM nex.delivery_jobs
       WHERE updated_at > NOW() - INTERVAL '60 minutes'
       GROUP BY 1 ORDER BY 1 ASC`,
    );

    // TRENDS · delivery latency per hour
    const latPerHourRes = await c.query(
      `SELECT date_trunc('hour', event_timestamp)::text AS hour, AVG(latency_ms)::int AS avg_ms
       FROM nex.analytics_events
       WHERE event_type = 'delivered' AND latency_ms IS NOT NULL AND event_timestamp > NOW() - INTERVAL '24 hours'
       GROUP BY 1 ORDER BY 1 ASC`,
    );

    const sent = Number(t.sent ?? 0);
    const delivered = Number(t.delivered ?? 0);
    const bounces = Number(t.bounces ?? 0);
    const unsubscribes = Number(t.unsubscribes ?? 0);
    const opens = Number(t.opens ?? 0);
    const clicks = Number(t.clicks ?? 0);

    const denom = (n: number) => n > 0 ? n : null;

    return {
      today: {
        campaigns: campaigns_today,
        sent,
        delivery_rate: denom(sent)      ? Math.round((delivered / sent)     * 10000) / 100 : null,
        open_rate:     denom(delivered) ? Math.round((opens    / delivered) * 10000) / 100 : null,
        click_rate:    denom(delivered) ? Math.round((clicks   / delivered) * 10000) / 100 : null,
        bounce_rate:   denom(sent)      ? Math.round((bounces  / sent)      * 10000) / 100 : null,
        unsubscribe_rate: denom(delivered) ? Math.round((unsubscribes / delivered) * 10000) / 100 : null,
      },
      live: {
        active_workers: Number(live.live_workers ?? 0),
        queue_depth: Number(live.queue_depth ?? 0),
        dead_letter: Number(live.dead_letter ?? 0),
        next_scheduled_at: (live.next_scheduled_at as string | null) ?? null,
      },
      latency: {
        avg_send_ms,
        avg_queue_wait_ms,
      },
      trends: {
        emails_per_hour: perHourRes.rows.map((r0) => ({ hour: String(r0.hour), sent: Number(r0.sent), opens: Number(r0.opens), clicks: Number(r0.clicks) })),
        daily: dailyRes.rows.map((r0) => ({ day: String(r0.day).slice(0, 10), sent: Number(r0.sent), delivered: Number(r0.delivered), opens: Number(r0.opens), clicks: Number(r0.clicks), bounces: Number(r0.bounces), unsubscribes: Number(r0.unsubscribes) })),
        queue_depth: queueSeriesRes.rows.map((r0) => ({ minute: String(r0.minute), depth: Number(r0.depth) })),
        delivery_latency: latPerHourRes.rows.map((r0) => ({ hour: String(r0.hour), avg_ms: Number(r0.avg_ms) })),
      },
    };
  });

  return r ?? {
    today: { campaigns: 0, sent: 0, delivery_rate: null, open_rate: null, click_rate: null, bounce_rate: null, unsubscribe_rate: null },
    live: { active_workers: 0, queue_depth: 0, dead_letter: 0, next_scheduled_at: null },
    latency: { avg_send_ms: null, avg_queue_wait_ms: null },
    trends: { emails_per_hour: [], daily: [], queue_depth: [], delivery_latency: [] },
  };
}

// ── Per-campaign analytics ────────────────────────────────────────
export type CampaignAnalytics = {
  campaign_id: string;
  totals: Record<string, number | null>;
  funnel: { queued: number; delivered: number; opened: number; clicked: number };
  country_split: Array<{ country: string | null; sent: number; delivered: number; opens: number; clicks: number }>;
  domain_split:  Array<{ domain:  string | null; sent: number; delivered: number; opens: number; clicks: number }>;
  device_split:  Array<{ device: string; count: number }>;
  timeline: Array<{ hour: string; delivered: number; opens: number; clicks: number; bounces: number; unsubscribes: number }>;
};

export async function campaignAnalytics(campaign_id: string): Promise<CampaignAnalytics | null> {
  const r = await withClient(async (c) => {
    const totalsRes = await c.query(
      `SELECT sent, delivered, opens, unique_opens, clicks, unique_clicks, bounces, complaints, unsubscribes, failed, suppressed,
              delivery_rate, open_rate, click_rate, ctor
       FROM nex.rollup_campaigns WHERE campaign_id = $1`, [campaign_id],
    );
    if (totalsRes.rows.length === 0) return null;
    const totals = totalsRes.rows[0] as Record<string, number | null>;

    const funnel = {
      queued:    Number(totals.sent ?? 0),
      delivered: Number(totals.delivered ?? 0),
      opened:    Number(totals.unique_opens ?? totals.opens ?? 0),
      clicked:   Number(totals.unique_clicks ?? totals.clicks ?? 0),
    };

    const countryRes = await c.query(
      `SELECT country,
              SUM(CASE WHEN event_type = 'queued'   THEN 1 ELSE 0 END)::int AS sent,
              SUM(CASE WHEN event_type = 'delivered' THEN 1 ELSE 0 END)::int AS delivered,
              SUM(CASE WHEN event_type = 'opened'    THEN 1 ELSE 0 END)::int AS opens,
              SUM(CASE WHEN event_type = 'clicked'   THEN 1 ELSE 0 END)::int AS clicks
       FROM nex.analytics_events WHERE campaign_id = $1
       GROUP BY country ORDER BY delivered DESC NULLS LAST LIMIT 15`, [campaign_id],
    );

    const domainRes = await c.query(
      `SELECT domain,
              SUM(CASE WHEN event_type = 'queued'   THEN 1 ELSE 0 END)::int AS sent,
              SUM(CASE WHEN event_type = 'delivered' THEN 1 ELSE 0 END)::int AS delivered,
              SUM(CASE WHEN event_type = 'opened'    THEN 1 ELSE 0 END)::int AS opens,
              SUM(CASE WHEN event_type = 'clicked'   THEN 1 ELSE 0 END)::int AS clicks
       FROM nex.analytics_events WHERE campaign_id = $1
       GROUP BY domain ORDER BY delivered DESC NULLS LAST LIMIT 15`, [campaign_id],
    );

    const deviceRes = await c.query(
      `SELECT
         CASE
           WHEN LOWER(COALESCE(user_agent,'')) LIKE '%iphone%'      THEN 'iPhone'
           WHEN LOWER(COALESCE(user_agent,'')) LIKE '%android%'     THEN 'Android'
           WHEN LOWER(COALESCE(user_agent,'')) LIKE '%gmail%'       THEN 'Gmail Web'
           WHEN LOWER(COALESCE(user_agent,'')) LIKE '%outlook%'     THEN 'Outlook'
           WHEN LOWER(COALESCE(user_agent,'')) LIKE '%apple%'       THEN 'Apple Mail'
           WHEN LOWER(COALESCE(user_agent,'')) LIKE '%yahoo%'       THEN 'Yahoo'
           WHEN user_agent IS NOT NULL                              THEN 'Other'
           ELSE 'Unknown'
         END AS device,
         COUNT(*)::int AS count
       FROM nex.analytics_events
       WHERE campaign_id = $1 AND event_type IN ('opened','clicked')
       GROUP BY 1 ORDER BY count DESC`, [campaign_id],
    );

    const timelineRes = await c.query(
      `SELECT date_trunc('hour', event_timestamp)::text AS hour,
              SUM(CASE WHEN event_type = 'delivered'    THEN 1 ELSE 0 END)::int AS delivered,
              SUM(CASE WHEN event_type = 'opened'       THEN 1 ELSE 0 END)::int AS opens,
              SUM(CASE WHEN event_type = 'clicked'      THEN 1 ELSE 0 END)::int AS clicks,
              SUM(CASE WHEN event_type = 'bounced'      THEN 1 ELSE 0 END)::int AS bounces,
              SUM(CASE WHEN event_type = 'unsubscribed' THEN 1 ELSE 0 END)::int AS unsubscribes
       FROM nex.analytics_events
       WHERE campaign_id = $1
       GROUP BY 1 ORDER BY 1 ASC`, [campaign_id],
    );

    return {
      campaign_id,
      totals,
      funnel,
      country_split: countryRes.rows.map((r0) => ({ country: (r0.country as string | null) ?? null, sent: Number(r0.sent), delivered: Number(r0.delivered), opens: Number(r0.opens), clicks: Number(r0.clicks) })),
      domain_split:  domainRes.rows.map((r0)  => ({ domain:  (r0.domain  as string | null) ?? null, sent: Number(r0.sent), delivered: Number(r0.delivered), opens: Number(r0.opens), clicks: Number(r0.clicks) })),
      device_split:  deviceRes.rows.map((r0)  => ({ device:  String(r0.device), count: Number(r0.count) })),
      timeline: timelineRes.rows.map((r0) => ({ hour: String(r0.hour), delivered: Number(r0.delivered), opens: Number(r0.opens), clicks: Number(r0.clicks), bounces: Number(r0.bounces), unsubscribes: Number(r0.unsubscribes) })),
    };
  });
  return r ?? null;
}

// ── Segment intelligence ──────────────────────────────────────────
export type SegmentIntelligence = {
  segment_id: string;
  totals: Record<string, number | null>;
  best_hour_utc: number | null;
  best_weekday: number | null;
  growth_last_30d: number;
  unsub_trend_last_30d: Array<{ day: string; count: number }>;
};

export async function segmentIntelligence(segment_id: string): Promise<SegmentIntelligence | null> {
  const r = await withClient(async (c) => {
    const totalsRes = await c.query(
      `SELECT sent, delivered, opens, unique_opens, clicks, unique_clicks, bounces, unsubscribes,
              delivery_rate, open_rate, click_rate, engagement_score, best_hour_utc, best_weekday, campaigns_used_in
       FROM nex.rollup_segment WHERE segment_id = $1`, [segment_id],
    );
    // If nothing yet, still return zeroes.
    const totals = (totalsRes.rows[0] ?? {}) as Record<string, number | null>;

    // Compute best_hour + best_weekday from open events
    const hourRes = await c.query(
      `SELECT EXTRACT(HOUR FROM event_timestamp)::int AS h, COUNT(*)::int AS n
       FROM nex.analytics_events
       WHERE segment_id = $1 AND event_type = 'opened'
       GROUP BY 1 ORDER BY n DESC LIMIT 1`, [segment_id],
    );
    const dayRes = await c.query(
      `SELECT EXTRACT(DOW FROM event_timestamp)::int AS d, COUNT(*)::int AS n
       FROM nex.analytics_events
       WHERE segment_id = $1 AND event_type = 'opened'
       GROUP BY 1 ORDER BY n DESC LIMIT 1`, [segment_id],
    );
    const growthRes = await c.query(
      `SELECT COUNT(*)::int AS n FROM nex.campaign_recipients
       WHERE created_at > NOW() - INTERVAL '30 days' AND campaign_id IN (
         SELECT campaign_id FROM nex.campaign_segments WHERE segment_id = $1
       )`, [segment_id],
    );
    const unsubRes = await c.query(
      `SELECT date_trunc('day', event_timestamp)::text AS day, COUNT(*)::int AS count
       FROM nex.analytics_events
       WHERE segment_id = $1 AND event_type = 'unsubscribed' AND event_timestamp > NOW() - INTERVAL '30 days'
       GROUP BY 1 ORDER BY 1 ASC`, [segment_id],
    );

    return {
      segment_id,
      totals,
      best_hour_utc: hourRes.rows[0] ? Number(hourRes.rows[0].h) : null,
      best_weekday:  dayRes.rows[0]  ? Number(dayRes.rows[0].d)  : null,
      growth_last_30d: Number((growthRes.rows[0] as { n: number }).n),
      unsub_trend_last_30d: unsubRes.rows.map((r0) => ({ day: String(r0.day).slice(0, 10), count: Number(r0.count) })),
    };
  });
  return r ?? null;
}
