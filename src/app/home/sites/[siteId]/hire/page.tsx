// /home/sites/[siteId]/hire — snap or type a sub-trade hire.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, HardHat, Megaphone, ArrowRight } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";
import { loadTradeSession } from "@/lib/os/tradeSession";
import { HireForm } from "./HireForm";

export const dynamic = "force-dynamic";

type Params = { siteId: string };

export default async function HirePage({ params }: { params: Promise<Params> }) {
  const party = await loadHomeownerSession();
  const { siteId } = await params;
  if (!party) redirect(`/home/sign-in?next=/home/sites/${siteId}/hire`);

  const active = await loadActiveMembership();
  if (!active) redirect("/home/entity");

  const { data: site } = await supabaseAdmin
    .from("os_sites")
    .select("id, name, owner_entity_id, city, postcode")
    .eq("id", siteId)
    .maybeSingle();
  if (!site || site.owner_entity_id !== active.entity_id) notFound();

  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

  // If the acting party is a foreman/trade with their own listing we can
  // offer a one-click "Post to The Yard" shortcut with the site region
  // pre-filled — beats making them retype the job details.
  const tradeSession = await loadTradeSession();
  let yardComposeUrl: string | null = null;
  if (tradeSession) {
    const { data: yardListing } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug, edit_token")
      .eq("slug", tradeSession.primaryListingSlug)
      .maybeSingle();
    if (yardListing?.edit_token) {
      const params = new URLSearchParams({
        slug: yardListing.slug,
        token: yardListing.edit_token,
        kind: "job-offer",
        title: `Need crew for ${site.name}`,
        body: `Looking for a sub-trade to help on ${site.name}${
          site.city ? ` (${site.city})` : ""
        }. Reply here if you're available.`,
        region: site.city ?? ""
      });
      yardComposeUrl = `/trade-off/yard/compose?${params.toString()}`;
    }
  }

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
          href={`/home/sites/${siteId}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {site.name}
        </Link>

        <div className="mt-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            <HardHat className="h-3 w-3" aria-hidden />
            Hire a sub-trade
          </p>
          <h1 className="mt-3 text-[26px] font-bold leading-[1.1] tracking-tight md:text-[34px]">
            Snap the agreement.<br />We&apos;ll do the paperwork.
          </h1>
          <p className="mt-3 text-[15px] leading-[1.55] text-[#1B1A17]/70">
            {aiEnabled
              ? "Photograph the handwritten note, whiteboard, or WhatsApp — Claude Vision extracts trade, price, deposit and dates. You confirm."
              : "AI photo-parse isn't configured on this environment yet — enter the details manually below."}
          </p>
        </div>

        {yardComposeUrl && (
          <div className="mt-8 rounded-2xl border border-amber-400/40 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: "#FFB300" }}
              >
                <Megaphone
                  className="h-4 w-4 text-neutral-900"
                  aria-hidden
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-[#1B1A17]">
                  Still hunting for someone?
                </p>
                <p className="mt-0.5 text-[12px] leading-[1.45] text-[#1B1A17]/60">
                  Post this need to The Yard — every trade in your region
                  will see it. Site name + city are pre-filled.
                </p>
                <a
                  href={yardComposeUrl}
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-extrabold text-amber-700 hover:text-amber-800"
                >
                  Post to The Yard
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10">
          <HireForm siteId={siteId} aiEnabled={aiEnabled} />
        </div>

        <p className="mt-8 border-t border-[#1B1A17]/12 pt-6 text-[12px] leading-[1.5] text-[#1B1A17]/45">
          Once saved, this engagement lives on the site record forever.
          It&apos;s auditable, linkable to a Notebook invite for the trade,
          and the source photo is stored privately in your Notebook Storage.
        </p>
      </div>
    </main>
  );
}
