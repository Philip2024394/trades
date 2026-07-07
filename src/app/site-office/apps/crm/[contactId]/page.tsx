// /site-office/apps/crm/[contactId] — 360° contact view.

import { notFound, redirect } from "next/navigation";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { loadContactSummary } from "@/lib/crm/loadContactTimeline";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ContactDetail } from "./ContactDetail";

export const dynamic = "force-dynamic";

export default async function CrmContactPage({
  params,
  searchParams
}: {
  params: Promise<{ contactId: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const [{ contactId }, sp] = await Promise.all([params, searchParams]);
  const merchantId = await getMerchantIdFromRequest(sp.m || null);
  if (!merchantId) {
    redirect(`/site-office?next=/site-office/apps/crm/${contactId}`);
  }
  const summary = await loadContactSummary(contactId, merchantId);
  if (!summary) notFound();

  const { data: merchant } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("display_name, trading_name")
    .eq("id", merchantId)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <ContactDetail
        summary={summary}
        merchantDisplayName={
          merchant?.trading_name || merchant?.display_name || "we"
        }
      />
    </div>
  );
}
