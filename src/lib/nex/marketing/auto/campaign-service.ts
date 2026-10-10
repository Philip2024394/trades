// src/lib/nex/marketing/auto/campaign-service.ts
//
// NEX Managed Email Marketing · Stage 5.5 · AUTO campaign orchestration
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a §10-§14).
//
// **Responsibility**: create/materialise AUTO campaigns correctly.
// This module does NOT send email. Delivery is the shared executor's job.
//
// Every AUTO campaign persists:
//   metadata.lane      = 'auto'
//   metadata.origin    = 'auto'
//   metadata.member_id = null (implicit · never a real member id)
//   metadata.policy_id = <policy row that authorised this campaign>
//   metadata.budget_id = <operating budget the policy points at>
//   metadata.trigger_ref = <TriggerEvent.target_id · optional but recorded when arrived via router>
//
// Idempotency: same (policy_id, source_reference, jurisdiction, campaign_intent)
// deterministically derives the same idempotency_key. A retry returns the
// existing campaign without creating a duplicate.

import type { PoolClient } from "pg";
import type { AutoCampaignPolicy } from "./types";
import { AutoLaneIsolationError } from "./types";
import { checkPolicy, type PolicyDecision } from "./policy";
import { deriveIdempotencyKey } from "../../durability/idempotency-key";
import { compileTemplate } from "../member/campaign-service";

// ─── Types ──────────────────────────────────────────────────────────
export interface AutoCampaignIntent {
  readonly policy_id: string;
  readonly source_reference: string;                 // discovery event reference (crawler URL · repo · feed id)
  readonly campaign_intent: string;                  // short semantic key describing WHAT this campaign is
  readonly country: string;
  readonly category: string | null;
  readonly language: string | null;
  readonly display_name: string;
  readonly subject_line: string;
  readonly body_text: string;
  readonly banner_image_url?: string;
  readonly cta_url?: string;
  readonly cta_label?: string;
  readonly footer_text?: string;
  readonly actor?: string;                           // 'system:trigger-router' | 'system:cron' | etc.
  readonly trigger_ref?: string;                     // optional TriggerEvent.target_id
  readonly content_approved?: boolean;
  readonly recent_daily_sends?: number;
}

export type AutoCampaignOutcome =
  | { kind: "created"; campaign_id: string; policy: AutoCampaignPolicy; idempotency_key: string }
  | { kind: "already_exists"; campaign_id: string; policy: AutoCampaignPolicy; idempotency_key: string }
  | { kind: "policy_denied"; decision: PolicyDecision };

// ─── Idempotency key ────────────────────────────────────────────────
export function deriveAutoCampaignKey(input: {
  policy_id: string;
  source_reference: string;
  campaign_intent: string;
  jurisdiction: string;
}): string {
  return deriveIdempotencyKey({
    workflow_id: `auto-campaign:${input.policy_id}`,
    activity_name: "auto_campaign_create",
    attempt_id: `${input.jurisdiction}:${input.campaign_intent}:${input.source_reference}`,
  });
}

