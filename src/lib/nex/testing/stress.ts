// NEX Stress Harness · Phase 4f.7
//
// Repeatable benchmark that measures 13 metrics (Philip 2026-08-08).
// One run = seed synthetic contacts → create test campaign → schedule
// → drain via tickBatch() → collect metrics → append to
// nex.benchmark_runs → clean synthetic data.
//
// Every synthetic contact uses email domain `@stress.nex.invalid` so
// cleanup is trivial and no real recipient can ever be affected.
//
// Runs deterministically in Simulation Mode with NEX_SIMULATOR_FAST_MODE
// so measurements reflect our own overhead (queue · DB · rendering ·
// analytics ingest · compliance engine) rather than the simulator's
// fake network delay.

import os from "os";
import { withClient } from "@/lib/nex/delivery/db";
import { tickBatch } from "@/lib/nex/delivery/worker";
import { limiterSnapshot, limiterConfig } from "@/lib/nex/delivery/limiter";
import { activeProvider } from "@/lib/nex/delivery/providers";
import { createCampaign, transitionCampaignStatus } from "@/lib/nex/campaigns/registry";
import { createSegment, archiveSegment } from "@/lib/nex/segments/registry";

const STRESS_EMAIL_DOMAIN = "stress.nex.invalid";

export type StressMetrics = {
  target_recipients: number;
  actual_recipients: number;
  wall_clock_ms: number;
  recipients_expanded_per_sec: number;
  messages_sent_per_sec: number;
  avg_send_latency_ms: number | null;
  p50_send_latency_ms: number | null;
  p95_send_latency_ms: number | null;
  p99_send_latency_ms: number | null;
  avg_queue_latency_ms: number | null;
  avg_db_query_latency_ms: number | null;                 // rough · not currently instrumented, honest null
  rate_limiter_max_saturation_pct: number;
  memory_growth_mb: number;
  event_ingestion_rate_per_sec: number;
  rollup_lag_max_ms: number | null;
  alert_latency_max_sec: number | null;                    // longest detection lag during run · null when no alerts fired
  worker_utilisation_pct: number;
};

export type StressRunResult = {
  ok: boolean;
  run_id: string | null;
  label: string;
  metrics: StressMetrics;
  environment: Record<string, unknown>;
  errors: string[];
};

export type StressOptions = {
  recipients?: number;                       // default 200 · caller can pass 1_000/10_000/100_000
  max_ticks?: number;                        // safety cap · default 5000
  label?: string | null;
  cleanup?: boolean;                         // default true
};

