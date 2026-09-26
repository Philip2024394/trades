// src/lib/nex-native/email-service.ts
//
// Wave C Slice 11a · Email Marketing backend.
// ---------------------------------------------
// CRUD for nex_email_list + nex_email_subscriber (migration 036).
// Compose/send/log/analytics are follow-up slices (11b-11e).
//
// Doctrine:
//   · Business owns its list · caller-side ownership check via action layer
//   · Subscriber emails lowered + shape-checked before write · DB CHECK is the
//     defence-in-depth
//   · Unsubscribe is SOFT (unsubscribed_at set) · row remains
//   · unsubscribe_token generated app-side via crypto.randomBytes(16).hex

import "server-only";
import { randomBytes } from "node:crypto";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid, NexTimestamp } from "./types";

export interface NexEmailListRow {
  id: NexUuid;
  business_id: NexUuid;
  name: string;
  description: string | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export interface NexEmailSubscriberRow {
  id: NexUuid;
  list_id: NexUuid;
  email: string;
  unsubscribe_token: string;
  subscribed_at: NexTimestamp;
  unsubscribed_at: NexTimestamp | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

// Same shape as the DB CHECK · used app-side for early rejection.
const EMAIL_SHAPE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export const NEX_EMAIL_LIST_NAME_MIN = 1 as const;
export const NEX_EMAIL_LIST_NAME_MAX = 100 as const;
export const NEX_EMAIL_LIST_DESC_MAX = 500 as const;

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export async function createList(input: {
  business_id: NexUuid;
  name: string;
  description?: string | null;
}): Promise<NexEmailListRow> {
  const name = input.name.trim();
  if (name.length < NEX_EMAIL_LIST_NAME_MIN || name.length > NEX_EMAIL_LIST_NAME_MAX) {
    throw new Error(
      `email-service.createList: name must be ${NEX_EMAIL_LIST_NAME_MIN}..${NEX_EMAIL_LIST_NAME_MAX} chars`,
    );
  }
  let description: string | null = null;
  if (input.description !== undefined && input.description !== null) {
    const d = input.description.trim();
    if (d.length > NEX_EMAIL_LIST_DESC_MAX) {
      throw new Error(`email-service.createList: description max ${NEX_EMAIL_LIST_DESC_MAX} chars`);
    }
    description = d.length === 0 ? null : d;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_list")
    .insert({ business_id: input.business_id, name, description })
    .select("*")
    .single();
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      throw new Error("email-service.createList: a list with that name already exists for this business");
    }
    throw new Error(`email-service.createList: ${error.message}`);
  }
  return data as NexEmailListRow;
}

export async function listListsByBusiness(businessId: NexUuid): Promise<NexEmailListRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_list")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`email-service.listListsByBusiness: ${error.message}`);
  return (data as NexEmailListRow[]) ?? [];
}

export async function getListById(id: NexUuid): Promise<NexEmailListRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_list")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`email-service.getListById: ${error.message}`);
  return (data as NexEmailListRow | null) ?? null;
}

