// Cron · monthly 1st 09:00 UTC — composes and sends the monthly
// digest for every merchant with a subscriber email on file.
//
// For MVP we don't have a merchant email store — the cron only
// operates if the merchant row has a NEWSLETTER_FROM env override AND
// a service-role Supabase; production wires this to a merchants table
// with newsletter_email + newsletter_from_name columns.

import { NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron/authorise";
import { activeMerchantIds } from "@/lib/cron/merchants";
import { composeMonthlyDigest } from "@/lib/repurpose/monthlyDigest";
import { deliverMonthlyDigest } from "@/lib/repurpose/deliverDigest";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const supaUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const c = supaUrl && supaKey ? createClient(supaUrl, supaKey, { auth: { persistSession: false } }) : null;
  const merchants = await activeMerchantIds();
  const results: Array<{
    merchantId: string;
    status: "sent" | "no_draft" | "no_email" | "delivery_failed";
    reason?: string;
  }> = [];
  for (const merchantId of merchants) {
    const draft = await composeMonthlyDigest(merchantId);
    if (!draft) {
      results.push({ merchantId, status: "no_draft" });
      continue;
    }
    // Optional merchant profile row for newsletter email + brand.
    let toEmail: string | null = null;
    let fromName: string | undefined;
    let fromEmail: string | undefined;
    if (c) {
      const { data } = await c
        .from("merchants")
        .select("newsletter_email, newsletter_from_name, newsletter_from_email")
        .eq("id", merchantId)
        .maybeSingle();
      if (data) {
        const row = data as {
          newsletter_email?: string | null;
          newsletter_from_name?: string | null;
          newsletter_from_email?: string | null;
        };
        toEmail = row.newsletter_email ?? null;
        fromName = row.newsletter_from_name ?? undefined;
        fromEmail = row.newsletter_from_email ?? undefined;
      }
    }
    if (!toEmail) {
      results.push({ merchantId, status: "no_email" });
      continue;
    }
    const delivered = await deliverMonthlyDigest({
      merchantId,
      toEmail,
      fromName,
      fromEmail,
      draft
    });
    results.push({
      merchantId,
      status: delivered.ok ? "sent" : "delivery_failed",
      reason: delivered.reason
    });
  }
  return NextResponse.json({ merchants: results.length, results });
}
