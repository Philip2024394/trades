// Cron · every 15 min — drains scheduled publications for every
// active merchant.

import { NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron/authorise";
import { activeMerchantIds } from "@/lib/cron/merchants";
import {
  activeConnectionsForMerchant,
  loadDuePublications,
  markPublicationFailed,
  markPublicationPosted
} from "@/lib/publications/loader";
import { publishHandlerFor } from "@/lib/channels/registry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const merchants = await activeMerchantIds();
  const results: Array<{ merchantId: string; processed: number }> = [];
  for (const merchantId of merchants) {
    const due = await loadDuePublications(merchantId);
    if (due.length === 0) continue;
    const connections = await activeConnectionsForMerchant(merchantId);
    const connIndex = new Map(connections.map((c) => [c.id, c]));
    let processed = 0;
    for (const pub of due) {
      const handler = publishHandlerFor(pub.channel);
      const conn = pub.connectionId ? connIndex.get(pub.connectionId) : null;
      if (!handler || !conn) {
        await markPublicationFailed(
          pub.id,
          handler ? "channel_connection_missing" : "no_handler"
        );
        continue;
      }
      const result = await handler(pub, conn);
      if (result.ok && result.externalId) {
        await markPublicationPosted(
          pub.id,
          result.externalId,
          result.externalPermalink ?? ""
        );
        processed += 1;
      } else {
        await markPublicationFailed(pub.id, result.reason ?? "unknown");
      }
    }
    results.push({ merchantId, processed });
  }
  return NextResponse.json({ merchants: results.length, results });
}
