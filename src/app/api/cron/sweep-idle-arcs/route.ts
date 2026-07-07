// Cron · daily 06:00 UTC — closes story arcs idle > 21 days across
// every active merchant. Delegates to the per-merchant sweep endpoint
// so idempotency + case-study emission behaviour is identical.

import { NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron/authorise";
import { activeMerchantIds } from "@/lib/cron/merchants";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const origin = new URL(request.url).origin;
  const merchants = await activeMerchantIds();
  const results: Array<{ merchantId: string; closed: number }> = [];
  for (const merchantId of merchants) {
    const res = await fetch(`${origin}/api/story-arcs/sweep-idle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId })
    });
    const data = (await res.json().catch(() => ({}))) as { closed?: number };
    results.push({ merchantId, closed: data.closed ?? 0 });
  }
  return NextResponse.json({ merchants: results.length, results });
}
