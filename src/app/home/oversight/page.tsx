// /home/oversight
//
// Boss dashboard. One screen showing every site the active entity is
// running, every engagement + committed £, every payment paid, and a
// recent-activity strip from the audit log. Financials gated by role.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  Building2,
  Users,
  PoundSterling,
  ClipboardCheck,
  ExternalLink,
  ArrowRight,
  Sparkles,
  History,
  HardHat,
  UserPlus,
  Receipt,
  ImageIcon,
  Lock
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";
import { hasFinancialAccess } from "@/lib/os/entities";

export const dynamic = "force-dynamic";
export const metadata = { title: "Oversight · My Notebook" };

const VERB_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "entity.created": Building2,
  "site.created": HardHat,
  "site.engagement.created": ClipboardCheck,
  "engagement.invite_sent": UserPlus,
  "member.invited": UserPlus,
  "member.accepted_invite": Users,
  "member.updated": Users,
  "member.removed": Users,
  "payment.recorded": Receipt
};

const VERB_LABEL: Record<string, string> = {
  "entity.created": "Entity created",
  "site.created": "New site opened",
  "site.engagement.created": "Sub-trade hired",
  "engagement.invite_sent": "Notebook invite sent",
  "member.invited": "Member invited",
  "member.accepted_invite": "Member accepted",
  "member.updated": "Role updated",
  "member.removed": "Member removed",
  "payment.recorded": "Payment recorded"
};

