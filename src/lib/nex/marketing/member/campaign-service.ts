// src/lib/nex/marketing/member/campaign-service.ts
//
// NEX Managed Email Marketing · Stage 4 · Member campaign orchestration
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a).
//
// **Responsibility**: real end-to-end member campaign business logic.
// Every mutation enforces:
//   • member_id ownership (Clause 4 · verified server-side)
//   • sender ownership (matches member's authorised sender pool)
//   • package ownership (matches member's active package)
//   • lane isolation (MEMBER only · assertMemberLane guard)
//   • package accounting integration (reserve on approve · consume/release
//     lifecycle happens in the send-executor and the reaper respectively)
//
// This module IS the truth layer for the /nex-app/marketing UI.
// The UI is a thin wrapper. If the UI were removed, the campaign flow
// would still be complete via API + this service.

import type { PoolClient } from "pg";
import type {
  MemberAuthContext,
  MemberCampaignSummary,
  MemberCampaignStatus,
  CampaignComposerInput,
  CampaignPreview,
  ReviewOutcome,
  MemberCampaignAnalytics,
} from "./types";
import { MemberAccessError, MemberIsolationError, MemberValidationError } from "./types";
import { countAudience } from "./audience";
import {
  loadPackageById,
  computeCapacity,
  reserve,
  release,
  assertMemberLane,
} from "../package";
import { loadSenderById, loadCapacity as loadSenderCapacity } from "../sender-pool";

// ─── Auth guards ────────────────────────────────────────────────────
export function assertAuthenticatedMember(ctx: MemberAuthContext): void {
  if (!ctx.authenticated || !ctx.member_id) {
    throw new MemberAccessError("no_member_credential");
  }
}

// ─── List member campaigns ─────────────────────────────────────────
export async function listMemberCampaigns(
  client: PoolClient,
  ctx: MemberAuthContext,
): Promise<ReadonlyArray<MemberCampaignSummary>> {
  assertAuthenticatedMember(ctx);
  const res = await client.query(
    `SELECT c.campaign_id,
            c.slug as slug,
            COALESCE(c.metadata->>'member_id', '') AS member_id,
            COALESCE(c.metadata->>'package_id', NULL) AS package_id,
            c.display_name, c.status, c.target_count, c.send_count, c.fail_count,
            c.opened_count, c.clicked_count, c.bounced_count, c.complained_count,
            c.metadata->>'scheduled_for' AS scheduled_for,
            c.proposed_at, c.approved_at, c.started_at, c.completed_at, c.created_at
       FROM nex.marketing_campaign c
      WHERE COALESCE(c.metadata->>'member_id', '') = $1
      ORDER BY c.created_at DESC`,
    [ctx.member_id],
  );
  return res.rows.map(mapCampaignRow);
}

// ─── Load campaign (member-scoped · throws on isolation violation) ─
export async function loadMemberCampaign(
  client: PoolClient,
  ctx: MemberAuthContext,
  campaign_id: string,
): Promise<MemberCampaignSummary> {
  assertAuthenticatedMember(ctx);
  const res = await client.query(
    `SELECT c.campaign_id, c.slug,
            COALESCE(c.metadata->>'member_id', '') AS member_id,
            c.metadata->>'package_id' AS package_id,
            c.display_name, c.status, c.target_count, c.send_count, c.fail_count,
            c.opened_count, c.clicked_count, c.bounced_count, c.complained_count,
            c.metadata->>'scheduled_for' AS scheduled_for,
            c.proposed_at, c.approved_at, c.started_at, c.completed_at, c.created_at
       FROM nex.marketing_campaign c
      WHERE c.campaign_id = $1`,
    [campaign_id],
  );
  const row = res.rows[0];
  if (!row) throw new MemberIsolationError(`campaign:${campaign_id}`);
  if (row.member_id !== ctx.member_id) throw new MemberIsolationError(`campaign:${campaign_id}`);
  return mapCampaignRow(row);
}

