// /home/sites/[siteId] — the site record.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  MapPin,
  Users,
  Plus,
  PoundSterling,
  Calendar,
  ImageIcon,
  ClipboardCheck
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import {
  loadActiveMembership,
  requireActiveMembership
} from "@/lib/os/entitySession";
import { hasFinancialAccess } from "@/lib/os/entities";

export const dynamic = "force-dynamic";

type Params = { siteId: string };

const TYPE_LABEL: Record<string, string> = {
  renovation: "Renovation",
  new_build: "New build",
  commercial: "Commercial",
  extension: "Extension",
  maintenance: "Maintenance"
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-400/15 text-amber-200",
  accepted: "bg-blue-400/15 text-blue-200",
  in_progress: "bg-emerald-500/15 text-emerald-200",
  completed: "bg-emerald-500/25 text-emerald-100",
  disputed: "bg-red-500/15 text-red-200",
  cancelled: "bg-[#1B1A17]/5 text-[#1B1A17]/55"
};

export default async function SitePage({ params }: { params: Promise<Params> }) {
  const party = await loadHomeownerSession();
  const { siteId } = await params;
  if (!party) redirect(`/home/sign-in?next=/home/sites/${siteId}`);

  const active = await loadActiveMembership();
  if (!active) redirect("/home/entity");

  const { data: site } = await supabaseAdmin
    .from("os_sites")
    .select(
      "id, name, site_type, status, address_line_1, postcode, started_at, estimated_completion_at, owner_entity_id, created_at"
    )
    .eq("id", siteId)
    .maybeSingle();

  if (!site || site.owner_entity_id !== active.entity_id) notFound();

  const { data: engagements } = await supabaseAdmin
    .from("os_site_engagements")
    .select(
      "id, hired_display_name, hired_trade, service_description, agreed_price_pence, deposit_pence, agreed_start_date, agreed_end_date, actual_start_date, actual_end_date, status, captured_via, captured_source_url, business_id, created_at"
    )
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  const committedPence = (engagements ?? [])
    .filter((e) => e.status !== "cancelled")
    .reduce((sum, e) => sum + (e.agreed_price_pence ?? 0), 0);
  const depositPence = (engagements ?? [])
    .filter((e) => e.status !== "cancelled")
    .reduce((sum, e) => sum + (e.deposit_pence ?? 0), 0);

  const showFinancials = hasFinancialAccess(active);

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.10) 0%, transparent 60%)"
        }}
      />

      <div className="relative mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-12">
        <div className="flex items-center justify-between">
          <Link
            href="/home/sites"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Sites
          </Link>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              site.status === "active"
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-[#1B1A17]/5 text-[#1B1A17]/60"
            }`}
          >
            {site.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="mt-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            {TYPE_LABEL[site.site_type] ?? site.site_type}
          </p>
          <h1 className="mt-2 text-[28px] font-bold leading-[1.1] tracking-tight md:text-[36px]">
            {site.name}
          </h1>
          {site.postcode ? (
            <p className="mt-2 inline-flex items-center gap-1 text-[13px] text-[#1B1A17]/60">
              <MapPin className="h-3 w-3" aria-hidden />
              {site.address_line_1 ? `${site.address_line_1} · ` : ""}
              {site.postcode}
            </p>
          ) : null}
        </div>

        {/* Stat strip */}
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Engagements"
            value={String((engagements ?? []).length)}
            icon={<Users className="h-4 w-4" aria-hidden />}
          />
          {showFinancials ? (
            <>
              <Stat
                label="Committed"
                value={`£${(committedPence / 100).toLocaleString("en-GB")}`}
                icon={<PoundSterling className="h-4 w-4" aria-hidden />}
              />
              <Stat
                label="Deposits due"
                value={`£${(depositPence / 100).toLocaleString("en-GB")}`}
                icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
              />
            </>
          ) : (
            <>
              <Stat
                label="Start date"
                value={
                  site.started_at
                    ? new Date(site.started_at).toLocaleDateString("en-GB")
                    : "—"
                }
                icon={<Calendar className="h-4 w-4" aria-hidden />}
              />
              <Stat
                label="Est. completion"
                value={
                  site.estimated_completion_at
                    ? new Date(site.estimated_completion_at).toLocaleDateString(
                        "en-GB"
                      )
                    : "—"
                }
                icon={<Calendar className="h-4 w-4" aria-hidden />}
              />
            </>
          )}
        </section>

        {/* Engagements */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Sub-trade engagements
            </h2>
            <Link
              href={`/home/sites/${siteId}/hire`}
              className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-[12px] font-bold text-neutral-900 hover:bg-amber-300"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Hire a sub-trade
            </Link>
          </div>

          {(engagements ?? []).length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#1B1A17]/15 p-6 text-center text-[13px] text-[#1B1A17]/55">
              No hires yet. Snap a photo of a handwritten agreement and
              we&apos;ll fill this in.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {(engagements ?? []).map((e) => (
                <li key={e.id}>
                <Link
                  href={`/home/sites/${siteId}/engagements/${e.id}`}
                  className="block rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4 transition hover:border-amber-400/40 hover:bg-[#1B1A17]/5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-bold text-[#1B1A17]">
                          {e.hired_display_name}
                        </span>
                        <span className="rounded-full bg-[#1B1A17]/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1B1A17]/60">
                          {e.hired_trade.replace(/-/g, " ")}
                        </span>
                        {e.captured_via === "ai_vision" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                            <ImageIcon className="h-2.5 w-2.5" aria-hidden />
                            AI captured
                          </span>
                        ) : null}
                      </div>
                      {e.service_description ? (
                        <p className="mt-1 text-[13px] text-[#1B1A17]/70">
                          {e.service_description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-[#1B1A17]/55">
                        {e.agreed_start_date ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" aria-hidden />
                            {new Date(e.agreed_start_date).toLocaleDateString(
                              "en-GB"
                            )}
                            {e.agreed_end_date
                              ? ` → ${new Date(e.agreed_end_date).toLocaleDateString(
                                  "en-GB"
                                )}`
                              : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      {showFinancials && e.agreed_price_pence ? (
                        <div className="text-[15px] font-black text-amber-300">
                          £{(e.agreed_price_pence / 100).toLocaleString("en-GB")}
                        </div>
                      ) : null}
                      {showFinancials && e.deposit_pence ? (
                        <div className="text-[11px] text-[#1B1A17]/55">
                          £{(e.deposit_pence / 100).toLocaleString("en-GB")}{" "}
                          deposit
                        </div>
                      ) : null}
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          STATUS_STYLE[e.status] ?? "bg-[#1B1A17]/5 text-[#1B1A17]/60"
                        }`}
                      >
                        {e.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4">
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/55">
        <span aria-hidden className="text-amber-300">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-[22px] font-black leading-none text-[#1B1A17]">
        {value}
      </div>
    </div>
  );
}
