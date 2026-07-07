// /home/sites/[siteId]/hire — snap or type a sub-trade hire.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, HardHat } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";
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
    .select("id, name, owner_entity_id")
    .eq("id", siteId)
    .maybeSingle();
  if (!site || site.owner_entity_id !== active.entity_id) notFound();

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