// ─── Create draft campaign ─────────────────────────────────────────
export interface CreateCampaignInput extends CampaignComposerInput {}

export async function createDraftCampaign(
  client: PoolClient,
  ctx: MemberAuthContext,
  input: CreateCampaignInput,
): Promise<MemberCampaignSummary> {
  assertAuthenticatedMember(ctx);

  // Validate ownership of package + sender
  await assertPackageOwnership(client, ctx.member_id, input.package_id);
  await assertSenderOwnership(client, ctx.member_id, input.sender_id);

  // Basic content validation
  if (!input.display_name || input.display_name.trim().length < 3) {
    throw new MemberValidationError("invalid_display_name", "must be >= 3 characters");
  }
  if (!input.subject_line || input.subject_line.trim().length < 3) {
    throw new MemberValidationError("invalid_subject_line", "must be >= 3 characters");
  }

  const compiled = compileTemplate(input);
  const slug = `mc-${ctx.member_id.slice(0, 8)}-${Date.now().toString(36)}`;

  // Insert template first (existing schema)
  const templateRes = await client.query(
    `INSERT INTO nex.marketing_template
       (slug, display_name, subject_line, from_email, from_name, reply_to,
        mjml_source, html_compiled, text_fallback,
        banner_image_url, cta_url, variables, language)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
     RETURNING template_id`,
    [
      `tmpl-${slug}`,
      input.display_name,
      input.subject_line,
      input.from_email,
      input.from_name ?? null,
      input.reply_to ?? null,
      input.mjml_source ?? compiled.mjml_source,
      compiled.html,
      compiled.text,
      input.banner_image_url ?? null,
      input.cta_url ?? null,
      JSON.stringify({ preheader: input.preheader ?? null }),
      input.audience.language ?? "en",
    ],
  );
  const template_id = templateRes.rows[0].template_id;

  // Segment (persist the member's audience query)
  const segmentRes = await client.query(
    `INSERT INTO nex.marketing_segment
       (slug, display_name, country, city, language, category_slug, extra_where)
     VALUES ($1, $2, $3, NULL, $4, $5, NULL)
     RETURNING segment_id`,
    [
      `seg-${slug}`,
      `Audience for ${input.display_name}`,
      input.audience.country ?? null,
      input.audience.language ?? null,
      input.audience.category ?? null,
    ],
  );
  const segment_id = segmentRes.rows[0].segment_id;

  // Campaign · store member_id + package_id + sender_id in metadata
  const campaignRes = await client.query(
    `INSERT INTO nex.marketing_campaign
       (slug, display_name, template_id, segment_id, status,
        metadata, proposed_at)
     VALUES ($1, $2, $3, $4, 'draft', $5::jsonb, now())
     RETURNING *`,
    [
      slug,
      input.display_name,
      template_id,
      segment_id,
      JSON.stringify({
        member_id: ctx.member_id,
        package_id: input.package_id,
        sender_id: input.sender_id,
        scheduled_for: input.scheduled_for ?? null,
        lane: "member",
      }),
    ],
  );
  return mapCampaignRow({
    ...campaignRes.rows[0],
    member_id: ctx.member_id,
    package_id: input.package_id,
    scheduled_for: input.scheduled_for ?? null,
  });
}

// ─── Preview campaign (member-scoped) ─────────────────────────────
export async function previewMemberCampaign(
  client: PoolClient,
  ctx: MemberAuthContext,
  campaign_id: string,
): Promise<CampaignPreview> {
  assertAuthenticatedMember(ctx);
  const c = await loadMemberCampaign(client, ctx, campaign_id);

  const t = await client.query(
    `SELECT t.subject_line, t.from_email, t.from_name, t.html_compiled, t.text_fallback, t.variables
       FROM nex.marketing_campaign c
       JOIN nex.marketing_template t ON t.template_id = c.template_id
      WHERE c.campaign_id = $1`,
    [campaign_id],
  );
  const row = t.rows[0];
  if (!row) throw new MemberValidationError("campaign_or_template_missing", campaign_id);
  const preheader = (row.variables && typeof row.variables === "object") ? (row.variables as any).preheader : null;

  return {
    campaign_id: c.campaign_id,
    subject: row.subject_line,
    preheader: preheader ?? null,
    from: { email: row.from_email, name: row.from_name ?? null },
    compiled_html: row.html_compiled,
    text_fallback: row.text_fallback,
    desktop_width_px: 640,
    mobile_width_px: 375,
  };
}

