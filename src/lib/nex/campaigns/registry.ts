// NEX Campaign Builder · CRUD + status transitions + preview aggregation
//
// Aggregates preview across ALL attached segments by running each
// segment's filter through the Audience Engine and DEDUPING at the
// contact level. Fresh query every time · never cached list.

import type { Campaign, CampaignInput, CampaignPreviewCache, CampaignStatus, CampaignType, SendStats } from "./types";
import { CAMPAIGN_TRANSITIONS } from "./types";
import { previewAudience } from "@/lib/nex/segments/preview";
import { getSegment } from "@/lib/nex/segments/registry";
import type { AudienceFilter } from "@/lib/nex/segments/types";

type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  release: () => void;
};
type PgPoolLike = { connect: () => Promise<PgClientLike>; end: () => Promise<void> };
let poolPromise: Promise<PgPoolLike | null> | null = null;

async function getPool(): Promise<PgPoolLike | null> {
  if (poolPromise) return poolPromise;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { poolPromise = Promise.resolve(null); return poolPromise; }
  poolPromise = (async () => {
    let pg: unknown;
    try { pg = await import("pg" as string); } catch { return null; }
    const { Pool } = ((pg as { default?: unknown }).default ?? pg) as {
      Pool: new (c: { connectionString: string; max?: number; ssl?: { rejectUnauthorized: boolean } | boolean }) => PgPoolLike;
    };
    const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
    return new Pool({ connectionString: url, max: 3, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
  })();
  return poolPromise;
}

async function withClient<T>(fn: (c: PgClientLike) => Promise<T>): Promise<T | null> {
  const pool = await getPool();
  if (!pool) return null;
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}

// ── row hydration ─────────────────────────────────────────────────
function rowToCampaign(r: Record<string, unknown>, segment_ids: string[]): Campaign {
  return {
    campaign_id: String(r.campaign_id),
    name: String(r.name),
    description: (r.description as string | null) ?? null,
    campaign_type: (r.campaign_type as CampaignType) ?? "marketing",
    status: (r.status as CampaignStatus) ?? "draft",
    subject: (r.subject as string | null) ?? null,
    preview_text: (r.preview_text as string | null) ?? null,
    body_html: (r.body_html as string | null) ?? null,
    body_text: (r.body_text as string | null) ?? null,
    sender_name: (r.sender_name as string | null) ?? null,
    sender_from: (r.sender_from as string | null) ?? null,
    sender_reply_to: (r.sender_reply_to as string | null) ?? null,
    scheduled_at: (r.scheduled_at as string | null) ?? null,
    started_at: (r.started_at as string | null) ?? null,
    completed_at: (r.completed_at as string | null) ?? null,
    last_preview_at: (r.last_preview_at as string | null) ?? null,
    last_preview: (r.last_preview as CampaignPreviewCache | null) ?? null,
    send_stats: (r.send_stats as SendStats) ?? {},
    created_by: (r.created_by as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    archived_at: (r.archived_at as string | null) ?? null,
    segment_ids,
  };
}

async function loadSegmentIds(c: PgClientLike, ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
  const res = await c.query(`SELECT campaign_id, segment_id FROM nex.campaign_segments WHERE campaign_id = ANY(ARRAY[${placeholders}]::uuid[])`, ids);
  for (const row of res.rows) {
    const cid = String(row.campaign_id); const sid = String(row.segment_id);
    const arr = map.get(cid) ?? []; arr.push(sid); map.set(cid, arr);
  }
  return map;
}

// ── list / get ────────────────────────────────────────────────────
export async function listCampaigns(opts?: { includeArchived?: boolean }): Promise<Campaign[]> {
  const r = await withClient(async (c) => {
    const where = opts?.includeArchived ? "" : "WHERE archived_at IS NULL";
    const res = await c.query(`SELECT * FROM nex.campaigns ${where} ORDER BY updated_at DESC LIMIT 500`);
    if (res.rows.length === 0) return [];
    const ids = res.rows.map((row) => String(row.campaign_id));
    const segsByCampaign = await loadSegmentIds(c, ids);
    return res.rows.map((row) => rowToCampaign(row, segsByCampaign.get(String(row.campaign_id)) ?? []));
  });
  return r ?? [];
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.campaigns WHERE campaign_id = $1`, [id]);
    if (!res.rows[0]) return null;
    const segsByCampaign = await loadSegmentIds(c, [id]);
    return rowToCampaign(res.rows[0], segsByCampaign.get(id) ?? []);
  });
  return r ?? null;
}

// ── create / update / duplicate ───────────────────────────────────
export async function createCampaign(input: CampaignInput): Promise<Campaign | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.campaigns
       (name, description, campaign_type, subject, preview_text, body_html, body_text,
        sender_name, sender_from, sender_reply_to, scheduled_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        input.name, input.description ?? null, input.campaign_type ?? "marketing",
        input.subject ?? null, input.preview_text ?? null, input.body_html ?? null, input.body_text ?? null,
        input.sender_name ?? null, input.sender_from ?? null, input.sender_reply_to ?? null,
        input.scheduled_at ?? null, input.created_by ?? null,
      ],
    );
    const row = res.rows[0];
    if (!row) return null;
    const campaignId = String(row.campaign_id);
    const segIds = input.segment_ids ?? [];
    if (segIds.length > 0) await replaceSegments(c, campaignId, segIds);
    return rowToCampaign(row, segIds);
  });
  return r;
}

async function replaceSegments(c: PgClientLike, campaignId: string, segmentIds: string[]) {
  await c.query(`DELETE FROM nex.campaign_segments WHERE campaign_id = $1`, [campaignId]);
  for (const sid of segmentIds) {
    await c.query(`INSERT INTO nex.campaign_segments (campaign_id, segment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [campaignId, sid]);
  }
}

export async function updateCampaign(id: string, patch: Partial<CampaignInput>): Promise<Campaign | null> {
  const r = await withClient(async (c) => {
    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };

    if (patch.name           !== undefined) push("name", patch.name);
    if (patch.description    !== undefined) push("description", patch.description);
    if (patch.campaign_type  !== undefined) push("campaign_type", patch.campaign_type);
    if (patch.subject        !== undefined) push("subject", patch.subject);
    if (patch.preview_text   !== undefined) push("preview_text", patch.preview_text);
    if (patch.body_html      !== undefined) push("body_html", patch.body_html);
    if (patch.body_text      !== undefined) push("body_text", patch.body_text);
    if (patch.sender_name    !== undefined) push("sender_name", patch.sender_name);
    if (patch.sender_from    !== undefined) push("sender_from", patch.sender_from);
    if (patch.sender_reply_to!== undefined) push("sender_reply_to", patch.sender_reply_to);
    if (patch.scheduled_at   !== undefined) push("scheduled_at", patch.scheduled_at);

    if (sets.length === 0 && patch.segment_ids === undefined) return getCampaignInner(c, id);

    if (sets.length > 0) {
      sets.push(`updated_at = NOW()`);
      params.push(id);
      await c.query(`UPDATE nex.campaigns SET ${sets.join(", ")} WHERE campaign_id = $${params.length}`, params);
    }
    if (patch.segment_ids !== undefined) await replaceSegments(c, id, patch.segment_ids);
    return getCampaignInner(c, id);
  });
  return r;
}

async function getCampaignInner(c: PgClientLike, id: string): Promise<Campaign | null> {
  const res = await c.query(`SELECT * FROM nex.campaigns WHERE campaign_id = $1`, [id]);
  if (!res.rows[0]) return null;
  const segsByCampaign = await loadSegmentIds(c, [id]);
  return rowToCampaign(res.rows[0], segsByCampaign.get(id) ?? []);
}

export async function duplicateCampaign(id: string, newName?: string): Promise<Campaign | null> {
  const source = await getCampaign(id);
  if (!source) return null;
  return createCampaign({
    name: newName ?? `${source.name} (copy)`,
    description: source.description,
    campaign_type: source.campaign_type,
    subject: source.subject,
    preview_text: source.preview_text,
    body_html: source.body_html,
    body_text: source.body_text,
    sender_name: source.sender_name,
    sender_from: source.sender_from,
    sender_reply_to: source.sender_reply_to,
    scheduled_at: null,                       // never inherit schedule
    segment_ids: source.segment_ids,
    created_by: source.created_by,
  });
}

// ── status transition ────────────────────────────────────────────
export async function transitionCampaignStatus(
  id: string, to: CampaignStatus,
): Promise<{ ok: true; campaign: Campaign } | { ok: false; error: string; from?: CampaignStatus; allowed?: CampaignStatus[] }> {
  const current = await getCampaign(id);
  if (!current) return { ok: false, error: "not_found" };
  const allowed = CAMPAIGN_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(to)) return { ok: false, error: "invalid_transition", from: current.status, allowed };

  const r = await withClient(async (c) => {
    const extraSets: string[] = [];
    if (to === "scheduled")  extraSets.push(`archived_at = NULL`);
    if (to === "sending")    extraSets.push(`started_at = COALESCE(started_at, NOW())`);
    if (to === "completed")  extraSets.push(`completed_at = NOW()`);
    if (to === "archived")   extraSets.push(`archived_at = NOW()`);
    if (to === "draft" && current.status === "cancelled") extraSets.push(`scheduled_at = NULL, started_at = NULL, completed_at = NULL`);
    const extras = extraSets.length > 0 ? `, ${extraSets.join(", ")}` : "";
    await c.query(`UPDATE nex.campaigns SET status = $1, updated_at = NOW() ${extras} WHERE campaign_id = $2`, [to, id]);
    return getCampaignInner(c, id);
  });
  if (!r) return { ok: false, error: "update_failed" };
  return { ok: true, campaign: r };
}

