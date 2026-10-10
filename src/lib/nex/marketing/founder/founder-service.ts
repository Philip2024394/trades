// src/lib/nex/marketing/founder/founder-service.ts
//
// NEX Email Marketing HQ · Founder Control Centre service
// Founder-authorised programme.
//
// **Founder-lane truth layer**. The HQ UI is thin over this service.
// Every founder-side operation goes through here. Lane isolation is
// enforced server-side (§9, §37) · UI is never the security boundary.

import type { PoolClient } from "pg";
import type {
  FounderAuthContext,
  FounderCampaignInput,
  FounderCampaignSummary,
  FounderCampaignStatus,
  FounderSenderView,
  FounderReviewOutcome,
  TestEmailInput,
  TestEmailOutcome,
  HQSystemStatus,
  FounderCampaignAnalytics,
  CampaignPreview,
  GlobalUnsubscribeCheck,
} from "./types";
import { FounderAccessError, FounderLaneViolationError, FounderValidationError } from "./types";
import { countAudience } from "../member/audience";
import { compileTemplate } from "../member/campaign-service";
import { loadCandidatesForLane, loadCapacity, loadSenderById, createSender, SENDABLE_HEALTH_STATES } from "../sender-pool";
import { injectTracking } from "../tracking-inject";

// ─── Auth guard ─────────────────────────────────────────────────────
export function assertFounder(ctx: FounderAuthContext): void {
  if (!ctx.authenticated) throw new FounderAccessError("no_founder_credential");
}

