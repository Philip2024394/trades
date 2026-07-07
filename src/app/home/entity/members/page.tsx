// /home/entity/members
//
// Owner-only. Manage members of the active entity — invite new ones,
// change roles, toggle financial visibility, remove.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  Users,
  Clock,
  Building2,
  Info
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";
import { MembersTable } from "./MembersTable";
import { InviteMemberForm } from "./InviteMemberForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Members · Entity · My Notebook" };

export default async function MembersPage() {
  const party = await loadHomeownerSession();
  if (!party) redirect("/home/sign-in?next=/home/entity/members");

  const active = await loadActiveMembership();
  if (!active) redirect("/home/entity");

  const isPersonal = active.entity.tier === "individual";
  const isOwner = active.role === "owner";

  const { data: members } = await supabaseAdmin
    .from("os_entity_members")
    .select(
      "id, party_id, role, can_see_financials, status, joined_at, party:os_parties(id, display_name, email)"
    )
    .eq("entity_id", active.entity_id)
    .in("status", ["active", "paused"])
    .order("joined_at", { ascending: true });

  const { data: pending } = await supabaseAdmin
    .from("os_entity_member_invites")
    .select(
      "id, invited_email, invited_display_name, proposed_role, can_see_financials, sent_at, expires_at, status"
    )
    .eq("entity_id", active.entity_id)
    .eq("status", "pending")
    .order("sent_at", { ascending: false });

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

      <div className="relative mx-auto max-w-3xl px-5 py-8 md:px-10 md:py-12">
        <div className="flex items-center justify-between">
          <Link
            href="/home/entity"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Entity
          </Link>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            Members · Roles
          </span>
        </div>

        <div className="mt-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            <Users className="h-3 w-3" aria-hidden />
            {active.entity.display_name}
          </p>
          <h1 className="mt-3 text-[28px] font-bold leading-[1.1] tracking-tight md:text-[36px]">
            Members &amp; roles.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-[1.55] text-[#1B1A17]/70">
            Invite foremen, finance leads, estimators, or viewers. Owner is
            the only role that can hire and fire, or change financial
            visibility.
          </p>
        </div>

        {isPersonal ? (
          <div className="mt-10 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5">
            <div className="flex items-start gap-3">
              <Building2
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-[#1B1A17]">
                  This is your personal entity.
                </p>
                <p className="mt-1 text-[13px] leading-[1.55] text-[#1B1A17]/70">
                  Personal Notebooks are single-member by design. To invite
                  foremen, estimators, or trades, create a business entity first.
                </p>
                <Link
                  href="/home/entity/create"
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[13px] font-bold text-neutral-900 hover:bg-amber-300"
                >
                  Create a business entity
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {isOwner ? (
              <section className="mt-10 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-5">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/60">
                  Invite a member
                </p>
                <div className="mt-4">
                  <InviteMemberForm />
                </div>
              </section>
            ) : (
              <div className="mt-10 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4 text-[13px] text-[#1B1A17]/60">
                <Info className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
                Only owners can invite members or change roles. You&apos;re
                viewing this as {active.role}.
              </div>
            )}

            <section className="mt-10">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
                Active members ({members?.length ?? 0})
              </h2>
              <div className="mt-4">
                <MembersTable
                  isOwner={isOwner}
                  currentPartyId={party.id}
                  members={(members ?? []).map((m) => {
                    const partyRow = Array.isArray(m.party) ? m.party[0] : m.party;
                    return {
                      id: m.id,
                      party_id: m.party_id,
                      display_name: partyRow?.display_name ?? "Unknown",
                      email: partyRow?.email ?? "",
                      role: m.role,
                      can_see_financials: m.can_see_financials,
                      status: m.status,
                      joined_at: m.joined_at
                    };
                  })}
                />
              </div>
            </section>

            {(pending ?? []).length > 0 ? (
              <section className="mt-10">
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
                  Pending invitations ({pending?.length ?? 0})
                </h2>
                <ul className="mt-4 space-y-2">
                  {(pending ?? []).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-start gap-3 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-3"
                    >
                      <Clock
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-bold text-[#1B1A17]">
                          {p.invited_display_name || p.invited_email}
                        </div>
                        <div className="mt-0.5 text-[12px] text-[#1B1A17]/55">
                          {p.invited_email}
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-wider text-amber-300">
                          {p.proposed_role}
                          {p.can_see_financials ? " · £ visible" : ""}
                        </div>
                      </div>
                      <div className="text-[11px] text-[#1B1A17]/45">
                        Expires{" "}
                        {new Date(p.expires_at).toLocaleDateString("en-GB", {
                          month: "short",
                          day: "numeric"
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
