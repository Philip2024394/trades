// /home/entity
//
// The active entity control panel. Shows what entity you're currently
// acting as, who the members are, and lets you switch between the
// entities you belong to or create a new business/contractor/enterprise
// entity.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  Building2,
  UserRound,
  BadgeCheck,
  Users,
  Plus,
  RefreshCw
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import {
  loadActiveMembership,
  listEntitiesForSwitch
} from "@/lib/os/entitySession";
import { EntitySwitcher } from "./EntitySwitcher";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entity · My Notebook" };

const TIER_LABEL: Record<string, string> = {
  individual: "Individual · Personal",
  small_business: "Small business",
  contractor: "Contractor / Foreman",
  enterprise: "Enterprise · Multi-site",
  public_sector: "Public sector / Regulated"
};

const TIER_DESCRIPTION: Record<string, string> = {
  individual:
    "Your personal Notebook — for your own home, projects, and trades.",
  small_business:
    "A single business or single site you commission work for.",
  contractor:
    "A construction business — you hire foremen and sub-trades across multiple sites.",
  enterprise:
    "A multi-site business — housing, dev, FM. Financial visibility roles required.",
  public_sector:
    "Regulated commissioning — council, NHS estates, MoD, DfE. Audit trail on by default."
};

export default async function EntityPage() {
  const party = await loadHomeownerSession();
  if (!party) redirect("/home/sign-in?next=/home/entity");

  const active = await loadActiveMembership();
  const memberships = await listEntitiesForSwitch();

  const members = active
    ? (
        (
          await supabaseAdmin
            .from("os_entity_members")
            .select(
              "id, party_id, role, can_see_financials, joined_at, party:os_parties(id, display_name, email)"
            )
            .eq("entity_id", active.entity_id)
            .eq("status", "active")
            .order("joined_at", { ascending: true })
        ).data ?? []
      )
    : [];

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

      <div className="relative mx-auto max-w-3xl px-5 py-8 md:px-10 md:py-12">
        <div className="flex items-center justify-between">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            My Notebook
          </Link>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            Entity
          </span>
        </div>

        <div className="mt-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            Currently acting as
          </p>
          {active ? (
            <>
              <div className="mt-3 flex items-start gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    active.entity.tier === "individual"
                      ? "bg-[#1B1A17]/5 text-[#1B1A17]/70"
                      : "bg-amber-400/15 text-amber-300"
                  }`}
                >
                  {active.entity.tier === "individual" ? (
                    <UserRound className="h-5 w-5" aria-hidden />
                  ) : (
                    <Building2 className="h-5 w-5" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-[24px] font-bold leading-tight md:text-[28px]">
                    {active.entity.display_name}
                  </h1>
                  <p className="mt-0.5 text-[13px] uppercase tracking-wider text-[#1B1A17]/55">
                    {TIER_LABEL[active.entity.tier] ?? active.entity.tier}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  <BadgeCheck className="h-3 w-3" aria-hidden />
                  Your role: {active.role}
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-[1.55] text-[#1B1A17]/60">
                {TIER_DESCRIPTION[active.entity.tier] ?? ""}
              </p>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-[#1B1A17]/55">
              No active entity — please sign in again.
            </p>
          )}
        </div>

        {/* Members */}
        {active ? (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Members
              </h2>
              {active.role === "owner" &&
              active.entity.tier !== "individual" ? (
                <Link
                  href="/home/entity/members"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-300 hover:text-amber-200"
                >
                  <Plus className="h-3 w-3" aria-hidden />
                  Invite member
                </Link>
              ) : null}
            </div>

            <ul className="mt-4 space-y-3">
              {members.map((m) => {
                const partyRecord = Array.isArray(m.party) ? m.party[0] : m.party;
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-4 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[16px] font-black text-amber-300">
                      {partyRecord?.display_name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold text-[#1B1A17]">
                        {partyRecord?.display_name ?? "Unknown"}
                        {m.party_id === party.id ? (
                          <span className="ml-2 rounded-full bg-[#1B1A17]/5 px-2 py-0.5 text-[10px] font-bold uppercase text-[#1B1A17]/60">
                            you
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[12px] text-[#1B1A17]/55">
                        {partyRecord?.email ?? ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                        {m.role}
                      </div>
                      {m.can_see_financials ? (
                        <div className="mt-0.5 text-[11px] text-emerald-300">
                          £ visibility
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* Switcher */}
        <section className="mt-10">
          <h2 className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Switch entity
          </h2>
          <div className="mt-4">
            <EntitySwitcher
              memberships={memberships.map((m) => ({
                entityId: m.entity_id,
                displayName: m.entity.display_name,
                tier: m.entity.tier,
                role: m.role,
                isActive: active ? m.entity_id === active.entity_id : false
              }))}
            />
          </div>
        </section>

        {/* Create business entity */}
        <section className="mt-10 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-6 w-6 text-amber-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#1B1A17]">
                Running a business or a site?
              </p>
              <p className="mt-1 text-[13px] leading-[1.55] text-[#1B1A17]/70">
                Create a business entity to invite foremen, hire trades, and
                see live spend across your projects. Your personal Notebook
                stays yours — this is a separate context.
              </p>
              <Link
                href="/home/entity/create"
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[13px] font-bold text-neutral-900 hover:bg-amber-300"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Create a business entity
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