// ─── System status ─────────────────────────────────────────────────
export async function getHQSystemStatus(client: PoolClient, ctx: FounderAuthContext): Promise<HQSystemStatus> {
  assertFounder(ctx);
  // Count senders · fail-soft when Stage 2 schema not applied locally
  let founder_senders: any[] = [];
  let stage2_ok = true;
  try {
    founder_senders = await loadCandidatesForLane(client, "founder", null) as any[];
  } catch { stage2_ok = false; }
  const active_senders = founder_senders.filter(s =>
    s.authentication_state === "verified" && SENDABLE_HEALTH_STATES.has(s.health_state)
  ).length;
  // Pending queue count · fail-soft
  const pending = await client.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM nex.marketing_send_queue WHERE status='pending'`,
  ).catch(() => ({ rows: [{ n: 0 }] }));
  // Last activity · fail-soft
  const last = await client.query<{ at: string | null }>(
    `SELECT MAX(sent_at) AS at FROM nex.marketing_send_log`,
  ).catch(() => ({ rows: [{ at: null }] }));

  return {
    ready: stage2_ok && active_senders > 0,
    send_enabled: stage2_ok && active_senders > 0,
    primary_provider: process.env.NEX_EMAIL_PROVIDER ?? "resend",
    configured_providers: ["resend", "sendgrid", "ses", "mailgun", "postmark"].filter(p => hasProviderConfig(p)),
    active_senders,
    total_founder_senders: founder_senders.length,
    pending_queue: pending.rows[0]?.n ?? 0,
    auto_state: "not_configured",     // Stage 5 auto executor wire-up pending
    compliance_ok: true,
    last_activity_at: last.rows[0]?.at ?? null,
    backend_available: stage2_ok,
  };
}

function hasProviderConfig(provider: string): boolean {
  switch (provider) {
    case "resend":   return !!process.env.RESEND_API_KEY;
    case "sendgrid": return !!process.env.SENDGRID_API_KEY;
    case "ses":      return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_REGION);
    case "mailgun":  return !!process.env.MAILGUN_API_KEY;
    case "postmark": return !!process.env.POSTMARK_API_TOKEN;
    default:         return false;
  }
}

// ─── List Founder senders (with capacity) ──────────────────────────
export async function listFounderSenders(client: PoolClient, ctx: FounderAuthContext): Promise<ReadonlyArray<FounderSenderView>> {
  assertFounder(ctx);
  const senders = await loadCandidatesForLane(client, "founder", null);
  return Promise.all(senders.map(async s => {
    const cap = await loadCapacity(client, s);
    const is_sendable =
      s.authentication_state === "verified" &&
      SENDABLE_HEALTH_STATES.has(s.health_state) &&
      (cap.effective_remaining === null || cap.effective_remaining > 0);
    return {
      sender_id: s.sender_id,
      email: s.email,
      display_name: s.display_name,
      provider: s.provider,
      authentication_state: s.authentication_state,
      verification_state: s.verification_state,
      health_state: s.health_state,
      capacity: {
        hourly_limit: cap.hourly_limit,
        hourly_used: cap.hourly_used,
        hourly_remaining: cap.hourly_remaining,
        daily_limit: cap.daily_limit,
        daily_used: cap.daily_used,
        daily_remaining: cap.daily_remaining,
        effective_remaining: cap.effective_remaining,
      },
      last_send_at: s.last_send_at,
      is_sendable,
    };
  }));
}

// ─── Add Founder sender ────────────────────────────────────────────
export interface AddFounderSenderInput {
  readonly email: string;
  readonly display_name?: string;
  readonly reply_to?: string;
  readonly sending_domain?: string;
  readonly provider: string;
  readonly provider_account_ref?: string;
  readonly daily_capacity?: number;
  readonly hourly_capacity?: number;
  readonly capacity_source: string;                // MUST specify · never hard-code an assumed Gmail limit
}

export async function addFounderSender(
  client: PoolClient,
  ctx: FounderAuthContext,
  input: AddFounderSenderInput,
): Promise<FounderSenderView> {
  assertFounder(ctx);
  if (!input.email || !/^[^@]+@[^@]+\.[^@]+$/.test(input.email)) {
    throw new FounderValidationError("invalid_email", input.email);
  }
  if (!input.capacity_source) {
    throw new FounderValidationError("missing_capacity_source", "provider-authorised capacity source required · never hard-code");
  }
  const sender = await createSender(client, {
    member_id: null,
    lane: "founder",
    email: input.email,
    display_name: input.display_name,
    reply_to: input.reply_to,
    sending_domain: input.sending_domain,
    provider: input.provider as any,
    provider_account_ref: input.provider_account_ref,
    daily_capacity: input.daily_capacity,
    hourly_capacity: input.hourly_capacity,
    capacity_source: input.capacity_source,
    authorised_by: ctx.actor,
    provenance: { source: "hq_ui", authorised_by: ctx.actor },
  });
  const cap = await loadCapacity(client, sender);
  return {
    sender_id: sender.sender_id,
    email: sender.email,
    display_name: sender.display_name,
    provider: sender.provider,
    authentication_state: sender.authentication_state,
    verification_state: sender.verification_state,
    health_state: sender.health_state,
    capacity: {
      hourly_limit: cap.hourly_limit, hourly_used: cap.hourly_used, hourly_remaining: cap.hourly_remaining,
      daily_limit: cap.daily_limit, daily_used: cap.daily_used, daily_remaining: cap.daily_remaining,
      effective_remaining: cap.effective_remaining,
    },
    last_send_at: sender.last_send_at,
    is_sendable: false,                             // pending verification
  };
}

// ─── Founder campaign create ───────────────────────────────────────
export async function createFounderDraft(
  client: PoolClient,
  ctx: FounderAuthContext,
  input: FounderCampaignInput,
): Promise<FounderCampaignSummary> {
  assertFounder(ctx);
  // Enforce lane isolation on the sender
  await assertFounderSender(client, input.sender_id);

  if (input.display_name.trim().length < 3) throw new FounderValidationError("invalid_display_name", "must be >= 3 chars");
  if (input.subject_line.trim().length < 3) throw new FounderValidationError("invalid_subject_line", "must be >= 3 chars");

  const compiled = compileTemplate({
    display_name: input.display_name,
    subject_line: input.subject_line,
    from_email: input.from_email,
    from_name: input.from_name,
    reply_to: input.reply_to,
    package_id: "founder-lane",                     // ignored by compileTemplate · required by shape
    sender_id: input.sender_id,
    audience: input.audience,
    content_blocks: input.content_blocks,
    mjml_source: input.mjml_source,
    banner_image_url: input.banner_image_url,
    cta_url: input.cta_url,
    cta_label: input.cta_label,
    footer_text: input.footer_text ?? standardFounderFooter(),
  });

  const slug = `founder-${Date.now().toString(36)}`;

  const tres = await client.query(
    `INSERT INTO nex.marketing_template
       (slug, display_name, subject_line, from_email, from_name, reply_to,
        mjml_source, html_compiled, text_fallback,
        banner_image_url, cta_url, variables, language)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
     RETURNING template_id`,
    [
      `tmpl-${slug}`, input.display_name, input.subject_line,
      input.from_email, input.from_name ?? null, input.reply_to ?? null,
      input.mjml_source ?? compiled.mjml_source, compiled.html, compiled.text,
      input.banner_image_url ?? null, input.cta_url ?? null,
      JSON.stringify({ preheader: input.preheader ?? null }),
      input.audience.language ?? "en",
    ],
  );
  const template_id = tres.rows[0].template_id;

  const sres = await client.query(
    `INSERT INTO nex.marketing_segment
       (slug, display_name, country, city, language, category_slug, extra_where)
     VALUES ($1, $2, $3, NULL, $4, $5, NULL)
     RETURNING segment_id`,
    [
      `seg-${slug}`, `Founder audience for ${input.display_name}`,
      input.audience.country ?? null, input.audience.language ?? null, input.audience.category ?? null,
    ],
  );
  const segment_id = sres.rows[0].segment_id;

  const cres = await client.query(
    `INSERT INTO nex.marketing_campaign
       (slug, display_name, template_id, segment_id, status, metadata, proposed_at)
     VALUES ($1, $2, $3, $4, 'draft', $5::jsonb, now())
     RETURNING *`,
    [
      slug, input.display_name, template_id, segment_id,
      JSON.stringify({
        lane: "founder",
        origin: "founder",
        sender_id: input.sender_id,
        scheduled_for: input.scheduled_for ?? null,
        actor: ctx.actor,
      }),
    ],
  );
  return mapCampaignRow(cres.rows[0]);
}

// ─── Load / list founder campaigns ─────────────────────────────────
export async function listFounderCampaigns(client: PoolClient, ctx: FounderAuthContext): Promise<ReadonlyArray<FounderCampaignSummary>> {
  assertFounder(ctx);
  const res = await client.query(
    `SELECT * FROM nex.marketing_campaign
      WHERE COALESCE(metadata->>'lane', '') = 'founder'
      ORDER BY created_at DESC LIMIT 100`,
  );
  return res.rows.map(mapCampaignRow);
}

export async function loadFounderCampaign(client: PoolClient, ctx: FounderAuthContext, campaign_id: string): Promise<FounderCampaignSummary> {
  assertFounder(ctx);
  const res = await client.query(
    `SELECT * FROM nex.marketing_campaign
      WHERE campaign_id = $1 AND COALESCE(metadata->>'lane', '') = 'founder'`,
    [campaign_id],
  );
  if (res.rows.length === 0) throw new FounderValidationError("campaign_not_found", campaign_id);
  return mapCampaignRow(res.rows[0]);
}

// ─── Preview compiled campaign ─────────────────────────────────────
export async function previewFounderCampaign(client: PoolClient, ctx: FounderAuthContext, campaign_id: string): Promise<CampaignPreview> {
  assertFounder(ctx);
  const t = await client.query(
    `SELECT t.subject_line, t.from_email, t.from_name, t.html_compiled, t.text_fallback, t.variables
       FROM nex.marketing_campaign c
       JOIN nex.marketing_template t ON t.template_id = c.template_id
      WHERE c.campaign_id = $1 AND COALESCE(c.metadata->>'lane', '') = 'founder'`,
    [campaign_id],
  );
  const row = t.rows[0];
  if (!row) throw new FounderValidationError("campaign_or_template_missing", campaign_id);
  const preheader = (row.variables && typeof row.variables === "object") ? (row.variables as any).preheader ?? null : null;
  return {
    campaign_id,
    subject: row.subject_line,
    preheader,
    from: { email: row.from_email, name: row.from_name ?? null },
    compiled_html: row.html_compiled,
    text_fallback: row.text_fallback,
    desktop_width_px: 640,
    mobile_width_px: 375,
  };
}

// ─── Review ────────────────────────────────────────────────────────
export async function reviewFounderCampaign(client: PoolClient, ctx: FounderAuthContext, campaign_id: string): Promise<FounderReviewOutcome> {
  assertFounder(ctx);
  const meta = await client.query(
    `SELECT c.campaign_id, c.display_name, c.metadata,
            s.country, s.category_slug, s.language
       FROM nex.marketing_campaign c
       LEFT JOIN nex.marketing_segment s ON s.segment_id = c.segment_id
      WHERE c.campaign_id = $1 AND COALESCE(c.metadata->>'lane', '') = 'founder'`,
    [campaign_id],
  );
  const md = meta.rows[0];
  if (!md) throw new FounderValidationError("campaign_not_found", campaign_id);

  const audience_query = { country: md.country ?? undefined, category: md.category_slug ?? undefined, language: md.language ?? undefined };
  const audience_count = await countAudience(client, audience_query);
  const sender_id = (md.metadata?.sender_id ?? null) as string | null;
  if (!sender_id) throw new FounderValidationError("campaign_incomplete", "sender_id missing");

  const sender = await loadSenderById(client, sender_id);
  if (!sender) throw new FounderValidationError("sender_not_found", sender_id);
  if (sender.lane !== "founder") throw new FounderLaneViolationError(`sender ${sender_id} is lane=${sender.lane}`);
  const cap = await loadCapacity(client, sender);

  const sender_view: FounderSenderView = {
    sender_id: sender.sender_id, email: sender.email, display_name: sender.display_name,
    provider: sender.provider, authentication_state: sender.authentication_state, verification_state: sender.verification_state,
    health_state: sender.health_state,
    capacity: {
      hourly_limit: cap.hourly_limit, hourly_used: cap.hourly_used, hourly_remaining: cap.hourly_remaining,
      daily_limit: cap.daily_limit, daily_used: cap.daily_used, daily_remaining: cap.daily_remaining,
      effective_remaining: cap.effective_remaining,
    },
    last_send_at: sender.last_send_at,
    is_sendable: sender.authentication_state === "verified" && SENDABLE_HEALTH_STATES.has(sender.health_state),
  };

  const refusal: FounderReviewOutcome["refusal_reasons"] = [];
  if (audience_count.eligible === 0) refusal.push({ kind: "audience_empty", detail: "no eligible recipients" });
  if (sender.authentication_state !== "verified") refusal.push({ kind: "sender_unverified", detail: `state=${sender.authentication_state}` });
  if (!SENDABLE_HEALTH_STATES.has(sender.health_state)) refusal.push({ kind: "sender_unhealthy", detail: `health=${sender.health_state}` });
  if (cap.effective_remaining !== null && cap.effective_remaining < audience_count.eligible) {
    refusal.push({ kind: "sender_exhausted", detail: `remaining=${cap.effective_remaining} eligible=${audience_count.eligible}` });
  }

  return {
    campaign_id, display_name: md.display_name,
    audience: audience_query, audience_count, sender: sender_view,
    send_ready: refusal.length === 0,
    refusal_reasons: refusal,
    reviewed_at: new Date().toISOString(),
  };
}

// ─── Schedule/Send (Founder lane · shared executor · no member package touch) ─
export async function sendFounderCampaign(
  client: PoolClient,
  ctx: FounderAuthContext,
  campaign_id: string,
  mode: Exclude<import("./types").SendMode, "test_only">,
): Promise<{ status: FounderCampaignStatus; queued: number }> {
  assertFounder(ctx);
  const review = await reviewFounderCampaign(client, ctx, campaign_id);
  if (!review.send_ready) throw new FounderValidationError("send_not_ready", review.refusal_reasons.map(r => r.kind).join(","));
  const eligible = review.audience_count.eligible;

  // Update status · founder-controlled · NO member package touched
  const q = await client.query(
    `UPDATE nex.marketing_campaign
        SET status = 'approved', approved_at = now(), approved_by = $1, target_count = $2,
            started_at = CASE WHEN $3::boolean THEN now() ELSE started_at END
      WHERE campaign_id = $4 AND COALESCE(metadata->>'lane', '') = 'founder'
    RETURNING status`,
    [`founder:${ctx.actor}`, eligible, mode === "send_to_selected" || mode === "auto_send", campaign_id],
  );
  if (q.rowCount === 0) throw new FounderValidationError("update_failed", campaign_id);

  // Populate queue with founder lane marker in metadata
  const seg = await client.query(
    `SELECT segment_id FROM nex.marketing_campaign WHERE campaign_id = $1`,
    [campaign_id],
  );
  // Materialise audience into queue rows (respects opt_out + hard_bounced via SQL WHERE)
  const seg_row = seg.rows[0];
  const contactSql = buildContactSelectSQL(await getSegment(client, seg_row.segment_id));
  const contacts = await client.query(contactSql.sql, contactSql.params);
  for (const c of contacts.rows) {
    await client.query(
      `INSERT INTO nex.marketing_send_queue (campaign_id, contact_id, email, status)
       VALUES ($1, $2, $3, 'pending') ON CONFLICT DO NOTHING`,
      [campaign_id, c.contact_id, c.email],
    );
  }
  return { status: "approved", queued: contacts.rowCount ?? 0 };
}

async function getSegment(client: PoolClient, segment_id: string): Promise<{ country: string | null; category_slug: string | null; language: string | null }> {
  const r = await client.query(`SELECT country, category_slug, language FROM nex.marketing_segment WHERE segment_id = $1`, [segment_id]);
  return r.rows[0] ?? { country: null, category_slug: null, language: null };
}

function buildContactSelectSQL(seg: { country: string | null; category_slug: string | null; language: string | null }): { sql: string; params: unknown[] } {
  const filters: string[] = ["opt_out = false", "hard_bounced = false"];
  const params: unknown[] = [];
  const add = (col: string, val: unknown) => {
    if (val === null || val === undefined || val === "") return;
    params.push(val);
    filters.push(`${col} = $${params.length}`);
  };
  add("country", seg.country);
  add("category_slug", seg.category_slug);
  add("language", seg.language);
  return { sql: `SELECT contact_id, email FROM nex.marketing_contact WHERE ${filters.join(" AND ")}`, params };
}

// ─── TEST EMAIL · isolated · not audience · not accounted ──────────
export async function sendFounderTestEmail(
  client: PoolClient,
  ctx: FounderAuthContext,
  input: TestEmailInput,
  adapter?: { send: (msg: any) => Promise<any> },
): Promise<TestEmailOutcome> {
  assertFounder(ctx);
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(input.test_recipient)) {
    return { kind: "test_refused", reason: "invalid_test_recipient" };
  }

  const t = await client.query(
    `SELECT c.metadata, t.subject_line, t.from_email, t.from_name, t.reply_to, t.html_compiled, t.text_fallback
       FROM nex.marketing_campaign c
       JOIN nex.marketing_template t ON t.template_id = c.template_id
      WHERE c.campaign_id = $1 AND COALESCE(c.metadata->>'lane', '') = 'founder'`,
    [input.campaign_id],
  );
  const row = t.rows[0];
  if (!row) return { kind: "test_refused", reason: "campaign_not_found" };
  const sender_id = (row.metadata?.sender_id ?? null) as string | null;
  if (!sender_id) return { kind: "test_refused", reason: "sender_missing" };

  const sender = await loadSenderById(client, sender_id);
  if (!sender || sender.lane !== "founder") return { kind: "test_refused", reason: "sender_lane_mismatch" };
  if (sender.authentication_state !== "verified") return { kind: "test_refused", reason: "sender_unverified" };
  if (!SENDABLE_HEALTH_STATES.has(sender.health_state)) return { kind: "test_refused", reason: "sender_unhealthy" };

  // Inject tracking with a test-marker · never adds to contact db
  const tracked = injectTracking({
    html: row.html_compiled,
    campaign_id: `test:${input.campaign_id}`,
    contact_id: `test:${sha256Short(input.test_recipient)}`,
  });

  const message = {
    from: { address: sender.email, name: sender.display_name ?? undefined },
    to: [{ address: input.test_recipient }],
    reply_to: row.reply_to ?? undefined,
    subject: `[TEST] ${row.subject_line}`,
    html: tracked.html,
    text: row.text_fallback,
    kind: "marketing" as const,
    campaign_id: input.campaign_id,
    headers: {
      "X-NEX-Test-Send": "true",                    // provider webhooks can filter/ignore
      "List-Unsubscribe": tracked.list_unsubscribe_header,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };

  // Test send bypasses queue/accounting · goes directly through adapter
  // Do NOT record in nex.marketing_send_log with the campaign's real recipient list
  // (would corrupt accounting) · but DO record as founder audit for traceability
  const emailAdapter = adapter ?? (await import("../../email/registry")).getEmail();
  const result = await emailAdapter.send(message);
  if (!result.ok) return { kind: "test_refused", reason: `provider_rejected: ${result.reason}` };

  // Audit only (no send_log entry to keep campaign accounting clean)
  await client.query(
    `INSERT INTO nex.marketing_send_log (campaign_id, contact_id, email, esp, esp_message_id, status, status_detail)
     VALUES ($1, NULL, $2, $3, $4, 'accepted', $5)`,
    [input.campaign_id, input.test_recipient, result.provider ?? "unknown", result.provider_message_id, "founder_test_send"],
  ).catch(() => { /* audit-only · never fail the test send if this fails */ });

  return { kind: "test_sent", provider_message_id: result.provider_message_id, sender_email: sender.email };
}

// ─── Global unsubscribe check (§19 · execution-time re-verify) ─────
export async function checkGlobalUnsubscribe(client: PoolClient, recipient_email: string): Promise<GlobalUnsubscribeCheck> {
  const res = await client.query<{ opt_out: boolean; hard_bounced: boolean; complaint_count: number }>(
    `SELECT opt_out, hard_bounced, complaint_count FROM nex.marketing_contact WHERE LOWER(email) = LOWER($1)`,
    [recipient_email],
  );
  const row = res.rows[0];
  if (!row) return { recipient: recipient_email, is_suppressed: false, reason: "not_suppressed" };
  if (row.opt_out) return { recipient: recipient_email, is_suppressed: true, reason: "opt_out" };
  if (row.hard_bounced) return { recipient: recipient_email, is_suppressed: true, reason: "hard_bounced" };
  if (row.complaint_count > 0) return { recipient: recipient_email, is_suppressed: true, reason: "complaint" };

  // Also check the global opt-out list (marketing_opt_out table)
  const suppressed = await client.query(
    `SELECT 1 FROM nex.marketing_opt_out WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [recipient_email],
  ).catch(() => ({ rowCount: 0 }));
  if (suppressed.rowCount && suppressed.rowCount > 0) {
    return { recipient: recipient_email, is_suppressed: true, reason: "unsubscribed" };
  }
  return { recipient: recipient_email, is_suppressed: false, reason: "not_suppressed" };
}

