// /nex-app/refacing/companies/[slug]/ask · Contact Company entry (2026-08-13).
//
// The "Contact Company" CTA on EVERY trade card routes here per the standing
// NEX Trade Card Rule (memory: project_nex_trade_card_rule_2026_08_13.md · Rule 2).
//
// Accepts enquiries for ANY discoverable listing — including unclaimed / verified /
// claimed listings that aren't paid members yet. The routing behaviour differs:
//
//   PAID MEMBER (partner)
//     → enquiry goes directly to this trade's NEX Chat inbox
//     → 8-hour SLA · if no reply, NEX rolls to the next eligible Refacing Trade Member
//
//   UNCLAIMED / VERIFIED / CLAIMED (not-yet-paid)
//     → enquiry does NOT land in this trade's inbox (their inbox is closed until
//       they activate their Refacing Trade Member subscription)
//     → NEX invites this trade to claim + activate
//     → in parallel, NEX routes the homeowner to the next eligible Refacing Trade
//       Member in the area so the homeowner isn't left waiting
//
// Governance:
//   · Never surfaces the trade's phone number as a contact route.
//   · Never says "pay to get leads" — for members, the message is "we route
//     suitable enquiries via NEX Chat with an 8h SLA".
//   · Never promises delivery — the Trade Exchange evaluates suitability
//     per-enquiry (see docs/refacing/REFACING-MEMBER-ENTITLEMENT-SPEC.md § 4 + § 4A).

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Clock, ArrowRightLeft } from "lucide-react";
import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";
import { isPaidMember } from "@/lib/nex/centre-publishing/paidMemberEntitlements";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

async function loadListing(slug: string) {
  const res = await supabaseNexAdmin
    .from("directory_seeds")
    .select("id, slug, business_name, town, county, postcode, category, directory_state")
    .eq("slug", slug)
    .maybeSingle();
  return res.data ?? null;
}

const ORANGE = "#F97316";

export default async function ContactCompanyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const partner = isPaidMember(listing);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/nex-app/refacing/companies" className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black">
          <ArrowLeft size={14} strokeWidth={2} />
          Back to directory
        </Link>
        <Link href="/nex-app" aria-label="NEX home" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nex-logo.png" alt="NEX" className="h-6 w-auto object-contain" />
        </Link>
      </div>

      <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ORANGE }}>
          <MessageSquare size={12} strokeWidth={2.5} />
          NEX Chat enquiry
        </div>
        <h1 className="mt-1 text-2xl font-black leading-tight">
          Contact {listing.business_name}
        </h1>
        <p className="mt-2 text-sm text-black/65">
          {listing.town ? `${listing.town} · ` : ""}{listing.category ?? "Staircase Refacing"}
        </p>

        {partner ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] leading-relaxed text-black/80">
            <div className="font-black uppercase tracking-wider text-emerald-800">
              Routing your enquiry to {listing.business_name}
            </div>
            <p className="mt-2">
              {listing.business_name} is a NEX Refacing Trade Member — your enquiry will land in their NEX Chat inbox.
            </p>
            <ul className="mt-3 space-y-1 text-[12.5px]">
              <li className="flex items-start gap-2">
                <Clock size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-emerald-700" />
                8-hour response window · if the trade doesn't reply, NEX automatically rolls your enquiry to the next eligible Refacing Trade Member.
              </li>
              <li className="flex items-start gap-2">
                <MessageSquare size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-emerald-700" />
                All messages stay inside NEX Chat. NEX never gives out the trade's phone number.
              </li>
            </ul>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-relaxed text-black/80">
            <div className="font-black uppercase tracking-wider text-amber-800">
              Routing your enquiry via NEX
            </div>
            <p className="mt-2">
              {listing.business_name} is listed on NEX but hasn't activated their Refacing Trade Member subscription yet, so their NEX Chat inbox isn't open. We won't leave you waiting:
            </p>
            <ul className="mt-3 space-y-1 text-[12.5px]">
              <li className="flex items-start gap-2">
                <ArrowRightLeft size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-amber-700" />
                NEX will route your enquiry to the next eligible Refacing Trade Member in your area.
              </li>
              <li className="flex items-start gap-2">
                <Clock size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-amber-700" />
                8-hour response window per trade · rotates automatically until a suitable member replies.
              </li>
              <li className="flex items-start gap-2">
                <MessageSquare size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-amber-700" />
                All messages stay inside NEX Chat. NEX never gives out any trade's phone number.
              </li>
            </ul>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-black/10 bg-white p-4 text-[12.5px] leading-relaxed text-black/75">
          <div className="font-black uppercase tracking-wider text-black/70">
            NEX Chat is opening soon
          </div>
          <p className="mt-2">
            The full NEX Chat surface is being wired up. In the meantime, please email
            {" "}<a href="mailto:asknexapp@gmail.com" className="font-semibold text-orange-600 underline">asknexapp@gmail.com</a>{" "}
            with your enquiry and the business name, and NEX will route it under the same rules.
          </p>
        </div>

        <p className="mt-4 text-[11px] leading-snug text-black/50">
          NEX owns the enquiry journey. The directory helps you find the right trade · NEX Chat is where the relationship happens.
        </p>
      </section>
    </div>
  );
}