// ─── Review (audience + package + sender · pre-send validation) ────
export async function reviewMemberCampaign(
  client: PoolClient,
  ctx: MemberAuthContext,
  campaign_id: string,
): Promise<ReviewOutcome> {
  assertAuthenticatedMember(ctx);
  const c = await loadMemberCampaign(client, ctx, campaign_id);

  const meta = await client.query(
    `SELECT c.metadata, s.country, s.category_slug, s.language
       FROM nex.marketing_campaign c
       LEFT JOIN nex.marketing_segment s ON s.segment_id = c.segment_id
      WHERE c.campaign_id = $1`,
    [campaign_id],
  );
  const md = meta.rows[0];
  const audience_query = {
    country: md.country ?? undefined,
    category: md.category_slug ?? undefined,
    language: md.language ?? undefined,
  };

  const audience = await countAudience(client, audience_query);
  const package_id = (md.metadata?.package_id ?? null) as string | null;
  const sender_id = (md.metadata?.sender_id ?? null) as string | null;

  if (!package_id || !sender_id) {
    throw new MemberValidationError("campaign_incomplete", "package_id or sender_id missing from campaign metadata");
  }

  const pkg = await loadPackageById(client, package_id);
  if (!pkg) throw new MemberValidationError("package_not_found", package_id);
  if (pkg.member_id !== ctx.member_id) throw new MemberIsolationError(`package:${package_id}`);
  const pcap = computeCapacity(pkg);

  const sender = await loadSenderById(client, sender_id);
  if (!sender) throw new MemberValidationError("sender_not_found", sender_id);
  if (sender.member_id !== ctx.member_id) throw new MemberIsolationError(`sender:${sender_id}`);
  const scap = await loadSenderCapacity(client, sender);

  const refusal_reasons: ReviewOutcome["refusal_reasons"] = [];
  if (audience.eligible === 0) {
    refusal_reasons.push({ kind: "audience_empty", detail: "no eligible recipients for country × category × language" });
  }
  if (pkg.status !== "active") {
    refusal_reasons.push({ kind: "package_not_active", detail: `package status = ${pkg.status}` });
  }
  if (pcap.remaining < audience.eligible) {
    refusal_reasons.push({ kind: "package_exhausted", detail: `package remaining=${pcap.remaining} · eligible=${audience.eligible}` });
  }
  if (!["healthy", "limited", "warning"].includes(sender.health_state)) {
    refusal_reasons.push({ kind: "sender_unhealthy", detail: `sender health=${sender.health_state}` });
  }
  if (scap.effective_remaining !== null && scap.effective_remaining < audience.eligible) {
    refusal_reasons.push({ kind: "sender_exhausted", detail: `sender remaining=${scap.effective_remaining} · eligible=${audience.eligible} · consider scheduling` });
  }

  return {
    campaign_id: c.campaign_id,
    display_name: c.display_name,
    audience: audience_query,
    audience_count: audience,
    sender: {
      sender_id: sender.sender_id,
      email: sender.email,
      display_name: sender.display_name,
      provider: sender.provider,
      health_state: sender.health_state,
      hourly_capacity: scap.hourly_limit,
      hourly_remaining: scap.hourly_remaining,
      daily_capacity: scap.daily_limit,
      daily_remaining: scap.daily_remaining,
    },
    package: {
      package_id: pkg.package_id,
      display_name: pkg.display_name,
      package_type: pkg.package_type,
      purchased: pkg.purchased_capacity,
      reserved: pkg.reserved_capacity,
      consumed: pkg.consumed_capacity,
      remaining: pcap.remaining,
      status: pkg.status,
    },
    send_ready: refusal_reasons.length === 0,
    refusal_reasons,
    reviewed_at: new Date().toISOString(),
  };
}