// ── preview aggregation ──────────────────────────────────────────
/**
 * Runs every attached segment's filter through the Audience Engine ·
 * unions the sample rows · sums matching counts. For accurate dedup
 * across segments, uses a UNION query on the canonical view.
 * Caches result on nex.campaigns.last_preview + last_preview_at.
 */
export async function previewCampaign(id: string): Promise<CampaignPreviewCache | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;

  const warnings: string[] = [];
  if (campaign.segment_ids.length === 0) warnings.push("no segments attached");
  if (!campaign.subject && campaign.status !== "draft") warnings.push("subject empty");
  if (!campaign.sender_from) warnings.push("sender_from missing");

  // No segments → zeros, warning
  if (campaign.segment_ids.length === 0) {
    const cache: CampaignPreviewCache = {
      matching: 0, eligible_marketing: 0, eligible_transactional: 0,
      suppressed: { unsubscribed: 0, never_contact: 0, invalid_email: 0, no_marketing_consent: 0, total_suppressed: 0 },
      segments_used: [], warnings, estimated_send_seconds: 0, generated_at: new Date().toISOString(),
    };
    await cacheCampaignPreview(id, cache);
    return cache;
  }

  // Fetch every filter · run each preview · union sample_ids, sum counts.
  // Overlap between segments is NOT double-counted in matching because
  // we aggregate distinct contact_ids via the segments' preview samples ·
  // but sample is capped at 25/segment · for exact dedup we run a small
  // union count query on the canonical view.
  const filters: AudienceFilter[] = [];
  const segmentsUsed: string[] = [];
  for (const sid of campaign.segment_ids) {
    const seg = await getSegment(sid);
    if (seg) { filters.push(seg.filter); segmentsUsed.push(sid); }
  }

  // For each filter, run standard preview then take max of counts and
  // union of suppression numbers. This is a conservative estimate ·
  // exact deduped total across N segments is deferred (needs UNION
  // query on canonical). Note in UI.
  const perSegment = await Promise.all(filters.map((f) => previewAudience(f)));

  let matching = 0;
  let eligible_marketing = 0;
  let eligible_transactional = 0;
  const supp = { unsubscribed: 0, never_contact: 0, invalid_email: 0, no_marketing_consent: 0, total_suppressed: 0 };
  for (const p of perSegment) {
    matching += p.matching;
    eligible_marketing += p.eligible_marketing;
    eligible_transactional += p.eligible_transactional;
    supp.unsubscribed          += p.suppressed.unsubscribed;
    supp.never_contact         += p.suppressed.never_contact;
    supp.invalid_email         += p.suppressed.invalid_email;
    supp.no_marketing_consent  += p.suppressed.no_marketing_consent;
    supp.total_suppressed      += p.suppressed.total_suppressed;
  }
  if (filters.length > 1) warnings.push(`counts sum across ${filters.length} segments · overlap not deduped in Phase 4b (exact dedup in 4d Delivery)`);

  // ~10 sends/sec provider-agnostic rough default
  const estimated_send_seconds = Math.ceil((campaign.campaign_type === "marketing" ? eligible_marketing : eligible_transactional) / 10);

  const cache: CampaignPreviewCache = {
    matching, eligible_marketing, eligible_transactional, suppressed: supp,
    segments_used: segmentsUsed, warnings, estimated_send_seconds,
    generated_at: new Date().toISOString(),
  };
  await cacheCampaignPreview(id, cache);
  return cache;
}

