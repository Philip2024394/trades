// Publication + channel connection loader.

import { createClient } from "@supabase/supabase-js";
import type { ChannelId } from "@/lib/llm/composeForChannel";
import type {
  MerchantChannelConnection,
  Publication,
  PublicationStatus
} from "./types";

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type PubRow = {
  id: string;
  merchant_id: string;
  event_id: string;
  channel: string;
  connection_id: string | null;
  rendered_content: Record<string, unknown>;
  status: PublicationStatus;
  hold_reason: string | null;
  scheduled_for: string;
  posted_at: string | null;
  external_id: string | null;
  external_permalink: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function rowToPub(row: PubRow): Publication {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    eventId: row.event_id,
    channel: row.channel as ChannelId,
    connectionId: row.connection_id,
    renderedContent: row.rendered_content ?? {},
    status: row.status,
    holdReason: row.hold_reason,
    scheduledFor: row.scheduled_for,
    postedAt: row.posted_at,
    externalId: row.external_id,
    externalPermalink: row.external_permalink,
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function activeConnectionsForMerchant(
  merchantId: string
): Promise<MerchantChannelConnection[]> {
  const c = client();
  if (!c) return [];
  const { data } = await c
    .from("merchant_channel_connections")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("status", "active");
  return (data ?? []).map((r) => {
    const row = r as {
      id: string;
      merchant_id: string;
      channel: string;
      external_account_id: string;
      display_name: string | null;
      status: string;
      connected_at: string;
      last_used_at: string | null;
    };
    return {
      id: row.id,
      merchantId: row.merchant_id,
      channel: row.channel as ChannelId,
      externalAccountId: row.external_account_id,
      displayName: row.display_name,
      status: row.status as MerchantChannelConnection["status"],
      connectedAt: row.connected_at,
      lastUsedAt: row.last_used_at
    };
  });
}

export async function insertPublication(input: {
  merchantId: string;
  eventId: string;
  channel: ChannelId;
  connectionId?: string;
  renderedContent: Record<string, unknown>;
  scheduledMinutesFromNow?: number;
}): Promise<Publication | null> {
  const c = client();
  if (!c) return null;
  const scheduledFor = new Date(
    Date.now() + (input.scheduledMinutesFromNow ?? 60) * 60 * 1000
  ).toISOString();
  const { data, error } = await c
    .from("publications")
    .upsert(
      {
        merchant_id: input.merchantId,
        event_id: input.eventId,
        channel: input.channel,
        connection_id: input.connectionId ?? null,
        rendered_content: input.renderedContent,
        status: "scheduled",
        scheduled_for: scheduledFor
      },
      { onConflict: "event_id,channel" }
    )
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return rowToPub(data as PubRow);
}

export async function loadDuePublications(
  merchantId: string
): Promise<Publication[]> {
  const c = client();
  if (!c) return [];
  const { data } = await c
    .from("publications")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .limit(50);
  return (data ?? []).map((r) => rowToPub(r as PubRow));
}

export async function loadRecentPublications(
  merchantId: string,
  limit = 50
): Promise<Publication[]> {
  const c = client();
  if (!c) return [];
  const { data } = await c
    .from("publications")
    .select("*")
    .eq("merchant_id", merchantId)
    .neq("status", "archived")
    .order("scheduled_for", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => rowToPub(r as PubRow));
}

export async function markPublicationPosted(
  publicationId: string,
  externalId: string,
  externalPermalink: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c
    .from("publications")
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
      external_id: externalId,
      external_permalink: externalPermalink
    })
    .eq("id", publicationId);
  return !error;
}

export async function markPublicationFailed(
  publicationId: string,
  reason: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c
    .from("publications")
    .update({
      status: "failed",
      last_error: reason,
      attempts: 1
    })
    .eq("id", publicationId);
  return !error;
}

export async function holdPublication(
  merchantId: string,
  publicationId: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c
    .from("publications")
    .update({ status: "held", hold_reason: "merchant_paused" })
    .eq("merchant_id", merchantId)
    .eq("id", publicationId);
  return !error;
}