export async function runStress(opts: StressOptions = {}): Promise<StressRunResult> {
  const target = Math.max(10, Math.min(200_000, opts.recipients ?? 200));
  const maxTicks = Math.max(50, opts.max_ticks ?? 5_000);
  const label = (opts.label ?? "").trim() || `stress-${new Date().toISOString().slice(0, 19)}`;
  const errors: string[] = [];
  const label_tag = `stress:${label}`;
  const environment = collectEnvironment();
  const memBefore = process.memoryUsage().rss;

  // ── 1. Seed synthetic contacts ───────────────────────────────
  const seededIds: string[] = await seedContacts(target, label_tag);
  if (seededIds.length === 0) {
    return failResult(label, target, environment, ["seeded 0 contacts · storage unreachable"]);
  }

  // ── 2. Create test segment matching those contacts ──────────
  const segment = await createSegment({
    name: `${label_tag} segment`,
    description: `synthetic · auto-created by stress harness · label=${label_tag}`,
    filter: { search: STRESS_EMAIL_DOMAIN, consent_marketing: true },
    created_by: "stress-harness",
  });
  if (!segment) return failResult(label, target, environment, ["failed to create segment"]);

  // ── 3. Create + schedule test campaign ──────────────────────
  const campaign = await createCampaign({
    name: `${label_tag} campaign`,
    description: `Stress harness · ${target} recipients · label=${label_tag}`,
    campaign_type: "marketing",
    subject: "Stress test · {{name}}",
    preview_text: "Synthetic stress test — no real send.",
    body_html: `<p>Hi {{name}} · stress run ${label_tag}</p><p><a href="{{unsubscribe_link}}">unsubscribe</a></p>`,
    body_text: `Hi {{name}} · stress run ${label_tag} · unsub: {{unsubscribe_link}}`,
    sender_name: "NEX Stress",
    sender_from: `stress@${STRESS_EMAIL_DOMAIN}`,
    sender_reply_to: `noreply@${STRESS_EMAIL_DOMAIN}`,
    segment_ids: [segment.segment_id],
    created_by: "stress-harness",
  });
  if (!campaign) return failResult(label, target, environment, ["failed to create campaign"]);

  const startedAt = Date.now();

  try {
    // Move through the lifecycle
    await transitionCampaignStatus(campaign.campaign_id, "ready_for_review");
    await transitionCampaignStatus(campaign.campaign_id, "approved");
    await transitionCampaignStatus(campaign.campaign_id, "scheduled");

    // ── 4. Drain queue with tickBatch() ─────────────────────────
    let totalTicks = 0;
    let idleTicks = 0;
    while (totalTicks < maxTicks) {
      const results = await tickBatch(20);
      totalTicks += results.length;
      const anyPicked = results.some((r) => r.picked);
      if (!anyPicked) {
        idleTicks++;
        // Give the DB a moment to reflect state · check completion
        const done = await isCampaignDone(campaign.campaign_id);
        if (done || idleTicks > 5) break;
        await new Promise((r) => setTimeout(r, 50));
      } else {
        idleTicks = 0;
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  const wall_clock_ms = Date.now() - startedAt;
  const memAfter = process.memoryUsage().rss;

  // ── 5. Collect metrics from DB ──────────────────────────────
  const metrics = await collectMetrics({
    campaign_id: campaign.campaign_id,
    target_recipients: target,
    started_at_iso: new Date(startedAt).toISOString(),
    wall_clock_ms,
    mem_growth_bytes: memAfter - memBefore,
    label_tag,
  });

  // ── 6. Persist to benchmark_runs ────────────────────────────
  const insert = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.benchmark_runs (label, target_recipients, actual_recipients, wall_clock_ms, metrics, status, environment)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
       RETURNING run_id`,
      [label, target, metrics.actual_recipients, wall_clock_ms, JSON.stringify(metrics), errors.length > 0 ? "partial" : "complete", JSON.stringify(environment)],
    );
    return res.rows[0] ? String((res.rows[0] as { run_id: string }).run_id) : null;
  });

  // ── 7. Cleanup synthetic data ───────────────────────────────
  if (opts.cleanup !== false) {
    try { await cleanupContacts(seededIds); } catch (e) { errors.push(`cleanup contacts: ${e instanceof Error ? e.message : e}`); }
    try {
      // Cancel campaign so junction cleanup is clean · then archive
      await transitionCampaignStatus(campaign.campaign_id, "cancelled").catch(() => null);
      await transitionCampaignStatus(campaign.campaign_id, "archived").catch(() => null);
    } catch { /* swallow */ }
    try { await archiveSegment(segment.segment_id); } catch { /* swallow */ }
  }

  return { ok: errors.length === 0, run_id: insert, label, metrics, environment, errors };
}

// ── Contact seeding ───────────────────────────────────────────────
async function seedContacts(n: number, label_tag: string): Promise<string[]> {
  const CHUNK = 500;
  const ids: string[] = [];
  const countries = ["GB","US","AU","IE","CA","DE","FR","NL","IN","ID"];
  for (let base = 0; base < n; base += CHUNK) {
    const size = Math.min(CHUNK, n - base);
    await withClient(async (c) => {
      // Multi-value INSERT for speed
      const values: string[] = [];
      const params: unknown[] = [];
      for (let i = 0; i < size; i++) {
        const idx = base + i;
        const email = `stress+${label_tag.replace(/[^a-z0-9]/gi, "")}${idx}@${STRESS_EMAIL_DOMAIN}`;
        const country = countries[idx % countries.length];
        const p = params.length;
        params.push(`Stress Alex ${idx}`, email, email, country);
        values.push(`(gen_random_uuid(), $${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, TRUE, TRUE, FALSE, NOW(), NOW())`);
      }
      const res = await c.query(
        `INSERT INTO nex.contacts (contact_id, name, email, canonical_email, country, consent_marketing, consent_transactional, never_contact, first_seen_at, updated_at)
         VALUES ${values.join(", ")}
         ON CONFLICT DO NOTHING
         RETURNING contact_id`,
        params,
      );
      for (const row of res.rows) ids.push(String(row.contact_id));
      return null;
    });
  }
  return ids;
}

async function cleanupContacts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await withClient(async (c) => {
    // Mark as deleted rather than hard-delete · matches doctrine
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      const placeholders = chunk.map((_, j) => `$${j + 1}`).join(",");
      await c.query(`UPDATE nex.contacts SET deleted_at = NOW() WHERE contact_id = ANY(ARRAY[${placeholders}]::uuid[])`, chunk);
    }
    return null;
  });
}

async function isCampaignDone(campaign_id: string): Promise<boolean> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT status FROM nex.campaigns WHERE campaign_id = $1`, [campaign_id]);
    return res.rows[0]?.status as string | undefined;
  });
  return r === "completed" || r === "cancelled" || r === "archived";
}

// ── Metrics collection ────────────────────────────────────────────
async function collectMetrics(input: {
  campaign_id: string; target_recipients: number; started_at_iso: string;
  wall_clock_ms: number; mem_growth_bytes: number; label_tag: string;
}): Promise<StressMetrics> {
  const seconds = Math.max(0.001, input.wall_clock_ms / 1000);
  const zero: StressMetrics = {
    target_recipients: input.target_recipients, actual_recipients: 0,
    wall_clock_ms: input.wall_clock_ms,
    recipients_expanded_per_sec: 0, messages_sent_per_sec: 0,
    avg_send_latency_ms: null, p50_send_latency_ms: null, p95_send_latency_ms: null, p99_send_latency_ms: null,
    avg_queue_latency_ms: null, avg_db_query_latency_ms: null,
    rate_limiter_max_saturation_pct: 0, memory_growth_mb: +(input.mem_growth_bytes / 1_048_576).toFixed(2),
    event_ingestion_rate_per_sec: 0, rollup_lag_max_ms: null, alert_latency_max_sec: null,
    worker_utilisation_pct: 0,
  };
  const r = await withClient(async (c) => {
    const rcpRes = await c.query(
      `SELECT
         COUNT(*)::int AS total,
         SUM(CASE WHEN send_status = 'sent' THEN 1 ELSE 0 END)::int AS sent,
         AVG(latency_ms) FILTER (WHERE send_status = 'sent') AS avg_ms,
         percentile_disc(0.5)  WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE send_status = 'sent') AS p50,
         percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE send_status = 'sent') AS p95,
         percentile_disc(0.99) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE send_status = 'sent') AS p99
       FROM nex.campaign_recipients WHERE campaign_id = $1`,
      [input.campaign_id],
    );
    const rcp = rcpRes.rows[0] as { total: number; sent: number; avg_ms: number | null; p50: number | null; p95: number | null; p99: number | null };

    const queueLatRes = await c.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (started_at - scheduled_for)) * 1000)::int AS avg_ms
       FROM nex.delivery_jobs WHERE campaign_id = $1 AND started_at IS NOT NULL`,
      [input.campaign_id],
    );
    const avg_queue_latency_ms = Number((queueLatRes.rows[0] as { avg_ms: number | null })?.avg_ms ?? 0) || null;

    // Event ingestion rate during the run window
    const evRes = await c.query(
      `SELECT COUNT(*)::int AS n FROM nex.analytics_events
       WHERE ingested_at >= $1::timestamptz`,
      [input.started_at_iso],
    );
    const events = Number((evRes.rows[0] as { n: number })?.n ?? 0);

    // Rollup lag — measure using ingested_at (never in the future) instead of event_timestamp
    // (simulator emits opens/clicks with future timestamps by design, which would be negative lag).
    const rollupRes = await c.query(
      `SELECT GREATEST(0, MAX(EXTRACT(EPOCH FROM (r.updated_at - a.last_ingested)) * 1000))::int AS lag_ms
       FROM nex.rollup_campaigns r
       LEFT JOIN LATERAL (SELECT MAX(ingested_at) AS last_ingested FROM nex.analytics_events WHERE campaign_id = r.campaign_id) a ON true
       WHERE r.campaign_id = $1 AND a.last_ingested IS NOT NULL`,
      [input.campaign_id],
    );
    const rollup_lag_max_ms = Number((rollupRes.rows[0] as { lag_ms: number | null })?.lag_ms ?? 0);

    // Worker utilisation = (sum of attempt durations) / (workers * elapsed)
    const utilRes = await c.query(
      `SELECT SUM(latency_ms)::bigint AS total_ms, COUNT(DISTINCT worker_id)::int AS workers
       FROM nex.delivery_job_attempts
       WHERE completed_at >= $1::timestamptz`,
      [input.started_at_iso],
    );
    const total_ms = Number((utilRes.rows[0] as { total_ms: number | null })?.total_ms ?? 0);
    const workers  = Number((utilRes.rows[0] as { workers: number })?.workers ?? 0);
    const worker_utilisation_pct = workers > 0 && input.wall_clock_ms > 0
      ? Math.min(100, +((total_ms / (workers * input.wall_clock_ms)) * 100).toFixed(1))
      : 0;

    // Alert detection latency — check whether any alerts fired between start and now, and report max lag
    const alertRes = await c.query(
      `SELECT MAX(EXTRACT(EPOCH FROM (first_detected_at - $1::timestamptz)))::int AS lag_sec
       FROM nex.alerts WHERE first_detected_at >= $1::timestamptz`,
      [input.started_at_iso],
    );
    const alert_latency_max_sec = Number((alertRes.rows[0] as { lag_sec: number | null })?.lag_sec ?? 0) || null;

    return { rcp, avg_queue_latency_ms, events, rollup_lag_max_ms, worker_utilisation_pct, alert_latency_max_sec };
  });

  if (!r) return zero;

  const limiter_max_sat = maxLimiterSaturation();
  const actual = r.rcp.total;
  const sent = r.rcp.sent;

  return {
    target_recipients: input.target_recipients,
    actual_recipients: actual,
    wall_clock_ms: input.wall_clock_ms,
    recipients_expanded_per_sec: +(actual / seconds).toFixed(1),
    messages_sent_per_sec:       +(sent   / seconds).toFixed(1),
    avg_send_latency_ms: r.rcp.avg_ms !== null ? Math.round(Number(r.rcp.avg_ms)) : null,
    p50_send_latency_ms: r.rcp.p50 !== null ? Number(r.rcp.p50) : null,
    p95_send_latency_ms: r.rcp.p95 !== null ? Number(r.rcp.p95) : null,
    p99_send_latency_ms: r.rcp.p99 !== null ? Number(r.rcp.p99) : null,
    avg_queue_latency_ms: r.avg_queue_latency_ms,
    avg_db_query_latency_ms: null,             // honest null · not instrumented at query level
    rate_limiter_max_saturation_pct: limiter_max_sat,
    memory_growth_mb: +(input.mem_growth_bytes / 1_048_576).toFixed(2),
    event_ingestion_rate_per_sec: +(r.events / seconds).toFixed(1),
    rollup_lag_max_ms: r.rollup_lag_max_ms,
    alert_latency_max_sec: r.alert_latency_max_sec,
    worker_utilisation_pct: r.worker_utilisation_pct,
  };
}

function maxLimiterSaturation(): number {
  const lc = limiterConfig();
  const ls = limiterSnapshot();
  let max = 0;
  for (const b of ls) {
    const cap = b.per_sec * lc.burst_multiplier;
    const pct = cap > 0 ? Math.round((1 - b.tokens / cap) * 100) : 0;
    if (pct > max) max = pct;
  }
  return max;
}

function collectEnvironment(): Record<string, unknown> {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu_count: os.cpus().length,
    hostname: os.hostname(),
    active_provider: activeProvider().id,
    simulator_fast_mode: (process.env.NEX_SIMULATOR_FAST_MODE ?? "false"),
    global_per_sec: process.env.NEX_DELIVERY_GLOBAL_PER_SEC ?? 60,
    provider_per_sec: process.env.NEX_DELIVERY_PROVIDER_PER_SEC ?? 30,
    domain_per_sec: process.env.NEX_DELIVERY_DOMAIN_PER_SEC ?? 10,
  };
}

function failResult(label: string, target: number, env: Record<string, unknown>, errors: string[]): StressRunResult {
  return {
    ok: false, run_id: null, label,
    metrics: {
      target_recipients: target, actual_recipients: 0, wall_clock_ms: 0,
      recipients_expanded_per_sec: 0, messages_sent_per_sec: 0,
      avg_send_latency_ms: null, p50_send_latency_ms: null, p95_send_latency_ms: null, p99_send_latency_ms: null,
      avg_queue_latency_ms: null, avg_db_query_latency_ms: null,
      rate_limiter_max_saturation_pct: 0, memory_growth_mb: 0,
      event_ingestion_rate_per_sec: 0, rollup_lag_max_ms: null, alert_latency_max_sec: null,
      worker_utilisation_pct: 0,
    },
    environment: env, errors,
  };
}

// ── Read helpers ──────────────────────────────────────────────────
export async function listRecentBenchmarks(limit = 25): Promise<Array<Record<string, unknown>>> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.benchmark_runs ORDER BY ran_at DESC LIMIT ${Math.max(1, Math.min(200, limit))}`);
    return res.rows;
  });
  return r ?? [];
}
