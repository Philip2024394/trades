// /apprenticeships/apply/success — post-submit confirmation.

import Link from "next/link";
import { CircleCheck, ArrowUpRight, GraduationCap, Sparkles } from "lucide-react";
import { ApprenticeshipBanner } from "@/components/apprenticeships/ApprenticeshipBanner";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic = "force-dynamic";

export default async function SuccessPage(
  { searchParams }: { searchParams: Promise<{ trade?: string; notified?: string }> }
) {
  const sp = await searchParams;
  const trade    = sp.trade    ?? "";
  const notified = Number(sp.notified ?? "0");
  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <div className="mx-auto max-w-[720px] px-4 py-16 md:px-6">
        <ApprenticeshipBanner
          variant="button-under"
          caption="You're on your way. Verified local trades will see your application first."
          ctaLabel="See live requests"
          href="/apprenticeships"
          className="mb-8"
        />

        <div className="rounded-2xl border-2 bg-white p-8 shadow-sm md:p-10" style={{ borderColor: "#22C55E" }}>
          <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "#DCFCE7" }}>
            <CircleCheck size={22} strokeWidth={2.6} className="text-green-700"/>
          </div>
          <h1 className="mt-4 text-[28px] font-black leading-tight text-neutral-900 md:text-[36px]">
            You're in — your application is live
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-neutral-700 md:text-[15px]">
            {notified > 0 ? (
              <><strong>{notified} verified local {trade || "trade"} employer{notified === 1 ? "" : "s"}</strong> just got a notification about you.</>
            ) : (
              <>Your application is live. We'll alert every verified {trade || "trade"} in your area as they come on board.</>
            )}
            {" "}Employers who want to reach out pay 1 washer to see your WhatsApp — so when your phone pings, it's a serious offer.
          </p>

          <p className="mt-5 inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-white">
            <GraduationCap size={11} strokeWidth={2.6}/>
            The Networkers supports UK trade youth
          </p>

          <div className="mt-6 space-y-2 text-[13px] text-neutral-700">
            <p><strong className="text-neutral-900">Next 24-48 hours:</strong> Keep your WhatsApp visible + your phone charged.</p>
            <p><strong className="text-neutral-900">If a trade messages you:</strong> Reply fast. First reply almost always wins.</p>
            <p><strong className="text-neutral-900">Not sure how to reply?</strong> "Yes, I'm still keen — when suits you?" is a perfect start.</p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {trade && (
              <Link
                href={`/careers/${trade}`}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
                style={{ backgroundColor: "#FFB300" }}
              >
                <Sparkles size={12} strokeWidth={2.6}/>
                Read the {trade} career guide
                <ArrowUpRight size={12} strokeWidth={2.6}/>
              </Link>
            )}
            <Link
              href="/apprenticeships"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border-2 px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            >
              See all live requests
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
