// POST /api/publications/publish-due
//
// The "drain" endpoint — walks the scheduled publications past their
// scheduled_for and hands them to their channel publisher. For MVP
// this is called manually (or by a cron); a later phase moves it to
// a Supabase Edge Function scheduled trigger.
//
// Body: { merchantId }

import { NextResponse } from "next/server";
import {
  activeConnectionsForMerchant,
  loadDuePublications,
  markPublicationFailed,
  markPublicationPosted
} from "@/lib/publications/loader";
import { publishHandlerFor } from "@/lib/channels/registry";

export const runtime = "nodejs";

type Body = { merchantId?: string };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.merchantId) {
    return NextResponse.json(
      { error: "merchantId required" },
      { status: 400 }
    );
  }
  const merchantId = body.merchantId;
  const due = await loadDuePublications(merchantId);
  const connections = await activeConnectionsForMerchant(merchantId);
  const connIndex = new Map(connections.map((c) => [c.id, c]));

  const outcomes: Array<{
    id: string;
    channel: string;
    status: string;
    reason?: string;
  }> = [];

  for (const pub of due) {
    const handler = publishHandlerFor(pub.channel);
    const conn = pub.connectionId ? connIndex.get(pub.connectionId) : null;
    if (!handler) {
      await markPublicationFailed(pub.id, "no_handler_for_channel");
      outcomes.push({
        id: pub.id,
        channel: pub.channel,
        status: "failed",
        reason: "no_handler_for_channel"
      });
      continue;
    }
    if (!conn) {
      await markPublicationFailed(pub.id, "channel_connection_missing");
      outcomes.push({
        id: pub.id,
        channel: pub.channel,
        status: "failed",
        reason: "channel_connection_missing"
      });
      continue;
    }
    const result = await handler(pub, conn);
    if (result.ok && result.externalId) {
      await markPublicationPosted(
        pub.id,
        result.externalId,
        result.externalPermalink ?? ""
      );
      outcomes.push({ id: pub.id, channel: pub.channel, status: "posted" });
    } else {
      await markPublicationFailed(pub.id, result.reason ?? "unknown_error");
      outcomes.push({
        id: pub.id,
        channel: pub.channel,
        status: "failed",
        reason: result.reason
      });
    }
  }

  return NextResponse.json({ processed: outcomes.length, outcomes });
}
