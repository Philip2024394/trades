// Cron · weekly Mon 04:00 UTC — recomputes trade-wide anonymised
// insights (best time / caption length / material mentions /
// baseline) so the composer prompts stay fresh.

import { NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron/authorise";
import { computeTradePatterns } from "@/lib/insights/tradePatterns";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const result = await computeTradePatterns();
  return NextResponse.json(result);
}
