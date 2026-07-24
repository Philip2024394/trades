// Fires when a merchant's washer balance is under 10 — enough to
// notice, few enough that they'll run out mid-week. Nudge routes to
// the washer top-up page.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SignalDetector } from "../types";

const LOW_THRESHOLD = 10;

export const washerLowDetector: SignalDetector = {
  kind:     "washer_low",
  surfaces: ["merchant"],
  async detect(ctx) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("washer_balance, tier")
      .eq("slug", ctx.userKey)
      .maybeSingle();
    if (!data) return null;
    const bal = typeof data.washer_balance === "number" ? data.washer_balance : null;
    if (bal === null || bal >= LOW_THRESHOLD) return null;

    const critical = bal <= 3;
    return {
      kind:         "washer_low",
      priority:     critical ? 1 : 3,
      title:        critical ? `Only ${bal} washers left` : `Washer balance low (${bal})`,
      body:         critical
        ? `You're on ${bal} washers. Next WhatsApp lead uses one and you're empty. Top up or you'll miss the next enquiry.`
        : `Balance is ${bal}. Top up before the next big enquiry or the WhatsApp button quietly stops working.`,
      action_url:   `/trade-off/edit/${ctx.userKey}/washers`,
      action_label: "Top up",
      metadata:     { balance: bal, tier: data.tier }
    };
  }
};