export async function updateList(
  id: NexUuid,
  patch: { name?: string; description?: string | null },
): Promise<NexEmailListRow> {
  const update: Record<string, string | null> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < NEX_EMAIL_LIST_NAME_MIN || name.length > NEX_EMAIL_LIST_NAME_MAX) {
      throw new Error(
        `email-service.updateList: name must be ${NEX_EMAIL_LIST_NAME_MIN}..${NEX_EMAIL_LIST_NAME_MAX} chars`,
      );
    }
    update.name = name;
  }
  if (patch.description !== undefined) {
    if (patch.description === null) {
      update.description = null;
    } else {
      const d = patch.description.trim();
      if (d.length > NEX_EMAIL_LIST_DESC_MAX) {
        throw new Error(`email-service.updateList: description max ${NEX_EMAIL_LIST_DESC_MAX} chars`);
      }
      update.description = d.length === 0 ? null : d;
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_list")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`email-service.updateList: ${error.message}`);
  return data as NexEmailListRow;
}

export async function deleteList(id: NexUuid): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_email_list")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`email-service.deleteList: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

function generateUnsubscribeToken(): string {
  return randomBytes(16).toString("hex");  // 32 hex chars
}

/**
 * Add a subscriber to a list.
 * Idempotent: if the email is already on the list, return the existing row
 * · if the row is currently unsubscribed, this re-subscribes (clears
 * unsubscribed_at + fresh subscribed_at timestamp).
 */
export async function addSubscriber(input: {
  list_id: NexUuid;
  email: string;
}): Promise<NexEmailSubscriberRow> {
  const emailLower = input.email.trim().toLowerCase();
  if (!EMAIL_SHAPE.test(emailLower)) {
    throw new Error(`email-service.addSubscriber: invalid email shape · got '${emailLower}'`);
  }
  const existing = await nexSupabaseAdmin
    .from("nex_email_subscriber")
    .select("*")
    .eq("list_id", input.list_id)
    .eq("email", emailLower)
    .maybeSingle();
  if (existing.error) throw new Error(`email-service.addSubscriber lookup · ${existing.error.message}`);
  if (existing.data) {
    const row = existing.data as NexEmailSubscriberRow;
    if (row.unsubscribed_at === null) return row;  // already active · idempotent
    // Re-subscribe
    const now = new Date().toISOString();
    const { data, error } = await nexSupabaseAdmin
      .from("nex_email_subscriber")
      .update({ unsubscribed_at: null, subscribed_at: now })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw new Error(`email-service.addSubscriber resubscribe · ${error.message}`);
    return data as NexEmailSubscriberRow;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_subscriber")
    .insert({
      list_id: input.list_id,
      email: emailLower,
      unsubscribe_token: generateUnsubscribeToken(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`email-service.addSubscriber insert · ${error.message}`);
  return data as NexEmailSubscriberRow;
}

/** Soft unsubscribe by subscriber id · sets unsubscribed_at to now. Idempotent. */
export async function unsubscribeById(subscriberId: NexUuid): Promise<NexEmailSubscriberRow> {
  const now = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_subscriber")
    .update({ unsubscribed_at: now })
    .eq("id", subscriberId)
    .select("*")
    .single();
  if (error) throw new Error(`email-service.unsubscribeById · ${error.message}`);
  return data as NexEmailSubscriberRow;
}

/** Soft unsubscribe via token (used by the unsubscribe-page in a later slice). */
export async function unsubscribeByToken(token: string): Promise<NexEmailSubscriberRow | null> {
  const found = await nexSupabaseAdmin
    .from("nex_email_subscriber")
    .select("*")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (found.error) throw new Error(`email-service.unsubscribeByToken lookup · ${found.error.message}`);
  if (!found.data) return null;
  return unsubscribeById((found.data as { id: string }).id);
}

// ---------------------------------------------------------------------------
// Campaigns · Wave C Slice 11c
// ---------------------------------------------------------------------------

export type NexEmailCampaignStatus = "draft" | "scheduled" | "sent" | "cancelled";
export const NEX_EMAIL_CAMPAIGN_STATUSES: readonly NexEmailCampaignStatus[] = [
  "draft", "scheduled", "sent", "cancelled",
] as const;

export interface NexEmailCampaignRow {
  id: NexUuid;
  list_id: NexUuid;
  subject: string;
  body_text: string;
  body_html: string | null;
  status: NexEmailCampaignStatus;
  scheduled_for: NexTimestamp | null;
  sent_at: NexTimestamp | null;
  sent_count: number;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export const NEX_EMAIL_CAMPAIGN_SUBJECT_MAX = 200 as const;
export const NEX_EMAIL_CAMPAIGN_BODY_MAX = 50000 as const;

function normaliseSubject(raw: string): string {
  const s = raw.trim();
  if (s.length < 1 || s.length > NEX_EMAIL_CAMPAIGN_SUBJECT_MAX) {
    throw new Error(
      `email-service · subject must be 1..${NEX_EMAIL_CAMPAIGN_SUBJECT_MAX} chars`,
    );
  }
  return s;
}

function normaliseBodyText(raw: string): string {
  const s = raw.trim();
  if (s.length < 1 || s.length > NEX_EMAIL_CAMPAIGN_BODY_MAX) {
    throw new Error(
      `email-service · body_text must be 1..${NEX_EMAIL_CAMPAIGN_BODY_MAX} chars`,
    );
  }
  return s;
}

function normaliseBodyHtml(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const s = raw.trim();
  if (s.length === 0) return null;
  if (s.length > NEX_EMAIL_CAMPAIGN_BODY_MAX) {
    throw new Error(
      `email-service · body_html max ${NEX_EMAIL_CAMPAIGN_BODY_MAX} chars`,
    );
  }
  return s;
}

export async function createCampaign(input: {
  list_id: NexUuid;
  subject: string;
  body_text: string;
  body_html?: string | null;
}): Promise<NexEmailCampaignRow> {
  const subject = normaliseSubject(input.subject);
  const bodyText = normaliseBodyText(input.body_text);
  const bodyHtml = normaliseBodyHtml(input.body_html);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_campaign")
    .insert({
      list_id: input.list_id,
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw new Error(`email-service.createCampaign: ${error.message}`);
  return data as NexEmailCampaignRow;
}

export async function listCampaignsByList(listId: NexUuid): Promise<NexEmailCampaignRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_campaign")
    .select("*")
    .eq("list_id", listId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`email-service.listCampaignsByList: ${error.message}`);
  return (data as NexEmailCampaignRow[]) ?? [];
}

export async function getCampaignById(id: NexUuid): Promise<NexEmailCampaignRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_campaign")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`email-service.getCampaignById: ${error.message}`);
  return (data as NexEmailCampaignRow | null) ?? null;
}

export async function updateCampaign(
  id: NexUuid,
  patch: { subject?: string; body_text?: string; body_html?: string | null },
): Promise<NexEmailCampaignRow> {
  // Only draft campaigns can be edited · scheduled/sent are immutable.
  const existing = await getCampaignById(id);
  if (!existing) throw new Error("email-service.updateCampaign: campaign not found");
  if (existing.status !== "draft") {
    throw new Error(`email-service.updateCampaign: only draft campaigns are editable · current status='${existing.status}'`);
  }
  const update: Record<string, string | null> = {};
  if (patch.subject !== undefined) update.subject = normaliseSubject(patch.subject);
  if (patch.body_text !== undefined) update.body_text = normaliseBodyText(patch.body_text);
  if (patch.body_html !== undefined) update.body_html = normaliseBodyHtml(patch.body_html);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_campaign")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`email-service.updateCampaign: ${error.message}`);
  return data as NexEmailCampaignRow;
}

export async function deleteCampaign(id: NexUuid): Promise<void> {
  const existing = await getCampaignById(id);
  if (!existing) return;  // idempotent
  if (existing.status === "sent") {
    throw new Error("email-service.deleteCampaign: sent campaigns cannot be deleted · preserved for audit");
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_email_campaign")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`email-service.deleteCampaign: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Slice 11d · Send-log + dispatchCampaign
// ---------------------------------------------------------------------------
import { DEFAULT_ADAPTER, type SendAdapter } from "./email-send-adapter";

export type NexEmailSendLogStatus = "queued" | "sent" | "failed" | "skipped";
export interface NexEmailSendLogRow {
  id: NexUuid;
  campaign_id: NexUuid;
  subscriber_id: NexUuid;
  status: NexEmailSendLogStatus;
  error_message: string | null;
  sent_at: NexTimestamp | null;
  created_at: NexTimestamp;
}

export async function listSendLogForCampaign(campaignId: NexUuid): Promise<NexEmailSendLogRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_send_log")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`email-service.listSendLogForCampaign: ${error.message}`);
  return (data as NexEmailSendLogRow[]) ?? [];
}

export interface DispatchResult {
  campaign: NexEmailCampaignRow;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  adapter_name: string;
  adapter_is_dry_run: boolean;
}

/**
 * Dispatch a draft campaign. Only draft campaigns dispatch · after dispatch
 * the campaign is 'sent' and immutable. Iterates active subscribers · calls
 * the adapter · records one log row per subscriber. Unsubscribed subscribers
 * are recorded with status='skipped' so the audit trail is complete.
 */
export async function dispatchCampaign(
  campaignId: NexUuid,
  opts: { adapter?: SendAdapter; unsubscribe_base_url?: string; from_business_name?: string } = {},
): Promise<DispatchResult> {
  const adapter = opts.adapter ?? DEFAULT_ADAPTER;
  const campaign = await getCampaignById(campaignId);
  if (!campaign) throw new Error(`email-service.dispatchCampaign: campaign ${campaignId} not found`);
  if (campaign.status !== "draft") {
    throw new Error(`email-service.dispatchCampaign: only draft campaigns can be dispatched · current status='${campaign.status}'`);
  }

  // Subscribers list · include unsubscribed so we can log skipped rows explicitly
  const allSubs = await listSubscribers(campaign.list_id, { include_unsubscribed: true, limit: 5000 });
  const unsubBase = opts.unsubscribe_base_url ?? "http://localhost:3008/nex-native/unsubscribe";

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const sub of allSubs) {
    if (sub.unsubscribed_at !== null) {
      const { error } = await nexSupabaseAdmin.from("nex_email_send_log").insert({
        campaign_id: campaign.id,
        subscriber_id: sub.id,
        status: "skipped",
        error_message: "subscriber unsubscribed",
      });
      if (error) throw new Error(`email-service.dispatchCampaign · skipped log · ${error.message}`);
      skipped++;
      continue;
    }
    const unsubscribeUrl = `${unsubBase}/${sub.unsubscribe_token}`;
    let result;
    try {
      result = await adapter.send({
        to: sub.email,
        subject: campaign.subject,
        body_text: campaign.body_text,
        body_html: campaign.body_html,
        from_business_name: opts.from_business_name,
        unsubscribe_url: unsubscribeUrl,
      });
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    const status: NexEmailSendLogStatus = result.ok ? "sent" : "failed";
    const errorMsg = result.ok ? null : (result.error ?? "unknown error").slice(0, 500);
    const sentAt = result.ok ? new Date().toISOString() : null;
    const { error } = await nexSupabaseAdmin.from("nex_email_send_log").insert({
      campaign_id: campaign.id,
      subscriber_id: sub.id,
      status,
      error_message: errorMsg,
      sent_at: sentAt,
    });
    if (error) throw new Error(`email-service.dispatchCampaign · log insert · ${error.message}`);
    if (result.ok) sent++;
    else failed++;
  }

  const finalCampaign = await markCampaignSent(campaign.id, sent);
  return {
    campaign: finalCampaign,
    attempted: allSubs.length,
    sent,
    failed,
    skipped,
    adapter_name: adapter.name,
    adapter_is_dry_run: adapter.is_dry_run,
  };
}

/** Mark a campaign as sent · used by Slice 11d send infrastructure. */
export async function markCampaignSent(id: NexUuid, sentCount: number): Promise<NexEmailCampaignRow> {
  if (!Number.isInteger(sentCount) || sentCount < 0) {
    throw new Error("email-service.markCampaignSent: sent_count must be non-negative integer");
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_email_campaign")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_count: sentCount,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`email-service.markCampaignSent: ${error.message}`);
  return data as NexEmailCampaignRow;
}

/** List subscribers on a list. Default: active only (unsubscribed_at IS NULL). */
export async function listSubscribers(
  listId: NexUuid,
  opts: { include_unsubscribed?: boolean; limit?: number } = {},
): Promise<NexEmailSubscriberRow[]> {
  const limit = Math.max(1, Math.min(5000, opts.limit ?? 500));
  let q = nexSupabaseAdmin
    .from("nex_email_subscriber")
    .select("*")
    .eq("list_id", listId)
    .order("subscribed_at", { ascending: false })
    .limit(limit);
  if (!opts.include_unsubscribed) {
    q = q.is("unsubscribed_at", null);
  }
  const { data, error } = await q;
  if (error) throw new Error(`email-service.listSubscribers: ${error.message}`);
  return (data as NexEmailSubscriberRow[]) ?? [];
}