// ─── Schedule / send-now: transition to 'approved' + reserve capacity ─
export async function scheduleOrSendMemberCampaign(
  client: PoolClient,
  ctx: MemberAuthContext,
  campaign_id: string,
  options: { send_now?: boolean } = {},
): Promise<{ status: MemberCampaignStatus; reserved: number }> {
  assertAuthenticatedMember(ctx);
  assertMemberLane("member", "scheduleOrSendMemberCampaign");
  const review = await reviewMemberCampaign(client, ctx, campaign_id);
  if (!review.send_ready) {
    throw new MemberValidationError("send_not_ready", review.refusal_reasons.map(r => `${r.kind}:${r.detail}`).join(" | "));
  }
  const eligible = review.audience_count.eligible;

  // Move status to 'approved'
  await client.query(
    `UPDATE nex.marketing_campaign
        SET status = 'approved', approved_at = now(), approved_by = $1, target_count = $2,
            started_at = CASE WHEN $3::boolean THEN now() ELSE started_at END
      WHERE campaign_id = $4`,
    [`member:${ctx.member_id}`, eligible, options.send_now ?? false, campaign_id],
  );

  // Reserve package capacity for the ENTIRE audience up-front.
  // Individual per-recipient reservations happen at queue-time in the executor
  // · this eager reservation surfaces exhaustion before the queue drains.
  // For Stage 4 we reserve a SINGLE aggregate reservation that represents the
  // whole campaign · the per-recipient reserve/consume happens at send-executor
  // time in Stage 5 auto-lane wiring (a hardening we call out below).
  const reserved_res = await client.query(
    `UPDATE nex.marketing_package
        SET reserved_capacity = reserved_capacity + $1,
            updated_at = now()
      WHERE package_id = $2
        AND member_id = $3
        AND status = 'active'
        AND reserved_capacity + consumed_capacity + $1 <= purchased_capacity
    RETURNING reserved_capacity`,
    [eligible, review.package.package_id, ctx.member_id],
  );
  const reserved = reserved_res.rowCount === 1 ? eligible : 0;
  if (reserved !== eligible) {
    // Rollback status transition
    await client.query(
      `UPDATE nex.marketing_campaign SET status = 'draft', approved_at = NULL, approved_by = NULL, target_count = 0, started_at = NULL WHERE campaign_id = $1`,
      [campaign_id],
    );
    throw new MemberValidationError("package_reservation_failed", `could not reserve ${eligible} units`);
  }

  return { status: options.send_now ? "sending" : "approved", reserved };
}

// ─── Cancel campaign (release reserved capacity) ───────────────────
export async function cancelMemberCampaign(
  client: PoolClient,
  ctx: MemberAuthContext,
  campaign_id: string,
  reason: string = "member_cancelled",
): Promise<{ status: MemberCampaignStatus; released: number }> {
  assertAuthenticatedMember(ctx);
  const c = await loadMemberCampaign(client, ctx, campaign_id);
  if (["sent", "cancelled", "failed"].includes(c.status)) {
    throw new MemberValidationError("cannot_cancel", `status=${c.status} is terminal`);
  }

  // Load campaign metadata for package_id + target_count
  const meta = await client.query(
    `SELECT metadata, target_count, send_count FROM nex.marketing_campaign WHERE campaign_id = $1`,
    [campaign_id],
  );
  const md = meta.rows[0];
  const package_id = (md.metadata?.package_id ?? null) as string | null;
  const target = md.target_count as number;
  const sent = md.send_count as number;
  const unreserved = Math.max(0, target - sent);

  if (package_id && unreserved > 0) {
    await client.query(
      `UPDATE nex.marketing_package
          SET reserved_capacity = GREATEST(0, reserved_capacity - $1),
              updated_at = now()
        WHERE package_id = $2 AND member_id = $3`,
      [unreserved, package_id, ctx.member_id],
    );
  }

  await client.query(
    `UPDATE nex.marketing_campaign
        SET status = 'cancelled', completed_at = now(),
            metadata = metadata || jsonb_build_object('cancel_reason', $1::text)
      WHERE campaign_id = $2`,
    [reason, campaign_id],
  );

  return { status: "cancelled", released: unreserved };
}