export default async function OversightPage() {
  const party = await loadHomeownerSession();
  if (!party) redirect("/home/sign-in?next=/home/oversight");

  const active = await loadActiveMembership();
  if (!active) redirect("/home/entity");

  const showFinancials = hasFinancialAccess(active);

  // --- Load everything for this entity ---
  const [
    { data: sites },
    { data: engagements },
    { data: payments },
    { data: members },
    { data: recentEvents }
  ] = await Promise.all([
    supabaseAdmin
      .from("os_sites")
      .select("id, name, site_type, status, postcode, started_at")
      .eq("owner_entity_id", active.entity_id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("os_site_engagements")
      .select(
        "id, site_id, hired_display_name, hired_trade, agreed_price_pence, deposit_pence, status, business_id"
      )
      .eq("owner_entity_id", active.entity_id),
    supabaseAdmin
      .from("os_project_payments")
      .select("id, amount_pence, status, paid_at, to_business_id")
      .eq("paying_entity_id", active.entity_id),
    supabaseAdmin
      .from("os_entity_members")
      .select("id, role, status")
      .eq("entity_id", active.entity_id)
      .eq("status", "active"),
    supabaseAdmin
      .from("os_entity_audit_events")
      .select("id, verb, after_state, created_at, actor_party_id")
      .eq("entity_id", active.entity_id)
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  // --- Aggregations ---
  const activeSites = (sites ?? []).filter(
    (s) => s.status === "active" || s.status === "planned"
  );
  const totalCommittedPence = (engagements ?? [])
    .filter((e) => e.status !== "cancelled")
    .reduce((sum, e) => sum + (e.agreed_price_pence ?? 0), 0);
  const totalDepositPence = (engagements ?? [])
    .filter((e) => e.status !== "cancelled")
    .reduce((sum, e) => sum + (e.deposit_pence ?? 0), 0);
  const totalPaidPence = (payments ?? [])
    .filter(
      (p) => p.status === "both_confirmed" || p.status === "recorded"
    )
    .reduce((sum, p) => sum + p.amount_pence, 0);
  const pendingInvites = (engagements ?? []).filter(
    (e) => !e.business_id && e.status !== "cancelled"
  ).length;

  // Sites rollup
  const engagementsBySite = new Map<
    string,
    { count: number; committed: number; deposits: number }
  >();
  for (const e of engagements ?? []) {
    const cur = engagementsBySite.get(e.site_id) ?? {
      count: 0,
      committed: 0,
      deposits: 0
    };
    if (e.status !== "cancelled") {
      cur.count += 1;
      cur.committed += e.agreed_price_pence ?? 0;
      cur.deposits += e.deposit_pence ?? 0;
    }
    engagementsBySite.set(e.site_id, cur);
  }

  // Trade roll-up: group engagements by hired_trade
  const tradeRollup = new Map<
    string,
    { hires: number; committed: number; linked: number }
  >();
  for (const e of engagements ?? []) {
    if (e.status === "cancelled") continue;
    const cur = tradeRollup.get(e.hired_trade) ?? {
      hires: 0,
      committed: 0,
      linked: 0
    };
    cur.hires += 1;
    cur.committed += e.agreed_price_pence ?? 0;
    if (e.business_id) cur.linked += 1;
    tradeRollup.set(e.hired_trade, cur);
  }

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

      <div className="relative mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-12">
        <div className="flex items-center justify-between">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            My Notebook
          </Link>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            Oversight
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
              <Sparkles className="h-3 w-3" aria-hidden />
              {active.entity.display_name}
            </p>
            <h1 className="mt-3 text-[32px] font-bold leading-[1.05] tracking-tight md:text-[42px]">
              One screen.<br />Every site. Every sub. Every pound.
            </h1>
          </div>
        </div>

        {/* KPI cards */}
        <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Active sites"
            value={String(activeSites.length)}
            sublabel={`${(sites ?? []).length} total`}
            icon={<Building2 className="h-4 w-4" aria-hidden />}
          />
          <Kpi
            label="Engagements"
            value={String((engagements ?? []).length)}
            sublabel={`${pendingInvites} pending invite`}
            icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
          />
          {showFinancials ? (
            <>
              <Kpi
                label="Committed"
                value={`£${(totalCommittedPence / 100).toLocaleString("en-GB")}`}
                sublabel={`£${(totalDepositPence / 100).toLocaleString("en-GB")} deposits`}
                icon={<PoundSterling className="h-4 w-4" aria-hidden />}
                accent
              />
              <Kpi
                label="Paid on record"
                value={`£${(totalPaidPence / 100).toLocaleString("en-GB")}`}
                sublabel={`${
                  (payments ?? []).filter(
                    (p) =>
                      p.status === "both_confirmed" || p.status === "recorded"
                  ).length
                } payments`}
                icon={<Receipt className="h-4 w-4" aria-hidden />}
              />
            </>
          ) : (
            <>
              <Kpi
                label="Team"
                value={String((members ?? []).length)}
                sublabel="active members"
                icon={<Users className="h-4 w-4" aria-hidden />}
              />
              <Kpi
                label="Financials"
                value="Restricted"
                sublabel="Owner controls visibility"
                icon={<Lock className="h-4 w-4" aria-hidden />}
              />
            </>
          )}
        </section>

        {/* Sites strip */}
        <section className="mt-14">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Sites at a glance
            </h2>
            <Link
              href="/home/sites"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-300 hover:text-amber-200"
            >
              Open all sites
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>

          {(sites ?? []).length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#1B1A17]/15 p-8 text-center">
              <Building2 className="mx-auto h-8 w-8 text-[#1B1A17]/35" aria-hidden />
              <p className="mt-3 text-[14px] text-[#1B1A17]/60">
                No sites yet — start with one and every hire follows.
              </p>
              <Link
                href="/home/sites/new"
                className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[13px] font-bold text-neutral-900 hover:bg-amber-300"
              >
                Create your first site
              </Link>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#1B1A17]/12">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#1B1A17]/4">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1B1A17]/55">
                      Site
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1B1A17]/55">
                      Hires
                    </th>
                    {showFinancials ? (
                      <>
                        <th className="hidden px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1B1A17]/55 sm:table-cell">
                          Committed
                        </th>
                        <th className="hidden px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1B1A17]/55 md:table-cell">
                          Deposits
                        </th>
                      </>
                    ) : null}
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(sites ?? []).map((s) => {
                    const roll = engagementsBySite.get(s.id) ?? {
                      count: 0,
                      committed: 0,
                      deposits: 0
                    };
                    return (
                      <tr
                        key={s.id}
                        className="transition hover:bg-[#1B1A17]/4"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/home/sites/${s.id}`}
                            className="block"
                          >
                            <div className="font-bold text-[#1B1A17] hover:text-amber-200">
                              {s.name}
                            </div>
                            <div className="mt-0.5 text-[11px] uppercase tracking-wider text-[#1B1A17]/55">
                              {s.postcode || s.site_type.replace(/_/g, " ")}
                              {" · "}
                              <span
                                className={
                                  s.status === "active"
                                    ? "text-emerald-300"
                                    : "text-[#1B1A17]/60"
                                }
                              >
                                {s.status.replace(/_/g, " ")}
                              </span>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[14px] font-bold">
                          {roll.count}
                        </td>
                        {showFinancials ? (
                          <>
                            <td className="hidden px-4 py-3 text-right font-mono text-[14px] font-bold text-amber-300 sm:table-cell">
                              £{(roll.committed / 100).toLocaleString("en-GB")}
                            </td>
                            <td className="hidden px-4 py-3 text-right font-mono text-[13px] text-[#1B1A17]/60 md:table-cell">
                              £{(roll.deposits / 100).toLocaleString("en-GB")}
                            </td>
                          </>
                        ) : null}
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/home/sites/${s.id}`}
                            className="text-[#1B1A17]/45 hover:text-amber-200"
                            aria-label={`Open ${s.name}`}
                          >
                            <ArrowRight className="h-4 w-4" aria-hidden />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Trade rollup */}
        {tradeRollup.size > 0 ? (
          <section className="mt-14">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
                Trades on the record
              </h2>
              <Link
                href="/home/trades/invite"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-300 hover:text-amber-200"
              >
                Manage circle
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from(tradeRollup.entries())
                .sort((a, b) => b[1].committed - a[1].committed)
                .map(([trade, roll]) => (
                  <div
                    key={trade}
                    className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4"
                  >
                    <div className="text-[12px] font-extrabold uppercase tracking-wider text-amber-300">
                      {trade.replace(/-/g, " ")}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[22px] font-black text-[#1B1A17]">
                        {roll.hires}
                      </span>
                      <span className="text-[12px] text-[#1B1A17]/55">
                        engagement{roll.hires === 1 ? "" : "s"}
                      </span>
                    </div>
                    {showFinancials ? (
                      <div className="mt-1 text-[13px] font-mono text-amber-300">
                        £{(roll.committed / 100).toLocaleString("en-GB")} committed
                      </div>
                    ) : null}
                    <div className="mt-2 text-[11px] text-[#1B1A17]/55">
                      {roll.linked} linked · {roll.hires - roll.linked} awaiting
                      Notebook
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : null}

        {/* Recent activity */}
        <section className="mt-14">
          <h2 className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
            <History className="h-3 w-3" aria-hidden />
            Recent activity
          </h2>

          {(recentEvents ?? []).length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#1B1A17]/15 p-6 text-center text-[13px] text-[#1B1A17]/55">
              No activity yet — do something and it appears here.
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {(recentEvents ?? []).map((ev) => {
                const Icon = VERB_ICON[ev.verb] ?? Sparkles;
                const label = VERB_LABEL[ev.verb] ?? ev.verb;
                const after = ev.after_state as Record<string, unknown> | null;
                let detail = "";
                if (after) {
                  if (typeof after.name === "string") detail = after.name;
                  else if (typeof after.hired === "string") detail = String(after.hired);
                  else if (typeof after.display_name === "string")
                    detail = String(after.display_name);
                  else if (typeof after.email === "string")
                    detail = String(after.email);
                }
                return (
                  <li
                    key={ev.id}
                    className="flex items-start gap-3 rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-[#1B1A17]">
                        {label}
                        {detail ? (
                          <span className="ml-2 font-normal text-[#1B1A17]/60">
                            {detail}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#1B1A17]/45">
                        {new Date(ev.created_at).toLocaleString("en-GB")}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Info footer */}
        <p className="mt-14 flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-[12px] leading-[1.5] text-[#1B1A17]/60">
          <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" aria-hidden />
          <span>
            Financial figures on this page are only visible to owners and
            finance-role members. Foremen see engagement counts + timelines
            without pounds unless the owner grants £ visibility on their
            member record.
          </span>
        </p>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  sublabel,
  icon,
  accent
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? "border-amber-400/30 bg-amber-400/5"
          : "border-[#1B1A17]/12 bg-[#1B1A17]/4"
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/55">
        <span aria-hidden className={accent ? "text-amber-300" : "text-[#1B1A17]/55"}>
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 text-[28px] font-black leading-none text-[#1B1A17]">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[#1B1A17]/55">{sublabel}</div>
    </div>
  );
}