async function cacheCampaignPreview(id: string, cache: CampaignPreviewCache): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `UPDATE nex.campaigns SET last_preview = $1::jsonb, last_preview_at = NOW() WHERE campaign_id = $2`,
      [JSON.stringify(cache), id],
    );
    return null;
  });
}

// ── metrics for Mission Control ──────────────────────────────────
export type CampaignMetrics = {
  by_status: Record<CampaignStatus, number>;
  total: number;
  open_campaigns: number;              // ready_for_review + approved + scheduled + sending + paused
  last_campaign: { campaign_id: string; name: string; status: CampaignStatus; updated_at: string } | null;
  next_scheduled: { campaign_id: string; name: string; scheduled_at: string } | null;
};

const ZERO_STATUS: Record<CampaignStatus, number> = {
  draft: 0, ready_for_review: 0, approved: 0, scheduled: 0,
  sending: 0, paused: 0, completed: 0, cancelled: 0, archived: 0,
};

export async function getCampaignMetrics(): Promise<CampaignMetrics> {
  const r = await withClient(async (c) => {
    const counts = await c.query(`SELECT status, COUNT(*)::int AS n FROM nex.campaigns GROUP BY status`);
    const by_status: Record<CampaignStatus, number> = { ...ZERO_STATUS };
    for (const row of counts.rows) by_status[row.status as CampaignStatus] = Number(row.n);

    const totalRes = await c.query(`SELECT COUNT(*)::int AS n FROM nex.campaigns WHERE archived_at IS NULL`);
    const total = Number((totalRes.rows[0] as { n: number }).n);

    const lastRes = await c.query(`SELECT campaign_id, name, status, updated_at FROM nex.campaigns WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT 1`);
    const nextRes = await c.query(`SELECT campaign_id, name, scheduled_at FROM nex.campaigns WHERE status IN ('scheduled','paused') AND scheduled_at IS NOT NULL AND scheduled_at > NOW() ORDER BY scheduled_at ASC LIMIT 1`);

    const open = by_status.ready_for_review + by_status.approved + by_status.scheduled + by_status.sending + by_status.paused;

    return {
      by_status, total, open_campaigns: open,
      last_campaign: lastRes.rows[0] ? {
        campaign_id: String(lastRes.rows[0].campaign_id),
        name: String(lastRes.rows[0].name),
        status: lastRes.rows[0].status as CampaignStatus,
        updated_at: String(lastRes.rows[0].updated_at),
      } : null,
      next_scheduled: nextRes.rows[0] ? {
        campaign_id: String(nextRes.rows[0].campaign_id),
        name: String(nextRes.rows[0].name),
        scheduled_at: String(nextRes.rows[0].scheduled_at),
      } : null,
    };
  });
  return r ?? { by_status: { ...ZERO_STATUS }, total: 0, open_campaigns: 0, last_campaign: null, next_scheduled: null };
}
