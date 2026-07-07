// Cron · weekly Mon 07:00 UTC — runs the predictive Gold Path pass
// per merchant. Populates each merchant's weekly guide before they
// open the app on Monday.

import { NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron/authorise";
import { activeMerchantIds } from "@/lib/cron/merchants";
import { runPredictiveGoldPath } from "@/lib/gold-path/predictive";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const merchants = await activeMerchantIds();
  const results = [];
  for (const merchantId of merchants) {
    const r = await runPredictiveGoldPath(merchantId);
    results.push(r);
  }
  return NextResponse.json({ merchants: results.length, results });
}
