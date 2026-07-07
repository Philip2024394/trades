// /home/trades/[tradeId]/pay
//
// Owner records a payment to a trade. Screenshot a bank transfer or
// snap a receipt — AI (when configured) prefills the total, date,
// method, materials and labour splits. Owner confirms and saves.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Receipt } from "lucide-react";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PayForm } from "./PayForm";

export const dynamic = "force-dynamic";

type Params = { tradeId: string };

export default async function PayPage({
  params
}: {
  params: Promise<Params>;
}) {
  const party = await loadHomeownerSession();
  const { tradeId } = await params;
  if (!party) {
    redirect(`/home/sign-in?next=/home/trades/${tradeId}/pay`);
  }

  const { data: trade } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, display_name, primary_trade")
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade) {
    notFound();
  }

  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.12) 0%, transparent 60%)"
        }}
      />

      <div className="relative mx-auto max-w-2xl px-5 py-8 md:px-10 md:py-12">
        <Link
          href={`/home/trades/${tradeId}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to {trade.display_name}
        </Link>

        <div className="mt-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            <Receipt className="h-3 w-3" aria-hidden />
            Record a payment
          </p>
          <h1 className="mt-3 text-[28px] font-bold leading-[1.1] tracking-tight md:text-[36px]">
            Add a payment to {trade.display_name}.
          </h1>
          <p className="mt-3 text-[15px] leading-[1.55] text-[#1B1A17]/70">
            Snap or upload the bank-transfer screenshot, receipt or invoice.
            {aiEnabled
              ? " We'll try to read the total, date and method automatically — you always confirm."
              : " Enter the details manually — you can always attach a screenshot for the record."}
          </p>
        </div>

        <div className="mt-10">
          <PayForm tradeId={tradeId} aiEnabled={aiEnabled} />
        </div>

        <p className="mt-8 border-t border-[#1B1A17]/12 pt-6 text-[12px] leading-[1.5] text-[#1B1A17]/45">
          XRatedTrade does not process, hold, or clear payments. This is a
          record only — your bank transfer or cash exchange happens outside
          the platform.
        </p>
      </div>
    </main>
  );
}