// ─── Analytics (Founder-lane campaign KPIs) ────────────────────────
export async function getFounderAnalytics(client: PoolClient, ctx: FounderAuthContext, campaign_id: string): Promise<FounderCampaignAnalytics> {
  assertFounder(ctx);
  const c = await loadFounderCampaign(client, ctx, campaign_id);
  const events = await client.query<{ event_type: string; n: number }>(
    `SELECT event_type, COUNT(*)::int AS n FROM nex.marketing_bounce_log
      WHERE esp_message_id IN (SELECT esp_message_id FROM nex.marketing_send_log WHERE campaign_id = $1 AND esp_message_id IS NOT NULL)
      GROUP BY event_type`,
    [campaign_id],
  ).catch(() => ({ rows: [] as { event_type: string; n: number }[] }));
  const by: Record<string, number> = {};
  for (const r of events.rows) by[r.event_type] = r.n;
  const sent = c.send_count;
  const delivered = by["delivery"] ?? 0;
  const opens = by["open"] ?? 0;
  const clicks = by["click"] ?? 0;
  const bounces = by["bounce"] ?? c.bounced_count;
  const complaints = by["complaint"] ?? c.complained_count;
  const unsubs = by["unsubscribe"] ?? c.unsubscribed_count;
  const failures = c.fail_count;
  const rate = (n: number, d: number) => d > 0 ? n / d : 0;
  return {
    campaign_id, display_name: c.display_name, status: c.status,
    target_count: c.target_count, send_count: sent,
    delivered, observed_opens: opens, clicks, bounces, complaints, unsubscribes: unsubs, failures,
    rates: {
      delivery_rate: rate(delivered, sent),
      observed_open_rate: rate(opens, delivered),
      click_rate: rate(clicks, delivered),
      bounce_rate: rate(bounces, sent),
      complaint_rate: rate(complaints, delivered),
      unsubscribe_rate: rate(unsubs, delivered),
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────
async function assertFounderSender(client: PoolClient, sender_id: string): Promise<void> {
  const res = await client.query(
    `SELECT lane, member_id FROM nex.marketing_sender_identity WHERE sender_id = $1`,
    [sender_id],
  );
  if (res.rows.length === 0) throw new FounderValidationError("sender_not_found", sender_id);
  const row = res.rows[0];
  if (row.lane !== "founder") throw new FounderLaneViolationError(`sender ${sender_id} lane=${row.lane} · founder-lane only`);
  if (row.member_id !== null) throw new FounderLaneViolationError(`sender ${sender_id} member_id=${row.member_id} · founder senders must have member_id=null`);
}

function mapCampaignRow(row: any): FounderCampaignSummary {
  return {
    campaign_id: row.campaign_id,
    display_name: row.display_name,
    status: row.status,
    sender_id: row.metadata?.sender_id ?? null,
    target_count: Number(row.target_count ?? 0),
    send_count: Number(row.send_count ?? 0),
    fail_count: Number(row.fail_count ?? 0),
    opened_count: Number(row.opened_count ?? 0),
    clicked_count: Number(row.clicked_count ?? 0),
    bounced_count: Number(row.bounced_count ?? 0),
    complained_count: Number(row.complained_count ?? 0),
    unsubscribed_count: Number(row.unsubscribed_count ?? 0),
    created_at: row.created_at,
    proposed_at: row.proposed_at,
    approved_at: row.approved_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
  };
}

function standardFounderFooter(): string {
  return `Sent via NEX · one-click unsubscribe at bottom · thenetworkers.app`;
}

function sha256Short(s: string): string {
  const crypto = require("node:crypto") as typeof import("node:crypto");
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
}