// ─── Public API ─────────────────────────────────────────────────────
export async function createAutoCampaign(
  client: PoolClient,
  intent: AutoCampaignIntent,
): Promise<AutoCampaignOutcome> {
  // ─── 1 · Policy gate ────────────────────────────────────────────
  const decision = await checkPolicy(client, {
    policy_id: intent.policy_id,
    proposed_country: intent.country,
    proposed_category: intent.category,
    proposed_language: intent.language,
    proposed_sender_lane: "auto",
    recent_daily_sends: intent.recent_daily_sends,
    content_approved: intent.content_approved,
  });
  if (decision.kind === "denied") {
    return { kind: "policy_denied", decision };
  }
  const policy = decision.policy;

  const idempotency_key = deriveAutoCampaignKey({
    policy_id: intent.policy_id,
    source_reference: intent.source_reference,
    campaign_intent: intent.campaign_intent,
    jurisdiction: intent.country.toUpperCase(),
  });

  // ─── 2 · Idempotent replay check ────────────────────────────────
  const existing = await client.query(
    `SELECT campaign_id, metadata FROM nex.marketing_campaign
      WHERE COALESCE(metadata->>'auto_idempotency_key', '') = $1
      LIMIT 1`,
    [idempotency_key],
  );
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.metadata?.lane !== "auto") {
      throw new AutoLaneIsolationError(`idempotency_key ${idempotency_key} previously used by lane=${row.metadata?.lane}`);
    }
    return { kind: "already_exists", campaign_id: row.campaign_id, policy, idempotency_key };
  }

  // ─── 3 · Compile the template using existing NEX-native compiler ─
  const compiled = compileTemplate({
    display_name: intent.display_name,
    subject_line: intent.subject_line,
    from_email: `auto@nex`,                           // placeholder · real from_email resolved by executor via selectSender
    package_id: "auto-lane",                          // ignored by compileTemplate for AUTO · shape only
    sender_id: "auto-lane",
    audience: { country: intent.country, category: intent.category ?? undefined, language: intent.language ?? undefined },
    content_blocks: [
      ...(intent.banner_image_url ? [{ kind: "image" as const, url: intent.banner_image_url, alt: "Banner" }] : []),
      { kind: "paragraph" as const, text: intent.body_text },
      ...(intent.cta_url && intent.cta_label ? [{ kind: "cta" as const, url: intent.cta_url, label: intent.cta_label }] : []),
    ],
    footer_text: intent.footer_text ?? "Sent via NEX · thenetworkers.app · one-click unsubscribe below.",
  });

  const slug = `auto-${idempotency_key.slice(0, 12)}`;

  // ─── 4 · Insert template ────────────────────────────────────────
  const tres = await client.query(
    `INSERT INTO nex.marketing_template
       (slug, display_name, subject_line, from_email, from_name, reply_to,
        mjml_source, html_compiled, text_fallback,
        banner_image_url, cta_url, variables, language)
     VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6, $7, $8, $9, $10::jsonb, $11)
     RETURNING template_id`,
    [
      `tmpl-${slug}`, intent.display_name, intent.subject_line,
      // Real from_email is chosen by the executor via selectSender at claim time.
      // We store a placeholder here so downstream template read still has a value;
      // the executor OVERRIDES it with the resolved sender's email at send time.
      `auto-placeholder@nex.local`,
      compiled.mjml_source, compiled.html, compiled.text,
      intent.banner_image_url ?? null, intent.cta_url ?? null,
      JSON.stringify({ campaign_intent: intent.campaign_intent }),
      intent.language ?? "en",
    ],
  );
  const template_id = tres.rows[0].template_id;

  // ─── 5 · Insert segment (audience shape) ────────────────────────
  const sres = await client.query(
    `INSERT INTO nex.marketing_segment
       (slug, display_name, country, city, language, category_slug, extra_where)
     VALUES ($1, $2, $3, NULL, $4, $5, NULL)
     RETURNING segment_id`,
    [
      `seg-${slug}`, `AUTO audience · ${intent.display_name}`,
      intent.country.toUpperCase(), intent.language ?? null, intent.category ?? null,
    ],
  );
  const segment_id = sres.rows[0].segment_id;

  // ─── 6 · Insert campaign with locked AUTO metadata ──────────────
  const cres = await client.query(
    `INSERT INTO nex.marketing_campaign
       (slug, display_name, template_id, segment_id, status, metadata, proposed_at)
     VALUES ($1, $2, $3, $4, 'draft', $5::jsonb, now())
     RETURNING campaign_id`,
    [
      slug, intent.display_name, template_id, segment_id,
      JSON.stringify({
        lane: "auto",
        origin: "auto",
        member_id: null,                              // canonical null · never overwritten
        policy_id: policy.policy_id,
        budget_id: policy.budget_id,
        source_reference: intent.source_reference,
        campaign_intent: intent.campaign_intent,
        trigger_ref: intent.trigger_ref ?? null,
        auto_idempotency_key: idempotency_key,
        actor: intent.actor ?? "system:auto",
      }),
    ],
  );
  return {
    kind: "created",
    campaign_id: cres.rows[0].campaign_id,
    policy,
    idempotency_key,
  };
}

// ─── Populate queue for an AUTO campaign ────────────────────────────
/** Materialise the eligible audience into `nex.marketing_send_queue`.
 *  Executor picks up from there. Idempotent · ON CONFLICT DO NOTHING. */
export async function populateAutoCampaignQueue(
  client: PoolClient,
  campaign_id: string,
): Promise<{ queued: number }> {
  const c = await client.query(
    `SELECT c.segment_id, c.metadata
       FROM nex.marketing_campaign c
      WHERE c.campaign_id = $1 AND COALESCE(c.metadata->>'lane', '') = 'auto'`,
    [campaign_id],
  );
  const row = c.rows[0];
  if (!row) throw new AutoLaneIsolationError(`campaign ${campaign_id} is not AUTO or does not exist`);
  const seg = await client.query(
    `SELECT country, category_slug, language FROM nex.marketing_segment WHERE segment_id = $1`,
    [row.segment_id],
  );
  const s = seg.rows[0] ?? { country: null, category_slug: null, language: null };
  const filters: string[] = ["opt_out = false", "hard_bounced = false", "complaint_count = 0"];
  const params: unknown[] = [];
  const push = (col: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return;
    params.push(v);
    filters.push(`${col} = $${params.length}`);
  };
  push("country", s.country);
  push("category_slug", s.category_slug);
  push("language", s.language);
  const contacts = await client.query(
    `SELECT contact_id, email FROM nex.marketing_contact WHERE ${filters.join(" AND ")}`,
    params,
  );
  let queued = 0;
  for (const row2 of contacts.rows) {
    const r = await client.query(
      `INSERT INTO nex.marketing_send_queue (campaign_id, contact_id, email, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT DO NOTHING`,
      [campaign_id, row2.contact_id, row2.email],
    );
    if ((r.rowCount ?? 0) > 0) queued += 1;
  }
  // Mark approved + started
  await client.query(
    `UPDATE nex.marketing_campaign
        SET status = 'approved', approved_at = now(), approved_by = 'system:auto',
            target_count = $1, started_at = COALESCE(started_at, now())
      WHERE campaign_id = $2 AND COALESCE(metadata->>'lane', '') = 'auto'`,
    [queued, campaign_id],
  );
  return { queued };
}
