// /home/trades/invite
//
// Owner-facing. Sarah invites her existing trades (Mike the carpenter,
// Bob the plumber) to thenetworkers.app so their records live inside her
// Notebook Circle from day one.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  Mail,
  Clock,
  CheckCircle2,
  UserPlus,
  Info
} from "lucide-react";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invite a trade · Notebook · XRatedTrade"
};

type InviteRow = {
  id: string;
  invited_display_name: string;
  invited_email: string;
  invited_trade: string;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
  resulting_business_listing_id: string | null;
};

export default async function InvitePage() {
  const party = await loadHomeownerSession();
  if (!party) {
    redirect("/home/sign-in?next=/home/trades/invite");
  }

  const active = await loadActiveMembership();

  // Scope invites to the active entity when we have one; fall back to
  // party-level lookup for pre-entity historical rows.
  const invitesQuery = supabaseAdmin
    .from("os_homeowner_trade_invites")
    .select(
      "id, invited_display_name, invited_email, invited_trade, status, sent_at, accepted_at, created_at, resulting_business_listing_id"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: invites } = active
    ? await invitesQuery.eq("inviter_entity_id", active.entity_id)
    : await invitesQuery.eq("inviter_party_id", party.id);

  const pending = (invites ?? []).filter((i) => i.status === "pending");
  const accepted = (invites ?? []).filter((i) => i.status === "accepted");

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.14) 0%, transparent 60%)"
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 py-8 md:px-10 md:py-12">
        <div className="flex items-center justify-between">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back to my Notebook
          </Link>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            Trade Circle
          </span>
        </div>

        <div className="mt-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"
            />
            Bring your own trades
          </p>
          <h1 className="mt-4 text-[32px] font-bold leading-[1.1] tracking-tight md:text-[42px]">
            Invite Mike the Carpenter.<br />And the rest of your circle.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.55] text-[#1B1A17]/70 md:text-[16px]">
            Every quote, invoice, message, and photo with a trade stays in your
            Notebook — but only if the trade is on the platform. Invite yours
            here. Free forever, no card required from them.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-6">
          <InviteForm />
        </div>

        <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
          <p className="text-[13px] leading-[1.55] text-[#1B1A17]/70">
            <Info
              className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-amber-300"
              aria-hidden
            />
            If the trade you enter is already on thenetworkers.app, we&apos;ll
            skip the email and add them to your Circle directly.
          </p>
        </div>

        {pending.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Pending invitations
            </h2>
            <ul className="mt-4 space-y-3">
              {pending.map((invite) => (
                <InviteCard key={invite.id} invite={invite} />
              ))}
            </ul>
          </section>
        ) : null}

        {accepted.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              In your Circle
            </h2>
            <ul className="mt-4 space-y-3">
              {accepted.map((invite) => (
                <InviteCard key={invite.id} invite={invite} accepted />
              ))}
            </ul>
          </section>
        ) : null}

        {(invites ?? []).length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-[#1B1A17]/15 p-8 text-center">
            <UserPlus
              className="mx-auto h-8 w-8 text-[#1B1A17]/35"
              aria-hidden
            />
            <p className="mt-3 text-[14px] text-[#1B1A17]/60">
              No invitations yet. Start by inviting one trade above — the ones
              you already trust.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function InviteCard({
  invite,
  accepted
}: {
  invite: InviteRow;
  accepted?: boolean;
}) {
  const when = new Date(invite.accepted_at ?? invite.sent_at ?? invite.created_at);
  return (
    <li className="flex items-start gap-4 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          accepted ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"
        }`}
      >
        {accepted ? (
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        ) : (
          <Clock className="h-5 w-5" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold text-[#1B1A17]">
          {invite.invited_display_name}
        </div>
        <div className="mt-0.5 text-[13px] text-[#1B1A17]/55">
          {invite.invited_trade.replace(/-/g, " ")} · {invite.invited_email}
        </div>
        <div className="mt-1 text-[12px] text-[#1B1A17]/45">
          {accepted ? "Joined " : "Invited "}
          {when.toLocaleDateString("en-GB")}
        </div>
      </div>
      {accepted && invite.resulting_business_listing_id ? (
        <Link
          href={`/home/trades/${invite.resulting_business_listing_id}`}
          className="inline-flex items-center gap-1 self-center text-[12px] font-semibold text-amber-300 hover:text-amber-200"
        >
          Open file
          <span aria-hidden>→</span>
        </Link>
      ) : !accepted ? (
        <span className="inline-flex items-center gap-1 self-center text-[12px] font-semibold text-[#1B1A17]/45">
          <Mail className="h-3 w-3" aria-hidden />
          Sent
        </span>
      ) : null}
    </li>
  );
}