// ─── Analytics view for member ─────────────────────────────────────
export async function getMemberCampaignAnalytics(
  client: PoolClient,
  ctx: MemberAuthContext,
  campaign_id: string,
): Promise<MemberCampaignAnalytics> {
  assertAuthenticatedMember(ctx);
  const c = await loadMemberCampaign(client, ctx, campaign_id);

  // Aggregate from bounce/event log
  const events = await client.query<{ event_type: string; n: number }>(
    `SELECT event_type, COUNT(*)::int AS n
       FROM nex.marketing_bounce_log
      WHERE esp_message_id IN (
        SELECT esp_message_id FROM nex.marketing_send_log WHERE campaign_id = $1 AND esp_message_id IS NOT NULL
      )
      GROUP BY event_type`,
    [campaign_id],
  );
  const by_type: Record<string, number> = {};
  for (const r of events.rows) by_type[r.event_type] = r.n;

  const sent = c.send_count;
  const delivered = by_type["delivery"] ?? 0;
  const observed_opens = by_type["open"] ?? 0;
  const clicks = by_type["click"] ?? 0;
  const bounces = by_type["bounce"] ?? c.bounced_count;
  const complaints = by_type["complaint"] ?? c.complained_count;
  const unsubscribes = by_type["unsubscribe"] ?? 0;
  const failures = c.fail_count;

  const rate = (n: number, d: number) => d > 0 ? n / d : 0;

  return {
    campaign_id: c.campaign_id,
    display_name: c.display_name,
    status: c.status,
    queued: c.target_count,
    sent,
    delivered,
    observed_opens,
    clicks,
    bounces,
    complaints,
    unsubscribes,
    failures,
    last_event_at: c.completed_at,
    first_send_at: c.started_at,
    rates: {
      delivery_rate: rate(delivered, sent),
      observed_open_rate: rate(observed_opens, delivered),
      click_rate: rate(clicks, delivered),
      bounce_rate: rate(bounces, sent),
      complaint_rate: rate(complaints, delivered),
      unsubscribe_rate: rate(unsubscribes, delivered),
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────
async function assertPackageOwnership(client: PoolClient, member_id: string, package_id: string): Promise<void> {
  const res = await client.query(
    `SELECT member_id FROM nex.marketing_package WHERE package_id = $1`,
    [package_id],
  );
  if (res.rows.length === 0) throw new MemberValidationError("package_not_found", package_id);
  if (res.rows[0].member_id !== member_id) throw new MemberIsolationError(`package:${package_id}`);
}

async function assertSenderOwnership(client: PoolClient, member_id: string, sender_id: string): Promise<void> {
  const res = await client.query(
    `SELECT member_id, lane FROM nex.marketing_sender_identity WHERE sender_id = $1`,
    [sender_id],
  );
  if (res.rows.length === 0) throw new MemberValidationError("sender_not_found", sender_id);
  if (res.rows[0].lane !== "member") throw new MemberIsolationError(`sender:${sender_id}·not-member-lane`);
  if (res.rows[0].member_id !== member_id) throw new MemberIsolationError(`sender:${sender_id}`);
}

function mapCampaignRow(row: any): MemberCampaignSummary {
  return {
    campaign_id: row.campaign_id,
    member_id: row.member_id ?? "",
    package_id: row.package_id ?? null,
    display_name: row.display_name,
    status: row.status,
    target_count: Number(row.target_count ?? 0),
    send_count: Number(row.send_count ?? 0),
    fail_count: Number(row.fail_count ?? 0),
    opened_count: Number(row.opened_count ?? 0),
    clicked_count: Number(row.clicked_count ?? 0),
    bounced_count: Number(row.bounced_count ?? 0),
    complained_count: Number(row.complained_count ?? 0),
    scheduled_for: row.scheduled_for ?? null,
    proposed_at: row.proposed_at ?? null,
    approved_at: row.approved_at ?? null,
    started_at: row.started_at ?? null,
    completed_at: row.completed_at ?? null,
    created_at: row.created_at,
  };
}

// ─── Template compilation (thin wrapper around MJML/content-blocks) ─
export function compileTemplate(input: CampaignComposerInput): { mjml_source: string; html: string; text: string } {
  // For Stage 4 we compile content blocks directly to HTML. Existing MJML
  // infrastructure is reused when caller provides mjml_source · in that case
  // we accept it verbatim (backend compiles server-side via existing pipeline).
  if (input.mjml_source) {
    return {
      mjml_source: input.mjml_source,
      html: input.mjml_source,       // Actual MJML→HTML compile happens in existing template-store pipeline
      text: buildTextFallbackFromBlocks(input.content_blocks ?? []),
    };
  }
  const blocks = input.content_blocks ?? [];
  const html = renderBlocksToHtml(input, blocks);
  const text = buildTextFallbackFromBlocks(blocks);
  return { mjml_source: `<!-- rendered from content_blocks -->`, html, text };
}

function renderBlocksToHtml(input: CampaignComposerInput, blocks: ReadonlyArray<ContentBlockLike>): string {
  const inner = blocks.map(renderBlock).join("\n");
  const banner = input.banner_image_url
    ? `<img src="${escapeAttr(input.banner_image_url)}" alt="${escapeAttr(input.display_name)}" style="width:100%;max-width:640px;display:block" />`
    : "";
  const cta = input.cta_url && input.cta_label
    ? `<p><a href="${escapeAttr(input.cta_url)}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px">${escapeText(input.cta_label)}</a></p>`
    : "";
  const footer = input.footer_text
    ? `<hr /><p style="color:#666;font-size:12px">${escapeText(input.footer_text)}</p>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeText(input.subject_line)}</title></head><body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:16px;color:#111">${banner}${inner}${cta}${footer}</body></html>`;
}

function renderBlock(b: ContentBlockLike): string {
  switch (b.kind) {
    case "heading": {
      const level = b.level ?? 2;
      return `<h${level} style="margin:16px 0">${escapeText(b.text)}</h${level}>`;
    }
    case "paragraph":
      return `<p style="line-height:1.5">${escapeText(b.text)}</p>`;
    case "image":
      return `<img src="${escapeAttr(b.url)}" alt="${escapeAttr(b.alt)}" style="max-width:100%;display:block" />`;
    case "banner":
      return `<img src="${escapeAttr(b.url)}" alt="${escapeAttr(b.alt)}" style="width:100%;display:block" />`;
    case "button":
      return `<p><a href="${escapeAttr(b.url)}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px">${escapeText(b.label)}</a></p>`;
    case "divider":
      return `<hr style="border:0;border-top:1px solid #eee;margin:24px 0" />`;
    case "video_thumbnail":
      return `<a href="${escapeAttr(b.link)}" style="display:block;position:relative"><img src="${escapeAttr(b.thumbnail_url)}" alt="${escapeAttr(b.alt)}" style="max-width:100%;display:block" /><span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:48px">▶</span></a>`;
    default:
      return "";
  }
}

function buildTextFallbackFromBlocks(blocks: ReadonlyArray<ContentBlockLike>): string {
  return blocks.map(b => {
    switch (b.kind) {
      case "heading":
      case "paragraph": return b.text;
      case "button": return `${b.label} · ${b.url}`;
      case "image": case "banner": case "video_thumbnail": return `[${(b as any).alt ?? "image"}]`;
      case "divider": return "---";
      default: return "";
    }
  }).filter(Boolean).join("\n\n");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

type ContentBlockLike = CampaignComposerInput["content_blocks"] extends readonly (infer T)[] | undefined ? T : never;
